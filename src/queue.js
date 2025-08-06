import { Queue } from "bullmq"
import { connection } from './services/redis_client.js'

export const PaymentQueue = new Queue(process.env.PAYMENT_QUEUE_NAME || "payments", {
    connection,
    defaultJobOptions: {
      attempts: 3, // Reduzido de 3 para 2
      backoff: {
        type: 'exponential',
        delay: 1000, // Aumentado para reduzir tentativas
      },
      removeOnComplete: true,
      removeOnFail: true,
      // Timeout reduzido
      timeout: 15000, // Reduzido para 15s
      delay: 0,
    }
})