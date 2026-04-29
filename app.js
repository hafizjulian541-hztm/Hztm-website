/* ════════════════════════════════════════
   HZTM — Horizon Zetta Teknologi Mandiri
   app.js — Fixed & Complete
   ════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, where, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
  onAuthStateChanged, deleteUser
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

// ── FIREBASE ─────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBVhUx7thdJyxqRXkv2GBSY-WZaUmbYQgA",
  authDomain: "hztm-official-web.firebaseapp.com",
  projectId: "hztm-official-web",
  storageBucket: "hztm-official-web.firebasestorage.app",
  messagingSenderId: "932193177985",
  appId: "1:932193177985:web:479f16fbae5a38a4955880"
};

const app      = initializeApp(firebaseConfig);
const db       = getFirestore(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

const COL = {
  products: 'products', orders: 'orders', questions: 'questions',
  settings: 'settings', users: 'users', adminSessions: 'adminSessions'
};

// ── STATE ────────────────────────────────
let currentUser  = null;
let userProfile  = null;
let isAdmin      = false;
let SETTINGS     = { password: 'hztm2026', bgUrl: '', donateUrl: '', adminWa: '081235487980', adminOnline: false, passwordVersion: 0 };
let allProducts  = [];
let orderItems   = [];
let _unsubUserOrders = null; // FIX: simpan referensi listener pesanan user

// ── INIT ─────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  applyBg();
  listenAdminStatus();
  listenQAPublic();
  listenProducts();

  onAuthStateChanged(auth, async user => {
    if (user) {
      currentUser = user;
      await loadOrCreateUserProfile(user);
      renderNavUser();
      await checkAdminSession();
    } else {
      currentUser = null;
      userProfile = null;
      isAdmin = false;
      renderNavUser();
    }
  });

  // tutup dropdown klik luar
  document.addEventListener('click', e => {
    const dd  = document.getElementById('user-dropdown');
    const btn = document.getElementById('nav-user-area');
    if (dd && btn && !dd.contains(e.target) && !btn.contains(e.target)) {
      dd.style.display = 'none';
    }
  });

  // tutup modal klik overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
});

// ── SETTINGS ─────────────────────────────
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, COL.settings, 'main'));
    if (snap.exists()) SETTINGS = { ...SETTINGS, ...snap.data() };
  } catch (e) { console.error(e); }
}

async function saveSettings(data) {
  try {
    await setDoc(doc(db, COL.settings, 'main'), data, { merge: true });
    SETTINGS = { ...SETTINGS, ...data };
  } catch (e) { notify('✗ Gagal menyimpan pengaturan.'); }
}

// ── USER PROFILE ─────────────────────────
async function loadOrCreateUserProfile(user) {
  const ref  = doc(db, COL.users, user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    userProfile = snap.data();
    if (!userProfile.displayName) openModal('modal-setname');
  } else {
    userProfile = { uid: user.uid, email: user.email, photo: user.photoURL || '', displayName: '' };
    await setDoc(ref, { ...userProfile, createdAt: serverTimestamp() });
    openModal('modal-setname');
  }
}

async function saveDisplayName() {
  const name = document.getElementById('input-displayname').value.trim();
  if (!name) { notify('⚠ Nama tidak boleh kosong.'); return; }
  try {
    await updateDoc(doc(db, COL.users, currentUser.uid), { displayName: name });
    userProfile.displayName = name;
    closeModal('modal-setname');
    renderNavUser();
    notify(`✓ Selamat datang, ${name}!`);
  } catch (e) { notify('✗ Gagal menyimpan nama.'); }
}
window.saveDisplayName = saveDisplayName;

// ── NAV USER ─────────────────────────────
function renderNavUser() {
  const area = document.getElementById('nav-user-area');
  if (!currentUser || !userProfile) {
    area.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="openModal('modal-login')">Login</button>`;
    return;
  }
  const name  = userProfile.displayName || 'User';
  const photo = userProfile.photo || currentUser.photoURL || '';
  const initial = name[0].toUpperCase();
  area.innerHTML = `
    <button class="nav-user-btn" onclick="toggleDropdown()">
      ${photo
        ? `<img src="${esc(photo)}" alt="" class="nav-avatar"/>`
        : `<div class="nav-avatar nav-avatar-text">${initial}</div>`}
      <span class="nav-uname">${esc(name)}</span>
      <span class="nav-chevron">▾</span>
    </button>`;
  // isi dropdown
  document.getElementById('ud-name').textContent  = name;
  document.getElementById('ud-email').textContent = currentUser.email || '';
  const ph = document.getElementById('ud-photo');
  if (ph) ph.src = photo || '';
}

function toggleDropdown() {
  const dd = document.getElementById('user-dropdown');
  dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}
window.toggleDropdown = toggleDropdown;

// ── AUTH ─────────────────────────────────
async function loginGoogle() {
  try {
    await signInWithPopup(auth, provider);
    closeModal('modal-login');
  } catch (e) { notify('✗ Login gagal. Coba lagi.'); }
}
window.loginGoogle = loginGoogle;

async function logoutUser() {
  if (currentUser) {
    const snap = await getDocs(query(
      collection(db, COL.orders),
      where('uid', '==', currentUser.uid),
      where('status', 'in', ['baru', 'dikonfirmasi', 'minta-batal'])
    ));
    if (!snap.empty) {
      notify('⚠ Tidak bisa logout — masih ada pesanan aktif.');
      document.getElementById('user-dropdown').style.display = 'none';
      return;
    }
  }
  isAdmin = false;
  if (_unsubUserOrders) { _unsubUserOrders(); _unsubUserOrders = null; }
  await signOut(auth);
  document.getElementById('user-dropdown').style.display = 'none';
  showPage('home');
  notify('✓ Logout berhasil.');
}
window.logoutUser = logoutUser;

async function confirmDeleteAccount() {
  document.getElementById('user-dropdown').style.display = 'none';
  if (currentUser) {
    const snap = await getDocs(query(
      collection(db, COL.orders),
      where('uid', '==', currentUser.uid),
      where('status', 'in', ['baru', 'dikonfirmasi', 'minta-batal'])
    ));
    if (!snap.empty) { notify('⚠ Selesaikan semua pesanan terlebih dahulu.'); return; }
  }
  openModal('modal-delete-account');
}
window.confirmDeleteAccount = confirmDeleteAccount;

async function deleteAccount() {
  if (!currentUser) return;
  try {
    const snap = await getDocs(query(collection(db, COL.orders), where('uid', '==', currentUser.uid)));
    await Promise.all(snap.docs.map(d =>
      updateDoc(doc(db, COL.orders, d.id), {
        userDeleted: true,
        userName: (userProfile?.displayName || '?') + ' (akun dihapus)'
      })
    ));
    await deleteDoc(doc(db, COL.users, currentUser.uid));
    await deleteUser(currentUser);
    closeModal('modal-delete-account');
    showPage('home');
    notify('✓ Akun berhasil dihapus.');
  } catch (e) { notify('✗ Gagal hapus akun. Coba login ulang lalu hapus lagi.'); }
}
window.deleteAccount = deleteAccount;

// ── ADMIN AUTH ───────────────────────────
async function checkAdminSession() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db, COL.adminSessions, currentUser.uid));
    if (snap.exists() && snap.data().passwordVersion === (SETTINGS.passwordVersion || 0)) {
      isAdmin = true;
      if (document.getElementById('page-admin').classList.contains('active')) showAdminPanel();
    }
  } catch (e) {}
}

async function adminLogin() {
  const pass = document.getElementById('admin-pass').value;
  await loadSettings();
  if (pass === SETTINGS.password) {
    isAdmin = true;
    await setDoc(doc(db, COL.adminSessions, currentUser.uid), {
      passwordVersion: SETTINGS.passwordVersion || 0,
      uid: currentUser.uid
    });
    showAdminPanel();
    notify('✓ Selamat datang, Admin ' + (userProfile?.displayName || '') + '!');
  } else {
    notify('✗ Password salah.');
    document.getElementById('admin-pass').value = '';
  }
}
window.adminLogin = adminLogin;

async function adminLogout() {
  isAdmin = false;
  if (currentUser) await deleteDoc(doc(db, COL.adminSessions, currentUser.uid)).catch(() => {});
  document.getElementById('admin-panel-wrap').style.display  = 'none';
  document.getElementById('admin-login-wrap').style.display  = 'block';
  document.getElementById('admin-need-login').style.display  = 'none';
  notify('✓ Keluar dari mode admin.');
}
window.adminLogout = adminLogout;

function showAdminPanel() {
  document.getElementById('admin-need-login').style.display  = 'none';
  document.getElementById('admin-login-wrap').style.display  = 'none';
  document.getElementById('admin-panel-wrap').style.display  = 'block';
  document.getElementById('bg-url').value            = SETTINGS.bgUrl || '';
  document.getElementById('donate-url-input').value  = SETTINGS.donateUrl || '';
  document.getElementById('admin-wa-input').value    = SETTINGS.adminWa || '';
  renderAdminToggleBtn();
  listenAdminOrders();
  listenAdminProducts();
  listenAdminQA();
  generateNextCode();
}

// ── NAVIGATION ───────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  const target = document.getElementById('page-' + name);
  if (target) { target.classList.add('active'); window.scrollTo(0, 0); }

  if (name === 'admin') {
    if (!currentUser) {
      document.getElementById('admin-need-login').style.display  = 'block';
      document.getElementById('admin-login-wrap').style.display  = 'none';
      document.getElementById('admin-panel-wrap').style.display  = 'none';
    } else if (isAdmin) {
      showAdminPanel();
    } else {
      document.getElementById('admin-need-login').style.display  = 'none';
      document.getElementById('admin-login-wrap').style.display  = 'block';
      document.getElementById('admin-panel-wrap').style.display  = 'none';
      const el = document.getElementById('admin-login-name');
      if (el) el.textContent = userProfile?.displayName || '';
    }
  }
  if (name === 'pesanan') listenUserOrders(); // FIX: pakai listener, bukan render sekali
  if (name === 'order')   initOrderPage();
}
window.showPage = showPage;

function goToOrder() {
  if (!currentUser) { openModal('modal-login'); return; }
  showPage('order');
}
window.goToOrder = goToOrder;

function handleAdminBtn() { showPage('admin'); }
window.handleAdminBtn = handleAdminBtn;

// ── ADMIN STATUS ─────────────────────────
function listenAdminStatus() {
  onSnapshot(doc(db, COL.settings, 'main'), snap => {
    if (!snap.exists()) return;
    const online = snap.data().adminOnline || false;
    SETTINGS.adminOnline = online;
    const dot = document.getElementById('badge-dot');
    const txt = document.getElementById('badge-text');
    if (dot) dot.style.background = online ? 'var(--accent3)' : '#ff4444';
    if (txt) txt.textContent = online ? 'Admin Aktif' : 'Admin Tidak Aktif';
    renderAdminToggleBtn();
  });
}

function renderAdminToggleBtn() {
  const btn = document.getElementById('admin-toggle-btn');
  if (!btn) return;
  if (SETTINGS.adminOnline) {
    btn.textContent = '🟢 Aktif';
    btn.className = 'btn btn-sm status-on';
  } else {
    btn.textContent = '🔴 Tidak Aktif';
    btn.className = 'btn btn-sm status-off';
  }
}

async function toggleAdminStatus() {
  await saveSettings({ adminOnline: !SETTINGS.adminOnline });
}
window.toggleAdminStatus = toggleAdminStatus;

// ── Q&A PUBLIC ───────────────────────────
function listenQAPublic() {
  onSnapshot(query(collection(db, COL.questions), orderBy('time', 'desc')), snap => {
    const answered = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(q => q.answer);
    renderQAPublic(answered);
  });
}

function renderQAPublic(list) {
  const container = document.getElementById('qa-public-list');
  const empty     = document.getElementById('qa-empty');
  container.querySelectorAll('.qa-item').forEach(el => el.remove());
  if (!list.length) { if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  list.forEach(q => {
    const div = document.createElement('div');
    div.className = 'qa-item';
    div.innerHTML = `
      <div class="qa-q">
        ${esc(q.question)}
        <small class="qa-author">— ${esc(q.name || 'Anonim')}</small>
      </div>
      <div class="qa-a">
        <span class="qa-admin-label">Admin · ${esc(q.adminName || 'HZTM')}</span>
        ${esc(q.answer)}
      </div>`;
    container.appendChild(div);
  });
}

// ── PRODUCTS ─────────────────────────────
function listenProducts() {
  onSnapshot(query(collection(db, COL.products), orderBy('codeNum', 'asc')), snap => {
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts(allProducts);
  });
}

function renderProducts(products) {
  const container = document.getElementById('product-list');
  if (!products.length) {
    container.innerHTML = `
      <div class="empty-state">// BELUM ADA PRODUK —<br>Admin belum menambahkan produk.</div>`;
    return;
  }
  container.innerHTML = products.map(p => {
    const habis = (p.stockQty || 0) <= 0;
    return `
    <div class="product-card${habis ? ' card-out' : ''}">
      <div class="product-img">
        ${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"/>` : `<span class="no-img">[ NO IMAGE ]</span>`}
        ${habis ? `<div class="out-overlay">HABIS</div>` : ''}
      </div>
      <div class="product-body">
        <div class="product-code">${esc(p.code)}</div>
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-desc">${esc(p.desc) || '—'}</div>
        <div class="product-footer">
          <div class="product-price">${formatRp(p.price)}</div>
          <span class="product-stock ${habis ? 'stock-empty' : 'stock-available'}">
            ${habis ? 'HABIS' : 'TERSEDIA · ' + p.stockQty}
          </span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── ORDER ────────────────────────────────
function initOrderPage() {
  orderItems = [];
  ['order-wa', 'order-address', 'order-rtrw', 'order-patokan', 'order-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // prefill WA jika ada di profile
  addOrderItem();
}

function addOrderItem() {
  orderItems.push({ productId: '', code: '', name: '', price: 0, qty: 1, stock: 0 });
  renderOrderItems();
}
window.addOrderItem = addOrderItem;

function removeOrderItem(idx) {
  orderItems.splice(idx, 1);
  renderOrderItems();
}
window.removeOrderItem = removeOrderItem;

function renderOrderItems() {
  const container = document.getElementById('order-items-list');
  const avail     = allProducts.filter(p => (p.stockQty || 0) > 0);

  container.innerHTML = orderItems.map((item, idx) => `
    <div class="order-item-row">
      <div class="order-item-header">
        <span class="order-item-label">PRODUK ${idx + 1}</span>
        ${orderItems.length > 1
          ? `<button class="btn-remove-item" onclick="removeOrderItem(${idx})">✕ Hapus</button>`
          : ''}
      </div>
      <select class="form-input form-select" onchange="selectProduct(${idx}, this.value)">
        <option value="">— Pilih Produk —</option>
        ${avail.map(p => `
          <option value="${p.id}" ${item.productId === p.id ? 'selected' : ''}>
            ${esc(p.code)} — ${esc(p.name)} (Stok: ${p.stockQty})
          </option>`).join('')}
      </select>
      ${item.productId ? `
        <div class="order-item-detail">
          <div class="order-qty-wrap">
            <label class="form-label" style="margin-bottom:4px;">JUMLAH (maks: ${item.stock})</label>
            <input type="number" class="form-input" value="${item.qty}" min="1" max="${item.stock}"
              onchange="updateQty(${idx}, this.value)"/>
          </div>
          <div class="order-subtotal">
            <div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:2px;">Subtotal</div>
            <div class="subtotal-price">${formatRp(item.price * item.qty)}</div>
          </div>
        </div>` : ''}
    </div>`).join('');

  updateOrderTotal();
}

function selectProduct(idx, productId) {
  const p = allProducts.find(p => p.id === productId);
  orderItems[idx] = p
    ? { productId: p.id, code: p.code, name: p.name, price: p.price, qty: 1, stock: p.stockQty }
    : { productId: '', code: '', name: '', price: 0, qty: 1, stock: 0 };
  renderOrderItems();
}
window.selectProduct = selectProduct;

function updateQty(idx, val) {
  let qty = parseInt(val) || 1;
  qty = Math.max(1, Math.min(qty, orderItems[idx].stock));
  orderItems[idx].qty = qty;
  updateOrderTotal();
}
window.updateQty = updateQty;

function updateOrderTotal() {
  const total   = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
  const box     = document.getElementById('order-total-box');
  const priceEl = document.getElementById('order-total-price');
  const hasItem = orderItems.some(i => i.productId);
  if (box) box.style.display = hasItem ? 'block' : 'none';
  if (priceEl) priceEl.textContent = formatRp(total);
}

async function submitOrder() {
  if (!currentUser) { openModal('modal-login'); return; }
  const wa      = document.getElementById('order-wa').value.trim();
  const address = document.getElementById('order-address').value.trim();
  const rtrw    = document.getElementById('order-rtrw').value.trim();
  const patokan = document.getElementById('order-patokan').value.trim();
  const note    = document.getElementById('order-note').value.trim();

  if (!wa)      { notify('⚠ Nomor WhatsApp wajib diisi.'); return; }
  if (!address) { notify('⚠ Alamat wajib diisi.'); return; }

  const validItems = orderItems.filter(i => i.productId);
  if (!validItems.length) { notify('⚠ Pilih minimal 1 produk.'); return; }

  // merge produk sama
  const merged = {};
  for (const item of validItems) {
    if (merged[item.productId]) merged[item.productId].qty += item.qty;
    else merged[item.productId] = { ...item };
  }
  const finalItems = Object.values(merged);

  // cek stok
  for (const item of finalItems) {
    const p = allProducts.find(p => p.id === item.productId);
    if (!p || (p.stockQty || 0) < item.qty) {
      notify(`⚠ Stok ${item.code} tidak cukup (tersedia: ${p?.stockQty || 0}).`);
      return;
    }
  }

  const total       = finalItems.reduce((s, i) => s + i.price * i.qty, 0);
  const fullAddress = [address, rtrw, patokan, 'Kecamatan Lawang, Kabupaten Malang'].filter(Boolean).join(', ');

  const btn = document.getElementById('btn-submit-order');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  try {
    // kurangi stok
    for (const item of finalItems) {
      const p = allProducts.find(p => p.id === item.productId);
      await updateDoc(doc(db, COL.products, item.productId), { stockQty: (p.stockQty || 0) - item.qty });
    }
    await addDoc(collection(db, COL.orders), {
      uid: currentUser.uid,
      userName: userProfile?.displayName || 'User',
      wa, address: fullAddress, note,
      items: finalItems.map(i => ({ productId: i.productId, code: i.code, name: i.name, price: i.price, qty: i.qty })),
      total, status: 'baru',
      time: serverTimestamp(),
      userDeleted: false, notifRead: false,
      cancelRequest: false, userConfirmDone: false
    });
    showPage('home');
    notify('✓ Pesanan berhasil dikirim! Cek status di "Pesanan Saya".', 6000);
  } catch (e) {
    console.error(e);
    notify('✗ Gagal mengirim pesanan. Coba lagi.');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}
window.submitOrder = submitOrder;

// ── PESANAN SAYA ─────────────────────────
// FIX: gunakan persistent listener, unsubscribe saat ganti halaman
function listenUserOrders() {
  if (!currentUser) { showPage('home'); openModal('modal-login'); return; }

  // unsubscribe listener lama sebelum buat baru
  if (_unsubUserOrders) { _unsubUserOrders(); _unsubUserOrders = null; }

  const container = document.getElementById('pesanan-list');
  container.innerHTML = `<div class="loading-state">Memuat pesanan...</div>`;

  const q = query(collection(db, COL.orders), where('uid', '==', currentUser.uid), orderBy('time', 'desc'));
  _unsubUserOrders = onSnapshot(q, async snap => {
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!orders.length) {
      container.innerHTML = `<div class="empty-state">// BELUM ADA PESANAN</div>`;
      return;
    }

    // mark notif as read
    orders
      .filter(o => !o.notifRead && (o.status === 'dikonfirmasi' || o.status === 'dibatalkan'))
      .forEach(o => updateDoc(doc(db, COL.orders, o.id), { notifRead: true }).catch(() => {}));

    // reload settings agar nomor admin selalu terbaru
    await loadSettings();

    container.innerHTML = orders.map(o => {
      const timeStr  = o.time?.toDate ? o.time.toDate().toLocaleString('id-ID') : '—';
      const elapsed  = o.time?.toDate ? Date.now() - o.time.toDate().getTime() : Infinity;
      const canEdit  = elapsed < 3_600_000 && o.status === 'baru';
      const canCancel = o.status === 'baru' && !o.cancelRequest;
      const canDone  = o.status === 'dikonfirmasi' && !o.userConfirmDone;

      return `
      <div class="pesanan-card">
        <div class="pesanan-header">
          <div>
            <div class="pesanan-time">${timeStr}</div>
            <div class="pesanan-id">#${o.id.slice(-6).toUpperCase()}</div>
          </div>
          <span class="status-badge status-${getStatusClass(o.status)}">${getStatusLabel(o.status)}</span>
        </div>

        <div class="pesanan-items">
          ${(o.items || []).map(item => `
            <div class="pesanan-item-row">
              <div>
                <span class="item-code">${esc(item.code)}</span>
                <span class="item-name">${esc(item.name)}</span>
                <span class="item-qty"> ×${item.qty}</span>
              </div>
              <div class="item-subtotal">${formatRp(item.price * item.qty)}</div>
            </div>`).join('')}
          <div class="pesanan-total-row">
            <span>TOTAL</span>
            <span class="pesanan-total-price">${formatRp(o.total)}</span>
          </div>
        </div>

        <div class="pesanan-detail">
          <div>📍 ${esc(o.address)}</div>
          <div>📱 ${esc(o.wa)}</div>
          ${o.note ? `<div>📝 ${esc(o.note)}</div>` : ''}
        </div>

        ${canEdit ? `
          <div class="pesanan-edit-addr">
            <label class="form-label" style="margin-bottom:6px;">Edit Alamat <span style="color:var(--accent2);font-size:0.65rem;">(dalam 1 jam)</span></label>
            <input type="text" class="form-input" id="edit-addr-${o.id}"
              value="${esc(o.address.replace(', Kecamatan Lawang, Kabupaten Malang', ''))}"
              style="font-size:0.85rem;margin-bottom:6px;"/>
            <button class="btn btn-secondary btn-sm" onclick="saveEditAddress('${o.id}')">Simpan Alamat</button>
          </div>` : ''}

        ${o.status === 'dikonfirmasi' ? `
          <div class="pesanan-admin-contact">
            <div class="contact-label">HUBUNGI ADMIN</div>
            <a href="https://wa.me/62${(SETTINGS.adminWa || '').replace(/^0/, '')}" target="_blank" class="contact-wa">
              📱 ${esc(SETTINGS.adminWa || '—')}
            </a>
          </div>` : ''}

        ${o.cancelRequest ? `<div class="pesanan-info-warn">⏳ Pembatalan sedang menunggu konfirmasi admin</div>` : ''}
        ${o.userConfirmDone && o.status === 'dikonfirmasi' ? `<div class="pesanan-info-ok">✓ Konfirmasi selesai dikirim — menunggu admin</div>` : ''}

        <div class="action-btns" style="margin-top:0.75rem;">
          ${canCancel ? `<button class="btn btn-sm btn-cancel-order" onclick="requestCancel('${o.id}')">Ajukan Pembatalan</button>` : ''}
          ${canDone   ? `<button class="btn btn-sm btn-done-order" onclick="requestDone('${o.id}')">✓ Pesanan Selesai</button>` : ''}
        </div>
      </div>`;
    }).join('');
  });
}

async function saveEditAddress(orderId) {
  const input = document.getElementById('edit-addr-' + orderId);
  if (!input) return;
  const newAddr = input.value.trim() + ', Kecamatan Lawang, Kabupaten Malang';
  try {
    await updateDoc(doc(db, COL.orders, orderId), { address: newAddr });
    notify('✓ Alamat berhasil diperbarui.');
  } catch (e) { notify('✗ Gagal memperbarui alamat.'); }
}
window.saveEditAddress = saveEditAddress;

function requestCancel(orderId) {
  document.getElementById('cancel-order-id').value = orderId;
  document.getElementById('cancel-reason').value   = '';
  openModal('modal-cancel-order');
}
window.requestCancel = requestCancel;

async function submitCancelRequest() {
  const orderId = document.getElementById('cancel-order-id').value;
  const reason  = document.getElementById('cancel-reason').value.trim();
  if (!reason) { notify('⚠ Tulis alasan pembatalan.'); return; }
  try {
    await updateDoc(doc(db, COL.orders, orderId), { cancelRequest: true, cancelReason: reason });
    closeModal('modal-cancel-order');
    notify('✓ Permintaan pembatalan dikirim ke admin.');
  } catch (e) { notify('✗ Gagal mengajukan pembatalan.'); }
}
window.submitCancelRequest = submitCancelRequest;

async function requestDone(orderId) {
  try {
    await updateDoc(doc(db, COL.orders, orderId), { userConfirmDone: true });
    notify('✓ Konfirmasi selesai terkirim. Menunggu verifikasi admin.');
  } catch (e) { notify('✗ Gagal mengirim konfirmasi.'); }
}
window.requestDone = requestDone;

// ── BANTUAN ──────────────────────────────
async function submitQuestion() {
  if (!currentUser) { openModal('modal-login'); return; }
  const question = document.getElementById('qa-question').value.trim();
  if (!question) { notify('⚠ Pertanyaan tidak boleh kosong.'); return; }
  const btn = document.getElementById('btn-submit-qa');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  try {
    await addDoc(collection(db, COL.questions), {
      uid: currentUser.uid,
      name: userProfile?.displayName || 'Anonim',
      question, answer: null, adminName: null,
      time: serverTimestamp()
    });
    document.getElementById('qa-question').value = '';
    notify('✓ Pertanyaan terkirim!');
  } catch (e) { notify('✗ Gagal mengirim pertanyaan.'); }
  finally { if (btn) { btn.disabled = false; btn.style.opacity = '1'; } }
}
window.submitQuestion = submitQuestion;

// ── DONATE ───────────────────────────────
function handleDonateClick(e) {
  if (!SETTINGS.donateUrl) { e.preventDefault(); notify('⚠ Link donasi belum diatur admin.'); return; }
  document.getElementById('donate-link').href = SETTINGS.donateUrl;
}
window.handleDonateClick = handleDonateClick;

function applyBg() {
  const img = document.getElementById('hero-bg-img');
  if (SETTINGS.bgUrl && img) { img.src = SETTINGS.bgUrl; img.style.display = 'block'; }
}

// ── ADMIN: ORDERS ────────────────────────
let _unsubAdminOrders = null;
function listenAdminOrders() {
  if (_unsubAdminOrders) _unsubAdminOrders();
  _unsubAdminOrders = onSnapshot(
    query(collection(db, COL.orders), orderBy('time', 'desc')),
    snap => renderAdminOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

function renderAdminOrders(orders) {
  const tbody = document.getElementById('orders-tbody');
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">Belum ada pesanan</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => {
    const timeStr  = o.time?.toDate ? o.time.toDate().toLocaleString('id-ID') : '—';
    const itemsStr = (o.items || []).map(i => `${i.code} ×${i.qty}`).join(', ');
    const flags = [
      o.cancelRequest  ? `<div class="flag-warn">⚠ Minta Batal: "${esc(o.cancelReason || '')}"</div>` : '',
      o.userConfirmDone ? `<div class="flag-ok">✓ User konfirmasi selesai</div>` : '',
      o.userDeleted    ? `<div class="flag-err">Akun dihapus</div>` : ''
    ].filter(Boolean).join('');

    return `<tr>
      <td class="td-mono">${timeStr}</td>
      <td>${esc(o.userName || '?')}</td>
      <td><a href="https://wa.me/62${(o.wa || '').replace(/^0/, '')}" target="_blank" class="link-wa">${esc(o.wa)}</a></td>
      <td class="td-mono">${itemsStr}</td>
      <td class="td-price">${formatRp(o.total)}</td>
      <td class="td-addr">${esc(o.address)}${flags}</td>
      <td><span class="status-badge status-${getStatusClass(o.status)}">${getStatusLabel(o.status)}</span></td>
      <td>
        <div class="action-btns">
          ${o.status === 'baru' ? `<button class="btn btn-primary btn-sm" onclick="adminConfirmOrder('${o.id}')">Konfirmasi</button>` : ''}
          ${o.cancelRequest && o.status !== 'dibatalkan' ? `<button class="btn btn-sm btn-cancel-order" onclick="adminCancelOrder('${o.id}')">Batalkan</button>` : ''}
          ${o.userConfirmDone && o.status === 'dikonfirmasi' ? `<button class="btn btn-sm btn-done-order" onclick="adminDoneOrder('${o.id}')">Selesai</button>` : ''}
          ${o.status !== 'dibatalkan' && o.status !== 'selesai' && !o.cancelRequest ? `<button class="btn btn-secondary btn-sm" onclick="adminForceCancel('${o.id}')" style="color:#ff4444;border-color:#ff4444;">Paksa Batal</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="deleteOrder('${o.id}')" style="color:var(--text-dim);border-color:#333;">Hapus</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function adminConfirmOrder(id) {
  await updateDoc(doc(db, COL.orders, id), { status: 'dikonfirmasi', notifRead: false });
  notify('✓ Pesanan dikonfirmasi.');
}
window.adminConfirmOrder = adminConfirmOrder;

async function adminCancelOrder(id) {
  await restoreStock(id);
  await updateDoc(doc(db, COL.orders, id), { status: 'dibatalkan', cancelRequest: false, notifRead: false });
  notify('✓ Pesanan dibatalkan.');
}
window.adminCancelOrder = adminCancelOrder;

async function adminForceCancel(id) {
  if (!confirm('Batalkan pesanan ini tanpa persetujuan user?')) return;
  await restoreStock(id);
  await updateDoc(doc(db, COL.orders, id), { status: 'dibatalkan', notifRead: false });
  notify('✓ Pesanan dibatalkan.');
}
window.adminForceCancel = adminForceCancel;

async function adminDoneOrder(id) {
  await updateDoc(doc(db, COL.orders, id), { status: 'selesai' });
  notify('✓ Pesanan selesai.');
}
window.adminDoneOrder = adminDoneOrder;

async function restoreStock(orderId) {
  try {
    const snap = await getDoc(doc(db, COL.orders, orderId));
    if (!snap.exists()) return;
    for (const item of (snap.data().items || [])) {
      const pSnap = await getDoc(doc(db, COL.products, item.productId));
      if (pSnap.exists()) {
        await updateDoc(doc(db, COL.products, item.productId), {
          stockQty: (pSnap.data().stockQty || 0) + item.qty
        });
      }
    }
  } catch (e) { console.error(e); }
}

async function deleteOrder(id) {
  if (!confirm('Hapus pesanan ini?')) return;
  await deleteDoc(doc(db, COL.orders, id));
  notify('✓ Pesanan dihapus.');
}
window.deleteOrder = deleteOrder;

// ── ADMIN: PRODUCTS ──────────────────────
let _unsubAdminProducts = null;
function listenAdminProducts() {
  if (_unsubAdminProducts) _unsubAdminProducts();
  _unsubAdminProducts = onSnapshot(
    query(collection(db, COL.products), orderBy('codeNum', 'asc')),
    snap => renderAdminProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

function renderAdminProducts(products) {
  const tbody = document.getElementById('products-tbody');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Belum ada produk</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td class="td-mono td-accent">${esc(p.code)}</td>
      <td>${esc(p.name)}</td>
      <td class="td-price">${formatRp(p.price)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span class="product-stock ${(p.stockQty || 0) <= 0 ? 'stock-empty' : 'stock-available'}">
            ${(p.stockQty || 0) <= 0 ? 'HABIS' : p.stockQty}
          </span>
          <input type="number" min="0" value="${p.stockQty || 0}"
            class="stock-input" onchange="updateStock('${p.id}', this.value)"/>
        </div>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="deleteProduct('${p.id}')" style="color:#ff4444;border-color:#ff4444;">Hapus</button>
        </div>
      </td>
    </tr>`).join('');
}

async function updateStock(id, val) {
  await updateDoc(doc(db, COL.products, id), { stockQty: parseInt(val) || 0 });
}
window.updateStock = updateStock;

async function generateNextCode() {
  try {
    const snap = await getDocs(collection(db, COL.products));
    const used = new Set(snap.docs.map(d => d.data().codeNum || 0));
    let next = 1;
    while (used.has(next)) next++;
    const el = document.getElementById('p-code');
    if (el && !document.getElementById('edit-product-id').value) {
      el.value = 'HZTM-' + String(next).padStart(3, '0');
      el.dataset.codeNum = next;
    }
  } catch (e) {}
}

function previewImg(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('img-preview').src = ev.target.result;
    document.getElementById('img-preview').style.display = 'block';
    document.getElementById('p-img-data').value = ev.target.result;
  };
  reader.readAsDataURL(file);
}
window.previewImg = previewImg;

async function saveProduct() {
  const id       = document.getElementById('edit-product-id').value;
  const codeEl   = document.getElementById('p-code');
  const code     = codeEl.value.trim();
  const codeNum  = parseInt(codeEl.dataset.codeNum) || 0;
  const name     = document.getElementById('p-name').value.trim();
  const price    = parseInt(document.getElementById('p-price').value) || 0;
  const stockQty = parseInt(document.getElementById('p-stock-qty').value) || 0;
  const desc     = document.getElementById('p-desc').value.trim();
  const img      = document.getElementById('p-img-data').value;

  if (!name)  { notify('⚠ Nama produk wajib diisi.'); return; }
  if (!price) { notify('⚠ Harga wajib diisi.'); return; }

  const btn = document.getElementById('btn-save-product');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  try {
    if (id) {
      const existing = await getDoc(doc(db, COL.products, id));
      const existImg = existing.data()?.img || '';
      await updateDoc(doc(db, COL.products, id), { name, price, stockQty, desc, img: img || existImg });
    } else {
      await addDoc(collection(db, COL.products), { code, codeNum, name, price, stockQty, desc, img, time: serverTimestamp() });
    }
    cancelEdit();
    notify('✓ Produk berhasil disimpan!');
  } catch (e) { console.error(e); notify('✗ Gagal menyimpan produk.'); }
  finally { if (btn) { btn.disabled = false; btn.style.opacity = '1'; } }
}
window.saveProduct = saveProduct;

function editProduct(id) {
  // FIX: switch tab tanpa pakai global event
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-tab')[2].classList.add('active');
  document.getElementById('tab-tambah-produk').classList.add('active');

  getDoc(doc(db, COL.products, id)).then(snap => {
    if (!snap.exists()) return;
    const p = snap.data();
    document.getElementById('add-product-title').textContent = 'EDIT PRODUK';
    document.getElementById('edit-product-id').value = id;
    const codeEl = document.getElementById('p-code');
    codeEl.value = p.code || ''; codeEl.dataset.codeNum = p.codeNum || 0;
    document.getElementById('p-name').value      = p.name || '';
    document.getElementById('p-price').value     = p.price || '';
    document.getElementById('p-stock-qty').value = p.stockQty || 0;
    document.getElementById('p-desc').value      = p.desc || '';
    document.getElementById('p-img-data').value  = '';
    const prev = document.getElementById('img-preview');
    if (p.img) { prev.src = p.img; prev.style.display = 'block'; }
    else prev.style.display = 'none';
  });
}
window.editProduct = editProduct;

async function deleteProduct(id) {
  if (!confirm('Hapus produk ini?')) return;
  await deleteDoc(doc(db, COL.products, id));
  notify('✓ Produk dihapus.');
  generateNextCode();
}
window.deleteProduct = deleteProduct;

function cancelEdit() {
  document.getElementById('add-product-title').textContent = 'TAMBAH PRODUK BARU';
  document.getElementById('edit-product-id').value = '';
  ['p-name', 'p-price', 'p-desc', 'p-img-data'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('p-stock-qty').value = '0';
  document.getElementById('img-preview').style.display = 'none';
  document.getElementById('p-img-input').value = '';
  generateNextCode();
}
window.cancelEdit = cancelEdit;

// ── ADMIN: Q&A ───────────────────────────
let _unsubAdminQA = null;
function listenAdminQA() {
  if (_unsubAdminQA) _unsubAdminQA();
  _unsubAdminQA = onSnapshot(
    query(collection(db, COL.questions), orderBy('time', 'desc')),
    snap => renderAdminQA(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

function renderAdminQA(questions) {
  const container = document.getElementById('qa-admin-list');
  if (!questions.length) {
    container.innerHTML = `<p class="td-empty">Belum ada pertanyaan</p>`;
    return;
  }
  container.innerHTML = questions.map(q => {
    const timeStr = q.time?.toDate ? q.time.toDate().toLocaleString('id-ID') : '—';
    return `
    <div class="qa-item" style="margin-bottom:1rem;">
      <div class="qa-admin-header">
        <div>
          <div class="qa-q">${esc(q.question)}</div>
          <div class="qa-meta">— ${esc(q.name || 'Anonim')} · ${timeStr}</div>
        </div>
        <span class="status-badge ${q.answer ? 'status-answered' : 'status-new'}">${q.answer ? 'DIJAWAB' : 'BARU'}</span>
      </div>
      ${q.answer ? `
        <div class="qa-a" style="margin-bottom:0.75rem;">
          <span class="qa-admin-label">Admin · ${esc(q.adminName || 'HZTM')}</span>
          ${esc(q.answer)}
        </div>` : ''}
      <div class="action-btns">
        <button class="btn btn-primary btn-sm" onclick="openAnswerModal('${q.id}')">${q.answer ? 'Edit Jawaban' : 'Jawab'}</button>
        <button class="btn btn-secondary btn-sm" onclick="deleteQuestion('${q.id}')" style="color:#ff4444;border-color:#ff4444;">Hapus</button>
      </div>
    </div>`;
  }).join('');
}

function openAnswerModal(id) {
  getDoc(doc(db, COL.questions, id)).then(snap => {
    if (!snap.exists()) return;
    const q = snap.data();
    document.getElementById('modal-qa-id').value        = id;
    document.getElementById('modal-question').textContent = q.question;
    document.getElementById('modal-answer').value       = q.answer || '';
    openModal('modal-overlay');
  });
}
window.openAnswerModal = openAnswerModal;

async function submitAnswer() {
  const id     = document.getElementById('modal-qa-id').value;
  const answer = document.getElementById('modal-answer').value.trim();
  if (!answer) { notify('⚠ Jawaban tidak boleh kosong.'); return; }
  const adminName = userProfile?.displayName || 'Admin';
  await updateDoc(doc(db, COL.questions, id), { answer, adminName });
  closeModal('modal-overlay');
  notify('✓ Jawaban disimpan!');
}
window.submitAnswer = submitAnswer;

async function deleteQuestion(id) {
  if (!confirm('Hapus pertanyaan ini?')) return;
  await deleteDoc(doc(db, COL.questions, id));
  notify('✓ Pertanyaan dihapus.');
}
window.deleteQuestion = deleteQuestion;

// ── ADMIN: SETTINGS ──────────────────────
async function changePassword() {
  const np = document.getElementById('new-pass').value;
  const cp = document.getElementById('confirm-pass').value;
  if (!np || np.length < 4) { notify('⚠ Password minimal 4 karakter.'); return; }
  if (np !== cp) { notify('⚠ Konfirmasi password tidak cocok.'); return; }
  const newVer = (SETTINGS.passwordVersion || 0) + 1;
  await saveSettings({ password: np, passwordVersion: newVer });
  const snap = await getDocs(collection(db, COL.adminSessions));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  isAdmin = false;
  document.getElementById('new-pass').value   = '';
  document.getElementById('confirm-pass').value = '';
  notify('✓ Password diubah. Semua admin telah di-logout.');
  showPage('home');
}
window.changePassword = changePassword;

async function saveBgUrl() {
  await saveSettings({ bgUrl: document.getElementById('bg-url').value.trim() });
  applyBg();
  notify('✓ Background diperbarui!');
}
window.saveBgUrl = saveBgUrl;

async function saveDonateUrl() {
  await saveSettings({ donateUrl: document.getElementById('donate-url-input').value.trim() });
  notify('✓ Link donasi disimpan!');
}
window.saveDonateUrl = saveDonateUrl;

async function saveAdminWa() {
  await saveSettings({ adminWa: document.getElementById('admin-wa-input').value.trim() });
  notify('✓ Nomor admin disimpan!');
}
window.saveAdminWa = saveAdminWa;

// ── ADMIN TABS ───────────────────────────
// FIX: tidak pakai global event, pakai parameter el
function switchAdminTab(name, el) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  if (el) el.classList.add('active');
  const sec = document.getElementById('tab-' + name);
  if (sec) sec.classList.add('active');
  if (name === 'tambah-produk') generateNextCode();
}
window.switchAdminTab = switchAdminTab;

// ── MODAL ────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
window.openModal         = openModal;
window.closeModal        = closeModal;
window.closeModalLogin   = () => closeModal('modal-login');

// ── NOTIFY ───────────────────────────────
function notify(msg, duration = 4500) {
  const el = document.getElementById('notif');
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

// ── HELPERS ──────────────────────────────
function getStatusClass(s) {
  const map = { dikonfirmasi: 'confirmed', dibatalkan: 'cancelled', selesai: 'done' };
  return map[s] || 'new';
}
function getStatusLabel(s) {
  const map = { baru: 'BARU', dikonfirmasi: 'DIKONFIRMASI', dibatalkan: 'DIBATALKAN', selesai: 'SELESAI', 'minta-batal': 'MINTA BATAL' };
  return map[s] || s.toUpperCase();
}
function formatRp(val) {
  return 'Rp ' + (parseInt(val) || 0).toLocaleString('id-ID');
}
function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
