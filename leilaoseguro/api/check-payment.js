const { getPaymentStatus } = require('./_lib/allowpayClient');

// Mapeia os status da AllowPay para o vocabulário simples que o front-end já espera.
function mapStatus(allowpayStatus) {
    if (allowpayStatus === 'approved') return 'PAID';
    if (allowpayStatus === 'waiting_payment') return 'PENDING';
    return 'EXPIRED'; // expired | declined | canceled | refunded | chargeback
}

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, error: 'Método não permitido.' });
    }

    try {
        const { transaction_id: txid, route } = req.query || {};

        if (![txid, route].every((value) => typeof value === 'string' && value.trim())) {
            return res.status(400).json({ success: false, error: 'transaction_id e route são obrigatórios.' });
        }

        const result = await getPaymentStatus({ txid, route });
        res.setHeader('Cache-Control', 'no-store');
        res.json({ success: true, status: mapStatus(result.status), payment_status: result.status });
    } catch (error) {
        console.error('check-payment error:', error);
        const status = [400, 401, 503, 502].includes(error.status) ? error.status : 500;
        res.status(status).json({ success: false, error: 'Erro ao consultar o pagamento.' });
    }
};
