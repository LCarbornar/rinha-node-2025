import { client as redis } from "../services/redis_client.js"
import * as Processor from '../services/payment-processor.js'

export default async function processor (job) {

  const payment = job.data
  const transaction_timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
  payment.requestedAt = transaction_timestamp

  let processed_by = null

  try {

    await ProcessorsHealthCheck()

    try {

      const default_processor_result = await Processor.ProcessPayment(payment, "default")

      if (default_processor_result.status === 200) {
        processed_by = "default"
      }

    } catch (error) {

      await redis.set(process.env.DEFAULT_HEALTH_CHECK_KEY, "DOWN", "EX", 30)
      console.error(`[Worker] Default processor failed. Error: ${error.message}. Trying fallback.`)

    }
    

    if (processed_by == null) {

      const fallback_result = await Processor.ProcessPayment(payment, "fallback")
      if (fallback_result.status === 200) {
        processed_by = "fallback"
      } else {
        throw new Error("Fallback processor also failed")
      }

    }

    const key = processed_by === "default"
      ? process.env.PROCESSED_PAYMENTS_DEFAULT_KEY
      : process.env.PROCESSED_PAYMENTS_FALLBACK_KEY

    await redis.zadd(
      key,
      transaction_timestamp,
      `${payment.correlationId}:${payment.amount}`
    )

  } catch (error) {
    console.error(
      `[Worker] Job ${job.id} FAILED for ${payment.correlationId}. Error: ${error.message}. Will be retried.`
    )
    throw error
  }
}

async function ProcessorsHealthCheck() {

  const FIVE_SECONDS_IN_MS = 5000

  const default_last_check_time = parseInt(await redis.get(process.env.DEFAULT_HEALTH_CHECK_TIMESTAMP_KEY)) || 0
  const fallback_last_check_time = parseInt(await redis.get(process.env.FALLBACK_HEALTH_CHECK_TIMESTAMP_KEY)) || 0

  const default_status = await redis.get(process.env.DEFAULT_HEALTH_CHECK_KEY)
  const fallback_status = await redis.get(process.env.FALLBACK_HEALTH_CHECK_KEY)

  if (default_status === null || fallback_status === null) {

    let default_health = await Processor.ProcessorHealthCheck("default") 
    let fallback_health = await Processor.ProcessorHealthCheck("fallback")

    await redis.set(process.env.DEFAULT_HEALTH_CHECK_KEY, default_health.failing ? "DOWN" : "UP", "EX", 60)
    await redis.set(process.env.FALLBACK_HEALTH_CHECK_KEY, fallback_health.failing ? "DOWN" : "UP", "EX", 60)

      if (default_health.failing && fallback_health.failing) {
        // Se ambos os processadores falharem, não podemos continuar, joganado o job para a retentativa
        throw new Error("Both processors are down")
      }
      
  } else {

    const current_time = Date.now()

    if (default_status === "UP" && (current_time - default_last_check_time) > FIVE_SECONDS_IN_MS) {
      let default_health = await Processor.ProcessorHealthCheck("default")
      await redis.set(process.env.DEFAULT_HEALTH_CHECK_KEY, default_health.failing ? "DOWN" : "UP", "EX", 60)
    }

    if (fallback_status === "UP" && (current_time - fallback_last_check_time) > FIVE_SECONDS_IN_MS) {
      let fallback_health = await Processor.ProcessorHealthCheck("fallback")
      await redis.set(process.env.FALLBACK_HEALTH_CHECK_KEY, fallback_health.failing ? "DOWN" : "UP", "EX", 60)
    }

    if (default_status === "DOWN" && fallback_status === "DOWN") {
      throw new Error("Both processors are down")
    }

  }
}
