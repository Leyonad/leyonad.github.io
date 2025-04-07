// main.js

// --- Globale Variable für die Rohdaten und aktuelle Sortierung ---
let allItemsData = null;
let currentSortOrder = 'newest'; // Default sort order: newest first

document.addEventListener('DOMContentLoaded', async () => {
	applyConfigValues();
	setupMobileMenu(); // Mobiles Menü initialisieren
	setupDarkMode();

	// --- Daten einmalig laden, wenn auf einer relevanten Seite ---
	const storyArchiveContainer = document.querySelector('[data-story-list-archive]');
	const poemArchiveContainer = document.querySelector('[data-poem-list-archive]');
	const poeticNovelArchiveContainer = document.querySelector('[data-poetic-novel-list-archive]');
	const isArchivePage = storyArchiveContainer || poemArchiveContainer || poeticNovelArchiveContainer;
	const isHomePage = document.getElementById('stories-card'); // Prüfen ob Startseite

	try {
		// Pfad zum Manifest - annehmen, dass es im Root liegt oder relativer Pfad korrekt ist
		let manifestPath = siteConfig.storiesManifestPath;
		// Pfad ggf. anpassen, wenn von einer Unterseite (z.B. stories/) geladen wird
		if (window.location.pathname.includes('/stories/')) {
			manifestPath = `../${siteConfig.storiesManifestPath}`; // Beispiel: ../data/stories.json
		}
		const response = await fetch(manifestPath);
		if (!response.ok) throw new Error(`Fehler beim Laden der Inhalte (${manifestPath}): ${response.status}`);
		allItemsData = await response.json(); // Rohdaten speichern

		// Logik für die Startseite (index.html)
		if (isHomePage) {
			renderHomePagePreviews(); // Logik ausgelagert für Übersicht
		}

		// Logik für Archivseiten (geschichten, gedichte, gedichtsromane)
		if (isArchivePage) {
			setupArchivePage(); // Logik für Archivseiten initialisieren
		}

	} catch (error) {
		console.error('Fehler beim initialen Laden der Manifest-Daten:', error);
		// Fehler auf den betroffenen Seiten anzeigen
		if (isHomePage) {
			// Fehler auf Startseite anzeigen (optional)
			console.error("Konnte Vorschau auf Startseite nicht laden.");
			// Ggf. Fehlermeldungen in die Preview-Listen einfügen
			document.getElementById('story-preview-list')?.insertAdjacentHTML('beforeend', `<li>Fehler: ${error.message}</li>`);
			document.getElementById('poem-preview-list')?.insertAdjacentHTML('beforeend', `<li>Fehler: ${error.message}</li>`);
			document.getElementById('poetic-novel-preview-list')?.insertAdjacentHTML('beforeend', `<li>Fehler: ${error.message}</li>`);
		}
		const errorMsg = `<p>Fehler beim Laden: ${error.message}</p>`;
		if (storyArchiveContainer) storyArchiveContainer.innerHTML = errorMsg;
		if (poemArchiveContainer) poemArchiveContainer.innerHTML = errorMsg;
		if (poeticNovelArchiveContainer) poeticNovelArchiveContainer.innerHTML = errorMsg;
	}

	// --- Logik für Content Viewer / Chapter Viewer ---
	if (document.getElementById('content-area')) {
		const isChapterViewer = window.location.pathname.includes('chapter-viewer.html');
		const urlParams = new URLSearchParams(window.location.search);
		const itemId = urlParams.get('item');

		// Nur Fehler zeigen, wenn keine andere Seite aktiv ist UND keine ID vorhanden ist
		if (!itemId && !isHomePage && !isArchivePage) {
			console.error('Fehler: Keine Item-ID in der URL angegeben.');
			const contentArea = document.getElementById('content-area');
			if (contentArea) contentArea.innerHTML = '<p>Fehler: Kein Inhalt angegeben.</p>';
			return; // Verhindert weiteren Code-Ausführung hier
		}

		if (itemId) { // Nur laden, wenn eine ID vorhanden ist
			if (isChapterViewer) {
				loadAndRenderChapter(itemId).catch(error => {
					console.error('Fehler beim Laden des Kapitels:', error);
					document.getElementById('content-area').innerHTML = '<p>Fehler: Kapitel konnte nicht geladen werden.</p>';
				});
			} else {
				loadAndRenderPreview(); // Lädt basierend auf URL-Parametern
			}
		}
	}

	// --- Event Listener für Kapitelnavigation (Pfeiltasten) ---
	const prevButton = document.getElementById('prev-chapter');
	const nextButton = document.getElementById('next-chapter');
	document.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowLeft' && prevButton && !prevButton.disabled) {
			prevButton.click();
		} else if (event.key === 'ArrowRight' && nextButton && !nextButton.disabled) {
			nextButton.click();
		}
	});
});

