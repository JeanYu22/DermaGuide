/* ===========================================================================
 * PureGlow / DermaGuide storefront client.
 * Talks to the Express backend (REST + SSE), which proxies the AI agents to
 * the local llama.cpp model and persists everything in MongoDB.
 * In-browser TensorFlow.js ML stays client-side for cross-validation.
 * ======================================================================== */

// ---------- State ----------
const State = {
  token: localStorage.getItem('pg_token') || null,
  user: JSON.parse(localStorage.getItem('pg_user') || 'null'),
  products: [],
  cartCount: 0,
  skinAnalysisContext: null,
  currentImageFile: null,
};

// ---------- API helper ----------
async function api(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  if (State.token) headers.Authorization = `Bearer ${State.token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code; // e.g. 'not_human_skin'
    err.raw = data.raw; // e.g. the model's unparseable output, for debugging
    throw err;
  }
  return data;
}

// Metric display order (matches the radar chart axes).
const METRIC_ORDER = [
  ['dryness', 'Dryness'], ['dehydration', 'Dehydration'], ['wrinkles', 'Wrinkles'],
  ['sagging', 'Sagging'], ['sensitivity', 'Sensitivity'], ['redness', 'Redness'],
  ['blockedPores', 'Blocked Pores'], ['enlargedPores', 'Enlarged Pores'],
  ['acne', 'Acne'], ['pigmentation', 'Pigmentation'],
];

// Per-analysis UI context so corrections can redraw the chart/grid in place.
const analysisStore = {};

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ---------- Dark mode ----------
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.body.classList.add('dark');
}

// ---------- Tips (static) ----------
const tips = [
  { icon: '☀️', title: 'SPF Daily', text: 'Mineral sunscreen prevents 80% of premature aging' },
  { icon: '💧', title: 'Double Cleanse', text: 'Oil cleanser first, then water-based for deep clean' },
  { icon: '🌙', title: 'Night Repair', text: 'Skin regenerates at night - use actives PM' },
  { icon: '🥒', title: 'Hydrate Inside', text: '2L water daily + antioxidant-rich foods = glow' },
];

// ===========================================================================
// Lily — animated illustrated care agent + clinical scan visuals
// ===========================================================================
// Lily is presented with the real illustrated nurse (from the source promo):
// a friendly dermatologist portrait. Circular slots use a face crop.
const LILY_IMG = '<img class="lily-img" src="/img/lily-face.png" alt="Lily, your skincare guide" loading="lazy">';

// Inject the Lily face into every [data-lily] slot on the page.
function injectLilyAvatars(root) {
  (root || document).querySelectorAll('[data-lily]').forEach((el) => {
    if (!el.dataset.lilyDone) { el.innerHTML = LILY_IMG; el.dataset.lilyDone = '1'; }
  });
}

// Clinical face-scan loader — the real scan-device art with an animated
// light sweep + glow pulse (mirrors the promo's face-scan device).
function scanFaceHTML(caption, opts = {}) {
  return `<div class="face-scan${opts.small ? ' sm' : ''}" role="img" aria-label="Analyzing your skin">
    <div class="scan-media"><img src="/img/scan-face.png" alt=""><div class="fs-sweep"></div></div>
  </div>${caption ? `<div class="fs-caption">${caption}</div>` : ''}${opts.substatus ? `<div class="fs-substatus" id="${opts.substatusId || ''}">${opts.substatus}</div>` : ''}`;
}

// ===========================================================================
// Navigation
// ===========================================================================
let lastScrollTop = 0;

function enterShop() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('shopView').classList.add('active');
  setTimeout(() => { document.getElementById('aiAssistant').classList.add('active'); startAssistantCoach(); }, 800);
  maybeShowCoach();
}
function quickAnalyze() { enterShop(); setTimeout(openAnalyzer, 300); }

// First-visit guided coach — Lily introduces herself and leads the user
// through the flow (scan → review → shop routine).
function maybeShowCoach() {
  if (localStorage.getItem('dg_coached')) return;
  const el = document.createElement('div');
  el.className = 'coach-overlay';
  el.id = 'coachOverlay';
  el.onclick = (e) => { if (e.target === el) coachDismiss(); };
  el.innerHTML = `<div class="coach-card">
    <div class="coach-avatar" data-lily></div>
    <div class="coach-title">${L('coach_hi', "Hi, I'm Lily 👋")}</div>
    <div class="coach-text">${L('coach_intro', "I'm your skincare guide. Let's start with a 20-second skin scan — then I'll build a routine made just for you.")}</div>
    <div class="coach-steps">
      <span class="coach-step"><b>1</b> ${L('coach_s1', 'Scan')}</span>
      <span class="coach-step"><b>2</b> ${L('coach_s2', 'Review')}</span>
      <span class="coach-step"><b>3</b> ${L('coach_s3', 'Shop routine')}</span>
    </div>
    <button class="btn btn-primary btn-full" onclick="coachStart()">📸 ${L('coach_start', 'Scan my skin')}</button>
    <button class="btn btn-secondary btn-full" onclick="coachDismiss()">${L('coach_skip', 'Explore the shop first')}</button>
  </div>`;
  document.body.appendChild(el);
  injectLilyAvatars(el);
}
function coachDone() { localStorage.setItem('dg_coached', '1'); const el = document.getElementById('coachOverlay'); if (el) el.remove(); }
function coachDismiss() { coachDone(); }
function coachStart() { coachDone(); setTimeout(openAnalyzer, 250); }

// Make the floating assistant feel alive: cycle short guiding prompts.
let assistantCoachTimer = null;
function startAssistantCoach() {
  const bubble = document.getElementById('assistantBubble');
  const textEl = bubble && bubble.querySelector('.assistant-bubble-text');
  if (!textEl || assistantCoachTimer) return;
  const tips = [
    L('lead_1', "New here? Tap me and I'll scan your skin in 20 seconds. 📸"),
    L('lead_2', 'I pick organic products for your exact concerns — with the reason for each. 🧴'),
    L('lead_3', 'Ask me anything about your routine, ingredients or order. 💬'),
  ];
  let i = 0;
  assistantCoachTimer = setInterval(() => {
    if (!document.getElementById('aiAssistant').classList.contains('active')) return;
    i = (i + 1) % tips.length;
    textEl.style.opacity = '0';
    setTimeout(() => { textEl.textContent = tips[i]; textEl.style.opacity = '1'; }, 250);
  }, 5200);
}
function dismissAssistant() {
  const a = document.getElementById('aiAssistant');
  a.style.animation = 'assistantEntrance .5s ease-out reverse';
  setTimeout(() => { a.classList.remove('active'); a.style.animation = ''; }, 500);
}
function openChatFromAssistant() { dismissAssistant(); setTimeout(openChat, 300); }
function openChat() { document.getElementById('chatModal').classList.add('active'); }
function closeChat() { document.getElementById('chatModal').classList.remove('active'); }
function openAnalyzer() { document.getElementById('analyzerModal').classList.add('active'); renderAnalyzerHome(); }

// Two-panel analyzer scaffold: upload/preview on the left, results on the right.
function renderAnalyzerHome() {
  const c = document.getElementById('analyzerContent');
  if (!c) return;
  c.innerHTML = `<div class="analyzer-layout">${analyzerLeftHTML()}${analyzerRightEmptyHTML()}</div>`;
  setTimeout(bindUploadZone, 0);
}
function analyzerLeftHTML() {
  return `<aside class="analyze-left" id="analyzeLeft">
    <h3 class="analyze-h">${L('upload_selfie', 'Upload a selfie for cosmetic guidance')}</h3>
    <p class="analyze-sub">${L('upload_help', 'Your photo is analyzed for cosmetic guidance and is never stored.')}</p>
    <div class="drop-zone" id="uploadZone">
      <div class="photo-preview" id="photoPreview"><span>${L('selfie_preview', 'Selfie preview')}</span></div>
      <input type="file" id="fileInput" accept="image/*" capture="user" style="display:none;" onchange="handleImage(event)">
      <button class="btn btn-secondary" type="button" onclick="document.getElementById('fileInput').click()">${L('choose_photo', 'Choose Photo')}</button>
      <div class="drop-hint">${L('drag_drop', 'Or drag and drop an image here.')}</div>
    </div>
    <ul class="tips">
      <li>${L('tip_light', 'Use natural light and avoid heavy filters.')}</li>
      <li>${L('tip_center', 'Center the area and remove sunglasses or hats.')}</li>
      <li>${L('tip_nodiag', 'DermaGuide does not diagnose medical conditions.')}</li>
      <li>${L('tip_derived', 'Only derived cosmetic metrics are saved.')}</li>
    </ul>
    <button class="btn btn-primary btn-full" onclick="document.getElementById('fileInput').click()">📸 ${L('start_snapshot', 'Start Private Skin Snapshot')}</button>
  </aside>`;
}
function analyzerRightEmptyHTML() {
  return `<section class="analyze-right" id="analyzeRight"><div class="analyze-empty">
    <span class="profile-eyebrow">${L('glow_profile', 'Your Glow Profile')}</span>
    <div class="analyze-empty-icon">🔬</div>
    <div class="analyze-empty-title">${L('results_here', 'Your results appear here')}</div>
    <div class="analyze-empty-sub">${L('results_hint', 'Upload a photo and Lily maps your skin metrics, then builds a routine — all on this page.')}</div>
  </div></section>`;
}
// Put the chosen photo (and, while scanning, the scan overlay) in the left panel.
// When `scanned` is true (analysis complete), overlay a corner-bracket scan
// frame + timestamp badge instead, matching the clinical-analysis reference.
function setAnalyzerPhoto(imgSrc, scanning, caption, substatus, substatusId, scanned) {
  const pv = document.getElementById('photoPreview');
  if (!pv) return;
  const overlay = scanning
    ? `<div class="scan-overlay">${scanFaceHTML(caption, { small: true, substatus, substatusId })}</div>`
    : (scanned ? scanFrameHTML() : '');
  pv.innerHTML = `<img src="${imgSrc}" alt="your photo">${overlay}`;
}

function scanFrameHTML() {
  const ts = new Date().toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `<div class="scan-frame">
    <span class="scan-corner tl"></span><span class="scan-corner tr"></span><span class="scan-corner bl"></span><span class="scan-corner br"></span>
    <span class="scan-timestamp">${L('scanned_at', 'Scanned')}: ${ts}</span>
  </div>`;
}
function setAnalyzerRight(html) { const r = document.getElementById('analyzeRight'); if (r) r.innerHTML = html; }
function closeAnalyzer() { document.getElementById('analyzerModal').classList.remove('active'); }
function scrollToProducts() { document.getElementById('productsSection').scrollIntoView({ behavior: 'smooth' }); }
function scrollToTips() { document.getElementById('tipsSection').scrollIntoView({ behavior: 'smooth' }); }
function scrollToHome() { const c = document.getElementById('lilyCard'); if (c) c.scrollIntoView({ behavior: 'smooth' }); }
function openProfile() { openAuth(); }

// ===========================================================================
// Products + tips rendering
// ===========================================================================
// Storefront browse state (paginated grid + search + concern filter).
const CONCERN_FILTERS = [
  ['all', 'All'], ['acne', 'Acne'], ['dryness', 'Dryness'], ['redness', 'Redness'],
  ['pigmentation', 'Pigmentation'], ['wrinkles', 'Anti-aging'], ['large pores', 'Pores'],
  ['sensitivity', 'Sensitive'], ['oily', 'Oily'],
];
const shop = { page: 1, pages: 1, total: 0, search: '', concern: 'all', loading: false };

async function loadProducts(reset = true) {
  if (shop.loading) return;
  shop.loading = true;
  if (reset) shop.page = 1;
  const params = new URLSearchParams({ page: shop.page, limit: 24 });
  if (shop.search) params.set('search', shop.search);
  if (shop.concern && shop.concern !== 'all') params.set('concern', shop.concern);
  try {
    const data = await api('/products?' + params.toString());
    shop.total = data.total; shop.pages = data.pages;
    State.products = reset ? data.products : State.products.concat(data.products);
    renderProducts();
  } catch (err) {
    console.error('Failed to load products:', err);
  } finally {
    shop.loading = false;
  }
}

function loadMoreProducts() { shop.page += 1; loadProducts(false); }

function renderFilterChips() {
  const el = document.getElementById('filterChips');
  if (!el) return;
  el.innerHTML = CONCERN_FILTERS.map(([k, l]) =>
    `<button class="filter-chip ${k === shop.concern ? 'active' : ''}" onclick="setConcernFilter('${k}')">${l}</button>`).join('');
}

function setConcernFilter(k) { shop.concern = k; renderFilterChips(); loadProducts(true); }

let searchTimer;
function onShopSearch(value) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { shop.search = value.trim(); loadProducts(true); }, 300);
}

// onerror handler that swaps a failed <img> for the product emoji.
function imgFallback(emoji, cls) {
  const e = (emoji || '🧴').replace(/'/g, '');
  return `this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls}',textContent:'${e}'}))`;
}

