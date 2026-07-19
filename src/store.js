// State, persistence (IndexedDB with localStorage fallback), autosave, export/import.
const DB_NAME = 'manuskrip', DB_STORE = 'project', DB_KEY = 'current';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function blankProject() {
  const docId = uid();
  return {
    schemaVersion: 1,
    project: { id: uid(), title: 'Naskah Tanpa Judul', mode: 'prose', language: 'id' },
    tree: [
      { id: uid(), type: 'folder', title: 'Manuskrip', children: [
        { id: docId, type: 'document', title: 'Bab 1', children: [] },
      ]},
    ],
    documents: { [docId]: blankDoc() },
    cuts: [],
    snapshots: {},
    language: { vocabulary: [], ignoredFindings: [], disabledRules: [] },
    settings: {
      themeId: 'lontar',
      typography: { family: 'georgia', size: 18, leading: 1.7, measure: 66 },
      lastDocId: docId,
    },
  };
}

export function blankDoc() {
  return { body: '', synopsis: '', notes: '', pov: '', status: 'draft',
           targetWords: 0, ceilingWords: 0, align: 'left' };
}

function migrate(data) {
  if (!data || typeof data !== 'object' || !data.project) throw new Error('bukan berkas proyek Manuskrip');
  if (!data.schemaVersion) data.schemaVersion = 1;
  data.language ??= { vocabulary: [], ignoredFindings: [], disabledRules: [] };
  data.cuts ??= []; data.snapshots ??= {};
  return data;
}

// --- IndexedDB, tiny promise wrapper, localStorage fallback ---
function openDb() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(DB_STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbGet(key) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const rq = db.transaction(DB_STORE).objectStore(DB_STORE).get(key);
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
}
async function idbSet(key, val) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(val, key);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}

// generic key-value slots in the same store (custom fonts, about page, admin key)
// These are device/site-level and stay shared across users on this browser.
export const kvGet = (key) => idbGet('kv:' + key).catch(() => undefined);
export const kvSet = (key, val) => idbSet('kv:' + key, val).catch(() => {});

// --- per-user workspace scoping ---
// The project is stored under a key that depends on who is signed in, so each
// Google account gets its own manuscript. Guests use the legacy 'current' key.
let ACTIVE_KEY = DB_KEY;
export const projectKeyForUser = (sub) => (sub ? 'project:' + sub : DB_KEY);
export function setProjectKey(key) { ACTIVE_KEY = key || DB_KEY; }
export const getProjectAt = (key) => idbGet(key).catch(() => null);
export const putProjectAt = (key, val) => idbSet(key, val).catch(() => {});

export async function loadProject() {
  try {
    const data = await idbGet(ACTIVE_KEY);
    if (data) return migrate(data);
  } catch { /* fall through to localStorage */ }
  try {
    const raw = localStorage.getItem(DB_NAME + ':' + ACTIVE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch { /* corrupt or unavailable */ }
  return blankProject();
}

export async function saveProject(state) {
  try { await idbSet(ACTIVE_KEY, state); }
  catch { try { localStorage.setItem(DB_NAME + ':' + ACTIVE_KEY, JSON.stringify(state)); } catch { /* quota */ } }
}

// Debounced autosave with a dirty flag callback for the status bar.
let timer = null;
export function autosave(state, onState) {
  onState?.('dirty');
  clearTimeout(timer);
  timer = setTimeout(async () => { await saveProject(state); onState?.('saved'); }, 400);
}
export async function flush(state) { clearTimeout(timer); await saveProject(state); }

// --- tree helpers ---
export function findNode(nodes, id, parent = null) {
  for (const n of nodes) {
    if (n.id === id) return { node: n, parent, siblings: nodes };
    const hit = findNode(n.children || [], id, n);
    if (hit) return hit;
  }
  return null;
}
export function walkDocs(nodes, fn) {
  for (const n of nodes) {
    if (n.type === 'document') fn(n);
    walkDocs(n.children || [], fn);
  }
}

// --- export / import ---
export function exportJson(state) {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(state.project.title || 'budiasta').replace(/\s+/g, '_')}.budiasta.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
export async function importJson(file) {
  return migrate(JSON.parse(await file.text()));
}
