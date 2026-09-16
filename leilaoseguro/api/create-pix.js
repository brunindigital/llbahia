const { createPix } = require('./_lib/allowpayClient');
const { isValidCPF, onlyDigits } = require('./_lib/cpf');
const { getProductPrice } = require('./_lib/products');
const { sendOrder } = require('./_lib/utmify');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Método não permitido.' });
    }

    try {
        const { customer_name, customer_email, customer_cpf, customer_phone, product_id, action, ...trackingParameters } = req.body || {};

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

        const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
        const webhookUrl = publicUrl ? `${publicUrl}/api/webhooks/allowpay` : undefined;

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
            webhookSecret: webhookUrl ? process.env.ALLOWPAY_WEBHOOK_SECRET : undefined,
        });

        // route não é segredo: o cliente guarda junto do transaction_id para poder consultar o status depois.
        const createdAt = new Date();

        // Registra o pedido como "pendente" na Utmify antes de responder ao cliente,
        // para garantir que a função serverless não seja encerrada antes da chamada terminar.
        try {
            await sendOrder({
                orderId: result.txid,
                status: 'waiting_payment',
                createdAt,
                approvedDate: null,
                customer: { name: customer_name, email: customer_email, phone: phoneDigits, document: cpfDigits },
                product: { id: product_id, name: product.name },
                amountCents: product.amountCents,
                trackingParameters,
                ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress,
            });
        } catch (err) {
            console.error('utmify waiting_payment error:', err);
        }

        res.json({
            success: true,
            transaction_id: result.txid,
            route: result.route,
            copy_paste: result.pix_code,
            qr_code: result.pix_qr_code,
            created_at: createdAt.toISOString(),
        });
    } catch (error) {
        console.error('create-pix error:', error);
        res.status(error.status === 401 ? 401 : 500).json({ success: false, error: 'Erro ao gerar o PIX. Tente novamente.' });
    }
};
