import {
  createRouter,
  defineEventHandler,
  readBody,
  getRouterParam,
  createError,
} from 'h3'
import { db } from '../db/index.js'
import { supplementaryContents, pipelines } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

const router = createRouter()

router.get(
  '/api/pipelines/:id/supplementary-contents',
  defineEventHandler(async (event) => {
    const pipelineId = getRouterParam(event, 'id')!
    return db
      .select()
      .from(supplementaryContents)
      .where(eq(supplementaryContents.pipelineId, pipelineId))
      .orderBy(supplementaryContents.createdAt)
  })
)

router.post(
  '/api/pipelines/:id/supplementary-contents',
  defineEventHandler(async (event) => {
    const pipelineId = getRouterParam(event, 'id')!
    const body = (await readBody(event)) as Record<string, string>

    const pipeline = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, pipelineId))
    if (!pipeline.length) {
      throw createError({ statusCode: 404, statusMessage: 'Pipeline not found' })
    }

    const now = new Date()
    const item = {
      id: nanoid(),
      pipelineId,
      title: body.title || 'Untitled',
      content: body.content || '',
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(supplementaryContents).values(item)
    return item
  })
)

router.get(
  '/api/supplementary-contents/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const result = await db
      .select()
      .from(supplementaryContents)
      .where(eq(supplementaryContents.id, id))
    if (!result.length) {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
    return result[0]
  })
)

router.put(
  '/api/supplementary-contents/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const body = (await readBody(event)) as Record<string, string>
    const now = new Date()
    const result = await db
      .update(supplementaryContents)
      .set({
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        updatedAt: now,
      })
      .where(eq(supplementaryContents.id, id))
      .returning()
    if (!result.length) {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
    return result[0]
  })
)

router.delete(
  '/api/supplementary-contents/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    await db
      .delete(supplementaryContents)
      .where(eq(supplementaryContents.id, id))
    return { ok: true }
  })
)

export default router
