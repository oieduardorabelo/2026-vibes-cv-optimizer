import { searchWithBrowserbase } from './browserbase.js'

export interface JobListing {
  title: string
  company: string
  location: string
  url: string
  source: string
  description: string
  salary: string
  remote: boolean
}

// ---------------------------------------------------------------------------
// JSearch via RapidAPI (supplementary — LinkedIn, Indeed, Glassdoor aggregator)
// Free tier: 200 req/month | Env: JSEARCH_API_KEY
// ---------------------------------------------------------------------------

interface JSearchJob {
  employer_name: string
  job_title: string
  job_description: string
  job_city: string
  job_state: string
  job_country: string
  job_is_remote: boolean
  job_min_salary: number | null
  job_max_salary: number | null
  job_salary_currency: string | null
  job_salary_period: string | null
  job_apply_link: string
  job_publisher: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function searchJSearch(
  query: string,
  location: string
): Promise<JobListing[]> {
  const apiKey = process.env.JSEARCH_API_KEY
  if (!apiKey) return []

  try {
    const q = location ? `${query} in ${location}` : query
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=1&num_pages=1&date_posted=month`
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { data: JSearchJob[] }
    if (!data.data) return []
    return data.data.slice(0, 20).map((job) => {
      let salary = ''
      if (job.job_min_salary && job.job_max_salary) {
        const cur = job.job_salary_currency || ''
        const period = job.job_salary_period || 'YEAR'
        salary = `${cur} ${job.job_min_salary.toLocaleString()}-${job.job_max_salary.toLocaleString()} / ${period.toLowerCase()}`
      }
      const locParts = [job.job_city, job.job_state, job.job_country]
        .filter(Boolean)
        .join(', ')
      return {
        title: job.job_title,
        company: job.employer_name || '',
        location: locParts,
        url: job.job_apply_link || '',
        source: job.job_publisher || 'JSearch',
        description: stripHtml(job.job_description).slice(0, 2000),
        salary,
        remote: job.job_is_remote,
      }
    })
  } catch (err) {
    console.error(`JSearch failed for "${query}" in "${location}":`, err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Adzuna — dedicated /nz/ and /au/ endpoints (supplementary)
// Free tier: 250 req/day | Env: ADZUNA_APP_ID, ADZUNA_APP_KEY
// ---------------------------------------------------------------------------

interface AdzunaResult {
  title: string
  description: string
  redirect_url: string
  company: { display_name: string }
  location: { display_name: string; area: string[] }
  salary_min: number | null
  salary_max: number | null
  created: string
}

async function searchAdzuna(
  query: string,
  countryCode: string,
  city: string
): Promise<JobListing[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return []

  try {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: '20',
      what: query,
      max_days_old: '30',
    })
    if (city) params.set('where', city)

    const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?${params}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []
    const data = (await res.json()) as { results: AdzunaResult[] }
    if (!data.results) return []
    return data.results.slice(0, 20).map((job) => {
      let salary = ''
      if (job.salary_min && job.salary_max) {
        salary = `${Math.round(job.salary_min).toLocaleString()}-${Math.round(job.salary_max).toLocaleString()}`
      }
      const desc = job.description || ''
      const isRemote =
        job.title?.toLowerCase().includes('remote') ||
        job.location?.display_name?.toLowerCase().includes('remote') ||
        desc.toLowerCase().includes('fully remote')
      return {
        title: job.title,
        company: job.company?.display_name || '',
        location: job.location?.display_name || '',
        url: job.redirect_url || '',
        source: 'Adzuna',
        description: stripHtml(desc).slice(0, 2000),
        salary,
        remote: isRemote,
      }
    })
  } catch (err) {
    console.error(`Adzuna failed for "${query}" in ${countryCode}:`, err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function resolveCity(candidateLocation: string): string {
  return candidateLocation.split(',')[0].trim()
}

export async function searchAll(
  queries: string[],
  candidateLocation: string
): Promise<JobListing[]> {
  const city = resolveCity(candidateLocation)
  const promises: Promise<JobListing[]>[] = []

  const configured: string[] = []

  // Primary: Browserbase → Seek + Indeed + LinkedIn (NZ)
  if (process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID) {
    configured.push('Browserbase (Seek + Indeed + LinkedIn)')
    promises.push(searchWithBrowserbase({ queries, city }))
  }

  // Supplementary: JSearch + Adzuna API (NZ only)
  const nzLoc = city ? `${city}, New Zealand` : 'New Zealand'
  for (const q of queries.slice(0, 3)) {
    promises.push(searchJSearch(q, nzLoc))
    promises.push(searchAdzuna(q, 'nz', city))
  }

  if (process.env.JSEARCH_API_KEY) configured.push('JSearch')
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)
    configured.push('Adzuna')

  if (configured.length === 0) {
    console.warn(
      'No job search providers configured. Set at least BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID in .env'
    )
    return []
  }

  console.log(`Searching with: ${configured.join(', ')} | Queries: ${queries.join(', ')}`)

  const results = await Promise.all(promises)
  const flat = results.flat()
  console.log(`Raw results: ${flat.length} jobs before dedup`)
  return deduplicateJobs(flat)
}

function deduplicateJobs(listings: JobListing[]): JobListing[] {
  const seenUrls = new Set<string>()
  const seenTitles = new Set<string>()
  return listings.filter((job) => {
    // Dedup by URL
    const normUrl = job.url?.split('?')[0] || ''
    if (normUrl && seenUrls.has(normUrl)) return false

    // Dedup by title+company (same job cross-listed on Seek + Indeed)
    const titleKey = `${job.title}::${job.company}`.toLowerCase().trim()
    if (titleKey.length > 2 && seenTitles.has(titleKey)) return false

    if (normUrl) seenUrls.add(normUrl)
    if (titleKey.length > 2) seenTitles.add(titleKey)
    return true
  })
}

// ---------------------------------------------------------------------------
// Query generation
// ---------------------------------------------------------------------------

export function generateSearchQueries(
  parsed: {
    targetRoles?: string[]
    topKeywords?: string[]
  },
  prefs: {
    targetRoles?: string[]
    keywords?: string[]
  }
): string[] {
  const queries: string[] = []

  if (prefs.targetRoles?.length) {
    for (const role of prefs.targetRoles.slice(0, 3)) {
      queries.push(role)
    }
  } else if (parsed.targetRoles?.length) {
    for (const role of parsed.targetRoles.slice(0, 3)) {
      queries.push(role)
    }
  }

  // Add keyword-based queries in small groups of 2-3 (not 5-word dumps)
  const allKeywords = [
    ...(prefs.keywords || []),
    ...(parsed.topKeywords || []),
  ]
  const uniqueKeywords = [...new Set(allKeywords)].filter(
    (kw) => !queries.some((q) => q.toLowerCase() === kw.toLowerCase())
  )
  for (let i = 0; i < uniqueKeywords.length && queries.length < 6; i += 3) {
    queries.push(uniqueKeywords.slice(i, i + 3).join(' '))
  }

  return queries.length > 0 ? queries.slice(0, 6) : ['software engineer']
}

export function resolveSearchLocation(
  parsed: { location?: string },
  prefs: { locations?: string[] }
): string {
  if (prefs.locations?.length) return prefs.locations[0]
  return parsed.location || ''
}
