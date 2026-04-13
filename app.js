// ============================================
//  KÜTÜPHANE YÖNETİM SİSTEMİ v3.0
//  Gelişmiş ZXing Barkod Tarayıcı
// ============================================

// ===== DEFAULT CATEGORIES =====
const DEFAULT_CATEGORIES = [
    { id: 'roman', name: 'Roman', icon: '📖', isDefault: true },
    { id: 'hikaye', name: 'Hikaye', icon: '📝', isDefault: true },
    { id: 'masal', name: 'Masal', icon: '🧚', isDefault: true },
    { id: 'siir', name: 'Şiir', icon: '🎭', isDefault: true },
    { id: 'felsefe', name: 'Felsefe', icon: '🤔', isDefault: true },
    { id: 'psikoloji', name: 'Psikoloji', icon: '🧠', isDefault: true },
    { id: 'kisisel-gelisim', name: 'Kişisel Gelişim', icon: '🚀', isDefault: true },
    { id: 'lgs', name: 'LGS', icon: '📚', isDefault: true },
    { id: 'ayt', name: 'AYT', icon: '🎓', isDefault: true },
    { id: 'tyt', name: 'TYT', icon: '📋', isDefault: true },
    { id: 'kpss', name: 'KPSS', icon: '🏛️', isDefault: true },
    { id: 'dgs', name: 'DGS', icon: '🔄', isDefault: true }
];

// ===== STATE =====
let books = [];
let categories = [];
let currentView = 'grid';

// ===== SCANNER INSTANCES =====
// Her scanner için bağımsız state
const scanners = {
    form: { stream: null, track: null, reader: null, animId: null, zoom: 1, maxZoom: 1, torch: false, videoEl: null, cooldown: false, buffer: [] },
    search: { stream: null, track: null, reader: null, animId: null, zoom: 1, maxZoom: 1, torch: false, videoEl: null, cooldown: false, buffer: [] },
    main: { stream: null, track: null, reader: null, animId: null, zoom: 1, maxZoom: 1, torch: false, videoEl: null, cooldown: false, buffer: [], facingMode: 'environment' }
};

// Doğrulama: Aynı kodu 3 kez üst üste okumalı
const CONFIRM_COUNT = 3;
const BUFFER_SIZE = 8;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderAll();
});

// ===== DATA =====
function loadData() {
    books = JSON.parse(localStorage.getItem('lib_books') || '[]');
    const saved = localStorage.getItem('lib_categories');
    if (saved) {
        categories = JSON.parse(saved);
        DEFAULT_CATEGORIES.forEach(dc => {
            if (!categories.find(c => c.id === dc.id)) categories.push(dc);
        });
    } else {
        categories = [...DEFAULT_CATEGORIES];
    }
    saveCategories();
}

function saveBooks() { localStorage.setItem('lib_books', JSON.stringify(books)); }
function saveCategories() { localStorage.setItem('lib_categories', JSON.stringify(categories)); }

function renderAll() {
    updateStats();
    renderCategorySelects();
    renderBooks();
    renderCategories();
    renderDashboard();
    updateTopbarCount();
}

// ===== NAVIGATION =====
function navigateTo(page) {
    killAllScanners();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    const titles = { 'dashboard': 'Ana Sayfa', 'add-book': 'Kitap Ekle', 'books': 'Kitaplar', 'scan-search': 'Barkod Tara / Ara', 'categories': 'Kategoriler' };
    document.getElementById('page-title').textContent = titles[page] || '';
    if (page === 'dashboard') renderDashboard();
    if (page === 'books') { renderBooks(); renderCategorySelects(); }
    if (page === 'categories') renderCategories();
    if (page === 'add-book') { renderCategorySelects(); resetForm(); }
    closeSidebar();
}

// ===== SIDEBAR =====
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
}

