'use strict';

/* =========================================================================
   PORTWATCH HUB — comportamento
   ========================================================================= */

const IS_DESKTOP = Boolean(window.portwatch && window.portwatch.isDesktop);
const LS_KEY = 'portwatch-hub.config';
const SITE_URL = 'https://portwatch-vi.xyz/';
const TRACKER_GITHUB = 'https://github.com/4lwayz/portwatch-vi';

const DEFAULTS = {
  language: null,
  theme: 'vice',
  downloadsDir: '',
  refreshMinutes: 5,
  githubToken: '',
  uiSounds: true,
  radioOn: true,
  radioStation: 'neon',
  musicVolume: 55,
  startFullscreen: false,
  reduceMotion: false,
};

const VIEW_META = {
  race: { kickerKey: 'view.race.kicker', titleKey: 'view.race.title', footer: false },
  downloads: { kickerKey: 'view.downloads.kicker', titleKey: 'view.downloads.title', footer: false },
  hardware: { kickerKey: 'view.hardware.kicker', titleKey: 'view.hardware.title', footer: false },
  settings: { kickerKey: 'view.settings.kicker', titleKey: 'view.settings.title', footer: true },
  about: { kickerKey: 'view.about.kicker', titleKey: 'view.about.title', footer: false },
};

const state = {
  config: { ...DEFAULTS },
  defaults: { ...DEFAULTS },
  appVersion: '2.0.0',
  site: SITE_URL,
  trackerRepo: TRACKER_GITHUB,
  tracker: null,
  trackerMeta: null,
  trackerLoading: false,
  trackerError: null,
  forks: [],
  forksMeta: null,
  forksLoading: false,
  forksError: null,
  downloads: { dir: '', items: [] },
  downloading: new Map(),
  picking: new Set(),
  dlQuery: '',
  filter: 'all',
  sort: 'score',
  hw: {
    data: null,
    loading: false,
    error: null,
    manual: false,
    target: 'low',
    selection: { gpu: null, cpu: null, ram: null, storage: null },
  },
};

let draft = null;
let activeView = null;
let lastFocus = null;
let refreshTimer = null;
let tickTimer = null;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pad = (n) => String(n).padStart(2, '0');

/* =========================================================================
   UTILITÁRIOS
   ========================================================================= */

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}

