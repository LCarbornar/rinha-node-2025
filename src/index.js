// src/api.js
import Fastify from "fastify"
import PaymentRoutes from "./routes/payment-routes.js"
import StartWorker from "./worker/worker_start.js"

const fastify = Fastify({
  logger: {
    level: "info"
  },
})

fastify.register(PaymentRoutes)

const Start = async () => {

  try {

    StartWorker()

    fastify.listen({ port: process.env.PORT || 5051, host: "0.0.0.0" })
    
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }

}

Start()
