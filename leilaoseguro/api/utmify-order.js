const { sendOrder } = require('./_lib/utmify');
const { getProductPrice } = require('./_lib/products');
const { onlyDigits } = require('./_lib/cpf');

// Chamado pelo front-end assim que o polling detecta o PIX pago, para reportar a venda à Utmify.
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Método não permitido.' });
    }

    try {
        const {
            transaction_id: orderId,
            product_id,
            action,
            customer_name,
            customer_email,
            customer_cpf,
            customer_phone,
            created_at,
            ...trackingParameters
        } = req.body || {};

        if (!orderId || !product_id || !customer_name || !customer_email) {
            return res.status(400).json({ success: false, error: 'Dados obrigatórios ausentes.' });
        }

        const product = getProductPrice(product_id, action);
        if (!product) {
            return res.status(400).json({ success: false, error: 'Produto inválido.' });
        }

        const approvedDate = new Date();
        const createdAt = created_at ? new Date(created_at) : approvedDate;

        const result = await sendOrder({
            orderId,
            status: 'paid',
            createdAt,
            approvedDate,
            customer: {
                name: customer_name,
                email: customer_email,
                phone: onlyDigits(customer_phone || ''),
                document: onlyDigits(customer_cpf || ''),
            },
            product: { id: product_id, name: product.name },
            amountCents: product.amountCents,
            trackingParameters,
            ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress,
        });

        res.json({ success: !!result?.ok });
    } catch (error) {
        console.error('utmify-order paid error:', error);
        res.status(500).json({ success: false, error: 'Erro ao reportar o pedido.' });
    }
};
