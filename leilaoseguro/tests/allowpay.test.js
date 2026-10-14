const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createPix, getPaymentStatus } = require('../api/_lib/allowpayClient');
const createHandler = require('../api/create-pix');
const checkHandler = require('../api/check-payment');
const orderHandler = require('../api/utmify-order');
const { isValidCPF } = require('../api/_lib/cpf');
const { getProductPrice } = require('../api/_lib/products');

const envNames = ['ALLOWPAY_API_KEY', 'ALLOWPAY_BASE_URL', 'ALLOWPAY_ORIGIN', 'PUBLIC_URL', 'UTMIFY_API_TOKEN'];
let previousEnv;
let previousFetch;
let previousError;

beforeEach(() => {
    previousEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
    previousFetch = global.fetch;
    previousError = console.error;
    for (const key of envNames) delete process.env[key];
    process.env.ALLOWPAY_API_KEY = 'test-key';
    process.env.ALLOWPAY_ORIGIN = 'https://store.example';
    console.error = () => {};
    global.fetch = async () => { throw new Error('Unexpected network request'); };
});

afterEach(() => {
    for (const key of envNames) {
        if (previousEnv[key] === undefined) delete process.env[key];
        else process.env[key] = previousEnv[key];
    }
    global.fetch = previousFetch;
    console.error = previousError;
});

function response(data, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => data };
}

function serverResponse() {
    return {
        statusCode: 200,
        headers: {},
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; },
    };
}

const pix = { txid: 'tx-test', route: 'fyntra', pix_code: '000201-test', pix_qr_code: 'https://provider.example/qr.png' };
const customer = { name: 'Test Buyer', email: 'buyer@example.com', cellphone: '11999999999', taxId: '52998224725' };
function checkoutBody(overrides = {}) {
    return {
        customer_name: customer.name, customer_email: customer.email,
        customer_cpf: customer.taxId, customer_phone: '(11) 99999-9999',
        product_id: '001', action: 'buy', ...overrides,
    };
}

test('create-pix uses origin, cents and body authentication without a fixed route', async () => {
    let request;
    global.fetch = async (url, options) => { request = { url, options }; return response(pix); };
    assert.deepEqual(await createPix({ amountCents: 1990, customer }), pix);
    assert.equal(request.url, 'https://allow-gi0i.onrender.com/api/v2/allowpay-seller/create-pix');
    assert.equal(request.options.headers['X-AllowPay-Origin'], 'https://store.example');
    assert.ok(request.options.signal instanceof AbortSignal);
    const body = JSON.parse(request.options.body);
    assert.equal(body.amount, 1990);
    assert.equal(body.api_key, 'test-key');
    assert.equal(body.customer.taxId, customer.taxId);
    assert.equal(Object.hasOwn(body, 'route'), false);
});

