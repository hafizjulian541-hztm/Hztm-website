/* ════════════════════════════════════════
   HZTM — Horizon Zetta Teknologi Mandiri
   app.js — Firebase Firestore Integration
   ════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getFirestore, collection, doc,
  addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ── FIREBASE CONFIG ──────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBVhUx7thdJyxqRXkv2GBSY-WZaUmbYQgA",
  authDomain: "hztm-official-web.firebaseapp.com",
  projectId: "hztm-official-web",
  storageBucket: "hztm-official-web.firebasestorage.app",
  messagingSenderId: "932193177985",
  appId: "1:932193177985:web:479f16fbae5a38a4955880"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── COLLECTIONS ──────────────────────────
const COL = {
  products:  'products',
  orders:    'orders',
  questions: 'questions',
  settings:  'settings'
};

// ── STATE ────────────────────────────────
let adminLoggedIn = false;
let SETTINGS = { password: 'hztm2026', bgUrl: '', donateUrl: '' };

// ── INIT ─────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  applyBg();
  listenQAPublic();
  listenProducts();
});

// ── SETTINGS ─────────────────────────────
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, COL.settings, 'main'));
    if (snap.exists()) SETTINGS = { ...SETTINGS, ...snap.data() };
  } catch(e) { console.error('loadSettings:', e); }
}

async function saveSettings(data) {
  try {
    await setDoc(doc(db, COL.settings, 'main'), data, { merge: true });
    SETTINGS = { ...SETTINGS, ...data };
  } catch(e) { notify('✗ Gagal menyimpan pengaturan.'); }
}

// ── NAVIGATION ───────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === name);
  });
  const target = document.getElementById('page-' + name);
  if (target) { target.classList.add('active'); window.scrollTo(0, 0); }
  if (name === 'admin') {
    if (adminLoggedIn) showAdminPanel();
    else showAdminLogin();
  }
}
window.showPage = showPage;

// ── NOTIFICATION ─────────────────────────
function notify(msg, duration = 4500) {
  const el = document.getElementById('notif');
  el.innerHTML = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

// ── REALTIME: Q&A PUBLIC ─────────────────
function listenQAPublic() {
  const q = query(collection(db, COL.questions), orderBy('time', 'desc'));
  onSnapshot(q, snap => {
    const answered = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(q => q.answer);
    renderQAPublic(answered);
  }, e => console.error('listenQAPublic:', e));
}

function renderQAPublic(answered) {
  const list  = document.getElementById('qa-public-list');
  const empty = document.getElementById('qa-empty');
  list.querySelectorAll('.qa-item').forEach(el => el.remove());
  if (!answered || !answered.length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  answered.forEach(q => {
    const div = document.createElement('div');
    div.className = 'qa-item';
    div.innerHTML = `
      <div class="qa-q">${esc(q.question)}
        <small style="font-size:0.65rem;color:var(--text-dim);margin-left:auto;">— ${esc(q.name||'Anonim')}</small>
      </div>
      <div class="qa-a">${esc(q.answer)}</div>`;
    list.appendChild(div);
  });
}

// ── REALTIME: PRODUCTS ───────────────────
function listenProducts() {
  const q = query(collection(db, COL.products), orderBy('time', 'desc'));
  onSnapshot(q, snap => {
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts(products);
  }, e => console.error('listenProducts:', e));
}

function renderProducts(products) {
  const container = document.getElementById('product-list');
  if (!products || !products.length) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--text-dim);
        font-family:'Share Tech Mono',monospace;font-size:0.8rem;border:1px dashed var(--border);">
        // BELUM ADA PRODUK —<br>Admin belum menambahkan produk.
      </div>`;
    return;
  }
  container.innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-img">
        ${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"/>` : `<span>[ NO IMAGE ]</span>`}
      </div>
      <div class="product-body">
        <div class="product-code">${esc(p.code)}</div>
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-desc">${esc(p.desc)||'—'}</div>
        <div class="product-footer">
          <div class="product-price">${esc(p.price)}</div>
          <span class="product-stock ${p.stock==='habis'?'stock-empty':'stock-available'}">
            ${p.stock==='habis'?'HABIS':'TERSEDIA'}
          </span>
        </div>
      </div>
    </div>`).join('');
}

// ── ORDER ────────────────────────────────
async function submitOrder() {
  const name    = document.getElementById('order-name').value.trim();
  const wa      = document.getElementById('order-wa').value.trim();
  const code    = document.getElementById('order-code').value.trim();
  const qty     = document.getElementById('order-qty').value.trim();
  const address = document.getElementById('order-address').value.trim();
  const rtrw    = document.getElementById('order-rtrw').value.trim();
  const patokan = document.getElementById('order-patokan').value.trim();
  const note    = document.getElementById('order-note').value.trim();

  if (!name)           { notify('⚠ Nama lengkap wajib diisi.'); return; }
  if (!wa)             { notify('⚠ Nomor WhatsApp wajib diisi.'); return; }
  if (!code)           { notify('⚠ Kode produk wajib diisi.'); return; }
  if (!qty || qty < 1) { notify('⚠ Jumlah pesanan tidak valid.'); return; }
  if (!address)        { notify('⚠ Alamat wajib diisi.'); return; }

  const fullAddress = [address, rtrw, patokan, 'Kecamatan Lawang, Kabupaten Malang']
    .filter(Boolean).join(', ');

  const btn = document.getElementById('btn-submit-order');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  try {
    await addDoc(collection(db, COL.orders), {
      name, wa, code, qty: Number(qty),
      address: fullAddress, note,
      status: 'baru',
      time: serverTimestamp()
    });
    ['order-name','order-wa','order-code','order-address','order-rtrw','order-patokan','order-note']
      .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    document.getElementById('order-qty').value = '1';
    showPage('home');
    notify(`✓ Pesanan sedang diproses.<br>Info lebih lanjut hubungi admin.<br>Sistem pembelian hanya melayani <strong>COD</strong>.`, 7000);
  } catch(e) {
    console.error(e);
    notify('✗ Gagal mengirim pesanan. Coba lagi.');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}
window.submitOrder = submitOrder;

// ── BANTUAN / Q&A ────────────────────────
async function submitQuestion() {
  const name     = document.getElementById('qa-name').value.trim();
  const question = document.getElementById('qa-question').value.trim();
  if (!question) { notify('⚠ Pertanyaan tidak boleh kosong.'); return; }

  const btn = document.getElementById('btn-submit-qa');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  try {
    await addDoc(collection(db, COL.questions), {
      name: name || 'Anonim',
      question,
      answer: null,
      time: serverTimestamp()
    });
    document.getElementById('qa-name').value = '';
    document.getElementById('qa-question').value = '';
    notify('✓ Pertanyaan terkirim! Admin akan segera menjawab.');
  } catch(e) {
    console.error(e);
    notify('✗ Gagal mengirim pertanyaan. Coba lagi.');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}
window.submitQuestion = submitQuestion;

// ── DONATE ───────────────────────────────
function handleDonateClick(e) {
  const url = SETTINGS.donateUrl;
  if (!url) { e.preventDefault(); notify('⚠ Link donasi belum diatur oleh admin.'); return; }
  document.getElementById('donate-link').href = url;
}
window.handleDonateClick = handleDonateClick;

function applyBg() {
  const img = document.getElementById('hero-bg-img');
  if (SETTINGS.bgUrl && img) { img.src = SETTINGS.bgUrl; img.style.display = 'block'; }
}

// ── ADMIN AUTH ───────────────────────────
async function adminLogin() {
  const pass = document.getElementById('admin-pass').value;
  await loadSettings();
  if (pass === SETTINGS.password) {
    adminLoggedIn = true;
    showAdminPanel();
    notify('✓ Login berhasil. Selamat datang, Admin!');
  } else {
    notify('✗ Password salah.');
    document.getElementById('admin-pass').value = '';
  }
}
window.adminLogin = adminLogin;

function adminLogout() {
  adminLoggedIn = false;
  document.getElementById('admin-pass').value = '';
  showAdminLogin();
}
window.adminLogout = adminLogout;

function showAdminLogin() {
  document.getElementById('admin-login-wrap').style.display = 'block';
  document.getElementById('admin-panel-wrap').style.display = 'none';
}

function showAdminPanel() {
  document.getElementById('admin-login-wrap').style.display = 'none';
  document.getElementById('admin-panel-wrap').style.display = 'block';
  document.getElementById('bg-url').value = SETTINGS.bgUrl || '';
  document.getElementById('donate-url-input').value = SETTINGS.donateUrl || '';
  listenAdminOrders();
  listenAdminProducts();
  listenAdminQA();
}

// ── ADMIN TABS ───────────────────────────
function switchAdminTab(name) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  event.target.classList.add('active');
  const el = document.getElementById('tab-' + name);
  if (el) el.classList.add('active');
}
window.switchAdminTab = switchAdminTab;

// ── ADMIN: ORDERS ────────────────────────
let _unsubOrders = null;
function listenAdminOrders() {
  if (_unsubOrders) _unsubOrders();
  const q = query(collection(db, COL.orders), orderBy('time', 'desc'));
  _unsubOrders = onSnapshot(q, snap => {
    renderAdminOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

function renderAdminOrders(orders) {
  const tbody = document.getElementById('orders-tbody');
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-dim);
      font-family:'Share Tech Mono',monospace;font-size:0.75rem;">Belum ada pesanan</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => {
    const timeStr = o.time?.toDate ? o.time.toDate().toLocaleString('id-ID') : '—';
    return `<tr>
      <td style="font-size:0.72rem;font-family:'Share Tech Mono',monospace;white-space:nowrap;">${timeStr}</td>
      <td>${esc(o.name)}</td>
      <td><a href="https://wa.me/62${esc(o.wa.replace(/^0/,''))}" target="_blank"
        style="color:var(--accent);">${esc(o.wa)}</a></td>
      <td style="font-family:'Share Tech Mono',monospace;">${esc(o.code)}</td>
      <td>${o.qty}</td>
      <td style="font-size:0.82rem;max-width:180px;">${esc(o.address)}
        ${o.note?`<br><em style="color:var(--text-dim);font-size:0.72rem;">📝 ${esc(o.note)}</em>`:''}</td>
      <td><span class="status-badge status-${getOrderStatusClass(o.status)}">${esc(o.status).toUpperCase()}</span></td>
      <td><div class="action-btns">
        ${o.status!=='dikonfirmasi'?`<button class="btn btn-primary btn-sm"
          onclick="updateOrderStatus('${o.id}','dikonfirmasi')">Konfirmasi</button>`:''}
        ${o.status!=='dibatalkan'?`<button class="btn btn-secondary btn-sm"
          onclick="updateOrderStatus('${o.id}','dibatalkan')">Batal</button>`:''}
        <button class="btn btn-secondary btn-sm" onclick="deleteOrder('${o.id}')"
          style="color:#ff4444;border-color:#ff4444;">Hapus</button>
      </div></td>
    </tr>`;
  }).join('');
}

function getOrderStatusClass(s) {
  if (s === 'dikonfirmasi') return 'confirmed';
  if (s === 'dibatalkan')   return 'cancelled';
  return 'new';
}

async function updateOrderStatus(id, status) {
  try {
    await updateDoc(doc(db, COL.orders, id), { status });
    notify(`✓ Status diperbarui: ${status}`);
  } catch(e) { notify('✗ Gagal memperbarui status.'); }
}
window.updateOrderStatus = updateOrderStatus;

async function deleteOrder(id) {
  if (!confirm('Hapus pesanan ini?')) return;
  try {
    await deleteDoc(doc(db, COL.orders, id));
    notify('✓ Pesanan dihapus.');
  } catch(e) { notify('✗ Gagal menghapus pesanan.'); }
}
window.deleteOrder = deleteOrder;

// ── ADMIN: PRODUCTS ──────────────────────
let _unsubProducts = null;
function listenAdminProducts() {
  if (_unsubProducts) _unsubProducts();
  const q = query(collection(db, COL.products), orderBy('time', 'desc'));
  _unsubProducts = onSnapshot(q, snap => {
    renderAdminProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

function renderAdminProducts(products) {
  const tbody = document.getElementById('products-tbody');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);
      font-family:'Share Tech Mono',monospace;font-size:0.75rem;">Belum ada produk</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td style="font-family:'Share Tech Mono',monospace;color:var(--accent);">${esc(p.code)}</td>
      <td>${esc(p.name)}</td>
      <td style="color:var(--accent3);font-family:'Orbitron',sans-serif;font-size:0.85rem;">${esc(p.price)}</td>
      <td><span class="product-stock ${p.stock==='habis'?'stock-empty':'stock-available'}">
        ${p.stock==='habis'?'HABIS':'TERSEDIA'}</span></td>
      <td><div class="action-btns">
        <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="deleteProduct('${p.id}')"
          style="color:#ff4444;border-color:#ff4444;">Hapus</button>
      </div></td>
    </tr>`).join('');
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
  const id    = document.getElementById('edit-product-id').value;
  const code  = document.getElementById('p-code').value.trim();
  const name  = document.getElementById('p-name').value.trim();
  const price = document.getElementById('p-price').value.trim();
  const stock = document.getElementById('p-stock').value;
  const desc  = document.getElementById('p-desc').value.trim();
  const img   = document.getElementById('p-img-data').value;

  if (!code)  { notify('⚠ Kode produk wajib diisi.'); return; }
  if (!name)  { notify('⚠ Nama produk wajib diisi.'); return; }
  if (!price) { notify('⚠ Harga wajib diisi.'); return; }

  const btn = document.getElementById('btn-save-product');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  try {
    if (id) {
      const existing = await getDoc(doc(db, COL.products, id));
      const existingImg = existing.data()?.img || '';
      await updateDoc(doc(db, COL.products, id), {
        code, name, price, stock, desc, img: img || existingImg
      });
    } else {
      await addDoc(collection(db, COL.products), {
        code, name, price, stock, desc, img, time: serverTimestamp()
      });
    }
    cancelEdit();
    notify('✓ Produk berhasil disimpan!');
  } catch(e) {
    console.error(e);
    notify('✗ Gagal menyimpan produk.');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}
window.saveProduct = saveProduct;

function editProduct(id) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-tab')[2].classList.add('active');
  document.getElementById('tab-tambah-produk').classList.add('active');

  getDoc(doc(db, COL.products, id)).then(snap => {
    if (!snap.exists()) return;
    const p = snap.data();
    document.getElementById('add-product-title').textContent = 'EDIT PRODUK';
    document.getElementById('edit-product-id').value = id;
    document.getElementById('p-code').value  = p.code  || '';
    document.getElementById('p-name').value  = p.name  || '';
    document.getElementById('p-price').value = p.price || '';
    document.getElementById('p-stock').value = p.stock || 'tersedia';
    document.getElementById('p-desc').value  = p.desc  || '';
    document.getElementById('p-img-data').value = '';
    const prev = document.getElementById('img-preview');
    if (p.img) { prev.src = p.img; prev.style.display = 'block'; }
    else { prev.style.display = 'none'; }
  });
}
window.editProduct = editProduct;

async function deleteProduct(id) {
  if (!confirm('Hapus produk ini?')) return;
  try {
    await deleteDoc(doc(db, COL.products, id));
    notify('✓ Produk dihapus.');
  } catch(e) { notify('✗ Gagal menghapus produk.'); }
}
window.deleteProduct = deleteProduct;

function cancelEdit() {
  document.getElementById('add-product-title').textContent = 'TAMBAH PRODUK BARU';
  document.getElementById('edit-product-id').value = '';
  ['p-code','p-name','p-price','p-desc','p-img-data'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('p-stock').value = 'tersedia';
  document.getElementById('img-preview').style.display = 'none';
  document.getElementById('p-img-input').value = '';
}
window.cancelEdit = cancelEdit;

// ── ADMIN: Q&A ───────────────────────────
let _unsubQA = null;
function listenAdminQA() {
  if (_unsubQA) _unsubQA();
  const q = query(collection(db, COL.questions), orderBy('time', 'desc'));
  _unsubQA = onSnapshot(q, snap => {
    renderAdminQA(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

function renderAdminQA(questions) {
  const container = document.getElementById('qa-admin-list');
  if (!questions.length) {
    container.innerHTML = `<p style="color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:0.75rem;">Belum ada pertanyaan</p>`;
    return;
  }
  container.innerHTML = questions.map(q => {
    const timeStr = q.time?.toDate ? q.time.toDate().toLocaleString('id-ID') : '—';
    const qEsc = esc(q.question);
    const aEsc = q.answer ? esc(q.answer) : '';
    return `
    <div class="qa-item" style="margin-bottom:1rem;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">
        <div>
          <div class="qa-q">${qEsc}</div>
          <div style="font-size:0.7rem;font-family:'Share Tech Mono',monospace;color:var(--text-dim);margin-top:4px;">
            — ${esc(q.name||'Anonim')} · ${timeStr}
          </div>
        </div>
        <span class="status-badge ${q.answer?'status-answered':'status-new'}">${q.answer?'DIJAWAB':'BARU'}</span>
      </div>
      ${q.answer?`<div class="qa-a" style="margin-bottom:0.75rem;">${aEsc}</div>`:''}
      <div class="action-btns">
        <button class="btn btn-primary btn-sm" onclick="openAnswerModal('${q.id}')">
          ${q.answer?'Edit Jawaban':'Jawab'}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="deleteQuestion('${q.id}')"
          style="color:#ff4444;border-color:#ff4444;">Hapus</button>
      </div>
    </div>`;
  }).join('');
}

// store current QA data for modal
let _currentQA = {};

// override listenAdminQA to also cache data
const _origListenAdminQA = listenAdminQA;

// ── MODAL ANSWER ─────────────────────────
function openAnswerModal(id) {
  getDoc(doc(db, COL.questions, id)).then(snap => {
    if (!snap.exists()) return;
    const q = snap.data();
    document.getElementById('modal-qa-id').value = id;
    document.getElementById('modal-question').textContent = q.question;
    document.getElementById('modal-answer').value = q.answer || '';
    document.getElementById('modal-overlay').classList.add('open');
  });
}
window.openAnswerModal = openAnswerModal;

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
window.closeModal = closeModal;

async function submitAnswer() {
  const id     = document.getElementById('modal-qa-id').value;
  const answer = document.getElementById('modal-answer').value.trim();
  if (!answer) { notify('⚠ Jawaban tidak boleh kosong.'); return; }
  try {
    await updateDoc(doc(db, COL.questions, id), { answer });
    closeModal();
    notify('✓ Jawaban disimpan dan tampil di halaman utama!');
  } catch(e) { notify('✗ Gagal menyimpan jawaban.'); }
}
window.submitAnswer = submitAnswer;

async function deleteQuestion(id) {
  if (!confirm('Hapus pertanyaan ini?')) return;
  try {
    await deleteDoc(doc(db, COL.questions, id));
    notify('✓ Pertanyaan dihapus.');
  } catch(e) { notify('✗ Gagal menghapus pertanyaan.'); }
}
window.deleteQuestion = deleteQuestion;

// ── ADMIN: SETTINGS ──────────────────────
async function changePassword() {
  const np = document.getElementById('new-pass').value;
  const cp = document.getElementById('confirm-pass').value;
  if (!np || np.length < 4) { notify('⚠ Password minimal 4 karakter.'); return; }
  if (np !== cp) { notify('⚠ Konfirmasi password tidak cocok.'); return; }
  await saveSettings({ password: np });
  document.getElementById('new-pass').value = '';
  document.getElementById('confirm-pass').value = '';
  notify('✓ Password berhasil diubah!');
}
window.changePassword = changePassword;

async function saveBgUrl() {
  const url = document.getElementById('bg-url').value.trim();
  await saveSettings({ bgUrl: url });
  applyBg();
  notify('✓ Background berhasil diperbarui!');
}
window.saveBgUrl = saveBgUrl;

async function saveDonateUrl() {
  const url = document.getElementById('donate-url-input').value.trim();
  await saveSettings({ donateUrl: url });
  notify('✓ Link donasi berhasil disimpan!');
}
window.saveDonateUrl = saveDonateUrl;

// ── UTILS ────────────────────────────────
function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
