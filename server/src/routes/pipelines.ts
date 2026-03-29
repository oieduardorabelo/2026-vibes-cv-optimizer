import {
  createRouter,
  defineEventHandler,
  readBody,
  getRouterParam,
  createError,
} from 'h3'
import { db } from '../db/index.js'
import { pipelines } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

const router = createRouter()

router.get(
  '/api/pipelines',
  defineEventHandler(async () => {
    return db.select().from(pipelines).orderBy(pipelines.createdAt)
  })
)

router.post(
  '/api/pipelines',
  defineEventHandler(async (event) => {
    const body = (await readBody(event)) as Record<string, string>
    const now = new Date()
    const pipeline = {
      id: nanoid(),
      name: body.name || 'Untitled Pipeline',
      cvContent: body.cvContent || '',
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(pipelines).values(pipeline)
    return pipeline
  })
)

router.get(
  '/api/pipelines/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const result = await db.select().from(pipelines).where(eq(pipelines.id, id))
    if (!result.length) {
      throw createError({ statusCode: 404, statusMessage: 'Pipeline not found' })
    }
    return result[0]
  })
)

router.put(
  '/api/pipelines/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const body = (await readBody(event)) as Record<string, string>
    const now = new Date()
    const result = await db
      .update(pipelines)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.cvContent !== undefined && { cvContent: body.cvContent }),
        updatedAt: now,
      })
      .where(eq(pipelines.id, id))
      .returning()
    if (!result.length) {
      throw createError({ statusCode: 404, statusMessage: 'Pipeline not found' })
    }
    return result[0]
  })
)

router.delete(
  '/api/pipelines/:id',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    await db.delete(pipelines).where(eq(pipelines.id, id))
    return { ok: true }
  })
)

export default router
