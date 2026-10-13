// main.js - Literarisches Archiv (Daniel Holzknecht)
// Single-Page-Application Architektur mit DeepMind / Gemini Design & In-Page Reader

let allItemsData = null;
let currentSortOrder = 'newest';
let currentCategoryFilter = 'all';
let currentSearchQuery = '';

// Reader Overlay Zustand
let activeReaderItem = null;
let activeReaderChapter = 1;
let activeReaderChapters = [];

document.addEventListener('DOMContentLoaded', async () => {
    applyConfigValues();
    setupDarkMode();
    setupMobileSidebar();
    setupHeaderScroll();
    setupBackToTop();
    setupReadingProgressBar();
    setupReaderTools();

    const isSinglePage = document.getElementById('stories-grid') || document.getElementById('global-search');
    const storyArchiveContainer = document.querySelector('[data-story-list-archive]');
    const poemArchiveContainer = document.querySelector('[data-poem-list-archive]');
    const poeticNovelArchiveContainer = document.querySelector('[data-poetic-novel-list-archive]');
    const isArchivePage = storyArchiveContainer || poemArchiveContainer || poeticNovelArchiveContainer;

    try {
        const manifestPath = siteConfig.storiesManifestPath;
        const response = await fetch(manifestPath);
        if (!response.ok) throw new Error(`Fehler beim Laden der Inhalte (${manifestPath}): ${response.status}`);
        allItemsData = await response.json();

        if (isSinglePage) {
            initSinglePageArchive();
            setupReaderOverlay();
            setupNavbarScrollspy();
        }

        if (isArchivePage) {
            setupArchivePage();
        }

    } catch (error) {
        console.error('Fehler beim initialen Laden der Manifest-Daten:', error);
        if (isSinglePage) {
            const errHtml = `<p class="loading-placeholder">Inhalte konnten nicht geladen werden: ${error.message}</p>`;
            document.getElementById('stories-grid')?.insertAdjacentHTML('beforeend', errHtml);
            document.getElementById('poems-grid')?.insertAdjacentHTML('beforeend', errHtml);
            document.getElementById('novels-grid')?.insertAdjacentHTML('beforeend', errHtml);
        }
        const errorMsg = `<p>Fehler beim Laden: ${error.message}</p>`;
        if (storyArchiveContainer) storyArchiveContainer.innerHTML = errorMsg;
        if (poemArchiveContainer) poemArchiveContainer.innerHTML = errorMsg;
        if (poeticNovelArchiveContainer) poeticNovelArchiveContainer.innerHTML = errorMsg;
    }

    // Abwärtskompatibilität für standalone content-viewer.html / chapter-viewer.html
    if (document.getElementById('content-area')) {
        const isChapterViewer = window.location.pathname.includes('chapter-viewer.html');
        const urlParams = new URLSearchParams(window.location.search);
        const itemId = urlParams.get('item');

        if (!itemId && !isSinglePage && !isArchivePage) {
            console.error('Fehler: Keine Item-ID in der URL angegeben.');
            const contentArea = document.getElementById('content-area');
            if (contentArea) contentArea.innerHTML = '<p>Fehler: Kein Inhalt angegeben.</p>';
            return;
        }

        if (itemId) {
            if (isChapterViewer) {
                loadAndRenderChapter(itemId).catch(error => {
                    console.error('Fehler beim Laden des Kapitels:', error);
                    document.getElementById('content-area').innerHTML = '<p>Fehler: Kapitel konnte nicht geladen werden.</p>';
                });
            } else {
                loadAndRenderPreview();
            }
        }
    }

    // Event Listener für Tastaturnavigation
    document.addEventListener('keydown', (event) => {
        // In-Page Reader Steuerung
        const werkReader = document.getElementById('werk-reader');
        const readerOverlay = document.getElementById('reader-overlay');
        const isReaderActive = (werkReader && werkReader.style.display !== 'none') ||
                               (readerOverlay && readerOverlay.classList.contains('is-active'));

        if (isReaderActive) {
            if (event.key === 'Escape') {
                const customDropdown = document.getElementById('custom-chapter-dropdown');
                if (customDropdown && customDropdown.classList.contains('is-open')) {
                    customDropdown.classList.remove('is-open');
                    document.getElementById('chapter-dropdown-btn')?.setAttribute('aria-expanded', 'false');
                } else {
                    closeReader();
                }
            } else if (event.key === 'ArrowLeft') {
                const prevBtn = document.getElementById('reader-prev-chapter');
                if (prevBtn && !prevBtn.disabled) prevBtn.click();
            } else if (event.key === 'ArrowRight') {
                const nextBtn = document.getElementById('reader-next-chapter');
                if (nextBtn && !nextBtn.disabled) nextBtn.click();
            }
            return;
        }

        // Standalone Chapter Viewer
        const prevButton = document.getElementById('prev-chapter');
        const nextButton = document.getElementById('next-chapter');
        if (event.key === 'ArrowLeft' && prevButton && !prevButton.disabled) {
            prevButton.click();
        } else if (event.key === 'ArrowRight' && nextButton && !nextButton.disabled) {
            nextButton.click();
        }
    });
});

