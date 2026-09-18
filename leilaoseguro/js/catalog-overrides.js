(function () {
    const storageKey = 'mercadoLivreCatalogOverrides';
    const defaults = {
        '001': { name: 'Smart TV LG 55" 4K UHD', original: 3299.90, buy: 1653.64, current: 1289, next: 1389 },
        '002': { name: 'Smart TV Philco 65" 4K UHD', original: 4499.90, buy: 2700, current: 1817.51, next: 1917.51 },
        '003': { name: 'Geladeira LG Frost Free 435L', original: 4299.90, buy: 350, current: 275, next: 375 },
        '004': { name: 'Geladeira Brastemp Frost Free 431L', original: 4999.90, buy: 300, current: 250, next: 350 },
        '005': { name: 'Lava e seca Hisense', original: 3999.90, buy: 200, current: 125, next: 225 },
        '008': { name: 'iPhone 17 Pro Max 512GB', original: 7999.90, buy: 3509.10, current: 2016, next: 2116 },
        '010': { name: 'PlayStation 5 Slim 2TB', original: 4999.90, buy: 300, current: 250, next: 350 },
        '011': { name: 'Air Fryer Mondial 12L', original: 799.90, buy: 290, current: 120, next: 220 },
        '012': { name: 'Air Fryer Oven 12L', original: 899.90, buy: 200, current: 160, next: 260 },
        '013': { name: 'Micro-ondas Eletrolux 34L', original: 1299.90, buy: 200, current: 110, next: 210 },
        '014': { name: 'Micro-ondas Philco 34L Inox', original: 1199.90, buy: 150, current: 110, next: 210 },
        '015': { name: 'Cafeteira Nespresso 15 Bar', original: 999.90, buy: 220, current: 130, next: 230 },
        '016': { name: 'Cafeteira Espresso Automática', original: 2499.90, buy: 295.95, current: 260, next: 360 },
        '018': { name: 'Lavadora de Alta Pressão 1800W', original: 999.90, buy: 270, current: 210, next: 310 },
        '029': { name: 'PlayStation 5 Slim 1TB', original: 4499.90, buy: 350, current: 150, next: 250 },
        '055': { name: 'Notebook Lenovo Thinkpad T14', original: 5999.90, buy: 270, current: 160, next: 260 },
        '073': { name: 'Geladeira Eletrolux Porta Dupla Frost Free Inox', original: 4999.90, buy: 350, current: 225, next: 325 },
        '120': { name: 'Máquina de Lavar Consul 15kg', original: 1999.90, buy: 200, current: 150, next: 250 },
        '194': { name: 'iPhone 17 Pro 512GB', original: 6999.90, buy: 360, current: 225, next: 325 },
        '198': { name: 'iPhone 13 512GB', original: 2499.90, buy: 920.67, current: 624.52, next: 724.52 }
    };
    const order = ['008', '001', '002', '198', '003', '073', '004', '005', '120', '194', '029', '055', '010', '011', '012', '013', '014', '015', '016', '018'];

    function readOverrides() {
        try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
    }

    function getCatalog() {
        return Object.keys(defaults).reduce((catalog, id) => {
            catalog[id] = { ...defaults[id], ...(readOverrides()[id] || {}) };
            return catalog;
        }, {});
    }

    function money(value) {
        return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function discount(item) {
        return Math.max(0, Math.round((1 - item.buy / item.original) * 100));
    }

    function updateProductPage(id, item) {
        const buy = document.querySelector('.direct-price-value');
        const original = document.querySelector('.original-price-new span');
        const current = document.querySelector('[data-demo-value]');
        const next = document.querySelector('[data-next-bid]');
        const discountBox = document.querySelector('.discount-box strong');
        const bid = document.querySelector('[data-bid-button-title]');
        const buyButton = document.querySelector('.simple-buy-button strong');
        if (buy) buy.textContent = money(item.buy);
        if (original) original.textContent = money(item.original);
        if (current) current.textContent = money(item.current);
        if (next) next.textContent = money(item.next);
        if (discountBox) discountBox.textContent = `${discount(item)}%`;
        if (bid) bid.textContent = `Dar lance de ${money(item.next)}`;
        if (buyButton) buyButton.textContent = `Comprar agora por ${money(item.buy)}`;
    }

    function updateHome(catalog) {
        document.querySelectorAll('.cb-lot-card').forEach(card => {
            const link = card.querySelector('a[href*="produto-"]');
            const match = link?.getAttribute('href')?.match(/produto-(\d+)/);
            if (!match || !catalog[match[1]]) return;
            const item = catalog[match[1]];
            card.querySelector('.cb-buy-price')?.replaceChildren(document.createTextNode(money(item.buy)));
            const bids = card.querySelectorAll('.cb-auction-data b');
            if (bids[0]) bids[0].textContent = money(item.current);
        });
    }

    function updateCheckout(catalog) {
        const id = new URLSearchParams(location.search).get('id');
        const item = catalog[id];
        if (!item) return;
        const price = document.querySelector('#product-price');
        const amount = new URLSearchParams(location.search).get('action') === 'bid' ? item.next : item.buy;
        if (price) price.textContent = money(amount);
        ['#w-amount', '#v-amount', '#v-total', '#v-amount2'].forEach(selector => {
            const element = document.querySelector(selector);
            if (element) element.textContent = money(item.next);
        });
    }

    const catalog = getCatalog();
    const productMatch = location.pathname.match(/produto-(\d+)/);
    if (productMatch && catalog[productMatch[1]]) updateProductPage(productMatch[1], catalog[productMatch[1]]);
    if (document.querySelector('.cb-lot-card')) updateHome(catalog);
    if (document.querySelector('#product-price')) updateCheckout(catalog);

    window.MercadoLivreCatalog = { defaults, order, getCatalog, storageKey, money, discount };
})();
