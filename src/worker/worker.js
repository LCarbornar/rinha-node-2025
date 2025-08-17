import { client as redis } from "../services/redis_client.js"
import * as Processor from '../services/payment-processor.js'

export default async function processor (job) {
  // Logs reduzidos para não bloquear o event loop sob alta concorrência

  const payment = job.data
  const transaction_timestamp = new Date()
  payment.requestedAt = transaction_timestamp.toISOString()
  
  

  let processed_by = null

  try {

    const health = await ProcessorsHealthCheck()

    const defaultUp = health.default.status === 'UP'
    const fallbackUp = health.fallback.status === 'UP'

    // Política: preferir sempre default quando UP; fallback só se default falhar
    // Se o health-check não conseguir determinar (ambos DOWN), ainda assim tentamos default e depois fallback
    const tryOrder = (() => {
      if (defaultUp && fallbackUp) return ["default", "fallback"]
      if (defaultUp) return ["default"]
      if (fallbackUp) return ["fallback"]
      return ["default", "fallback"]
    })()

    for (const type of tryOrder) {
      try {
        const result = await Processor.ProcessPayment(payment, type)
        if (result.status === 200 || result.status === 201) {
          processed_by = type
          break
        }
      } catch (error) {
        console.error(`[Worker] ${type} processor failed. Error: ${error.message}.`)
      }
    }

    if (processed_by == null) {
      throw new Error("All processors attempts failed")
    }

    const key = processed_by === "default"
      ? process.env.PROCESSED_PAYMENTS_DEFAULT_KEY
      : process.env.PROCESSED_PAYMENTS_FALLBACK_KEY

    await redis.zadd(
      key,
      transaction_timestamp.getTime(),
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
  const now = Date.now()

  async function refreshIfNeeded(type) {
    const statusKey = type === 'default'
      ? (process.env.DEFAULT_HEALTH_CHECK_KEY || 'HEALTH:DEFAULT:STATUS')
      : (process.env.FALLBACK_HEALTH_CHECK_KEY || 'HEALTH:FALLBACK:STATUS')
    const tsKey = type === 'default'
      ? (process.env.DEFAULT_HEALTH_CHECK_TIMESTAMP_KEY || 'HEALTH:DEFAULT:TS')
      : (process.env.FALLBACK_HEALTH_CHECK_TIMESTAMP_KEY || 'HEALTH:FALLBACK:TS')
    const rtKey = `${statusKey}:minRT`
    const lockKey = `HEALTH_LOCK:${type}`

    const [status, lastTs] = await Promise.all([
      redis.get(statusKey),
      redis.get(tsKey)
    ])

    const lastCheck = parseInt(lastTs || '0')
    const isStale = !lastCheck || (now - lastCheck) > FIVE_SECONDS_IN_MS

    if (isStale) {
      const acquired = await redis.set(lockKey, String(now), 'NX', 'EX', 5)
      if (acquired) {
        const health = await Processor.ProcessorHealthCheck(type)
        const isUp = !health.failing
        await Promise.all([
          redis.set(statusKey, isUp ? 'UP' : 'DOWN', 'EX', 15),
          redis.set(tsKey, String(Date.now()), 'EX', 20),
          redis.set(rtKey, String(health.minResponseTime ?? ''), 'EX', 15)
        ])
        return { status: isUp ? 'UP' : 'DOWN', minResponseTime: health.minResponseTime }
      } else {
        // Outro worker está atualizando. Tente ler com pequeno atraso para evitar estado inconsistente
        const lockExists = await redis.get(lockKey)
        if (lockExists) {
          await new Promise(res => setTimeout(res, 200))
        }
      }
    }

    const [finalStatus, minRtStr] = await Promise.all([
      status ? Promise.resolve(status) : redis.get(statusKey),
      redis.get(rtKey)
    ])

    return {
      status: finalStatus || 'DOWN',
      minResponseTime: minRtStr ? parseInt(minRtStr) : undefined,
    }
  }

  const [defaultHealth, fallbackHealth] = await Promise.all([
    refreshIfNeeded('default'),
    refreshIfNeeded('fallback')
  ])

  return { default: defaultHealth, fallback: fallbackHealth }
}
