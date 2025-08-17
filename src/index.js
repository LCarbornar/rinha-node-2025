// src/api.js
import Fastify from "fastify"
import PaymentRoutes from "./routes/payment-routes.js"
import StartWorker from "./worker/worker_start.js"

const fastify = Fastify({
  logger: false,
  ignoreTrailingSlash: true,
  disableRequestLogging: true,
  bodyLimit: 1048576,
  maxParamLength: 100,
  keepAliveTimeout: 15000,
  requestTimeout: 5000,
  connectionTimeout: 5000,
  pluginTimeout: 5000
})

fastify.register(PaymentRoutes)

const Start = async () => {

  try {
    // Inicialização condicional do worker para permitir separar API/Worker
    if (process.env.START_WORKER !== 'false') {
      await StartWorker()
    }

    fastify.listen({ 
      port: process.env.PORT || 5051,
      host: "0.0.0.0",
    })

    console.log(`[API] Server is running on port ${process.env.PORT || 5051}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }

}

Start()
