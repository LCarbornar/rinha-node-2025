import { Queue } from "bullmq"
import { connection } from './services/redis_client.js'

export const PaymentQueue = new Queue(process.env.PAYMENT_QUEUE_NAME || "payments", {
    connection,
    defaultJobOptions: {
      attempts: 5, // Tentar 5 vezes antes de falhar de vez
      backoff: {
        type: 'exponential',
        delay: 500, // Esperar 500ms para a primeira retentativa, depois 1s, 2s...
      },
      removeOnComplete: true, // Limpa o job da fila ao completar
      removeOnFail: true, // Limpa o job da fila ao falhar após todas as tentativas
    },
})