// ===== STATS =====
function updateStats() {
    document.getElementById('stat-total').textContent = books.length;
    document.getElementById('stat-categories').textContent = categories.length;
    const now = new Date();
    document.getElementById('stat-recent').textContent = books.filter(b => {
        const d = new Date(b.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    document.getElementById('stat-authors').textContent = new Set(books.map(b => b.author.toLowerCase().trim())).size;
}

function updateTopbarCount() {
    document.getElementById('topbar-count').textContent = `${books.length} Kitap`;
}

function renderDashboard() {
    const chartEl = document.getElementById('category-chart');
    const catCounts = {};
    categories.forEach(c => catCounts[c.id] = 0);
    books.forEach(b => { if (catCounts[b.category] !== undefined) catCounts[b.category]++; });
    const maxCount = Math.max(...Object.values(catCounts), 1);
    const colors = ['#6C63FF', '#48BB78', '#F6AD55', '#FC8181', '#63B3ED', '#B794F4', '#F687B3', '#68D391', '#FBD38D', '#FEB2B2', '#76E4F7', '#C4B5FD'];
    chartEl.innerHTML = categories.map((cat, i) => {
        const count = catCounts[cat.id] || 0;
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        return `<div class="chart-bar"><span class="chart-bar-label">${cat.icon} ${cat.name}</span><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.max(pct, 4)}%;background:${colors[i % colors.length]}">${count}</div></div></div>`;
    }).join('');

    const recentEl = document.getElementById('recent-books');
    const recent = [...books].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
    recentEl.innerHTML = recent.length === 0
        ? '<div class="empty-state"><span class="empty-icon">📭</span><p>Henüz kitap eklenmemiş</p></div>'
        : recent.map(b => `<div class="recent-book-item" onclick="showBookDetail('${b.id}')"><div class="rb-cover">${b.coverUrl ? `<img src="${b.coverUrl}" onerror="this.parentElement.innerHTML='📕'" style="width:36px;height:52px;object-fit:cover;border-radius:4px">` : '📕'}</div><div class="rb-info"><div class="rb-title">${esc(b.name)}</div><div class="rb-author">${esc(b.author)}</div></div></div>`).join('');

    updateStats();
    updateTopbarCount();
}

// ===== CATEGORY SELECTS =====
function renderCategorySelects() {
    const opts = categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    const f = document.getElementById('book-category');
    const fl = document.getElementById('filter-category');
    if (f) { const v = f.value; f.innerHTML = `<option value="">Kategori seçin...</option>${opts}`; if (v) f.value = v; }
    if (fl) { const v = fl.value; fl.innerHTML = `<option value="">Tüm Kategoriler</option>${opts}`; if (v) fl.value = v; }
}

// ===== CATEGORIES PAGE =====
function renderCategories() {
    const listEl = document.getElementById('categories-list');
    const cc = {};
    books.forEach(b => { cc[b.category] = (cc[b.category] || 0) + 1; });
    listEl.innerHTML = categories.map(cat => `
        <div class="category-item">
            <span class="cat-icon">${cat.icon}</span>
            <span class="cat-name">${esc(cat.name)}</span>
            ${cat.isDefault ? '<span class="cat-default-badge">Varsayılan</span>' : ''}
            <span class="cat-count">${cc[cat.id] || 0} kitap</span>
            <div class="cat-actions">
                ${!cat.isDefault ? `<button class="btn btn-ghost btn-sm" onclick="editCategory('${cat.id}')">✏️</button><button class="btn btn-ghost btn-sm" onclick="deleteCategory('${cat.id}')">🗑️</button>` : ''}
            </div>
        </div>
    `).join('');
}

function addCategory() {
    const nameInput = document.getElementById('new-category-name');
    const iconInput = document.getElementById('new-category-icon');
    const name = nameInput.value.trim();
    const icon = iconInput.value.trim() || '📁';
    if (!name) { showToast('❌ Kategori adı girin'); return; }
    const id = turkishSlug(name);
    if (categories.find(c => c.id === id)) { showToast('❌ Bu kategori zaten mevcut'); return; }
    categories.push({ id, name, icon, isDefault: false });
    saveCategories(); renderCategories(); renderCategorySelects();
    nameInput.value = ''; iconInput.value = '';
    showToast(`✅ "${name}" kategorisi eklendi`);
}

function editCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const newName = prompt('Kategori adı:', cat.name);
    if (!newName?.trim()) return;
    const newIcon = prompt('Emoji:', cat.icon);
    cat.name = newName.trim();
    if (newIcon?.trim()) cat.icon = newIcon.trim();
    saveCategories(); renderCategories(); renderCategorySelects();
    showToast('✅ Kategori güncellendi');
}

function deleteCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const count = books.filter(b => b.category === id).length;
    if (!confirm(`"${cat.name}" silinsin mi?${count ? ` (${count} kitap etkilenecek)` : ''}`)) return;
    books.forEach(b => { if (b.category === id) b.category = ''; });
    saveBooks();
    categories = categories.filter(c => c.id !== id);
    saveCategories(); renderAll();
    showToast(`🗑️ "${cat.name}" silindi`);
}

// ================================================================
//  SCANNER ENGINE - ZXing tabanlı gelişmiş barkod okuyucu
// ================================================================

async function initScanner(key, videoElementId, onDetect) {
    const sc = scanners[key];
    // Önceki taramayı temizle
    await killScanner(key);

    sc.buffer = [];
    sc.cooldown = false;
    sc.zoom = 1;
    sc.torch = false;

    const videoEl = document.getElementById(videoElementId);
    sc.videoEl = videoEl;

    try {
        // Yüksek çözünürlük + otomatik odaklama
        const constraints = {
            video: {
                facingMode: sc.facingMode || 'environment',
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                focusMode: { ideal: 'continuous' },
                zoom: true
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        sc.stream = stream;
        sc.track = stream.getVideoTracks()[0];

        // Max zoom hesapla
        const caps = sc.track.getCapabilities?.();
        if (caps?.zoom) {
            sc.maxZoom = Math.min(caps.zoom.max, 10);
        } else {
            sc.maxZoom = 1;
        }
        updateZoomLabel(key);

        videoEl.srcObject = stream;
        await videoEl.play();

        // ZXing reader - çoklu format desteği
        const codeReader = new ZXing.BrowserMultiFormatReader();
        sc.reader = codeReader;

        // Manuel decode loop - daha iyi kontrol
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        function decodeFrame() {
            if (!sc.stream || !sc.track || sc.track.readyState === 'ended') return;

            if (videoEl.readyState >= 2 && !sc.cooldown) {
                canvas.width = videoEl.videoWidth;
                canvas.height = videoEl.videoHeight;
                ctx.drawImage(videoEl, 0, 0);

                try {
                    const luminance = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
                    const binarizer = new ZXing.HybridBinarizer(luminance);
                    const bitmap = new ZXing.BinaryBitmap(binarizer);

                    // Çoklu format deneme
                    const hints = new Map();
                    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
                        ZXing.BarcodeFormat.EAN_13,
                        ZXing.BarcodeFormat.EAN_8,
                        ZXing.BarcodeFormat.UPC_A,
                        ZXing.BarcodeFormat.UPC_E,
                        ZXing.BarcodeFormat.CODE_128
                    ]);
                    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

                    const reader = new ZXing.MultiFormatReader();
                    reader.setHints(hints);
                    const result = reader.decode(bitmap);

                    if (result) {
                        const code = result.getText();
                        handleScanResult(key, code, onDetect);
                    }
                } catch (e) {
                    // Decode edilemedi - normal, devam et
                }
            }

            sc.animId = requestAnimationFrame(decodeFrame);
        }

        sc.animId = requestAnimationFrame(decodeFrame);

        setStatus(key, 'Barkodu çerçeve içine hizalayın', '');
        return true;

    } catch (err) {
        console.error('Camera error:', err);
        if (err.name === 'NotAllowedError') {
            showToast('❌ Kamera izni verilmedi. Tarayıcı ayarlarından izin verin.');
            setStatus(key, 'Kamera izni gerekli', 'error');
        } else if (err.name === 'NotFoundError') {
            showToast('❌ Kamera bulunamadı.');
            setStatus(key, 'Kamera bulunamadı', 'error');
        } else {
            showToast('❌ Kamera açılamadı: ' + err.message);
            setStatus(key, 'Kamera hatası', 'error');
        }
        return false;
    }
}

function handleScanResult(key, code, onDetect) {
    const sc = scanners[key];
    if (sc.cooldown) return;

    // ISBN doğrulaması
    if (!isValidISBN(code)) return;

    // Buffer'a ekle
    sc.buffer.push(code);
    if (sc.buffer.length > BUFFER_SIZE) sc.buffer.shift();

    // Aynı kodun CONFIRM_COUNT kez tekrarlanmasını kontrol et
    const count = sc.buffer.filter(c => c === code).length;

    if (count >= CONFIRM_COUNT) {
        // Onaylandı!
        sc.cooldown = true;
        sc.buffer = [];

        // Görsel geri bildirim
        setStatus(key, `✅ Okundu: ${code}`, 'success');
        const frame = document.querySelector(`#${getVideoId(key)}`).parentElement.querySelector('.scanner-frame');
        if (frame) {
            frame.classList.add('detected');
            setTimeout(() => frame.classList.remove('detected'), 1500);
        }

        // Titreşim
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

        // Ses efekti
        playBeep();

        showToast('✅ Barkod okundu: ' + code);

        // Callback
        onDetect(code);

        // Cooldown süresi
        setTimeout(() => {
            sc.cooldown = false;
            setStatus(key, 'Barkodu çerçeve içine hizalayın', '');
        }, 2500);
    } else {
        // Henüz doğrulanmadı, kullanıcıya ilerleme göster
        setStatus(key, `Okunuyor... (${count}/${CONFIRM_COUNT})`, '');
    }
}

function getVideoId(key) {
    return key + '-scanner-video';
}

function setStatus(key, text, type) {
    const el = document.getElementById(`${key}-scanner-status`);
    if (el) {
        el.textContent = text;
        el.className = 'scanner-status' + (type ? ' ' + type : '');
    }
}

function updateZoomLabel(key) {
    const el = document.getElementById(`${key}-zoom-label`);
    if (el) el.textContent = scanners[key].zoom.toFixed(1) + 'x';
}

// ===== ZOOM =====
function toggleZoom(key, direction) {
    const sc = scanners[key];
    if (!sc.track) return;

    const caps = sc.track.getCapabilities?.();
    if (!caps?.zoom) {
        showToast('⚠️ Bu kamera zoom desteklemiyor');
        return;
    }

    const step = 0.5;
    let newZoom = sc.zoom + (direction * step);
    newZoom = Math.max(caps.zoom.min || 1, Math.min(newZoom, sc.maxZoom));

    sc.zoom = newZoom;
    sc.track.applyConstraints({ advanced: [{ zoom: newZoom }] }).catch(() => {});
    updateZoomLabel(key);
}

// ===== TORCH =====
function toggleTorch(key) {
    const sc = scanners[key];
    if (!sc.track) return;

    const caps = sc.track.getCapabilities?.();
    if (!caps?.torch) {
        showToast('⚠️ Fener desteklenmiyor');
        return;
    }

    sc.torch = !sc.torch;
    sc.track.applyConstraints({ advanced: [{ torch: sc.torch }] }).catch(() => {});

    const btn = document.getElementById(`${key}-torch-btn`);
    if (btn) btn.classList.toggle('active', sc.torch);
}

// ===== CAMERA SWITCH =====
async function switchCamera(key) {
    const sc = scanners[key];
    sc.facingMode = sc.facingMode === 'environment' ? 'user' : 'environment';
    showToast('🔄 Kamera değiştiriliyor...');

    // Yeniden başlat
    const videoId = getVideoId(key);
    const onDetect = key === 'main' ? onMainDetect : (key === 'form' ? onFormDetect : onSearchDetect);
    await killScanner(key);
    setTimeout(() => initScanner(key, videoId, onDetect), 300);
}

// ===== KILL SCANNER =====
async function killScanner(key) {
    const sc = scanners[key];
    if (sc.animId) { cancelAnimationFrame(sc.animId); sc.animId = null; }
    if (sc.stream) {
        sc.stream.getTracks().forEach(t => t.stop());
        sc.stream = null;
    }
    if (sc.videoEl) {
        sc.videoEl.srcObject = null;
    }
    sc.track = null;
    sc.reader = null;
    sc.torch = false;
    sc.zoom = 1;
    sc.buffer = [];
    sc.cooldown = false;

    const btn = document.getElementById(`${key}-torch-btn`);
    if (btn) btn.classList.remove('active');
}

function killAllScanners() {
    killScanner('form');
    killScanner('search');
    killScanner('main');
    document.getElementById('form-scanner-area').style.display = 'none';
    document.getElementById('search-scanner-area').style.display = 'none';
    const placeholder = document.getElementById('main-scanner-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');
    document.getElementById('main-scanner-toolbar')?.style && (document.getElementById('main-scanner-toolbar').style.display = 'none');
    const startBtn = document.getElementById('main-start-btn');
    const stopBtn = document.getElementById('main-stop-btn');
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
}

// ===== BEEP SOUND =====
function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1200;
        gain.gain.value = 0.15;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1600;
            gain2.gain.value = 0.15;
            osc2.start();
            osc2.stop(ctx.currentTime + 0.1);
        }, 150);
    } catch (e) {}
}

