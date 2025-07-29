// src/worker.js
import { Worker } from "bullmq"
import { connection as redisConnection } from "../services/redis_client.js"
import processor from "./worker.js"

const StartWorker = () => {

  const worker = new Worker(process.env.PAYMENT_QUEUE_NAME || "payments", processor, {
    connection: redisConnection,
    concurrency: 10, // Processa até 10 jobs concorrentemente
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
