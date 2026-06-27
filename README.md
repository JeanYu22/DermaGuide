# DermaGuide — PureGlow Commerce Engine

Trust-First, AI-Powered Personal Skincare Consultant and Commerce Engine.

This is the commercialized, full-stack version of the original single-file
**PureGlow** prototype. It keeps the same storefront design and AI framework
(consultant "Lily", vision skin analysis, and dual-agent cross-validation) but
runs them on a real backend:

- **AI agents** run on a local **llama.cpp** server (OpenAI-compatible API) at
  `http://localhost:8080`, model `google/gemma-4-E4B-it-qat-q4_0-gguf:Q4_0`.
- **Persistence** uses **MongoDB** at `mongodb://localhost:27017`.
- Adds **authentication, shopping cart, checkout, order history, and an admin
  dashboard** on top of the original experience.

---

## Architecture

```
Browser (public/)
  ├─ index.html / css / app.js      PureGlow UI + storefront logic
  └─ ml.js                          In-browser TensorFlow.js cross-validation
        │  REST + SSE
        ▼
Express API (src/)
  ├─ routes/      auth, products, cart, orders, chat (SSE), analysis, feedback, admin
  ├─ services/
  │   ├─ llm.js                     llama.cpp OpenAI-compatible client (stream + vision)
  │   └─ agents/
  │       ├─ consultant.js          "Lily" chat agent
  │       ├─ analyzer.js            10-metric skin analysis (multimodal)
  │       └─ reviewer.js            senior-reviewer peer cross-check
  ├─ models/      Mongoose schemas (Product, User, Cart, Order, Analysis, Feedback, SecurityLog)
  └─ server.js
        │
        ├──────────────►  llama.cpp  @ localhost:8080   (AI inference)
        └──────────────►  MongoDB    @ localhost:27017  (data)
```

### The AI agent framework

The original prototype used two cloud models (Claude + GPT-4o) to
cross-validate each other. Here that **dual-agent framework is preserved** using
the single local Gemma model under two distinct personas:

| Agent        | Role                                                           |
| ------------ | -------------------------------------------------------------- |
| `consultant` | "Lily" — friendly storefront advisor, recommends products      |
| `analyzer`   | Dermatology vision analysis → 10 metrics + radar chart         |
| `reviewer`   | Senior reviewer — audits the analysis and the product picks    |

A third, independent check runs **client-side** (`ml.js`): TensorFlow.js
BlazeFace + LAB/Sobel pixel analysis overlays an ML "second opinion" on the
radar chart.

### Human-feedback calibration loop ("RL-style")

The local Gemma grader is imperfect (it can under/over-rate metrics). Rather
than retrain the GGUF weights (not possible locally), the system **learns its
systematic bias from real users**:

- Every analysis shows **"✓ Looks accurate"** and **"✎ Adjust scores"**.
- "Adjust" opens sliders; the user sets the true 0-10 values.
- The backend records `(trueValue − modelValue)` per metric and, once enough
  samples exist, applies the learned **offset** to every future analysis
  (`src/services/calibration.js`). Confirmations reinforce; corrections steer.
- The admin **Calibration** tab shows each metric's sample count and applied
  offset. Raw model scores are kept (`Analysis.modelMetrics`) so corrections
  always measure the model's true bias.

### Dropshipping suppliers

Products can be sourced from external dropshipping suppliers and shown in the
storefront as platform stock (priced at `supplierPrice × markup`, flagged
`dropship: true`). A supplier-adapter framework normalises every source into
the `Product` schema, inferring skincare concerns from titles and filtering out
non-skincare items.

| Supplier | Reality | Adapter |
| --- | --- | --- |
| **AliExpress Dropshipping** | Real API (Alibaba Open Platform DS API) | `suppliers/aliexpress.js` — signed calls; needs `ALIEXPRESS_APP_KEY/_SECRET/_ACCESS_TOKEN` |
| **Spocket** | No public API (integrates via Shopify); use its export | `suppliers/feed.js` — CSV/JSON feed URL |
| **BeautyJoint** | No developer API; wholesale data feed | `suppliers/feed.js` — CSV/JSON feed URL |

Configure and sync from **admin → Suppliers**: set a feed URL (Spocket/
BeautyJoint) or provide AliExpress credentials in `.env`, set the markup,
enable, and click **Sync now**. Re-syncing refreshes price/stock/images while
keeping manual edits. `src/services/suppliers/index.js` orchestrates the sync;
`normalize.js` maps raw items → products.

> Only AliExpress exposes a usable public dropshipping API. Spocket and
> BeautyJoint are integrated via their product feeds/exports (CSV or JSON),
> which is the realistic path for a custom platform.