// ================================================================
//  FORM SCANNER
// ================================================================

function onFormDetect(code) {
    closeFormScanner();
    fillFormFromISBN(code);
}

async function openFormScanner() {
    document.getElementById('form-scanner-area').style.display = 'block';
    const ok = await initScanner('form', 'form-scanner-video', onFormDetect);
    if (!ok) closeFormScanner();
}

function closeFormScanner() {
    killScanner('form');
    document.getElementById('form-scanner-area').style.display = 'none';
}

function quickISBNFill() {
    const isbn = document.getElementById('quick-isbn').value.trim().replace(/[-\s]/g, '');
    if (!isbn) { showToast('❌ ISBN girin'); return; }
    if (!isValidISBN(isbn)) { showToast('❌ Geçersiz ISBN'); return; }
    fillFormFromISBN(isbn);
}

async function fillFormFromISBN(isbn) {
    showGlobalLoading(true);
    document.getElementById('book-isbn-field').value = isbn;
    try {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
        const data = await res.json();
        if (data.totalItems > 0) {
            const info = data.items[0].volumeInfo;
            document.getElementById('book-name').value = info.title || '';
            document.getElementById('book-author').value = info.authors ? info.authors.join(', ') : '';
            document.getElementById('book-publisher-field').value = info.publisher || '';
            document.getElementById('book-year').value = info.publishedDate ? info.publishedDate.substring(0, 4) : '';
            document.getElementById('book-pages-field').value = info.pageCount || '';
            document.getElementById('book-desc').value = info.description || '';
            if (info.imageLinks) document.getElementById('book-cover-url').value = (info.imageLinks.thumbnail || '').replace('http://', 'https://');
            showToast('✅ Kitap bilgileri dolduruldu');
        } else {
            const olRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
            const olData = await olRes.json();
            if (olData[`ISBN:${isbn}`]) {
                const ol = olData[`ISBN:${isbn}`];
                document.getElementById('book-name').value = ol.title || '';
                document.getElementById('book-author').value = ol.authors ? ol.authors.map(a => a.name).join(', ') : '';
                document.getElementById('book-publisher-field').value = ol.publishers ? ol.publishers.map(p => p.name).join(', ') : '';
                document.getElementById('book-pages-field').value = ol.number_of_pages || '';
                if (ol.cover) document.getElementById('book-cover-url').value = ol.cover.medium || ol.cover.small || '';
                showToast('✅ Bilgiler dolduruldu (Open Library)');
            } else {
                showToast('⚠️ Kitap bulunamadı. Manuel doldurun.');
            }
        }
    } catch { showToast('❌ API hatası'); }
    finally { showGlobalLoading(false); }
}