function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value.toLocaleString(currentLocale(), { maximumFractionDigits: 1 })} ${units[i]}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const month = monthShort(d.getMonth());
  const day = pad(d.getDate());
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return currentLanguage() === 'en' ? `${month} ${day} · ${time}` : `${day} ${month} · ${time}`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScore(value) {
  const number = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function safeFolder(value) {
  return (
    String(value || '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80) || 'repo'
  );
}

function toast(message, tone = 'ok', ttl = 3400) {
  const wrap = $('#toasts');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast' + (tone === 'warn' ? ' warn' : tone === 'bad' ? ' bad' : '');
  const dot = document.createElement('span');
  dot.className = 'toast-dot';
  const text = document.createElement('span');
  text.textContent = message;
  el.append(dot, text);
  wrap.appendChild(el);
  while (wrap.children.length > 3) wrap.removeChild(wrap.firstChild);
  window.setTimeout(() => {
    el.classList.add('is-out');
    window.setTimeout(() => el.remove(), 320);
  }, ttl);
}

function saveLocal(config) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {
    /* preview sem storage */
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function persist(patch) {
  Object.assign(state.config, patch);
  if (IS_DESKTOP) {
    state.config = await window.portwatch.saveConfig(patch);
  } else {
    saveLocal(state.config);
  }
  return state.config;
}

/* =========================================================================
   TEMA VISUAL
   ========================================================================= */

function normalizeTheme(value) {
  return value === 'losSantos' ? 'losSantos' : 'vice';
}

function currentTheme() {
  return normalizeTheme(state.config.theme);
}

function syncThemePicker(theme) {
  const value = normalizeTheme(theme);
  $$('[data-theme-choice]').forEach((btn) => {
    const active = btn.dataset.themeChoice === value;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function stationDisplay(station) {
  if (currentTheme() === 'losSantos' && station.ls) {
    return { name: station.ls.name, tagline: station.ls.tagline };
  }
  return { name: station.name, tagline: station.tagline };
}

function refreshStationLabels() {
  $$('#radioStations .station').forEach((row) => {
    const station = radioStationById(row.dataset.station);
    const display = stationDisplay(station);
    const freq = row.querySelector('.station-freq');
    const name = row.querySelector('.station-txt b');
    const tag = row.querySelector('.station-txt small');
    if (freq) freq.textContent = station.frequency;
    if (name) name.textContent = display.name;
    if (tag) tag.textContent = display.tagline;
  });
}

function applyTheme(theme) {
  const value = normalizeTheme(theme);
  document.body.dataset.theme = value;
  syncThemePicker(value);
  if ($('#radioStations') && $('#radioStations').children.length) {
    refreshStationLabels();
    updateRadioUI();
  }
}

async function setTheme(theme) {
  const value = normalizeTheme(theme);
  const changed = currentTheme() !== value;

  state.config.theme = value;
  if (draft) draft.theme = value;
  applyTheme(value);

  if (!changed) return;

  try {
    state.config = await persist({ theme: value });
  } catch {
    toast(t('toast.saveError'), 'bad');
  }

  blip({ freq: 720, slide: 1.25, dur: 0.06, gain: 0.012, type: 'triangle' });
}

/* =========================================================================
   MODELO DE PONTUAÇÃO DO PORTWATCH
   ========================================================================= */

const MILESTONES = [
  { key: 'groundwork', at: 0 },
  { key: 'loads', at: 10 },
  { key: 'boots', at: 20 },
  { key: 'menu', at: 30 },
  { key: 'world', at: 40 },
  { key: 'playable', at: 50 },
  { key: 'complete', at: 100 },
];

const TRACKS = [
  { key: 'story', weight: 0.35 },
  { key: 'render', weight: 0.25 },
  { key: 'perf', weight: 0.2 },
  { key: 'stability', weight: 0.2 },
];

const GROUNDWORK = [
  { key: 'loader', weight: 0.2 },
  { key: 'shaders', weight: 0.28 },
  { key: 'graphics', weight: 0.32 },
  { key: 'proven', weight: 0.2 },
];

const STABILITY = {
  unknown: 0,
  constant: 0,
  often: 0.25,
  sometimes: 0.55,
  rarely: 0.8,
  stable: 1,
};

const LADDER = ['loads', 'boots', 'menu', 'world', 'playable'];
const TICK = Object.fromEntries(MILESTONES.map((m) => [m.key, m.at]));

function clamp01(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

function ladderValue(value) {
  if (value === true) return 1;
  if (value === false || value == null) return 0;
  return clamp01(value);
}

function groundworkFraction(gw) {
  return GROUNDWORK.reduce((sum, item) => sum + item.weight * clamp01(gw && gw[item.key]), 0);
}

function trackValues(gta = {}) {
  return {
    story: clamp01(gta.story),
    render: clamp01(gta.render),
    perf: clamp01((Number(gta.fps) || 0) / 30),
    stability:
      typeof gta.stability === 'number'
        ? clamp01(gta.stability)
        : STABILITY[gta.stability] || STABILITY.unknown,
  };
}

function scoreEffort(effort) {
  const gw = groundworkFraction(effort.groundwork);
  const gta = effort.gta || {};
  let score = TICK.loads * gw;
  let reached = 'groundwork';
  let prevTick = score;

  for (const key of LADDER) {
    const value = ladderValue(gta[key]);
    if (value >= 1) {
      score = TICK[key];
      prevTick = score;
      reached = key;
      continue;
    }
    if (value > 0) score = Math.max(score, prevTick + value * (TICK[key] - prevTick));
    break;
  }

  const tracks = trackValues(gta);
  const quality = TRACKS.reduce((sum, track) => sum + track.weight * tracks[track.key], 0);
  if (reached === 'playable') {
    score = TICK.playable + quality * (TICK.complete - TICK.playable);
    if (quality >= 1) reached = 'complete';
  }

  if (Number.isFinite(effort.manualScore)) {
    score = Math.min(100, Math.max(0, effort.manualScore));
  }

  return {
    score: Math.round(score * 10) / 10,
    groundwork: gw,
    reached,
    tracks,
    playable: reached === 'playable' || reached === 'complete',
  };
}

function isPrivateBuild(effort) {
  return !(typeof effort.repo === 'string' && effort.repo.includes('/'));
}

function overall(efforts) {
  const scored = (efforts || [])
    .filter((effort) => !effort.nuked)
    .map((effort) => ({ effort, ...scoreEffort(effort) }))
    .sort((a, b) => b.score - a.score || (b.effort.stats?.stars || 0) - (a.effort.stats?.stars || 0));

  const top = scored.slice(0, 3);
  const leader = scored[0] || null;
  const furthestIndex = scored.reduce((best, item) => {
    const index = MILESTONES.findIndex((m) => m.key === item.reached);
    return index > best ? index : best;
  }, 0);

  return {
    leader,
    score: leader ? leader.score : 0,
    top3: top.length
      ? Math.round((top.reduce((sum, item) => sum + item.score, 0) / top.length) * 10) / 10
      : 0,
    furthest: MILESTONES[furthestIndex],
    ranked: scored,
  };
}

function stageLabel(reached) {
  return t(`race.stage.${reached || 'groundwork'}`);
}

function basedOnNames(effort) {
  const ids = Array.isArray(effort.basedOn) ? effort.basedOn : [];
  if (!ids.length || !state.tracker) return '';
  return ids
    .map((id) => {
      const target = state.tracker.efforts.find((item) => item.id === id);
      return target ? target.name : id;
    })
    .join(', ');
}

/* =========================================================================
   ESTADO / CONFIGURAÇÃO
   ========================================================================= */

async function loadState() {
  if (IS_DESKTOP) {
    try {
      const snap = await window.portwatch.getState();
      state.config = { ...DEFAULTS, ...(snap.defaults || {}), ...(snap.config || {}) };
      state.defaults = { ...DEFAULTS, ...(snap.defaults || {}) };
      state.appVersion = snap.appVersion || state.appVersion;
      state.site = snap.site || SITE_URL;
      state.trackerRepo = snap.tracker || TRACKER_GITHUB;
      state.downloads.dir = snap.downloadsDir || state.config.downloadsDir || '';
    } catch {
      toast(t('toast.state'), 'bad');
    }
  } else {
    const saved = loadLocal();
    state.config = { ...DEFAULTS, ...(saved || {}) };
    state.defaults = { ...DEFAULTS };
    state.downloads.dir = state.config.downloadsDir || '';
  }
}

function syncControlsFrom(source) {
  $$('[data-bind]').forEach((el) => {
    const key = el.dataset.bind;
    let value = source[key];
    if (key === 'language' && !value) value = currentLanguage();
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value == null ? '' : value;
    if (el.type === 'range') updateSlider(el);
  });
  syncThemePicker(source.theme);
}

function updateSlider(el) {
  const min = Number(el.min || 0);
  const max = Number(el.max || 100);
  const value = Number(el.value || 0);
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  el.style.setProperty('--fill', pct.toFixed(1));
}

function applyStateToUI() {
  const source = draft || state.config;
  const theme = draft ? draft.theme : state.config.theme;
  const reduce = draft ? draft.reduceMotion : state.config.reduceMotion;

  document.body.classList.toggle('reduce-motion', Boolean(reduce));
  applyTheme(theme);
  syncControlsFrom(source);

  const version = `v${state.appVersion}`;
  const versionTag = $('#versionTag');
  if (versionTag) versionTag.textContent = version;
  const aboutVersion = $('#aboutVersion');
  if (aboutVersion) aboutVersion.textContent = version;

  const dlDir = state.config.downloadsDir || state.downloads.dir || '—';
  const dlDirEl = $('#dlDir');
  if (dlDirEl) dlDirEl.textContent = dlDir;
  const settingsDlDir = $('#settingsDlDir');
  if (settingsDlDir) settingsDlDir.textContent = dlDir;
  const aboutDownloads = $('#aboutDownloads');
  if (aboutDownloads) aboutDownloads.textContent = dlDir;

  const aboutLang = $('#aboutLang');
  if (aboutLang) aboutLang.textContent = languageLabel(state.config.language || currentLanguage());
  const aboutRefresh = $('#aboutRefresh');
  if (aboutRefresh) aboutRefresh.textContent = `${state.config.refreshMinutes || 5} min`;

  renderHome();
  renderAbout();
  updateRadioUI();
  applyMusicVolume();
  renderHardware();
}

async function refreshState() {
  if (!IS_DESKTOP) {
    applyStateToUI();
    return;
  }
  try {
    const snap = await window.portwatch.getState();
    state.config = { ...DEFAULTS, ...(snap.defaults || {}), ...(snap.config || {}) };
    state.defaults = { ...DEFAULTS, ...(snap.defaults || {}) };
    state.appVersion = snap.appVersion || state.appVersion;
    state.site = snap.site || SITE_URL;
    state.trackerRepo = snap.tracker || TRACKER_GITHUB;
    state.downloads.dir = snap.downloadsDir || state.config.downloadsDir || '';
  } catch {
    /* mantém o estado atual */
  }
  applyStateToUI();
}

/* =========================================================================
   DADOS: TRACKER E FORKS
   ========================================================================= */

async function fetchRace(force = false) {
  if (state.trackerLoading) return;
  state.trackerLoading = true;
  renderHome();
  renderRace();

  try {
    let result;
    if (IS_DESKTOP) {
      result = await window.portwatch.race(force);
    } else {
      const res = await fetch(`/api/tracker${force ? '?force=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      result = { ok: true, data, updated: data.updated || null, fetchedAt: Date.now() };
    }

    if (!result || !result.ok || !result.data) {
      throw new Error((result && result.error) || 'tracker');
    }

    state.tracker = result.data;
    state.trackerMeta = {
      updated: result.updated || result.data.updated || null,
      cached: Boolean(result.cached),
      stale: Boolean(result.stale),
      fetchedAt: result.fetchedAt || Date.now(),
      error: result.error || null,
    };
    state.trackerError = null;
  } catch (err) {
    state.trackerError = String(err && err.message ? err.message : err);
  } finally {
    state.trackerLoading = false;
  }

  renderAllData();
}

async function fetchForks(force = false) {
  if (state.forksLoading) return;
  state.forksLoading = true;
  renderDownloads();

  try {
    let result;
    if (IS_DESKTOP) {
      result = await window.portwatch.forks(force);
    } else {
      const res = await fetch(`/api/forks${force ? '?force=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      result = { ok: true, forks: data.forks || data, fetchedAt: Date.now() };
    }

    if (!result || !result.ok) throw new Error((result && result.error) || 'forks');

    state.forks = Array.isArray(result.forks) ? result.forks : [];
    state.forksMeta = {
      fetchedAt: result.fetchedAt || Date.now(),
      cached: Boolean(result.cached),
      stale: Boolean(result.stale),
      error: result.error || null,
    };
    state.forksError = null;
  } catch (err) {
    state.forksError = String(err && err.message ? err.message : err);
  } finally {
    state.forksLoading = false;
  }

  renderAllData();
}

async function refreshAll({ force = true, silent = false } = {}) {
  await Promise.allSettled([fetchRace(force), fetchForks(force)]);
  if (IS_DESKTOP) await loadDownloads();

  if (!silent) {
    if (state.tracker) {
      toast(t('toast.raceUpdated', { count: state.tracker.efforts.length }));
    } else {
      toast(t('toast.raceError'), 'warn');
    }
  }
}

function renderAllData() {
  renderHome();
  renderRace();
  renderDownloads();
  renderAbout();
}

/* =========================================================================
   HOME
   ========================================================================= */

function countProjects() {
  if (!state.tracker) return 0;
  return state.tracker.efforts.filter(
    (effort) => !effort.nuked && typeof effort.repo === 'string' && effort.repo.includes('/')
  ).length;
}

function renderHome() {
  const efforts = (state.tracker && state.tracker.efforts) || [];
  const meta = state.trackerMeta;
  const summary = overall(efforts);
  const leader = summary.leader;
  const live = Boolean(state.tracker) && !(meta && meta.stale);
  const loading = state.trackerLoading && !state.tracker;

  const pill = $('#heroPill');
  if (pill) {
    pill.textContent = t(live ? 'home.live' : 'home.offline');
    pill.classList.toggle('is-off', !live);
  }

  const dot = $('#heroDot');
  if (dot) {
    dot.classList.toggle('bad', !state.tracker && !loading);
    dot.classList.toggle('warn', Boolean(meta && meta.stale));
  }

  const heroMeta = $('#heroMetaText');
  if (heroMeta) {
    if (loading) heroMeta.textContent = t('home.loading');
    else if (!state.tracker) heroMeta.textContent = t('home.error');
    else if (leader) {
      heroMeta.textContent = t('home.meta', {
        count: efforts.length,
        name: leader.effort.name,
        score: formatScore(leader.score),
      });
    } else heroMeta.textContent = t('home.error');
  }

  const homeLeader = $('#homeLeader');
  if (homeLeader) homeLeader.textContent = leader ? leader.effort.name : '—';
  const homeStage = $('#homeLeaderStage');
  if (homeStage) {
    homeStage.textContent = loading
      ? t('home.loading')
      : leader
        ? stageLabel(leader.reached)
        : t('home.error');
  }
  const homeScore = $('#homeScore');
  if (homeScore) homeScore.textContent = leader ? `${formatScore(leader.score)}%` : '—';
  const homeBar = $('#homeBar');
  if (homeBar) homeBar.style.width = `${leader ? Math.min(100, leader.score) : 0}%`;
  const homeTop3 = $('#homeTop3');
  if (homeTop3) homeTop3.textContent = state.tracker ? `${formatScore(summary.top3)}%` : '—';
  const homeEfforts = $('#homeEfforts');
  if (homeEfforts) homeEfforts.textContent = state.tracker ? String(efforts.length) : '—';
  const homeUpdated = $('#homeUpdated');
  if (homeUpdated) homeUpdated.textContent = meta && meta.updated ? fmtTime(meta.updated) : '—';

  const projects = countProjects();
  const forks = state.forks.length;
  const homeProjects = $('#homeProjects');
  if (homeProjects) homeProjects.textContent = state.tracker ? String(projects) : '—';
  const homeForks = $('#homeForks');
  if (homeForks) homeForks.textContent = state.forks.length ? String(forks) : '—';
  const dlCountPill = $('#dlCountPill');
  if (dlCountPill) dlCountPill.textContent = projects || forks ? String(projects + forks) : '—';
}

/* =========================================================================
   CORRIDA
   ========================================================================= */

function buildRaceData() {
  const efforts = (state.tracker && state.tracker.efforts) || [];
  const ranked = efforts
    .filter((effort) => !effort.nuked && !isPrivateBuild(effort))
    .map((effort) => ({ effort, ...scoreEffort(effort) }))
    .sort((a, b) => b.score - a.score || (b.effort.stats?.stars || 0) - (a.effort.stats?.stars || 0));
  ranked.forEach((item, index) => {
    item.rank = index + 1;
  });

  const privateBuilds = efforts
    .filter((effort) => !effort.nuked && isPrivateBuild(effort))
    .map((effort) => ({ effort, ...scoreEffort(effort) }));

  const watchlist = efforts
    .filter((effort) => !effort.nuked && effort.tier === 'watchlist')
    .map((effort) => ({ effort, ...scoreEffort(effort) }));

  const nuked = efforts
    .filter((effort) => effort.nuked)
    .map((effort) => ({ effort, ...scoreEffort(effort) }));

  return { ranked, privateBuilds, watchlist, nuked };
}

function sortRaceItems(items, mode) {
  const list = items.slice();
  if (mode === 'stars') {
    list.sort((a, b) => (b.effort.stats?.stars || 0) - (a.effort.stats?.stars || 0));
  } else if (mode === 'active') {
    list.sort(
      (a, b) =>
        Date.parse(b.effort.stats?.pushedAt || 0) - Date.parse(a.effort.stats?.pushedAt || 0)
    );
  } else {
    list.sort((a, b) => b.score - a.score || (b.effort.stats?.stars || 0) - (a.effort.stats?.stars || 0));
  }
  return list;
}

function raceCard(entry, kind) {
  const effort = entry.effort;
  const repo = typeof effort.repo === 'string' ? effort.repo : '';
  const branch = effort.branch || 'main';
  const label = effort.name || (repo ? repo.split('/')[1] : effort.id);
  const target = effort.target || '';
  const approach = effort.approach || '';
  const stars = effort.stats?.stars || 0;
  const pushed = effort.stats?.pushedAt;
  const verified = effort.verification === 'verified' ? t('race.verified') : t('race.self');
  const privateBuild = kind === 'private';
  const nuked = kind === 'nuked';
  const note = nuked && effort.nuked && effort.nuked.note ? effort.nuked.note : '';
  const summary = note || effort.summary || '';
  const highlight = !note && Array.isArray(effort.highlights) && effort.highlights.length ? effort.highlights[0] : '';
  const based = privateBuild ? basedOnNames(effort) : '';
  const downloadLabel = t('race.download');
  const scoreText = privateBuild ? t('race.notRanked') : `${formatScore(entry.score)}<em>%</em>`;

  const badges = [];
  if (target) {
    badges.push(`<span class="race-badge${/gta/i.test(target) ? ' is-gta' : ''}">${esc(target)}</span>`);
  }
  if (approach) badges.push(`<span class="race-badge">${esc(approach)}</span>`);
  if (effort.tier === 'watchlist') badges.push(`<span class="race-badge is-watch">${t('race.watch')}</span>`);
  if (privateBuild) badges.push(`<span class="race-badge is-private">${t('race.private')}</span>`);
  if (nuked) badges.push(`<span class="race-badge is-nuked">${t('race.offline')}</span>`);

  return `
    <article class="race-card${privateBuild ? ' is-private' : ''}${nuked ? ' is-nuked' : ''}" data-id="${esc(effort.id)}">
      <div class="race-rank">${entry.rank ? pad(entry.rank) : '—'}</div>
      <div class="race-main">
        <div class="race-title-row">
          <b class="race-name">${esc(effort.name)}</b>
          ${badges.join('')}
        </div>
        ${summary ? `<p class="race-summary">${esc(summary)}</p>` : ''}
        ${highlight ? `<p class="race-hl"><span aria-hidden="true">›</span>${esc(highlight)}</p>` : ''}
        ${based ? `<p class="race-hl"><span aria-hidden="true">↳</span>${esc(t('race.basedOn', { names: based }))}</p>` : ''}
        <div class="race-meta">
          <span><svg class="ic"><use href="#i-star"></use></svg>${stars}</span>
          ${pushed ? `<span>${esc(t('dl.updated', { when: fmtDate(pushed) }))}</span>` : ''}
          <span class="race-verif">${esc(verified)}</span>
        </div>
      </div>
      <div class="race-side">
        <b class="race-score${privateBuild ? ' is-plain' : ''}">${scoreText}</b>
        <span class="race-stage">${esc(stageLabel(entry.reached))}</span>
        <div class="race-mini-bar"><i style="width:${privateBuild || nuked ? 0 : Math.min(100, entry.score)}%"></i></div>
        <div class="race-actions">
          ${
            repo && !nuked
              ? `<button class="mini-btn" type="button" data-dl-repo="${esc(repo)}" data-dl-branch="${esc(branch)}" data-dl-name="${esc(label)}" data-dl-label="${esc(label)}">${downloadLabel}</button>`
              : ''
          }
          ${
            repo && !nuked
              ? `<button class="icon-btn" type="button" data-external="https://github.com/${esc(repo)}" title="${esc(t('race.link'))}" aria-label="${esc(t('race.link'))}"><svg class="ic"><use href="#i-external"></use></svg></button>`
              : ''
          }
        </div>
      </div>
    </article>
  `;
}

function raceGroup(title, note, items, kind) {
  if (!items.length) return '';
  return `
    <section class="race-group">
      <div class="race-group-head">
        <h3>${esc(title)}</h3>
        <span>${items.length}</span>
      </div>
      ${note ? `<p class="race-group-note">${esc(note)}</p>` : ''}
      <div class="race-cards">${items.map((item) => raceCard(item, kind)).join('')}</div>
    </section>
  `;
}

function renderRace() {
  const list = $('#raceList');
  if (!list) return;

  const data = buildRaceData();
  const summary = overall((state.tracker && state.tracker.efforts) || []);
  const meta = state.trackerMeta;

  const set = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
  };
  set('#raceOverall', state.tracker ? `${formatScore(summary.score)}%` : '—');
  set('#raceTop3', state.tracker ? `${formatScore(summary.top3)}%` : '—');
  set('#raceFurthest', state.tracker ? stageLabel(summary.furthest.key) : '—');
  set('#raceTracked', state.tracker ? String(state.tracker.efforts.length) : '—');
  set('#raceUpdated', meta && meta.updated ? fmtTime(meta.updated) : '—');

  $$('#raceFilters .chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.filter === state.filter);
  });
  const sortSelect = $('#raceSort');
  if (sortSelect) sortSelect.value = state.sort;

  if (!state.tracker) {
    list.innerHTML = state.trackerLoading
      ? `<p class="empty-note">${esc(t('race.loading'))}</p>`
      : `<p class="empty-note">${esc(t('race.error'))}${state.trackerError ? ` · ${esc(state.trackerError)}` : ''}</p>`;
  } else {
    const ranked = sortRaceItems(data.ranked, state.sort);
    const privateBuilds = sortRaceItems(data.privateBuilds, state.sort);
    const watchlist = sortRaceItems(data.watchlist, state.sort);
    const nuked = data.nuked;

    const groups = [];
    if (state.filter === 'all' || state.filter === 'gta' || state.filter === 'generic') {
      const filtered =
        state.filter === 'gta'
          ? ranked.filter((item) => /gta/i.test(item.effort.target || ''))
          : state.filter === 'generic'
            ? ranked.filter((item) => !/gta/i.test(item.effort.target || ''))
            : ranked;
      const title =
        state.filter === 'gta' ? t('race.gta') : state.filter === 'generic' ? t('race.generic') : t('race.tracked');
      groups.push(raceGroup(title, '', filtered, 'ranked'));
    }
    if (state.filter === 'all' || state.filter === 'private') {
      groups.push(raceGroup(t('race.privateTitle'), t('race.privateNote'), privateBuilds, 'private'));
    }
    if (state.filter === 'all' || state.filter === 'watch') {
      groups.push(raceGroup(t('race.watchTitle'), t('race.watchNote'), watchlist, 'watch'));
    }
    if (state.filter === 'all') {
      groups.push(raceGroup(t('race.offline'), '', nuked, 'nuked'));
    }

    list.innerHTML = groups.filter(Boolean).join('') || `<p class="empty-note">${esc(t('race.empty'))}</p>`;
  }

  const note = $('#raceNote');
  if (note) {
    if (!meta) {
      note.textContent = '';
    } else {
      const parts = [t('home.updatedAgo', { when: fmtDate(meta.updated) })];
      if (meta.cached) parts.push(t('home.cache'));
      if (meta.stale) parts.push(t('home.stale'));
      note.textContent = parts.join(' · ');
    }
  }
}

/* =========================================================================
   DOWNLOADS
   ========================================================================= */

function projectItems() {
  const efforts = (state.tracker && state.tracker.efforts) || [];
  return efforts
    .filter((effort) => !effort.nuked && typeof effort.repo === 'string' && effort.repo.includes('/'))
    .map((effort) => {
      const label = effort.name || effort.id;
      return {
        kind: 'project',
        key: effort.repo,
        repo: effort.repo,
        branch: effort.branch || 'main',
        label,
        folder: safeFolder(label),
        stars: effort.stats?.stars || 0,
        pushedAt: effort.stats?.pushedAt || null,
        owner: effort.repo.split('/')[0],
        description: effort.summary || '',
      };
    });
}

function forkItems() {
  return state.forks.map((fork) => {
    const fullName = fork.fullName || `${fork.owner}/${fork.name}`;
    return {
      kind: 'fork',
      key: fullName,
      repo: fullName,
      branch: fork.branch || 'main',
      label: fork.name || fullName.split('/')[1],
      folder: safeFolder(fullName.replace('/', '-')),
      stars: fork.stars || 0,
      pushedAt: fork.pushedAt || null,
      owner: fork.owner || fullName.split('/')[0],
      description: fork.description || '',
      archived: Boolean(fork.archived),
    };
  });
}

function allDownloadItems() {
  return [...projectItems(), ...forkItems()];
}

function downloadedSet() {
  return new Set((state.downloads.items || []).map((item) => String(item.name || '').toLowerCase()));
}

function isDownloaded(folder) {
  return downloadedSet().has(String(folder || '').toLowerCase());
}

function matchesQuery(item, query) {
  if (!query) return true;
  return `${item.label} ${item.repo} ${item.owner}`.toLowerCase().includes(query);
}

function downloadRow(item) {
  const progress = state.downloading.get(item.repo);
  const done = isDownloaded(item.folder);
  const percent = progress ? Math.min(100, Math.round(Number(progress.percent) || 0)) : 0;

  let action;
  if (progress) {
    const label = progress.phase === 'extract' ? t('dl.extract') : `${t('dl.downloading')} ${percent}%`;
    action = `<button class="mini-btn dl-action" type="button" disabled>${esc(label)}</button>`;
  } else if (done) {
    action = `<button class="mini-btn dl-action is-done" type="button" data-open-folder="${esc(item.folder)}">${esc(t('dl.openFolder'))}</button>`;
  } else {
    action = `<button class="mini-btn dl-action" type="button" data-dl-repo="${esc(item.repo)}" data-dl-branch="${esc(item.branch)}" data-dl-name="${esc(item.folder)}" data-dl-label="${esc(item.label)}">${esc(t('dl.download'))}</button>`;
  }

  const pushed = item.pushedAt ? ` · ${t('dl.updated', { when: fmtDate(item.pushedAt) })}` : '';
  const archived = item.archived ? ` · ${t('race.offline')}` : '';

  return `
    <div class="dl-row" data-repo="${esc(item.repo)}">
      <span class="dl-ico" aria-hidden="true"><svg class="ic"><use href="#${item.kind === 'fork' ? 'i-code' : 'i-folder'}"></use></svg></span>
      <div class="dl-copy">
        <div class="dl-title">
          <b>${esc(item.label)}</b>
          <span class="dl-badge">${esc(item.kind === 'fork' ? t('dl.forksCount') : t('dl.projects'))}</span>
        </div>
        <small>${esc(item.repo)} · ${esc(item.branch)} · ${item.stars}★${esc(pushed)}${esc(archived)}</small>
        <div class="dl-progress"${progress ? '' : ' hidden'}><i style="width:${percent}%"></i></div>
      </div>
      ${action}
    </div>
  `;
}

function renderDownloadList(root, items, emptyKey) {
  if (!root) return;
  if (!items.length) {
    root.innerHTML = `<p class="empty-note">${esc(t(emptyKey))}</p>`;
    return;
  }
  root.innerHTML = items.map(downloadRow).join('');
}

function renderDownloads() {
  const query = state.dlQuery.trim().toLowerCase();
  const projects = projectItems();
  const forks = forkItems();
  const visibleProjects = projects.filter((item) => matchesQuery(item, query));
  const visibleForks = forks.filter((item) => matchesQuery(item, query));

  renderDownloadList(
    $('#dlProjects'),
    visibleProjects,
    state.tracker ? 'dl.empty' : state.trackerLoading ? 'race.loading' : 'race.error'
  );
  renderDownloadList(
    $('#dlForks'),
    visibleForks,
    state.forks.length ? 'dl.empty' : state.forksLoading ? 'race.loading' : 'dl.empty'
  );

  const count = (visible, total) => (query ? `${visible} / ${total}` : String(total));
  const projectsCount = $('#dlProjectsCount');
  if (projectsCount) projectsCount.textContent = state.tracker ? count(visibleProjects.length, projects.length) : '—';
  const forksCount = $('#dlForksCount');
  if (forksCount) forksCount.textContent = state.forks.length ? count(visibleForks.length, forks.length) : '—';
  const total = $('#dlTotal');
  if (total) total.textContent = t('dl.count', { n: visibleProjects.length + visibleForks.length });

  const dir = state.config.downloadsDir || state.downloads.dir || '—';
  const dirEl = $('#dlDir');
  if (dirEl) dirEl.textContent = dir;
  const settingsDir = $('#settingsDlDir');
  if (settingsDir) settingsDir.textContent = dir;

  const pill = $('#dlCountPill');
  if (pill) pill.textContent = projects.length || forks.length ? String(projects.length + forks.length) : '—';
  const homeProjects = $('#homeProjects');
  if (homeProjects) homeProjects.textContent = state.tracker ? String(projects.length) : '—';
  const homeForks = $('#homeForks');
  if (homeForks) homeForks.textContent = state.forks.length ? String(forks.length) : '—';
}

async function loadDownloads() {
  if (IS_DESKTOP) {
    try {
      const result = await window.portwatch.downloads();
      if (result && result.ok) {
        state.downloads = {
          dir: result.dir || state.config.downloadsDir || '',
          items: Array.isArray(result.items) ? result.items : [],
        };
      }
    } catch {
      /* lista é opcional */
    }
  } else {
    state.downloads = {
      dir: state.config.downloadsDir || state.downloads.dir || '',
      items: state.downloads.items || [],
    };
  }
  renderDownloads();
}

function syncDownloadButton(repo) {
  const progress = state.downloading.get(repo);
  if (!progress) return;
  const percent = Math.min(100, Math.round(Number(progress.percent) || 0));
  const label = progress.phase === 'extract' ? t('dl.extract') : `${t('dl.downloading')} ${percent}%`;

  $$('[data-dl-repo]').forEach((btn) => {
    if (btn.dataset.dlRepo !== repo) return;
    btn.disabled = true;
    btn.textContent = label;
  });

  $$('.dl-row').forEach((row) => {
    if (row.dataset.repo !== repo) return;
    const bar = row.querySelector('.dl-progress');
    const fill = row.querySelector('.dl-progress i');
    if (bar) bar.hidden = false;
    if (fill) fill.style.width = `${percent}%`;
    const btn = row.querySelector('.dl-action');
    if (btn && btn.disabled) btn.textContent = label;
  });
}

function handleDownloadProgress(payload) {
  if (!payload || !payload.repo) return;
  if (payload.phase === 'done' || payload.phase === 'error') {
    state.downloading.delete(payload.repo);
    renderDownloads();
    renderRace();
    return;
  }
  state.downloading.set(payload.repo, payload);
  syncDownloadButton(payload.repo);
}

async function startDownload(item) {
  if (!item || !item.repo) return;
  if (!IS_DESKTOP) {
    toast(t('toast.downloadDesktop'), 'warn');
    return;
  }
  if (state.downloading.has(item.repo) || state.picking.has(item.repo)) return;

  let targetDir = null;
  if (item.kind === 'fork') {
    state.picking.add(item.repo);
    try {
      const picked = await window.portwatch.pickDownloadDir();
      if (!picked || !picked.ok || !picked.dir) return;
      targetDir = picked.dir;
    } catch {
      toast(t('toast.pickFolderError'), 'bad');
      return;
    } finally {
      state.picking.delete(item.repo);
    }
  }
  if (state.downloading.has(item.repo)) return;

  state.downloading.set(item.repo, { repo: item.repo, phase: 'download', percent: 0 });
  syncDownloadButton(item.repo);
  toast(t('toast.downloadStarted', { name: item.label }), 'ok', 2200);

  try {
    const result = await window.portwatch.download({
      repo: item.repo,
      branch: item.branch,
      name: item.folder || safeFolder(item.label),
      dir: targetDir || undefined,
    });
    if (!result || !result.ok) {
      throw new Error((result && result.detail) || t('dl.toastError', { name: item.label }));
    }
    await loadDownloads();
    toast(t('toast.downloadDone', { name: item.label }));
  } catch (err) {
    toast(t('toast.downloadError', { name: item.label }), 'bad');
    showDialog({
      title: t('dlg.downloadTitle'),
      message: t('dlg.downloadMsg'),
      detail: String(err && err.message ? err.message : err),
    });
  } finally {
    state.downloading.delete(item.repo);
    renderDownloads();
    renderRace();
  }
}

function findDownloadItem(repo) {
  return allDownloadItems().find((item) => item.repo === repo) || null;
}

async function openDownloadsFolder() {
  if (!IS_DESKTOP) {
    toast(t('toast.openDesktop'), 'warn');
    return;
  }
  const result = await window.portwatch.openPath('downloads');
  if (result && result.ok === false) {
    toast(result.missing ? t('toast.folderMissing') : t('toast.folderError'), 'warn');
  }
}

async function openDownloaded(folder) {
  if (!IS_DESKTOP) {
    toast(t('toast.openDesktop'), 'warn');
    return;
  }
  const result = await window.portwatch.openDownload(folder);
  if (result && result.ok === false) {
    toast(result.missing ? t('toast.folderMissing') : t('toast.folderError'), 'warn');
  }
}

async function chooseDownloadsDir() {
  if (!IS_DESKTOP) {
    toast(t('toast.openDesktop'), 'warn');
    return;
  }
  const result = await window.portwatch.chooseDownloadsDir();
  if (result && result.ok) {
    state.config.downloadsDir = result.dir;
    state.downloads.dir = result.dir;
    if (draft) draft.downloadsDir = result.dir;
    applyStateToUI();
    renderDownloads();
  }
}

function openExternal(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return;
  if (IS_DESKTOP) window.portwatch.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}

function onListClick(event) {
  const downloadBtn = event.target.closest('[data-dl-repo]');
  if (downloadBtn) {
    const repo = downloadBtn.dataset.dlRepo;
    const item =
      findDownloadItem(repo) || {
        repo,
        branch: downloadBtn.dataset.dlBranch || 'main',
        label: downloadBtn.dataset.dlLabel || repo,
        folder: downloadBtn.dataset.dlName || safeFolder(repo.split('/')[1]),
      };
    startDownload(item);
    return;
  }

  const openBtn = event.target.closest('[data-open-folder]');
  if (openBtn) {
    openDownloaded(openBtn.dataset.openFolder);
    return;
  }

  const externalBtn = event.target.closest('[data-external]');
  if (externalBtn) {
    openExternal(externalBtn.dataset.external);
  }
}

/* =========================================================================
   SOBRE
   ========================================================================= */

function renderAbout() {
  const version = $('#aboutVersion');
  if (version) version.textContent = `v${state.appVersion}`;

  const efforts = $('#aboutEfforts');
  if (efforts) efforts.textContent = state.tracker ? String(state.tracker.efforts.length) : '—';
  const forks = $('#aboutForks');
  if (forks) forks.textContent = state.forks.length ? String(state.forks.length) : '—';
  const language = $('#aboutLang');
  if (language) language.textContent = languageLabel(state.config.language || currentLanguage());
  const dir = $('#aboutDownloads');
  if (dir) dir.textContent = state.config.downloadsDir || state.downloads.dir || '—';
  const refresh = $('#aboutRefresh');
  if (refresh) refresh.textContent = `${state.config.refreshMinutes || 5} min`;
}

/* =========================================================================
   FOLHAS / NAVEGAÇÃO
   ========================================================================= */

function openView(view) {
  const meta = VIEW_META[view];
  if (!meta) return;

  if (activeView === 'settings' && view !== 'settings') {
    draft = null;
    applyStateToUI();
  }

  activeView = view;
  lastFocus = document.activeElement;
  document.body.dataset.view = view;

  if (view === 'settings') {
    draft = { ...state.config };
    syncControlsFrom(draft);
  } else {
    draft = null;
  }

  $('#sheetKicker').textContent = t(meta.kickerKey);
  $('#sheetTitle').textContent = t(meta.titleKey);
  $('#sheetFoot').hidden = !meta.footer;

  $$('.view').forEach((item) => item.classList.toggle('is-active', item.dataset.view === view));
  $$('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.nav === view));

  const body = $('#sheetBody');
  if (body) body.scrollTop = 0;

  const overlay = $('#overlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');

  if (view === 'hardware') ensureHardware();
  if (view === 'race') {
    renderRace();
    if (!state.tracker && !state.trackerLoading) fetchRace();
  }
  if (view === 'downloads') {
    renderDownloads();
    if (!state.tracker && !state.trackerLoading) fetchRace();
    if (!state.forks.length && !state.forksLoading) fetchForks();
    if (IS_DESKTOP) loadDownloads();
  }
  if (view === 'about') renderAbout();

  window.setTimeout(() => {
    const close = $('#sheetClose');
    if (close) close.focus({ preventScroll: true });
  }, 60);
}

function closeSheet() {
  if (activeView === 'settings' && draft) {
    draft = null;
    applyStateToUI();
  }

  activeView = null;
  const overlay = $('#overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  delete document.body.dataset.view;
  $$('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.nav === 'home'));

  if (lastFocus && typeof lastFocus.focus === 'function') {
    lastFocus.focus({ preventScroll: true });
  }
  lastFocus = null;
}

/* =========================================================================
   DIÁLOGO
   ========================================================================= */

function showDialog({ title, message, detail } = {}) {
  const layer = $('#dialog');
  if (!layer) return;
  $('#dlgTitle').textContent = title || t('dlg.attention');
  $('#dlgMsg').textContent = message || '';
  const detailEl = $('#dlgDetail');
  detailEl.hidden = !detail;
  detailEl.textContent = detail || '';

  const actions = $('#dlgActions');
  actions.textContent = '';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-primary';
  close.textContent = t('dlg.close');
  close.addEventListener('click', closeDialog);
  actions.appendChild(close);

  layer.classList.add('open');
  layer.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => close.focus({ preventScroll: true }), 50);
}

function closeDialog() {
  const layer = $('#dialog');
  if (!layer) return;
  layer.classList.remove('open');
  layer.setAttribute('aria-hidden', 'true');
}

function isDialogOpen() {
  const layer = $('#dialog');
  return Boolean(layer && layer.classList.contains('open'));
}

/* =========================================================================
   IDIOMA
   ========================================================================= */

function isLanguageOpen() {
  const layer = $('#langLayer');
  return Boolean(layer && layer.classList.contains('open'));
}

function showLanguageChooser() {
  const layer = $('#langLayer');
  if (!layer) return;
  layer.classList.add('open');
  layer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('choosing-lang');
  window.setTimeout(() => {
    const first = layer.querySelector('[data-lang="pt-BR"]');
    if (first) first.focus({ preventScroll: true });
  }, 140);
}

function hideLanguageChooser() {
  const layer = $('#langLayer');
  if (!layer) return;
  layer.classList.remove('open');
  layer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('choosing-lang');
}

async function chooseStartupLanguage(lang) {
  if (!LANGUAGES[lang]) return;

  try {
    state.config = await persist({ language: lang });
  } catch {
    toast(t('toast.saveError'), 'bad');
  }

  if (draft) draft.language = lang;
  setLanguage(lang);
  applyI18n();
  applyStateToUI();
  renderAllData();
  hideLanguageChooser();
  blip({ freq: 680, slide: 1.35, dur: 0.09, gain: 0.015, type: 'triangle' });
  toast(t('toast.language'));

  if (state.config.radioOn && !audio.radioOn) startRadio({ quiet: true });
}

async function changeLanguage(lang) {
  if (!LANGUAGES[lang]) return;
  try {
    state.config = await persist({ language: lang });
  } catch {
    toast(t('toast.saveError'), 'bad');
    return;
  }
  if (draft) draft.language = lang;
  setLanguage(lang);
  applyI18n();
  applyStateToUI();
  renderAllData();
  toast(t('toast.language'));
}

/* =========================================================================
   AJUSTES
   ========================================================================= */

function syncDraftToControls() {
  if (!draft) return;
  syncControlsFrom(draft);
  const dir = draft.downloadsDir || state.downloads.dir || '—';
  const el = $('#settingsDlDir');
  if (el) el.textContent = dir;
  updateSlider($('[data-bind="musicVolume"]'));
}

function openSettingsDraft() {
  draft = { ...state.config };
  syncDraftToControls();
}

async function saveSettings() {
  if (!draft) return;
  const patch = { ...draft };
  if (!patch.language) patch.language = state.config.language || currentLanguage();

  try {
    state.config = await persist(patch);
    draft = null;
    setLanguage(state.config.language || 'pt-BR');
    applyI18n();
    applyStateToUI();
    renderAllData();
    if (state.config.radioOn) resumeRadioIfEnabled();
    else if (audio.radioOn) stopRadio();
    restartRefreshTimer();
    closeSheet();
    toast(t('toast.saved'));
    blip({ freq: 620, slide: 1.5, dur: 0.09, gain: 0.015, type: 'triangle' });
  } catch {
    toast(t('toast.saveError'), 'bad');
  }
}

function resetSettingsDraft() {
  draft = {
    ...state.defaults,
    language: state.config.language,
    radioStation: state.config.radioStation,
  };
  syncDraftToControls();
  applyTheme(draft.theme);
  document.body.classList.toggle('reduce-motion', Boolean(draft.reduceMotion));
  applyMusicVolume();
  toast(t('toast.defaults'), 'warn');
}

function restartRefreshTimer() {
  if (refreshTimer) window.clearInterval(refreshTimer);
  const minutes = Math.max(1, Number(state.config.refreshMinutes) || 5);
  refreshTimer = window.setInterval(() => {
    refreshAll({ force: true, silent: true });
  }, minutes * 60 * 1000);
}

/* =========================================================================
   EVENTOS
   ========================================================================= */

function bindWindowControls() {
  const fallback = () => toast(t('toast.windowDesktop'), 'warn');

  const min = $('#winMin');
  if (min) min.addEventListener('click', () => (IS_DESKTOP ? window.portwatch.win.minimize() : fallback()));
  const max = $('#winMax');
  if (max) max.addEventListener('click', () => (IS_DESKTOP ? window.portwatch.win.toggleMaximize() : fallback()));
  const close = $('#winClose');
  if (close) close.addEventListener('click', () => (IS_DESKTOP ? window.portwatch.win.close() : fallback()));

  const titlebar = $('#titlebar');
  if (titlebar) {
    titlebar.addEventListener('dblclick', (event) => {
      if (!IS_DESKTOP) return;
      if (event.target.closest('button')) return;
      window.portwatch.win.toggleMaximize();
    });
  }
}

function bindNavigation() {
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const nav = tab.dataset.nav;
      if (nav === 'home') closeSheet();
      else openView(nav);
    });
  });

  const profile = $('#profileBtn');
  if (profile) profile.addEventListener('click', () => openView('about'));

  const close = $('#sheetClose');
  if (close) close.addEventListener('click', closeSheet);
  const cancel = $('#sheetCancel');
  if (cancel) cancel.addEventListener('click', closeSheet);

  const overlay = $('#overlay');
  if (overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeSheet();
    });
  }

  const dialog = $('#dialog');
  if (dialog) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });
  }
}

