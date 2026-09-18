const PUSHCUT_NOTIFICATION_URL = process.env.PUSHCUT_NOTIFICATION_URL || 'https://api.pushcut.io/pdfjGyRIoVnWbtlk9lcMv/notifications/Cliente%20leil%C3%A3o';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Metodo nao permitido.' });
    }

    try {
        const {
            customer_name,
            customer_email,
            customer_cpf,
            customer_phone,
            product_name,
            product_id,
            address,
            number,
            complement,
            neighborhood,
            city,
            state,
            cep,
        } = req.body || {};

        if (!customer_name || !product_id) {
            return res.status(400).json({ success: false, error: 'Cliente e produto sao obrigatorios.' });
        }

        const shippingAddress = [address, number, complement, neighborhood, city, state, cep]
            .filter(Boolean)
            .join(', ');

        const response = await fetch(PUSHCUT_NOTIFICATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Novo cliente no checkout',
                text: [
                    `Cliente: ${customer_name}`,
                    `Produto: ${product_name || product_id}`,
                    `E-mail: ${customer_email || '-'}`,
                    `Telefone: ${customer_phone || '-'}`,
                    `CPF: ${customer_cpf || '-'}`,
                    `Endereco: ${shippingAddress || '-'}`,
                ].join('\n'),
                input: {
                    customer_name,
                    customer_email,
                    customer_cpf,
                    customer_phone,
                    product_name: product_name || product_id,
                    product_id,
                    address,
                    number,
                    complement,
                    neighborhood,
                    city,
                    state,
                    cep,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Pushcut error:', response.status, errorText);
            return res.status(502).json({ success: false, error: 'Pushcut recusou a notificacao.' });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('Pushcut request error:', error);
        return res.status(502).json({ success: false, error: 'Falha ao enviar a notificacao.' });
    }
};
