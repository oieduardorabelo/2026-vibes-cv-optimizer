import {
  createRouter,
  defineEventHandler,
  readBody,
  getRouterParam,
  createError,
} from 'h3'
import { db } from '../db/index.js'
import { branches, pipelines } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

const router = createRouter()

router.get(
  '/api/pipelines/:id/branches',
  defineEventHandler(async (event) => {
    const pipelineId = getRouterParam(event, 'id')!
    return db
      .select()
      .from(branches)
      .where(eq(branches.pipelineId, pipelineId))
      .orderBy(branches.createdAt)
  })
)

router.post(
  '/api/pipelines/:id/branches',
  defineEventHandler(async (event) => {
    const pipelineId = getRouterParam(event, 'id')!
    const body = (await readBody(event)) as Record<string, string>

    // Verify pipeline exists
    const pipeline = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, pipelineId))
    if (!pipeline.length) {
      throw createError({ statusCode: 404, statusMessage: 'Pipeline not found' })
    }

    const now = new Date()
    const branch = {
      id: nanoid(),
      pipelineId,
      name: body.name || 'Untitled Branch',
      jobDescription: body.jobDescription || '',
      matrixResult: null,
      optimizedCv: null,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(branches).values(branch)
    return branch
  })
)

router.get(
  '/api/branches/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const result = await db.select().from(branches).where(eq(branches.id, id))
    if (!result.length) {
      throw createError({ statusCode: 404, statusMessage: 'Branch not found' })
    }
    return result[0]
  })
)

router.put(
  '/api/branches/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const body = (await readBody(event)) as Record<string, string>
    const now = new Date()
    const result = await db
      .update(branches)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.jobDescription !== undefined && {
          jobDescription: body.jobDescription,
        }),
        updatedAt: now,
      })
      .where(eq(branches.id, id))
      .returning()
    if (!result.length) {
      throw createError({ statusCode: 404, statusMessage: 'Branch not found' })
    }
    return result[0]
  })
)

router.delete(
  '/api/branches/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    await db.delete(branches).where(eq(branches.id, id))
    return { ok: true }
  })
)

export default router
