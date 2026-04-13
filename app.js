// ============================================
//  KÜTÜPHANE YÖNETİM SİSTEMİ - APP.JS
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

// ===== DATA STORE =====
let books = [];
let categories = [];
let currentView = 'grid';
let activeFormScanner = null;
let activeSearchScanner = null;
let activeMainScanner = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderAll();
});

// ===== DATA PERSISTENCE =====
function loadData() {
    const savedBooks = localStorage.getItem('lib_books');
    const savedCategories = localStorage.getItem('lib_categories');

    books = savedBooks ? JSON.parse(savedBooks) : [];

    if (savedCategories) {
        categories = JSON.parse(savedCategories);
        // Ensure defaults exist
        DEFAULT_CATEGORIES.forEach(dc => {
            if (!categories.find(c => c.id === dc.id)) {
                categories.push(dc);
            }
        });
    } else {
        categories = [...DEFAULT_CATEGORIES];
    }

    saveCategories();
}

function saveBooks() {
    localStorage.setItem('lib_books', JSON.stringify(books));
}

function saveCategories() {
    localStorage.setItem('lib_categories', JSON.stringify(categories));
}

// ===== RENDER ALL =====
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
    // Close scanners
    closeFormScanner();
    closeSearchScanner();
    stopMainScanner();

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.querySelector(`[data-page="${page}"]`);
    if (navBtn) navBtn.classList.add('active');

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Update title
    const titles = {
        'dashboard': 'Ana Sayfa',
        'add-book': 'Kitap Ekle',
        'books': 'Kitaplar',
        'scan-search': 'Barkod Tara / Ara',
        'categories': 'Kategoriler'
    };
    document.getElementById('page-title').textContent = titles[page] || '';

    // Refresh page-specific data
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

