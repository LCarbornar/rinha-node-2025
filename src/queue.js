import { Queue } from "bullmq"
import { connection } from './services/redis_client.js'

export const PaymentQueue = new Queue(process.env.PAYMENT_QUEUE_NAME || "payments", {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 500,
      },
      removeOnComplete: true,
      removeOnFail: true,
      // Timeout reduzido
      timeout: 10000,
      delay: 0,
    }
})