// Real product image with emoji fallback.
function productImageInner(p) {
  return p.images && p.images.length
    ? `<img src="${p.images[0]}" alt="${(p.name || '').replace(/"/g, '')}" class="product-img" loading="lazy" onerror="${imgFallback(p.emoji, 'product-emoji')}">`
    : `<span class="product-emoji">${p.emoji || '🧴'}</span>`;
}

// Small inline thumbnail (for rec cards) with emoji fallback.
function recThumb(p) {
  return p.images && p.images.length
    ? `<img src="${p.images[0]}" loading="lazy" style="width:2.4rem;height:2.4rem;object-fit:cover;border-radius:8px;display:block;" onerror="${imgFallback(p.emoji, 'rec-emoji')}">`
    : (p.emoji || '🧴');
}

function renderProducts() {
  const container = document.getElementById('productsContainer');
  container.innerHTML = '';

  if (!State.products.length) {
    container.innerHTML = '<div class="empty-grid">No products match your search.</div>';
  } else {
    State.products.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.onclick = () => showProductModal(p);
      card.innerHTML = `
        <div class="product-image">${productImageInner(p)}
          <div class="cert-badges">${p.certs.map((c) => `<span class="cert-badge ${c}">${c.toUpperCase()}</span>`).join('')}</div>
        </div>
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          <div class="product-desc">${p.desc}</div>
          <div class="product-price">$${p.price.toFixed(2)}${p.inStock ? '' : '<span class="out-of-stock">Out of stock</span>'}</div>
        </div>`;
      container.appendChild(card);
    });
  }

  const count = document.getElementById('shopCount');
  if (count) count.textContent = shop.total ? `Showing ${State.products.length} of ${shop.total} products` : '';

  const lm = document.getElementById('shopLoadMore');
  if (lm) lm.innerHTML = shop.page < shop.pages
    ? '<button class="btn btn-primary" onclick="loadMoreProducts()">Load more</button>'
    : '';

  if (shop.page === 1) renderHomeProducts();
}

// Compact "Top Picks" strip on the home/shop surface (real catalogue items).
function renderHomeProducts() {
  const el = document.getElementById('homeProducts');
  if (!el) return;
  const picks = State.products.slice(0, 4);
  el.innerHTML = picks.length ? picks.map((p) => `
    <div class="home-product-card" onclick='showProductModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
      <div class="home-product-img">${productImageInner(p)}</div>
      <div class="home-product-brand">${p.brand || 'DermaGuide'}</div>
      <div class="home-product-name">${p.name}</div>
      <div class="home-product-price">$${p.price.toFixed(2)}</div>
      <button class="btn btn-dark btn-small btn-full" onclick="event.stopPropagation(); addToCart('${p.id}', this)">${L('add_cart', 'Add to Cart')}</button>
    </div>`).join('') : `<div class="empty-grid" style="padding:1.2rem;">${L('loading_products', 'Loading products…')}</div>`;
}

// Cache the last analysis's headline metrics for the home "Recent Skin
// Health" card (client-side only — no extra backend endpoint needed).
function cacheSkinHealth(result) {
  try {
    const metrics = result.metrics || {};
    const defs = (result.metricDefs && result.metricDefs.length)
      ? result.metricDefs
      : Object.keys(metrics).map((k) => ({ key: k, label: k }));
    localStorage.setItem('dg_last_health', JSON.stringify({ metrics, defs, at: Date.now() }));
  } catch (e) { /* ignore quota errors */ }
  renderSkinHealth();
}

function renderSkinHealth() {
  const el = document.getElementById('skinHealthCard');
  if (!el) return;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem('dg_last_health') || 'null'); } catch (e) { /* ignore */ }
  if (!cached || !cached.metrics) {
    el.innerHTML = `<div class="skin-health-empty">
      <span>${L('no_scan_yet', "You haven't scanned your skin yet.")}</span>
      <button class="btn btn-secondary btn-small" onclick="openAnalyzer()">📸 ${L('start_snapshot', 'Start Private Skin Snapshot')}</button>
    </div>`;
    return;
  }
  const defs = localizeDefs(cached.defs).slice(0, 3);
  el.innerHTML = `<div class="health-bars">${defs.map(({ key, label }) => {
    // Home shows a positive "health" %: invert the concern score (higher = healthier).
    const pct = Math.max(5, Math.min(99, Math.round(100 - (cached.metrics[key] || 0) * 9)));
    return `<div class="health-item">
      <div class="health-top"><span class="health-icon">${healthIcon(key)}</span><span class="health-label">${label}</span><span class="health-pct">${pct}%</span></div>
      <div class="bar"><span style="width:${pct}%"></span></div></div>`;
  }).join('')}
  <div class="health-note">${L('based_on_last', 'Based on your last analysis.')}</div></div>`;
}
function healthIcon(key) {
  const k = (key || '').toLowerCase();
  if (k.includes('hydr') || k.includes('moist') || k.includes('dehydr')) return '💧';
  if (k.includes('clar') || k.includes('radi') || k.includes('tone') || k.includes('pigment')) return '✨';
  if (k.includes('text') || k.includes('pore')) return '🧴';
  if (k.includes('oil') || k.includes('sebum')) return '🫧';
  if (k.includes('acne') || k.includes('red') || k.includes('sensit')) return '🌿';
  return '🌿';
}

function renderTips() {
  const grid = document.getElementById('tipsGrid');
  grid.innerHTML = '';
  tips.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'tip-card';
    card.innerHTML = `<div class="tip-icon">${t.icon}</div><div class="tip-title">${t.title}</div><div class="tip-text">${t.text}</div>`;
    grid.appendChild(card);
  });
}

function findProduct(id) { return State.products.find((p) => p.id === id); }