function setupMobileMenu() {
	const menuToggle = document.querySelector('.menu-toggle');
	const mobileNav = document.querySelector('.header-right'); // Das ist jetzt der Menü-Container
	const navOverlay = document.querySelector('.nav-overlay');
	const navLinks = document.querySelectorAll('.main-nav a'); // Alle Links im Menü

	if (!menuToggle || !mobileNav || !navOverlay) {
		console.warn("Mobile menu elements not found.");
		return;
	}

	menuToggle.addEventListener('click', () => {
		const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
		menuToggle.setAttribute('aria-expanded', !isExpanded);
		document.body.classList.toggle('nav-open');
	});

	// Schließen-Funktion
	const closeMenu = () => {
		menuToggle.setAttribute('aria-expanded', 'false');
		document.body.classList.remove('nav-open');
	}

	// Schließen bei Klick auf Overlay
	navOverlay.addEventListener('click', closeMenu);

	// Schließen bei Klick auf einen Menü-Link
	navLinks.forEach(link => {
		link.addEventListener('click', closeMenu);
	});

	// Optional: Schließen bei Druck auf Escape-Taste
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
			closeMenu();
		}
	});
}


// --- Ausgelagerte Funktion für Startseiten-Vorschau ---
function renderHomePagePreviews() {
	if (!allItemsData) {
		console.warn("Daten für Startseiten-Vorschau noch nicht verfügbar.");
		return; // Daten müssen geladen sein
	}

	const storiesCard = document.getElementById('stories-card');
	const poemsCard = document.getElementById('poems-card');
	const poeticNovelsCard = document.getElementById('poetic-novels-card');

	const stories = allItemsData.items.filter(item => item.type === 'story');
	const poems = allItemsData.items.filter(item => item.type === 'poem');
	const poeticNovels = allItemsData.items.filter(item => item.type === 'poetic-novel');

	// --- Vorschaulisten füllen ---
	const storyList = document.getElementById('story-preview-list');
	const poemList = document.getElementById('poem-preview-list');
	const poeticNovelList = document.getElementById('poetic-novel-preview-list');

	// Hilfsfunktion zum Erstellen der Listeneinträge
	const createPreviewListItem = (item) => {
		const now = new Date();
		const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
		let badgeHtml = '';
		if (item.completed) {
			const completedDate = new Date(item.completed);
			if (completedDate >= oneWeekAgo) {
				badgeHtml = '<span class="new-badge">Neu</span>';
			}
		} else {
			badgeHtml = '<span class="status-badge">In Arbeit</span>';
		}

		// Pfad zum content-viewer (angenommen im Root)
		const viewerPath = `content-viewer.html?item=${item.id}`;
		// Pfad zum Bild (angenommen, Pfad im Manifest ist korrekt relativ zum Root oder absolut)
		const imagePath = item.image;
		return `
      <li data-image-src="${imagePath}" data-image-alt="Illustration zu: ${item.title}">
        <a href="${viewerPath}">
          <span class="item-title">${item.title}${badgeHtml}</span>
          <span class="arrow-indicator">→</span>
        </a>
      </li>
    `;
	};

	// Neuste zuerst für Vorschau (sort by 'started' DESC)
	const sortByStartedDesc = (a, b) => {
		const dateA = a.started ? new Date(a.started) : new Date("9999-12-31"); // Setze Items ohne Datum ans Ende
		const dateB = b.started ? new Date(b.started) : new Date("9999-12-31");
		return dateB - dateA;
	};

	if (storyList) {
		const previewStories = [...stories].sort(sortByStartedDesc).slice(0, 10);
		storyList.innerHTML = previewStories.map(createPreviewListItem).join('');
	}

	if (poemList) {
		const previewPoems = [...poems].sort(sortByStartedDesc).slice(0, 10);
		poemList.innerHTML = previewPoems.map(createPreviewListItem).join('');
	}

	if (poeticNovelList) {
		const previewPoeticNovels = [...poeticNovels].sort(sortByStartedDesc).slice(0, 10);
		poeticNovelList.innerHTML = previewPoeticNovels.map(createPreviewListItem).join('');
	}

	// --- Initiale Bilder setzen (jeweils das neuste Werk) ---
	const storyImage = storiesCard?.querySelector('.card-image');
	const poemImage = poemsCard?.querySelector('.card-image');
	const novelImage = poeticNovelsCard?.querySelector('.card-image');

	if (storyImage && stories.length > 0) {
		const newestStory = stories.sort(sortByStartedDesc)[0];
		storyImage.src = newestStory.image;
		storyImage.alt = `Illustration zu: ${newestStory.title}`;
		storyImage.style.height = '100%';
		storyImage.style.objectFit = 'cover';
	}

	if (poemImage && poems.length > 0) {
		const newestPoem = poems.sort(sortByStartedDesc)[0];
		poemImage.src = newestPoem.image;
		poemImage.alt = `Illustration zu: ${newestPoem.title}`;
		poemImage.style.height = '100%';
		poemImage.style.objectFit = 'cover';
	}

	if (novelImage && poeticNovels.length > 0) {
		const newestNovel = poeticNovels.sort(sortByStartedDesc)[0];
		novelImage.src = newestNovel.image;
		novelImage.alt = `Illustration zu: ${newestNovel.title}`;
		novelImage.style.height = '100%';
		novelImage.style.objectFit = 'cover';
	}

	// --- Hover-Effekt für Vorschaulisten ---
	const addHoverEffect = (listElement, imageElement) => {
		if (!listElement || !imageElement) return;
		listElement.addEventListener('mouseover', (event) => {
			const listItem = event.target.closest('li');
			if (listItem && listItem.dataset.imageSrc) {
				if (imageElement.src !== listItem.dataset.imageSrc) {
					// Verwende den Pfad aus dem data-Attribut, der beim Erstellen gesetzt wurde
					imageElement.src = listItem.dataset.imageSrc;
					imageElement.alt = listItem.dataset.imageAlt;
				}
			}
		});
	};
	addHoverEffect(storyList, storyImage);
	addHoverEffect(poemList, poemImage);
	addHoverEffect(poeticNovelList, novelImage);
}


