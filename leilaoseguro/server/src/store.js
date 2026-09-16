// Armazenamento simples em arquivo JSON para as transações PIX (txid, route, status).
// Suficiente para baixo volume; escritas são serializadas para evitar corrupção do arquivo.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'transactions.json');
const EVENTS_FILE = path.join(DATA_DIR, 'processed-events.json');

let writeQueue = Promise.resolve();

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file) {
    ensureDataDir();
    if (!fs.existsSync(file)) return {};
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return {};
    }
}

function queueWrite(file, mutate) {
    writeQueue = writeQueue.then(() => {
        const current = readJson(file);
        const next = mutate(current);
        ensureDataDir();
        fs.writeFileSync(file, JSON.stringify(next, null, 2));
        return next;
    });
    return writeQueue;
}

async function saveTransaction(txid, record) {
    await queueWrite(DATA_FILE, (all) => ({ ...all, [txid]: { ...all[txid], ...record } }));
}

function getTransaction(txid) {
    const all = readJson(DATA_FILE);
    return all[txid] || null;
}

async function updateTransactionStatus(txid, status) {
    await queueWrite(DATA_FILE, (all) => {
        if (!all[txid]) return all;
        return { ...all, [txid]: { ...all[txid], status, updated_at: new Date().toISOString() } };
    });
}

async function wasEventProcessed(eventId) {
    const events = readJson(EVENTS_FILE);
    return Boolean(events[eventId]);
}

async function markEventProcessed(eventId) {
    await queueWrite(EVENTS_FILE, (all) => ({ ...all, [eventId]: new Date().toISOString() }));
}

module.exports = {
    saveTransaction,
    getTransaction,
    updateTransactionStatus,
    wasEventProcessed,
    markEventProcessed,
};
