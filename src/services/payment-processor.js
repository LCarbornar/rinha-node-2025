const default_processor = process.env.DEFAULT_PROCESSOR_URL
const fallback_processor = process.env.FALLBACK_PROCESSOR_URL

async function ProcessWithDefault(payment_item) {

    if (!default_processor ) {
      throw new Error(`No Default processor URL found`)
    }

    return await fetch(`${default_processor}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
          },
        body: JSON.stringify(payment_item),
      })

}

async function ProcessWithFallback(payment_item) {

    if (!fallback_processor) {
        throw new Error(`No fallback processor URL found`)
    }

    return await fetch(`${fallback_processor}/payments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payment_item),
    })

}

async function ProcessPayment(payment_item, type) {

    if (type === "default") {
        return ProcessWithDefault(payment_item)
    } else {
        return ProcessWithFallback(payment_item)
    }

}

async function ProcessorHealthCheck(type = "default") {

    const url = type === "default"
        ? default_processor
        : fallback_processor

    const result = await fetch(`${url}/payments/service-health`, {
        method: "GET",
    })

    if (!result.ok) {
        console.error(`Health check failed for ${type} processor: ${result.statusText}`)
        return { failing: true, minResponseTime: 0 }
    }

    return await result.json()
}

export { ProcessPayment, ProcessorHealthCheck }