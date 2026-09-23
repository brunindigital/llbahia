# Base44 Dev Environment

## Project Overview
Static HTML auction/e-commerce site ("Casas Bahia Leilão" / Mercado Livre branded) with Vercel-style serverless API functions for PIX payment integration (AllowPay) and order tracking (Utmify). All source lives under `leilaoseguro/`.

## Architecture
- **Frontend**: Pure static HTML/CSS/JS — no build step. Pages include `index.html`, product pages (`produto-NNN/index.html`), and checkout flow (`checkout/`, `checkout-delivery.html/`, `checkout-payment.html/`, `confirmacao.html/`, `pedido-confirmado.html/`).
- **API**: Node.js serverless functions in `leilaoseguro/api/` (Vercel function signature `module.exports = async (req, res) => {...}`). Adapted to run under Express via `leilaoseguro/server.js`.
  - `POST /api/create-pix` — generates a PIX payment via AllowPay
  - `GET /api/check-payment?transaction_id=&route=` — polls AllowPay for payment status
  - `POST /api/utmify-order` — reports a paid order to Utmify
  - `POST /api/webhooks/allowpay` — receives AllowPay webhook callbacks (HMAC-validated)

## Running
```bash
docker compose -f docker-compose.base44.yml up -d
```
App serves on port 3000. The Node/Express server (`leilaoseguro/server.js`) serves static files and mounts the API routes.

## Environment Variables
| Variable | Required | Description |
|---|---|---|
| `ALLOWPAY_API_KEY` | For PIX API | AllowPay API key (from AllowPay dashboard). Site loads without it; only `/api/create-pix` fails. |
| `ALLOWPAY_BASE_URL` | No (has default) | AllowPay API base URL. Default: `https://allow-gi0i.onrender.com` |
| `ALLOWPAY_WEBHOOK_SECRET` | No | Secret for webhook HMAC validation. |
| `UTMIFY_API_TOKEN` | No | Utmify API token. If absent, order tracking is silently skipped. |
| `PUBLIC_URL` | No | Public HTTPS URL for webhook registration. |

## Notes
- The frontend checkout flow currently uses client-side `sessionStorage` and does not call the API endpoints yet — the API functions exist but are not wired into the frontend.
- `node_modules/` is installed at container startup via `npm install --omit=dev`.