// --- NEUE FUNKTION: Initialisiert Archivseiten (Filter etc.) ---
function setupArchivePage() {
	if (!allItemsData) {
		console.error("Daten noch nicht geladen für Archivseite.");
		// Optional: Fehlermeldung im Container anzeigen
		const potentialContainers = document.querySelectorAll('[data-story-list-archive], [data-poem-list-archive], [data-poetic-novel-list-archive]');
		potentialContainers.forEach(container => {
			if (!container.innerHTML.includes('Fehler')) { // Nur wenn noch keine Fehlermeldung da ist
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

	let currentItemType = null;
	let currentContainer = null;
	let emptyMessage = "Keine Einträge verfügbar."; // Default empty message

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

	// Ladeanzeige entfernen, bevor initial gerendert wird
	const loadingParagraph = currentContainer.querySelector('p[data-config="loadingText"]');
	if (loadingParagraph) {
		loadingParagraph.remove();
	}

	// Funktion zum Sortieren und Rendern
	const sortAndRenderItems = (sortOrder) => {
		currentSortOrder = sortOrder; // Update global state

		// Filter items by type
		const itemsToRender = allItemsData.items.filter(item => item.type === currentItemType);

		// Sort items based on 'started' date and selected order
		itemsToRender.sort((a, b) => {
			// Fallback für fehlende 'started' Daten (z.B. ans Ende/Anfang je nach Sortierung)
			const dateA = a.started ? new Date(a.started) : (sortOrder === 'newest' ? new Date(0) : new Date(8640000000000000)); // Treat missing as very old for newest, very new for oldest
			const dateB = b.started ? new Date(b.started) : (sortOrder === 'newest' ? new Date(0) : new Date(8640000000000000));

			if (sortOrder === 'newest') {
				return dateB - dateA; // Newest first (descending)
			} else { // oldest
				return dateA - dateB; // Oldest first (ascending)
			}
		});

		// Update button active state
		if (sortNewestButton && sortOldestButton) {
			sortNewestButton.classList.toggle('active', sortOrder === 'newest');
			sortOldestButton.classList.toggle('active', sortOrder === 'oldest');
		}

		// Render the sorted items
		renderItems(currentContainer, itemsToRender, 'full', emptyMessage);
	};

	// Event Listeners für Sortier-Buttons
	if (sortNewestButton) {
		sortNewestButton.addEventListener('click', () => {
			if (!sortNewestButton.classList.contains('active')) { // Nur ausführen, wenn nicht schon aktiv
				sortAndRenderItems('newest');
			}
		});
	}
	if (sortOldestButton) {
		sortOldestButton.addEventListener('click', () => {
			if (!sortOldestButton.classList.contains('active')) { // Nur ausführen, wenn nicht schon aktiv
				sortAndRenderItems('oldest');
			}
		});
	}

	// --- Initiales Rendern mit Default-Sortierung ("Neuste zuerst") ---
	sortAndRenderItems(currentSortOrder); // Use the default 'newest'

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
	const toggleButton = document.getElementById('dark-mode-toggle');
	const htmlElement = document.documentElement;
	const body = document.body;

	if (!toggleButton) return;

	// Funktion zum Setzen des Themes und Button-Textes
	const setTheme = (theme) => {
		if (theme === 'dark') {
			htmlElement.classList.add('dark-mode');
			body.classList.add('dark-mode');
			toggleButton.textContent = siteConfig.darkModeToggleText.dark;
			localStorage.setItem('theme', 'dark');
		} else {
			htmlElement.classList.remove('dark-mode');
			body.classList.remove('dark-mode');
			toggleButton.textContent = siteConfig.darkModeToggleText.light;
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

	// Event Listener für den Button
	toggleButton.addEventListener('click', () => {
		const currentTheme = htmlElement.classList.contains('dark-mode') ? 'dark' : 'light';
		setTheme(currentTheme === 'dark' ? 'light' : 'dark');
	});

	// Auf Systempräferenz hören (nur wenn kein Theme manuell gesetzt wurde)
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
		if (!localStorage.getItem('theme')) { // Nur reagieren, wenn User nicht manuell gewählt hat
			setTheme(event.matches ? 'dark' : 'light');
		}
	});
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

		contentImage.src = itemMeta.image || 'assets/images/placeholder.jpg';
		contentImage.alt = `Illustration zu: ${itemMeta.title}`;
		contentImage.onerror = () => {
			console.warn(`Bild für ${itemMeta.title} konnte nicht geladen werden: ${contentImage.src}`);
			contentImage.src = 'assets/images/placeholder.jpg';
			contentImage.alt = 'Platzhalterbild';
		};
		if (itemMeta.image) {
			contentImage.style.display = 'block';
		} else {
			contentImage.style.display = 'none';
		}

		// Beschreibung nur anzeigen, wenn es KEIN Gedicht ist
		if (itemMeta.type !== 'poem') {
			contentDescription.innerHTML = `<p>${itemMeta.description || ''}</p>`;
			contentDescription.style.display = 'block';
		} else {
			contentDescription.innerHTML = ''; // Inhalt leeren
			contentDescription.style.display = 'none'; // Ausblenden für Gedichte
		}

		contentDate.innerHTML = itemMeta.started
			? `<p>Begonnen: ${new Date(itemMeta.started).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` +
			(itemMeta.completed ? `<p>Fertiggestellt: ${new Date(itemMeta.completed).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` : '')
			: 'Startdatum unbekannt';

		// Badge Logik: "Neu" wenn innerhalb 7 Tage abgeschlossen, sonst "In Arbeit" wenn nicht abgeschlossen
		const now = new Date();
		const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
		let badgeHtml = '';
		if (itemMeta.completed) {
			const completedDate = new Date(itemMeta.completed);
			if (completedDate >= oneWeekAgo) {
				badgeHtml = '<span class="new-badge">Neu</span>';
			}
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
					console.log(markdownText)
					// Markdown parsen
					let poemHtml = marked.parse(markdownText.trim()); // Trim nach Entfernung

					// HTML in den Gedichtbereich einfügen und anzeigen
					poemDisplayArea.innerHTML = poemHtml;
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
								chapters.push({ title: title, link: chapterLink, index: chapterIndex });
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
			allItemsData = await responseManifest.json();
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
			chapterHtml = marked.parse(markdownContentToParse, { breaks: true, gfm: true });
		} else {
			// Für andere Typen (z.B. Story): Jeden Zeilenumbruch in einen doppelten umwandeln,
			// damit marked.js daraus <p>-Tags macht (Standardverhalten).
			console.log("Rendering story-like content with paragraph conversion");
			const processedMarkdownContent = markdownContentToParse.replace(/(\r?\n)+/g, '\n\n');
			// Wichtig: Ggf. weitere marked Optionen wie 'gfm: true' hinzufügen
			chapterHtml = marked.parse(processedMarkdownContent, { gfm: true }); // Standard-Parsing (breaks: false ist default)
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
			}
		}

	} catch (error) {
		console.error('Fehler beim Laden des Kapitels:', error);
		const errorMsg = `<p>Fehler: Kapitel konnte nicht geladen werden. (${error.message})</p>`;
		if (contentTextElement) contentTextElement.innerHTML = errorMsg;
		else if (contentArea) contentArea.innerHTML = errorMsg;

		// Globale Elemente deaktivieren
		if (chapterIndicator) chapterIndicator.textContent = '';
		if (prevButton) { prevButton.disabled = true; prevButton.onclick = null; }
		if (nextButton) { nextButton.disabled = true; nextButton.onclick = null; }
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
				case 'story': finalBackHref = `${basePath}/geschichten.html`; finalBackText = siteConfig.backToStoriesLink || '« Zurück zu den Geschichten'; break;
				case 'poem': finalBackHref = `${basePath}/gedichte.html`; finalBackText = siteConfig.backToPoemsLink || '« Zurück zu den Gedichten'; break;
				case 'poetic-novel': finalBackHref = `${basePath}/gedichtsromane.html`; finalBackText = siteConfig.backToPoeticNovelsLink || '« Zurück zu den Gedichtsromanen'; break;
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
function renderItems(container, items, displayType, emptyMessage) {
	if (!container) {
		console.error("Render-Container nicht gefunden.");
		return;
	}
	container.innerHTML = ''; // Container leeren vor dem Rendern
	if (items.length === 0) {
		if (emptyMessage) container.innerHTML = `<p>${emptyMessage}</p>`;
	} else {
		items.forEach(item => {
			const itemElement = createContentElement(item, displayType);
			if (itemElement) { // Nur hinzufügen, wenn Element erstellt wurde
				container.appendChild(itemElement);
			}
		});
	}
}

// --- Funktion zum Erstellen eines einzelnen Item-Elements für Archivseiten ---
function createContentElement(item, type = 'full') {
	if (type === 'full') {
		const article = document.createElement('article');
		article.className = 'archive-card';

		// Pfad zum content-viewer.html anpassen, relativ zur *Archivseite*
		let viewerPath = 'content-viewer.html'; // Default für Root-Seiten (gedichte, romane)
		let imagePath = item.image; // Default - Annahme: Pfad im Manifest ist korrekt vom Root aus

		// Wenn die aktuelle Seite geschichten.html im Unterordner /stories/ ist
		if (window.location.pathname.includes('/stories/')) {
			viewerPath = `../content-viewer.html`; // Pfad vom Unterordner zum Viewer im Root
			// Bildpfad anpassen, WENN er relativ ist UND NICHT mit / beginnt
			if (imagePath && !imagePath.startsWith('/') && !imagePath.startsWith('http')) {
				// Nur relative Pfade müssen angepasst werden
				// Annahme: Pfad im Manifest ist z.B. 'assets/img/bild.jpg'
				// Dann wird er von /stories/ aus zu '../assets/img/bild.jpg'
				// imagePath = `../${imagePath}`; // Diese Anpassung hängt STARK von der Struktur ab!
				// Besser ist oft, absolute Pfade (/assets/img/bild.jpg) oder Pfade relativ zum Manifest im Manifest zu speichern.
				// Wenn Manifest im Root ist und Pfade relativ dazu: Keine Anpassung hier nötig.
			}
		}
		// Füge Item-ID zum Viewer-Pfad hinzu
		viewerPath += `?item=${item.id}`;

		// Badge Logik: "Neu" wenn innerhalb 7 Tage abgeschlossen, sonst "In Arbeit" wenn nicht abgeschlossen
		const now = new Date();
		const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
		let badgeHtml = '';
		if (item.completed) {
			const completedDate = new Date(item.completed);
			if (completedDate >= oneWeekAgo) {
				badgeHtml = '<span class="new-badge">Neu</span>';
			}
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

		article.innerHTML = `
          <a href="${viewerPath}" class="card-image-link" aria-label="Details zu ${item.title} ansehen">
            <img class="card-image" src="${imagePath || 'assets/images/placeholder.jpg'}" alt="Bild zu ${item.title}" loading="lazy" onerror="this.onerror=null; this.src='assets/images/placeholder.jpg';">
          </a>
          <div class="card-content">
            <h2>
              <a href="${viewerPath}">${item.title}${badgeHtml}</a>
            </h2>
            <p class="item-excerpt">${teaserText}</p>
            <p class="item-meta">${dateFormatted}</p>
            <a href="${viewerPath}" class="read-button">Lesen</a>
          </div>
        `;

		return article;
	}
	// Ggf. andere Typen implementieren
	console.warn("Unbekannter Element-Typ angefordert:", type);
	return null; // Kein Element für unbekannte Typen
}