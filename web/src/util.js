// Show the wall-clock time the photo was taken, not the viewer's local conversion.
function wallClock(iso) {
  const m = iso && iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
const fullFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
});

export const formatDate = (iso) => {
  const d = wallClock(iso);
  return d ? dateFmt.format(d) : '';
};

export const formatDateTime = (iso) => {
  const d = wallClock(iso);
  return d ? fullFmt.format(d) : '';
};

export function formatRange(items) {
  const dates = items.map((it) => wallClock(it.taken)).filter(Boolean).sort((a, b) => a - b);
  if (!dates.length) return '';
  const a = dates[0];
  const b = dates[dates.length - 1];
  return dateFmt.formatRange ? dateFmt.formatRange(a, b) : `${dateFmt.format(a)} – ${dateFmt.format(b)}`;
}

export function formatDuration(sec) {
  if (!sec && sec !== 0) return '';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

// Search tokens: whitespace separated, with "quoted phrases" kept together.
export function tokenize(q) {
  const out = [];
  for (const m of (q || '').toLowerCase().matchAll(/"([^"]+)"|(\S+)/g)) out.push((m[1] || m[2]).trim());
  return out.filter(Boolean);
}

export const keywordQuery = (kw) => (/\s/.test(kw) ? `"${kw}"` : kw);

export function haystack(item) {
  return [
    item.description,
    (item.keywords || []).join(' '),
    item.name,
    formatDate(item.taken),
    item.camera?.model,
    item.type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

// Search words must all match (AND); selected tags widen the set (OR: any tag matches).
export function filterItems(items, q, t, k = []) {
  const tokens = tokenize(q);
  const tags = new Set(k.map((kw) => kw.toLowerCase()));
  return items.filter((it) => {
    if (t !== 'all' && it.type !== t) return false;
    if (tags.size && !(it.keywords || []).some((kw) => tags.has(kw.toLowerCase()))) return false;
    if (!tokens.length) return true;
    const hay = it._hay;
    return tokens.every((tok) => hay.includes(tok));
  });
}

export function normalizeKeywords(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const kw = String(raw).replace(/\s+/g, ' ').trim().replace(/^#/, '');
    if (!kw || seen.has(kw.toLowerCase())) continue;
    seen.add(kw.toLowerCase());
    out.push(kw);
  }
  return out;
}

// Small deterministic tilt per photo so prints look casually laid on a table.
export function tilt(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 3; // -1.5° .. 1.5°
}