// ================================================================
//  SEARCH SCANNER
// ================================================================

function onSearchDetect(code) {
    closeSearchScanner();
    document.getElementById('search-input').value = code;
    filterBooks();
    showToast('🔍 ISBN ile aranıyor: ' + code);
}

async function openSearchScanner() {
    document.getElementById('search-scanner-area').style.display = 'block';
    const ok = await initScanner('search', 'search-scanner-video', onSearchDetect);
    if (!ok) closeSearchScanner();
}

function closeSearchScanner() {
    killScanner('search');
    document.getElementById('search-scanner-area').style.display = 'none';
}

// ================================================================
//  MAIN SCANNER
// ================================================================

function onMainDetect(code) {
    document.getElementById('scanned-isbn').textContent = code;
    document.getElementById('scan-result-area').style.display = 'block';

    const localMatch = books.find(b => b.isbn === code);
    const localEl = document.getElementById('scan-local-result');
    const actionsEl = document.getElementById('scan-actions');

    if (localMatch) {
        const cat = categories.find(c => c.id === localMatch.category);
        localEl.innerHTML = `<div class="local-match"><h4>📚 Kütüphanede Bulundu!</h4><p><strong>${esc(localMatch.name)}</strong> - ${esc(localMatch.author)}</p>${cat ? `<p>Kategori: ${cat.icon} ${cat.name}</p>` : ''}</div>`;
        actionsEl.innerHTML = `<button class="btn btn-primary" onclick="showBookDetail('${localMatch.id}')">📖 Detay</button><button class="btn btn-secondary" onclick="editBook('${localMatch.id}')">✏️ Düzenle</button>`;
    } else {
        localEl.innerHTML = `<div class="local-match" style="border-color:var(--warning);background:rgba(246,173,85,.08)"><h4 style="color:var(--warning)">⚠️ Kütüphanede Bulunamadı</h4><p>Bu ISBN ile kayıtlı kitap yok.</p></div>`;
        actionsEl.innerHTML = `<button class="btn btn-accent" onclick="addFromScan('${code}')">➕ Kütüphaneye Ekle</button>`;
    }

    fetchOnlineInfo(code);
}