test('API uses server price and normalized customer data; polling omits webhook', async () => {
    process.env.UTMIFY_API_TOKEN = 'test-token';
    let sent;
    global.fetch = async (url, options) => {
        if (url.includes('create-pix')) {
            sent = JSON.parse(options.body);
            return response(pix);
        }
        return response({});
    };
    const res = serverResponse();
    await createHandler({ method: 'POST', headers: {}, body: checkoutBody({ action: 'bid', amount_cents: 1 }) }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(sent.amount, getProductPrice('001', 'bid').amountCents);
    assert.equal(sent.customer.cellphone, '11999999999');
    assert.equal(Object.hasOwn(sent, 'webhook_url'), false);
    assert.equal(res.body.transaction_id, pix.txid);
    assert.equal(res.body.route, pix.route);
    assert.equal(res.body.qr_code, pix.pix_qr_code);
    assert.equal(JSON.stringify(res.body).includes('test-key'), false);
});

test('origin can come from PUBLIC_URL or matching request host, never a foreign origin', async () => {
    delete process.env.ALLOWPAY_ORIGIN;
    process.env.PUBLIC_URL = 'https://public.example/';
    const origins = [];
    global.fetch = async (url, options) => {
        origins.push(options.headers['X-AllowPay-Origin']);
        return response(pix);
    };
    await createPix({ amountCents: 100, customer });
    delete process.env.PUBLIC_URL;
    process.env.UTMIFY_API_TOKEN = 'test-token';
    global.fetch = async (url, options) => {
        if (url.includes('create-pix')) origins.push(options.headers['X-AllowPay-Origin']);
        return response(url.includes('create-pix') ? pix : {});
    };
    const res = serverResponse();
    await createHandler({ method: 'POST', body: checkoutBody(), headers: { origin: 'https://store.example', host: 'store.example' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(origins, ['https://public.example', 'https://store.example']);
    const rejected = serverResponse();
    await createHandler({ method: 'POST', body: checkoutBody(), headers: { origin: 'https://foreign.example', host: 'store.example' } }, rejected);
    assert.equal(rejected.statusCode, 500);
    assert.equal(origins.length, 2);
});

test('invalid customer, CPF, phone, action and product are rejected before any network call', async () => {
    assert.equal(isValidCPF(customer.taxId), true);
    assert.equal(isValidCPF('11111111111'), false);
    for (const overrides of [
        { customer_name: {} }, { customer_name: ' ' }, { customer_email: 'bad' },
        { customer_cpf: '52998224724' }, { customer_phone: '123' },
        { action: 'invalid' }, { product_id: 'constructor' }, { product_id: 'unknown' },
    ]) {
        const res = serverResponse();
        await createHandler({ method: 'POST', body: checkoutBody(overrides), headers: {} }, res);
        assert.equal(res.statusCode, 400);
    }
});

test('provider malformed responses and unknown status do not look like success', async () => {
    for (const data of [{}, null, [], { ...pix, route: '' }, { ...pix, pix_qr_code: 'javascript:alert(1)' }, { ...pix, pix_qr_code: 'bad-url' }]) {
        global.fetch = async () => response(data);
        await assert.rejects(createPix({ amountCents: 1990, customer }), { status: 502 });
    }
    global.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad JSON'); } });
    await assert.rejects(createPix({ amountCents: 1990, customer }), { status: 502 });
    global.fetch = async () => response({ status: 'unknown' });
    await assert.rejects(getPaymentStatus({ txid: pix.txid, route: pix.route }), { status: 502 });
    global.fetch = async () => response({ error: 'private provider message' }, 503);
    await assert.rejects(createPix({ amountCents: 1990, customer }), { status: 503 });
});

test('payment status uses escaped txid/route and body key and preserves every terminal status', async () => {
    for (const status of ['waiting_payment', 'approved', 'expired', 'declined', 'canceled', 'refunded', 'chargeback']) {
        global.fetch = async (url, options) => {
            assert.match(url, /payment-status\/tx%2Ftest\?route=route%26test$/);
            assert.equal(options.method, 'POST');
            assert.deepEqual(JSON.parse(options.body), { api_key: 'test-key' });
            return response({ status });
        };
        const res = serverResponse();
        await checkHandler({ method: 'GET', query: { transaction_id: 'tx/test', route: 'route&test' } }, res);
        assert.equal(res.body.payment_status, status);
        assert.equal(res.body.status, status === 'approved' ? 'PAID' : status === 'waiting_payment' ? 'PENDING' : 'EXPIRED');
        assert.equal(res.headers['Cache-Control'], 'no-store');
    }
    const res = serverResponse();
    await checkHandler({ method: 'GET', query: { transaction_id: ['tx'], route: 'fyntra' } }, res);
    assert.equal(res.statusCode, 400);
});

test('Utmify cannot report paid before AllowPay approves', async () => {
    process.env.UTMIFY_API_TOKEN = 'test-token';
    let sends = 0;
    let status = 'waiting_payment';
    global.fetch = async (url, options) => {
        if (url.includes('payment-status')) return response({ status });
        sends++;
        assert.equal(JSON.parse(options.body).status, 'paid');
        return response({});
    };
    const req = { method: 'POST', headers: {}, body: { ...checkoutBody(), transaction_id: pix.txid, route: pix.route } };
    const pending = serverResponse();
    await orderHandler(req, pending);
    assert.equal(pending.statusCode, 409);
    assert.equal(sends, 0);
    status = 'approved';
    const approved = serverResponse();
    await orderHandler(req, approved);
    assert.equal(approved.body.success, true);
    assert.equal(sends, 1);
});

function browser(status, httpStatus = 200) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'checkout-payment.html', 'index.html'), 'utf8');
    const source = html.slice(html.indexOf('        function pollPaymentStatus('), html.indexOf('        // Topbar rotativo'));
    const elements = new Map();
    const element = (id) => {
        if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', classList: { add() {}, remove() {} } });
        return elements.get(id);
    };
    const timers = [];
    const calls = [];
    const storage = new Map();
    const context = vm.createContext({
        setTimeout: (callback, delay) => timers.push({ callback, delay }),
        fetch: async (url, options) => {
            calls.push({ url, options });
            return response({ success: httpStatus === 200, payment_status: status }, httpStatus);
        },
        document: { getElementById: element, querySelector: element },
        sessionStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
        console: { error() {} }, AbortSignal, URLSearchParams,
        activePrice: 'R$ 300,00', productId: '001', checkoutAction: 'buy', utmParams: {},
        window: { location: { href: '' } },
    });
    vm.runInContext(source, context);
    context.pollPaymentStatus('tx/test', 'route&test');
    return { context, timers, calls, storage, element };
}

test('browser polls at five seconds with encoded identifiers and stops for every terminal status', async () => {
    for (const status of ['waiting_payment', 'approved', 'expired', 'declined', 'canceled', 'refunded', 'chargeback']) {
        const page = browser(status);
        const first = page.timers.shift();
        assert.equal(first.delay, 5000);
        assert.equal(page.calls.length, 0);
        await first.callback();
        assert.match(page.calls[0].url, /transaction_id=tx%2Ftest&route=route%26test$/);
        if (status === 'waiting_payment') {
            assert.equal(page.timers[0].delay, 5000);
        } else if (status === 'approved') {
            assert.equal(page.storage.get('paidAmount'), 'R$ 300,00');
            assert.equal(JSON.parse(page.calls[1].options.body).route, 'route&test');
            assert.equal(page.timers[0].delay, 3000);
            page.timers[0].callback();
            assert.equal(page.context.window.location.href, '../pedido-confirmado.html/index.html');
        } else {
            assert.equal(page.timers.length, 0);
            assert.notEqual(page.element('error-message').textContent, '');
        }
    }
});

test('browser displays temporary failures and retries, but stops on client/authentication errors', async () => {
    for (const code of [500, 503, 400, 401]) {
        const page = browser(undefined, code);
        await page.timers.shift().callback();
        assert.equal(page.timers.length, code >= 500 ? 1 : 0);
        if (code >= 500) assert.equal(page.timers[0].delay, 5000);
        assert.notEqual(page.element('error-message').textContent, '');
    }
});

test('checkout displays the provider QR without sending the Pix code to a third-party generator', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'checkout-payment.html', 'index.html'), 'utf8');
    const source = html.slice(html.indexOf('        function displayPix('), html.indexOf('        function copyPixCode('));
    const elements = new Map();
    const element = (id) => {
        if (!elements.has(id)) elements.set(id, { style: {} });
        return elements.get(id);
    };
    let polled;
    let error;
    const context = vm.createContext({
        document: { getElementById: element },
        sessionStorage: { getItem: () => '{}' },
        activePrice: 'R$ 300,00',
        pollPaymentStatus: (txid, route) => { polled = { txid, route }; },
        showError: (message) => { error = message; },
    });
    vm.runInContext(source, context);
    context.displayPix({ copy_paste: pix.pix_code, qr_code: pix.pix_qr_code }, pix.txid, pix.route);
    assert.equal(element('pix-qrcode').src, pix.pix_qr_code);
    assert.equal(element('pix-code').value, pix.pix_code);
    assert.deepEqual(polled, { txid: pix.txid, route: pix.route });
    element('pix-qrcode').onerror();
    assert.match(error, /copia-e-cola/);
});

test('all inline checkout scripts have valid JavaScript syntax', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'checkout-payment.html', 'index.html'), 'utf8');
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        new vm.Script(match[1]);
    }
});

test('checkout contains all payment controls and starts Pix generation on load', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'checkout-payment.html', 'index.html'), 'utf8');
    const markup = html.slice(0, html.indexOf('        const params ='));
    for (const id of ['loading', 'pix-display', 'pix-code', 'pix-price', 'copy-pix', 'copy-feedback', 'bank-steps', 'bank-price', 'qr-details', 'pix-qrcode', 'payment-status']) {
        assert.ok(markup.includes(`id="${id}"`), `Missing ${id}`);
    }
    assert.match(html, /window\.addEventListener\('load', \(\) => \{ generatePix\(\); \}\)/);
});
