// ===== GLOBAL STATE =====
let scannerRunning = false;
let lastScannedCode = '';
let scanCooldown = false;

// ===== TAB NAVIGATION =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Deactivate all tabs
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Activate selected
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab') + '-tab';
        document.getElementById(tabId).classList.add('active');

        // Load history if history tab
        if (btn.getAttribute('data-tab') === 'history') {
            renderHistory();
        }
    });
});

// ===== ENTER KEY FOR MANUAL INPUT =====
document.getElementById('isbn-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        manualSearch();
    }
});

// ===== SCANNER FUNCTIONS =====
function startScanner() {
    const placeholder = document.getElementById('scanner-placeholder');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    placeholder.style.display = 'none';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#interactive'),
            constraints: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        },
        locator: {
            patchSize: "medium",
            halfSample: true
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        decoder: {
            readers: [
                "ean_reader",
                "ean_8_reader",
                "upc_reader",
                "upc_e_reader"
            ]
        },
        locate: true,
        frequency: 10
    }, function (err) {
        if (err) {
            console.error('Scanner Error:', err);
            showError('Kamera erişimi sağlanamadı. Lütfen kamera izinlerini kontrol edin.');
            stopScanner();
            return;
        }
        Quagga.start();
        scannerRunning = true;
        showToast('📷 Kamera aktif - Barkodu kameraya gösterin');
    });

    // Barcode detected event
    Quagga.onDetected(onBarcodeDetected);
}

function stopScanner() {
    if (scannerRunning) {
        Quagga.stop();
        Quagga.offDetected(onBarcodeDetected);
        scannerRunning = false;
    }

    const placeholder = document.getElementById('scanner-placeholder');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    placeholder.style.display = 'flex';
    startBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
}

function onBarcodeDetected(result) {
    const code = result.codeResult.code;

    // Validate ISBN (10 or 13 digits)
    if (!isValidISBN(code)) return;

    // Cooldown to prevent multiple scans
    if (scanCooldown || code === lastScannedCode) return;

    scanCooldown = true;
    lastScannedCode = code;

    // Show detected code
    const detectedDiv = document.getElementById('detected-code');
    const isbnDisplay = document.getElementById('isbn-display');
    detectedDiv.style.display = 'block';
    isbnDisplay.textContent = code;

    // Vibrate if supported
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }

    showToast('✅ Barkod tespit edildi: ' + code);

    // Fetch book info
    fetchBookInfo(code);

    // Reset cooldown after 3 seconds
    setTimeout(() => {
        scanCooldown = false;
    }, 3000);
}

// ===== ISBN VALIDATION =====
function isValidISBN(code) {
    // Check if it's 10 or 13 digits
    if (!code) return false;
    const cleaned = code.replace(/[-\s]/g, '');
    return /^(97[89])?\d{9}[\dXx]$/.test(cleaned) || /^\d{13}$/.test(cleaned);
}

// ===== MANUAL SEARCH =====
function manualSearch() {
    const input = document.getElementById('isbn-input');
    const isbn = input.value.trim().replace(/[-\s]/g, '');

    if (!isbn) {
        showError('Lütfen bir ISBN numarası girin.');
        return;
    }

    if (!isValidISBN(isbn)) {
        showError('Geçersiz ISBN numarası. 10 veya 13 haneli bir ISBN girin.');
        return;
    }

    fetchBookInfo(isbn);
}

// ===== FETCH BOOK INFO =====
async function fetchBookInfo(isbn) {
    showLoading(true);
    closeResult();
    closeError();

    try {
        // Try Google Books API
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
        const data = await response.json();

        if (data.totalItems === 0) {
            // Try Open Library as fallback
            const olResponse = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
            const olData = await olResponse.json();
            const olKey = `ISBN:${isbn}`;

            if (olData[olKey]) {
                displayOpenLibraryBook(olData[olKey], isbn);
            } else {
                showError(`ISBN "${isbn}" ile eşleşen kitap bulunamadı. Lütfen numarayı kontrol edin.`);
            }
        } else {
            displayGoogleBook(data.items[0], isbn);
        }
    } catch (error) {
        console.error('API Error:', error);
        showError('Kitap bilgileri alınırken bir hata oluştu. İnternet bağlantınızı kontrol edin.');
    } finally {
        showLoading(false);
    }
}

