// Activity log: account id + action + time, kept in IndexedDB, capped, admin-viewable.
import { kvGet, kvSet } from './store.js';

let cache = null;
const CAP = 1000;

let remoteLogger = null;
export function setRemoteLogger(fn) { remoteLogger = fn; }

export async function logActivity(app, type, detail = '') {
  cache ??= (await kvGet('activity')) || [];
  cache.push({
    t: new Date().toISOString(),
    user: app.session ? `${app.session.email}` : 'tamu',
    sub: app.session?.sub || '',
    type,
    detail: String(detail).slice(0, 200),
  });
  if (cache.length > CAP) cache = cache.slice(-CAP);
  await kvSet('activity', cache);
  remoteLogger?.(cache[cache.length - 1]);
}

export async function getActivity() {
  cache ??= (await kvGet('activity')) || [];
  return cache;
}

export async function clearActivity() {
  cache = [];
  await kvSet('activity', []);
}

export function exportActivity(list) {
  const blob = new Blob([JSON.stringify(list, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'budiasta-aktivitas.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
