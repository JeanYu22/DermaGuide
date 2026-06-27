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
// Navigation
// ===========================================================================
let lastScrollTop = 0;

function enterShop() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('shopView').classList.add('active');
  setTimeout(() => document.getElementById('aiAssistant').classList.add('active'), 800);
}
function quickAnalyze() { enterShop(); setTimeout(openAnalyzer, 300); }
function dismissAssistant() {
  const a = document.getElementById('aiAssistant');
  a.style.animation = 'assistantEntrance .5s ease-out reverse';
  setTimeout(() => { a.classList.remove('active'); a.style.animation = ''; }, 500);
}
function openChatFromAssistant() { dismissAssistant(); setTimeout(openChat, 300); }
function openChat() { document.getElementById('chatModal').classList.add('active'); }
function closeChat() { document.getElementById('chatModal').classList.remove('active'); }
function openAnalyzer() { document.getElementById('analyzerModal').classList.add('active'); }
function closeAnalyzer() { document.getElementById('analyzerModal').classList.remove('active'); }
function scrollToProducts() { document.getElementById('productsSection').scrollIntoView({ behavior: 'smooth' }); }
function scrollToTips() { document.getElementById('tipsSection').scrollIntoView({ behavior: 'smooth' }); }

// ===========================================================================
// Products + tips rendering
// ===========================================================================
async function loadProducts() {
  try {
    const { products } = await api('/products');
    State.products = products;
    renderProducts();
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

function renderProducts() {
  const container = document.getElementById('productsContainer');
  container.innerHTML = '';
  State.products.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => showProductModal(p);
    card.innerHTML = `
      <div class="product-image">${p.emoji}
        <div class="cert-badges">${p.certs.map((c) => `<span class="cert-badge ${c}">${c.toUpperCase()}</span>`).join('')}</div>
      </div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-price">$${p.price.toFixed(2)} ${p.inStock ? '' : '<span class="out-of-stock">• Out of stock</span>'}</div>
      </div>`;
    container.appendChild(card);
  });
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
        <div style="font-size:5rem;text-align:center;margin:1rem 0;">${product.emoji}</div>
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
  link.textContent = State.user ? `Hi, ${State.user.name || State.user.email.split('@')[0]} ▾` : 'Sign In';
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
        <div class="cart-item-emoji">${i.product.emoji}</div>
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

function openCheckout() {
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
        <p style="font-size:.8rem;opacity:.6;margin-bottom:1rem;">💳 Demo checkout — payment is simulated, no card required.</p>
        <div class="form-error" id="coError"></div>
        <button class="btn btn-primary btn-full" id="coSubmit" onclick="submitCheckout(this)">Place Order</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
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
function addMessage(role, content) {
  const container = document.getElementById('chatMessages');
  const prev = document.getElementById('lastMsg');
  if (prev) prev.removeAttribute('id');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  if (role === 'assistant') div.id = 'lastMsg';
  div.innerHTML = `<div class="message-label">${role === 'assistant' ? 'Lily' : 'You'}</div><div class="message-bubble">${content}</div>`;
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
            <div class="rec-emoji">${p.emoji}</div>
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
  userMsg.innerHTML = `<div class="message-label">You</div><div class="message-bubble">
    <img src="${thumbUrl}" alt="uploaded photo" style="display:block;max-width:170px;width:100%;border-radius:12px;margin-bottom:.5rem;">
    📸 Uploaded a photo for skin analysis</div>`;
  container.appendChild(userMsg);

  // Pre-validate skin presence in-browser before hitting the model.
  const pre = await preValidateSkinImage(file);
  if (!pre.valid) {
    const err = document.createElement('div');
    err.className = 'message assistant';
    err.innerHTML = `<div class="message-label">Lily</div><div class="message-bubble" style="background:linear-gradient(135deg,#fff3e0,#ffe0b2);border-left:4px solid #ff9800;">
      <div style="font-size:1.2rem;margin-bottom:.5rem;">🙈 I can't see any skin in this photo!</div>
      <p style="margin:0;color:#5d4037;">${pre.message}</p>
      <button class="btn btn-primary btn-full" style="margin-top:1rem;" onclick="triggerChatImageUpload()">📸 Upload a Different Photo</button></div>`;
    container.appendChild(err);
    container.scrollTop = container.scrollHeight;
    return;
  }

  const analyzing = document.createElement('div');
  analyzing.className = 'message assistant';
  analyzing.id = 'analyzingMsg';
  analyzing.innerHTML = `<div class="message-label">Lily</div><div class="message-bubble">
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;"><span class="loading"></span> Analyzing your skin… ✨</div>
    <div style="font-size:.85rem;color:var(--sage);" id="chatMlStatus">✅ Skin detected (${Math.round(pre.skinPercentage)}%) • 🤖 LLM Vision • 🧬 ML Cross-Validation…</div></div>`;
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

function metricsGridHTML(metrics) {
  return Object.entries(metrics).map(([key, value]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    const severity = value < 4 ? 'low' : value < 7 ? 'medium' : 'high';
    return `<div class="metric-item"><span class="metric-label">${label}</span><span class="metric-score severity-${severity}">${value}/10</span></div>`;
  }).join('');
}

function recCarouselHTML(title, recs) {
  return `<div class="rec-products"><div class="rec-title">${title}</div><div class="rec-carousel">
    ${recs.map((p) => `<div class="rec-card" onclick='showProductModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
      <div class="rec-emoji">${p.emoji}</div><div class="rec-name">${p.name}</div>
      <div class="rec-price">$${p.price.toFixed(2)}</div></div>`).join('')}
  </div></div>`;
}

/** Detailed recommendations: reason + how-to-use beneath each product. */
function recDetailHTML(title, recs) {
  return `<div class="rec-products"><div class="rec-title">${title}</div>
    ${recs.map((p) => `<div class="rec-detail" onclick='showProductModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
      <div class="rec-detail-head">
        <div class="rec-emoji" style="margin:0;">${p.emoji}</div>
        <div style="flex:1;"><div class="rec-name">${p.name}</div><div class="rec-price">$${p.price.toFixed(2)}</div></div>
        <span style="font-size:.75rem;color:var(--sage);">Tap for details ›</span>
      </div>
      ${p.reason ? `<div class="rec-reason">💡 <strong>Why:</strong> ${p.reason}</div>` : ''}
      ${p.howToUse ? `<div class="rec-howto">📋 <strong>How to use:</strong> ${p.howToUse}</div>` : ''}
    </div>`).join('')}
  </div>`;
}

function displayChatAnalysis(result, mlResults) {
  const { analysisId, bodyPart, skinType, metrics, topConcerns, recommendation, recommendedProducts } = result;
  const canvasId = 'canvas-' + analysisId;
  analysisStore[analysisId] = { metrics, skinType, mlResults, canvasId };
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message assistant';
  div.innerHTML = `
    <div class="message-label">Lily</div>
    <div class="message-bubble">
      <div class="pro-analysis">
        <div class="analysis-header"><h3>Professional Skin Analysis</h3>
          <div class="analysis-subtitle">${cap(bodyPart)} - ${cap(skinType)} Skin</div></div>
        <div class="radar-container"><canvas id="${canvasId}" width="400" height="400"></canvas></div>
        <div class="metrics-grid" id="grid-${analysisId}">${metricsGridHTML(metrics)}</div>
        <div class="analysis-summary"><div class="summary-title">Top Concerns</div><div>${topConcerns}</div></div>
        <div class="analysis-summary"><div class="summary-title">Professional Recommendation</div><div>${recommendation || '—'}</div></div>
        ${mlResults && mlResults.mlConcerns ? `<div class="ml-status-box"><div style="display:flex;align-items:center;gap:.5rem;font-size:.9rem;">
          <span>✅</span><span class="ml-status-title">ML Cross-Validation Active</span>
          <span class="ml-confidence-badge">${Math.round((mlResults.confidence || 0) * 100)}% confidence</span></div>
          <div class="ml-status-desc">Light green overlay shows ML-detected metrics for comparison</div></div>` : ''}
        ${feedbackSectionHTML(analysisId)}
      </div>
      <div style="margin-top:1rem;color:var(--sage);font-size:.95rem;">💬 What would you like to know about treating these concerns?</div>
    </div>`;
  container.appendChild(div);
  if (recommendedProducts?.length) container.appendChild(wrapMessage(recDetailHTML(`Recommended for your ${bodyPart}:`, recommendedProducts)));
  container.scrollTop = container.scrollHeight;
  setTimeout(() => drawRadarChart(canvasId, metrics, skinType, mlResults), 300);
}

function wrapMessage(innerHTML) {
  const d = document.createElement('div');
  d.className = 'message assistant';
  d.innerHTML = innerHTML;
  return d;
}
function cap(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1); }

function feedbackSectionHTML(analysisId) {
  return `<div class="feedback-section" id="feedback-${analysisId}">
    <div class="feedback-title">Is this analysis accurate?</div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;">
      <button class="btn btn-primary" style="flex:1;min-width:140px;" onclick="confirmAnalysis('${analysisId}')">✓ Looks accurate</button>
      <button class="btn" style="flex:1;min-width:140px;background:var(--sand);color:var(--forest);" onclick="adjustAnalysis('${analysisId}')">✎ Adjust scores</button>
    </div>
    <div style="font-size:.72rem;opacity:.6;margin-top:.6rem;text-align:center;">Your feedback continuously trains the analyzer to score more accurately.</div>
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
  const metrics = analysisStore[analysisId]?.metrics || {};
  section.innerHTML = `
    <div class="feedback-title">Drag to set the correct scores</div>
    <div>
      ${METRIC_ORDER.map(([k, l]) => {
        const v = metrics[k] ?? 0;
        return `<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.45rem;">
          <span style="width:108px;font-size:.78rem;">${l}</span>
          <input type="range" min="0" max="10" value="${v}" data-key="${k}" style="flex:1;"
            oninput="document.getElementById('val-${analysisId}-${k}').textContent=this.value">
          <span id="val-${analysisId}-${k}" style="width:22px;text-align:right;font-weight:700;color:var(--forest);">${v}</span>
        </div>`;
      }).join('')}
    </div>
    <button class="btn btn-primary btn-full" style="margin-top:.6rem;" onclick="submitCorrection('${analysisId}', this)">Save corrected scores</button>
    <button class="btn btn-full" style="margin-top:.5rem;background:var(--sand);color:var(--forest);" onclick="resetFeedback('${analysisId}')">Cancel</button>`;
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
    analysisStore[analysisId] = ctx;
    const grid = document.getElementById('grid-' + analysisId);
    if (grid) grid.innerHTML = metricsGridHTML(result.metrics);
    if (ctx.canvasId) drawRadarChart(ctx.canvasId, result.metrics, result.skinType || ctx.skinType, ctx.mlResults);

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

// Standalone analyzer modal
async function handleImage(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || !file.type.startsWith('image/')) return;
  State.currentImageFile = file;
  const content = document.getElementById('analyzerContent');

  const reader = new FileReader();
  reader.onload = async (e) => {
    const imgSrc = e.target.result;
    content.innerHTML = `<img src="${imgSrc}" class="preview-img"><div class="scan-animation"><div class="scan-loader"></div><div>🔍 Checking for visible skin…</div></div>`;

    const pre = await preValidateSkinImage(file);
    if (!pre.valid) {
      content.innerHTML = `<img src="${imgSrc}" class="preview-img" style="opacity:.5;">
        <div style="padding:2rem;text-align:center;"><div style="font-size:3rem;">🚫</div>
        <h3 style="color:#e65100;margin:.5rem 0;">No Skin Detected</h3><p style="color:#5d4037;">${pre.message}</p>
        <button class="btn btn-primary" style="margin-top:1rem;" onclick="retakePhoto()">📸 Upload Different Photo</button></div>`;
      return;
    }

    content.innerHTML = `<img src="${imgSrc}" class="preview-img"><div class="scan-animation"><div class="scan-loader"></div>
      <div style="display:flex;align-items:center;gap:.5rem;justify-content:center;"><span class="loading"></span> Analyzing your skin with AI…</div>
      <div style="font-size:.85rem;color:var(--sage);margin-top:.5rem;" id="standaloneMlStatus">✅ Skin detected (${Math.round(pre.skinPercentage)}%) • 🤖 LLM Vision • 🧬 ML…</div></div>`;

    try {
      const { result, mlResults } = await runAnalysis(file, {
        onStatus: (ml) => {
          const el = document.getElementById('standaloneMlStatus');
          if (el && ml) el.innerHTML = `✅ Skin detected • 🤖 LLM Vision • 🧬 ML Ready (${Math.round((ml.confidence || 0) * 100)}%)`;
        },
      });
      displayStandaloneAnalysis(result, imgSrc, mlResults);
    } catch (err) {
      if (err.code === 'not_human_skin') {
        content.innerHTML = `<img src="${imgSrc}" class="preview-img" style="opacity:.5;">
          <div style="padding:2rem;text-align:center;"><div style="font-size:3rem;">🚫</div>
          <h3 style="color:#e65100;margin:.5rem 0;">Not Human Skin</h3><p style="color:#5d4037;">${err.message}</p>
          <button class="btn btn-primary" style="margin-top:1rem;" onclick="retakePhoto()">📸 Upload Different Photo</button></div>`;
        return;
      }
      const detail = err.raw ? `<div style="font-size:.75rem;opacity:.6;margin-top:.5rem;white-space:pre-wrap;">Model said: ${err.raw.substring(0, 200)}…</div>` : '';
      content.innerHTML = `<img src="${imgSrc}" class="preview-img"><div style="text-align:center;color:var(--clay);padding:2rem;">${err.message || 'Analysis failed. Please try again.'}${detail}</div><button class="btn btn-primary btn-full" onclick="retakePhoto()">Try Again</button>`;
    }
  };
  reader.readAsDataURL(file);
}

function displayStandaloneAnalysis(result, imgSrc, mlResults) {
  const { analysisId, bodyPart, skinType, metrics, topConcerns, recommendation, recommendedProducts } = result;
  const canvasId = 'canvas-' + analysisId;
  analysisStore[analysisId] = { metrics, skinType, mlResults, canvasId };
  const content = document.getElementById('analyzerContent');
  content.innerHTML = `
    <img src="${imgSrc}" class="preview-img">
    <div class="pro-analysis">
      <div class="analysis-header"><h3>Professional Skin Analysis</h3><div class="analysis-subtitle">${cap(bodyPart)} - ${cap(skinType)} Skin</div></div>
      <div class="radar-container"><canvas id="${canvasId}" width="400" height="400"></canvas></div>
      <div class="metrics-grid" id="grid-${analysisId}">${metricsGridHTML(metrics)}</div>
      <div class="analysis-summary"><div class="summary-title">Top Concerns</div><div>${topConcerns}</div></div>
      <div class="analysis-summary"><div class="summary-title">Professional Recommendation</div><div>${recommendation || '—'}</div></div>
      ${mlResults && mlResults.mlConcerns ? `<div class="ml-status-box"><div style="display:flex;align-items:center;gap:.5rem;font-size:.9rem;"><span>✅</span><span class="ml-status-title">ML Cross-Validation Active</span><span class="ml-confidence-badge">${Math.round((mlResults.confidence || 0) * 100)}% confidence</span></div></div>` : ''}
      ${feedbackSectionHTML(analysisId)}
      ${recommendedProducts?.length ? recDetailHTML(`Top products for your ${bodyPart}:`, recommendedProducts) : ''}
      <div style="margin-top:1.5rem;display:flex;gap:1rem;flex-wrap:wrap;">
        <button class="btn btn-primary" style="flex:1;min-width:140px;" onclick="retakePhoto()">📸 New Analysis</button>
        <button class="btn btn-primary" style="flex:1;min-width:140px;" onclick="chatAboutAnalysis()">💬 Chat with Lily</button>
      </div>
    </div>`;
  setTimeout(() => drawRadarChart(canvasId, metrics, skinType, mlResults), 300);
}

function retakePhoto() {
  const content = document.getElementById('analyzerContent');
  content.innerHTML = `<div class="upload-zone" id="uploadZone"><div class="upload-icon">📸</div><h3 class="upload-title">Upload Your Photo</h3><p class="upload-text">Tap to take or select a photo</p><input type="file" id="fileInput" accept="image/*" capture="user" style="display:none;" onchange="handleImage(event)"></div>`;
  setTimeout(bindUploadZone, 0);
}

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
const ADMIN_TABS = ['Overview', 'Products', 'Orders', 'Analyses', 'Calibration', 'Feedback', 'Security'];
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
  const fns = { Overview: adminOverview, Products: adminProducts, Orders: adminOrders, Analyses: adminAnalyses, Calibration: adminCalibration, Feedback: adminFeedback, Security: adminSecurity };
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

async function adminProducts() {
  const { products } = await api('/admin/products');
  document.getElementById('adminContent').innerHTML = `
    <button class="btn btn-primary" style="margin-bottom:1rem;" onclick="adminEditProduct()">+ New Product</button>
    <table class="admin-table"><thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Active</th><th></th></tr></thead><tbody>
      ${products.map((p) => `<tr><td>${p.emoji} ${p.name}</td><td>$${p.price.toFixed(2)}</td><td>${p.stock}</td><td>${p.active ? '✅' : '—'}</td>
        <td style="display:flex;gap:.4rem;"><button class="admin-small-btn edit" onclick='adminEditProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Edit</button>
        <button class="admin-small-btn delete" onclick="adminDeleteProduct('${p._id}')">Del</button></td></tr>`).join('')}
    </tbody></table>`;
}

function adminEditProduct(product) {
  const p = product || {};
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="modal-content"><div class="modal-header"><div class="modal-handle"></div><h2 class="modal-title">${p._id ? 'Edit' : 'New'} Product</h2></div>
    <div class="modal-body">
      <div class="form-group"><label class="form-label">SKU</label><input class="form-input" id="pSku" value="${p.sku || ''}"></div>
      <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="pName" value="${p.name || ''}"></div>
      <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="pDesc" value="${p.desc || ''}"></div>
      <div class="form-group"><label class="form-label">Emoji</label><input class="form-input" id="pEmoji" value="${p.emoji || '🧴'}"></div>
      <div class="form-group"><label class="form-label">Price</label><input class="form-input" id="pPrice" type="number" step="0.01" value="${p.price || 0}"></div>
      <div class="form-group"><label class="form-label">Stock</label><input class="form-input" id="pStock" type="number" value="${p.stock || 0}"></div>
      <div class="form-group"><label class="form-label">Concerns (comma-separated)</label><input class="form-input" id="pConcerns" value="${(p.concerns || []).join(', ')}"></div>
      <div class="form-group"><label class="form-label">Certs (comma-separated)</label><input class="form-input" id="pCerts" value="${(p.certs || []).join(', ')}"></div>
      <div class="form-error" id="pError"></div>
      <button class="btn btn-primary btn-full" onclick="adminSaveProduct('${p._id || ''}', this)">Save</button>
    </div></div>`;
  document.body.appendChild(modal);
}

async function adminSaveProduct(id, btn) {
  const body = {
    sku: val('pSku'), name: val('pName'), desc: val('pDesc'), emoji: val('pEmoji'),
    price: parseFloat(val('pPrice')) || 0, stock: parseInt(val('pStock'), 10) || 0,
    concerns: list('pConcerns'), certs: list('pCerts'),
  };
  try {
    if (id) await api(`/admin/products/${id}`, { method: 'PUT', body });
    else await api('/admin/products', { method: 'POST', body });
    btn.closest('.modal').remove();
    toast('Product saved');
    adminProducts();
    loadProducts();
  } catch (err) { document.getElementById('pError').textContent = err.message; }
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
  if (zone && input) zone.onclick = () => input.click();
}

async function init() {
  updateAuthUI();
  renderTips();
  await loadProducts();
  await loadCart();
  bindUploadZone();

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