function bindHero() {
  const race = $('#raceBtn');
  if (race) race.addEventListener('click', () => openView('race'));
  const homeRace = $('#homeRace');
  if (homeRace) homeRace.addEventListener('click', () => openView('race'));

  const site = $('#siteBtn');
  if (site) site.addEventListener('click', () => openExternal(state.site));
  const homeSite = $('#homeSite');
  if (homeSite) homeSite.addEventListener('click', () => openExternal(state.site));

  const downloads = $('#downloadsBtn');
  if (downloads) downloads.addEventListener('click', () => openView('downloads'));
  const homeDownloads = $('#homeDownloads');
  if (homeDownloads) homeDownloads.addEventListener('click', () => openView('downloads'));

  const refresh = $('#homeRefresh');
  if (refresh) refresh.addEventListener('click', () => refreshAll({ force: true }));
}

function bindRace() {
  const filters = $('#raceFilters');
  if (filters) {
    filters.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-filter]');
      if (!chip) return;
      state.filter = chip.dataset.filter;
      renderRace();
      blip({ freq: 980, dur: 0.04, gain: 0.01, type: 'triangle' });
    });
  }

  const sort = $('#raceSort');
  if (sort) {
    sort.addEventListener('change', () => {
      state.sort = sort.value;
      renderRace();
    });
  }

  const refresh = $('#raceRefreshBtn');
  if (refresh) refresh.addEventListener('click', () => refreshAll({ force: true }));

  const site = $('#raceSiteBtn');
  if (site) site.addEventListener('click', () => openExternal(state.site));

  const list = $('#raceList');
  if (list) list.addEventListener('click', onListClick);
}

