// Integração com a API de Pedidos da Utmify (https://docs.utmify.com.br).
// Usada para registrar o pedido como "pendente" ao gerar o PIX e "pago" quando confirmado.

const UTMIFY_ORDERS_URL = 'https://api.utmify.com.br/api-credentials/orders';

function formatDate(date) {
    // Formato exigido pela Utmify: "YYYY-MM-DD HH:MM:SS" em UTC 0.
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function sendOrder({
    orderId,
    status,
    createdAt,
    approvedDate,
    customer,
    product,
    amountCents,
    trackingParameters,
    ip,
}) {
    const apiToken = process.env.UTMIFY_API_TOKEN;
    if (!apiToken) {
        console.warn('utmify: UTMIFY_API_TOKEN não configurada, pulando envio.');
        return;
    }

    const body = {
        orderId,
        platform: 'CasasBahiaLeilao',
        paymentMethod: 'pix',
        status,
        createdAt: formatDate(createdAt),
        approvedDate: approvedDate ? formatDate(approvedDate) : null,
        refundedAt: null,
        customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone || null,
            document: customer.document || null,
            country: 'BR',
            ip: ip || undefined,
        },
        products: [
            {
                id: product.id,
                name: product.name,
                planId: null,
                planName: null,
                quantity: 1,
                priceInCents: amountCents,
            },
        ],
        trackingParameters: {
            src: trackingParameters?.src || null,
            sck: trackingParameters?.sck || null,
            utm_source: trackingParameters?.utm_source || null,
            utm_campaign: trackingParameters?.utm_campaign || null,
            utm_medium: trackingParameters?.utm_medium || null,
            utm_content: trackingParameters?.utm_content || null,
            utm_term: trackingParameters?.utm_term || null,
        },
        commission: {
            totalPriceInCents: amountCents,
            gatewayFeeInCents: 0,
            userCommissionInCents: amountCents,
        },
    };

    const response = await fetch(UTMIFY_ORDERS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-token': apiToken,
        },
        body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error('utmify order error:', response.status, JSON.stringify(data));
    }

    return { ok: response.ok, data };
}

module.exports = { sendOrder };