function showProductModal(product) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><div class="modal-handle"></div><h2 class="modal-title">${product.name}</h2></div>
      <div class="modal-body">
        ${product.images && product.images.length
          ? `<img src="${product.images[0]}" class="modal-main-img" id="modalMainImg" onerror="this.onerror=null;this.style.display='none'">
             ${product.images.length > 1 ? `<div class="modal-gallery">${product.images.map((u, i) => `<img src="${u}" class="modal-thumb${i === 0 ? ' active' : ''}" onclick="document.getElementById('modalMainImg').src=this.src;document.getElementById('modalMainImg').style.display='';this.parentNode.querySelectorAll('.modal-thumb').forEach(t=>t.classList.remove('active'));this.classList.add('active')">`).join('')}</div>` : ''}`
          : `<div style="font-size:5rem;text-align:center;margin:1rem 0;">${product.emoji}</div>`}
        ${product.brand ? `<div style="font-size:.85rem;color:var(--sage);font-weight:600;margin-bottom:.3rem;">${product.brand}</div>` : ''}
        <p style="font-size:1.1rem;margin-bottom:1rem;">${product.desc}</p>
        <div style="font-size:2rem;font-weight:700;color:var(--clay);margin-bottom:1.5rem;">$${product.price.toFixed(2)}</div>
        ${product.reason ? `<div class="rec-reason" style="margin-bottom:1rem;">💡 <strong>Why for you:</strong> ${product.reason}</div>` : ''}
        ${product.keyIngredients?.length ? `<h3 style="margin-bottom:.6rem;color:var(--forest);">Key Ingredients</h3>
          <div style="display:flex;gap:.5rem;margin-bottom:1.2rem;flex-wrap:wrap;">${product.keyIngredients.map((i) => `<span class="cert-badge" style="background:var(--sand);color:var(--forest);">${i}</span>`).join('')}</div>` : ''}
        ${product.howToUse ? `<h3 style="margin-bottom:.6rem;color:var(--forest);">How to Use</h3><p style="margin-bottom:1.2rem;line-height:1.6;">${product.howToUse}</p>` : ''}
        <h3 style="margin-bottom:.8rem;color:var(--forest);">Certifications</h3>
        <div style="display:flex;gap:.5rem;margin-bottom:1.5rem;flex-wrap:wrap;">
          ${product.certs.map((c) => `<span class="cert-badge ${c}">${c.toUpperCase()}</span>`).join('')}
        </div>
        <button class="btn btn-primary btn-full" ${product.inStock ? '' : 'disabled style="opacity:.5"'} onclick="addToCart('${product.id}', this)">
          ${product.inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ===========================================================================
// Auth
// ===========================================================================
function setAuth(token, user) {
  State.token = token;
  State.user = user;
  localStorage.setItem('pg_token', token);
  localStorage.setItem('pg_user', JSON.stringify(user));
  updateAuthUI();
}
function clearAuth() {
  State.token = null; State.user = null;
  localStorage.removeItem('pg_token'); localStorage.removeItem('pg_user');
  State.cartCount = 0; updateCartCount();
  updateAuthUI();
}
function updateAuthUI() {
  const link = document.getElementById('authLink');
  link.textContent = State.user ? `Hi, ${State.user.name || State.user.email.split('@')[0]} ▾` : (window.t ? window.t('sign_in') : 'Sign In');
}

function openAuth() {
  if (State.user) return openAccount();
  renderAuthModal('login');
}

function renderAuthModal(mode) {
  document.querySelectorAll('.modal.auth-modal').forEach((m) => m.remove());
  const modal = document.createElement('div');
  modal.className = 'modal auth-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  const isLogin = mode === 'login';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><div class="modal-handle"></div><h2 class="modal-title">${isLogin ? 'Welcome Back' : 'Create Account'}</h2></div>
      <div class="modal-body">
        ${isLogin ? '' : '<div class="form-group"><label class="form-label">Name</label><input class="form-input" id="authName" placeholder="Your name"></div>'}
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="authEmail" type="email" placeholder="you@example.com"></div>
        <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="authPassword" type="password" placeholder="${isLogin ? 'Your password' : 'At least 8 characters'}"></div>
        <div class="form-error" id="authError"></div>
        <button class="btn btn-primary btn-full" id="authSubmit">${isLogin ? 'Sign In' : 'Sign Up'}</button>
        <div class="form-switch">
          ${isLogin ? "No account?" : 'Already have an account?'}
          <button id="authSwitch">${isLogin ? 'Sign up' : 'Sign in'}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('authSwitch').onclick = () => renderAuthModal(isLogin ? 'register' : 'login');
  document.getElementById('authSubmit').onclick = () => submitAuth(mode, modal);
  document.getElementById('authPassword').addEventListener('keypress', (e) => { if (e.key === 'Enter') submitAuth(mode, modal); });
}

async function submitAuth(mode, modal) {
  const errEl = document.getElementById('authError');
  errEl.textContent = '';
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName')?.value.trim();
  try {
    const path = mode === 'login' ? '/auth/login' : '/auth/register';
    const { token, user } = await api(path, { method: 'POST', body: { email, password, name } });
    setAuth(token, user);
    modal.remove();
    toast(`Welcome${user.name ? ', ' + user.name : ''}! 🌿`);
    await loadCart();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

function openAccount() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  const isAdmin = State.user?.role === 'admin';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><div class="modal-handle"></div><h2 class="modal-title">My Account</h2></div>
      <div class="modal-body">
        <p style="margin-bottom:1rem;"><strong>${State.user.name || ''}</strong><br><span style="opacity:.7;">${State.user.email}</span></p>
        <button class="btn btn-primary btn-full" style="margin-bottom:.8rem;" onclick="this.closest('.modal').remove(); showOrders();">📦 My Orders</button>
        ${isAdmin ? '<button class="btn btn-primary btn-full" style="margin-bottom:.8rem;background:var(--clay);" onclick="this.closest(\'.modal\').remove(); openAdmin();">🛠️ Admin Dashboard</button>' : ''}
        <button class="btn btn-full" style="background:var(--sand);" onclick="this.closest('.modal').remove(); clearAuth(); toast('Signed out');">Sign Out</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function showOrders() {
  let html = '<div class="empty-state">Loading…</div>';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="modal-content"><div class="modal-header"><div class="modal-handle"></div><h2 class="modal-title">My Orders</h2></div><div class="modal-body" id="ordersBody">${html}</div></div>`;
  document.body.appendChild(modal);
  try {
    const { orders } = await api('/orders');
    const body = document.getElementById('ordersBody');
    if (!orders.length) { body.innerHTML = '<div class="empty-state">No orders yet 🛍️</div>'; return; }
    body.innerHTML = orders.map((o) => `
      <div style="border:1px solid var(--sand);border-radius:12px;padding:1rem;margin-bottom:1rem;">
        <div style="display:flex;justify-content:space-between;"><strong>$${o.total.toFixed(2)}</strong><span style="text-transform:capitalize;color:var(--sage);">${o.status}</span></div>
        <div style="font-size:.85rem;opacity:.7;margin-top:.4rem;">${o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</div>
        <div style="font-size:.75rem;opacity:.5;margin-top:.3rem;">${new Date(o.createdAt).toLocaleString()}</div>
      </div>`).join('');
  } catch (err) {
    document.getElementById('ordersBody').innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

// ===========================================================================
// Cart
// ===========================================================================
function updateCartCount() {
  const el = document.getElementById('cartCount');
  el.textContent = State.cartCount || '';
  el.dataset.count = State.cartCount || 0;
}

async function loadCart() {
  if (!State.token) { State.cartCount = 0; updateCartCount(); return; }
  try {
    const cart = await api('/cart');
    State.cartCount = cart.count;
    updateCartCount();
  } catch (_) { /* token may be stale */ }
}

async function addToCart(productId, btn) {
  if (!State.token) { toast('Please sign in to shop 🌿'); openAuth(); return; }
  try {
    const cart = await api('/cart/items', { method: 'POST', body: { productId, quantity: 1 } });
    State.cartCount = cart.count;
    updateCartCount();
    if (btn) { btn.textContent = 'Added to Cart ✓'; btn.style.opacity = '0.7'; }
    toast('Added to cart 🛒');
  } catch (err) { toast(err.message); }
}

async function openCart() {
  if (!State.token) { toast('Please sign in to view your cart'); openAuth(); return; }
  const modal = document.createElement('div');
  modal.className = 'modal cart-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="modal-content"><div class="modal-header"><div class="modal-handle"></div><h2 class="modal-title">Your Cart</h2></div><div class="modal-body" id="cartBody"><div class="empty-state">Loading…</div></div></div>`;
  document.body.appendChild(modal);
  await renderCartBody();
}

async function renderCartBody() {
  const body = document.getElementById('cartBody');
  if (!body) return;
  const cart = await api('/cart');
  State.cartCount = cart.count; updateCartCount();

  if (!cart.items.length) { body.innerHTML = '<div class="empty-state">Your cart is empty 🛍️</div>'; return; }

  const tax = +(cart.subtotal * 0.08).toFixed(2);
  const shipping = cart.subtotal >= 50 ? 0 : 5.99;
  const total = +(cart.subtotal + tax + shipping).toFixed(2);

  body.innerHTML = `
    ${cart.items.map((i) => `
      <div class="cart-item">
        <div class="cart-item-emoji">${i.product.images && i.product.images.length ? `<img src="${i.product.images[0]}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;">` : i.product.emoji}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${i.product.name}</div>
          <div class="cart-item-price">$${i.lineTotal.toFixed(2)}</div>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty('${i.product.id}', ${i.quantity - 1})">−</button>
          <span>${i.quantity}</span>
          <button class="qty-btn" onclick="changeQty('${i.product.id}', ${i.quantity + 1})">+</button>
        </div>
      </div>`).join('')}
    <div class="cart-summary">
      <div class="cart-summary-row"><span>Subtotal</span><span>$${cart.subtotal.toFixed(2)}</span></div>
      <div class="cart-summary-row"><span>Tax (8%)</span><span>$${tax.toFixed(2)}</span></div>
      <div class="cart-summary-row"><span>Shipping</span><span>${shipping === 0 ? 'FREE' : '$' + shipping.toFixed(2)}</span></div>
      <div class="cart-summary-row cart-summary-total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
    </div>
    <button class="btn btn-primary btn-full" style="margin-top:1rem;" onclick="openCheckout()">Checkout</button>`;
}

async function changeQty(productId, quantity) {
  try {
    if (quantity < 1) await api(`/cart/items/${productId}`, { method: 'DELETE' });
    else await api(`/cart/items/${productId}`, { method: 'PATCH', body: { quantity } });
    await renderCartBody();
  } catch (err) { toast(err.message); }
}

async function openCheckout() {
  document.querySelectorAll('.modal.cart-modal').forEach((m) => m.remove());
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><div class="modal-handle"></div><h2 class="modal-title">Checkout</h2></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="coName" value="${State.user?.name || ''}"></div>
        <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="coLine1" placeholder="Street address"></div>
        <div class="form-group"><label class="form-label">City</label><input class="form-input" id="coCity"></div>
        <div class="form-group"><label class="form-label">Postal Code</label><input class="form-input" id="coZip"></div>
        <div class="form-error" id="coError"></div>
        <div id="payArea"><div class="empty-state">Loading payment options…</div></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  await renderPaymentOptions();
}

function shippingAddressFromForm() {
  return {
    name: document.getElementById('coName').value.trim(),
    line1: document.getElementById('coLine1').value.trim(),
    city: document.getElementById('coCity').value.trim(),
    postalCode: document.getElementById('coZip').value.trim(),
  };
}

async function renderPaymentOptions() {
  const area = document.getElementById('payArea');
  let cfg = {};
  try { cfg = await api('/payments/config'); } catch (_) { /* fall back to demo */ }

  if (cfg.paypal && cfg.paypal.enabled && cfg.paypal.clientId) {
    area.innerHTML = `
      <p style="font-size:.82rem;opacity:.7;margin-bottom:.8rem;">Pay with PayPal or credit/debit card:</p>
      <div id="paypal-buttons"></div>`;
    loadPayPalSdk(cfg.paypal.clientId, cfg.paypal.currency).then(renderPayPalButtons).catch(() => {
      area.innerHTML = demoCheckoutHTML();
    });
  } else {
    area.innerHTML = demoCheckoutHTML();
  }
}

function demoCheckoutHTML() {
  return `<p style="font-size:.8rem;opacity:.6;margin-bottom:1rem;">💳 Demo checkout — payment is simulated (PayPal not configured).</p>
    <button class="btn btn-primary btn-full" onclick="submitCheckout(this)">Place Order</button>`;
}

let paypalSdkPromise = null;
function loadPayPalSdk(clientId, currency) {
  if (window.paypal) return Promise.resolve();
  if (paypalSdkPromise) return paypalSdkPromise;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency || 'USD')}&enable-funding=card`;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return paypalSdkPromise;
}

function renderPayPalButtons() {
  if (!window.paypal) return;
  window.paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'paypal' },
    createOrder: async () => {
      const { id } = await api('/payments/paypal/create-order', { method: 'POST', body: {} });
      return id;
    },
    onApprove: async (data) => {
      try {
        const { order } = await api('/payments/paypal/capture', {
          method: 'POST',
          body: { orderID: data.orderID, shippingAddress: shippingAddressFromForm() },
        });
        document.querySelectorAll('.modal').forEach((m) => m.remove());
        State.cartCount = 0; updateCartCount();
        toast(`Payment complete! 🎉 Order $${order.total.toFixed(2)}`);
      } catch (err) {
        document.getElementById('coError').textContent = err.message;
      }
    },
    onError: (err) => {
      const el = document.getElementById('coError');
      if (el) el.textContent = 'Payment error. Please try again.';
      console.error('PayPal error:', err);
    },
  }).render('#paypal-buttons');
}

async function submitCheckout(btn) {
  btn.disabled = true; btn.innerHTML = '<span class="loading"></span>';
  const shippingAddress = {
    name: document.getElementById('coName').value.trim(),
    line1: document.getElementById('coLine1').value.trim(),
    city: document.getElementById('coCity').value.trim(),
    postalCode: document.getElementById('coZip').value.trim(),
  };
  try {
    const { order } = await api('/orders/checkout', { method: 'POST', body: { shippingAddress } });
    document.querySelectorAll('.modal').forEach((m) => m.remove());
    State.cartCount = 0; updateCartCount();
    toast(`Order placed! 🎉 Total $${order.total.toFixed(2)}`);
  } catch (err) {
    document.getElementById('coError').textContent = err.message;
    btn.disabled = false; btn.textContent = 'Place Order';
  }
}

// ===========================================================================
// Chat (streaming SSE)
// ===========================================================================
// Chat row markup: Lily avatar + labelled bubble (assistant) / plain bubble (user).
function chatRowHTML(role, bodyHTML, bubbleAttrs = '') {
  const label = role === 'assistant' ? 'Lily' : 'You';
  const avatar = role === 'assistant' ? `<div class="message-avatar">${LILY_IMG}</div>` : '';
  return `${avatar}<div class="message-col"><div class="message-label">${label}</div><div class="message-bubble"${bubbleAttrs ? ' ' + bubbleAttrs : ''}>${bodyHTML}</div></div>`;
}
// Chat image-analysis preview: the photo with an "Analyzing…" overlay + progress bar.
function chatAnalyzeCardHTML(thumbUrl, caption, substatus, substatusId) {
  return `<div class="chat-analyze-card">
    <img src="${thumbUrl}" alt="">
    <div class="chat-analyze-overlay">
      <div class="chat-analyze-label">${caption}</div>
      <div class="chat-progress"><span></span></div>
      ${substatus ? `<div class="chat-analyze-sub" id="${substatusId || ''}">${substatus}</div>` : ''}
    </div>
  </div>`;
}
function addMessage(role, content) {
  const container = document.getElementById('chatMessages');
  const prev = document.getElementById('lastMsg');
  if (prev) prev.removeAttribute('id');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  if (role === 'assistant') div.id = 'lastMsg';
  div.innerHTML = chatRowHTML(role, content);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  const sendBtn = document.getElementById('sendBtn');

  addMessage('user', msg);
  input.value = '';
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="loading"></span>';

  const assistantDiv = addMessage('assistant', '<span class="loading"></span>');
  const bubble = assistantDiv.querySelector('.message-bubble');
  let full = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(State.token ? { Authorization: `Bearer ${State.token}` } : {}) },
      body: JSON.stringify({ message: msg, skinContext: State.skinAnalysisContext }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let recommendations = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        const evLine = frame.split('\n').find((l) => l.startsWith('event:'));
        const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const event = evLine ? evLine.slice(6).trim() : 'message';
        const data = JSON.parse(dataLine.slice(5).trim());

        if (event === 'token') { full += data.delta; bubble.textContent = full; }
        else if (event === 'recommendations') recommendations = data.products;
        else if (event === 'done') { bubble.textContent = data.full || full; }
        else if (event === 'error') { bubble.textContent = data.message; }
        document.getElementById('chatMessages').scrollTop = 1e9;
      }
    }

    if (recommendations && recommendations.length) showRecommendations(recommendations);
  } catch (err) {
    bubble.textContent = "Sorry, I'm having trouble connecting. Please try again.";
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = '➤';
  }
}

function showRecommendations(recs) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message assistant';
  const title = recs.length === 1 ? 'I recommend this product:' : `I recommend these ${recs.length} products:`;
  div.innerHTML = `
    <div class="rec-products">
      <div class="rec-title">${title}</div>
      <div class="rec-carousel">
        ${recs.map((p) => `
          <div class="rec-card" onclick='showProductModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
            <div class="rec-emoji">${recThumb(p)}</div>
            <div class="rec-name">${p.name}</div>
            <div style="font-size:.75rem;opacity:.7;margin:.3rem 0;">Great for ${(p.concerns[0] || 'your skin')}</div>
            <div class="rec-price">$${p.price.toFixed(2)}</div>
          </div>`).join('')}
      </div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function triggerChatImageUpload() { document.getElementById('chatImageInput').click(); }

// Quick-action chip above the chat input: fills the box and sends.
function chatQuickPrompt(text) {
  const input = document.getElementById('chatInput');
  if (input) { input.value = text; sendMessage(); }
}

// ===========================================================================
// Skin analysis (chat + standalone) — backend agents + client ML overlay
// ===========================================================================
async function runAnalysis(file, { onStatus } = {}) {
  // Run client-side ML in parallel for cross-validation overlay.
  const mlPromise = analyzeWithMLModels(file).catch(() => null);

  const form = new FormData();
  form.append('image', file);

  const mlResults = await mlPromise;
  if (onStatus) onStatus(mlResults);
  if (mlResults) {
    form.append('mlValidation', JSON.stringify({
      validated: mlResults.faceDetected || mlResults.skinRegionDetected,
      confidence: mlResults.confidence,
      faceDetected: mlResults.faceDetected,
    }));
  }

  const result = await api('/analysis', { method: 'POST', body: form, isForm: true });
  State.skinAnalysisContext = {
    bodyPart: result.bodyPart,
    skinType: result.skinType,
    topConcerns: result.topConcerns,
    metrics: result.metrics,
    timestamp: new Date().toISOString(),
  };
  return { result, mlResults };
}

async function handleChatImage(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || !file.type.startsWith('image/')) return;
  State.currentImageFile = file;

  const container = document.getElementById('chatMessages');
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  const thumbUrl = URL.createObjectURL(file);
  userMsg.innerHTML = chatRowHTML('user', `
    <img src="${thumbUrl}" alt="uploaded photo" style="display:block;max-width:170px;width:100%;border-radius:12px;margin-bottom:.5rem;">
    📸 ${L('uploaded_photo', 'Uploaded a photo for skin analysis')}`);
  container.appendChild(userMsg);

  // Pre-validate skin presence in-browser before hitting the model.
  const pre = await preValidateSkinImage(file);
  if (!pre.valid) {
    const err = document.createElement('div');
    err.className = 'message assistant';
    err.innerHTML = chatRowHTML('assistant', `
      <div style="font-size:1.2rem;margin-bottom:.5rem;">🙈 I can't see any skin in this photo!</div>
      <p style="margin:0;">${pre.message}</p>
      <button class="btn btn-primary btn-full" style="margin-top:1rem;" onclick="triggerChatImageUpload()">📸 Upload a Different Photo</button>`);
    container.appendChild(err);
    container.scrollTop = container.scrollHeight;
    return;
  }

  const analyzing = document.createElement('div');
  analyzing.className = 'message assistant';
  analyzing.id = 'analyzingMsg';
  analyzing.innerHTML = chatRowHTML('assistant', chatAnalyzeCardHTML(
    thumbUrl,
    L('analyzing_short', 'Analyzing…'),
    `✅ ${L('skin_detected', 'Skin detected')} (${Math.round(pre.skinPercentage)}%) • 🤖 LLM • 🧬 ML`,
    'chatMlStatus',
  ));
  container.appendChild(analyzing);
  container.scrollTop = container.scrollHeight;

  try {
    const { result, mlResults } = await runAnalysis(file, {
      onStatus: (ml) => {
        const el = document.getElementById('chatMlStatus');
        if (el && ml) el.innerHTML = `✅ Skin detected (${Math.round(pre.skinPercentage)}%) • 🤖 LLM Vision • 🧬 ML Ready (${Math.round((ml.confidence || 0) * 100)}%)`;
      },
    });
    document.getElementById('analyzingMsg')?.remove();
    displayChatAnalysis(result, mlResults);
  } catch (err) {
    document.getElementById('analyzingMsg')?.remove();
    if (err.code === 'not_human_skin') {
      addMessage('assistant', `🚫 ${err.message} <br><br><button class="btn btn-primary btn-full" onclick="triggerChatImageUpload()">📸 Upload a Different Photo</button>`);
      return;
    }
    const detail = err.raw ? `<div style="font-size:.75rem;opacity:.6;margin-top:.5rem;white-space:pre-wrap;">Model said: ${err.raw.substring(0, 200)}…</div>` : '';
    addMessage('assistant', `${err.message || 'Sorry, I could not analyze the photo. Please try again.'}${detail}`);
  }
}

// i18n helpers for analysis output (metric/body-part/skin-type labels).
function L(key, fallback) { return window.tLabel ? window.tLabel(key, fallback) : (fallback || key); }
function localizeDefs(defs) {
  return (defs || []).map((d) => ({ key: d.key, label: L('m_' + d.key, d.label) }));
}
function localizedTopConcerns(metrics, defs) {
  const labelOf = {};
  (defs || []).forEach((d) => { labelOf[d.key] = L('m_' + d.key, d.label); });
  return Object.entries(metrics || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${labelOf[k] || k} (${v}/10)`)
    .join(', ');
}
function localizedSubtitle(result) {
  const partKey = 'bp_' + String(result.bodyPartCategory || result.bodyPart || 'skin').toLowerCase();
  const skinKey = 'st_' + String(result.skinType || 'normal').toLowerCase();
  return `${L(partKey, cap(result.bodyPart))} · ${L(skinKey, cap(result.skinType))}`;
}

function metricsGridHTML(metrics, metricDefs) {
  const defs = localizeDefs(metricDefs && metricDefs.length
    ? metricDefs
    : Object.keys(metrics).map((k) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()) })));
  return defs.map(({ key, label }) => {
    const value = metrics[key] || 0;
    const severity = value < 4 ? 'low' : value < 7 ? 'medium' : 'high';
    return `<div class="metric-item">
      <div class="metric-row"><span class="metric-label">${label}</span><span class="metric-score severity-${severity}">${value}/10</span></div>
      <div class="meter sev-${severity}"><span style="width:${value * 10}%"></span></div>
    </div>`;
  }).join('');
}

// Overall skin-wellness score (0-100). Metrics are *concern* scores where
// higher = more of an issue, so we invert the average into a positive score.
function overallScore(metrics) {
  const vals = Object.values(metrics || {}).filter((v) => typeof v === 'number');
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length; // 0-10
  return Math.max(12, Math.min(99, Math.round(100 - avg * 9)));
}

// Conic score-ring gauge shown in the analysis header (matches dashboard style).
function scoreRingHTML(metrics) {
  const s = overallScore(metrics);
  if (s == null) return '';
  return `<div class="score-ring" style="--pct:${s}%" title="${L('overall_score', 'Overall skin score')}">
    <span>${s}<small>${L('score_lbl', 'SCORE')}</small></span></div>`;
}

// "Your Glow Profile" eyebrow chip (matches the reference results panel).
function profileEyebrowHTML() {
  return `<span class="profile-eyebrow">${L('glow_profile', 'Your Glow Profile')}</span>`;
}

// One-tap "add the whole recommended routine to cart" bar.
function routineCtaHTML(recs) {
  if (!recs || !recs.length) return '';
  const ids = recs.map((p) => p._id || p.id).filter(Boolean);
  if (!ids.length) return '';
  return `<div class="routine-cta">
    <div><div class="routine-cta-title">${L('your_routine', 'Your recommended routine')}</div>
      <div class="routine-cta-sub">${L('routine_steps', 'Cleanse → Treat → Moisturize → SPF')}</div></div>
    <button class="btn btn-primary" onclick='addRoutineToCart(${JSON.stringify(ids)})'>🛒 ${L('add_routine', 'Add Full Routine to Cart')}</button>
  </div>`;
}

// Add every recommended product to the cart in one tap.
async function addRoutineToCart(ids) {
  if (!State.token) { toast(L('signin_shop', 'Please sign in to shop 🌿')); openAuth(); return; }
  let added = 0;
  for (const id of ids || []) {
    try { const cart = await api('/cart/items', { method: 'POST', body: { productId: id, quantity: 1 } }); State.cartCount = cart.count; added += 1; } catch (e) { /* skip */ }
  }
  updateCartCount();
  toast(added ? `${L('routine_added', 'Routine added to cart')} 🛒 (${added})` : L('routine_fail', 'Could not add routine'));
}

// Expandable per-metric detail rows (status word + AI agent note), used in
// the standalone analyzer's results panel.
function metricDetailHTML(metrics, metricDefs, analysisId) {
  const defs = localizeDefs(metricDefs && metricDefs.length
    ? metricDefs
    : Object.keys(metrics).map((k) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()) })));
  return `<div class="metric-detail-list">${defs.map(({ key, label }, i) => {
    const value = metrics[key] || 0;
    const severity = value < 4 ? 'low' : value < 7 ? 'medium' : 'high';
    const statusWord = severity === 'low' ? L('status_optimal', 'Optimal') : severity === 'medium' ? L('status_watch', 'Monitor') : L('status_attention', 'Needs attention');
    const note = metricAgentNote(label, severity);
    return `<div class="metric-row-x${i === 0 ? ' expanded' : ''}" id="mrow-${analysisId}-${key}">
      <button class="metric-row-head" onclick="toggleMetricRow('${analysisId}','${key}')">
        <span class="metric-row-title">${label} <em>(${statusWord})</em></span>
        <span class="metric-row-score severity-${severity}">${value}/10</span>
        <span class="metric-chevron">⌄</span>
      </button>
      <div class="metric-row-body">
        <div class="agent-tag">${L('agent_from', 'Agent')}: ${L('agent_analyzer', "the 'Analyzer'")}</div>
        <p>${note}</p>
      </div>
    </div>`;
  }).join('')}</div>`;
}
function toggleMetricRow(analysisId, key) {
  const row = document.getElementById(`mrow-${analysisId}-${key}`);
  if (row) row.classList.toggle('expanded');
}
function metricAgentNote(label, severity) {
  const m = label.toLowerCase();
  const tpl = severity === 'low' ? L('note_low', 'Your {m} levels are optimal. Your current routine is working — continue it.')
    : severity === 'medium' ? L('note_medium', 'Your {m} could use a little more attention. Small, consistent steps will help.')
    : L('note_high', 'Your {m} shows a notable concern. Prioritize products and habits that target this.');
  return tpl.replace('{m}', m);
}

// AI reviewer's note — a short pass/flag summary from the reviewer agent
// that cross-checks every analysis before it's shown.
function reviewerNoteHTML(result) {
  const verdict = result.reviewerVerdict || 'PASS';
  const text = verdict === 'PASS'
    ? L('reviewer_pass', 'The overall analysis indicates a healthy skin profile. Focus on the routine below and keep tracking your progress.')
    : L('reviewer_revise', 'This analysis flagged some inconsistencies — treat the scores as a rough guide and consider a follow-up scan in better lighting.');
  return `<div class="reviewer-card">
    <div class="reviewer-badge">🎖️</div>
    <div>
      <div class="reviewer-title">${L('reviewers_note', "Reviewer's Note")}</div>
      <p class="reviewer-text">${text}</p>
      <div class="reviewer-sign">— ${L('ai_reviewer', 'AI Reviewer')}</div>
    </div>
  </div>`;
}

// Prominent banner when the AI flags a condition needing a professional.
function medicalBannerHTML(result) {
  if (!result.medicalFlag) return '';
  const advice = result.medicalAdvice || 'Some signs here may need a doctor or dermatologist. Please consult a professional for a proper diagnosis.';
  return `<div style="margin:1rem 0;padding:1rem;border-radius:12px;background:linear-gradient(135deg,#ffebee,#ffcdd2);border:2px solid #e53935;">
    <div style="display:flex;align-items:center;gap:.5rem;font-weight:700;color:#c62828;margin-bottom:.3rem;"><span style="font-size:1.3rem;">⚕️</span> ${L('see_pro', 'Please see a professional')}</div>
    <div style="font-size:.9rem;color:#5d4037;">${advice}</div>
  </div>`;
}

function recCarouselHTML(title, recs) {
  return `<div class="rec-products"><div class="rec-title">${title}</div><div class="rec-carousel">
    ${recs.map((p) => `<div class="rec-card" onclick='showProductModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
      <div class="rec-emoji">${recThumb(p)}</div><div class="rec-name">${p.name}</div>
      <div class="rec-price">$${p.price.toFixed(2)}</div></div>`).join('')}
  </div></div>`;
}

/**
 * Detailed recommendations — HORIZONTAL scroll of cards with a large product
 * image (≥ shop card size), keeping the "Why" + "How to use".
 */
// Presentational match % derived from the recommender's own ranking order
// (item 0 = strongest match) — not a separately-computed score.
function matchScoreFor(index) { return Math.max(70, 96 - index * 4); }

function recDetailHTML(title, recs) {
  return `<div class="rec-products"><div class="rec-title">${title}</div>
    <div class="rec-hscroll">
      ${recs.map((p, i) => `<div class="rec-vcard" onclick='showProductModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
        <div class="rec-vcard-img">${p.images && p.images.length
          ? `<img src="${p.images[0]}" loading="lazy" onerror="${imgFallback(p.emoji, 'product-emoji')}">`
          : `<span class="product-emoji">${p.emoji || '🧴'}</span>`}</div>
        <div class="rec-vcard-body">
          <div class="rec-name">${p.name}</div>
          <div class="rec-match"><span class="rec-match-label">${L('match_score', 'Match Score')}</span><span class="rec-match-score">${matchScoreFor(i)}% ${L('match', 'Match')}</span></div>
          <div class="rec-price">$${p.price.toFixed(2)}</div>
          ${p.reason ? `<div class="rec-reason">💡 <strong>${L('rec_why', 'Why')}:</strong> ${p.reason}</div>` : ''}
          ${p.howToUse ? `<div class="rec-howto">📋 <strong>${L('rec_how', 'How to use')}:</strong> ${p.howToUse}</div>` : ''}
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

function displayChatAnalysis(result, mlResults) {
  const { analysisId, bodyPart, skinType, metrics, topConcerns, recommendation, recommendedProducts, metricDefs } = result;
  // ML cross-check is FACE ONLY.
  const ml = result.isFace ? mlResults : null;
  const canvasId = 'canvas-' + analysisId;
  analysisStore[analysisId] = { metrics, skinType, mlResults: ml, canvasId, metricDefs, view: 'chat' };
  cacheSkinHealth(result);
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message assistant';
  div.innerHTML = chatRowHTML('assistant', `
      <div class="pro-analysis">
        <div class="analysis-header"><div class="analysis-head-row">
          <div>${profileEyebrowHTML()}<h3>${L('pro_analysis', 'Professional Skin Analysis')}</h3>
          <div class="analysis-subtitle">${localizedSubtitle(result)}</div></div>
          ${scoreRingHTML(metrics)}
        </div></div>
        ${medicalBannerHTML(result)}
        <h4 class="radar-heading">${L('radar_title', 'Skin Health Radar Chart')}</h4>
        <div class="radar-container"><canvas id="${canvasId}" width="400" height="400"></canvas></div>
        <div class="metrics-grid" id="grid-${analysisId}">${metricsGridHTML(metrics, metricDefs)}</div>
        <div class="analysis-summary"><div class="summary-title">${L('top_concerns', 'Top Concerns')}</div><div>${localizedTopConcerns(metrics, metricDefs) || topConcerns}</div></div>
        <div class="analysis-summary"><div class="summary-title">${L('pro_rec', 'Professional Recommendation')}</div><div>${recommendation || '—'}</div></div>
        ${ml && ml.mlConcerns ? `<div class="ml-status-box"><div style="display:flex;align-items:center;gap:.5rem;font-size:.9rem;">
          <span>✅</span><span class="ml-status-title">${L('ml_active', 'ML Cross-Validation Active')}</span>
          <span class="ml-confidence-badge">${Math.round((ml.confidence || 0) * 100)}% confidence</span></div></div>` : ''}
        ${feedbackSectionHTML(analysisId)}
      </div>`);
  container.appendChild(div);
  if (recommendedProducts?.length) container.appendChild(wrapMessage(recDetailHTML(L('tailored_recs', 'Tailored Product Recommendations'), recommendedProducts) + routineCtaHTML(recommendedProducts)));
  container.scrollTop = container.scrollHeight;
  setTimeout(() => drawRadarChart(canvasId, metrics, localizeDefs(metricDefs), ml), 300);
}

function wrapMessage(innerHTML) {
  const d = document.createElement('div');
  d.className = 'message assistant';
  d.innerHTML = chatRowHTML('assistant', innerHTML);
  return d;
}
function cap(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1); }

function feedbackSectionHTML(analysisId) {
  return `<div class="feedback-section" id="feedback-${analysisId}">
    <div class="feedback-title">${L('accurate_q', 'Is this analysis accurate?')}</div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;">
      <button class="btn btn-primary" style="flex:1;min-width:140px;" onclick="confirmAnalysis('${analysisId}')">${L('looks_accurate', '✓ Looks accurate')}</button>
      <button class="btn" style="flex:1;min-width:140px;background:var(--sand);color:var(--forest);" onclick="adjustAnalysis('${analysisId}')">${L('adjust_scores', '✎ Adjust scores')}</button>
    </div>
    <div style="font-size:.72rem;opacity:.6;margin-top:.6rem;text-align:center;">${L('feedback_train', 'Your feedback continuously trains the analyzer.')}</div>
  </div>`;
}

// User confirms the analysis — positive reinforcement for the calibration loop.
async function confirmAnalysis(analysisId) {
  const section = document.getElementById('feedback-' + analysisId);
  await api(`/analysis/${analysisId}/confirm`, { method: 'POST' }).catch(() => {});
  if (section) {
    section.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--forest);">
      <div style="font-size:1.8rem;">🙌</div><div style="font-weight:600;">Thanks for confirming!</div>
      <div style="font-size:.8rem;opacity:.75;margin-top:.3rem;">This reinforces the analyzer's accuracy.</div></div>`;
  }
  toast('Thanks! Feedback recorded 🙌');
}

// User opens the score-correction panel (sliders pre-filled with current values).
function adjustAnalysis(analysisId) {
  const section = document.getElementById('feedback-' + analysisId);
  const store = analysisStore[analysisId] || {};
  const metrics = store.metrics || {};
  // Use this analysis's body-part-specific metric set.
  const defs = (store.metricDefs && store.metricDefs.length)
    ? store.metricDefs
    : Object.keys(metrics).map((k) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()) }));
  section.innerHTML = `
    <div class="feedback-title">${L('drag_scores', 'Drag to set the correct scores')}</div>
    <div>
      ${defs.map(({ key, label }) => {
        const v = metrics[key] ?? 0;
        return `<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.45rem;">
          <span style="width:120px;font-size:.78rem;">${L('m_' + key, label)}</span>
          <input type="range" min="0" max="10" value="${v}" data-key="${key}" style="flex:1;"
            oninput="document.getElementById('val-${analysisId}-${key}').textContent=this.value">
          <span id="val-${analysisId}-${key}" style="width:22px;text-align:right;font-weight:700;color:var(--forest);">${v}</span>
        </div>`;
      }).join('')}
    </div>
    <button class="btn btn-primary btn-full" style="margin-top:.6rem;" onclick="submitCorrection('${analysisId}', this)">${L('save_scores', 'Save corrected scores')}</button>
    <button class="btn btn-full" style="margin-top:.5rem;background:var(--sand);color:var(--forest);" onclick="resetFeedback('${analysisId}')">${L('cancel', 'Cancel')}</button>`;
}

// Restore the confirm/adjust buttons (used by Adjust → Cancel).
function resetFeedback(analysisId) {
  const section = document.getElementById('feedback-' + analysisId);
  if (section) section.outerHTML = feedbackSectionHTML(analysisId);
}

// User submits corrected scores → backend learns the model's bias.
async function submitCorrection(analysisId, btn) {
  const section = document.getElementById('feedback-' + analysisId);
  const metrics = {};
  section.querySelectorAll('input[type=range]').forEach((i) => { metrics[i.dataset.key] = Number(i.value); });

  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span>';
  try {
    const result = await api(`/analysis/${analysisId}/correct`, { method: 'POST', body: { metrics } });

    // Redraw chart + metric grid in place with the corrected values.
    const ctx = analysisStore[analysisId] || {};
    ctx.metrics = result.metrics;
    const defs = result.metricDefs || ctx.metricDefs;
    ctx.metricDefs = defs;
    analysisStore[analysisId] = ctx;
    const grid = document.getElementById('grid-' + analysisId);
    if (grid) grid.innerHTML = ctx.view === 'standalone' ? metricDetailHTML(result.metrics, defs, analysisId) : metricsGridHTML(result.metrics, defs);
    if (ctx.canvasId) drawRadarChart(ctx.canvasId, result.metrics, localizeDefs(defs), ctx.mlResults);

    section.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--forest);">
      <div style="font-size:1.7rem;">🧠✅</div><div style="font-weight:600;">Saved — thank you!</div>
      <div style="font-size:.8rem;opacity:.75;margin-top:.3rem;">The analyzer will use your correction to score future photos more accurately.</div></div>`;
    toast('Correction saved — analyzer updated 🧠');
  } catch (err) {
    toast(err.message);
    btn.disabled = false;
    btn.textContent = 'Save corrected scores';
  }
}

// Standalone analyzer modal (two-panel: photo on the left, results on the right)
async function handleImage(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || !file.type.startsWith('image/')) return;
  State.currentImageFile = file;
  if (!document.getElementById('analyzeLeft')) renderAnalyzerHome();

  const reader = new FileReader();
  reader.onload = async (e) => {
    const imgSrc = e.target.result;
    setAnalyzerPhoto(imgSrc, true, L('checking_skin', 'Checking for visible skin…'));
    setAnalyzerRight(analyzerBusyHTML(L('checking_skin', 'Checking for visible skin…')));

    const pre = await preValidateSkinImage(file);
    if (!pre.valid) {
      setAnalyzerPhoto(imgSrc, false);
      setAnalyzerRight(analyzerErrorHTML('🚫', L('no_skin', 'No Skin Detected'), pre.message));
      return;
    }

    setAnalyzerPhoto(imgSrc, true, L('analyzing_ai', 'Analyzing your skin with AI…'),
      `✅ ${L('skin_detected', 'Skin detected')} (${Math.round(pre.skinPercentage)}%) • 🤖 LLM • 🧬 ML…`, 'standaloneMlStatus');
    setAnalyzerRight(analyzerBusyHTML(L('analyzing_ai', 'Analyzing your skin with AI…')));

    try {
      const { result, mlResults } = await runAnalysis(file, {
        onStatus: (ml) => {
          const el = document.getElementById('standaloneMlStatus');
          if (el && ml) el.innerHTML = `✅ ${L('skin_detected', 'Skin detected')} • 🤖 LLM • 🧬 ML (${Math.round((ml.confidence || 0) * 100)}%)`;
        },
      });
      setAnalyzerPhoto(imgSrc, false, null, null, null, true);
      displayStandaloneAnalysis(result, imgSrc, mlResults);
    } catch (err) {
      setAnalyzerPhoto(imgSrc, false);
      if (err.code === 'not_human_skin') {
        setAnalyzerRight(analyzerErrorHTML('🚫', L('not_human', 'Not Human Skin'), err.message));
        return;
      }
      const detail = err.raw ? `<div style="font-size:.75rem;opacity:.6;margin-top:.5rem;white-space:pre-wrap;">Model said: ${err.raw.substring(0, 200)}…</div>` : '';
      setAnalyzerRight(analyzerErrorHTML('⚠️', L('analysis_failed', 'Analysis failed'), (err.message || 'Please try again.') + detail));
    }
  };
  reader.readAsDataURL(file);
}

// Right-panel busy + error states (keep the left photo visible).
function analyzerBusyHTML(caption) {
  return `<div class="analyze-busy"><span class="profile-eyebrow">${L('glow_profile', 'Your Glow Profile')}</span>
    ${scanFaceHTML(caption)}</div>`;
}
function analyzerErrorHTML(icon, title, msg) {
  return `<div class="analyze-empty"><div class="analyze-empty-icon">${icon}</div>
    <div class="analyze-empty-title">${title}</div><div class="analyze-empty-sub">${msg}</div>
    <button class="btn btn-primary" style="margin-top:1rem;" onclick="retakePhoto()">📸 ${L('upload_diff', 'Upload a different photo')}</button></div>`;
}

// Render the analysis result into the RIGHT panel: score-ring header, then the
// radar chart and metric bars laid out horizontally, then routine + products —
// all on the same page (matches the reference results panel).
function displayStandaloneAnalysis(result, imgSrc, mlResults) {
  const { analysisId, skinType, metrics, topConcerns, recommendation, recommendedProducts, metricDefs } = result;
  const ml = result.isFace ? mlResults : null; // ML cross-check is face only
  const canvasId = 'canvas-' + analysisId;
  analysisStore[analysisId] = { metrics, skinType, mlResults: ml, canvasId, metricDefs, view: 'standalone' };
  cacheSkinHealth(result);
  // Collapse the upload chrome so only the scanned photo sits above the results.
  document.getElementById('analyzeLeft')?.classList.add('done');
  const headline = localizedTopConcerns(metrics, metricDefs) || topConcerns || L('pro_analysis', 'Skin snapshot');
  setAnalyzerRight(`
    <div class="pro-analysis">
      <div class="result-head">
        <div>${profileEyebrowHTML()}<h3 class="result-title">${headline}</h3>
          <div class="analysis-subtitle">${localizedSubtitle(result)}</div>
          <p class="result-summary">${recommendation || ''}</p></div>
      </div>
      ${medicalBannerHTML(result)}
      <h4 class="radar-heading">${L('radar_title', 'Skin Health Radar Chart')}</h4>
      <div class="result-charts">
        <div class="radar-container"><canvas id="${canvasId}" width="400" height="400"></canvas></div>
        <div class="metric-list" id="grid-${analysisId}">${metricDetailHTML(metrics, metricDefs, analysisId)}</div>
      </div>
      ${ml && ml.mlConcerns ? `<div class="ml-status-box"><div style="display:flex;align-items:center;gap:.5rem;font-size:.9rem;"><span>✅</span><span class="ml-status-title">${L('ml_active', 'ML Cross-Validation Active')}</span><span class="ml-confidence-badge">${Math.round((ml.confidence || 0) * 100)}% confidence</span></div></div>` : ''}
      ${reviewerNoteHTML(result)}
      ${recommendedProducts?.length ? routineCtaHTML(recommendedProducts) + recDetailHTML(L('tailored_recs', 'Tailored Product Recommendations'), recommendedProducts) : ''}
      ${feedbackSectionHTML(analysisId)}
      <div style="margin-top:1.2rem;display:flex;gap:.8rem;flex-wrap:wrap;">
        <button class="btn btn-secondary" style="flex:1;min-width:130px;" onclick="retakePhoto()">📸 ${L('new_analysis', 'New Analysis')}</button>
        <button class="btn btn-primary" style="flex:1;min-width:130px;" onclick="chatAboutAnalysis()">💬 ${L('chat_lily_btn', 'Chat with Lily')}</button>
      </div>
    </div>`);
  setTimeout(() => drawRadarChart(canvasId, metrics, localizeDefs(metricDefs), ml), 300);
}

function retakePhoto() { renderAnalyzerHome(); }

function chatAboutAnalysis() {
  closeAnalyzer();
  setTimeout(() => {
    openChat();
    const ctx = State.skinAnalysisContext;
    if (!ctx) return;
    addMessage('assistant', `I've reviewed your skin analysis! Your ${ctx.bodyPart} shows ${ctx.skinType} skin with concerns about ${ctx.topConcerns}.<br><br>What would you like to know more about?`);
  }, 400);
}