// ===== DISPLAY GOOGLE BOOKS DATA =====
function displayGoogleBook(item, isbn) {
    const info = item.volumeInfo;

    const bookData = {
        title: info.title || 'Bilinmiyor',
        authors: info.authors ? info.authors.join(', ') : 'Bilinmiyor',
        publisher: info.publisher || 'Bilinmiyor',
        publishedDate: info.publishedDate || 'Bilinmiyor',
        pageCount: info.pageCount || 'Bilinmiyor',
        isbn: isbn,
        language: getLanguageName(info.language) || 'Bilinmiyor',
        categories: info.categories ? info.categories.join(', ') : 'Bilinmiyor',
        description: info.description || 'Açıklama mevcut değil.',
        thumbnail: info.imageLinks ? (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail) : null,
        previewLink: info.previewLink || null,
        infoLink: info.infoLink || null
    };

    renderBookCard(bookData);
    saveToHistory(bookData);
}

// ===== DISPLAY OPEN LIBRARY DATA =====
function displayOpenLibraryBook(data, isbn) {
    const bookData = {
        title: data.title || 'Bilinmiyor',
        authors: data.authors ? data.authors.map(a => a.name).join(', ') : 'Bilinmiyor',
        publisher: data.publishers ? data.publishers.map(p => p.name).join(', ') : 'Bilinmiyor',
        publishedDate: data.publish_date || 'Bilinmiyor',
        pageCount: data.number_of_pages || 'Bilinmiyor',
        isbn: isbn,
        language: 'Bilinmiyor',
        categories: data.subjects ? data.subjects.slice(0, 5).map(s => s.name).join(', ') : 'Bilinmiyor',
        description: data.notes || (data.excerpts ? data.excerpts[0].text : 'Açıklama mevcut değil.'),
        thumbnail: data.cover ? (data.cover.medium || data.cover.small) : null,
        previewLink: data.url || null,
        infoLink: data.url || null
    };

    renderBookCard(bookData);
    saveToHistory(bookData);
}

// ===== RENDER BOOK CARD =====
function renderBookCard(book) {
    document.getElementById('book-title').textContent = book.title;
    document.getElementById('book-authors').textContent = book.authors;
    document.getElementById('book-publisher').textContent = book.publisher;
    document.getElementById('book-date').textContent = book.publishedDate;
    document.getElementById('book-pages').textContent = book.pageCount;
    document.getElementById('book-isbn').textContent = book.isbn;
    document.getElementById('book-language').textContent = book.language;
    document.getElementById('book-categories').textContent = book.categories;
    document.getElementById('book-description').textContent = book.description;

    // Cover image
    const coverImg = document.getElementById('book-cover');
    const noCover = document.getElementById('no-cover');

    if (book.thumbnail) {
        // Replace http with https
        const secureUrl = book.thumbnail.replace('http://', 'https://');
        coverImg.src = secureUrl;
        coverImg.style.display = 'block';
        noCover.style.display = 'none';

        coverImg.onerror = () => {
            coverImg.style.display = 'none';
            noCover.style.display = 'flex';
        };
    } else {
        coverImg.style.display = 'none';
        noCover.style.display = 'flex';
    }

    // Links
    const previewLink = document.getElementById('book-preview');
    const infoLink = document.getElementById('book-info');

    if (book.previewLink) {
        previewLink.href = book.previewLink;
        previewLink.style.display = 'inline-flex';
    } else {
        previewLink.style.display = 'none';
    }

    if (book.infoLink) {
        infoLink.href = book.infoLink;
        infoLink.style.display = 'inline-flex';
    } else {
        infoLink.style.display = 'none';
    }

    document.getElementById('book-result').style.display = 'block';

    // Scroll to result
    setTimeout(() => {
        document.getElementById('book-result').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }, 100);
}