function bindDownloads() {
  const search = $('#dlSearch');
  if (search) {
    search.addEventListener('input', () => {
      state.dlQuery = search.value;
      renderDownloads();
    });
  }

  const refresh = $('#dlRefreshBtn');
  if (refresh) {
    refresh.addEventListener('click', async () => {
      await refreshAll({ force: true, silent: true });
      await loadDownloads();
      toast(t('toast.raceUpdated', { count: (state.tracker && state.tracker.efforts.length) || 0 }));
    });
  }

  const choose = $('#dlChoose');
  if (choose) choose.addEventListener('click', chooseDownloadsDir);
  const open = $('#dlOpen');
  if (open) open.addEventListener('click', openDownloadsFolder);

  const projects = $('#dlProjects');
  if (projects) projects.addEventListener('click', onListClick);
  const forks = $('#dlForks');
  if (forks) forks.addEventListener('click', onListClick);

  const settingsChoose = $('#settingsChooseDir');
  if (settingsChoose) settingsChoose.addEventListener('click', chooseDownloadsDir);
  const settingsOpen = $('#settingsOpenDir');
  if (settingsOpen) settingsOpen.addEventListener('click', openDownloadsFolder);
}

function bindSettings() {
  $$('[data-theme-choice]').forEach((btn) => {
    btn.addEventListener('click', () => setTheme(btn.dataset.themeChoice));
  });

  $$('[data-bind]').forEach((el) => {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';

    const eventName = el.type === 'range' ? 'input' : 'change';
    el.addEventListener(eventName, () => {
      if (!draft) return;
      const key = el.dataset.bind;

      if (key === 'language') {
        changeLanguage(el.value);
        return;
      }

      if (el.type === 'checkbox') draft[key] = el.checked;
      else if (el.type === 'range') {
        draft[key] = Number(el.value);
        updateSlider(el);
        if (key === 'musicVolume') applyMusicVolume();
      } else {
        draft[key] = el.value;
      }

      if (key === 'radioOn') {
        rememberRadio(el.checked);
        if (el.checked) startRadio();
        else stopRadio();
      }
      if (key === 'reduceMotion') {
        document.body.classList.toggle('reduce-motion', Boolean(draft.reduceMotion));
      }
    });

    if (el.type === 'range') updateSlider(el);
  });

  const reset = $('#sheetReset');
  if (reset) reset.addEventListener('click', resetSettingsDraft);
  const save = $('#sheetSave');
  if (save) save.addEventListener('click', saveSettings);
}

