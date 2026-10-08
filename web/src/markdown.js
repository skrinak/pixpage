import { Marked } from 'marked';
import DOMPurify from 'dompurify';

// What the header shows until someone edits it — the same three lines the old
// iPhoto export had (date, title, count), now as editable Markdown.
export const DEFAULT_HEADER = '###### {{dates}}\n\n# {{title}}\n\n{{counts}}\n';

export const PLACEHOLDERS = [
  ['{{title}}', 'Source folder name'],
  ['{{dates}}', 'Date range of the media'],
  ['{{counts}}', 'e.g. “68 photos · 2 videos”'],
  ['{{photos}}', 'e.g. “68 photos”'],
  ['{{videos}}', 'e.g. “2 videos”'],
  ['{{count}}', 'Total number of items'],
];

const marked = new Marked({ gfm: true, breaks: true });

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') || '')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function fillPlaceholders(text, vars) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) => (name in vars ? vars[name] : m));
}

export function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text || ''), { ADD_ATTR: ['target'] });
}

// The first level-1 heading doubles as the page / toolbar title.
export function firstHeading(text) {
  const m = (text || '').match(/^#\s+(.+?)\s*#*\s*$/m);
  if (!m) return null;
  const plain = m[1].replace(/<[^>]*>/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim();
  return plain || null;
}