async function startMainScanner() {
    document.getElementById('main-scanner-placeholder').classList.add('hidden');
    document.getElementById('main-start-btn').style.display = 'none';
    document.getElementById('main-stop-btn').style.display = 'inline-flex';
    document.getElementById('main-scanner-toolbar').style.display = 'flex';
    document.getElementById('scan-result-area').style.display = 'none';

    const ok = await initScanner('main', 'main-scanner-video', onMainDetect);
    if (!ok) stopMainScanner();
}

function stopMainScanner() {
    killScanner('main');
    const ph = document.getElementById('main-scanner-placeholder');
    if (ph) ph.classList.remove('hidden');
    document.getElementById('main-start-btn').style.display = 'inline-flex';
    document.getElementById('main-stop-btn').style.display = 'none';
    document.getElementById('main-scanner-toolbar').style.display = 'none';
}

async function fetchOnlineInfo(isbn) {
    const el = document.getElementById('scan-online-result');
    el.innerHTML = '<p style="text-align:center;color:var(--text-muted)">🔄 Online bilgi çekiliyor...</p>';
    try {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
        const data = await res.json();
        if (data.totalItems > 0) {
            const info = data.items[0].volumeInfo;
            el.innerHTML = `<div class="online-info"><h4>🌐 Online Bilgiler</h4><p><strong>${info.title || '-'}</strong></p><p>Yazar: ${info.authors?.join(', ') || '-'} | Yayınevi: ${info.publisher || '-'}</p><p>Yıl: ${info.publishedDate || '-'} | Sayfa: ${info.pageCount || '-'}</p>${info.description ? `<p style="margin-top:8px;font-size:.85rem;color:var(--text-muted)">${info.description.substring(0, 250)}...</p>` : ''}</div>`;
        } else {
            el.innerHTML = '<div class="online-info" style="border-color:var(--text-muted)"><h4>🌐 Online bilgi bulunamadı</h4></div>';
        }
    } catch { el.innerHTML = '<div class="online-info" style="border-color:var(--danger)"><h4>❌ Online bilgi alınamadı</h4></div>'; }
}

