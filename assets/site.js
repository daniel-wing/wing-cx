/* Shared shell behaviour: the pinned header, and language switching.
   Loaded by every page. No build step, no framework. */

(function () {
  'use strict';

  /* ---------------- pinned header ---------------- */

  function initStickyHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const update = () => header.classList.toggle('is-stuck', window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
    // Landing on an anchor such as #desktop starts the page part-scrolled, and
    // that jump can land after this runs without firing a scroll event.
    window.addEventListener('load', update);
  }

  /* ---------------- language ---------------- */

  const STORAGE_KEY = 'wing-lang';
  const SUPPORTED = ['en', 'es'];

  function resolveLanguage() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (SUPPORTED.includes(fromUrl)) return fromUrl;

    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* private mode */ }
    if (SUPPORTED.includes(stored)) return stored;

    for (const tag of navigator.languages ?? [navigator.language]) {
      const code = String(tag || '').toLowerCase().split('-')[0];
      if (SUPPORTED.includes(code)) return code;
    }
    return 'en';
  }

  function lookup(lang, key) {
    const dict = (window.WING_STRINGS || {})[lang] || {};
    // English is the fallback: a missing translation should show the original
    // wording, never an empty element or a raw key.
    return dict[key] ?? (window.WING_STRINGS || {}).en?.[key] ?? null;
  }

  function apply(lang) {
    document.documentElement.lang = lang;

    for (const node of document.querySelectorAll('[data-i18n]')) {
      const value = lookup(lang, node.dataset.i18n);
      if (value !== null) node.textContent = value;
    }
    for (const node of document.querySelectorAll('[data-i18n-html]')) {
      const value = lookup(lang, node.dataset.i18nHtml);
      if (value !== null) node.innerHTML = value;
    }
    for (const node of document.querySelectorAll('[data-i18n-label]')) {
      const value = lookup(lang, node.dataset.i18nLabel);
      if (value !== null) node.setAttribute('aria-label', value);
    }
    for (const node of document.querySelectorAll('[data-i18n-title]')) {
      const value = lookup(lang, node.dataset.i18nTitle);
      if (value !== null) node.setAttribute('title', value);
    }

    for (const button of document.querySelectorAll('.lang-opt')) {
      const active = button.dataset.lang === lang;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    window.WING_LANG = lang;
    document.dispatchEvent(new CustomEvent('wing:languagechange', { detail: { lang } }));
  }

  function setLanguage(lang) {
    if (!SUPPORTED.includes(lang)) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* private mode */ }

    // Keep the choice in the URL so a shared link carries the language.
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);

    apply(lang);
  }

  function initLanguage() {
    apply(resolveLanguage());
    for (const button of document.querySelectorAll('.lang-opt')) {
      button.addEventListener('click', () => setLanguage(button.dataset.lang));
    }
  }

  /** Translate from scripts. Used by the Scribe page for its live strings. */
  window.wingT = function (key, vars) {
    let value = lookup(window.WING_LANG || 'en', key);
    if (value === null) return key;
    if (vars) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.replaceAll(`{${name}}`, replacement);
      }
    }
    return value;
  };

  function init() {
    initStickyHeader();
    initLanguage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