// =========================================================
// Single-Page Archive: Initialisierung, Suche & Rendering
// =========================================================
function initSinglePageArchive() {
    if (!allItemsData || !allItemsData.items) return;

    const searchInput = document.getElementById('global-search');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const navChips = document.querySelectorAll('.nav-chip[data-filter]');
    const categoryTabs = document.querySelectorAll('.category-tab');
    const sortNewestBtn = document.getElementById('sort-newest');
    const sortOldestBtn = document.getElementById('sort-oldest');

    // Aktualisiere statische Zähler
    updateArchiveCounters();

    // Event Listener für Suche
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.trim().toLowerCase();
            if (searchClearBtn) {
                searchClearBtn.style.display = currentSearchQuery ? 'flex' : 'none';
            }
            // Wenn der Reader offen ist und gesucht wird, schließen damit Ergebnisse sichtbar sind
            const werkReader = document.getElementById('werk-reader');
            if (werkReader && werkReader.style.display !== 'none' && currentSearchQuery) {
                closeReader(true);
            }
            renderSinglePageSections();
        });
    }

    if (searchClearBtn && searchInput) {
        searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            currentSearchQuery = '';
            searchClearBtn.style.display = 'none';
            searchInput.focus();
            renderSinglePageSections();
        });
    }

    // Event Listener für Kategorie-Filter (Navbar Chips und Tabs)
    const allFilterButtons = [...navChips, ...categoryTabs];
    allFilterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filterValue = btn.dataset.filter || 'all';
            currentCategoryFilter = filterValue;

            // Aktiven Status überall synchronisieren
            allFilterButtons.forEach(b => {
                const matches = (b.dataset.filter || 'all') === filterValue;
                b.classList.toggle('active', matches);
                if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', matches ? 'true' : 'false');
                if (b.hasAttribute('aria-selected')) b.setAttribute('aria-selected', matches ? 'true' : 'false');
            });

            // Wenn der Reader geöffnet ist, schließen, damit die Filterung direkt zu sehen ist
            const werkReader = document.getElementById('werk-reader');
            if (werkReader && werkReader.style.display !== 'none') {
                closeReader(true);
            }

            renderSinglePageSections();

            // Sanft zum passenden Abschnitt scrollen
            if (filterValue === 'story') {
                document.getElementById('geschichten')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (filterValue === 'poem') {
                document.getElementById('gedichte')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (filterValue === 'poetic-novel') {
                document.getElementById('gedichtsromane')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (filterValue === 'all') {
                (document.getElementById('archive-nav-bar') || document.getElementById('geschichten'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Event Listener für Sortier-Pills
    if (sortNewestBtn) {
        sortNewestBtn.addEventListener('click', () => {
            currentSortOrder = 'newest';
            sortNewestBtn.classList.add('active');
            sortOldestBtn?.classList.remove('active');
            renderSinglePageSections();
        });
    }

    if (sortOldestBtn) {
        sortOldestBtn.addEventListener('click', () => {
            currentSortOrder = 'oldest';
            sortOldestBtn.classList.add('active');
            sortNewestBtn?.classList.remove('active');
            renderSinglePageSections();
        });
    }

    // Netflix Sliders initialisieren
    initNetflixSliders();

    // Initiales Rendern
    renderSinglePageSections();
}

function updateArchiveCounters() {
    if (!allItemsData || !allItemsData.items) return;

    const total = allItemsData.items.length;
    const storiesCount = allItemsData.items.filter(i => i.type === 'story').length;
    const poemsCount = allItemsData.items.filter(i => i.type === 'poem').length;
    const novelsCount = allItemsData.items.filter(i => i.type === 'poetic-novel').length;

    // Sticky Navbar Chips
    const chipTotal = document.getElementById('chip-count-all');
    if (chipTotal) chipTotal.textContent = total.toString();
    const chipStories = document.getElementById('chip-count-stories');
    if (chipStories) chipStories.textContent = storiesCount.toString();
    const chipPoems = document.getElementById('chip-count-poems');
    if (chipPoems) chipPoems.textContent = poemsCount.toString();
    const chipNovels = document.getElementById('chip-count-novels');
    if (chipNovels) chipNovels.textContent = novelsCount.toString();

    // Tabs (falls vorhanden)
    const tabTotal = document.getElementById('tab-count-all');
    if (tabTotal) tabTotal.textContent = total.toString();
    const tabStories = document.getElementById('tab-count-stories');
    if (tabStories) tabStories.textContent = storiesCount.toString();
    const tabPoems = document.getElementById('tab-count-poems');
    if (tabPoems) tabPoems.textContent = poemsCount.toString();
    const tabNovels = document.getElementById('tab-count-novels');
    if (tabNovels) tabNovels.textContent = novelsCount.toString();

    // Hero Metriken
    const heroStories = document.getElementById('hero-count-stories');
    if (heroStories) heroStories.textContent = storiesCount.toString();
    const heroPoems = document.getElementById('hero-count-poems');
    if (heroPoems) heroPoems.textContent = poemsCount.toString();
    const heroNovels = document.getElementById('hero-count-novels');
    if (heroNovels) heroNovels.textContent = novelsCount.toString();

    // Autor Metadaten
    const authorTotal = document.getElementById('author-stat-total');
    if (authorTotal) authorTotal.textContent = total.toString();
}

function renderSinglePageSections() {
    if (!allItemsData || !allItemsData.items) return;

    const storiesGrid = document.getElementById('stories-grid');
    const poemsGrid = document.getElementById('poems-grid');
    const novelsGrid = document.getElementById('novels-grid');
    const resultsCountEl = document.getElementById('results-count-text');

    const storiesSection = document.getElementById('geschichten');
    const poemsSection = document.getElementById('gedichte');
    const novelsSection = document.getElementById('gedichtsromane');
    const authorSection = document.getElementById('autor');
    const impressumSection = document.getElementById('impressum');

    // IMMER alle Sektionen auf der Seite sichtbar halten
    if (storiesSection) storiesSection.style.display = 'block';
    if (poemsSection) poemsSection.style.display = 'block';
    if (novelsSection) novelsSection.style.display = 'block';
    if (authorSection) authorSection.style.display = 'block';
    if (impressumSection) impressumSection.style.display = 'block';

    let all = [...allItemsData.items];

    // Textsuche filtern, falls Suchbegriff eingegeben wurde
    if (currentSearchQuery) {
        all = all.filter(item => {
            const titleMatch = item.title && item.title.toLowerCase().includes(currentSearchQuery);
            const teaserMatch = item.teaser && item.teaser.toLowerCase().includes(currentSearchQuery);
            const descMatch = item.description && item.description.toLowerCase().includes(currentSearchQuery);
            return titleMatch || teaserMatch || descMatch;
        });
    }

    // Nach Datum sortieren
    all.sort((a, b) => {
        const dateA = a.completed || a.started ? new Date(a.completed || a.started) : new Date(0);
        const dateB = b.completed || b.started ? new Date(b.completed || b.started) : new Date(0);
        return currentSortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    const stories = all.filter(i => i.type === 'story');
    const poems = all.filter(i => i.type === 'poem');
    const novels = all.filter(i => i.type === 'poetic-novel');

    // Grids befüllen
    if (storiesGrid) {
        if (stories.length === 0 && currentSearchQuery) {
            storiesGrid.innerHTML = `<div class="loading-placeholder">Keine passenden Geschichten für "${currentSearchQuery}" gefunden.</div>`;
        } else {
            storiesGrid.innerHTML = stories.map(createSinglePageCardHtml).join('');
        }
    }

    if (poemsGrid) {
        if (poems.length === 0 && currentSearchQuery) {
            poemsGrid.innerHTML = `<div class="loading-placeholder">Keine passenden Gedichte für "${currentSearchQuery}" gefunden.</div>`;
        } else {
            poemsGrid.innerHTML = poems.map(createSinglePageCardHtml).join('');
        }
    }

    if (novelsGrid) {
        if (novels.length === 0 && currentSearchQuery) {
            novelsGrid.innerHTML = `<div class="loading-placeholder">Keine passenden Gedichtsromane für "${currentSearchQuery}" gefunden.</div>`;
        } else {
            novelsGrid.innerHTML = novels.map(createSinglePageCardHtml).join('');
        }
    }

    updateSinglePageCardReadingTimes([...stories, ...poems, ...novels]);

    // Klick-Handler auf alle erzeugten Karten registrieren
    bindCardClickHandlers();

    // Netflix Slider Pfeilzustaende nach dem Rendern pruefen
    setTimeout(updateNetflixSliders, 50);
}

// =========================================================
// Netflix-Style Sliders: Steuerung, Drag & Scroll-Synchronisation
// =========================================================
let netflixSlidersInitialized = false;

function initNetflixSliders() {
    if (netflixSlidersInitialized) return;
    netflixSlidersInitialized = true;

    const rowContainers = document.querySelectorAll('.netflix-row-container');
    rowContainers.forEach(container => {
        const track = container.querySelector('.netflix-row-track');
        const prevBtn = container.querySelector('.netflix-nav-arrow.prev-arrow');
        const nextBtn = container.querySelector('.netflix-nav-arrow.next-arrow');

        if (!track) return;

        // Natives Image- und Element-Dragging im Browser unterdruecken
        track.addEventListener('dragstart', (e) => e.preventDefault());

        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const scrollAmount = Math.max(track.clientWidth * 0.75, 300);
                track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const scrollAmount = Math.max(track.clientWidth * 0.75, 300);
                track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            });
        }

        // =========================================================
        // Maus-Drag-Scroll Steuerung (Klicken und Ziehen wie auf Touch)
        // =========================================================
        let isMouseDown = false;
        let startX = 0;
        let scrollStart = 0;
        let hasMoved = false;
        let lastMoveX = 0;
        let lastMoveTime = 0;
        let velocityX = 0;

        track.addEventListener('mousedown', (e) => {
            // Nur linke Maustaste
            if (e.button !== 0) return;
            isMouseDown = true;
            hasMoved = false;
            startX = e.pageX - track.offsetLeft;
            scrollStart = track.scrollLeft;
            lastMoveX = e.pageX;
            lastMoveTime = Date.now();
            velocityX = 0;
            track.dataset.dragPreventClick = 'false';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            const currentX = e.pageX - track.offsetLeft;
            const diff = currentX - startX;

            if (Math.abs(diff) > 6) {
                hasMoved = true;
                track.dataset.dragPreventClick = 'true';
                track.classList.add('is-dragging');
                track.style.scrollBehavior = 'auto';
                track.style.scrollSnapType = 'none';
            }

            if (hasMoved) {
                e.preventDefault();
                track.scrollLeft = scrollStart - diff;

                const now = Date.now();
                const dt = now - lastMoveTime;
                if (dt > 0) {
                    velocityX = (e.pageX - lastMoveX) / dt;
                }
                lastMoveX = e.pageX;
                lastMoveTime = now;
            }
        });

        const handleMouseUpOrLeave = () => {
            if (!isMouseDown) return;
            isMouseDown = false;
            track.classList.remove('is-dragging');

            if (hasMoved) {
                // Sanfter Schwung (Momentum Glide)
                const momentum = velocityX * 180;
                track.style.scrollBehavior = 'smooth';
                track.scrollBy({ left: -momentum, behavior: 'smooth' });

                // Scroll-Snap nach kurzer Zeit wiederherstellen
                setTimeout(() => {
                    track.style.scrollSnapType = 'x mandatory';
                }, 420);

                // Klicksperre kurz aufrechterhalten, damit nicht versehentlich der Reader oeffnet
                setTimeout(() => {
                    track.dataset.dragPreventClick = 'false';
                }, 120);
            } else {
                track.style.scrollBehavior = 'smooth';
                track.style.scrollSnapType = 'x mandatory';
                track.dataset.dragPreventClick = 'false';
            }
            syncRowArrowStates(container, track, prevBtn, nextBtn);
        };

        window.addEventListener('mouseup', handleMouseUpOrLeave);

        // Klick abfangen im Capture-Modus, falls gezogen wurde
        track.addEventListener('click', (e) => {
            if (track.dataset.dragPreventClick === 'true') {
                e.preventDefault();
                e.stopPropagation();
                track.dataset.dragPreventClick = 'false';
            }
        }, true);

        // Scroll Event zur kontinuierlichen Aktualisierung der Button-Zustaende
        let scrollTimer = null;
        track.addEventListener('scroll', () => {
            if (scrollTimer) cancelAnimationFrame(scrollTimer);
            scrollTimer = requestAnimationFrame(() => {
                syncRowArrowStates(container, track, prevBtn, nextBtn);
            });
        }, { passive: true });
    });

    window.addEventListener('resize', () => {
        updateNetflixSliders();
    }, { passive: true });
}

function syncRowArrowStates(container, track, prevBtn, nextBtn) {
    if (!track) return;
    const canScrollLeft = track.scrollLeft > 10;
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    const canScrollRight = (maxScrollLeft - track.scrollLeft) > 15;

    if (prevBtn) {
        prevBtn.disabled = !canScrollLeft;
        prevBtn.classList.toggle('is-disabled', !canScrollLeft);
    }
    if (nextBtn) {
        nextBtn.disabled = !canScrollRight;
        nextBtn.classList.toggle('is-disabled', !canScrollRight);
    }
}

function updateNetflixSliders() {
    const rowContainers = document.querySelectorAll('.netflix-row-container');
    rowContainers.forEach(container => {
        const track = container.querySelector('.netflix-row-track');
        const prevBtn = container.querySelector('.netflix-nav-arrow.prev-arrow');
        const nextBtn = container.querySelector('.netflix-nav-arrow.next-arrow');
        if (track) {
            syncRowArrowStates(container, track, prevBtn, nextBtn);
        }
    });
}

function createSinglePageCardHtml(item) {
    const isPoem = item.type === 'poem';
    const isNovel = item.type === 'poetic-novel';

    // Badge Logik (Neu / Pausiert / In Arbeit)
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    let badgeHtml = '';

    if (item.completed) {
        const completedDate = new Date(item.completed);
        if (!isNaN(completedDate) && completedDate >= oneWeekAgo) {
            badgeHtml = '<span class="new-badge">Neu</span>';
        }
    } else if (item.status === 'paused') {
        badgeHtml = '<span class="paused-badge">Pausiert</span>';
    } else {
        badgeHtml = '<span class="status-badge">In Arbeit</span>';
    }

    // Datum
    const dateToShow = item.completed || item.started;
    const datePrefix = item.completed ? 'Fertig' : 'Begonnen';
    const dateFormatted = dateToShow
        ? `${datePrefix}: ${new Date(dateToShow).toLocaleDateString('de-DE', { year: 'numeric', month: 'short' })}`
        : '';

    // Teaser / Excerpt
    const teaser = item.teaser || item.description || '';

    // Bild-Markup (für Stories und Romane oder Gedichte mit Bild)
    let mediaMarkup = '';
    if (item.image) {
        mediaMarkup = `
            <div class="work-card-media">
                <img src="${item.image}" alt="Illustration zu ${item.title}" loading="lazy" onerror="this.parentElement.style.display='none';">
            </div>
        `;
    }

    // Spezielles Markup für Gedichte ohne Bild (typografische Eleganz)
    let bodyMarkup = '';
    if (isPoem) {
        bodyMarkup = `
            <div class="work-card-body">
                <div class="work-meta-row">
                    <div class="work-meta-badges">${badgeHtml}</div>
                    <span class="work-reading-time" hidden></span>
                </div>
                <h3 class="work-title">
                    <a href="#read/${item.id}" data-open-reader="${item.id}">${item.title}</a>
                </h3>
                <div class="poem-excerpt-preview">${teaser}</div>
                <div class="work-card-footer">
                    <span class="work-date">${dateFormatted}</span>
                    <a href="#read/${item.id}" class="work-read-action" data-open-reader="${item.id}">
                        <span>Gedicht lesen</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </a>
                </div>
            </div>
        `;
    } else {
        bodyMarkup = `
            <div class="work-card-body">
                <div class="work-meta-row">
                    <div class="work-meta-badges">${badgeHtml}</div>
                    <span class="work-reading-time" hidden></span>
                </div>
                <h3 class="work-title">
                    <a href="#read/${item.id}" data-open-reader="${item.id}">${item.title}</a>
                </h3>
                <p class="work-teaser">${teaser}</p>
                <div class="work-card-footer">
                    <span class="work-date">${dateFormatted}</span>
                    <a href="#read/${item.id}" class="work-read-action" data-open-reader="${item.id}">
                        <span>${isNovel ? 'Roman lesen' : 'Geschichte lesen'}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </a>
                </div>
            </div>
        `;
    }

    return `
        <article class="work-card ${isPoem ? 'poem-work-card' : ''} ${isNovel ? 'novel-work-card' : ''}" data-item-id="${item.id}">
            ${mediaMarkup}
            ${bodyMarkup}
        </article>
    `;
}

async function updateSinglePageCardReadingTimes(items) {
    const cardsById = new Map(
        [...document.querySelectorAll('.work-card')].map(card => [card.dataset.itemId, card])
    );

    await Promise.all(items.map(async item => {
        if (!item.contentPath) return;

        const timeElement = cardsById.get(item.id)?.querySelector('.work-reading-time');
        if (!timeElement) return;

        try {
            const response = await fetch(item.contentPath);
            if (!response.ok) return;

            const markdownText = await response.text();
            const textOnly = markdownText.replace(/^#.*$/gm, '');
            const wordsPerMinute = item.type === 'poem'
                ? siteConfig.words_per_minute_poem
                : siteConfig.words_per_minute_story;
            const readingTime = calculateReadingTime(textOnly, wordsPerMinute);

            if (readingTime) {
                timeElement.textContent = readingTime;
                timeElement.hidden = false;
            }
        } catch (error) {
            console.warn(`Lesezeit für "${item.title}" konnte nicht geladen werden:`, error);
        }
    }));
}

function bindCardClickHandlers() {
    document.querySelectorAll('.work-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const track = card.closest('.netflix-row-track');
            if (track && track.dataset.dragPreventClick === 'true') {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            // Wenn auf einen Link geklickt wurde, verhindern wir den Default-Sprung
            const openLink = e.target.closest('[data-open-reader]');
            const itemId = card.dataset.itemId;
            if (itemId) {
                e.preventDefault();
                openReader(itemId, 1);
            }
        });
    });
}

// =========================================================
// Dedicated Full-Page Reader (Vollbild-Leseansicht wie eigene Seite)
// =========================================================
function setupReaderOverlay() {
    const werkReader = document.getElementById('werk-reader');
    const overlay = document.getElementById('reader-overlay');
    const backdrop = document.getElementById('reader-backdrop');
    const closeBtn = document.getElementById('reader-close-btn');
    const bottomCloseBtn = document.getElementById('reader-bottom-close-btn');
    const scrollViewport = document.getElementById('reader-scroll-viewport');
    const progressBar = document.getElementById('reader-modal-progress');
    const fullscreenProgressBar = document.getElementById('reader-fullscreen-progress');
    const dropdown = document.getElementById('reader-chapter-dropdown');
    const customDropdown = document.getElementById('custom-chapter-dropdown');
    const dropdownBtn = document.getElementById('chapter-dropdown-btn');
    const prevBtn = document.getElementById('reader-prev-chapter');
    const nextBtn = document.getElementById('reader-next-chapter');

    // Font Controls im Reader
    const btnSmaller = document.getElementById('reader-btn-smaller');
    const btnLarger = document.getElementById('reader-btn-larger');
    const btnFamily = document.getElementById('reader-btn-family');

    if (!werkReader && !overlay) return;

    // Schließen per Buttons oder Backdrop
    closeBtn?.addEventListener('click', () => closeReader());
    bottomCloseBtn?.addEventListener('click', () => closeReader());
    backdrop?.addEventListener('click', () => closeReader());

    // Scrollfortschritt im Vollbild-Reader
    if (werkReader && fullscreenProgressBar) {
        werkReader.addEventListener('scroll', () => {
            const maxScroll = werkReader.scrollHeight - werkReader.clientHeight;
            if (maxScroll <= 0) {
                fullscreenProgressBar.style.width = '0%';
            } else {
                const pct = (werkReader.scrollTop / maxScroll) * 100;
                fullscreenProgressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
            }
        }, { passive: true });
    }

    // Scrollfortschritt im Legacy Modal Viewport (Abwärtskompatibilität)
    if (scrollViewport && progressBar) {
        scrollViewport.addEventListener('scroll', () => {
            const maxScroll = scrollViewport.scrollHeight - scrollViewport.clientHeight;
            if (maxScroll <= 0) {
                progressBar.style.width = '0%';
            } else {
                const pct = (scrollViewport.scrollTop / maxScroll) * 100;
                progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
            }
        }, { passive: true });
    }

    // Modernes Custom Kapitel-Dropdown Trigger
    if (dropdownBtn && customDropdown) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = customDropdown.classList.toggle('is-open');
            dropdownBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Schließen bei Klick außerhalb
        document.addEventListener('click', (e) => {
            if (!customDropdown.contains(e.target)) {
                customDropdown.classList.remove('is-open');
                dropdownBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Altes Dropdown (Abwärtskompatibilität)
    dropdown?.addEventListener('change', (e) => {
        const chapterIdx = parseInt(e.target.value, 10);
        if (chapterIdx && activeReaderItem) {
            renderReaderChapter(chapterIdx);
        }
    });

    // Vor / Zurück Buttons
    prevBtn?.addEventListener('click', () => {
        if (activeReaderChapter > 1) {
            renderReaderChapter(activeReaderChapter - 1);
        }
    });

    nextBtn?.addEventListener('click', () => {
        if (activeReaderChapter < activeReaderChapters.length) {
            renderReaderChapter(activeReaderChapter + 1);
        }
    });

    // Font Steuerung im Reader
    const sizes = [1.0, 1.08, 1.18, 1.3, 1.45];
    let curSizeIdx = 2;

    const applyReaderFontSize = (idx) => {
        const val = sizes[idx];
        document.documentElement.style.setProperty('--reader-font-size', `${val}rem`);
        localStorage.setItem('readerFontSize', val.toString());
    };

    btnSmaller?.addEventListener('click', () => {
        if (curSizeIdx > 0) {
            curSizeIdx--;
            applyReaderFontSize(curSizeIdx);
        }
    });

    btnLarger?.addEventListener('click', () => {
        if (curSizeIdx < sizes.length - 1) {
            curSizeIdx++;
            applyReaderFontSize(curSizeIdx);
        }
    });

    if (btnFamily) {
        const savedFamily = localStorage.getItem('readerFontFamily');
        if (savedFamily === 'sans') {
            document.body.classList.add('reader-font-sans');
            btnFamily.textContent = 'Sans';
        } else {
            btnFamily.textContent = 'Serif';
        }

        btnFamily.addEventListener('click', () => {
            const isSans = document.body.classList.toggle('reader-font-sans');
            btnFamily.textContent = isSans ? 'Sans' : 'Serif';
            localStorage.setItem('readerFontFamily', isSans ? 'sans' : 'serif');
        });
    }

    // URL-Hash Router beim Laden und bei Wechsel
    window.addEventListener('hashchange', checkHashRoute);
    checkHashRoute();
}

function checkHashRoute() {
    const hash = window.location.hash;
    if (hash.startsWith('#read/')) {
        const parts = hash.substring(6).split('/');
        const itemId = parts[0];
        const chapterIdx = parseInt(parts[1], 10) || 1;
        if (itemId && allItemsData) {
            openReader(itemId, chapterIdx);
        }
    } else {
        // Falls der Reader aktiv ist, aber die URL nicht mehr #read/ lautet, schließen
        const werkReader = document.getElementById('werk-reader');
        const overlay = document.getElementById('reader-overlay');
        const isReaderActive = (werkReader && werkReader.style.display !== 'none') ||
                               (overlay && overlay.classList.contains('is-active'));
        if (isReaderActive) {
            closeReader(false);
        }
    }
}

async function openReader(itemId, chapterIndex = 1) {
    const werkReader = document.getElementById('werk-reader');
    const overlay = document.getElementById('reader-overlay');
    if ((!werkReader && !overlay) || !allItemsData) return;

    const item = allItemsData.items.find(i => i.id === itemId);
    if (!item) {
        console.error(`Werk mit ID "${itemId}" nicht im Manifest gefunden.`);
        return;
    }

    activeReaderItem = item;
    activeReaderChapter = chapterIndex;
    activeReaderChapters = [];

    // Metadaten im Header
    const crumbType = document.getElementById('reader-crumb-type');
    const crumbTitle = document.getElementById('reader-crumb-title');
    const coverImage = document.getElementById('reader-cover-image');
    const typeBadge = document.getElementById('reader-type-badge');
    const statusBadge = document.getElementById('reader-status-badge');
    const timeBadge = document.getElementById('reader-time-badge');
    const titleEl = document.getElementById('reader-work-title');
    const datesEl = document.getElementById('reader-work-dates');
    const synopsisEl = document.getElementById('reader-work-synopsis');
    const proseBody = document.getElementById('reader-prose-body');

    const typeLabel = item.type === 'poem' ? 'Gedicht' : (item.type === 'poetic-novel' ? 'Gedichtsroman' : 'Geschichte');
    if (crumbType) crumbType.textContent = typeLabel;
    if (crumbTitle) crumbTitle.textContent = item.title;
    if (typeBadge) typeBadge.textContent = typeLabel;
    if (titleEl) titleEl.textContent = item.title;
    if (synopsisEl) synopsisEl.textContent = item.description || item.teaser || '';

    // Spezifische Klasse für jede Werk-Kategorie auf die Reader-Karte anwenden
    const readerCard = werkReader ? (werkReader.querySelector('.reader-page-card') || werkReader.querySelector('.reader-inpage-card')) : null;
    const closeBtn = document.getElementById('reader-close-btn');
    const bottomCloseBtn = document.getElementById('reader-bottom-close-btn');

    if (readerCard) {
        readerCard.classList.remove('reader-type-story', 'reader-type-poem', 'reader-type-novel');
        if (item.type === 'poem') {
            readerCard.classList.add('reader-type-poem');
        } else if (item.type === 'poetic-novel') {
            readerCard.classList.add('reader-type-novel');
        } else {
            readerCard.classList.add('reader-type-story');
        }
    }

    // Angepasste Rückkehr-Buttons je nach Werk-Typ
    const returnText = item.type === 'poem' ? 'Zurück zu den Gedichten' :
                       item.type === 'poetic-novel' ? 'Zurück zu den Romanen' :
                       'Zurück zu den Geschichten';
    if (closeBtn) {
        const span = closeBtn.querySelector('span');
        if (span) span.textContent = returnText;
    }
    if (bottomCloseBtn) {
        const span = bottomCloseBtn.querySelector('span');
        if (span) span.textContent = returnText;
    }

    // Layout-spezifische Badges und Header-Elemente
    if (item.type === 'poem') {
        if (typeBadge) typeBadge.style.display = 'none';
        if (statusBadge) statusBadge.style.display = 'none';
        if (timeBadge) timeBadge.style.display = 'none';
        if (synopsisEl) synopsisEl.style.display = 'none';
    } else if (item.type === 'poetic-novel') {
        if (typeBadge) {
            typeBadge.style.display = 'inline-block';
            typeBadge.textContent = 'Gedichtsroman · Epos';
        }
        if (statusBadge) statusBadge.style.display = 'inline-block';
        if (timeBadge) timeBadge.style.display = 'inline-block';
        if (synopsisEl) synopsisEl.style.display = 'block';
    } else {
        if (typeBadge) {
            typeBadge.style.display = 'inline-block';
            typeBadge.textContent = 'Geschichte';
        }
        if (statusBadge) statusBadge.style.display = 'inline-block';
        if (timeBadge) timeBadge.style.display = 'inline-block';
        if (synopsisEl) synopsisEl.style.display = 'block';
    }

    // Datum
    if (datesEl) {
        let dateText = '';
        if (item.type === 'poem') {
            const poemDate = item.completed || item.started;
            if (poemDate) {
                dateText = `Entstanden: ${new Date(poemDate).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })}`;
            }
        } else {
            if (item.started) {
                dateText += `Begonnen: ${new Date(item.started).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}`;
            }
            if (item.completed) {
                dateText += (dateText ? ' · ' : '') + `Fertiggestellt: ${new Date(item.completed).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}`;
            }
        }
        datesEl.textContent = dateText;
    }

    // Cover Artwork
    const workHeader = document.querySelector('.reader-work-header');
    if (coverImage) {
        if (item.image && item.type !== 'poem') {
            coverImage.src = item.image;
            coverImage.alt = `Illustration zu ${item.title}`;
            coverImage.style.display = 'block';
            workHeader?.classList.remove('has-no-cover');
        } else {
            coverImage.style.display = 'none';
            workHeader?.classList.add('has-no-cover');
        }
    }

    // Dedicated Full-Page Reader anzeigen & Hauptseiten-Scroll sperren
    if (werkReader) {
        werkReader.style.display = 'block';
        werkReader.setAttribute('aria-hidden', 'false');
        document.body.classList.add('reader-open');
        document.body.style.overflow = 'hidden';
        werkReader.scrollTop = 0;
        const fullscreenProgressBar = document.getElementById('reader-fullscreen-progress');
        if (fullscreenProgressBar) fullscreenProgressBar.style.width = '0%';
    } else if (overlay) {
        overlay.classList.add('is-active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('reader-open');
        document.body.style.overflow = 'hidden';
    }

    // Hash synchronisieren
    const targetHash = `#read/${item.id}${chapterIndex > 1 ? '/' + chapterIndex : ''}`;
    if (window.location.hash !== targetHash) {
        history.replaceState(null, '', targetHash);
    }
    document.title = `${item.title} - ${siteConfig.websiteName}`;

    // Lade-Hinweis
    if (proseBody) {
        proseBody.className = `reader-prose-body ${item.type === 'poem' ? 'is-poem-body' : ''}`;
        proseBody.innerHTML = '<p class="reader-loading-note">Inhalt wird geladen...</p>';
    }

    // Markdown laden & Kapitel parsen
    try {
        if (!item.contentPath) throw new Error('Kein Inhaltspfad vorhanden.');
        const res = await fetch(item.contentPath);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const mdText = await res.text();

        // Lesezeit basierend auf gesamtem Inhalt berechnen
        if (timeBadge) {
            const cleanText = mdText.replace(/^#.*$/gm, '');
            const wpm = item.type === 'poem' ? 150 : 220;
            const rTime = calculateReadingTime(cleanText, wpm);
            timeBadge.textContent = rTime || 'Kurze Lesezeit';
        }

        // Kapitel extrahieren
        parseChaptersFromMarkdown(mdText, item);
        renderReaderChapter(chapterIndex);

    } catch (err) {
        console.error('Fehler beim Laden des Werks:', err);
        if (proseBody) {
            proseBody.innerHTML = `<p class="reader-loading-note">Inhalt konnte nicht geladen werden (${err.message}).</p>`;
        }
    }
}

function parseChaptersFromMarkdown(markdownText, item) {
    const lines = markdownText.split('\n');
    activeReaderChapters = [];
    let currentContent = [];
    let currentTitle = '';
    let chapterCounter = 0;
    let foundFirstHeading = false;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('## ')) {
            if (foundFirstHeading && currentTitle !== undefined) {
                activeReaderChapters.push({
                    index: chapterCounter,
                    title: currentTitle,
                    content: currentContent.join('\n')
                });
                currentContent = [];
            }
            chapterCounter++;
            currentTitle = trimmed.substring(3).trim();
            foundFirstHeading = true;
        } else if (foundFirstHeading) {
            currentContent.push(line);
        }
    });

    if (foundFirstHeading && currentTitle !== undefined) {
        activeReaderChapters.push({
            index: chapterCounter,
            title: currentTitle,
            content: currentContent.join('\n')
        });
    }

    // Falls keine '## ' Überschriften gefunden wurden (z.B. bei einzelnen Gedichten oder Ein-Kapitel-Geschichten)
    if (activeReaderChapters.length === 0 && markdownText.trim().length > 0) {
        // H1 am Anfang entfernen, falls vorhanden
        const cleaned = markdownText.trim().replace(/^#{1,6}\s*.*?\r?\n(\r?\n)?/, '');
        activeReaderChapters.push({
            index: 1,
            title: item.title,
            content: cleaned
        });
    }

    // Modernes Custom Dropdown & Legacy Select füllen
    const selectBar = document.getElementById('reader-chapter-select-bar');
    const customDropdown = document.getElementById('custom-chapter-dropdown');
    const dropdownList = document.getElementById('chapter-dropdown-list');
    const dropdown = document.getElementById('reader-chapter-dropdown');
    const bottomNav = document.getElementById('reader-chapter-nav-bottom');

    if (activeReaderChapters.length > 1) {
        if (selectBar) selectBar.style.display = 'flex';
        if (bottomNav) bottomNav.style.display = 'flex';

        // Custom Dropdown Menüliste befüllen
        if (dropdownList) {
            dropdownList.innerHTML = activeReaderChapters.map(ch => {
                const padIndex = ch.index < 10 ? `0${ch.index}` : `${ch.index}`;
                const chTitle = ch.title || `Teil ${ch.index}`;
                return `
                    <button type="button" class="chapter-item-btn ${ch.index === activeReaderChapter ? 'is-active' : ''}" data-chapter-index="${ch.index}" role="option" aria-selected="${ch.index === activeReaderChapter}">
                        <span class="chapter-item-num">${padIndex}</span>
                        <span class="chapter-item-title">${chTitle}</span>
                        <span class="chapter-item-check" aria-hidden="true">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </span>
                    </button>
                `;
            }).join('');

            // Click-Events an die Kapitel-Buttons binden
            dropdownList.querySelectorAll('.chapter-item-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.chapterIndex, 10);
                    if (idx && activeReaderItem) {
                        renderReaderChapter(idx);
                        customDropdown?.classList.remove('is-open');
                        document.getElementById('chapter-dropdown-btn')?.setAttribute('aria-expanded', 'false');
                    }
                });
            });
        }

        // Altes HTML Select (für Abwärtskompatibilität)
        if (dropdown) {
            dropdown.innerHTML = activeReaderChapters.map(ch =>
                `<option value="${ch.index}">Kapitel ${ch.index}: ${ch.title || 'Teil ' + ch.index}</option>`
            ).join('');
        }
    } else {
        if (selectBar) selectBar.style.display = 'none';
        if (bottomNav) bottomNav.style.display = 'none';
    }
}

function renderReaderChapter(chapterIdx) {
    if (!activeReaderChapters || activeReaderChapters.length === 0) return;

    if (chapterIdx < 1) chapterIdx = 1;
    if (chapterIdx > activeReaderChapters.length) chapterIdx = activeReaderChapters.length;
    activeReaderChapter = chapterIdx;

    const chapter = activeReaderChapters.find(ch => ch.index === chapterIdx) || activeReaderChapters[0];
    const proseBody = document.getElementById('reader-prose-body');
    const werkReader = document.getElementById('werk-reader');
    const scrollViewport = document.getElementById('reader-scroll-viewport');
    const dropdown = document.getElementById('reader-chapter-dropdown');
    const dropdownLabel = document.getElementById('chapter-dropdown-label');
    const prevBtn = document.getElementById('reader-prev-chapter');
    const nextBtn = document.getElementById('reader-next-chapter');
    const indicator = document.getElementById('reader-chapter-indicator');
    const fullscreenProgressBar = document.getElementById('reader-fullscreen-progress');

    // Custom Dropdown Label aktualisieren
    if (dropdownLabel) {
        dropdownLabel.textContent = `Kapitel ${chapter.index}: ${chapter.title || 'Teil ' + chapter.index}`;
    }

    // Aktiven Button im Custom Dropdown hervorheben
    const dropdownList = document.getElementById('chapter-dropdown-list');
    if (dropdownList) {
        dropdownList.querySelectorAll('.chapter-item-btn').forEach(btn => {
            const isAct = parseInt(btn.dataset.chapterIndex, 10) === chapterIdx;
            btn.classList.toggle('is-active', isAct);
            btn.setAttribute('aria-selected', isAct ? 'true' : 'false');
        });
    }

    if (dropdown) dropdown.value = chapterIdx.toString();

    // Vor / Zurück Buttons
    if (prevBtn) prevBtn.disabled = chapterIdx <= 1;
    if (nextBtn) nextBtn.disabled = chapterIdx >= activeReaderChapters.length;
    if (indicator) indicator.textContent = `Kapitel ${chapterIdx} von ${activeReaderChapters.length}`;

    // Markdown parsen
    const isPoemLike = activeReaderItem && (activeReaderItem.type === 'poem' || activeReaderItem.type === 'poetic-novel');
    let parsedHtml = '';

    if (window.marked) {
        if (isPoemLike) {
            parsedHtml = marked.parse(chapter.content.trim(), { breaks: true, gfm: true });
        } else {
            const processed = chapter.content.trim().replace(/(\r?\n)+/g, '\n\n');
            parsedHtml = marked.parse(processed, { gfm: true });
        }
    } else {
        parsedHtml = `<pre>${chapter.content}</pre>`;
    }

    const headingHtml = (activeReaderChapters.length > 1 && chapter.title)
        ? `<h2 class="reader-chapter-title">Kapitel ${chapter.index}: ${chapter.title}</h2>`
        : '';

    if (proseBody) {
        proseBody.innerHTML = headingHtml + parsedHtml;

        // Dialogzeilen hervorheben bei Geschichten
        if (activeReaderItem?.type === 'story') {
            proseBody.querySelectorAll('p').forEach(p => {
                const t = p.textContent.trim();
                if (/^["„»]/.test(t)) {
                    p.classList.add('dialogue-line');
                }
            });
        }
    }

    // Scroll an den Anfang des Readers & Fortschrittsbalken zurücksetzen
    if (werkReader && werkReader.style.display !== 'none') {
        werkReader.scrollTop = 0;
        if (fullscreenProgressBar) fullscreenProgressBar.style.width = '0%';
    } else if (scrollViewport) {
        scrollViewport.scrollTop = 0;
    }

    // URL Hash aktualisieren
    if (activeReaderItem) {
        const targetHash = `#read/${activeReaderItem.id}${activeReaderChapters.length > 1 ? '/' + chapterIdx : ''}`;
        history.replaceState(null, '', targetHash);
    }
}

function closeReader(updateHash = true) {
    const werkReader = document.getElementById('werk-reader');
    const overlay = document.getElementById('reader-overlay');
    const customDropdown = document.getElementById('custom-chapter-dropdown');
    if (!werkReader && !overlay) return;

    const closedItemId = activeReaderItem ? activeReaderItem.id : null;

    if (werkReader) {
        werkReader.style.display = 'none';
        werkReader.setAttribute('aria-hidden', 'true');
    }
    if (overlay) {
        overlay.classList.remove('is-active');
        overlay.setAttribute('aria-hidden', 'true');
    }

    // Scroll der Hauptseite wieder freigeben
    document.body.classList.remove('reader-open');
    document.body.style.overflow = '';
    document.querySelector('.reader-work-header')?.classList.remove('has-no-cover');
    customDropdown?.classList.remove('is-open');
    document.getElementById('chapter-dropdown-btn')?.setAttribute('aria-expanded', 'false');

    activeReaderItem = null;
    activeReaderChapter = 1;
    activeReaderChapters = [];

    if (updateHash && window.location.hash.startsWith('#read/')) {
        history.pushState('', document.title, window.location.pathname + window.location.search);
    }

    // Sanft zurück zur Karte scrollen
    if (closedItemId) {
        const lastCard = document.querySelector(`.work-card[data-item-id="${closedItemId}"]`);
        if (lastCard) {
            lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    document.title = `Texte & Schriften - ${siteConfig.websiteName}`;
}

// =========================================================
// Scrollspy für zentrierte Floating Pill Navbar
// =========================================================
function setupNavbarScrollspy() {
    const navChips = document.querySelectorAll('.nav-chip');
    const sections = [
        { id: 'geschichten', filter: 'story' },
        { id: 'gedichte', filter: 'poem' },
        { id: 'gedichtsromane', filter: 'poetic-novel' },
        { id: 'autor', section: 'autor' },
        { id: 'impressum', section: 'impressum' }
    ];

    const elements = sections.map(s => ({ ...s, el: document.getElementById(s.id) })).filter(s => s.el);
    if (elements.length === 0 || navChips.length === 0) return;

    const onScroll = () => {
        const scrollPos = window.scrollY + 180;
        let activeKey = 'all';

        elements.forEach(item => {
            const top = item.el.offsetTop;
            const height = item.el.offsetHeight;
            if (scrollPos >= top && scrollPos < top + height) {
                activeKey = item.section || item.filter;
            }
        });

        // Wenn über dem ersten Archiv-Abschnitt, ist 'all' aktiv
        if (elements.length > 0 && scrollPos < elements[0].el.offsetTop) {
            activeKey = 'all';
        }

        navChips.forEach(chip => {
            const chipFilter = chip.dataset.filter;
            const chipSection = chip.dataset.section;
            let isActive = false;
            if (activeKey === 'all') {
                isActive = (chipFilter === 'all');
            } else if (chipFilter) {
                isActive = (chipFilter === activeKey);
            } else if (chipSection) {
                isActive = (chipSection === activeKey);
            }
            chip.classList.toggle('active', isActive);
            if (chip.hasAttribute('aria-pressed')) {
                chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            }
        });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}


// --- Funktion: Initialisiert Archivseiten (Filter, Sortierung & Live-Suche) ---
function setupArchivePage() {
    if (!allItemsData) {
        console.error("Daten noch nicht geladen für Archivseite.");
        const potentialContainers = document.querySelectorAll('[data-story-list-archive], [data-poem-list-archive], [data-poetic-novel-list-archive]');
        potentialContainers.forEach(container => {
            if (!container.innerHTML.includes('Fehler')) {
                container.innerHTML = '<p>Fehler: Inhalte konnten nicht geladen werden.</p>';
            }
        });
        return;
    }

    const storyArchiveContainer = document.querySelector('[data-story-list-archive]');
    const poemArchiveContainer = document.querySelector('[data-poem-list-archive]');
    const poeticNovelArchiveContainer = document.querySelector('[data-poetic-novel-list-archive]');
    const sortNewestButton = document.getElementById('sort-newest');
    const sortOldestButton = document.getElementById('sort-oldest');
    const searchInput = document.getElementById('archive-search');
    const resultsCountElement = document.getElementById('results-count');

    let currentItemType = null;
    let currentContainer = null;
    let emptyMessage = "Keine Einträge verfügbar.";
    let searchQuery = "";

    if (storyArchiveContainer) {
        currentItemType = 'story';
        currentContainer = storyArchiveContainer;
        emptyMessage = siteConfig.emptyListMessages?.stories || "Keine Geschichten verfügbar.";
    } else if (poemArchiveContainer) {
        currentItemType = 'poem';
        currentContainer = poemArchiveContainer;
        emptyMessage = siteConfig.emptyListMessages?.poems || "Keine Gedichte verfügbar.";
    } else if (poeticNovelArchiveContainer) {
        currentItemType = 'poetic-novel';
        currentContainer = poeticNovelArchiveContainer;
        emptyMessage = siteConfig.emptyListMessages?.poeticNovels || "Keine Gedichtsromane verfügbar.";
    }

    if (!currentItemType || !currentContainer) {
        console.warn("Kein gültiger Archiv-Container auf dieser Seite gefunden.");
        return;
    }

    // Ladeanzeige entfernen
    const loadingParagraph = currentContainer.querySelector('p[data-config="loadingText"]');
    if (loadingParagraph) {
        loadingParagraph.remove();
    }

    // Funktion zum Filtern, Sortieren und Rendern
    const filterSortAndRender = () => {
        let items = allItemsData.items.filter(item => item.type === currentItemType);
        const totalCount = items.length;

        // Live-Suche filtern
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            items = items.filter(item => {
                const titleMatch = item.title && item.title.toLowerCase().includes(q);
                const teaserMatch = item.teaser && item.teaser.toLowerCase().includes(q);
                const descMatch = item.description && item.description.toLowerCase().includes(q);
                return titleMatch || teaserMatch || descMatch;
            });
        }

        // Sortieren nach Datum
        items.sort((a, b) => {
            const dateA = a.started ? new Date(a.started) : (currentSortOrder === 'newest' ? new Date(0) : new Date(8640000000000000));
            const dateB = b.started ? new Date(b.started) : (currentSortOrder === 'newest' ? new Date(0) : new Date(8640000000000000));

            if (currentSortOrder === 'newest') {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        });

        // Button active state
        if (sortNewestButton && sortOldestButton) {
            sortNewestButton.classList.toggle('active', currentSortOrder === 'newest');
            sortOldestButton.classList.toggle('active', currentSortOrder === 'oldest');
        }

        // Trefferanzahl aktualisieren
        if (resultsCountElement) {
            if (searchQuery.trim()) {
                resultsCountElement.textContent = `${items.length} von ${totalCount} Werken gefunden`;
            } else {
                resultsCountElement.textContent = `${totalCount} Werke verfügbar`;
            }
        }

        const msg = searchQuery.trim()
            ? `Keine passenden Einträge für "${searchQuery}" gefunden.`
            : emptyMessage;

        renderItems(currentContainer, items, 'full', msg);
    };

    // Event Listener für Sortier-Buttons
    if (sortNewestButton) {
        sortNewestButton.addEventListener('click', () => {
            if (currentSortOrder !== 'newest') {
                currentSortOrder = 'newest';
                filterSortAndRender();
            }
        });
    }
    if (sortOldestButton) {
        sortOldestButton.addEventListener('click', () => {
            if (currentSortOrder !== 'oldest') {
                currentSortOrder = 'oldest';
                filterSortAndRender();
            }
        });
    }

    // Event Listener für Live-Suche
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            filterSortAndRender();
        });
    }

    // Initiales Rendern
    filterSortAndRender();

    // --- Update Zähler (optional, kann auch hier erfolgen, falls Zähler auf Archivseiten sind) ---
    const storiesCountElement = document.getElementById('stories-count'); // Falls vorhanden
    const poemsCountElement = document.getElementById('poems-count'); // Falls vorhanden
    const poeticNovelsCountElement = document.getElementById('poetic-novels-count'); // Falls vorhanden

    // Zähler nur aktualisieren, wenn Daten vorhanden sind
    if (allItemsData && allItemsData.items) {
        if (storiesCountElement) {
            storiesCountElement.textContent = allItemsData.items.filter(item => item.type === 'story').length;
        }
        if (poemsCountElement) {
            poemsCountElement.textContent = allItemsData.items.filter(item => item.type === 'poem').length;
        }
        if (poeticNovelsCountElement) {
            poeticNovelsCountElement.textContent = allItemsData.items.filter(item => item.type === 'poetic-novel').length;
        }
    }
}


// --- HILFSFUNKTIONEN (Konfiguration, Dark Mode, Content Rendering) ---

// NEUE Hilfsfunktion zur Berechnung der Lesezeit
function calculateReadingTime(text, wordsPerMinute = 200) {
    if (!text || typeof text !== 'string') {
        return ''; // Kein Text, keine Lesezeit
    }
    const words = text.match(/\S+/g)?.length || 0; // Zählt Wörter (Sequenzen von Nicht-Leerzeichen)
    if (words === 0) {
        return '';
    }
    const minutes = words / wordsPerMinute;
    if (minutes < 1) {
        return '1 Min. Lesezeit';
    }

    const roundedMinutes = Math.round(minutes);

    if (roundedMinutes > 120) {
        const hours = Math.floor(roundedMinutes / 60);
        const remainingMinutes = roundedMinutes % 60;
        if (remainingMinutes === 0) {
            return `ca. ${hours} Std. Lesezeit`;
        } else {
            return `ca. ${hours} Std. ${remainingMinutes} Min. Lesezeit`;
        }
    } else {
        return `${roundedMinutes} Min. Lesezeit`;
    }
}

function applyConfigValues() {
    // Website-Name/Logo
    document.querySelectorAll('[data-config="websiteName"]').forEach(el => {
        el.textContent = siteConfig.websiteName;
    });
    // Autorenname
    document.querySelectorAll('[data-config="authorName"]').forEach(el => {
        el.textContent = siteConfig.authorName;
    });
    // Seitentitel (Basis + spezifischer Teil) - wird für content-viewer später gesetzt
    const titleElement = document.querySelector('title');
    if (titleElement && !document.getElementById('content-area')) { // Nicht auf content-viewer/chapter-viewer
        const pageSpecificTitle = titleElement.getAttribute('data-page-title') || '';
        if (pageSpecificTitle) {
            titleElement.textContent = `${pageSpecificTitle} - ${siteConfig.websiteName}`;
        } else {
            // Fallback für Seiten ohne data-page-title (z.B. Startseite)
            titleElement.textContent = `${siteConfig.websiteName} - ${siteConfig.siteTitleBase || 'Willkommen'}`;
        }
    }
    // Navigationstexte (using endsWith to be more robust with relative paths)
    document.querySelectorAll('nav a[href$="index.html"]').forEach(el => el.textContent = siteConfig.navHome);
    document.querySelectorAll('nav a[href$="geschichten.html"]').forEach(el => el.textContent = siteConfig.navStories);
    document.querySelectorAll('nav a[href$="gedichte.html"]').forEach(el => el.textContent = siteConfig.navPoems);
    document.querySelectorAll('nav a[href$="gedichtsromane.html"]').forEach(el => el.textContent = siteConfig.navPoeticNovels);
    document.querySelectorAll('nav a[href$="ueber-mich.html"]').forEach(el => el.textContent = siteConfig.navAbout);
    // Button "Alle Geschichten/Gedichte/etc ansehen" auf Startseite
    document.querySelectorAll('[data-config="readAllStoriesBtn"]').forEach(el => el.textContent = siteConfig.readAllStoriesBtn);
    document.querySelectorAll('[data-config="readAllPoemsBtn"]').forEach(el => el.textContent = siteConfig.readAllPoemsBtn); // Add to config.js if needed
    document.querySelectorAll('[data-config="readAllPoeticNovelsBtn"]').forEach(el => el.textContent = siteConfig.readAllPoeticNovelsBtn); // Add to config.js if needed
    // Footer Copyright
    const yearSpan = document.getElementById('copyright-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    document.querySelectorAll('[data-config="footerCopyrightText"]').forEach(el => {
        // Use textContent to avoid potential HTML injection issues if config value changes
        el.textContent = siteConfig.footerCopyrightText;
    });
    // Lade-Texte - Initialer Text aus HTML, kann hier überschrieben werden falls leer
    document.querySelectorAll('[data-config="loadingText"]').forEach(el => {
        if (!el.textContent.trim()) { // Nur wenn leer
            el.textContent = siteConfig.loadingText || 'Wird geladen...';
        }
    });
    // Titel für Featured Sections auf der Startseite
    document.querySelectorAll('[data-config="featuredStoriesTitle"]').forEach(el => el.textContent = siteConfig.featuredStoriesTitle);
    document.querySelectorAll('[data-config="featuredPoemsTitle"]').forEach(el => el.textContent = siteConfig.featuredPoemsTitle);
    document.querySelectorAll('[data-config="featuredPoeticNovelsTitle"]').forEach(el => el.textContent = siteConfig.featuredPoeticNovelsTitle);
    // Backlink Texte (aus config.js)
    // Diese werden spezifischer in loadAndRenderPreview gesetzt
}

function setupDarkMode() {
    const toggleButtons = document.querySelectorAll('#dark-mode-toggle, .theme-toggle-btn');
    const htmlElement = document.documentElement;
    const body = document.body;

    if (!toggleButtons.length) return;

    // Funktion zum Setzen des Themes (als reiner Icon-Button)
    const setTheme = (theme) => {
        const isDark = theme === 'dark';
        if (isDark) {
            htmlElement.classList.add('dark-mode');
            body.classList.add('dark-mode');
            toggleButtons.forEach(btn => {
                const label = btn.querySelector('.theme-label');
                if (label) {
                    label.textContent = siteConfig.darkModeToggleText?.dark || 'Dunkel';
                }
                btn.setAttribute('aria-pressed', 'true');
                btn.setAttribute('aria-label', 'Zu hellem Design wechseln');
                btn.setAttribute('title', 'Zu hellem Design wechseln');
            });
            localStorage.setItem('theme', 'dark');
        } else {
            htmlElement.classList.remove('dark-mode');
            body.classList.remove('dark-mode');
            toggleButtons.forEach(btn => {
                const label = btn.querySelector('.theme-label');
                if (label) {
                    label.textContent = siteConfig.darkModeToggleText?.light || 'Hell';
                }
                btn.setAttribute('aria-pressed', 'false');
                btn.setAttribute('aria-label', 'Zu dunklem Design wechseln');
                btn.setAttribute('title', 'Zu dunklem Design wechseln');
            });
            localStorage.setItem('theme', 'light');
        }
    };

    // Initiales Setzen beim Laden der Seite
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (storedTheme) {
        setTheme(storedTheme);
    } else if (prefersDark) {
        setTheme('dark');
    } else {
        setTheme('light'); // Default auf light, falls keine Präferenz/Storage
    }

    // Event Listener für alle Buttons
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentTheme = htmlElement.classList.contains('dark-mode') ? 'dark' : 'light';
            setTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    });

    // Auf Systempräferenz hören (nur wenn kein Theme manuell gesetzt wurde)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (!localStorage.getItem('theme')) { // Nur reagieren, wenn User nicht manuell gewählt hat
            setTheme(event.matches ? 'dark' : 'light');
        }
    });
}

