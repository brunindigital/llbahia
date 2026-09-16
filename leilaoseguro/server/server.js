require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const { createPix, getPaymentStatus } = require('./src/allowpayClient');
const { isValidCPF, onlyDigits } = require('./src/cpf');
const { getProductPrice } = require('./src/products');
const store = require('./src/store');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const WEBHOOK_SECRET = process.env.ALLOWPAY_WEBHOOK_SECRET || '';

// Mapeia os status da AllowPay para o vocabulário simples que o front-end já espera.
function mapStatus(allowpayStatus) {
    if (allowpayStatus === 'approved') return 'PAID';
    if (allowpayStatus === 'waiting_payment') return 'PENDING';
    return 'EXPIRED'; // expired | declined | canceled | refunded | chargeback
}

// A rota de webhook precisa do corpo cru para validar a assinatura HMAC.
app.post('/api/webhooks/allowpay', express.raw({ type: '*/*' }), async (req, res) => {
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : '';

    if (WEBHOOK_SECRET) {
        const signature = req.get('X-AllowPay-Signature') || '';
        const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('hex');

        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

        if (!valid) {
            return res.status(401).json({ error: 'Assinatura inválida.' });
        }
    }

    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return res.status(400).json({ error: 'JSON inválido.' });
    }

    const { event_id, txid, status } = payload;

    if (event_id && (await store.wasEventProcessed(event_id))) {
        return res.status(200).json({ ok: true, duplicate: true });
    }

    if (txid && status) {
        await store.updateTransactionStatus(txid, status);
    }
    if (event_id) {
        await store.markEventProcessed(event_id);
    }

    res.status(200).json({ ok: true });
});

app.use(express.json());

app.post('/api/create-pix', async (req, res) => {
    try {
        const { customer_name, customer_email, customer_cpf, customer_phone, product_id, action, external_reference } = req.body || {};

        if (!customer_name || !customer_email || !customer_cpf || !customer_phone || !product_id) {
            return res.status(400).json({ success: false, error: 'Campos obrigatórios: nome, e-mail, CPF, telefone e produto.' });
        }

        const product = getProductPrice(product_id, action);
        if (!product) {
            return res.status(400).json({ success: false, error: 'Produto inválido.' });
        }

        const cpfDigits = onlyDigits(customer_cpf);
        if (!isValidCPF(cpfDigits)) {
            return res.status(400).json({ success: false, error: 'CPF inválido.' });
        }

        const phoneDigits = onlyDigits(customer_phone);
        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
            return res.status(400).json({ success: false, error: 'Telefone inválido.' });
        }

        const webhookUrl = PUBLIC_URL ? `${PUBLIC_URL}/api/webhooks/allowpay` : undefined;

        const result = await createPix({
            amountCents: product.amountCents, // recalculado no servidor — o valor enviado pelo cliente é ignorado
            description: product.name,
            customer: {
                name: customer_name,
                email: customer_email,
                cellphone: phoneDigits,
                taxId: cpfDigits,
            },
            webhookUrl,
            webhookSecret: webhookUrl ? WEBHOOK_SECRET : undefined,
        });

        await store.saveTransaction(result.txid, {
            route: result.route,
            status: 'waiting_payment',
            amount_cents: product.amountCents,
            product_id,
            external_reference: external_reference || null,
            created_at: new Date().toISOString(),
        });

        res.json({
            success: true,
            transaction_id: result.txid,
            copy_paste: result.pix_code,
            qr_code: result.pix_qr_code,
        });
    } catch (error) {
        console.error('create-pix error:', error);
        res.status(error.status === 401 ? 401 : 500).json({ success: false, error: 'Erro ao gerar o PIX. Tente novamente.' });
    }
});

app.get('/api/check-payment', async (req, res) => {
    try {
        const transactionId = req.query.transaction_id;
        if (!transactionId) {
            return res.status(400).json({ success: false, error: 'transaction_id é obrigatório.' });
        }

        const record = store.getTransaction(transactionId);
        if (!record) {
            return res.status(404).json({ success: false, error: 'Transação não encontrada.' });
        }

        // Se o webhook já encerrou o status, evita chamar a AllowPay de novo.
        if (record.status !== 'waiting_payment') {
            return res.json({ success: true, status: mapStatus(record.status) });
        }

        const result = await getPaymentStatus({ txid: transactionId, route: record.route });
        await store.updateTransactionStatus(transactionId, result.status);

        res.json({ success: true, status: mapStatus(result.status) });
    } catch (error) {
        console.error('check-payment error:', error);
        res.status(500).json({ success: false, error: 'Erro ao consultar o pagamento.' });
    }
});

// Serve o site estático (a raiz do projeto, um nível acima de /server).
app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    if (!PUBLIC_URL) {
        console.log('PUBLIC_URL não definida: webhook desativado, usando apenas polling de status.');
    }
});
