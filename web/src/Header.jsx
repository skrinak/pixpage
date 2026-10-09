import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import RestartAlt from '@mui/icons-material/RestartAlt';
import { DEFAULT_HEADER, PLACEHOLDERS, fillPlaceholders, renderMarkdown } from './markdown.js';
import { serif } from './theme.js';

const proseSx = {
  textAlign: 'left',
  overflowWrap: 'anywhere',
  '& > :first-child': { mt: 0 },
  '& > :last-child': { mb: 0 },
  '& h1': {
    fontFamily: serif,
    fontWeight: 560,
    letterSpacing: '-0.015em',
    lineHeight: 1.15,
    fontSize: { xs: '1.8rem', sm: '2.1rem', md: '2.6rem' },
    m: '0.15em 0 0.35em',
    // One line on tablets and up; phones still wrap rather than cut the title off.
    whiteSpace: { sm: 'nowrap' },
    overflow: { sm: 'hidden' },
    textOverflow: { sm: 'ellipsis' },
  },
  '& h2': { fontFamily: serif, fontWeight: 560, fontSize: { xs: '1.35rem', md: '1.6rem' }, lineHeight: 1.25, m: '0.8em 0 0.4em' },
  '& h3': { fontFamily: serif, fontWeight: 600, fontSize: { xs: '1.1rem', md: '1.25rem' }, m: '0.8em 0 0.4em' },
  '& h4, & h5, & h6': {
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'text.secondary',
    m: '0 0 0.6em',
  },
  '& * + h4, & * + h5, & * + h6': { mt: '1.6em' },
  '& p': { color: 'text.secondary', fontSize: '0.95rem', lineHeight: 1.65, my: '0.6em' },
  '& strong': { color: 'text.primary', fontWeight: 600 },
  '& a': { color: 'primary.main', textUnderlineOffset: '3px' },
  '& ul, & ol': { color: 'text.secondary', my: '0.6em', pl: 3 },
  '& li': { my: 0.25 },
  '& blockquote': {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: '1.1rem',
    color: 'text.primary',
    mx: 0,
    pl: 2,
    borderLeft: '3px solid',
    borderColor: 'primary.main',
    my: '1em',
    '& p': { color: 'inherit', fontSize: 'inherit' },
  },
  '& hr': { border: 0, height: '1px', width: 72, bgcolor: 'divider', mx: 0, my: 3 },
  '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
  '& code': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.88em', px: 0.5, borderRadius: 0.5, bgcolor: 'action.hover' },
  // Statistics strip (a two-row Markdown table, see markdown.js): wraps on narrow screens.
  '& .stats': {
    display: { xs: 'grid', sm: 'flex' },
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    flexWrap: 'wrap',
    columnGap: { xs: 3, md: 7 },
    rowGap: 2.5,
    my: 3,
  },
  '& .stat': { maxWidth: { sm: 180 } },
  '& .stat-value': { fontFamily: serif, fontWeight: 560, fontSize: { xs: '1.9rem', md: '2.5rem' }, lineHeight: 1, color: 'text.primary', mb: 1 },
  '& .stat-label': { fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', lineHeight: 1.45 },
  '& table': { borderCollapse: 'collapse', my: 2, '& th, & td': { textAlign: 'left', px: 1.5, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' } },
};

export function HeaderMarkdown({ markdown, vars, sx }) {
  const html = useMemo(() => renderMarkdown(fillPlaceholders(markdown || DEFAULT_HEADER, vars)), [markdown, vars]);
  return <Box sx={[proseSx, ...(Array.isArray(sx) ? sx : [sx])]} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function HeaderDialog({ open, markdown, vars, onClose, onSave, onHelp }) {
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [text, setText] = useState('');
  const [tab, setTab] = useState('write');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    if (open) {
      setText(markdown || DEFAULT_HEADER);
      setTab('write');
      setError(null);
    }
  }, [open, markdown]);

  const insert = (snippet) => {
    const el = input.current;
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    setText(text.slice(0, start) + snippet + text.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      // Saving the untouched default stores nothing, so the default keeps tracking new media.
      const value = text.trim() === DEFAULT_HEADER.trim() ? '' : text.trim();
      await onSave(value);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const editor = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      <TextField
        inputRef={input}
        multiline
        minRows={fullScreen ? 12 : 16}
        maxRows={28}
        fullWidth
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        slotProps={{ input: { sx: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13.5, lineHeight: 1.6 } } }}
        aria-label="Header Markdown"
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
          Insert:
        </Typography>
        {PLACEHOLDERS.map(([ph, hint]) => (
          <Tooltip key={ph} title={`${hint} → ${fillPlaceholders(ph, vars)}`}>
            <Chip size="small" variant="outlined" label={ph} onClick={() => insert(ph)} sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }} />
          </Tooltip>
        ))}
      </Box>
    </Box>
  );

  const preview = (
    <Box
      sx={(theme) => ({
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: '#cce6f6',
        px: { xs: 2, md: 4 },
        py: { xs: 4, md: 6 },
        minHeight: 240,
        overflow: 'auto',
        ...theme.applyStyles('dark', { bgcolor: '#1a1917' }),
      })}
    >
      <HeaderMarkdown markdown={text || ' '} vars={vars} />
    </Box>
  );

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="lg" fullScreen={fullScreen}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          Edit gallery header
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Markdown — headings, paragraphs, links, lists, images. The first <code># heading</code> also becomes the page title.
          </Typography>
        </Box>
        <Button startIcon={<HelpOutlineRounded />} onClick={onHelp} sx={{ flexShrink: 0 }}>
          Help
        </Button>
      </DialogTitle>
      <DialogContent>
        {fullScreen ? (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab value="write" label="Write" />
              <Tab value="preview" label="Preview" />
            </Tabs>
            {tab === 'write' ? editor : preview}
          </>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, alignItems: 'start', pt: 1 }}>
            {editor}
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1, lineHeight: 1.4 }}>
                Preview
              </Typography>
              {preview}
            </Box>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button startIcon={<RestartAlt />} onClick={() => setText(DEFAULT_HEADER)} disabled={saving} sx={{ mr: 'auto' }}>
          Reset to default
        </Button>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} loading={saving} disableElevation>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