// ===========================================================================
// Admin dashboard
// ===========================================================================
const ADMIN_TABS = ['Overview', 'Products', 'Suppliers', 'Orders', 'Analyses', 'Calibration', 'Feedback', 'Security'];
let adminActiveTab = 'Overview';

function openAdmin() {
  if (State.user?.role !== 'admin') { toast('Admin access required'); return; }
  document.getElementById('adminView').classList.add('active');
  const tabs = document.getElementById('adminTabs');
  tabs.innerHTML = ADMIN_TABS.map((t) => `<button class="admin-tab ${t === adminActiveTab ? 'active' : ''}" onclick="adminSwitch('${t}')">${t}</button>`).join('');
  adminSwitch(adminActiveTab);
}
function closeAdmin() { document.getElementById('adminView').classList.remove('active'); }
function adminSwitch(tab) {
  adminActiveTab = tab;
  document.querySelectorAll('.admin-tab').forEach((b) => b.classList.toggle('active', b.textContent === tab));
  const fns = { Overview: adminOverview, Products: adminProducts, Suppliers: adminSuppliers, Orders: adminOrders, Analyses: adminAnalyses, Calibration: adminCalibration, Feedback: adminFeedback, Security: adminSecurity };
  document.getElementById('adminContent').innerHTML = '<div class="empty-state">Loading…</div>';
  fns[tab]();
}

