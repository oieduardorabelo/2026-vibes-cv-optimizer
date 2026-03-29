import {
  createRouter,
  defineEventHandler,
  getRouterParam,
  createError,
} from 'h3'
import { generateText } from 'ai'
import { db } from '../db/index.js'
import { branches, pipelines, supplementaryContents } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { model } from '../ai/provider.js'
import {
  MATRIX_ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
  buildOptimizationSystemPrompt,
  buildOptimizationUserPrompt,
  buildCoverLetterSystemPrompt,
  buildCoverLetterUserPrompt,
} from '../ai/prompts.js'

async function fetchBranchContext(branchId: string) {
  const branchResult = await db
    .select()
    .from(branches)
    .where(eq(branches.id, branchId))
  if (!branchResult.length) {
    throw createError({ statusCode: 404, statusMessage: 'Branch not found' })
  }
  const branch = branchResult[0]

  if (!branch.jobDescription) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Branch has no job description',
    })
  }

  const pipelineResult = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.id, branch.pipelineId))
  if (!pipelineResult.length) {
    throw createError({ statusCode: 404, statusMessage: 'Pipeline not found' })
  }
  const pipeline = pipelineResult[0]

  if (!pipeline.cvContent) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pipeline has no CV content',
    })
  }

  const scResults = await db
    .select()
    .from(supplementaryContents)
    .where(eq(supplementaryContents.pipelineId, pipeline.id))

  return {
    branch,
    pipeline,
    scList: scResults.map((sc) => ({ title: sc.title, content: sc.content })),
  }
}

const router = createRouter()

router.post(
  '/api/branches/:id/analyze',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const { branch, pipeline, scList } = await fetchBranchContext(id)

    const { text } = await generateText({
      model,
      system: MATRIX_ANALYSIS_SYSTEM_PROMPT,
      prompt: buildAnalysisUserPrompt(
        pipeline.cvContent,
        scList,
        branch.jobDescription
      ),
    })

    const now = new Date()
    const updated = await db
      .update(branches)
      .set({ matrixResult: text, updatedAt: now })
      .where(eq(branches.id, id))
      .returning()

    return updated[0]
  })
)

router.post(
  '/api/branches/:id/optimize',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const { branch, pipeline, scList } = await fetchBranchContext(id)

    if (!branch.matrixResult) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Run matrix analysis first',
      })
    }

    const systemPrompt = buildOptimizationSystemPrompt(branch.matrixResult)

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: buildOptimizationUserPrompt(
        pipeline.cvContent,
        scList,
        branch.jobDescription,
        branch.matrixResult
      ),
    })

    const now = new Date()
    const updated = await db
      .update(branches)
      .set({ optimizedCv: text, updatedAt: now })
      .where(eq(branches.id, id))
      .returning()

    return updated[0]
  })
)

router.post(
  '/api/branches/:id/cover-letter',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const { branch } = await fetchBranchContext(id)

    if (!branch.matrixResult) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Run matrix analysis first',
      })
    }

    const systemPrompt = buildCoverLetterSystemPrompt(branch.matrixResult)

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: buildCoverLetterUserPrompt(
        branch.jobDescription,
        branch.matrixResult
      ),
    })

    const now = new Date()
    const updated = await db
      .update(branches)
      .set({ coverLetter: text, updatedAt: now })
      .where(eq(branches.id, id))
      .returning()

    return updated[0]
  })
)

router.post(
  '/api/branches/:id/run-pipeline',
  defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!
    const { branch, pipeline, scList } = await fetchBranchContext(id)

    // Step 1: Matrix Analysis
    const { text: matrixResult } = await generateText({
      model,
      system: MATRIX_ANALYSIS_SYSTEM_PROMPT,
      prompt: buildAnalysisUserPrompt(
        pipeline.cvContent,
        scList,
        branch.jobDescription
      ),
    })

    const now = new Date()
    await db
      .update(branches)
      .set({ matrixResult, updatedAt: now })
      .where(eq(branches.id, id))

    // Steps 2 & 3: Optimize CV + Cover Letter in parallel
    const [optimizeResult, coverLetterResult] = await Promise.all([
      generateText({
        model,
        system: buildOptimizationSystemPrompt(matrixResult),
        prompt: buildOptimizationUserPrompt(
          pipeline.cvContent,
          scList,
          branch.jobDescription,
          matrixResult
        ),
      }),
      generateText({
        model,
        system: buildCoverLetterSystemPrompt(matrixResult),
        prompt: buildCoverLetterUserPrompt(
          branch.jobDescription,
          matrixResult
        ),
      }),
    ])

    const finalNow = new Date()
    const updated = await db
      .update(branches)
      .set({
        optimizedCv: optimizeResult.text,
        coverLetter: coverLetterResult.text,
        updatedAt: finalNow,
      })
      .where(eq(branches.id, id))
      .returning()

    return updated[0]
  })
)

export default router
