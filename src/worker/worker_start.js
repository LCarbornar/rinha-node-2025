// src/worker.js
import { Worker } from "bullmq"
import { connection as redisConnection } from "../services/redis_client.js"
import processor from "./worker.js"

const StartWorker = async () => {

  const concurrency = Number(process.env.WORKER_CONCURRENCY || 120)
  const worker = new Worker(process.env.PAYMENT_QUEUE_NAME || "payments", processor, {
    connection: redisConnection,
    concurrency,
  })

  console.log("Worker is listening for jobs...")

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} has completed!`)
  })

  worker.on("failed", (job, err) => {
    console.log(`Job ${job.id} has failed with ${err.message}`)
  })
}
export default StartWorker

// Permite executar este arquivo diretamente: `node src/worker/worker_start.js`
// sem iniciar o worker quando importado pela API.
try {
  const isDirectRun = import.meta && import.meta.url && (import.meta.url === `file://${process.argv[1]}`)
  if (isDirectRun) {
    StartWorker().catch((err) => {
      console.error("Failed to start worker:", err)
      process.exit(1)
    })
  }
} catch (_) {
  // fallback noop para ambientes sem import.meta
}
