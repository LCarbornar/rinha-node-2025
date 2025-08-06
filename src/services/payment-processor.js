import { request } from 'undici'

const default_processor = process.env.DEFAULT_PROCESSOR_URL
const fallback_processor = process.env.FALLBACK_PROCESSOR_URL

const REQUEST_TIMEOUT = 10_000 // 10 seconds timeout

async function ProcessWithDefault(payment_item) {
    if (!default_processor) {
        throw new Error(`No Default processor URL found`)
    }

    const { statusCode, body } = await request(`${default_processor}/payments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Connection": "keep-alive",
        },
        body: JSON.stringify(payment_item),
        bodyTimeout: REQUEST_TIMEOUT,
        headersTimeout: REQUEST_TIMEOUT
    })

    const responseData = await body.json()
    return {
        status: statusCode,
        data: responseData
    }
}

async function ProcessWithFallback(payment_item) {
    if (!fallback_processor) {
        throw new Error(`No fallback processor URL found`)
    }

    const { statusCode, body } = await request(`${fallback_processor}/payments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Connection": "keep-alive",
        },
        body: JSON.stringify(payment_item),
        bodyTimeout: REQUEST_TIMEOUT,
        headersTimeout: REQUEST_TIMEOUT
    })

    const responseData = await body.json()
    return {
        status: statusCode,
        data: responseData
    }
}

async function ProcessPayment(payment_item, type) {
    try {
        if (type === "default") {
            return await ProcessWithDefault(payment_item)
        } else {
            return await ProcessWithFallback(payment_item)
        }
    } catch (error) {
        console.error(`Payment processing failed: ${error.message}`)
        throw error
    }
}

async function ProcessorHealthCheck(type = "default") {
    const url = type === "default"
        ? default_processor
        : fallback_processor

    try {
        const { statusCode, body } = await request(`${url}/payments/service-health`, {
            method: "GET",
            bodyTimeout: REQUEST_TIMEOUT,
            headersTimeout: REQUEST_TIMEOUT
        })

        if (statusCode !== 200) {
            console.error(`Health check failed for ${type} processor with status ${statusCode}`)
            return { failing: true, minResponseTime: 0 }
        }

        return await body.json()
    } catch (error) {
        console.error(`Health check error for ${type} processor: ${error.message}`)
        return { failing: true, minResponseTime: 0 }
    }
}

export { ProcessPayment, ProcessorHealthCheck }