// --- NEU: Mobile Sidebar ---
function setupMobileSidebar() {
    const toggleButton = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('mobile-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const body = document.body;

    if (!toggleButton || !sidebar || !overlay) {
        // console.warn("Mobile sidebar elements not found.");
        return; // Elemente nicht gefunden, Funktion beenden
    }

    const closeSidebar = () => {
        sidebar.classList.remove('is-open');
        overlay.classList.remove('is-visible');
        toggleButton.classList.remove('is-active');
        toggleButton.setAttribute('aria-expanded', 'false');
        body.classList.remove('sidebar-open');
    };

    const openSidebar = () => {
        sidebar.classList.add('is-open');
        overlay.classList.add('is-visible');
        toggleButton.classList.add('is-active');
        toggleButton.setAttribute('aria-expanded', 'true');
        body.classList.add('sidebar-open');
    };

    toggleButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Verhindert, dass Klick auf Body durchschlägt
        if (sidebar.classList.contains('is-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay.addEventListener('click', () => {
        closeSidebar();
    });

    // Schließen, wenn auf einen Link in der Sidebar geklickt wird
    sidebar.addEventListener('click', (e) => {
        // Nur schließen, wenn direkt auf ein A-Tag geklickt wird
        if (e.target.tagName === 'A') {
            closeSidebar();
        }
    });

    // Optional: Schließen mit der Escape-Taste
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
            closeSidebar();
        }
    });
}

