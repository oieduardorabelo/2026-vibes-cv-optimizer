import { H3 } from 'h3'
import { toNodeHandler } from 'h3/node'
import { listen } from 'listhen'
import pipelinesRouter from './routes/pipelines.js'
import branchesRouter from './routes/branches.js'
import supplementaryContentsRouter from './routes/supplementary-contents.js'
import analyzeRouter from './routes/analyze.js'

const app = new H3()
app.use(pipelinesRouter)
app.use(branchesRouter)
app.use(supplementaryContentsRouter)
app.use(analyzeRouter)

listen(toNodeHandler(app), { port: 3001 })