function addFromScan(isbn) {
    stopMainScanner();
    navigateTo('add-book');
    fillFormFromISBN(isbn);
}

// ================================================================
//  BOOK CRUD
// ================================================================

function saveBook(e) {
    e.preventDefault();
    const id = document.getElementById('book-id').value;
    const bookData = {
        id: id || genId(),
        name: document.getElementById('book-name').value.trim(),
        author: document.getElementById('book-author').value.trim(),
        isbn: document.getElementById('book-isbn-field').value.trim(),
        category: document.getElementById('book-category').value,
        year: document.getElementById('book-year').value,
        publisher: document.getElementById('book-publisher-field').value.trim(),
        pages: document.getElementById('book-pages-field').value,
        description: document.getElementById('book-desc').value.trim(),
        coverUrl: document.getElementById('book-cover-url').value.trim(),
        createdAt: id ? (books.find(b => b.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (id) {
        const idx = books.findIndex(b => b.id === id);
        if (idx !== -1) { books[idx] = bookData; showToast(`✅ "${bookData.name}" güncellendi`); }
    } else {
        if (bookData.isbn && books.find(b => b.isbn === bookData.isbn)) {
            if (!confirm('Bu ISBN zaten kayıtlı. Yine de ekleyelim mi?')) return false;
        }
        books.unshift(bookData);
        showToast(`✅ "${bookData.name}" eklendi`);
    }

    saveBooks(); renderAll(); resetForm(); navigateTo('books');
    return false;
}

function resetForm() {
    document.getElementById('book-form').reset();
    document.getElementById('book-id').value = '';
    document.getElementById('form-title').textContent = '➕ Yeni Kitap Ekle';
    document.getElementById('form-submit-btn').innerHTML = '💾 Kitabı Kaydet';
    closeFormScanner();
}

function editBook(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;
    closeModal(); navigateTo('add-book');
    document.getElementById('book-id').value = book.id;
    document.getElementById('book-name').value = book.name;
    document.getElementById('book-author').value = book.author;
    document.getElementById('book-isbn-field').value = book.isbn || '';
    document.getElementById('book-category').value = book.category;
    document.getElementById('book-year').value = book.year || '';
    document.getElementById('book-publisher-field').value = book.publisher || '';
    document.getElementById('book-pages-field').value = book.pages || '';
    document.getElementById('book-desc').value = book.description || '';
    document.getElementById('book-cover-url').value = book.coverUrl || '';
    document.getElementById('form-title').textContent = '✏️ Kitabı Düzenle';
    document.getElementById('form-submit-btn').innerHTML = '💾 Güncelle';
}

function deleteBook(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;
    document.getElementById('confirm-text').textContent = `"${book.name}" silinsin mi?`;
    document.getElementById('confirm-modal').style.display = 'flex';
    document.getElementById('confirm-yes').onclick = () => {
        books = books.filter(b => b.id !== id);
        saveBooks(); renderAll(); closeConfirm(); closeModal();
        showToast(`🗑️ "${book.name}" silindi`);
    };
}

function closeConfirm() { document.getElementById('confirm-modal').style.display = 'none'; }

function showBookDetail(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;
    const cat = categories.find(c => c.id === book.category);
    const cn = cat ? `${cat.icon} ${cat.name}` : 'Belirtilmemiş';
    document.getElementById('modal-body').innerHTML = `
        <div class="detail-grid">
            <div class="detail-cover">${book.coverUrl ? `<img src="${book.coverUrl}" onerror="this.parentElement.innerHTML='<div class=\\'cover-ph\\'>📕</div>'">` : '<div class="cover-ph">📕</div>'}</div>
            <div class="detail-info">
                <h2 style="font-size:1.3rem;margin-bottom:8px">${esc(book.name)}</h2>
                <div class="detail-row"><span class="dl">✍️ Yazar:</span><span class="dv">${esc(book.author)}</span></div>
                <div class="detail-row"><span class="dl">📂 Kategori:</span><span class="dv">${cn}</span></div>
                ${book.isbn ? `<div class="detail-row"><span class="dl">🏷️ ISBN:</span><span class="dv" style="font-family:monospace">${book.isbn}</span></div>` : ''}
                ${book.publisher ? `<div class="detail-row"><span class="dl">🏢 Yayınevi:</span><span class="dv">${esc(book.publisher)}</span></div>` : ''}
                ${book.year ? `<div class="detail-row"><span class="dl">📅 Yıl:</span><span class="dv">${book.year}</span></div>` : ''}
                ${book.pages ? `<div class="detail-row"><span class="dl">📄 Sayfa:</span><span class="dv">${book.pages}</span></div>` : ''}
                ${book.description ? `<div style="margin-top:12px"><strong style="color:var(--text-muted)">📝 Açıklama:</strong><p class="detail-desc">${esc(book.description)}</p></div>` : ''}
                <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
                    <button class="btn btn-primary btn-sm" onclick="editBook('${book.id}')">✏️ Düzenle</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteBook('${book.id}')">🗑️ Sil</button>
                </div>
            </div>
        </div>`;
    document.getElementById('book-detail-modal').style.display = 'flex';
}

function closeModal() { document.getElementById('book-detail-modal').style.display = 'none'; }

// ===== BOOKS LIST =====
function renderBooks() {
    const grid = document.getElementById('books-grid');
    const noBooks = document.getElementById('no-books');
    const filtered = getFilteredBooks();
    if (filtered.length === 0) { grid.innerHTML = ''; noBooks.style.display = 'block'; return; }
    noBooks.style.display = 'none';
    grid.className = `books-grid ${currentView === 'list' ? 'list-view' : ''}`;
    grid.innerHTML = filtered.map(book => {
        const cat = categories.find(c => c.id === book.category);
        const cl = cat ? `${cat.icon} ${cat.name}` : '';
        return `<div class="book-card-item" onclick="showBookDetail('${book.id}')">
            <div class="book-card-cover">${book.coverUrl ? `<img src="${book.coverUrl}" onerror="this.parentElement.innerHTML='<span class=\\'cover-placeholder\\'>📕</span>'">` : '<span class="cover-placeholder">📕</span>'}</div>
            <div class="book-card-body">
                ${cl ? `<span class="book-card-category">${cl}</span>` : ''}
                <h4 class="book-card-title">${esc(book.name)}</h4>
                <p class="book-card-author">✍️ ${esc(book.author)}</p>
                <div class="book-card-meta">${book.year ? `<span>📅 ${book.year}</span>` : '<span></span>'}${book.pages ? `<span>📄 ${book.pages}s</span>` : '<span></span>'}</div>
            </div>
            <div class="book-card-actions" onclick="event.stopPropagation()">
                <button class="btn btn-ghost btn-sm" onclick="editBook('${book.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteBook('${book.id}')">🗑️</button>
            </div></div>`;
    }).join('');
}

function getFilteredBooks() {
    const search = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const catFilter = document.getElementById('filter-category')?.value || '';
    const sort = document.getElementById('sort-select')?.value || 'newest';
    let result = [...books];
    if (search) result = result.filter(b => b.name.toLowerCase().includes(search) || b.author.toLowerCase().includes(search) || (b.isbn && b.isbn.includes(search)));
    if (catFilter) result = result.filter(b => b.category === catFilter);
    switch (sort) {
        case 'newest': result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
        case 'oldest': result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
        case 'name-asc': result.sort((a, b) => a.name.localeCompare(b.name, 'tr')); break;
        case 'name-desc': result.sort((a, b) => b.name.localeCompare(a.name, 'tr')); break;
        case 'author-asc': result.sort((a, b) => a.author.localeCompare(b.author, 'tr')); break;
    }
    return result;
}

function filterBooks() { renderBooks(); }
function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
    renderBooks();
}

// ===== UTILS =====
function isValidISBN(code) {
    if (!code) return false;
    const c = code.replace(/[-\s]/g, '');
    return /^\d{10}$/.test(c) || /^\d{13}$/.test(c);
}

function genId() { return 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); }

function esc(str) {
    if (!str) return '';
    const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}

function turkishSlug(s) {
    return s.toLowerCase().replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function showGlobalLoading(show) {
    document.getElementById('global-loading').style.display = show ? 'flex' : 'none';
}
