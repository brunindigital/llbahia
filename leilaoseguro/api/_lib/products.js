// Catálogo de preços — espelha o catálogo do front-end, mas é a ÚNICA fonte confiável de preço.
// O valor enviado pelo navegador (amount_cents) é ignorado; o servidor recalcula pelo product_id.

const PRODUCTS = {
    '001': { name: 'Smart TV LG 55" 4K UHD', priceCents: 165364, bidPriceCents: 138900 },
    '002': { name: 'Smart TV Philco 65" 4K UHD', priceCents: 270000, bidPriceCents: 191751 },
    '003': { name: 'Geladeira LG Frost Free 435L', priceCents: 35000, bidPriceCents: 27500 },
    '004': { name: 'Geladeira Brastemp Frost Free 431L', priceCents: 30000, bidPriceCents: 25000 },
    '005': { name: 'Lava e seca Hisense', priceCents: 20000, bidPriceCents: 12500 },
    '008': { name: 'iPhone 17 Pro Max 512GB', priceCents: 350910, bidPriceCents: 211600 },
    '010': { name: 'PlayStation 5 Slim 2TB', priceCents: 30000, bidPriceCents: 25000 },
    '011': { name: 'Air Fryer Mondial 12L', priceCents: 29000, bidPriceCents: 12000 },
    '012': { name: 'Air Fryer Oven 12L', priceCents: 20000, bidPriceCents: 16000 },
    '013': { name: 'Micro-ondas Eletrolux 34L', priceCents: 20000, bidPriceCents: 11000 },
    '014': { name: 'Micro-ondas Philco 34L Inox', priceCents: 15000, bidPriceCents: 11000 },
    '015': { name: 'Cafeteira Nespresso 15 Bar', priceCents: 22000, bidPriceCents: 13000 },
    '016': { name: 'Cafeteira Espresso Automática', priceCents: 29595, bidPriceCents: 26000 },
    '018': { name: 'Lavadora de Alta Pressão 1800W', priceCents: 27000, bidPriceCents: 21000 },
    '029': { name: 'PlayStation 5 Slim 1TB', priceCents: 35000, bidPriceCents: 15000 },
    '055': { name: 'Notebook Lenovo Thinkpad T14', priceCents: 27000, bidPriceCents: 16000 },
    '073': { name: 'Geladeira Eletrolux Porta Dupla Frost Free Inox', priceCents: 35000, bidPriceCents: 22500 },
    '120': { name: 'Máquina de Lavar Consul 15kg', priceCents: 20000, bidPriceCents: 15000 },
    '194': { name: 'iPhone 17 Pro 512GB', priceCents: 36000, bidPriceCents: 22500 },
    '198': { name: 'iPhone 13 512GB', priceCents: 92067, bidPriceCents: 72452 },
    '999': { name: 'Teste Utmify', priceCents: 1000, bidPriceCents: 1000 }, // produto temporário só para teste de PIX/pixel
};

function getProductPrice(productId, action) {
    const product = PRODUCTS[productId];
    if (!product) return null;

    const amountCents = action === 'bid' && product.bidPriceCents ? product.bidPriceCents : product.priceCents;
    return { name: product.name, amountCents };
}

module.exports = { PRODUCTS, getProductPrice };
