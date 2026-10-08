// Data files are static JSON next to index.html. index.html also loads their script
// twins (data/*.js → window.PIXPAGE_DATA) so the gallery opens straight from disk,
// where fetch() is blocked. The edit API (`api/...`) exists only when a pixpage server
// is running (locally today; a small serverless function later).

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const preloaded = () => window.PIXPAGE_DATA || {};

// fresh=false: use the data that came with the page. fresh=true: re-fetch (live updates).
export async function loadGallery(fresh = false) {
  const pre = preloaded();
  if (!fresh && pre.media) return { media: pre.media, captions: pre.captions?.items || {}, gallery: pre.captions?.gallery || {} };
  const [media, captions] = await Promise.all([
    getJSON('data/media.json'),
    getJSON('data/captions.json').catch(() => pre.captions || { items: {} }),
  ]);
  return { media, captions: captions.items || {}, gallery: captions.gallery || {} };
}

export async function apiStatus() {
  try {
    const res = await fetch('api/status', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    return body && typeof body.version === 'number' ? body : null;
  } catch {
    return null;
  }
}

async function post(url, body, password) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pixpage-Password': password || '' },
    body: JSON.stringify(body),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const login = (password) => post('api/login', {}, password);

export const saveCaption = (password, id, caption) => post('api/captions', { id, ...caption }, password);

export const saveGallery = (password, gallery) => post('api/gallery', gallery, password);

export const session = {
  get(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch {
      /* storage unavailable: stay unlocked for this page view only */
    }
  },
};