function setupHeaderScroll() {
    const navBar = document.querySelector('.archive-nav-bar-section') || document.querySelector('.site-header');
    if (!navBar) return;

    const handleScroll = () => {
        if (window.scrollY > 40) {
            navBar.classList.add('is-scrolled');
        } else {
            navBar.classList.remove('is-scrolled');
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
}

function setupBackToTop() {
    let btn = document.getElementById('back-to-top');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'back-to-top';
        btn.className = 'back-to-top-btn';
        btn.setAttribute('aria-label', 'Nach oben scrollen');
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
        document.body.appendChild(btn);
    }

    const handleScroll = () => {
        if (window.scrollY > 300) {
            btn.classList.add('is-visible');
        } else {
            btn.classList.remove('is-visible');
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    btn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function setupReadingProgressBar() {
    const bar = document.getElementById('reading-progress');
    if (!bar) return;

    const updateProgress = () => {
        const docEl = document.documentElement;
        const totalHeight = docEl.scrollHeight - docEl.clientHeight;
        if (totalHeight <= 0) {
            bar.style.width = '0%';
            return;
        }
        const progress = (window.scrollY / totalHeight) * 100;
        bar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    updateProgress();
}

function setupReaderTools() {
    const btnSmaller = document.getElementById('btn-font-smaller');
    const btnLarger = document.getElementById('btn-font-larger');
    const btnToggle = document.getElementById('btn-font-toggle');

    if (!btnSmaller && !btnLarger && !btnToggle) return;

    const sizes = [1.0, 1.08, 1.18, 1.3, 1.45];
    let currentSizeIndex = 2; // Standard 1.18rem

    const savedSize = localStorage.getItem('readerFontSize');
    if (savedSize) {
        const parsed = parseFloat(savedSize);
        const idx = sizes.indexOf(parsed);
        if (idx !== -1) currentSizeIndex = idx;
    }

    const applySize = (idx) => {
        const val = sizes[idx];
        document.documentElement.style.setProperty('--reader-font-size', `${val}rem`);
        localStorage.setItem('readerFontSize', val.toString());
    };

    applySize(currentSizeIndex);

    if (btnSmaller) {
        btnSmaller.addEventListener('click', () => {
            if (currentSizeIndex > 0) {
                currentSizeIndex--;
                applySize(currentSizeIndex);
            }
        });
    }

    if (btnLarger) {
        btnLarger.addEventListener('click', () => {
            if (currentSizeIndex < sizes.length - 1) {
                currentSizeIndex++;
                applySize(currentSizeIndex);
            }
        });
    }

    if (btnToggle) {
        const savedFamily = localStorage.getItem('readerFontFamily');
        if (savedFamily === 'sans') {
            document.body.classList.add('reader-font-sans');
            btnToggle.textContent = 'Sans';
        } else {
            btnToggle.textContent = 'Serif';
        }

        btnToggle.addEventListener('click', () => {
            const isSans = document.body.classList.toggle('reader-font-sans');
            btnToggle.textContent = isSans ? 'Sans' : 'Serif';
            localStorage.setItem('readerFontFamily', isSans ? 'sans' : 'serif');
        });
    }
}

// --- Laden und Rendern von Markdown-Inhalt (Preview und Chapter) ---

async function loadAndRenderPreview() {
    const contentArea = document.getElementById('content-area');
    // Elemente holen
    const workTitleElement = document.getElementById('work-title');
    const contentImage = document.getElementById('content-image');
    const contentDescription = document.getElementById('content-description'); // Wird jetzt für Gedichte ausgeblendet
    const contentDate = document.getElementById('content-date');
    const poemDisplayArea = document.getElementById('poem-display-area');
    const chapterToc = document.getElementById('chapter-toc');
    const chapterTocList = chapterToc?.querySelector('ul');
    const startReadingLink = document.getElementById('start-reading');
    const backLinkNav = document.querySelector('.story-nav a#back-link');
    const breadcrumbNav = document.getElementById('breadcrumb-nav'); // Neu: Breadcrumb-Element

    // Grundlegende Elemente prüfen
    if (!contentArea || !workTitleElement || !contentImage || !contentDescription || !contentDate || !poemDisplayArea || !chapterToc || !startReadingLink || !backLinkNav || !breadcrumbNav) {
        console.error("Fehlende HTML-Grundelemente auf der content-viewer Seite.");
        if (contentArea) contentArea.innerHTML = "<p>Fehler: Seitenstruktur unvollständig.</p>";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('item');

    if (!itemId) {
        if (contentArea) contentArea.innerHTML = '<p>Fehler: Kein Inhalt zum Laden angegeben (fehlende Item-ID).</p>';
        return;
    }

    // Initialzustand für dynamische Teile
    chapterToc.style.display = 'none';
    if (chapterTocList) chapterTocList.innerHTML = '';
    startReadingLink.style.display = 'none';
    poemDisplayArea.style.display = 'none';
    poemDisplayArea.innerHTML = '';
    contentDescription.style.display = 'block'; // Standardmäßig Beschreibung anzeigen
    backLinkNav.style.display = 'none';

    try {
        // Stelle sicher, dass allItemsData geladen ist
        if (!allItemsData) {
            console.log("Lade Manifest-Daten für Preview nach...");
            let manifestPath = siteConfig.storiesManifestPath;
            const responseManifest = await fetch(manifestPath);
            if (!responseManifest.ok) throw new Error(`Manifest nicht ladbar: ${responseManifest.status}`);
            allItemsData = await responseManifest.json();
        }

        const itemMeta = allItemsData.items.find(i => i.id === itemId);

        if (!itemMeta) throw new Error(`Eintrag mit ID '${itemId}' nicht im Manifest gefunden.`);

        // --- Statische Metadaten rendern ---
        contentArea.className = `container ${itemMeta.type}-type content-viewer-layout`;

        // Bild setzen oder ausblenden
        if (itemMeta.image) {
            contentImage.src = itemMeta.image;
            contentImage.alt = `Illustration zu: ${itemMeta.title}`;
            contentImage.style.display = 'block'; // Erst anzeigen, wenn src gesetzt ist
            // onerror nur einmalig setzen, um Schleifen zu vermeiden
            contentImage.onerror = () => {
                console.warn(`Bild für ${itemMeta.title} konnte nicht geladen werden: ${contentImage.src}`);
                contentImage.style.display = 'none'; // Bild bei Fehler ausblenden
                contentImage.onerror = null; // Error-Handler entfernen nach erstem Fehler
            };
        } else {
            contentImage.style.display = 'none'; // Kein Bildpfad vorhanden, ausblenden
            contentImage.src = ''; // src leeren, falls vorher was drin war
            contentImage.alt = '';
            contentImage.onerror = null; // Sicherstellen, dass kein alter Handler aktiv ist
        }

        // Beschreibung nur anzeigen, wenn es KEIN Gedicht ist
        if (itemMeta.type !== 'poem') {
            contentDescription.innerHTML = `<p>${itemMeta.description || ''}</p>`;
            contentDescription.style.display = 'block';
        } else {
            contentDescription.innerHTML = ''; // Inhalt leeren
            contentDescription.style.display = 'none'; // Ausblenden für Gedichte
        }

        let dateHtml = itemMeta.started
            ? `<p>Begonnen: ${new Date(itemMeta.started).toLocaleDateString('de-DE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}</p>` +
            (itemMeta.completed ? `<p>Fertiggestellt: ${new Date(itemMeta.completed).toLocaleDateString('de-DE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}</p>` : '')
            : '<p>Startdatum unbekannt</p>';

        // Lesezeit für die Detailansicht berechnen (basierend auf vollem Inhalt)
        let readingTimeHtml = '';
        // Lesezeit nur für NICHT-Gedichte im Datumsbereich berechnen
        if (itemMeta.contentPath && itemMeta.type !== 'poem') {
            try {
                const markdownResponse = await fetch(itemMeta.contentPath);
                if (markdownResponse.ok) {
                    const markdownText = await markdownResponse.text();
                    // Entferne Markdown-Überschriften für genauere Wortzählung
                    const textOnly = markdownText.replace(/^#.*$/gm, '');
                    // Verwende den spezifischen WPM-Wert für Geschichten (oder Standard, falls nicht Story)
                    const wpm = itemMeta.type === 'story' ? siteConfig.words_per_minute_story : 200; // Fallback 200
                    const readingTime = calculateReadingTime(textOnly, wpm);
                    if (readingTime) {
                        readingTimeHtml = `<p>${readingTime}</p>`;
                    }
                }
            } catch (fetchError) {
                console.warn(`Konnte Inhalt für Lesezeitberechnung nicht laden (${itemMeta.contentPath}): ${fetchError}`);
            }
        }
        // Lesezeit für Gedichte wird später direkt vor dem Gedicht eingefügt

        contentDate.innerHTML = dateHtml + readingTimeHtml; // Füge Lesezeit hinzu (nur wenn nicht Gedicht)

        // Badge Logik: Neu / Pausiert / In Arbeit
        let badgeHtml = '';
        const now = new Date();
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);

        if (itemMeta.completed) {
            const completedDate = new Date(itemMeta.completed);
            if (!isNaN(completedDate) && completedDate >= oneWeekAgo) {
                badgeHtml = '<span class="new-badge">Neu</span>';
            }
        } else if (itemMeta.status === 'paused') {
            badgeHtml = '<span class="paused-badge">Pausiert</span>';
        } else {
            badgeHtml = '<span class="status-badge">In Arbeit</span>';
        }

        workTitleElement.innerHTML = `${itemMeta.title}${badgeHtml}`;

        const pageTitleElement = document.querySelector('title');
        if (pageTitleElement) {
            pageTitleElement.textContent = `${itemMeta.title} - ${siteConfig.websiteName}`;
        }

        // --- Back Link (wie zuvor) ---
        let backHref = 'index.html';
        let backText = '« Zurück zur Übersicht';
        let basePath = '.';

        switch (itemMeta.type) {
            case 'story':
                backHref = `${basePath}/geschichten.html`;
                backText = siteConfig.backToStoriesLink || '« Zurück zu den Geschichten';
                break;
            case 'poem':
                backHref = `${basePath}/gedichte.html`;
                backText = siteConfig.backToPoemsLink || '« Zurück zu den Gedichten';
                break;
            case 'poetic-novel':
                backHref = `${basePath}/gedichtsromane.html`;
                backText = siteConfig.backToPoeticNovelsLink || '« Zurück zu den Gedichtsromanen';
                break;
            default:
                backHref = `${basePath}/index.html`;
        }
        backLinkNav.href = backHref;
        backLinkNav.innerHTML = backText;
        backLinkNav.style.display = 'inline';

        // --- Breadcrumbs generieren (neu) ---
        let categoryName = "Übersicht";
        let categoryPageFile = "index.html";

        switch (itemMeta.type) {
            case 'story':
                categoryName = siteConfig.navStories || "Geschichten";
                categoryPageFile = "geschichten.html";
                break;
            case 'poem':
                categoryName = siteConfig.navPoems || "Gedichte";
                categoryPageFile = "gedichte.html";
                break;
            case 'poetic-novel':
                categoryName = siteConfig.navPoeticNovels || "Gedichtsromane";
                categoryPageFile = "gedichtsromane.html";
                break;
        }

        const categoryLink = `${basePath}/${categoryPageFile}`;

        breadcrumbNav.innerHTML = `
            <nav aria-label="breadcrumb" class="breadcrumbs">
                <ol>
                    <li><a href="${categoryLink}">${categoryName}</a></li>
                    <li aria-current="page">${itemMeta.title}</li>
                </ol>
            </nav>
        `;

        // --- Inhaltsbehandlung je nach Typ ---
        if (itemMeta.type === 'poem') {
            // --- GEDICHT ---
            chapterToc.style.display = 'none';
            startReadingLink.style.display = 'none';
            // Beschreibung wurde oben schon ausgeblendet

            if (itemMeta.contentPath) {
                try {
                    let markdownPath = itemMeta.contentPath;
                    const markdownResponse = await fetch(markdownPath);
                    if (!markdownResponse.ok) {
                        throw new Error(`Gedicht-Datei '${markdownPath}' nicht ladbar: ${markdownResponse.status}`);
                    }
                    let markdownText = await markdownResponse.text();

                    // Optional: Entferne eine einzelne H1 am Anfang des Markdown-Textes,
                    // bevor er geparst wird. Funktioniert nur, wenn sie *ganz* am Anfang steht.
                    markdownText = markdownText.trim().replace(/^#{1,6}\s*.*?\r?\n(\r?\n)?/, ''); // Entfernt Zeile mit # und optional folgende Leerzeile
                    // console.log(markdownText) // Debugging entfernt

                    // Lesezeit für Gedicht berechnen VOR dem Parsen
                    const readingTime = calculateReadingTime(markdownText, siteConfig.words_per_minute_poem); // Nutze spezifischen Wert für Gedichte
                    let readingTimePoemHtml = '';
                    if (readingTime) {
                        readingTimePoemHtml = `<p class="poem-reading-time">${readingTime}</p>`;
                    }

                    // Markdown parsen
                    let poemHtml = marked.parse(markdownText.trim()); // Trim nach Entfernung

                    // HTML in den Gedichtbereich einfügen (Lesezeit ZUERST) und anzeigen
                    poemDisplayArea.innerHTML = readingTimePoemHtml + poemHtml; // Lesezeit vor dem Gedicht
                    poemDisplayArea.style.display = 'block';

                } catch (markdownError) {
                    console.error(`Fehler beim Laden oder Verarbeiten des Gedichts (${itemMeta.contentPath}):`, markdownError);
                    poemDisplayArea.innerHTML = `<p><em>Fehler: Gedicht konnte nicht geladen werden.</em></p>`;
                    poemDisplayArea.style.display = 'block';
                }
            } else {
                console.warn(`Gedicht '${itemId}' hat keinen 'contentPath' im Manifest.`);
                poemDisplayArea.innerHTML = `<p><em>Für dieses Gedicht ist kein Inhalt hinterlegt.</em></p>`;
                poemDisplayArea.style.display = 'block';
            }

        } else {
            // --- STORY / POETIC NOVEL ---
            poemDisplayArea.style.display = 'none'; // Gedichtbereich ausblenden
            contentDescription.style.display = 'block'; // Sicherstellen, dass Beschreibung sichtbar ist

            if (itemMeta.contentPath && chapterToc && chapterTocList) {
                try {
                    let markdownPath = itemMeta.contentPath;
                    const markdownResponse = await fetch(markdownPath);
                    if (!markdownResponse.ok) {
                        throw new Error(`Markdown-Datei '${markdownPath}' nicht ladbar: ${markdownResponse.status}`);
                    }
                    const markdownText = await markdownResponse.text();

                    const chapters = [];
                    const lines = markdownText.split('\n');
                    let chapterIndex = 0;

                    lines.forEach(line => {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('## ')) {
                            const title = trimmedLine.substring(3).trim();
                            if (title) {
                                chapterIndex++;
                                const chapterLink = `chapter-viewer.html?item=${itemId}&chapter=${chapterIndex}`;
                                chapters.push({title: title, link: chapterLink, index: chapterIndex});
                            }
                        }
                    });

                    if (chapters.length > 0) {
                        chapterToc.style.display = 'block';
                        chapterTocList.innerHTML = chapters
                            .map(chapter => `
                                <li>
                                    <a href="${chapter.link}">
                                    <span class="chapter-number">Kapitel ${chapter.index}:</span> ${chapter.title}
                                    </a>
                                </li>`)
                            .join('');

                        if (startReadingLink && chapters[0]) {
                            startReadingLink.href = chapters[0].link;
                            startReadingLink.style.display = 'inline-block';
                            startReadingLink.disabled = false;
                            startReadingLink.textContent = siteConfig.startReadingBtnText || "Mit dem Lesen beginnen";
                        } else if (startReadingLink) {
                            startReadingLink.style.display = 'none';
                        }

                    } else {
                        chapterToc.style.display = 'none';
                        if (startReadingLink) {
                            startReadingLink.style.display = 'inline-block';
                            startReadingLink.href = `chapter-viewer.html?item=${itemId}&chapter=1`;
                            startReadingLink.disabled = false;
                            startReadingLink.textContent = siteConfig.startReadingBtnText || "Mit dem Lesen beginnen";
                            console.log(`Keine '## ' Kapitelüberschriften in '${markdownPath}' gefunden, aber Link zu Kapitel 1 gesetzt.`);
                        }
                    }

                } catch (markdownError) {
                    console.error(`Fehler beim Laden/Verarbeiten von Markdown für TOC (${itemMeta.contentPath}):`, markdownError);
                    chapterToc.style.display = 'none';
                    if (startReadingLink) startReadingLink.style.display = 'none';
                }
            } else {
                if (!itemMeta.contentPath) {
                    console.warn(`Item '${itemId}' hat keinen 'contentPath'. TOC/Button kann nicht generiert werden.`);
                }
                chapterToc.style.display = 'none';
                if (startReadingLink) startReadingLink.style.display = 'none';
            }
        } // Ende if/else Typ

    } catch (error) {
        console.error("Fehler beim Laden des Inhalts:", error);
        if (contentArea) contentArea.innerHTML = `<p>Fehler beim Laden des Inhalts: ${error.message}. Bitte versuche es später erneut.</p>`;
        if (backLinkNav) backLinkNav.style.display = 'inline';
        if (breadcrumbNav) breadcrumbNav.innerHTML = ''; // Breadcrumbs bei Fehler leeren
    }
}

async function loadAndRenderChapter(passedItemId = null) {
    const contentArea = document.getElementById('content-area');
    const contentTextElement = document.getElementById('content-text'); // Haupt-Textbereich
    const chapterIndicator = document.getElementById('chapter-indicator'); // Anzeige "Kapitel X / Y"
    const prevButton = document.getElementById('prev-chapter'); // Zurück-Button
    const nextButton = document.getElementById('next-chapter'); // Vorwärts-Button
    const pageTitleElement = document.querySelector('title'); // Browser-Tab Titel
    const breadcrumbNav = document.getElementById('breadcrumb-nav'); // Breadcrumb-Navigation

    // Prüfen ob wichtige Elemente vorhanden sind
    if (!contentArea || !contentTextElement || !chapterIndicator || !prevButton || !nextButton || !breadcrumbNav) {
        console.error("Fehlende HTML-Grundelemente auf der chapter-viewer Seite.");
        if (contentArea) contentArea.innerHTML = "<p>Fehler: Seitenstruktur unvollständig.</p>";
        return;
    }

    // Initialzustand setzen (Laden...)
    contentTextElement.innerHTML = `<p>${siteConfig.loadingText || 'Lade Inhalt...'}</p>`;
    chapterIndicator.textContent = '';
    prevButton.disabled = true;
    nextButton.disabled = true;
    prevButton.onclick = null; // Alte Handler entfernen
    nextButton.onclick = null;
    breadcrumbNav.innerHTML = `<p>${siteConfig.loadingText || 'Navigation wird geladen...'}</p>`;

    if (prevButton) {
        prevButton.disabled = true;
        prevButton.onclick = null; // Alte Handler entfernen
    }
    if (nextButton) {
        nextButton.disabled = true;
        nextButton.onclick = null;
    }

    try {
        const urlParams = new URLSearchParams(window.location.search);
        // Item ID aus Parameter oder URL nehmen
        const itemId = passedItemId || urlParams.get('item');
        const chapterIndexParam = urlParams.get('chapter'); // Kapitelindex aus URL lesen

        if (!itemId) throw new Error('Keine Item-ID gefunden.');
        if (!chapterIndexParam) throw new Error('Kein Kapitel-Index (?chapter=...) in der URL gefunden.');

        const requestedChapterIndex = parseInt(chapterIndexParam, 10);
        if (isNaN(requestedChapterIndex) || requestedChapterIndex < 1) throw new Error('Ungültiger Kapitel-Index.');

        // Stelle sicher, dass allItemsData geladen ist
        if (!allItemsData) {
            console.log("Lade Manifest-Daten für Chapter nach...");
            let manifestPath = siteConfig.storiesManifestPath;
            const responseManifest = await fetch(manifestPath);
            if (!responseManifest.ok) throw new Error(`Manifest nicht ladbar: ${responseManifest.status}`);
            allItemsData = await response.json();
        }

        const parentItem = allItemsData.items.find(i => i.id === itemId);

        if (!parentItem) throw new Error(`Item mit ID '${itemId}' nicht im Manifest gefunden.`);
        if (!parentItem.contentPath) throw new Error(`Item '${itemId}' hat keinen 'contentPath' im Manifest definiert.`);

        // Markdown-Datei des Haupt-Items laden
        let markdownPath = parentItem.contentPath;
        const markdownResponse = await fetch(markdownPath);
        if (!markdownResponse.ok) throw new Error(`Markdown '${markdownPath}' nicht ladbar: ${markdownResponse.status}`);
        const markdownText = await markdownResponse.text();

        // Markdown parsen, um Kapitel zu extrahieren
        const chapters = [];
        const lines = markdownText.split('\n');
        let currentChapterContent = [];
        let currentChapterTitle = '';
        let chapterCounter = 0;
        let isFirstChapterContent = true; // Flag für Inhalt *vor* dem ersten '## '

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('## ')) {
                if (!isFirstChapterContent && currentChapterTitle !== undefined) { // Akzeptiere auch leere Titel nach ##
                    chapters.push({
                        index: chapterCounter,
                        title: currentChapterTitle,
                        content: currentChapterContent.join('\n') // Join mit einfachen Newlines behalten!
                    });
                    currentChapterContent = [];
                }
                chapterCounter++;
                currentChapterTitle = trimmedLine.substring(3).trim();
                isFirstChapterContent = false; // Ab hier beginnt der Inhalt des ersten oder nächsten Kapitels
            } else if (!isFirstChapterContent) { // Inhalt sammeln, sobald das erste '## ' gefunden wurde
                currentChapterContent.push(line); // Zeile zum aktuellen Kapitelinhalt hinzufügen
            } else {
                // Inhalt *vor* dem ersten Kapitel wird aktuell ignoriert
            }
        });
        // Füge das letzte Kapitel hinzu (auch wenn es das einzige ist)
        if (!isFirstChapterContent && currentChapterTitle !== undefined) { // Nur hinzufügen, wenn mind. ein '## ' gefunden wurde
            chapters.push({
                index: chapterCounter,
                title: currentChapterTitle,
                content: currentChapterContent.join('\n')
            });
        }

        // Korrektur: Wenn keine '##' gefunden wurden, aber Text da ist, behandle alles als Kapitel 1
        if (chapters.length === 0 && markdownText.trim().length > 0) {
            console.warn(`Keine '## ' Kapitelüberschriften in '${markdownPath}' gefunden. Behandle gesamten Inhalt als Kapitel 1.`);
            chapters.push({
                index: 1,
                title: parentItem.title, // Fallback-Titel
                content: markdownText.trim() // Gesamten getrimmten Text nehmen
            });
            chapterCounter = 1; // Setze Zähler, damit die Navigation unten passt
        } else if (chapters.length === 0) {
            throw new Error(`Keine Kapitel (mit '## ') und kein Inhalt in '${markdownPath}' gefunden.`);
        }


        // Finde das spezifische Kapitel, das angezeigt werden soll
        const chapterToShow = chapters.find(ch => ch.index === requestedChapterIndex);

        if (!chapterToShow) {
            throw new Error(`Kapitel mit Index ${requestedChapterIndex} nicht in '${markdownPath}' gefunden (Gefunden: ${chapters.length} Kapitel).`);
        }

        // Breadcrumbs generieren
        if (breadcrumbNav) {
            let categoryName = "Übersicht";
            let categoryPageFile = "index.html";
            let basePath = '.'; // Relative Pfade annehmen

            switch (parentItem.type) {
                case 'story':
                    categoryName = siteConfig.navStories || "Geschichten";
                    categoryPageFile = "geschichten.html";
                    break;
                case 'poem':
                    categoryName = siteConfig.navPoems || "Gedichte";
                    categoryPageFile = "gedichte.html";
                    break;
                case 'poetic-novel':
                    categoryName = siteConfig.navPoeticNovels || "Gedichtsromane";
                    categoryPageFile = "gedichtsromane.html";
                    break;
                // Füge hier ggf. weitere Typen hinzu
            }

            const categoryLink = `${basePath}/${categoryPageFile}`;
            // Link zum übergeordneten Item, falls es eine Übersichtsseite pro Item gibt
            // Annahme: content-viewer zeigt die Item-Übersicht, chapter-viewer ein Kapitel
            // Wenn es keine separate Item-Übersicht gibt, könnte dieser Link wegfallen oder direkt zur Kategorie zeigen
            const parentItemLink = `${basePath}/content-viewer.html?item=${itemId}`; // Passe ggf. an, falls es keine content-viewer Seite gibt

            breadcrumbNav.innerHTML = `
                <nav aria-label="breadcrumb" class="breadcrumbs">
                  <ol>
                      <li><a href="${categoryLink}">${categoryName}</a></li>
                      ${parentItem.type !== 'poem' ? `<li><a href="${parentItemLink}">${parentItem.title}</a></li>` : ''} <!-- Link zum Item nur, wenn es Sinn macht (z.B. nicht bei einzelnen Gedichten) -->
                      <li aria-current="page">${chapterToShow.title || `Kapitel ${chapterToShow.index}`}</li>
                  </ol>
                </nav>
            `;
            // Optional: Bei Gedichten den mittleren Breadcrumb (Link zum Gedicht selbst) entfernen, wenn chapter-viewer direkt von der Gedichte-Liste aufgerufen wird.
            // Hier wurde eine einfache Logik hinzugefügt, die den Link für 'poem' ausblendet. Passe dies bei Bedarf an.
        }

        // --- Kernänderung HIER ---
        let chapterHtml;
        const markdownContentToParse = chapterToShow.content.trim(); // Immer trimmen
        const isPoemLike = parentItem.type === "poem" || parentItem.type === "poetic-novel";

        if (isPoemLike) {
            // Für Gedichte/Gedichtsromane: Zeilenumbrüche als <br> behandeln
            // marked.js mit der Option { breaks: true } aufrufen.
            console.log("Rendering poem-like content with breaks: true");
            // Wichtig: Ggf. weitere marked Optionen wie 'gfm: true' hinzufügen, falls benötigt
            chapterHtml = marked.parse(markdownContentToParse, {breaks: true, gfm: true});
        } else {
            // Für andere Typen (z.B. Story): Jeden Zeilenumbruch in einen doppelten umwandeln,
            // damit marked.js daraus <p>-Tags macht (Standardverhalten).
            console.log("Rendering story-like content with paragraph conversion");
            const processedMarkdownContent = markdownContentToParse.replace(/(\r?\n)+/g, '\n\n');
            // Wichtig: Ggf. weitere marked Optionen wie 'gfm: true' hinzufügen
            chapterHtml = marked.parse(processedMarkdownContent, {gfm: true}); // Standard-Parsing (breaks: false ist default)
        }
        // --- Ende Kernänderung ---

        if (!contentTextElement) throw new Error('Element #content-text nicht gefunden.');

        // Erstelle ein temporäres Div, um Klassen hinzuzufügen und Dialoge zu stylen
        const chapterBody = document.createElement('div');
        // Setze eine spezifische Klasse basierend auf dem Typ für Styling
        chapterBody.className = `chapter-body chapter-type-${parentItem.type || 'default'}`; // z.B. chapter-type-poem, chapter-type-story
        chapterBody.innerHTML = chapterHtml;

        // Dialog-Styling nur für Geschichten anwenden (auf die jetzt korrekt generierten <p>s)
        if (parentItem.type === 'story') {
            chapterBody.querySelectorAll('p').forEach(p => {
                const text = p.textContent.trim();
                // Verbesserte Dialogerkennung (auch andere Anführungszeichen)
                if (/^["„»]/.test(text)) {
                    p.classList.add('dialogue-line');
                }
                // Optional: Entferne leere <p>-Tags, die durch die Vorverarbeitung entstehen könnten
                if (!text && p.innerHTML.trim() === '') {
                    p.remove();
                }
            });
        } else if (isPoemLike) {
            // Spezifisches Handling für Gedichte, falls nötig (z.B. leere Zeilen entfernen, falls marked sie als <p><br></p> o.ä. rendert)
            // Beispiel: Entferne leere Absätze, die nur <br> enthalten könnten
            chapterBody.querySelectorAll('p').forEach(p => {
                if (p.innerHTML.trim() === '<br>' || p.innerHTML.trim() === '') {
                    // Wenn durch {breaks: true} leere <p> oder <p><br></p> entstehen, diese entfernen
                    // Dies hängt vom genauen Verhalten von marked.js ab. Testen!
                    // Vorsichtiger Ansatz: Nur komplett leere <p> entfernen.
                    if (p.textContent.trim() === '') {
                        p.remove();
                    }
                }
            });
        }

        // Füge Titel und den aufbereiteten Inhalt ein
        contentTextElement.innerHTML = `<h1>${chapterToShow.title || `Kapitel ${chapterToShow.index}`}</h1>${chapterBody.outerHTML}`;

        // Seitentitel und Kapitelindikator aktualisieren
        if (pageTitleElement) {
            pageTitleElement.textContent = `${chapterToShow.title || `Kapitel ${chapterToShow.index}`} - ${parentItem.title} | ${siteConfig.websiteName}`;
        }
        if (chapterIndicator) {
            chapterIndicator.textContent = `Kapitel ${chapterToShow.index} von ${chapterCounter}`;
        }

        // Navigationsbuttons aktualisieren
        const chapterViewerBase = '.'; // Annahme: Gleiches Verzeichnis
        if (prevButton) {
            prevButton.disabled = chapterToShow.index <= 1;
            if (!prevButton.disabled) {
                const prevChapterIndex = chapterToShow.index - 1;
                prevButton.onclick = () => {
                    window.location.href = `${chapterViewerBase}/chapter-viewer.html?item=${itemId}&chapter=${prevChapterIndex}`;
                };
            } else {
                prevButton.onclick = null;
                prevButton.style.visibility = 'visible'; // NEU: Einblenden
            }
        }

        if (nextButton) {
            nextButton.disabled = chapterToShow.index >= chapterCounter;
            if (!nextButton.disabled) {
                const nextChapterIndex = chapterToShow.index + 1;
                nextButton.onclick = () => {
                    window.location.href = `${chapterViewerBase}/chapter-viewer.html?item=${itemId}&chapter=${nextChapterIndex}`;
                };
            } else {
                nextButton.onclick = null;
                nextButton.style.visibility = 'visible'; // NEU: Einblenden
            }
        }

    } catch (error) {
        console.error('Fehler beim Laden des Kapitels:', error);
        const errorMsg = `<p>Fehler: Kapitel konnte nicht geladen werden. (${error.message})</p>`;
        if (contentTextElement) contentTextElement.innerHTML = errorMsg;
        else if (contentArea) contentArea.innerHTML = errorMsg;

        // Globale Elemente deaktivieren
        if (chapterIndicator) chapterIndicator.textContent = '';
        if (prevButton) {
            prevButton.disabled = true;
            prevButton.onclick = null;
        }
        if (nextButton) {
            nextButton.disabled = true;
            nextButton.onclick = null;
        }
        if (breadcrumbNav) breadcrumbNav.innerHTML = ''; // Breadcrumbs leeren bei Fehler

        // Versuch, den Back-Link trotzdem sinnvoll zu setzen, falls möglich
        const backLink = document.querySelector('.story-nav a#back-link'); // Selektor ggf. anpassen
        if (backLink) {
            let defaultBackHref = 'index.html';
            let defaultBackText = '« Zurück zur Übersicht';
            let finalBackHref = defaultBackHref;
            let finalBackText = defaultBackText;
            let basePath = '.';

            // Versuche, aus der URL oder den bereits geladenen Daten den Typ zu ermitteln
            const urlParamsForError = new URLSearchParams(window.location.search);
            const itemIdForError = urlParamsForError.get('item');
            let itemTypeError = null;

            if (itemIdForError && allItemsData && allItemsData.items) {
                const parentItemMeta = allItemsData.items.find(i => i.id === itemIdForError);
                if (parentItemMeta) itemTypeError = parentItemMeta.type;
            }

            // Setze Link basierend auf dem Typ (falls bekannt)
            switch (itemTypeError) {
                case 'story':
                    finalBackHref = `${basePath}/geschichten.html`;
                    finalBackText = siteConfig.backToStoriesLink || '« Zurück zu den Geschichten';
                    break;
                case 'poem':
                    finalBackHref = `${basePath}/gedichte.html`;
                    finalBackText = siteConfig.backToPoemsLink || '« Zurück zu den Gedichten';
                    break;
                case 'poetic-novel':
                    finalBackHref = `${basePath}/gedichtsromane.html`;
                    finalBackText = siteConfig.backToPoeticNovelsLink || '« Zurück zu den Gedichtsromanen';
                    break;
                default: // Fallback zur globalen Übersicht
                    finalBackHref = `${basePath}/index.html`;
                    finalBackText = '« Zurück zur Übersicht';
            }

            backLink.href = finalBackHref;
            backLink.innerHTML = finalBackText;
            backLink.style.display = 'inline'; // Sicherstellen, dass er sichtbar ist
        }
    }
}


// --- Listenansichten (werden über setupArchivePage gerendert) ---

// --- Funktion zum Rendern der Items in einem Container ---
async function renderItems(container, items, displayType, emptyMessage) { // Funktion wird async
    if (!container) {
        console.error("Render-Container nicht gefunden.");
        return;
    }
    container.innerHTML = ''; // Container leeren vor dem Rendern
    if (items.length === 0) {
        if (emptyMessage) container.innerHTML = `<p>${emptyMessage}</p>`;
    } else {
        // Erstelle Promises für jedes Item-Element
        const itemPromises = items.map(item => createContentElement(item, displayType));
        // Warte, bis alle Promises aufgelöst sind
        const itemElements = await Promise.all(itemPromises);
        // Füge die aufgelösten Elemente zum Container hinzu
        itemElements.forEach(itemElement => {
            if (itemElement) { // Nur hinzufügen, wenn Element erstellt wurde
                container.appendChild(itemElement);
            }
        });
    }
}

// --- Funktion zum Erstellen eines einzelnen Item-Elements für Archivseiten ---
async function createContentElement(item, type = 'full') { // Funktion wird async
    if (type === 'full') {
        const article = document.createElement('article');
        article.className = 'archive-card';

        // Pfad zum content-viewer.html (Annahme: im Root-Verzeichnis)
        // Pfade im Manifest (image, contentPath) sollten relativ zum Root sein (z.B. /assets/img/bild.jpg, /stories/datei.md)
        const viewerPath = `content-viewer.html?item=${item.id}`; // Pfad relativ zum Root
        const imagePath = item.image; // Direkt aus dem Manifest übernehmen

        // Badge Logik: Neu / Pausiert / In Arbeit
        const now = new Date();
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        let badgeHtml = '';
        if (item.completed) {
            const completedDate = new Date(item.completed);
            if (!isNaN(completedDate) && completedDate >= oneWeekAgo) {
                badgeHtml = '<span class="new-badge">Neu</span>';
            }
        } else if (item.status === 'paused') {
            badgeHtml = '<span class="paused-badge">Pausiert</span>';
        } else {
            badgeHtml = '<span class="status-badge">In Arbeit</span>';
        }

        // Datum anzeigen: wenn completed, dann dieses, sonst started
        const dateToShow = item.completed || item.started;
        const datePrefix = item.completed ? 'Fertiggestellt' : 'Begonnen';
        const dateFormatted = dateToShow
            ? `${datePrefix}: ${new Date(dateToShow).toLocaleDateString('de-DE', {
                year: 'numeric', month: 'long', day: 'numeric'
            })}`
            : 'Unbekannt';

        const teaserText = item.teaser || item.description || ''; // Teaser, Fallback auf Description

        // Lesezeit für Archivkarten berechnen (basierend auf VOLLSTÄNDIGEM Inhalt, wenn möglich)
        let readingTime = '';
        let wordsPerMinute;
        if (item.type === 'poem') {
            wordsPerMinute = siteConfig.words_per_minute_poem;
        } else if (item.type === 'story') {
            wordsPerMinute = siteConfig.words_per_minute_story;
        } else {
            wordsPerMinute = 200; // Fallback
        }

        if (item.contentPath) {
            try {
                // Versuche, den vollständigen Inhalt zu laden
                const response = await fetch(item.contentPath); // Direkter Fetch mit dem Pfad aus dem Manifest
                if (response.ok) {
                    const markdownText = await response.text();
                    // Entferne Markdown-Überschriften für genauere Wortzählung
                    const textOnly = markdownText.replace(/^#.*$/gm, '');
                    readingTime = calculateReadingTime(textOnly, wordsPerMinute);
                } else {
                    console.warn(`Konnte Inhalt für Lesezeit nicht laden (${item.contentPath}): ${response.status}. Fallback auf Teaser.`);
                    // Fallback auf Teasertext, wenn Laden fehlschlägt
                    readingTime = calculateReadingTime(teaserText, wordsPerMinute);
                }
            } catch (error) {
                console.warn(`Fehler beim Laden von ${item.contentPath} für Lesezeit: ${error}. Fallback auf Teaser.`);
                // Fallback auf Teasertext bei Fetch-Fehler
                readingTime = calculateReadingTime(teaserText, wordsPerMinute);
            }
        } else {
            // Fallback auf Teasertext, wenn kein contentPath vorhanden ist
            readingTime = calculateReadingTime(teaserText, wordsPerMinute);
        }


        article.innerHTML = `
          <a href="${viewerPath}" class="card-image-link" aria-label="Details zu ${item.title} ansehen">
            <img class="card-image" src="${imagePath || ''}" alt="Bild zu ${item.title}" loading="lazy" onerror="this.style.display='none'; this.onerror=null;">
          </a>
          <div class="card-content">
            <h2>
              <a href="${viewerPath}">${item.title}${badgeHtml}</a>
            </h2>
            <p class="item-excerpt">${teaserText}</p>
            <p class="item-meta">${dateFormatted}</p>
			<div class="reading-meta">
            <p class="item-meta">${readingTime}</p>
            <a href="${viewerPath}" class="read-button">Lesen</a>
			</div>
          </div>
        `;
        // Nach dem Setzen von innerHTML, das Bild-Element holen und ggf. ausblenden, wenn src leer ist
        const imgElement = article.querySelector('.card-image');
        if (imgElement && !imgElement.getAttribute('src')) {
            imgElement.style.display = 'none';
        }


        return article;
    }
    // Ggf. andere Typen implementieren
    console.warn("Unbekannter Element-Typ angefordert:", type);
    return null; // Kein Element für unbekannte Typen
}