// ===== STATS & DASHBOARD =====
function updateStats() {
    document.getElementById('stat-total').textContent = books.length;
    document.getElementById('stat-categories').textContent = categories.length;

    const now = new Date();
    const thisMonth = books.filter(b => {
        const d = new Date(b.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    document.getElementById('stat-recent').textContent = thisMonth;

    const authors = new Set(books.map(b => b.author.toLowerCase().trim()));
    document.getElementById('stat-authors').textContent = authors.size;
}

function updateTopbarCount() {
    document.getElementById('topbar-count').textContent = `${books.length} Kitap`;
}

function renderDashboard() {
    // Category chart
    const chartEl = document.getElementById('category-chart');
    const catCounts = {};
    categories.forEach(c => catCounts[c.id] = 0);
    books.forEach(b => {
        if (catCounts[b.category] !== undefined) catCounts[b.category]++;
    });

    const maxCount = Math.max(...Object.values(catCounts), 1);
    const colors = ['#6C63FF', '#48BB78', '#F6AD55', '#FC8181', '#63B3ED', '#B794F4', '#F687B3', '#68D391', '#FBD38D', '#FEB2B2', '#76E4F7', '#C4B5FD'];

    chartEl.innerHTML = categories.map((cat, i) => {
        const count = catCounts[cat.id] || 0;
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const color = colors[i % colors.length];
        return `
            <div class="chart-bar">
                <span class="chart-bar-label">${cat.icon} ${cat.name}</span>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill" style="width:${Math.max(pct, 4)}%;background:${color}">${count}</div>
                </div>
            </div>
        `;
    }).join('');

    // Recent books
    const recentEl = document.getElementById('recent-books');
    const recentBooks = [...books].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

    if (recentBooks.length === 0) {
        recentEl.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span><p>Henüz kitap eklenmemiş</p></div>';
    } else {
        recentEl.innerHTML = recentBooks.map(b => `
            <div class="recent-book-item" onclick="showBookDetail('${b.id}')">
                <div class="rb-cover">
                    ${b.coverUrl ? `<img src="${b.coverUrl}" onerror="this.parentElement.innerHTML='📕'" style="width:36px;height:52px;object-fit:cover;border-radius:4px">` : '📕'}
                </div>
                <div class="rb-info">
                    <div class="rb-title">${escapeHtml(b.name)}</div>
                    <div class="rb-author">${escapeHtml(b.author)}</div>
                </div>
            </div>
        `).join('');
    }

    updateStats();
    updateTopbarCount();
}

// ===== CATEGORY SELECTS =====
function renderCategorySelects() {
    const formSelect = document.getElementById('book-category');
    const filterSelect = document.getElementById('filter-category');

    const options = categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

    if (formSelect) {
        const currentVal = formSelect.value;
        formSelect.innerHTML = `<option value="">Kategori seçin...</option>${options}`;
        if (currentVal) formSelect.value = currentVal;
    }

    if (filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = `<option value="">Tüm Kategoriler</option>${options}`;
        if (currentVal) filterSelect.value = currentVal;
    }
}

// ===== CATEGORIES PAGE =====
function renderCategories() {
    const listEl = document.getElementById('categories-list');
    const catCounts = {};
    books.forEach(b => {
        catCounts[b.category] = (catCounts[b.category] || 0) + 1;
    });

    listEl.innerHTML = categories.map(cat => `
        <div class="category-item">
            <span class="cat-icon">${cat.icon}</span>
            <span class="cat-name">${escapeHtml(cat.name)}</span>
            ${cat.isDefault ? '<span class="cat-default-badge">Varsayılan</span>' : ''}
            <span class="cat-count">${catCounts[cat.id] || 0} kitap</span>
            <div class="cat-actions">
                ${!cat.isDefault ? `
                    <button class="btn btn-ghost btn-sm" onclick="editCategory('${cat.id}')" title="Düzenle">✏️</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteCategory('${cat.id}')" title="Sil">🗑️</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function addCategory() {
    const nameInput = document.getElementById('new-category-name');
    const iconInput = document.getElementById('new-category-icon');
    const name = nameInput.value.trim();
    const icon = iconInput.value.trim() || '📁';

    if (!name) {
        showToast('❌ Kategori adı girin');
        return;
    }

    const id = name.toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    if (categories.find(c => c.id === id)) {
        showToast('❌ Bu kategori zaten mevcut');
        return;
    }

    categories.push({ id, name, icon, isDefault: false });
    saveCategories();
    renderCategories();
    renderCategorySelects();
    nameInput.value = '';
    iconInput.value = '';
    showToast(`✅ "${name}" kategorisi eklendi`);
}

function editCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const newName = prompt('Kategori adını düzenleyin:', cat.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) { showToast('❌ Boş ad girilemez'); return; }

    const newIcon = prompt('Emoji girin:', cat.icon);
    cat.name = trimmed;
    if (newIcon !== null && newIcon.trim()) cat.icon = newIcon.trim();

    saveCategories();
    renderCategories();
    renderCategorySelects();
    showToast(`✅ Kategori güncellendi`);
}

function deleteCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const count = books.filter(b => b.category === id).length;
    const msg = count > 0
        ? `"${cat.name}" kategorisinde ${count} kitap var. Kategoriyi silmek kitapların kategorisini temizleyecek. Devam?`
        : `"${cat.name}" kategorisini silmek istediğinize emin misiniz?`;

    if (!confirm(msg)) return;

    // Remove category from books
    books.forEach(b => { if (b.category === id) b.category = ''; });
    saveBooks();

    categories = categories.filter(c => c.id !== id);
    saveCategories();

    renderCategories();
    renderCategorySelects();
    renderAll();
    showToast(`🗑️ "${cat.name}" kategorisi silindi`);
}

// ===== BOOK FORM =====
function saveBook(e) {
    e.preventDefault();

    const id = document.getElementById('book-id').value;
    const bookData = {
        id: id || generateId(),
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
        // Update
        const index = books.findIndex(b => b.id === id);
        if (index !== -1) {
            books[index] = bookData;
            showToast(`✅ "${bookData.name}" güncellendi`);
        }
    } else {
        // Check duplicate ISBN
        if (bookData.isbn && books.find(b => b.isbn === bookData.isbn)) {
            if (!confirm('Bu ISBN ile kayıtlı bir kitap zaten var. Yine de eklemek istiyor musunuz?')) return false;
        }
        books.unshift(bookData);
        showToast(`✅ "${bookData.name}" eklendi`);
    }

    saveBooks();
    renderAll();
    resetForm();
    navigateTo('books');
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

    closeModal();
    navigateTo('add-book');

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

    document.getElementById('page-add-book').scrollIntoView({ behavior: 'smooth' });
}

function deleteBook(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;

    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-text').textContent = `"${book.name}" kitabını silmek istediğinize emin misiniz?`;
    modal.style.display = 'flex';

    document.getElementById('confirm-yes').onclick = () => {
        books = books.filter(b => b.id !== id);
        saveBooks();
        renderAll();
        closeConfirm();
        closeModal();
        showToast(`🗑️ "${book.name}" silindi`);
    };
}

function closeConfirm() {
    document.getElementById('confirm-modal').style.display = 'none';
}

// ===== BOOK DETAIL MODAL =====
function showBookDetail(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;

    const cat = categories.find(c => c.id === book.category);
    const catName = cat ? `${cat.icon} ${cat.name}` : 'Belirtilmemiş';

    const modal = document.getElementById('book-detail-modal');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
        <div class="detail-grid">
            <div class="detail-cover">
                ${book.coverUrl
                    ? `<img src="${book.coverUrl}" alt="${escapeHtml(book.name)}" onerror="this.parentElement.innerHTML='<div class=\\'cover-ph\\'>📕</div>'">`
                    : '<div class="cover-ph">📕</div>'
                }
            </div>
            <div class="detail-info">
                <h2 style="font-size:1.3rem;margin-bottom:8px">${escapeHtml(book.name)}</h2>
                <div class="detail-row"><span class="dl">✍️ Yazar:</span><span class="dv">${escapeHtml(book.author)}</span></div>
                <div class="detail-row"><span class="dl">📂 Kategori:</span><span class="dv">${catName}</span></div>
                ${book.isbn ? `<div class="detail-row"><span class="dl">🏷️ ISBN:</span><span class="dv" style="font-family:monospace;letter-spacing:1px">${book.isbn}</span></div>` : ''}
                ${book.publisher ? `<div class="detail-row"><span class="dl">🏢 Yayınevi:</span><span class="dv">${escapeHtml(book.publisher)}</span></div>` : ''}
                ${book.year ? `<div class="detail-row"><span class="dl">📅 Yıl:</span><span class="dv">${book.year}</span></div>` : ''}
                ${book.pages ? `<div class="detail-row"><span class="dl">📄 Sayfa:</span><span class="dv">${book.pages}</span></div>` : ''}
                ${book.description ? `<div style="margin-top:12px"><strong style="color:var(--text-muted)">📝 Açıklama:</strong><p class="detail-desc">${escapeHtml(book.description)}</p></div>` : ''}
                <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
                    <button class="btn btn-primary btn-sm" onclick="editBook('${book.id}')">✏️ Düzenle</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteBook('${book.id}')">🗑️ Sil</button>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('book-detail-modal').style.display = 'none';
}

// ===== BOOKS LIST =====
function renderBooks() {
    const grid = document.getElementById('books-grid');
    const noBooks = document.getElementById('no-books');
    const filtered = getFilteredBooks();

    if (filtered.length === 0) {
        grid.innerHTML = '';
        noBooks.style.display = 'block';
        return;
    }

    noBooks.style.display = 'none';
    grid.className = `books-grid ${currentView === 'list' ? 'list-view' : ''}`;

    grid.innerHTML = filtered.map(book => {
        const cat = categories.find(c => c.id === book.category);
        const catLabel = cat ? `${cat.icon} ${cat.name}` : '';
        return `
            <div class="book-card-item" onclick="showBookDetail('${book.id}')">
                <div class="book-card-cover">
                    ${book.coverUrl
                        ? `<img src="${book.coverUrl}" alt="" onerror="this.parentElement.innerHTML='<span class=\\'cover-placeholder\\'>📕</span>'">`
                        : '<span class="cover-placeholder">📕</span>'
                    }
                </div>
                <div class="book-card-body">
                    ${catLabel ? `<span class="book-card-category">${catLabel}</span>` : ''}
                    <h4 class="book-card-title">${escapeHtml(book.name)}</h4>
                    <p class="book-card-author">✍️ ${escapeHtml(book.author)}</p>
                    <div class="book-card-meta">
                        ${book.year ? `<span>📅 ${book.year}</span>` : '<span></span>'}
                        ${book.pages ? `<span>📄 ${book.pages}s</span>` : '<span></span>'}
                    </div>
                </div>
                <div class="book-card-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-ghost btn-sm" onclick="editBook('${book.id}')">✏️</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteBook('${book.id}')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function getFilteredBooks() {
    const search = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const catFilter = document.getElementById('filter-category')?.value || '';
    const sort = document.getElementById('sort-select')?.value || 'newest';

    let result = [...books];

    // Search
    if (search) {
        result = result.filter(b =>
            b.name.toLowerCase().includes(search) ||
            b.author.toLowerCase().includes(search) ||
            (b.isbn && b.isbn.includes(search))
        );
    }

    // Category filter
    if (catFilter) {
        result = result.filter(b => b.category === catFilter);
    }

    // Sort
    switch (sort) {
        case 'newest': result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
        case 'oldest': result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
        case 'name-asc': result.sort((a, b) => a.name.localeCompare(b.name, 'tr')); break;
        case 'name-desc': result.sort((a, b) => b.name.localeCompare(a.name, 'tr')); break;
        case 'author-asc': result.sort((a, b) => a.author.localeCompare(b.author, 'tr')); break;
    }

    return result;
}

function filterBooks() {
    renderBooks();
}

function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
    renderBooks();
}

// ===== FORM SCANNER (for Add Book page) =====
function openFormScanner() {
    closeFormScanner();
    const area = document.getElementById('form-scanner-area');
    area.style.display = 'block';

    Quagga.init({
        inputStream: { name: "Live", type: "LiveStream", target: document.querySelector('#form-interactive'), constraints: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
        locator: { patchSize: "medium", halfSample: true },
        decoder: { readers: ["ean_reader", "ean_8_reader", "upc_reader"] },
        locate: true, frequency: 10
    }, function (err) {
        if (err) { showToast('❌ Kamera açılamadı'); closeFormScanner(); return; }
        Quagga.start();
        activeFormScanner = true;
    });

    Quagga.onDetected(onFormBarcodeDetected);
}

function onFormBarcodeDetected(result) {
    const code = result.codeResult.code;
    if (!isValidISBN(code)) return;
    if (navigator.vibrate) navigator.vibrate(200);
    showToast('✅ ISBN tespit edildi: ' + code);
    closeFormScanner();
    fillFormFromISBN(code);
}

function closeFormScanner() {
    if (activeFormScanner) {
        Quagga.stop();
        Quagga.offDetected(onFormBarcodeDetected);
        activeFormScanner = null;
    }
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
            if (info.imageLinks) {
                document.getElementById('book-cover-url').value = (info.imageLinks.thumbnail || '').replace('http://', 'https://');
            }
            showToast('✅ Kitap bilgileri dolduruldu');
        } else {
            // Try Open Library
            const olRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
            const olData = await olRes.json();
            const olKey = `ISBN:${isbn}`;
            if (olData[olKey]) {
                const ol = olData[olKey];
                document.getElementById('book-name').value = ol.title || '';
                document.getElementById('book-author').value = ol.authors ? ol.authors.map(a => a.name).join(', ') : '';
                document.getElementById('book-publisher-field').value = ol.publishers ? ol.publishers.map(p => p.name).join(', ') : '';
                document.getElementById('book-pages-field').value = ol.number_of_pages || '';
                if (ol.cover) document.getElementById('book-cover-url').value = ol.cover.medium || ol.cover.small || '';
                showToast('✅ Kitap bilgileri dolduruldu (Open Library)');
            } else {
                showToast('⚠️ Bu ISBN ile kitap bulunamadı. Manuel doldurun.');
            }
        }
    } catch (err) {
        console.error(err);
        showToast('❌ API hatası. Manuel doldurun.');
    } finally {
        showGlobalLoading(false);
    }
}

// ===== SEARCH SCANNER (for Books page) =====
function openSearchScanner() {
    closeSearchScanner();
    const area = document.getElementById('search-scanner-area');
    area.style.display = 'block';

    Quagga.init({
        inputStream: { name: "Live", type: "LiveStream", target: document.querySelector('#search-interactive'), constraints: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
        locator: { patchSize: "medium", halfSample: true },
        decoder: { readers: ["ean_reader", "ean_8_reader", "upc_reader"] },
        locate: true, frequency: 10
    }, function (err) {
        if (err) { showToast('❌ Kamera açılamadı'); closeSearchScanner(); return; }
        Quagga.start();
        activeSearchScanner = true;
    });

    Quagga.onDetected(onSearchBarcodeDetected);
}

function onSearchBarcodeDetected(result) {
    const code = result.codeResult.code;
    if (!isValidISBN(code)) return;
    if (navigator.vibrate) navigator.vibrate(200);
    closeSearchScanner();
    document.getElementById('search-input').value = code;
    filterBooks();
    showToast('🔍 ISBN ile aranıyor: ' + code);
}

function closeSearchScanner() {
    if (activeSearchScanner) {
        Quagga.stop();
        Quagga.offDetected(onSearchBarcodeDetected);
        activeSearchScanner = null;
    }
    document.getElementById('search-scanner-area').style.display = 'none';
}

// ===== MAIN SCANNER (Scan & Search page) =====
function startMainScanner() {
    const placeholder = document.getElementById('main-scanner-placeholder');
    const startBtn = document.getElementById('main-start-btn');
    const stopBtn = document.getElementById('main-stop-btn');

    placeholder.style.display = 'none';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';

    // Reset result area
    document.getElementById('scan-result-area').style.display = 'none';

    Quagga.init({
        inputStream: { name: "Live", type: "LiveStream", target: document.querySelector('#main-interactive'), constraints: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
        locator: { patchSize: "medium", halfSample: true },
        decoder: { readers: ["ean_reader", "ean_8_reader", "upc_reader"] },
        locate: true, frequency: 10
    }, function (err) {
        if (err) { showToast('❌ Kamera açılamadı'); stopMainScanner(); return; }
        Quagga.start();
        activeMainScanner = true;
        showToast('📷 Kamera aktif - Barkodu gösterin');
    });

    Quagga.onDetected(onMainBarcodeDetected);
}

let mainScanCooldown = false;

function onMainBarcodeDetected(result) {
    const code = result.codeResult.code;
    if (!isValidISBN(code) || mainScanCooldown) return;

    mainScanCooldown = true;
    if (navigator.vibrate) navigator.vibrate(200);

    document.getElementById('scanned-isbn').textContent = code;
    document.getElementById('scan-result-area').style.display = 'block';

    // Search locally
    const localMatch = books.find(b => b.isbn === code);
    const localEl = document.getElementById('scan-local-result');
    const actionsEl = document.getElementById('scan-actions');

    if (localMatch) {
        const cat = categories.find(c => c.id === localMatch.category);
        localEl.innerHTML = `
            <div class="local-match">
                <h4>📚 Kütüphanede Bulundu!</h4>
                <p><strong>${escapeHtml(localMatch.name)}</strong> - ${escapeHtml(localMatch.author)}</p>
                ${cat ? `<p>Kategori: ${cat.icon} ${cat.name}</p>` : ''}
            </div>
        `;
        actionsEl.innerHTML = `
            <button class="btn btn-primary" onclick="showBookDetail('${localMatch.id}')">📖 Detayı Gör</button>
            <button class="btn btn-secondary" onclick="editBook('${localMatch.id}')">✏️ Düzenle</button>
        `;
    } else {
        localEl.innerHTML = `<div class="local-match" style="border-color:var(--warning);background:rgba(246,173,85,.08)"><h4 style="color:var(--warning)">⚠️ Kütüphanede Bulunamadı</h4><p>Bu ISBN ile kayıtlı kitap yok.</p></div>`;
        actionsEl.innerHTML = `<button class="btn btn-accent" onclick="addFromScan('${code}')">➕ Kütüphaneye Ekle</button>`;
    }

    // Fetch online info
    fetchOnlineInfo(code);

    setTimeout(() => { mainScanCooldown = false; }, 3000);
}

async function fetchOnlineInfo(isbn) {
    const onlineEl = document.getElementById('scan-online-result');
    onlineEl.innerHTML = '<p style="text-align:center;color:var(--text-muted)">🔄 Online bilgi çekiliyor...</p>';

    try {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
        const data = await res.json();

        if (data.totalItems > 0) {
            const info = data.items[0].volumeInfo;
            onlineEl.innerHTML = `
                <div class="online-info">
                    <h4>🌐 Online Bilgiler (Google Books)</h4>
                    <p><strong>${info.title || 'Bilinmiyor'}</strong></p>
                    <p>Yazar: ${info.authors ? info.authors.join(', ') : 'Bilinmiyor'}</p>
                    <p>Yayınevi: ${info.publisher || '-'} | Yıl: ${info.publishedDate || '-'} | Sayfa: ${info.pageCount || '-'}</p>
                    ${info.description ? `<p style="margin-top:8px;font-size:.85rem;color:var(--text-muted)">${info.description.substring(0, 200)}...</p>` : ''}
                </div>
            `;
        } else {
            onlineEl.innerHTML = '<div class="online-info" style="border-color:var(--text-muted)"><h4>🌐 Online bilgi bulunamadı</h4></div>';
        }
    } catch {
        onlineEl.innerHTML = '<div class="online-info" style="border-color:var(--danger)"><h4>❌ Online bilgi alınamadı</h4></div>';
    }
}

function addFromScan(isbn) {
    stopMainScanner();
    navigateTo('add-book');
    fillFormFromISBN(isbn);
}

function stopMainScanner() {
    if (activeMainScanner) {
        Quagga.stop();
        Quagga.offDetected(onMainBarcodeDetected);
        activeMainScanner = null;
    }

    const placeholder = document.getElementById('main-scanner-placeholder');
    const startBtn = document.getElementById('main-start-btn');
    const stopBtn = document.getElementById('main-stop-btn');

    if (placeholder) placeholder.style.display = 'flex';
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
}

// ===== UTILS =====
function isValidISBN(code) {
    if (!code) return false;
    const cleaned = code.replace(/[-\s]/g, '');
    return /^\d{10}$/.test(cleaned) || /^\d{13}$/.test(cleaned);
}

function generateId() {
    return 'book_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showGlobalLoading(show) {
    document.getElementById('global-loading').style.display = show ? 'flex' : 'none';
}