function bindAbout() {
  const site = $('#aboutSiteBtn');
  if (site) site.addEventListener('click', () => openExternal(state.site));
  const repo = $('#aboutRepoBtn');
  if (repo) repo.addEventListener('click', () => openExternal(state.trackerRepo));
  const dir = $('#aboutOpenDir');
  if (dir) dir.addEventListener('click', openDownloadsFolder);
  const refresh = $('#aboutRefreshBtn');
  if (refresh) refresh.addEventListener('click', () => refreshAll({ force: true }));
}

function bindLanguage() {
  $$('#langLayer [data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => chooseStartupLanguage(btn.dataset.lang));
  });
}

function bindRadio() {
  const play = $('#radioPlay');
  if (play) play.addEventListener('click', toggleRadio);

  const picker = $('#radioPicker');
  if (picker) picker.addEventListener('click', toggleStationMenu);

  document.addEventListener('pointerdown', (event) => {
    if (!isStationMenuOpen()) return;
    if (!event.target.closest('#radioWrap')) closeStationMenu();
  });
}

function bindShortcuts() {
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    if (event.key === 'Escape') {
      if (isDialogOpen()) {
        closeDialog();
        return;
      }
      if (isStationMenuOpen()) {
        closeStationMenu({ focus: true });
        return;
      }
      if (activeView) closeSheet();
      return;
    }

    if (event.key === 'F11') {
      event.preventDefault();
      if (IS_DESKTOP) window.portwatch.win.toggleFullscreen();
      else toast(t('toast.windowDesktop'), 'warn');
      return;
    }

    if (typing || isLanguageOpen() || isDialogOpen()) return;

    if (event.key === 'Enter' && !activeView) {
      event.preventDefault();
      openView('race');
      return;
    }

    if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      refreshAll({ force: true });
    }
  });
}

