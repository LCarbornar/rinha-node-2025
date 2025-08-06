// src/api/routes/payments.js
import { client as redis } from "../services/redis_client.js"
import { PaymentQueue } from "../queue.js"

// Schema para validação do corpo da requisição POST /payments
const paymentBodySchema = {
  type: "object",
  required: ["correlationId", "amount"],
  properties: {
    correlationId: { type: "string", format: "uuid" },
    amount: { type: "number", minimum: 0.01 },
  },
}

async function PaymentRoutes(fastify, options) {
  fastify.post(
    "/payments",
    { schema: { body: paymentBodySchema } },
    async (request, reply) => {
      
      const paymentData = request.body
      await PaymentQueue.add("processPayment", { ...paymentData })
      reply.status(202).send()
    
    }
  )

  fastify.get("/payments-summary", async (request, reply) => {
    
    const { from, to } = request.query
    const minTimestamp = from ? new Date(from).getTime() : "-inf"
    const maxTimestamp = to ? new Date(to).getTime() : "+inf"

    const summary = {
      default: { totalRequests: 0, totalAmount: 0 },
      fallback: { totalRequests: 0, totalAmount: 0 },
    }

    // Otimização: Usar pipeline para operações Redis
    const pipeline = redis.pipeline()
    pipeline.zrangebyscore(
      process.env.PROCESSED_PAYMENTS_DEFAULT_KEY,
      minTimestamp,
      maxTimestamp
    )
    pipeline.zrangebyscore(
      process.env.PROCESSED_PAYMENTS_FALLBACK_KEY,
      minTimestamp,
      maxTimestamp
    )
    
    const results = await pipeline.exec()
    const defaultPayments = results[0][1]
    const fallbackPayments = results[1][1]

    summary.default.totalRequests = defaultPayments.length
    summary.default.totalAmount = defaultPayments.reduce(
      (sum, item) => sum + parseFloat(item.split(":")[1]),
      0
    )

    summary.fallback.totalRequests = fallbackPayments.length
    summary.fallback.totalAmount = fallbackPayments.reduce(
      (sum, item) => sum + parseFloat(item.split(":")[1]),
      0
    )

    summary.default.totalAmount = parseFloat(
      summary.default.totalAmount.toFixed(2)
    )
    summary.fallback.totalAmount = parseFloat(
      summary.fallback.totalAmount.toFixed(2)
    )

    reply.status(200).send(summary)
  
  })

  fastify.post('/purge-payments', async (request, reply) => {

    fastify.log.warn('Purging all payments...')

    await PaymentQueue.obliterate({ force: true })
    await redis.flushall()
    reply.status(200).send({ message: "Payments purged successfully" })

  })

}

export default PaymentRoutes