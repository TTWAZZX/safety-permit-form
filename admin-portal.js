'use strict';

const FAVORITES_KEY = 'tsh-admin-portal-favorites';
const RECENTS_KEY = 'tsh-admin-portal-recents';
const MAX_RECENTS = 4;
const MAX_STORED_ITEMS = 8;
const MAX_MODULE_ID_LENGTH = 64;
const element = (id) => document.getElementById(id);
const state = { query: '', category: 'all', favorites: [], recents: [] };

function readStoredList(key) {
    try {
        const value = JSON.parse(window.localStorage.getItem(key) || '[]');
        if (!Array.isArray(value)) return [];
        return [...new Set(value.filter((item) => typeof item === 'string' && item.length <= MAX_MODULE_ID_LENGTH))].slice(0, MAX_STORED_ITEMS);
    } catch (_error) { return []; }
}

function writeStoredList(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (_error) { /* Storage may be unavailable. */ }
}

function moduleCards() { return [...document.querySelectorAll('[data-module-card]')]; }

function moduleRecord(id) {
    const card = moduleCards().find((item) => item.dataset.moduleId === id);
    const link = [...document.querySelectorAll('[data-module-link]')].find((item) => item.dataset.moduleLink === id && !item.classList.contains('shortcut-link'));
    if (!card || !link) return null;
    return { id, title: card.querySelector('h3')?.textContent?.trim() || id, href: link.href, external: link.target === '_blank' };
}

function updateFavoriteButtons() {
    document.querySelectorAll('[data-favorite]').forEach((button) => {
        const active = state.favorites.includes(button.dataset.favorite);
        const title = moduleRecord(button.dataset.favorite)?.title || 'ระบบ';
        button.setAttribute('aria-pressed', String(active));
        button.querySelector('span').textContent = active ? '★' : '☆';
        button.setAttribute('aria-label', `${active ? 'นำออกจาก' : 'เพิ่มใน'}รายการโปรด: ${title}`);
    });
}

function createShortcut(record) {
    const link = document.createElement('a');
    link.className = 'shortcut-link';
    link.href = record.href;
    link.dataset.moduleLink = record.id;
    if (record.external) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    const dot = document.createElement('span');
    dot.className = 'shortcut-dot';
    dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = record.title;
    link.append(dot, label);
    return link;
}

function renderShortcutList(containerId, blockId, ids) {
    const container = element(containerId);
    container.replaceChildren();
    ids.map(moduleRecord).filter(Boolean).forEach((record) => container.append(createShortcut(record)));
    element(blockId).hidden = !container.childElementCount;
}

function renderShortcuts() {
    renderShortcutList('favoriteLinks', 'favoriteBlock', state.favorites);
    renderShortcutList('recentLinks', 'recentBlock', state.recents);
    element('personalShortcuts').hidden = !state.favorites.length && !state.recents.length;
    updateFavoriteButtons();
}

function toggleFavorite(id) {
    state.favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [...state.favorites, id];
    writeStoredList(FAVORITES_KEY, state.favorites);
    renderShortcuts();
}

function rememberRecent(id) {
    if (!moduleRecord(id)) return;
    state.recents = [id, ...state.recents.filter((item) => item !== id)].slice(0, MAX_RECENTS);
    writeStoredList(RECENTS_KEY, state.recents);
}

function applyFilters() {
    const normalizedQuery = state.query.trim().toLocaleLowerCase('th-TH');
    let visible = 0;
    moduleCards().forEach((card) => {
        const enabled = card.dataset.portalEnabled !== 'false';
        const categoryMatch = state.category === 'all' || card.dataset.category === state.category;
        const searchMatch = !normalizedQuery || String(card.dataset.search || '').toLocaleLowerCase('th-TH').includes(normalizedQuery);
        card.hidden = !(enabled && categoryMatch && searchMatch);
        if (!card.hidden) visible += 1;
    });
    document.querySelectorAll('[data-module-section]').forEach((section) => {
        section.hidden = !section.querySelector('[data-module-card]:not([hidden])');
    });
    element('moduleEmptyState').hidden = visible !== 0;
    element('moduleResultsStatus').textContent = `${visible} ระบบ`;
    element('clearModuleSearch').hidden = !state.query;
}

function setCategory(category) {
    state.category = category;
    document.querySelectorAll('[data-category-filter]').forEach((button) => {
        const active = button.dataset.categoryFilter === category;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    applyFilters();
}

function focusModuleSearch() {
    const directory = element('systemDirectory');
    const search = element('moduleSearch');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    directory.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => search.focus({ preventScroll: true }), reduceMotion ? 0 : 350);
}

function bindEvents() {
    element('moduleSearch').addEventListener('input', (event) => { state.query = event.target.value; applyFilters(); });
    element('clearModuleSearch').addEventListener('click', () => {
        state.query = '';
        element('moduleSearch').value = '';
        applyFilters();
        element('moduleSearch').focus();
    });
    document.querySelectorAll('[data-focus-search]').forEach((button) => button.addEventListener('click', focusModuleSearch));
    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        const category = event.target.closest('[data-category-filter]');
        if (category) return setCategory(category.dataset.categoryFilter);
        const favorite = event.target.closest('[data-favorite]');
        if (favorite) return toggleFavorite(favorite.dataset.favorite);
        const link = event.target.closest('[data-module-link]');
        if (link) rememberRecent(link.dataset.moduleLink);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
            event.preventDefault();
            focusModuleSearch();
        }
    });
}

function initialize() {
    state.favorites = readStoredList(FAVORITES_KEY).filter((id) => moduleRecord(id));
    state.recents = readStoredList(RECENTS_KEY).filter((id) => moduleRecord(id)).slice(0, MAX_RECENTS);
    bindEvents();
    renderShortcuts();
    applyFilters();
}

window.addEventListener('DOMContentLoaded', initialize);
window.addEventListener('portal-content:updated', () => {
    state.favorites = state.favorites.filter((id) => moduleRecord(id));
    state.recents = state.recents.filter((id) => moduleRecord(id)).slice(0, MAX_RECENTS);
    renderShortcuts();
    setCategory('all');
});