async function adminOverview() {
  const s = await api('/admin/stats');
  document.getElementById('adminContent').innerHTML = `<div class="admin-stat-grid">
    ${[['Revenue', '$' + s.revenue], ['Orders', s.orders], ['Products', s.products], ['Users', s.users], ['Analyses', s.analyses], ['Threats', s.threats]]
      .map(([label, val]) => `<div class="admin-stat"><div class="admin-stat-value">${val}</div><div class="admin-stat-label">${label}</div></div>`).join('')}
  </div>`;
}

let adminProductCache = [];

async function adminProducts() {
  const { products } = await api('/admin/products');
  adminProductCache = products;
  document.getElementById('adminContent').innerHTML = `
    <div style="display:flex;gap:.6rem;margin-bottom:1rem;flex-wrap:wrap;align-items:center;">
      <button class="btn btn-primary" onclick="adminEditProduct()">+ New Product</button>
      <input class="form-input" id="adminProdSearch" placeholder="🔍 Search name / SKU / brand…" style="flex:1;min-width:200px;" oninput="renderAdminProductRows(this.value)">
      <span style="font-size:.8rem;opacity:.6;" id="adminProdCount"></span>
    </div>
    <div style="overflow-x:auto;">
      <table class="admin-table"><thead><tr><th></th><th>Name</th><th>Source</th><th>Price</th><th>Stock</th><th>Active</th><th></th></tr></thead>
      <tbody id="adminProdRows"></tbody></table>
    </div>`;
  renderAdminProductRows('');
}

