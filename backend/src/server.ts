import { app } from './app.js'
import { connectDatabase } from './config/db.js'
import { env } from './config/env.js'

async function main() {
  await connectDatabase()
  app.listen(env.APP_PORT, () => {
    console.log(`Backend running on http://localhost:${env.APP_PORT}`)
  })
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
