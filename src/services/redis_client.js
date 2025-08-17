import Redis from "ioredis"

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
  enableAutoPipelining: true,
}

const client = new Redis(connection)

// Log básico de diagnóstico
console.log(`[Redis] Connecting to ${connection.host}:${connection.port}`)

if (!process.env.REDIS_HOST) {
  console.warn('[Redis] REDIS_HOST not set, defaulting to localhost')
}

client.on('connect', () => console.log('Redis client connected'))
client.on('error', (err) => console.error('Redis client error', err))

export { connection, client }