// ===== LANGUAGE HELPER =====
function getLanguageName(code) {
    const languages = {
        'tr': 'Türkçe',
        'en': 'İngilizce',
        'de': 'Almanca',
        'fr': 'Fransızca',
        'es': 'İspanyolca',
        'it': 'İtalyanca',
        'pt': 'Portekizce',
        'ru': 'Rusça',
        'ja': 'Japonca',
        'zh': 'Çince',
        'ko': 'Korece',
        'ar': 'Arapça',
        'nl': 'Felemenkçe',
        'sv': 'İsveççe',
        'pl': 'Lehçe',
        'da': 'Danca',
        'no': 'Norveççe',
        'fi': 'Fince',
        'el': 'Yunanca',
        'cs': 'Çekçe',
        'hu': 'Macarca',
        'ro': 'Rumence',
        'uk': 'Ukraynaca',
        'hi': 'Hintçe',
        'he': 'İbranice'
    };
    return languages[code] || code;
}

// ===== HISTORY FUNCTIONS =====
function saveToHistory(bookData) {
    let history = JSON.parse(localStorage.getItem('isbn_history') || '[]');

    // Remove if already exists
    history = history.filter(h => h.isbn !== bookData.isbn);

    // Add to beginning
    history.unshift({
        isbn: bookData.isbn,
        title: bookData.title,
        authors: bookData.authors,
        thumbnail: bookData.thumbnail,
        timestamp: Date.now()
    });

    // Keep max 50 items
    history = history.slice(0, 50);

    localStorage.setItem('isbn_history', JSON.stringify(history));
}

function renderHistory() {
    const historyList = document.getElementById('history-list');
    const history = JSON.parse(localStorage.getItem('isbn_history') || '[]');

    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>Henüz tarama geçmişi yok</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = history.map(item => `
        <div class="history-item" onclick="searchFromHistory('${item.isbn}')">
            ${item.thumbnail
            ? `<img src="${item.thumbnail.replace('http://', 'https://')}" alt="" class="history-item-cover" onerror="this.outerHTML='<div class=\\'history-item-cover-placeholder\\'>📕</div>'">`
            : '<div class="history-item-cover-placeholder">📕</div>'
        }
            <div class="history-item-info">
                <div class="history-item-title">${item.title}</div>
                <div class="history-item-author">${item.authors}</div>
            </div>
            <div class="history-item-isbn">${item.isbn}</div>
        </div>
    `).join('');
}

function searchFromHistory(isbn) {
    // Switch to scan tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="scan"]').classList.add('active');
    document.getElementById('scan-tab').classList.add('active');

    fetchBookInfo(isbn);
}

function clearHistory() {
    if (confirm('Tüm tarama geçmişi silinecek. Emin misiniz?')) {
        localStorage.removeItem('isbn_history');
        renderHistory();
        showToast('🗑️ Geçmiş temizlendi');
    }
}

// ===== SHARE FUNCTION =====
function shareBook() {
    const title = document.getElementById('book-title').textContent;
    const authors = document.getElementById('book-authors').textContent;
    const isbn = document.getElementById('book-isbn').textContent;

    const shareText = `📚 ${title}\n✍️ ${authors}\n🏷️ ISBN: ${isbn}`;

    if (navigator.share) {
        navigator.share({
            title: title,
            text: shareText,
            url: window.location.href
        }).catch(() => {
            copyToClipboard(shareText);
        });
    } else {
        copyToClipboard(shareText);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Kitap bilgileri panoya kopyalandı');
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('📋 Kitap bilgileri panoya kopyalandı');
    });
}

// ===== UI HELPERS =====
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    document.getElementById('error-text').textContent = message;
    errorDiv.style.display = 'block';
}

function closeError() {
    document.getElementById('error-message').style.display = 'none';
}

function closeResult() {
    document.getElementById('book-result').style.display = 'none';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    renderHistory();
});
