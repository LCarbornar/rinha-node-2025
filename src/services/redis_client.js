import Redis from "ioredis"

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null, 
}

const client = new Redis(connection)

client.on('connect', () => console.log('Redis client connected'))
client.on('error', (err) => console.error('Redis client error', err))

export { connection, client }