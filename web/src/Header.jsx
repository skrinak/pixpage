import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
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

const SPLIT_KEY = 'pixpage.headerSplit';
const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function loadSplit() {
  try {
    const v = Number(window.localStorage.getItem(SPLIT_KEY));
    return v >= 20 && v <= 80 ? v : 50;
  } catch {
    return 50;
  }
}

// Draggable divider between two panes. Drag, use ←/→ when focused, or double-click to reset.
function SplitPane({ left, right }) {
  const [split, setSplit] = useState(loadSplit);
  const box = useRef(null);
  const dragging = useRef(false);

  const save = (v) => {
    try {
      window.localStorage.setItem(SPLIT_KEY, String(Math.round(v)));
    } catch {
      /* storage unavailable: split resets next time */
    }
  };
  const set = (v) => {
    const clamped = Math.min(80, Math.max(20, v));
    setSplit(clamped);
    save(clamped);
  };
  const onMove = (e) => {
    if (!dragging.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    set(((e.clientX - r.left) / r.width) * 100);
  };

  return (
    <Box ref={box} sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <Box sx={{ width: `${split}%`, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{left}</Box>
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize editor and preview"
        aria-valuenow={Math.round(split)}
        aria-valuemin={20}
        aria-valuemax={80}
        tabIndex={0}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={onMove}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onDoubleClick={() => set(50)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') set(split - 5);
          else if (e.key === 'ArrowRight') set(split + 5);
          else return;
          e.preventDefault();
        }}
        sx={{
          flex: '0 0 18px',
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          outline: 'none',
          '&::before': { content: '""', width: '1px', height: '100%', bgcolor: 'divider' },
          '& .grip': { position: 'absolute' },
          '&:hover .grip, &:focus-visible .grip, &:active .grip': { bgcolor: 'primary.main', borderColor: 'primary.main' },
          position: 'relative',
        }}
      >
        <Box
          className="grip"
          sx={{
            width: 8,
            height: 44,
            borderRadius: 4,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 1,
            transition: 'background-color .15s',
          }}
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{right}</Box>
    </Box>
  );
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

  const label = (children) => (
    <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 0.75, lineHeight: 1.4 }}>
      {children}
    </Typography>
  );

  const editor = (
    <>
      {!fullScreen && label('Markdown')}
      <Box
        component="textarea"
        ref={input}
        autoFocus
        spellCheck
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        aria-label="Header Markdown"
        sx={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          resize: 'none',
          p: 2,
          fontFamily: mono,
          fontSize: 13.5,
          lineHeight: 1.65,
          color: 'text.primary',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          outline: 'none',
          overflow: 'auto',
          '&:focus': { borderColor: 'primary.main', boxShadow: '0 0 0 3px rgba(44,95,93,.15)' },
        }}
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center', mt: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
          Insert:
        </Typography>
        {PLACEHOLDERS.map(([ph, hint]) => (
          <Tooltip key={ph} title={`${hint} → ${fillPlaceholders(ph, vars)}`}>
            <Chip size="small" variant="outlined" label={ph} onClick={() => insert(ph)} sx={{ fontFamily: mono, fontSize: 12 }} />
          </Tooltip>
        ))}
      </Box>
    </>
  );

  const preview = (
    <>
      {!fullScreen && label('Preview')}
      <Box
        sx={(theme) => ({
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: '#d3dce2',
          px: { xs: 2, md: 4 },
          py: { xs: 3, md: 4 },
          ...theme.applyStyles('dark', { bgcolor: '#1a1917' }),
        })}
      >
        {/* Let the preview wrap long titles instead of forcing the pane wider. */}
        <HeaderMarkdown markdown={text || ' '} vars={vars} sx={{ '& h1': { whiteSpace: { sm: 'normal' }, overflow: { sm: 'visible' } } }} />
      </Box>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="xl"
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { height: fullScreen ? '100%' : '92vh' } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          Edit gallery header
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Markdown: headings, paragraphs, links, lists, images. The first <code># heading</code> also becomes the page title.
            {!fullScreen && ' Drag the divider to resize.'}
          </Typography>
        </Box>
        <Button startIcon={<HelpOutlineRounded />} onClick={onHelp} sx={{ flexShrink: 0 }}>
          Help
        </Button>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, pb: 1 }}>
        {fullScreen ? (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, flexShrink: 0 }}>
              <Tab value="write" label="Write" />
              <Tab value="preview" label="Preview" />
            </Tabs>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{tab === 'write' ? editor : preview}</Box>
          </>
        ) : (
          <SplitPane left={editor} right={preview} />
        )}
        {error && <Alert severity="error" sx={{ mt: 2, flexShrink: 0 }}>{error}</Alert>}
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
