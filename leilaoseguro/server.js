const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- API routes (Vercel serverless functions adapted for Express) ---

// Body parsing for API routes (except webhook which needs raw body)
app.use('/api/create-pix', express.json());
app.use('/api/check-payment', express.json());
app.use('/api/utmify-order', express.json());

// Webhook needs the raw body for HMAC validation
app.use('/api/webhooks/allowpay', express.raw({ type: '*/*' }));

// Import serverless functions
const createPix = require('./api/create-pix');
const checkPayment = require('./api/check-payment');
const utmifyOrder = require('./api/utmify-order');
const allowpayWebhook = require('./api/webhooks/allowpay');

// Mount API routes
app.post('/api/create-pix', (req, res) => createPix(req, res));
app.get('/api/check-payment', (req, res) => checkPayment(req, res));
app.post('/api/utmify-order', (req, res) => utmifyOrder(req, res));
app.post('/api/webhooks/allowpay', (req, res) => allowpayWebhook(req, res));

// --- Static file serving ---
app.use(express.static(path.join(__dirname)));

// SPA-like fallback: serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
