import {
  createRouter,
  defineEventHandler,
  readBody,
  getRouterParam,
  createError,
} from 'h3'
import { generateText } from 'ai'
import { db } from '../db/index.js'
import { profiles } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { model } from '../ai/provider.js'
import { CV_PARSER_SYSTEM_PROMPT, buildCvParserUserPrompt } from '../ai/prompts.js'

const router = createRouter()

router.get(
  '/api/profiles',
  defineEventHandler(async () => {
    return db.select().from(profiles).orderBy(profiles.createdAt)
  })
)

router.post(
  '/api/profiles',
  defineEventHandler(async (event) => {
    const body = (await readBody(event)) as Record<string, string>
    const now = new Date()
    const profile = {
      id: nanoid(),
      name: body.name || 'My Profile',
      cvContent: body.cvContent || '',
      parsedProfile: null,
      preferences: null,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(profiles).values(profile)
    return profile
  })
)

router.get(
  '/api/profiles/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const result = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
    if (!result.length) {
      throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
    }
    return result[0]
  })
)

router.put(
  '/api/profiles/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const body = (await readBody(event)) as Record<string, string>
    const now = new Date()
    const result = await db
      .update(profiles)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.cvContent !== undefined && { cvContent: body.cvContent }),
        ...(body.preferences !== undefined && { preferences: body.preferences }),
        updatedAt: now,
      })
      .where(eq(profiles.id, id))
      .returning()
    if (!result.length) {
      throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
    }
    return result[0]
  })
)

router.delete(
  '/api/profiles/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    await db.delete(profiles).where(eq(profiles.id, id))
    return { ok: true }
  })
)

router.post(
  '/api/profiles/:id/parse-cv',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const result = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
    if (!result.length) {
      throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
    }
    const profile = result[0]

    if (!profile.cvContent) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Profile has no CV content',
      })
    }

    const { text } = await generateText({
      model,
      system: CV_PARSER_SYSTEM_PROMPT,
      prompt: buildCvParserUserPrompt(profile.cvContent),
    })

    const parsed = extractJson(text)

    const now = new Date()
    const updated = await db
      .update(profiles)
      .set({ parsedProfile: JSON.stringify(parsed), updatedAt: now })
      .where(eq(profiles.id, id))
      .returning()

    return updated[0]
  })
)

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    // Try extracting from markdown code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      return JSON.parse(match[1])
    }
    throw new Error('Failed to parse AI response as JSON')
  }
}

export default router