function renderAdminProductRows(filter) {
  const f = (filter || '').toLowerCase();
  const rows = adminProductCache.filter((p) =>
    !f || (p.name || '').toLowerCase().includes(f) || (p.sku || '').toLowerCase().includes(f) || (p.brand || '').toLowerCase().includes(f));
  document.getElementById('adminProdCount').textContent = `${rows.length} / ${adminProductCache.length}`;
  document.getElementById('adminProdRows').innerHTML = rows.map((p) => `
    <tr>
      <td>${p.images && p.images.length ? `<img src="${p.images[0]}" loading="lazy" style="width:38px;height:38px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${(p.emoji || '🧴').replace(/'/g, '')}',style:'font-size:1.4rem'}))">` : `<span style="font-size:1.4rem;">${p.emoji || '🧴'}</span>`}</td>
      <td>${p.name}${p.dropship ? ' <span class="cert-badge" style="background:var(--sand);color:var(--forest);">DROPSHIP</span>' : ''}</td>
      <td style="font-size:.78rem;opacity:.7;">${p.source || 'manual'}</td>
      <td>$${(p.price || 0).toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>${p.active ? '✅' : '—'}</td>
      <td style="display:flex;gap:.4rem;"><button class="admin-small-btn edit" onclick='adminEditProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Edit</button>
      <button class="admin-small-btn delete" onclick="adminDeleteProduct('${p._id}')">Del</button></td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;opacity:.6;padding:1.5rem;">No products match.</td></tr>';
}

// Working image list for the open editor.
let editorImages = [];

function adminEditProduct(product) {
  const p = product || {};
  editorImages = [...(p.images || [])];
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="modal-content"><div class="modal-header"><div class="modal-handle"></div><h2 class="modal-title">${p._id ? 'Edit' : 'New'} Product</h2></div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Product Images (first = main; include certificate photos)</label>
        <div class="img-uploader" id="imgUploader"></div>
        <input type="file" id="pImages" accept="image/*" multiple style="display:none;" onchange="handleEditorUpload(event)">
        <button class="btn btn-full" style="margin-top:.4rem;background:var(--sand);color:var(--forest);" onclick="extractFromImage(this)">🤖 Auto-fill fields from a product image (AI)</button>
        <input type="file" id="pExtract" accept="image/*" style="display:none;" onchange="runExtract(event)">
      </div>
      <div class="form-group"><label class="form-label">SKU <span style="opacity:.6;font-weight:400;">(optional — auto-generated if blank)</span></label><input class="form-input" id="pSku" value="${p.sku || ''}" placeholder="e.g. PG-SERUM-01 (leave blank to auto-generate)"></div>
      <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="pName" value="${p.name || ''}"></div>
      <div class="form-group"><label class="form-label">Brand</label><input class="form-input" id="pBrand" value="${p.brand || ''}"></div>
      <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="pDesc" value="${p.desc || ''}"></div>
      <div class="form-group"><label class="form-label">Emoji (fallback if no image)</label><input class="form-input" id="pEmoji" value="${p.emoji || '🧴'}"></div>
      <div class="form-group"><label class="form-label">Price</label><input class="form-input" id="pPrice" type="number" step="0.01" value="${p.price || 0}"></div>
      <div class="form-group"><label class="form-label">Stock</label><input class="form-input" id="pStock" type="number" value="${p.stock || 0}"></div>
      <div class="form-group"><label class="form-label">Concerns (comma-separated)</label><input class="form-input" id="pConcerns" value="${(p.concerns || []).join(', ')}"></div>
      <div class="form-group"><label class="form-label">Certs (comma-separated)</label><input class="form-input" id="pCerts" value="${(p.certs || []).join(', ')}"></div>
      <div class="form-group"><label class="form-label">Key Ingredients (comma-separated)</label><input class="form-input" id="pKeyIngredients" value="${(p.keyIngredients || []).join(', ')}"></div>
      <div class="form-group"><label class="form-label">How to Use</label><input class="form-input" id="pHowToUse" value="${(p.howToUse || '').replace(/"/g, '&quot;')}"></div>
      <div class="form-error" id="pError"></div>
      <button class="btn btn-primary btn-full" onclick="adminSaveProduct('${p._id || ''}', this)">Save</button>
    </div></div>`;
  document.body.appendChild(modal);
  renderEditorImages();
}

function renderEditorImages() {
  const el = document.getElementById('imgUploader');
  if (!el) return;
  el.innerHTML = editorImages.map((u, i) => `
    <div class="img-tile">
      <img src="${u}">
      <button class="img-remove" onclick="removeEditorImage(${i})">×</button>
      ${i === 0 ? '<div class="img-primary">MAIN</div>' : ''}
    </div>`).join('') +
    `<div class="img-add" onclick="document.getElementById('pImages').click()">＋</div>`;
}

function removeEditorImage(i) { editorImages.splice(i, 1); renderEditorImages(); }

async function handleEditorUpload(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  if (!files.length) return;
  const form = new FormData();
  files.forEach((f) => form.append('images', f));
  try {
    const { urls } = await api('/admin/uploads', { method: 'POST', body: form, isForm: true });
    editorImages.push(...urls);
    renderEditorImages();
    toast(`${urls.length} image(s) uploaded`);
  } catch (err) { toast(err.message); }
}

// AI autofill: pick an image, extract fields, fill the form.
function extractFromImage() { document.getElementById('pExtract').click(); }

async function runExtract(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  toast('Reading product info from image… 🤖');
  const form = new FormData();
  form.append('image', file);
  try {
    const { fields } = await api('/admin/extract', { method: 'POST', body: form, isForm: true });
    const setIf = (id, v) => { if (v) document.getElementById(id).value = v; };
    setIf('pName', fields.name);
    setIf('pBrand', fields.brand);
    setIf('pDesc', fields.desc);
    if (fields.price) document.getElementById('pPrice').value = fields.price;
    if (fields.concerns?.length) document.getElementById('pConcerns').value = fields.concerns.join(', ');
    if (fields.certs?.length) document.getElementById('pCerts').value = fields.certs.join(', ');
    if (fields.keyIngredients?.length) document.getElementById('pKeyIngredients').value = fields.keyIngredients.join(', ');
    setIf('pHowToUse', fields.howToUse);
    // Also upload this image to the gallery so it's saved.
    const upForm = new FormData(); upForm.append('images', file);
    const { urls } = await api('/admin/uploads', { method: 'POST', body: upForm, isForm: true }).catch(() => ({ urls: [] }));
    if (urls.length) { editorImages.push(...urls); renderEditorImages(); }
    toast('Fields auto-filled — please review ✨');
  } catch (err) { toast('Extraction failed: ' + err.message); }
}

async function adminSaveProduct(id, btn, force = false) {
  const body = {
    name: val('pName'), brand: val('pBrand'), desc: val('pDesc'), emoji: val('pEmoji'),
    price: parseFloat(val('pPrice')) || 0, stock: parseInt(val('pStock'), 10) || 0,
    concerns: list('pConcerns'), certs: list('pCerts'), keyIngredients: list('pKeyIngredients'),
    howToUse: val('pHowToUse'), images: editorImages,
  };
  if (val('pSku')) body.sku = val('pSku'); // optional; server auto-generates if blank
  if (force) body.allowDuplicate = true;

  const errEl = document.getElementById('pError');
  errEl.innerHTML = '';
  try {
    if (id) await api(`/admin/products/${id}`, { method: 'PUT', body });
    else await api('/admin/products', { method: 'POST', body });
    btn.closest('.modal').remove();
    toast('Product saved');
    adminProducts();
    loadProducts();
  } catch (err) {
    if (err.code === 'duplicate_name') {
      errEl.innerHTML = `${err.message}<br><button class="btn btn-full" style="margin-top:.5rem;background:var(--clay);color:#fff;" onclick="adminSaveProduct('${id}', this, true)">Create anyway</button>`;
    } else {
      errEl.textContent = err.message;
    }
  }
}
async function adminDeleteProduct(id) {
  await api(`/admin/products/${id}`, { method: 'DELETE' });
  toast('Product deactivated'); adminProducts(); loadProducts();
}
const val = (id) => document.getElementById(id).value.trim();
const list = (id) => val(id).split(',').map((s) => s.trim()).filter(Boolean);

async function adminOrders() {
  const { orders } = await api('/admin/orders');
  document.getElementById('adminContent').innerHTML = `<table class="admin-table"><thead><tr><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>
    ${orders.map((o) => `<tr><td>${o.user?.email || '—'}</td><td>$${o.total.toFixed(2)}</td>
      <td><select onchange="adminUpdateOrder('${o._id}', this.value)">${['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td></tr>`).join('') || '<tr><td colspan="4">No orders</td></tr>'}
  </tbody></table>`;
}
async function adminUpdateOrder(id, status) { await api(`/admin/orders/${id}`, { method: 'PATCH', body: { status } }); toast('Order updated'); }

async function adminAnalyses() {
  const { analyses } = await api('/admin/analyses');
  document.getElementById('adminContent').innerHTML = `<table class="admin-table"><thead><tr><th>Body</th><th>Type</th><th>Top Concerns</th><th>Review</th><th>Date</th></tr></thead><tbody>
    ${analyses.map((a) => `<tr><td>${a.bodyPart}</td><td>${a.skinType}</td><td>${a.topConcerns}</td><td>${a.reviewerVerdict || '—'}</td><td>${new Date(a.createdAt).toLocaleDateString()}</td></tr>`).join('') || '<tr><td colspan="5">None</td></tr>'}
  </tbody></table>`;
}
async function adminFeedback() {
  const { feedback } = await api('/admin/feedback');
  document.getElementById('adminContent').innerHTML = `<table class="admin-table"><thead><tr><th>Rating</th><th>Comment</th><th>Date</th></tr></thead><tbody>
    ${feedback.map((f) => `<tr><td>${f.rating}</td><td>${f.comment || '—'}</td><td>${new Date(f.createdAt).toLocaleDateString()}</td></tr>`).join('') || '<tr><td colspan="3">None</td></tr>'}
  </tbody></table>`;
}
async function adminSuppliers() {
  const { suppliers } = await api('/admin/suppliers');
  document.getElementById('adminContent').innerHTML = `
    <p style="font-size:.82rem;opacity:.7;margin-bottom:1rem;">Dropshipping sources. Imported items appear in the storefront as platform stock (priced at supplier cost × markup). AliExpress uses its API (set credentials in .env); Spocket & BeautyJoint import from a CSV/JSON product feed URL.</p>
    ${suppliers.map((s) => `
      <div style="background:var(--white);border:1px solid var(--sand);border-radius:12px;padding:1rem;margin-bottom:1rem;">
        <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
          <strong style="font-size:1.05rem;color:var(--forest);">${s.name}</strong>
          <span class="cert-badge" style="background:var(--sand);color:var(--forest);">${s.type.toUpperCase()}</span>
          <span class="cert-badge" style="background:${s.enabled ? '#66BB6A' : '#bbb'};color:#fff;">${s.enabled ? 'ENABLED' : 'DISABLED'}</span>
          <span class="cert-badge" style="background:${s.ready ? '#42A5F5' : '#FFA726'};color:#fff;">${s.ready ? 'READY' : 'NEEDS CONFIG'}</span>
          <span style="margin-left:auto;font-size:.85rem;opacity:.75;">${s.productCount} products imported</span>
        </div>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.8rem;align-items:flex-end;">
          <div style="width:90px;"><label class="form-label">Markup ×</label><input class="form-input" id="markup-${s.key}" type="number" step="0.1" value="${s.markup}"></div>
          <div style="width:90px;"><label class="form-label">Max</label><input class="form-input" id="max-${s.key}" type="number" value="${s.maxProducts}"></div>
          ${s.type === 'feed' ? `<div style="flex:1;min-width:240px;"><label class="form-label">CSV / JSON feed URL</label><input class="form-input" id="feed-${s.key}" value="${s.config?.feedUrl || ''}" placeholder="https://…/export.csv"></div>` : ''}
        </div>
        ${s.type === 'api' ? `<div style="margin-top:.8rem;">
          <label class="form-label">Sourcing criteria (JSON) — keywords, currency, priceMin/Max, moq, shipFrom, sort</label>
          <textarea class="form-input" id="cfg-${s.key}" style="min-height:120px;font-family:monospace;font-size:.78rem;">${JSON.stringify(s.config || {}, null, 2)}</textarea>
          <div style="font-size:.72rem;opacity:.6;margin-top:.3rem;">API credentials (ALIEXPRESS_APP_KEY / _SECRET / _ACCESS_TOKEN) come from .env, not here.</div>
        </div>` : ''}
        <div style="display:flex;gap:.6rem;margin-top:.8rem;flex-wrap:wrap;">
          <button class="admin-small-btn edit" onclick="saveSupplier('${s.key}', ${!s.enabled})">${s.enabled ? 'Disable' : 'Enable'}</button>
          <button class="admin-small-btn edit" onclick="saveSupplier('${s.key}', ${s.enabled})">Save config</button>
          <button class="admin-small-btn" style="background:var(--forest);color:#fff;" onclick="syncSupplier('${s.key}', this)">⟳ Sync now</button>
        </div>
        ${s.lastSyncAt ? `<div style="font-size:.75rem;opacity:.6;margin-top:.6rem;">Last sync ${new Date(s.lastSyncAt).toLocaleString()} — ${s.lastResult?.error ? '⚠️ ' + s.lastResult.error : `imported ${s.lastResult?.imported || 0}, updated ${s.lastResult?.updated || 0}, skipped ${s.lastResult?.skipped || 0}`}</div>` : ''}
      </div>`).join('')}`;
}

async function saveSupplier(key, enabled) {
  const feedEl = document.getElementById('feed-' + key);
  const cfgEl = document.getElementById('cfg-' + key);
  const body = {
    enabled,
    markup: parseFloat(document.getElementById('markup-' + key).value) || 2,
    maxProducts: parseInt(document.getElementById('max-' + key).value, 10) || 50,
  };
  if (feedEl) body.config = { feedUrl: feedEl.value.trim() };
  if (cfgEl) {
    try { body.config = JSON.parse(cfgEl.value); }
    catch (_) { toast('Sourcing criteria is not valid JSON'); return; }
  }
  try { await api(`/admin/suppliers/${key}`, { method: 'PUT', body }); toast('Supplier saved'); adminSuppliers(); }
  catch (err) { toast(err.message); }
}

async function syncSupplier(key, btn) {
  btn.disabled = true; btn.textContent = 'Syncing…';
  try {
    const { result } = await api(`/admin/suppliers/${key}/sync`, { method: 'POST' });
    if (result.error) toast('Sync error: ' + result.error);
    else toast(`Synced: +${result.imported} new, ${result.updated} updated`);
    adminSuppliers();
    loadProducts();
  } catch (err) { toast(err.message); btn.disabled = false; btn.textContent = '⟳ Sync now'; }
}

async function adminCalibration() {
  const c = await api('/admin/calibration');
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-stat-grid">
      <div class="admin-stat"><div class="admin-stat-value">${c.corrections}</div><div class="admin-stat-label">Corrections learned</div></div>
      <div class="admin-stat"><div class="admin-stat-value">${c.confirmations}</div><div class="admin-stat-label">Confirmations</div></div>
    </div>
    <p style="font-size:.82rem;opacity:.7;margin-bottom:1rem;">Learned per-metric correction applied to every new analysis (positive = the model under-scores this metric, negative = it over-scores). Offsets activate after a few corrections.</p>
    <table class="admin-table"><thead><tr><th>Metric</th><th>Samples</th><th>Applied offset</th></tr></thead><tbody>
      ${c.perMetric.map((m) => `<tr><td>${m.metric}</td><td>${m.samples}</td><td style="font-weight:700;color:${m.offset > 0 ? '#c0392b' : m.offset < 0 ? '#2d7a2d' : 'inherit'};">${m.offset > 0 ? '+' : ''}${m.offset}</td></tr>`).join('')}
    </tbody></table>`;
}

async function adminSecurity() {
  const { logs } = await api('/admin/security');
  document.getElementById('adminContent').innerHTML = `<table class="admin-table"><thead><tr><th>Type</th><th>Keyword</th><th>Message</th><th>Date</th></tr></thead><tbody>
    ${logs.map((l) => `<tr><td>${l.type}</td><td>${l.keyword}</td><td>${l.message}</td><td>${new Date(l.createdAt).toLocaleDateString()}</td></tr>`).join('') || '<tr><td colspan="4">No threats logged 🎉</td></tr>'}
  </tbody></table>`;
}

// ===========================================================================
// Init
// ===========================================================================
function bindUploadZone() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');
  if (!zone || !input) return;
  const preview = document.getElementById('photoPreview');
  if (preview) preview.onclick = () => input.click();
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-dragging'); }));
  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleImage({ target: { files: [file], value: '' } });
  });
}