### Human-skin gate

Before scoring, the analyzer agent decides `IS_HUMAN_SKIN: yes/no`. Non-skin
images (objects, screenshots, animals, etc.) return a friendly "not human
skin" message instead of a chart. This complements the existing client-side
pixel pre-check (`preValidateSkinImage`).

---

## Prerequisites

1. **Node.js ≥ 18** (uses the global `fetch` and streaming APIs).
2. **MongoDB** running at `localhost:27017`.
3. **llama.cpp server** running at `localhost:8080` with the multimodal Gemma
   model. Example:

   ```bash
   llama-server \
     -m gemma-4-E4B-it-qat-Q4_0.gguf \
     --mmproj gemma-4-E4B-mmproj.gguf \
     --alias "google/gemma-4-E4B-it-qat-q4_0-gguf:Q4_0" \
     --host 0.0.0.0 --port 8080 -c 8192
   ```

   The `--mmproj` projector is required so the skin-analysis agent can read
   uploaded photos. The `--alias` must match `LLAMA_MODEL` in your `.env`.

> A `docker-compose.yml` is included that wires up MongoDB + llama.cpp + the app.
> Mount your GGUF files into `./models` and adjust the file names in the compose
> file's `llama` command.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env        # then edit secrets / hosts as needed

# 3. Seed the product catalogue + bootstrap an admin user
npm run seed

# 4. (optional) Verify the model connection
npm run test:llm

# 5. Start the server
npm start                   # http://localhost:3000
```

The default admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in
`.env`. Sign in with it, open **My Account → Admin Dashboard**.

---

## API reference

| Method | Path                              | Auth   | Description                              |
| ------ | --------------------------------- | ------ | ---------------------------------------- |
| GET    | `/api/health`                     | —      | Server + model reachability              |
| POST   | `/api/auth/register`              | —      | Create account → `{ token, user }`       |
| POST   | `/api/auth/login`                 | —      | Log in → `{ token, user }`               |
| GET    | `/api/auth/me`                    | user   | Current user                             |
| GET    | `/api/products`                   | —      | Storefront catalogue (filterable)        |
| GET    | `/api/products/:id`               | —      | Single product                           |
| GET    | `/api/cart`                       | user   | Current cart + totals                    |
| POST   | `/api/cart/items`                 | user   | Add item                                 |
| PATCH  | `/api/cart/items/:productId`      | user   | Update quantity                          |
| DELETE | `/api/cart/items/:productId`      | user   | Remove item                              |
| POST   | `/api/orders/checkout`            | user   | Place order (mock payment)               |
| GET    | `/api/orders`                     | user   | Order history                            |
| POST   | `/api/chat`                       | —      | **SSE** stream of Lily's reply + recs    |
| POST   | `/api/analysis`                   | —      | Multipart image → metrics + products     |
| POST   | `/api/analysis/:id/reevaluate`    | —      | Re-run analysis with user feedback       |
| POST   | `/api/feedback`                   | —      | Record analysis feedback                 |
| GET    | `/api/admin/*`                    | admin  | Stats, product CRUD, orders, logs        |

### Chat streaming (SSE) events

`POST /api/chat` returns `text/event-stream` with these events:

- `token` `{ delta }` — incremental assistant text
- `recommendations` `{ products }` — reviewer-validated product matches
- `done` `{ full }` — final cleaned message
- `error` `{ message }`

---

## Security & privacy notes

- **Prompt-injection / probing** is detected **server-side** (`utils/security.js`)
  so it can't be bypassed by editing the page; attempts are logged to MongoDB and
  surfaced in the admin **Security** tab.
- Lily's replies are **sanitized** to strip any fourth-wall / "I am an AI" leaks.
- **Skin photos are never stored.** They are streamed to the local model and
  discarded; only derived metrics persist in the `analyses` collection.
- Supplier and cost data on products are **never** exposed to the storefront API
  (`Product.toStorefront()`).
- Passwords are hashed with bcrypt; sessions use JWTs.

> This tool provides cosmetic guidance only and is **not** a medical device or a
> substitute for professional dermatological diagnosis.

---

## Project layout

```
src/
  config/        env-driven configuration
  db/            Mongo connection + seed script
  models/        Mongoose schemas
  middleware/    auth (JWT) + error handling
  routes/        REST + SSE endpoints
  services/      llm client + AI agents
  utils/         security guard
public/
  index.html     storefront shell
  css/styles.css PureGlow theme
  js/app.js      storefront + commerce logic
  js/ml.js       in-browser ML cross-validation + radar chart
scripts/
  check-llm.js   model connectivity smoke test
```
