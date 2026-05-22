import {
  createRouter,
  defineEventHandler,
  getRouterParam,
  createError,
} from 'h3'
import { generateText } from 'ai'
import { db } from '../db/index.js'
import { searches, jobs, profiles } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { model } from '../ai/provider.js'
import {
  JOB_ENRICHMENT_SYSTEM_PROMPT,
  buildJobEnrichmentUserPrompt,
} from '../ai/prompts.js'
import {
  searchAll,
  generateSearchQueries,
  resolveSearchLocation,
  type JobListing,
} from '../search/providers.js'

const router = createRouter()

router.get(
  '/api/profiles/:id/searches',
  defineEventHandler(async (event) => {
    const profileId = getRouterParam(event, 'id')!
    return db
      .select()
      .from(searches)
      .where(eq(searches.profileId, profileId))
      .orderBy(desc(searches.createdAt))
  })
)

router.post(
  '/api/profiles/:id/searches',
  defineEventHandler(async (event) => {
    const profileId = getRouterParam(event, 'id')!

    const profileResult = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
    if (!profileResult.length) {
      throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
    }

    const now = new Date()
    const search = {
      id: nanoid(),
      profileId,
      name: `Search ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(searches).values(search)
    return search
  })
)

router.get(
  '/api/searches/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const result = await db
      .select()
      .from(searches)
      .where(eq(searches.id, id))
    if (!result.length) {
      throw createError({ statusCode: 404, statusMessage: 'Search not found' })
    }
    return result[0]
  })
)

router.delete(
  '/api/searches/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    await db.delete(searches).where(eq(searches.id, id))
    return { ok: true }
  })
)

router.get(
  '/api/searches/:id/jobs',
  defineEventHandler(async (event) => {
    const searchId = getRouterParam(event, 'id')!
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.searchId, searchId))
      .orderBy(desc(jobs.matchScore))
  })
)

router.post(
  '/api/searches/:id/run',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!

    const searchResult = await db
      .select()
      .from(searches)
      .where(eq(searches.id, id))
    if (!searchResult.length) {
      throw createError({ statusCode: 404, statusMessage: 'Search not found' })
    }
    const search = searchResult[0]

    const profileResult = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, search.profileId))
    if (!profileResult.length) {
      throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
    }
    const profile = profileResult[0]

    if (!profile.parsedProfile) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Parse the CV first before searching',
      })
    }

    // Clear previous results
    await db.delete(jobs).where(eq(jobs.searchId, id))

    await db
      .update(searches)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(searches.id, id))

    try {
      const parsed = JSON.parse(profile.parsedProfile)
      const prefs = profile.preferences
        ? JSON.parse(profile.preferences)
        : {}

      // 1. Generate search queries
      const queries = generateSearchQueries(parsed, prefs)
      const location = resolveSearchLocation(parsed, prefs)
      console.log(`[search] queries: ${queries.join(', ')} | location: ${location}`)

      // 2. Search all providers
      console.log(`[search] fetching jobs from providers...`)
      const allJobs = await searchAll(queries, location)
      console.log(`[search] ${allJobs.length} jobs after dedup`)

      if (allJobs.length === 0) {
        console.log(`[search] no jobs found, done`)
        await db
          .update(searches)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(searches.id, id))
        return { ok: true, jobCount: 0 }
      }

      // 3. Enrich + score with AI
      console.log(`[search] enriching + scoring ${allJobs.length} jobs...`)
      const enriched = await enrichAndScoreBatched(
        profile.parsedProfile,
        profile.preferences || '{}',
        allJobs
      )
      console.log(`[search] scoring done: ${enriched.length} jobs scored`)

      // 4. Filter based on hard preferences
      const filtered = filterByPreferences(enriched, prefs)
      console.log(`[search] after filtering: ${filtered.length} jobs (removed ${enriched.length - filtered.length})`)

      // 5. Save results
      const now = new Date()
      for (const job of filtered) {
        await db.insert(jobs).values({
          id: nanoid(),
          searchId: id,
          title: job.title,
          company: job.company,
          location: job.enrichedLocation || job.location,
          url: job.url,
          source: job.source,
          description: job.description,
          salary: job.enrichedSalary || job.salary,
          remote: job.enrichedIsRemote ?? job.remote,
          matchScore: job.matchScore,
          matchAnalysis: job.matchAnalysis,
          createdAt: now,
        })
      }

      await db
        .update(searches)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(searches.id, id))

      return { ok: true, jobCount: filtered.length }
    } catch (error) {
      console.error('Search failed:', error)
      await db
        .update(searches)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(searches.id, id))
      throw createError({
        statusCode: 500,
        statusMessage:
          error instanceof Error ? error.message : 'Search failed',
      })
    }
  })
)

// ---------------------------------------------------------------------------
// Enrichment + scoring types
// ---------------------------------------------------------------------------

interface EnrichedJob extends JobListing {
  matchScore: number | null
  matchAnalysis: string | null
  enrichedLocation: string | null
  enrichedIsRemote: boolean | null
  enrichedSalary: string | null
  enrichedSalaryMin: number | null
  enrichedSalaryMax: number | null
  enrichedSeniority: string | null
}

interface AIEnrichmentResult {
  jobIndex: number
  enriched: {
    location: { city: string; country: string; isRemote: boolean }
    salary: {
      min: number | null
      max: number | null
      currency: string
      period: string
    } | null
    seniority: string
    requiredSkills: string[]
  }
  matchScore: number
  matchAnalysis: string
}

// ---------------------------------------------------------------------------
// Enrich + score in batches
// ---------------------------------------------------------------------------

async function enrichAndScoreBatched(
  parsedProfile: string,
  preferences: string,
  listings: JobListing[]
): Promise<EnrichedJob[]> {
  const batchSize = 10
  const results: EnrichedJob[] = []

  const totalBatches = Math.ceil(listings.length / batchSize)

  for (let i = 0; i < listings.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1
    const batch = listings.slice(i, i + batchSize)
    console.log(`[scoring] batch ${batchNum}/${totalBatches} (${batch.length} jobs)...`)

    try {
      const { text } = await generateText({
        model,
        system: JOB_ENRICHMENT_SYSTEM_PROMPT,
        prompt: buildJobEnrichmentUserPrompt(
          parsedProfile,
          preferences,
          batch
        ),
      })

      const scores = extractJson(text) as AIEnrichmentResult[]
      const seen = new Set<number>()

      for (const result of scores) {
        const job = batch[result.jobIndex]
        if (!job) continue
        seen.add(result.jobIndex)

        const e = result.enriched
        const locParts = [e.location.city, e.location.country].filter(Boolean)
        let salaryStr: string | null = null
        if (e.salary && (e.salary.min || e.salary.max)) {
          const parts = [e.salary.currency || '']
          if (e.salary.min && e.salary.max) {
            parts.push(
              `${e.salary.min.toLocaleString()}-${e.salary.max.toLocaleString()}`
            )
          } else if (e.salary.min) {
            parts.push(`${e.salary.min.toLocaleString()}+`)
          } else if (e.salary.max) {
            parts.push(`up to ${e.salary.max.toLocaleString()}`)
          }
          if (e.salary.period && e.salary.period !== 'annual') {
            parts.push(`/ ${e.salary.period}`)
          }
          salaryStr = parts.filter(Boolean).join(' ')
        }

        results.push({
          ...job,
          matchScore: result.matchScore,
          matchAnalysis: result.matchAnalysis,
          enrichedLocation: locParts.length > 0 ? locParts.join(', ') : null,
          enrichedIsRemote: e.location.isRemote,
          enrichedSalary: salaryStr,
          enrichedSalaryMin: e.salary?.min ?? null,
          enrichedSalaryMax: e.salary?.max ?? null,
          enrichedSeniority: e.seniority || null,
        })
      }

      // Add unscored jobs from the batch
      for (let j = 0; j < batch.length; j++) {
        if (!seen.has(j)) {
          results.push({
            ...batch[j],
            matchScore: null,
            matchAnalysis: null,
            enrichedLocation: null,
            enrichedIsRemote: null,
            enrichedSalary: null,
            enrichedSalaryMin: null,
            enrichedSalaryMax: null,
            enrichedSeniority: null,
          })
        }
      }
    } catch {
      for (const job of batch) {
        results.push({
          ...job,
          matchScore: null,
          matchAnalysis: null,
          enrichedLocation: null,
          enrichedIsRemote: null,
          enrichedSalary: null,
          enrichedSalaryMin: null,
          enrichedSalaryMax: null,
          enrichedSeniority: null,
        })
      }
    }
  }

  return results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
}

// ---------------------------------------------------------------------------
// Preference-based hard filtering
// ---------------------------------------------------------------------------

interface Preferences {
  remotePreference?: string
  locations?: string[]
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
}

function filterByPreferences(
  enrichedJobs: EnrichedJob[],
  prefs: Preferences
): EnrichedJob[] {
  return enrichedJobs.filter((job) => {
    const isRemote = job.enrichedIsRemote ?? job.remote

    // Remote preference
    if (prefs.remotePreference === 'remote_only' && !isRemote) {
      return false
    }
    if (prefs.remotePreference === 'onsite' && isRemote) {
      return false
    }

    // Location filter — if user specified locations, the job must either
    // be in one of those locations OR be remote
    if (prefs.locations?.length) {
      const jobLoc = (job.enrichedLocation || job.location || '').toLowerCase()
      const matchesAny = prefs.locations.some((pref) => {
        const p = pref.toLowerCase().trim()
        return jobLoc.includes(p) || p.includes(jobLoc)
      })
      if (!matchesAny && !isRemote) {
        return false
      }
    }

    // Salary floor — drop jobs whose max is clearly below the candidate's min
    // Allow 20% tolerance and skip if salary is unknown
    if (prefs.salaryMin && job.enrichedSalaryMax) {
      if (job.enrichedSalaryMax < prefs.salaryMin * 0.8) {
        return false
      }
    }

    // Drop anything the AI scored below 20 (clearly irrelevant)
    if (job.matchScore !== null && job.matchScore < 20) {
      return false
    }

    return true
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      return JSON.parse(match[1])
    }
    throw new Error('Failed to parse AI response as JSON')
  }
}

export default router