// ===========================================================================
// Language switcher (i18n)
// ===========================================================================
function renderLangSwitch(containerId) {
  const el = document.getElementById(containerId);
  if (!el || !window.i18n) return;
  const cur = window.i18n.lang;
  const curLabel = (window.i18n.LANGS.find((l) => l[0] === cur) || ['en', 'English'])[1];
  el.innerHTML = `<button class="lang-btn" onclick="toggleLangMenu(event,'${containerId}')">🌐 ${curLabel}</button>
    <div class="lang-menu" id="menu-${containerId}">
      ${window.i18n.LANGS.map(([code, label]) => `<button class="lang-option ${code === cur ? 'active' : ''}" onclick="window.i18n.setLang('${code}'); closeLangMenus()">${label}</button>`).join('')}
    </div>`;
}
function toggleLangMenu(e, id) {
  e.stopPropagation();
  const m = document.getElementById('menu-' + id);
  document.querySelectorAll('.lang-menu').forEach((x) => { if (x !== m) x.classList.remove('open'); });
  m.classList.toggle('open');
}
function closeLangMenus() { document.querySelectorAll('.lang-menu').forEach((x) => x.classList.remove('open')); }
document.addEventListener('click', closeLangMenus);

// Re-apply translations + refresh dynamic chrome when the language changes.
window.onLangChange = function () {
  if (window.i18n) window.i18n.apply();
  updateAuthUI(); // restore "Hi, name" for logged-in users (apply() would set Sign In)
  renderLangSwitch('landingLang');
  renderLangSwitch('headerLang');
};

