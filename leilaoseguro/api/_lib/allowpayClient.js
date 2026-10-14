// Cliente HTTP para a AllowPay. A api_key vem de env var (Vercel) e nunca chega ao navegador.

function getConfig() {
    const ALLOWPAY_BASE_URL = (process.env.ALLOWPAY_BASE_URL || 'https://allow-gi0i.onrender.com').replace(/\/+$/, '');
    const ALLOWPAY_API_KEY = process.env.ALLOWPAY_API_KEY;

    if (!ALLOWPAY_API_KEY) {
        throw new Error('ALLOWPAY_API_KEY não configurada nas variáveis de ambiente.');
    }

    return { ALLOWPAY_BASE_URL, ALLOWPAY_API_KEY };
}

const PAYMENT_STATUSES = new Set(['waiting_payment', 'approved', 'expired', 'declined', 'canceled', 'refunded', 'chargeback']);

function invalidResponse(message) {
    const error = new Error(message);
    error.status = 502;
    return error;
}

async function readResponse(response) {
    let data;
    try {
        data = await response.json();
    } catch {
        throw invalidResponse(`AllowPay retornou JSON inválido (${response.status}).`);
    }
    if (!response.ok) {
        const error = new Error(`AllowPay falhou (${response.status}).`);
        error.status = response.status;
        throw error;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw invalidResponse('Resposta inválida da AllowPay.');
    }
    return data;
}

async function createPix({ amountCents, description, customer, origin, webhookUrl, webhookSecret }) {
    const { ALLOWPAY_BASE_URL, ALLOWPAY_API_KEY } = getConfig();
    const configuredOrigin = process.env.ALLOWPAY_ORIGIN || process.env.PUBLIC_URL || origin;
    if (!configuredOrigin) throw new Error('Origem da integração AllowPay não configurada.');
    const originUrl = new URL(configuredOrigin);
    if (!['https:', 'http:'].includes(originUrl.protocol) || originUrl.username || originUrl.password) {
        throw new Error('Origem da integração AllowPay inválida.');
    }
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        throw new Error('Valor do PIX inválido.');
    }

    const body = {
        api_key: ALLOWPAY_API_KEY,
        amount: amountCents,
        description,
        customer,
        // "route" propositalmente omitido: deixa a AllowPay escolher/fazer fallback de adquirente.
    };

    if (webhookUrl) {
        body.webhook_url = webhookUrl;
        if (webhookSecret) body.webhook_secret = webhookSecret;
    }

    const response = await fetch(`${ALLOWPAY_BASE_URL}/api/v2/allowpay-seller/create-pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AllowPay-Origin': originUrl.origin },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
    });

    const data = await readResponse(response);
    if (!['route', 'txid', 'pix_code', 'pix_qr_code'].every((key) => typeof data[key] === 'string' && data[key].trim())) {
        throw invalidResponse('Resposta de criação do PIX incompleta.');
    }
    if (!URL.canParse(data.pix_qr_code)) throw invalidResponse('URL do QR Code inválida.');
    const qrUrl = new URL(data.pix_qr_code);
    if (qrUrl.protocol !== 'https:' || qrUrl.username || qrUrl.password) {
        throw invalidResponse('URL do QR Code inválida.');
    }
    return data; // { route, txid, pix_code, pix_qr_code }
}

async function getPaymentStatus({ txid, route }) {
    const { ALLOWPAY_BASE_URL, ALLOWPAY_API_KEY } = getConfig();

    const url = `${ALLOWPAY_BASE_URL}/api/v2/allowpay-seller/payment-status/${encodeURIComponent(txid)}?route=${encodeURIComponent(route)}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: ALLOWPAY_API_KEY }),
        signal: AbortSignal.timeout(15000),
    });

    const data = await readResponse(response);
    if (!PAYMENT_STATUSES.has(data.status)) {
        throw invalidResponse('Status de pagamento desconhecido.');
    }

    return data; // { status, source }
}

module.exports = { createPix, getPaymentStatus };
