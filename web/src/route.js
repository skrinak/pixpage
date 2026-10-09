import { useEffect, useState } from 'react';

// Hash routes keep the site fully static (works from S3 or file://):
//   #/?q=boat&t=video&k=Intel&k=KX   gallery: search words (all must match), media type,
//                                     and tags (k, any may match)
//   #/m/<id>?q=boat                   detail page; prev/next walk the filtered list
export function parseHash(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const params = new URLSearchParams(qs);
  const m = path.match(/^\/m\/(.+)$/);
  return {
    view: m ? 'detail' : 'gallery',
    id: m ? decodeURIComponent(m[1]) : null,
    q: params.get('q') || '',
    t: params.get('t') || 'all',
    k: params.getAll('k').filter(Boolean),
  };
}

export function buildHash({ view = 'gallery', id = null, q = '', t = 'all', k = [] }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (t && t !== 'all') params.set('t', t);
  for (const kw of k) params.append('k', kw);
  const qs = params.toString();
  const path = view === 'detail' && id ? `/m/${encodeURIComponent(id)}` : '/';
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(route, { replace = false } = {}) {
  const hash = buildHash(route);
  if (hash === window.location.hash) return;
  if (replace) {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash());
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