async function init() {
  if (window.i18n) window.i18n.apply();
  injectLilyAvatars();
  renderLangSwitch('landingLang');
  renderLangSwitch('headerLang');
  updateAuthUI();
  renderTips();
  renderFilterChips();
  renderSkinHealth();
  await loadProducts();
  await loadCart();
  bindUploadZone();

  const searchEl = document.getElementById('shopSearch');
  if (searchEl) searchEl.addEventListener('input', (e) => onShopSearch(e.target.value));

  document.getElementById('chatInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

  // Validate stored session.
  if (State.token) {
    api('/auth/me').then(({ user }) => { State.user = user; localStorage.setItem('pg_user', JSON.stringify(user)); updateAuthUI(); }).catch(clearAuth);
  }

  // Assistant bubble auto-hide + scroll behaviour.
  setTimeout(() => {
    const bubble = document.getElementById('assistantBubble');
    if (bubble) { bubble.style.opacity = '0'; setTimeout(() => (bubble.style.display = 'none'), 300); }
  }, 8000);
  window.addEventListener('scroll', () => {
    const a = document.getElementById('aiAssistant');
    if (!a.classList.contains('active')) return;
    const st = window.pageYOffset || document.documentElement.scrollTop;
    a.style.opacity = st > lastScrollTop && st > 200 ? '0' : '1';
    a.style.pointerEvents = st > lastScrollTop && st > 200 ? 'none' : 'auto';
    lastScrollTop = st <= 0 ? 0 : st;
  });
}

document.addEventListener('DOMContentLoaded', init);
