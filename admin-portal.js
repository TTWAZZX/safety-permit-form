'use strict';

const FAVORITES_KEY = 'tsh-admin-portal-favorites';
const RECENTS_KEY = 'tsh-admin-portal-recents';
const MAX_RECENTS = 4;
const element = (id) => document.getElementById(id);
const state = { query: '', category: 'all', favorites: [], recents: [] };

function readStoredList(key) {
    try {
        const value = JSON.parse(window.localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
    } catch (_error) { return []; }
}

function writeStoredList(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (_error) { /* Storage may be unavailable. */ }
}

function moduleCards() { return [...document.querySelectorAll('[data-module-card]')]; }

function moduleRecord(id) {
    const escapedId = CSS.escape(id);
    const card = document.querySelector(`[data-module-id="${escapedId}"]`);
    const link = document.querySelector(`[data-module-link="${escapedId}"]`);
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
        const categoryMatch = state.category === 'all' || card.dataset.category === state.category;
        const searchMatch = !normalizedQuery || String(card.dataset.search || '').toLocaleLowerCase('th-TH').includes(normalizedQuery);
        card.hidden = !(categoryMatch && searchMatch);
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

function safePictureUrl(value) {
    try {
        const url = new URL(String(value || ''));
        return url.protocol === 'https:' ? url.href : '';
    } catch (_error) { return ''; }
}

function renderProfile(profile = {}) {
    const displayName = String(profile.displayName || 'Safety Admin').trim() || 'Safety Admin';
    const image = element('portalAvatarImage');
    const fallback = element('portalAvatarFallback');
    const pictureUrl = safePictureUrl(profile.pictureUrl);
    element('portalAdminName').textContent = displayName;
    fallback.textContent = displayName.slice(0, 1).toUpperCase();
    if (!pictureUrl) return;
    image.onload = () => { image.hidden = false; fallback.hidden = true; };
    image.onerror = () => { image.hidden = true; fallback.hidden = false; image.removeAttribute('src'); };
    image.src = pictureUrl;
}

async function hydrateOptionalLineProfile() {
    const liffId = window.SAFETY_DASHBOARD_CONFIG?.liffId;
    if (!window.liff || !liffId) return;
    try {
        await window.liff.init({ liffId });
        if (!window.liff.isLoggedIn()) return;
        renderProfile(await window.liff.getProfile());
    } catch (error) {
        console.warn('Optional LINE profile is unavailable; using the safe fallback', error);
    }
}

function bindEvents() {
    element('moduleSearch').addEventListener('input', (event) => { state.query = event.target.value; applyFilters(); });
    element('clearModuleSearch').addEventListener('click', () => {
        state.query = '';
        element('moduleSearch').value = '';
        applyFilters();
        element('moduleSearch').focus();
    });
    document.querySelectorAll('[data-category-filter]').forEach((button) => button.addEventListener('click', () => setCategory(button.dataset.categoryFilter)));
    document.addEventListener('click', (event) => {
        const favorite = event.target.closest('[data-favorite]');
        if (favorite) return toggleFavorite(favorite.dataset.favorite);
        const link = event.target.closest('[data-module-link]');
        if (link) rememberRecent(link.dataset.moduleLink);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
            event.preventDefault();
            element('moduleSearch').focus();
        }
    });
}

function initialize() {
    state.favorites = readStoredList(FAVORITES_KEY).filter((id) => moduleRecord(id));
    state.recents = readStoredList(RECENTS_KEY).filter((id) => moduleRecord(id)).slice(0, MAX_RECENTS);
    bindEvents();
    renderShortcuts();
    applyFilters();
    hydrateOptionalLineProfile();
}

window.addEventListener('DOMContentLoaded', initialize);
