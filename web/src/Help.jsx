import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Close from '@mui/icons-material/Close';
import { PLACEHOLDERS } from './markdown.js';
import { serif } from './theme.js';

const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 };

function Section({ id, title, children }) {
  return (
    <Box component="section" id={`help-${id}`} sx={{ scrollMarginTop: 16, '& + &': { mt: 4 } }}>
      <Typography variant="h6" component="h3" sx={{ fontFamily: serif, mb: 1.25 }}>
        {title}
      </Typography>
      <Box sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.65, '& p': { m: '0 0 0.75em' }, '& ol, & ul': { m: '0 0 0.75em', pl: 2.5 }, '& li': { mb: 0.5 }, '& b': { color: 'text.primary', fontWeight: 600 } }}>
        {children}
      </Box>
    </Box>
  );
}

function Code({ children }) {
  return (
    <Box component="code" sx={{ ...mono, px: 0.6, py: 0.1, borderRadius: 0.75, bgcolor: 'action.hover', color: 'text.primary', whiteSpace: 'pre-wrap' }}>
      {children}
    </Box>
  );
}

function Table({ rows, head }) {
  return (
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', my: 1, '& th, & td': { textAlign: 'left', verticalAlign: 'top', py: 0.75, pr: 1.5, borderBottom: '1px solid', borderColor: 'divider' }, '& th': { color: 'text.primary', fontWeight: 600, fontSize: 12.5 } }}>
      {head && (
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
      )}
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a}>
            <td><Code>{a}</Code></td>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </Box>
  );
}

const MARKDOWN = [
  ['# Title', 'Large title (first one is also the page title)'],
  ['## Subtitle', 'Section heading'],
  ['###### Small caps', 'Small uppercase label, like the date line'],
  ['**bold**  *italic*', 'Emphasis'],
  ['[text](https://…)', 'Link (opens in a new tab)'],
  ['![alt](https://…/img.jpg)', 'Image'],
  ['- item', 'Bulleted list (1. for numbered)'],
  ['> quote', 'Pull quote'],
  ['---', 'Short divider line'],
  ['blank line', 'Starts a new paragraph'],
];

const KEYS = [
  ['/', 'Search'],
  ['← →', 'Previous / next on a photo page (or swipe)'],
  ['Esc', 'Back to the gallery'],
  ['E', 'Edit the open photo (editing unlocked)'],
  ['⌘/Ctrl + Enter', 'Save in any edit dialog'],
  ['?', 'Open this help'],
];

export function HelpDrawer({ open, section, onClose }) {
  useEffect(() => {
    if (open && section) {
      requestAnimationFrame(() => document.getElementById(`help-${section}`)?.scrollIntoView({ block: 'start' }));
    }
  }, [open, section]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 }, backgroundImage: 'none' } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" component="h2" sx={{ flex: 1 }}>
          Help
        </Typography>
        <IconButton onClick={onClose} aria-label="Close help">
          <Close />
        </IconButton>
      </Box>
      <Box sx={{ px: 3, py: 3, overflowY: 'auto' }}>
        <Section id="unlock" title="Unlock editing">
          <ol>
            <li>Click the <b>lock</b> icon in the top bar and enter the edit password.</li>
            <li>The icon turns into an <b>Editing</b> pill. Click it to lock again. Closing the tab also locks.</li>
          </ol>
          <p>
            The password is stored in AWS SSM. To set or change it, run:
          </p>
          <p><Code>aws ssm put-parameter --name /pixpage/edit-password --type SecureString --overwrite --value 'new-password'</Code></p>
          <p>The change takes effect within a minute, with no restart needed.</p>
        </Section>

        <Section id="header" title="Edit the gallery header">
          <ol>
            <li>Unlock editing, then click <b>Edit header</b> below the title.</li>
            <li>Write in Markdown on the left and watch the preview on the right (on phones, use the Write / Preview tabs).</li>
            <li>Click <b>Save</b> or press ⌘/Ctrl + Enter. <b>Reset to default</b> brings back the date, title and count.</li>
          </ol>
          <p>
            The first <Code># heading</Code> also becomes the title in the top bar and the browser tab.
          </p>
          <p>Placeholders fill themselves in and stay current as media is added:</p>
          <Table rows={PLACEHOLDERS} />
        </Section>

        <Section id="markdown" title="Markdown quick reference">
          <Table rows={MARKDOWN} />
          <p>Example:</p>
          <Box component="pre" sx={{ ...mono, m: 0, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', color: 'text.primary', whiteSpace: 'pre-wrap' }}>
            {'###### {{dates}}\n# Demo Day, New York\nIntel accelerator founders on stage — **{{counts}}**.\n\n> Three founders, one podium.'}
          </Box>
        </Section>

        <Section id="captions" title="Descriptions & keywords">
          <ul>
            <li>On the gallery, click <b>Add description</b> or the <b>✎</b> button on a print. On a photo page, click <b>Edit</b> or press <b>E</b>.</li>
            <li>The description can be as long as you like. The gallery shows two lines and the photo page shows all of it.</li>
            <li>To add a keyword, type it and press Enter or a comma. Earlier keywords are suggested as you type.</li>
          </ul>
        </Section>

        <Section id="search" title="Search">
          <ul>
            <li>Search looks through descriptions, keywords, file names, dates and camera names. Every word must match.</li>
            <li>Put phrases in quotes: <Code>"demo day"</Code>.</li>
            <li>Click a keyword chip to filter by it. Click it again in the keyword cloud to remove it.</li>
            <li>On a filtered list, ← and → move only through the results.</li>
          </ul>
        </Section>

        <Section id="media" title="Adding photos & videos">
          <p>
            While <Code>uv run pixpage.py &lt;folder&gt;</Code> is running, copy files into the source folder. They are processed and appear here
            within seconds, and so do removals. HEIC, JPEG, PNG, TIFF and WebP photos and MOV, MP4, M4V and AVI videos are supported.
          </p>
        </Section>

        <Divider sx={{ my: 4 }} />
        <Section id="keys" title="Keyboard shortcuts">
          <Table rows={KEYS} />
        </Section>
      </Box>
    </Drawer>
  );
}