function bindSounds() {
  let hovered = null;
  document.addEventListener(
    'pointerover',
    (event) => {
      if (!audio.ctx) return;
      const el = event.target.closest('button, .race-card, .dl-row');
      if (!el || el === hovered) return;
      hovered = el;
      blip({ freq: 1500, dur: 0.025, gain: 0.006, type: 'sine' });
    },
    true
  );
  document.addEventListener(
    'pointerout',
    (event) => {
      const el = event.target.closest('button, .race-card, .dl-row');
      if (el && el === hovered) hovered = null;
    },
    true
  );
  document.addEventListener(
    'click',
    (event) => {
      if (!event.target.closest('button')) return;
      blip({ freq: 760, slide: 1.25, dur: 0.07, gain: 0.011, type: 'triangle' });
    },
    true
  );
}

/* =========================================================================
   BOOT
   ========================================================================= */

async function boot() {
  await loadState();
  setLanguage(state.config.language || 'pt-BR');
  applyI18n();
  applyStateToUI();

  buildStars();
  buildSkylines();
  bindParallax();
  startClock();

  buildStationMenu();
  updateRadioUI();

  bindWindowControls();
  bindNavigation();
  bindHero();
  bindRace();
  bindDownloads();
  bindSettings();
  bindHardware();
  bindAbout();
  bindLanguage();
  bindShortcuts();
  bindRadio();
  bindSounds();

  if (IS_DESKTOP && window.portwatch.onDownloadProgress) {
    window.portwatch.onDownloadProgress(handleDownloadProgress);
  }

  renderRace();
  renderDownloads();
  restartRefreshTimer();

  document.body.classList.remove('is-loading');
  document.body.classList.add('ready');

  if (!state.config.language) showLanguageChooser();
  if (state.config.radioOn) {
    startRadio({ quiet: true });
    armAudioUnlock();
  }

  if (IS_DESKTOP) loadDownloads();
  await refreshAll({ force: false, silent: true });

  if (tickTimer) window.clearInterval(tickTimer);
  tickTimer = window.setInterval(() => {
    if (!state.trackerMeta || !state.trackerMeta.updated) return;
    renderHome();
    if (activeView === 'race') renderRace();
  }, 30000);
}

boot();
