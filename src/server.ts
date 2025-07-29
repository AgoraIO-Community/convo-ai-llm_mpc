import express from 'express'
import type { Application, RequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { chatCompletionRouter } from './routes/chatCompletion'
import { config } from './libs/utils'

const app: Application = express()
const port = process.env.PORT || config.port

// Middleware
app.use(helmet() as RequestHandler)
app.use(cors() as RequestHandler)
app.use(morgan('dev') as RequestHandler)
app.use(express.json() as RequestHandler)

// Routes - mount chat router for all versions
app.use('/v1/chat', chatCompletionRouter)
app.use('/v2/chat', chatCompletionRouter)
app.use('/v3/chat', chatCompletionRouter)
app.use('/v4/chat', chatCompletionRouter)

app.get('/', (req, res) => {
  res.json({
    message: `Beep-boop, you've reached a custom LLM interface built for Agora's Convo AI Engine! Check out the human freindly demo: https://agora-convo-ai-custom-llm-client.vercel.app/`,
  })
})

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ message: 'pong' })
})

// Only start the server if this file is run directly
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
  })
}

export default app
