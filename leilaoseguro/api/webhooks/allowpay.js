const crypto = require('crypto');

// Desliga o parser automático da Vercel para conseguirmos o corpo cru e validar o HMAC.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const rawBody = await readRawBody(req);
    const secret = process.env.ALLOWPAY_WEBHOOK_SECRET;

    if (secret) {
        const signature = req.headers['x-allowpay-signature'] || '';
        const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

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

    // Sem banco de dados nesta função: aqui é o lugar para plugar seu envio de e-mail,
    // atualização de planilha/CRM, etc. usando payload.txid / payload.status / payload.event_id.
    console.log('AllowPay webhook recebido:', payload.event, payload.txid, payload.status);

    res.status(200).json({ ok: true });
};
