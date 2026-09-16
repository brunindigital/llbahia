// Cliente HTTP para a AllowPay. A api_key vem de env var (Vercel) e nunca chega ao navegador.

function getConfig() {
    const ALLOWPAY_BASE_URL = process.env.ALLOWPAY_BASE_URL || 'https://allow-gi0i.onrender.com';
    const ALLOWPAY_API_KEY = process.env.ALLOWPAY_API_KEY;

    if (!ALLOWPAY_API_KEY) {
        throw new Error('ALLOWPAY_API_KEY não configurada nas variáveis de ambiente.');
    }

    return { ALLOWPAY_BASE_URL, ALLOWPAY_API_KEY };
}

async function createPix({ amountCents, description, customer, webhookUrl, webhookSecret }) {
    const { ALLOWPAY_BASE_URL, ALLOWPAY_API_KEY } = getConfig();

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error || `AllowPay create-pix falhou (${response.status})`);
        error.status = response.status;
        throw error;
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
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error || `AllowPay payment-status falhou (${response.status})`);
        error.status = response.status;
        throw error;
    }

    return data; // { status, source }
}

module.exports = { createPix, getPaymentStatus };
