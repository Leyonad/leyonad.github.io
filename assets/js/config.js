const siteConfig = {
  authorName: "Daniel Holzknecht",
  websiteName: "Daniel Holzknecht",
  siteTitleBase: "Geschichten & Gedichte",
  footerCopyrightText: "Alle Rechte vorbehalten.",
  storiesManifestPath: "/stories.json",

  // Texte für die UI
  navHome: "Startseite",
  navStories: "Geschichten",
  navPoems: "Gedichte",
  navAbout: "Über mich",
  navPoeticNovels: "Gedichtsromane",
  readAllStoriesBtn: "Alle Geschichten ansehen",
  backToStoriesLink: "« Zurück zu allen Geschichten",
  backToPoemsLink: "« Zurück zu allen Gedichten",
  backToPoeticNovelsLink: "« Zurück zu allen Gedichtsromanen",
  loadingText: "Inhalte werden geladen...",
  featuredStoriesTitle: "Ausgewählte Geschichten",
  featuredPoemsTitle: "Ausgewählte Gedichte",
  darkModeToggleText: {
    light: "🌙 Dunkel",
    dark: "☀️ Hell"
  }
};

// Funktion, um die Konfiguration global verfügbar zu machen (falls noch nicht vorhanden)
// Stelle sicher, dass dieser Teil oder ein ähnlicher Mechanismus existiert
if (typeof window !== 'undefined') {
  window.siteConfig = siteConfig;
}

// Dark Mode Initialisierung (wie in meinem vorherigen Vorschlag oder deiner bestehenden Logik)
(function () {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return; // Schutz für SSR/Build-Tools
  const theme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Body Klasse auch setzen/entfernen für globale Stile
  if (theme === 'dark' || (!theme && prefersDark)) {
    document.documentElement.classList.add('dark-mode');
    if (document.body) document.body.classList.add('dark-mode'); // Sicherstellen, dass body existiert
  } else {
    document.documentElement.classList.remove('dark-mode');
    if (document.body) document.body.classList.remove('dark-mode'); // Sicherstellen, dass body existiert
  }
})();