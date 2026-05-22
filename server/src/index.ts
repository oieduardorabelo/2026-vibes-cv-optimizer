import { H3 } from 'h3'
import { toNodeHandler } from 'h3/node'
import { listen } from 'listhen'
import profilesRouter from './routes/profiles.js'
import searchesRouter from './routes/searches.js'

const app = new H3()
app.use(profilesRouter)
app.use(searchesRouter)

listen(toNodeHandler(app), { port: 3001 })
