/* ════════════════════════════════════════
   HZTM — Horizon Zetta Teknologi Mandiri
   app.js — Full Featured + Firebase Auth
   ════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, where, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, deleteUser
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

// ── CONFIG ───────────────────────────────
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

const COL = { products:'products', orders:'orders', questions:'questions', settings:'settings', users:'users', adminSessions:'adminSessions' };

// ── STATE ────────────────────────────────
let currentUser   = null;  // Firebase Auth user
let userProfile   = null;  // Firestore user doc
let isAdmin       = false;
let SETTINGS      = { password:'hztm2026', bgUrl:'', donateUrl:'', adminWa:'081235487980', adminOnline:false, passwordVersion:0 };
let allProducts   = [];
let orderItems    = [];    // [{productId, code, name, price, qty, stock}]

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
      checkAdminSession();
    } else {
      currentUser  = null;
      userProfile  = null;
      isAdmin      = false;
      renderNavUser();
    }
  });

  // close dropdown on outside click
  document.addEventListener('click', e => {
    const dd = document.getElementById('user-dropdown');
    const btn = document.getElementById('nav-user-btn');
    if (!dd.contains(e.target) && !btn.contains(e.target)) dd.style.display = 'none';
  });
});

// ── SETTINGS ─────────────────────────────
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, COL.settings, 'main'));
    if (snap.exists()) SETTINGS = { ...SETTINGS, ...snap.data() };
  } catch(e) {}
}

async function saveSettings(data) {
  try {
    await setDoc(doc(db, COL.settings, 'main'), data, { merge: true });
    SETTINGS = { ...SETTINGS, ...data };
  } catch(e) { notify('✗ Gagal menyimpan pengaturan.'); }
}

// ── USER PROFILE ─────────────────────────
async function loadOrCreateUserProfile(user) {
  const ref  = doc(db, COL.users, user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    userProfile = snap.data();
    // check if needs name
    if (!userProfile.displayName) openModalId('modal-setname');
  } else {
    // new user — ask for name
    userProfile = { uid: user.uid, email: user.email, photo: user.photoURL || '', displayName: '', createdAt: serverTimestamp(), deleted: false };
    await setDoc(ref, userProfile);
    openModalId('modal-setname');
  }
}

async function saveDisplayName() {
  const name = document.getElementById('input-displayname').value.trim();
  if (!name) { notify('⚠ Nama tidak boleh kosong.'); return; }
  try {
    await updateDoc(doc(db, COL.users, currentUser.uid), { displayName: name });
    userProfile.displayName = name;
    closeModalId('modal-setname');
    renderNavUser();
    notify(`✓ Selamat datang, ${name}!`);
  } catch(e) { notify('✗ Gagal menyimpan nama.'); }
}
window.saveDisplayName = saveDisplayName;

// ── NAV USER AREA ────────────────────────
function renderNavUser() {
  const area = document.getElementById('nav-user-btn');
  if (!currentUser || !userProfile) {
    area.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="openModalId('modal-login')">Login</button>`;
  } else {
    const photo = userProfile.photo || currentUser.photoURL || '';
    const name  = userProfile.displayName || currentUser.displayName || 'User';
    area.innerHTML = `
      <button class="nav-user-toggle" onclick="toggleDropdown()">
        ${photo ? `<img src="${photo}" alt="" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);"/>` : `<div style="width:28px;height:28px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem;color:var(--bg-deep);">${name[0].toUpperCase()}</div>`}
        <span style="font-size:0.82rem;font-weight:600;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(name)}</span>
        <span style="font-size:0.6rem;color:var(--text-dim);">▾</span>
      </button>`;
    // fill dropdown
    document.getElementById('ud-name').textContent  = name;
    document.getElementById('ud-email').textContent = currentUser.email;
    if (photo) document.getElementById('ud-photo').src = photo;
    // logout button — disable if active orders
  }
}

function toggleDropdown() {
  const dd = document.getElementById('user-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}
window.toggleDropdown = toggleDropdown;

function closeDropdown() {
  document.getElementById('user-dropdown').style.display = 'none';
}
window.closeDropdown = closeDropdown;

// ── AUTH ─────────────────────────────────
async function loginGoogle() {
  try {
    await signInWithPopup(auth, provider);
    closeModalId('modal-login');
  } catch(e) { notify('✗ Login gagal. Coba lagi.'); }
}
window.loginGoogle = loginGoogle;

async function logoutUser() {
  // check active orders
  if (currentUser) {
    const snap = await getDocs(query(collection(db, COL.orders), where('uid','==',currentUser.uid), where('status','in',['baru','dikonfirmasi','minta-batal'])));
    if (!snap.empty) { notify('⚠ Kamu tidak bisa logout saat masih ada pesanan aktif.'); closeDropdown(); return; }
  }
  isAdmin = false;
  await signOut(auth);
  closeDropdown();
  showPage('home');
  notify('✓ Logout berhasil.');
}
window.logoutUser = logoutUser;

async function confirmDeleteAccount() {
  closeDropdown();
  // check all orders done
  if (currentUser) {
    const snap = await getDocs(query(collection(db, COL.orders), where('uid','==',currentUser.uid), where('status','in',['baru','dikonfirmasi','minta-batal'])));
    if (!snap.empty) { notify('⚠ Hapus akun hanya bisa jika semua pesanan sudah selesai atau dibatalkan.'); return; }
  }
  openModalId('modal-delete-account');
}
window.confirmDeleteAccount = confirmDeleteAccount;

async function deleteAccount() {
  if (!currentUser) return;
  try {
    // mark orders as deleted user
    const snap = await getDocs(query(collection(db, COL.orders), where('uid','==',currentUser.uid)));
    const batch = snap.docs.map(d => updateDoc(doc(db, COL.orders, d.id), { userDeleted: true, userName: (userProfile?.displayName||'?') + ' (akun dihapus)' }));
    await Promise.all(batch);
    // delete user doc
    await deleteDoc(doc(db, COL.users, currentUser.uid));
    // delete firebase auth user
    await deleteUser(currentUser);
    closeModalId('modal-delete-account');
    showPage('home');
    notify('✓ Akun berhasil dihapus.');
  } catch(e) { notify('✗ Gagal hapus akun. Coba login ulang lalu hapus lagi.'); }
}
window.deleteAccount = deleteAccount;

// ── ADMIN AUTH ───────────────────────────
async function checkAdminSession() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db, COL.adminSessions, currentUser.uid));
    if (snap.exists()) {
      const s = snap.data();
      if (s.passwordVersion === SETTINGS.passwordVersion) {
        isAdmin = true;
        if (document.getElementById('page-admin').classList.contains('active')) showAdminPanel();
      }
    }
  } catch(e) {}
}

function handleAdminBtn() {
  showPage('admin');
}
window.handleAdminBtn = handleAdminBtn;

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  const target = document.getElementById('page-' + name);
  if (target) { target.classList.add('active'); window.scrollTo(0,0); }

  if (name === 'admin') {
    if (!currentUser) {
      document.getElementById('admin-need-login').style.display = 'block';
      document.getElementById('admin-login-wrap').style.display = 'none';
      document.getElementById('admin-panel-wrap').style.display = 'none';
    } else if (isAdmin) {
      showAdminPanel();
    } else {
      document.getElementById('admin-need-login').style.display = 'none';
      document.getElementById('admin-login-wrap').style.display = 'block';
      document.getElementById('admin-panel-wrap').style.display = 'none';
      document.getElementById('admin-login-name').textContent = userProfile?.displayName || currentUser.displayName || '';
    }
  }
  if (name === 'pesanan') renderUserOrders();
  if (name === 'order')   initOrderPage();
}
window.showPage = showPage;

async function adminLogin() {
  const pass = document.getElementById('admin-pass').value;
  await loadSettings();
  if (pass === SETTINGS.password) {
    isAdmin = true;
    // save session
    await setDoc(doc(db, COL.adminSessions, currentUser.uid), { passwordVersion: SETTINGS.passwordVersion || 0, uid: currentUser.uid });
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
  if (currentUser) await deleteDoc(doc(db, COL.adminSessions, currentUser.uid));
  document.getElementById('admin-panel-wrap').style.display = 'none';
  document.getElementById('admin-login-wrap').style.display = 'block';
  notify('✓ Keluar dari mode admin.');
}
window.adminLogout = adminLogout;

function showAdminPanel() {
  document.getElementById('admin-need-login').style.display = 'none';
  document.getElementById('admin-login-wrap').style.display = 'none';
  document.getElementById('admin-panel-wrap').style.display = 'block';
  document.getElementById('bg-url').value = SETTINGS.bgUrl || '';
  document.getElementById('donate-url-input').value = SETTINGS.donateUrl || '';
  document.getElementById('admin-wa-input').value = SETTINGS.adminWa || '';
  renderAdminToggleBtn();
  listenAdminOrders();
  listenAdminProducts();
  listenAdminQA();
  generateNextCode();
}

// ── ADMIN STATUS TOGGLE ──────────────────
function listenAdminStatus() {
  onSnapshot(doc(db, COL.settings, 'main'), snap => {
    if (snap.exists()) {
      const online = snap.data().adminOnline || false;
      const dot    = document.getElementById('badge-dot');
      const txt    = document.getElementById('badge-text');
      if (dot) dot.style.background = online ? 'var(--accent3)' : '#ff4444';
      if (txt) txt.textContent = online ? 'Admin Aktif' : 'Admin Tidak Aktif';
      SETTINGS.adminOnline = online;
      renderAdminToggleBtn();
    }
  });
}

function renderAdminToggleBtn() {
  const btn = document.getElementById('admin-toggle-btn');
  if (!btn) return;
  if (SETTINGS.adminOnline) {
    btn.textContent = '🟢 Aktif';
    btn.style.background = 'rgba(127,255,0,0.15)';
    btn.style.color = 'var(--accent3)';
    btn.style.border = '1px solid var(--accent3)';
  } else {
    btn.textContent = '🔴 Tidak Aktif';
    btn.style.background = 'rgba(255,68,68,0.1)';
    btn.style.color = '#ff4444';
    btn.style.border = '1px solid #ff4444';
  }
}

async function toggleAdminStatus() {
  await saveSettings({ adminOnline: !SETTINGS.adminOnline });
}
window.toggleAdminStatus = toggleAdminStatus;

// ── REALTIME: Q&A PUBLIC ─────────────────
function listenQAPublic() {
  onSnapshot(query(collection(db, COL.questions), orderBy('time','desc')), snap => {
    const answered = snap.docs.map(d => ({id:d.id,...d.data()})).filter(q => q.answer);
    renderQAPublic(answered);
  });
}

function renderQAPublic(list) {
  const container = document.getElementById('qa-public-list');
  const empty     = document.getElementById('qa-empty');
  container.querySelectorAll('.qa-item').forEach(el => el.remove());
  if (!list.length) { if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  list.forEach(q => {
    const div = document.createElement('div');
    div.className = 'qa-item';
    div.innerHTML = `
      <div class="qa-q">${esc(q.question)}<small style="font-size:0.65rem;color:var(--text-dim);margin-left:auto;">— ${esc(q.name||'Anonim')}</small></div>
      <div class="qa-a"><strong style="color:var(--accent2);font-size:0.75rem;">Admin · ${esc(q.adminName||'HZTM')}</strong><br>${esc(q.answer)}</div>`;
    container.appendChild(div);
  });
}

// ── REALTIME: PRODUCTS ───────────────────
function listenProducts() {
  onSnapshot(query(collection(db, COL.products), orderBy('codeNum','asc')), snap => {
    allProducts = snap.docs.map(d => ({id:d.id,...d.data()}));
    renderProducts(allProducts);
  });
}

function renderProducts(products) {
  const container = document.getElementById('product-list');
  if (!products.length) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:0.8rem;border:1px dashed var(--border);">// BELUM ADA PRODUK</div>`;
    return;
  }
  container.innerHTML = products.map(p => {
    const stokHabis = (p.stockQty || 0) <= 0;
    return `
    <div class="product-card ${stokHabis?'card-out':''}">
      <div class="product-img">
        ${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"/>` : `<span>[ NO IMAGE ]</span>`}
        ${stokHabis ? `<div class="out-overlay">HABIS</div>` : ''}
      </div>
      <div class="product-body">
        <div class="product-code">${esc(p.code)}</div>
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-desc">${esc(p.desc)||'—'}</div>
        <div class="product-footer">
          <div class="product-price">${formatRp(p.price)}</div>
          <span class="product-stock ${stokHabis?'stock-empty':'stock-available'}">${stokHabis?'HABIS':'TERSEDIA · '+p.stockQty}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── ORDER PAGE ───────────────────────────
function goToOrder() {
  if (!currentUser) { openModalId('modal-login'); return; }
  showPage('order');
}
window.goToOrder = goToOrder;

function initOrderPage() {
  orderItems = [];
  document.getElementById('order-wa').value = '';
  document.getElementById('order-address').value = '';
  document.getElementById('order-rtrw').value = '';
  document.getElementById('order-patokan').value = '';
  document.getElementById('order-note').value = '';
  addOrderItem();
}

function addOrderItem() {
  const idx = orderItems.length;
  orderItems.push({ productId:'', code:'', name:'', price:0, qty:1, stock:0 });
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
  const avail = allProducts.filter(p => (p.stockQty||0) > 0);

  container.innerHTML = orderItems.map((item, idx) => `
    <div class="order-item-row" style="background:var(--bg-card);border:1px solid var(--border);padding:1rem;margin-bottom:0.75rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
        <span style="font-family:'Share Tech Mono',monospace;font-size:0.7rem;color:var(--accent);">PRODUK ${idx+1}</span>
        ${orderItems.length > 1 ? `<button class="btn btn-secondary btn-sm" onclick="removeOrderItem(${idx})" style="color:#ff4444;border-color:#ff4444;padding:2px 8px;font-size:0.7rem;">✕ Hapus</button>` : ''}
      </div>
      <select class="form-input form-select" onchange="selectProduct(${idx},this.value)" style="margin-bottom:0.5rem;">
        <option value="">— Pilih Produk —</option>
        ${avail.map(p => `<option value="${p.id}" ${item.productId===p.id?'selected':''}>${esc(p.code)} — ${esc(p.name)} (Stok: ${p.stockQty})</option>`).join('')}
      </select>
      ${item.productId ? `
        <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.5rem;">
          <div style="flex:1;">
            <div style="font-size:0.75rem;color:var(--text-dim);font-family:'Share Tech Mono',monospace;">JUMLAH (maks: ${item.stock})</div>
            <input type="number" class="form-input" value="${item.qty}" min="1" max="${item.stock}" onchange="updateQty(${idx},this.value)" style="margin-top:4px;"/>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.7rem;color:var(--text-dim);">Subtotal</div>
            <div style="font-family:'Orbitron',sans-serif;color:var(--accent3);font-size:0.95rem;">${formatRp(item.price * item.qty)}</div>
          </div>
        </div>` : ''}
    </div>
  `).join('');

  updateOrderTotal();
}

function selectProduct(idx, productId) {
  const p = allProducts.find(p => p.id === productId);
  if (!p) { orderItems[idx] = { productId:'', code:'', name:'', price:0, qty:1, stock:0 }; }
  else { orderItems[idx] = { productId: p.id, code: p.code, name: p.name, price: p.price, qty: 1, stock: p.stockQty }; }
  renderOrderItems();
}
window.selectProduct = selectProduct;

function updateQty(idx, val) {
  const item = orderItems[idx];
  let qty = parseInt(val) || 1;
  if (qty < 1) qty = 1;
  if (qty > item.stock) qty = item.stock;
  item.qty = qty;
  updateOrderTotal();
}
window.updateQty = updateQty;

function updateOrderTotal() {
  const total = orderItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const box   = document.getElementById('order-total-box');
  const el    = document.getElementById('order-total-price');
  const hasItems = orderItems.some(i => i.productId);
  box.style.display = hasItems ? 'block' : 'none';
  if (el) el.textContent = formatRp(total);
}

async function submitOrder() {
  if (!currentUser) { openModalId('modal-login'); return; }
  const wa      = document.getElementById('order-wa').value.trim();
  const address = document.getElementById('order-address').value.trim();
  const rtrw    = document.getElementById('order-rtrw').value.trim();
  const patokan = document.getElementById('order-patokan').value.trim();
  const note    = document.getElementById('order-note').value.trim();

  if (!wa)      { notify('⚠ Nomor WhatsApp wajib diisi.'); return; }
  if (!address) { notify('⚠ Alamat wajib diisi.'); return; }

  const validItems = orderItems.filter(i => i.productId);
  if (!validItems.length) { notify('⚠ Pilih minimal 1 produk.'); return; }

  // cek duplikat produk
  const ids = validItems.map(i => i.productId);
  const uniqueIds = [...new Set(ids)];
  // merge duplikat
  const merged = {};
  for (const item of validItems) {
    if (merged[item.productId]) merged[item.productId].qty += item.qty;
    else merged[item.productId] = {...item};
  }
  const finalItems = Object.values(merged);

  // cek stok cukup
  for (const item of finalItems) {
    const p = allProducts.find(p => p.id === item.productId);
    if (!p || (p.stockQty||0) < item.qty) { notify(`⚠ Stok ${item.code} tidak cukup (tersedia: ${p?.stockQty||0}).`); return; }
  }

  const total = finalItems.reduce((s,i) => s + i.price*i.qty, 0);
  const fullAddress = [address, rtrw, patokan, 'Kecamatan Lawang, Kabupaten Malang'].filter(Boolean).join(', ');

  const btn = document.getElementById('btn-submit-order');
  if (btn) { btn.disabled=true; btn.style.opacity='0.6'; }
  try {
    // kurangi stok
    for (const item of finalItems) {
      const p = allProducts.find(p => p.id === item.productId);
      await updateDoc(doc(db, COL.products, item.productId), { stockQty: (p.stockQty||0) - item.qty });
    }
    // buat order
    await addDoc(collection(db, COL.orders), {
      uid: currentUser.uid,
      userName: userProfile?.displayName || currentUser.displayName || 'User',
      wa, address: fullAddress, note,
      items: finalItems.map(i => ({ productId:i.productId, code:i.code, name:i.name, price:i.price, qty:i.qty })),
      total, status:'baru',
      time: serverTimestamp(),
      userDeleted: false,
      notifRead: false
    });
    showPage('home');
    notify('✓ Pesanan berhasil dikirim! Cek status di "Pesanan Saya".', 6000);
  } catch(e) {
    console.error(e);
    notify('✗ Gagal mengirim pesanan. Coba lagi.');
  } finally {
    if (btn) { btn.disabled=false; btn.style.opacity='1'; }
  }
}
window.submitOrder = submitOrder;

// ── PESANAN SAYA ─────────────────────────
function renderUserOrders() {
  if (!currentUser) { showPage('home'); openModalId('modal-login'); return; }
  const container = document.getElementById('pesanan-list');
  container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:0.8rem;">Memuat...</div>`;

  const q = query(collection(db, COL.orders), where('uid','==',currentUser.uid), orderBy('time','desc'));
  onSnapshot(q, snap => {
    const orders = snap.docs.map(d => ({id:d.id,...d.data()}));
    if (!orders.length) {
      container.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:0.8rem;border:1px dashed var(--border);">// BELUM ADA PESANAN</div>`;
      return;
    }

    // mark notif as read
    orders.filter(o => !o.notifRead && (o.status==='dikonfirmasi'||o.status==='dibatalkan')).forEach(o => {
      updateDoc(doc(db, COL.orders, o.id), { notifRead: true });
    });

    container.innerHTML = orders.map(o => {
      const timeStr = o.time?.toDate ? o.time.toDate().toLocaleString('id-ID') : '—';
      const canEdit = o.time?.toDate && (Date.now() - o.time.toDate().getTime()) < 3600000 && o.status === 'baru';
      const canDone = o.status === 'dikonfirmasi';
      const canCancel = o.status === 'baru';

      return `
      <div class="pesanan-card">
        <div class="pesanan-header">
          <div>
            <div style="font-family:'Share Tech Mono',monospace;font-size:0.7rem;color:var(--text-dim);">${timeStr}</div>
            <div style="font-family:'Orbitron',sans-serif;font-size:0.8rem;margin-top:2px;">#${o.id.slice(-6).toUpperCase()}</div>
          </div>
          <span class="status-badge status-${getStatusClass(o.status)}">${getStatusLabel(o.status)}</span>
        </div>

        <!-- PRODUK -->
        <div style="margin:1rem 0;border-top:1px solid var(--border);padding-top:1rem;">
          ${(o.items||[]).map(item => `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
              <div>
                <span style="font-family:'Share Tech Mono',monospace;font-size:0.7rem;color:var(--accent);">${esc(item.code)}</span>
                <span style="font-size:0.88rem;margin-left:8px;">${esc(item.name)}</span>
                <span style="font-size:0.78rem;color:var(--text-dim);"> ×${item.qty}</span>
              </div>
              <div style="font-family:'Orbitron',monospace;font-size:0.82rem;color:var(--accent3);">${formatRp(item.price*item.qty)}</div>
            </div>`).join('')}
          <div style="border-top:1px solid var(--border);padding-top:0.75rem;display:flex;justify-content:space-between;">
            <span style="font-weight:700;">TOTAL</span>
            <span style="font-family:'Orbitron',sans-serif;color:var(--accent3);font-weight:700;">${formatRp(o.total)}</span>
          </div>
        </div>

        <!-- DETAIL -->
        <div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.75rem;">
          <div>📍 ${esc(o.address)}</div>
          <div>📱 ${esc(o.wa)}</div>
          ${o.note ? `<div>📝 ${esc(o.note)}</div>` : ''}
        </div>

        <!-- EDIT ALAMAT -->
        ${canEdit ? `
          <div style="margin-bottom:0.75rem;">
            <input type="text" class="form-input" id="edit-addr-${o.id}" value="${esc(o.address.replace(', Kecamatan Lawang, Kabupaten Malang',''))}" style="font-size:0.82rem;margin-bottom:4px;"/>
            <button class="btn btn-secondary btn-sm" onclick="saveEditAddress('${o.id}')">Simpan Alamat</button>
          </div>` : ''}

        <!-- NOMOR ADMIN (jika dikonfirmasi) -->
        ${o.status==='dikonfirmasi' ? `
          <div style="background:rgba(0,229,255,0.07);border:1px solid var(--border-active);padding:0.75rem;margin-bottom:0.75rem;">
            <div style="font-size:0.7rem;font-family:'Share Tech Mono',monospace;color:var(--accent);margin-bottom:4px;">HUBUNGI ADMIN</div>
            <a href="https://wa.me/62${(SETTINGS.adminWa||'').replace(/^0/,'')}" target="_blank" style="color:var(--accent3);font-family:'Orbitron',sans-serif;font-size:0.9rem;text-decoration:none;">📱 ${esc(SETTINGS.adminWa)}</a>
          </div>` : ''}

        <!-- PEMBATALAN -->
        ${o.cancelRequest ? `<div style="font-size:0.78rem;color:#ff8c00;margin-bottom:0.5rem;">⏳ Pembatalan diajukan — menunggu konfirmasi admin</div>` : ''}

        <!-- AKSI -->
        <div class="action-btns">
          ${canCancel && !o.cancelRequest ? `<button class="btn btn-secondary btn-sm" onclick="requestCancel('${o.id}')" style="color:#ff4444;border-color:#ff4444;">Ajukan Batal</button>` : ''}
          ${canDone ? `<button class="btn btn-secondary btn-sm" onclick="requestDone('${o.id}')" style="color:var(--accent3);border-color:var(--accent3);">✓ Selesai</button>` : ''}
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
  } catch(e) { notify('✗ Gagal memperbarui alamat.'); }
}
window.saveEditAddress = saveEditAddress;

function requestCancel(orderId) {
  document.getElementById('cancel-order-id').value = orderId;
  document.getElementById('cancel-reason').value = '';
  openModalId('modal-cancel-order');
}
window.requestCancel = requestCancel;

async function submitCancelRequest() {
  const orderId = document.getElementById('cancel-order-id').value;
  const reason  = document.getElementById('cancel-reason').value.trim();
  if (!reason) { notify('⚠ Tulis alasan pembatalan.'); return; }
  try {
    await updateDoc(doc(db, COL.orders, orderId), { cancelRequest: true, cancelReason: reason });
    closeModalId('modal-cancel-order');
    notify('✓ Permintaan pembatalan dikirim ke admin.');
  } catch(e) { notify('✗ Gagal mengajukan pembatalan.'); }
}
window.submitCancelRequest = submitCancelRequest;

async function requestDone(orderId) {
  try {
    await updateDoc(doc(db, COL.orders, orderId), { userConfirmDone: true });
    notify('✓ Konfirmasi selesai dikirim. Menunggu verifikasi admin.');
  } catch(e) { notify('✗ Gagal mengirim konfirmasi.'); }
}
window.requestDone = requestDone;

// ── BANTUAN / Q&A ────────────────────────
async function submitQuestion() {
  if (!currentUser) { openModalId('modal-login'); return; }
  const question = document.getElementById('qa-question').value.trim();
  if (!question) { notify('⚠ Pertanyaan tidak boleh kosong.'); return; }
  const btn = document.getElementById('btn-submit-qa');
  if (btn) { btn.disabled=true; btn.style.opacity='0.6'; }
  try {
    await addDoc(collection(db, COL.questions), {
      uid: currentUser.uid,
      name: userProfile?.displayName || 'Anonim',
      question, answer: null, adminName: null,
      time: serverTimestamp()
    });
    document.getElementById('qa-question').value = '';
    notify('✓ Pertanyaan terkirim!');
  } catch(e) { notify('✗ Gagal mengirim pertanyaan.'); }
  finally { if(btn){btn.disabled=false;btn.style.opacity='1';} }
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
  if (SETTINGS.bgUrl && img) { img.src=SETTINGS.bgUrl; img.style.display='block'; }
}

// ── ADMIN: ORDERS ────────────────────────
let _unsubOrders = null;
function listenAdminOrders() {
  if (_unsubOrders) _unsubOrders();
  _unsubOrders = onSnapshot(query(collection(db, COL.orders), orderBy('time','desc')), snap => {
    renderAdminOrders(snap.docs.map(d => ({id:d.id,...d.data()})));
  });
}

function renderAdminOrders(orders) {
  const tbody = document.getElementById('orders-tbody');
  if (!orders.length) { tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:0.75rem;">Belum ada pesanan</td></tr>`; return; }
  tbody.innerHTML = orders.map(o => {
    const timeStr = o.time?.toDate ? o.time.toDate().toLocaleString('id-ID') : '—';
    const itemsStr = (o.items||[]).map(i => `${i.code} ×${i.qty}`).join(', ');
    const flags = [
      o.cancelRequest ? `<span style="color:#ff8c00;font-size:0.7rem;">⚠ Minta Batal: "${esc(o.cancelReason||'')}"</span>` : '',
      o.userConfirmDone ? `<span style="color:var(--accent3);font-size:0.7rem;">✓ User konfirmasi selesai</span>` : '',
      o.userDeleted ? `<span style="color:#ff4444;font-size:0.7rem;">Akun dihapus</span>` : ''
    ].filter(Boolean).join('<br>');
    return `<tr>
      <td style="font-size:0.72rem;font-family:'Share Tech Mono',monospace;white-space:nowrap;">${timeStr}</td>
      <td>${esc(o.userName||'?')}</td>
      <td><a href="https://wa.me/62${(o.wa||'').replace(/^0/,'')}" target="_blank" style="color:var(--accent);">${esc(o.wa)}</a></td>
      <td style="font-family:'Share Tech Mono',monospace;font-size:0.78rem;">${itemsStr}</td>
      <td style="font-family:'Orbitron',sans-serif;color:var(--accent3);font-size:0.82rem;">${formatRp(o.total)}</td>
      <td style="font-size:0.8rem;max-width:160px;">${esc(o.address)}${flags?`<br>${flags}`:''}</td>
      <td><span class="status-badge status-${getStatusClass(o.status)}">${getStatusLabel(o.status)}</span></td>
      <td><div class="action-btns">
        ${o.status==='baru'?`<button class="btn btn-primary btn-sm" onclick="adminConfirmOrder('${o.id}')">Konfirmasi</button>`:''}
        ${o.cancelRequest&&o.status!=='dibatalkan'?`<button class="btn btn-sm" onclick="adminCancelOrder('${o.id}')" style="background:#ff4444;color:#fff;">Batalkan</button>`:''}
        ${o.userConfirmDone&&o.status==='dikonfirmasi'?`<button class="btn btn-sm" onclick="adminDoneOrder('${o.id}')" style="background:var(--accent3);color:var(--bg-deep);">Selesai</button>`:''}
        ${o.status!=='dibatalkan'&&!o.cancelRequest?`<button class="btn btn-secondary btn-sm" onclick="adminForceCancel('${o.id}')" style="color:#ff4444;border-color:#ff4444;">Paksa Batal</button>`:''}
        <button class="btn btn-secondary btn-sm" onclick="deleteOrder('${o.id}')" style="color:#888;border-color:#444;">Hapus</button>
      </div></td>
    </tr>`;
  }).join('');
}

async function adminConfirmOrder(id) {
  await updateDoc(doc(db, COL.orders, id), { status:'dikonfirmasi', notifRead:false });
  notify('✓ Pesanan dikonfirmasi.');
}
window.adminConfirmOrder = adminConfirmOrder;

async function adminCancelOrder(id) {
  // kembalikan stok
  await restoreStock(id);
  await updateDoc(doc(db, COL.orders, id), { status:'dibatalkan', cancelRequest:false, notifRead:false });
  notify('✓ Pesanan dibatalkan.');
}
window.adminCancelOrder = adminCancelOrder;

async function adminForceCancel(id) {
  if (!confirm('Batalkan pesanan ini tanpa persetujuan user?')) return;
  await restoreStock(id);
  await updateDoc(doc(db, COL.orders, id), { status:'dibatalkan', notifRead:false });
  notify('✓ Pesanan dibatalkan paksa.');
}
window.adminForceCancel = adminForceCancel;

async function adminDoneOrder(id) {
  await updateDoc(doc(db, COL.orders, id), { status:'selesai' });
  notify('✓ Pesanan ditandai selesai.');
}
window.adminDoneOrder = adminDoneOrder;

async function restoreStock(orderId) {
  try {
    const snap = await getDoc(doc(db, COL.orders, orderId));
    if (!snap.exists()) return;
    const items = snap.data().items || [];
    for (const item of items) {
      const pSnap = await getDoc(doc(db, COL.products, item.productId));
      if (pSnap.exists()) {
        await updateDoc(doc(db, COL.products, item.productId), { stockQty: (pSnap.data().stockQty||0) + item.qty });
      }
    }
  } catch(e) {}
}

async function deleteOrder(id) {
  if (!confirm('Hapus pesanan ini dari daftar?')) return;
  await deleteDoc(doc(db, COL.orders, id));
  notify('✓ Pesanan dihapus.');
}
window.deleteOrder = deleteOrder;

// ── ADMIN: PRODUCTS ──────────────────────
let _unsubProducts = null;
function listenAdminProducts() {
  if (_unsubProducts) _unsubProducts();
  _unsubProducts = onSnapshot(query(collection(db, COL.products), orderBy('codeNum','asc')), snap => {
    renderAdminProducts(snap.docs.map(d => ({id:d.id,...d.data()})));
  });
}

function renderAdminProducts(products) {
  const tbody = document.getElementById('products-tbody');
  if (!products.length) { tbody.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:0.75rem;">Belum ada produk</td></tr>`; return; }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td style="font-family:'Share Tech Mono',monospace;color:var(--accent);">${esc(p.code)}</td>
      <td>${esc(p.name)}</td>
      <td style="color:var(--accent3);font-family:'Orbitron',sans-serif;font-size:0.85rem;">${formatRp(p.price)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span class="product-stock ${(p.stockQty||0)<=0?'stock-empty':'stock-available'}">${(p.stockQty||0)<=0?'HABIS':p.stockQty}</span>
          <input type="number" min="0" value="${p.stockQty||0}" style="width:60px;background:var(--bg-panel);border:1px solid var(--border);color:var(--text);padding:2px 6px;font-size:0.78rem;" onchange="updateStock('${p.id}',this.value)"/>
        </div>
      </td>
      <td><div class="action-btns">
        <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="deleteProduct('${p.id}')" style="color:#ff4444;border-color:#ff4444;">Hapus</button>
      </div></td>
    </tr>`).join('');
}

async function updateStock(id, val) {
  const qty = parseInt(val) || 0;
  await updateDoc(doc(db, COL.products, id), { stockQty: qty });
}
window.updateStock = updateStock;

// Generate kode otomatis
async function generateNextCode() {
  const snap = await getDocs(collection(db, COL.products));
  const nums = snap.docs.map(d => d.data().codeNum || 0);
  // cari nomor terkecil yang belum dipakai
  let next = 1;
  const usedSet = new Set(nums);
  while (usedSet.has(next)) next++;
  const code = 'HZTM-' + String(next).padStart(3,'0');
  const el = document.getElementById('p-code');
  if (el && !document.getElementById('edit-product-id').value) {
    el.value = code;
    el.dataset.codeNum = next;
  }
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
  const code     = document.getElementById('p-code').value.trim();
  const codeNum  = parseInt(document.getElementById('p-code').dataset.codeNum) || 0;
  const name     = document.getElementById('p-name').value.trim();
  const price    = parseInt(document.getElementById('p-price').value) || 0;
  const stockQty = parseInt(document.getElementById('p-stock-qty').value) || 0;
  const desc     = document.getElementById('p-desc').value.trim();
  const img      = document.getElementById('p-img-data').value;

  if (!name)  { notify('⚠ Nama produk wajib diisi.'); return; }
  if (!price) { notify('⚠ Harga wajib diisi.'); return; }

  const btn = document.getElementById('btn-save-product');
  if (btn) { btn.disabled=true; btn.style.opacity='0.6'; }
  try {
    if (id) {
      const existing = await getDoc(doc(db, COL.products, id));
      const existImg = existing.data()?.img || '';
      await updateDoc(doc(db, COL.products, id), { name, price, stockQty, desc, img: img||existImg });
    } else {
      await addDoc(collection(db, COL.products), { code, codeNum, name, price, stockQty, desc, img, time: serverTimestamp() });
    }
    cancelEdit();
    notify('✓ Produk berhasil disimpan!');
  } catch(e) { console.error(e); notify('✗ Gagal menyimpan produk.'); }
  finally { if(btn){btn.disabled=false;btn.style.opacity='1';} }
}
window.saveProduct = saveProduct;

function editProduct(id) {
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.admin-tab')[2].classList.add('active');
  document.getElementById('tab-tambah-produk').classList.add('active');

  getDoc(doc(db, COL.products, id)).then(snap => {
    if (!snap.exists()) return;
    const p = snap.data();
    document.getElementById('add-product-title').textContent = 'EDIT PRODUK';
    document.getElementById('edit-product-id').value = id;
    const codeEl = document.getElementById('p-code');
    codeEl.value = p.code||''; codeEl.dataset.codeNum = p.codeNum||0;
    document.getElementById('p-name').value = p.name||'';
    document.getElementById('p-price').value = p.price||'';
    document.getElementById('p-stock-qty').value = p.stockQty||0;
    document.getElementById('p-desc').value = p.desc||'';
    document.getElementById('p-img-data').value = '';
    const prev = document.getElementById('img-preview');
    if (p.img) { prev.src=p.img; prev.style.display='block'; } else prev.style.display='none';
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
  ['p-name','p-price','p-desc','p-img-data'].forEach(id => { document.getElementById(id).value=''; });
  document.getElementById('p-stock-qty').value = '0';
  document.getElementById('img-preview').style.display='none';
  document.getElementById('p-img-input').value='';
  generateNextCode();
}
window.cancelEdit = cancelEdit;

// ── ADMIN: Q&A ───────────────────────────
let _unsubQA = null;
function listenAdminQA() {
  if (_unsubQA) _unsubQA();
  _unsubQA = onSnapshot(query(collection(db, COL.questions), orderBy('time','desc')), snap => {
    renderAdminQA(snap.docs.map(d=>({id:d.id,...d.data()})));
  });
}

function renderAdminQA(questions) {
  const container = document.getElementById('qa-admin-list');
  if (!questions.length) { container.innerHTML=`<p style="color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:0.75rem;">Belum ada pertanyaan</p>`; return; }
  container.innerHTML = questions.map(q => {
    const timeStr = q.time?.toDate ? q.time.toDate().toLocaleString('id-ID') : '—';
    return `
    <div class="qa-item" style="margin-bottom:1rem;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">
        <div>
          <div class="qa-q">${esc(q.question)}</div>
          <div style="font-size:0.7rem;font-family:'Share Tech Mono',monospace;color:var(--text-dim);margin-top:4px;">— ${esc(q.name||'Anonim')} · ${timeStr}</div>
        </div>
        <span class="status-badge ${q.answer?'status-answered':'status-new'}">${q.answer?'DIJAWAB':'BARU'}</span>
      </div>
      ${q.answer?`<div class="qa-a" style="margin-bottom:0.75rem;"><strong style="color:var(--accent2);font-size:0.72rem;">Admin · ${esc(q.adminName||'HZTM')}</strong><br>${esc(q.answer)}</div>`:''}
      <div class="action-btns">
        <button class="btn btn-primary btn-sm" onclick="openAnswerModal('${q.id}')">${q.answer?'Edit Jawaban':'Jawab'}</button>
        <button class="btn btn-secondary btn-sm" onclick="deleteQuestion('${q.id}')" style="color:#ff4444;border-color:#ff4444;">Hapus</button>
      </div>
    </div>`;
  }).join('');
}

function openAnswerModal(id) {
  getDoc(doc(db, COL.questions, id)).then(snap => {
    if (!snap.exists()) return;
    const q = snap.data();
    document.getElementById('modal-qa-id').value = id;
    document.getElementById('modal-question').textContent = q.question;
    document.getElementById('modal-answer').value = q.answer||'';
    openModalId('modal-overlay');
  });
}
window.openAnswerModal = openAnswerModal;

function closeModal() { closeModalId('modal-overlay'); }
window.closeModal = closeModal;

async function submitAnswer() {
  const id     = document.getElementById('modal-qa-id').value;
  const answer = document.getElementById('modal-answer').value.trim();
  if (!answer) { notify('⚠ Jawaban tidak boleh kosong.'); return; }
  const adminName = userProfile?.displayName || 'Admin';
  await updateDoc(doc(db, COL.questions, id), { answer, adminName });
  closeModalId('modal-overlay');
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
  if (!np||np.length<4) { notify('⚠ Password minimal 4 karakter.'); return; }
  if (np!==cp) { notify('⚠ Konfirmasi password tidak cocok.'); return; }
  const newVersion = (SETTINGS.passwordVersion||0) + 1;
  await saveSettings({ password: np, passwordVersion: newVersion });
  // hapus semua sesi admin
  const snap = await getDocs(collection(db, COL.adminSessions));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  isAdmin = false;
  document.getElementById('new-pass').value='';
  document.getElementById('confirm-pass').value='';
  notify('✓ Password diubah. Semua admin telah di-logout.');
  showPage('home');
}
window.changePassword = changePassword;

async function saveBgUrl() {
  const url = document.getElementById('bg-url').value.trim();
  await saveSettings({ bgUrl: url });
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
function switchAdminTab(name, el) {
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
  if (el) el.classList.add('active');
  const sec = document.getElementById('tab-'+name);
  if (sec) sec.classList.add('active');
  if (name==='tambah-produk') generateNextCode();
}
window.switchAdminTab = switchAdminTab;

// ── MODAL HELPERS ────────────────────────
function openModalId(id) { const el=document.getElementById(id); if(el) el.classList.add('open'); }
function closeModalId(id) { const el=document.getElementById(id); if(el) el.classList.remove('close'); if(el) el.classList.remove('open'); }
window.openModalId  = openModalId;
window.closeModalLogin = () => closeModalId('modal-login');
window.closeModalId = closeModalId;

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if(e.target===overlay) overlay.classList.remove('open'); });
});

// ── STATUS HELPERS ────────────────────────
function getStatusClass(s) {
  if (s==='dikonfirmasi') return 'confirmed';
  if (s==='dibatalkan')   return 'cancelled';
  if (s==='selesai')      return 'done';
  if (s==='minta-batal')  return 'cancelled';
  return 'new';
}
function getStatusLabel(s) {
  const map = { baru:'BARU', dikonfirmasi:'DIKONFIRMASI', dibatalkan:'DIBATALKAN', selesai:'SELESAI', 'minta-batal':'MINTA BATAL' };
  return map[s] || s.toUpperCase();
}

// ── FORMAT ───────────────────────────────
function formatRp(val) {
  const num = parseInt(val) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

function esc(str) {
  if (!str && str!==0) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
