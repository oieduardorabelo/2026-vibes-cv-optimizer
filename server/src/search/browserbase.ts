import Browserbase from '@browserbasehq/sdk'
import { chromium } from 'playwright-core'
import { generateText } from 'ai'
import { model } from '../ai/provider.js'
import {
  JOB_EXTRACTION_SYSTEM_PROMPT,
  buildJobExtractionUserPrompt,
} from '../ai/prompts.js'
import type { JobListing } from './providers.js'

interface PageContent {
  url: string
  source: string
  text: string
  links: Array<{ text: string; href: string }>
}

async function extractPageContent(
  page: Awaited<
    ReturnType<
      Awaited<ReturnType<typeof chromium.connectOverCDP>>['newPage']
    >
  > extends infer P
    ? P
    : never,
  url: string,
  source: string
): Promise<PageContent | null> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    // Wait for JS rendering
    await page.waitForTimeout(3000)

    const data = await page.evaluate(() => {
      const main =
        document.querySelector('main') ||
        document.querySelector('[role="main"]') ||
        document.body
      const text = (main.innerText || '').slice(0, 15000)
      const links = Array.from(main.querySelectorAll('a[href]'))
        .map((a) => ({
          text: (a.textContent || '').trim().slice(0, 100),
          href: (a as HTMLAnchorElement).href,
        }))
        .filter((l) => l.text.length > 3 && l.href.startsWith('http'))
        .slice(0, 100)
      return { text, links }
    })

    return { url, source, ...data }
  } catch (err) {
    console.error(`Failed to load ${url}:`, err)
    return null
  }
}

function buildSeekUrl(query: string, domain: string, city: string): string {
  const slug = query.toLowerCase().replace(/\s+/g, '-')
  const loc = city ? `/in-All-${city.replace(/\s+/g, '-')}` : ''
  return `https://www.seek.${domain}/${slug}-jobs${loc}`
}

function buildIndeedUrl(query: string, city: string): string {
  const params = new URLSearchParams({ q: query })
  if (city) params.set('l', city)
  return `https://nz.indeed.com/jobs?${params}`
}

function buildLinkedInUrl(query: string, city: string): string {
  const location = city ? `${city}, New Zealand` : 'New Zealand'
  const params = new URLSearchParams({
    keywords: query,
    location,
  })
  return `https://www.linkedin.com/jobs/search/?${params}`
}

async function parseJobsWithAI(
  pages: PageContent[]
): Promise<JobListing[]> {
  console.log(`[ai-extract] parsing ${pages.length} pages in parallel...`)

  const results = await Promise.all(
    pages.map(async (pg, i) => {
      const label = `[ai-extract] [${i + 1}/${pages.length}] ${pg.source}`
      console.log(`${label}: starting (${pg.links.length} links)...`)
      try {
        const { text } = await generateText({
          model,
          system: JOB_EXTRACTION_SYSTEM_PROMPT,
          prompt: buildJobExtractionUserPrompt(
            pg.text,
            pg.links,
            pg.source,
            pg.url
          ),
        })

        const parsed = extractJson(text) as Array<{
          title: string
          company: string
          location: string
          salary: string
          url: string
          remote: boolean
        }>

        console.log(`${label}: ${parsed.length} jobs extracted`)

        return parsed.map((job) => ({
          title: job.title || '',
          company: job.company || '',
          location: job.location || '',
          url: job.url || '',
          source: pg.source,
          description: '',
          salary: job.salary || '',
          remote: job.remote || false,
        }))
      } catch (err) {
        console.error(`${label}: FAILED`, err)
        return []
      }
    })
  )

  return results.flat()
}

const DELAY_BETWEEN_PAGES_MS = 2000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface BrowserbaseSearchOptions {
  queries: string[]
  city: string
}

export async function searchWithBrowserbase(
  options: BrowserbaseSearchOptions
): Promise<JobListing[]> {
  const apiKey = process.env.BROWSERBASE_API_KEY
  const projectId = process.env.BROWSERBASE_PROJECT_ID
  if (!apiKey || !projectId) return []

  const bb = new Browserbase({ apiKey })
  const { queries, city } = options

  const roleQueries = queries.filter((q) => q.split(/\s+/).length <= 4)
  const totalPages = roleQueries.length + queries.length + roleQueries.length // Seek + Indeed + LinkedIn
  let loaded = 0

  let browser
  try {
    console.log(`[browserbase] creating session...`)
    const session = await bb.sessions.create({ projectId })
    browser = await chromium.connectOverCDP(session.connectUrl)
    const context = browser.contexts()[0]

    const pages: PageContent[] = []

    console.log(`[browserbase] plan: ${roleQueries.length} role queries → Seek + LinkedIn, ${queries.length} queries → Indeed (${totalPages} pages total, NZ only)`)

    const page = await context.newPage()

    // Seek NZ — role-title queries only
    for (const query of roleQueries) {
      const seekUrl = buildSeekUrl(query, 'co.nz', city)
      loaded++
      console.log(`[browserbase] [${loaded}/${totalPages}] Seek: "${query}" → ${seekUrl}`)
      const result = await extractPageContent(page, seekUrl, 'Seek')
      console.log(`[browserbase] [${loaded}/${totalPages}] Seek: ${result ? `${result.links.length} links, ${result.text.length} chars` : 'FAILED'}`)
      if (result) pages.push(result)
      await sleep(DELAY_BETWEEN_PAGES_MS)
    }

    // Indeed NZ — all queries
    for (const query of queries) {
      const indeedUrl = buildIndeedUrl(query, city)
      loaded++
      console.log(`[browserbase] [${loaded}/${totalPages}] Indeed: "${query}" → ${indeedUrl}`)
      const result = await extractPageContent(page, indeedUrl, 'Indeed')
      console.log(`[browserbase] [${loaded}/${totalPages}] Indeed: ${result ? `${result.links.length} links, ${result.text.length} chars` : 'FAILED'}`)
      if (result) pages.push(result)
      await sleep(DELAY_BETWEEN_PAGES_MS)
    }

    // LinkedIn NZ — role-title queries only
    for (const query of roleQueries) {
      const linkedInUrl = buildLinkedInUrl(query, city)
      loaded++
      console.log(`[browserbase] [${loaded}/${totalPages}] LinkedIn: "${query}" → ${linkedInUrl}`)
      const result = await extractPageContent(page, linkedInUrl, 'LinkedIn')
      console.log(`[browserbase] [${loaded}/${totalPages}] LinkedIn: ${result ? `${result.links.length} links, ${result.text.length} chars` : 'FAILED'}`)
      if (result) pages.push(result)
      await sleep(DELAY_BETWEEN_PAGES_MS)
    }

    await page.close()

    console.log(`[browserbase] scraping done: ${pages.length}/${totalPages} pages succeeded, extracting jobs with AI...`)
    const jobs = await parseJobsWithAI(pages)
    console.log(`[browserbase] extraction done: ${jobs.length} jobs extracted`)
    return jobs
  } catch (err) {
    console.error('Browserbase search failed:', err)
    return []
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch {}
    }
  }
}

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
