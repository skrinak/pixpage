import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import useMediaQuery from '@mui/material/useMediaQuery';
import EditOutlined from '@mui/icons-material/EditOutlined';
import Add from '@mui/icons-material/Add';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import { Print, VideoBadge } from './Print.jsx';
import { serif } from './theme.js';

// Same width as a photo thumbnail, in YouTube's 16:9.
const THUMB_W = 360;
const THUMB_H = 202;

const thumb = (id, size) => `https://i.ytimg.com/vi/${id}/${size}.jpg`;
const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// `headed`: some video in the section has a title above its thumbnail, so every card keeps
// that line (empty or not) and the thumbnails stay level.
function VideoCard({ video, headed }) {
  return (
    <Box
      component="a"
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${video.heading ? `${video.heading}: ` : ''}${video.title} (plays on YouTube in a new tab)`}
      sx={{
        width: '100%',
        maxWidth: THUMB_W + 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: 'inherit',
        textDecoration: 'none',
        borderRadius: 1,
        '&:hover .video-title': { textDecoration: 'underline', textUnderlineOffset: '3px' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 6 },
      }}
    >
      {headed && (
        <Typography component="h3" noWrap sx={{ width: '100%', minHeight: '1.4em', mb: 1.25, px: 1, textAlign: 'center', fontFamily: serif, fontWeight: 600, fontSize: '1.1rem', lineHeight: 1.4 }}>
          {video.heading}
        </Typography>
      )}
      <Print interactive>
        {/* sddefault and hqdefault are 4:3 with black bars; the 16:9 box crops the bars away. */}
        <Box
          component="img"
          src={thumb(video.id, 'sddefault')}
          alt=""
          loading="lazy"
          decoding="async"
          width={THUMB_W}
          height={THUMB_H}
          onLoad={(e) => {
            // A size YouTube doesn't have arrives as a 120 px placeholder rather than an error.
            const img = e.currentTarget;
            if (img.naturalWidth <= 120 && !img.src.endsWith('/hqdefault.jpg')) img.src = thumb(video.id, 'hqdefault');
          }}
          sx={{ display: 'block', width: THUMB_W, maxWidth: '100%', height: 'auto', aspectRatio: '16 / 9', objectFit: 'cover', bgcolor: '#d9d4ca' }}
        />
        <VideoBadge size="large" />
      </Print>
      <Typography
        className="video-title"
        variant="body2"
        sx={{
          mt: 1.75,
          px: 1,
          textAlign: 'center',
          color: 'text.primary',
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {video.title}
      </Typography>
    </Box>
  );
}

// Linked (YouTube) videos: a section of its own between the header and the photos.
export function VideoSection({ videos, editing, onEdit }) {
  if (!videos.length) return null;
  const headed = videos.some((v) => v.heading);
  return (
    <Box id="videos" component="section" aria-label="Videos" sx={{ mt: { xs: 5, md: 7 }, mb: { xs: 1, md: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: { xs: 3, md: 4 } }}>
        <Typography variant="h5" component="h2">
          Videos
        </Typography>
        {editing && (
          <Button size="small" variant="outlined" startIcon={<EditOutlined />} onClick={onEdit} sx={{ bgcolor: 'background.paper' }}>
            Edit videos
          </Button>
        )}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
          columnGap: { xs: 2, md: 4 },
          rowGap: { xs: 4, md: 6 },
          justifyItems: 'center',
          alignItems: 'start',
        }}
      >
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} headed={headed} />
        ))}
      </Box>
    </Box>
  );
}

// Mirrors youtube_id() in pixpage.py, for thumbnails and early feedback; the server has the final say.
function youtubeId(link) {
  let u;
  try {
    u = new URL(/^[a-z]+:\/\//i.test(link) ? link : `https://${link}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  let id = '';
  if (host === 'youtu.be') id = parts[0];
  else if (['youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    id = parts[0] === 'watch' ? u.searchParams.get('v') : ['shorts', 'embed', 'live', 'v'].includes(parts[0]) ? parts[1] : '';
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
}

function VideoRow({ row, first, last, disabled, onChange, onMove, onRemove }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '112px 1fr', sm: '128px 1fr auto' },
        gridTemplateAreas: { xs: '"thumb actions" "fields fields"', sm: '"thumb fields actions"' },
        gap: 2,
        alignItems: 'start',
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ gridArea: 'thumb', minWidth: 0 }}>
        <Box component="img" src={thumb(row.id, 'mqdefault')} alt="" sx={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 1, bgcolor: 'action.hover' }} />
        <Typography variant="caption" noWrap sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
          youtu.be/{row.id}
        </Typography>
      </Box>
      <Box sx={{ gridArea: 'fields', display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        <TextField
          size="small"
          fullWidth
          label="Title above the thumbnail"
          placeholder="Optional"
          value={row.heading}
          onChange={(e) => onChange({ heading: e.target.value })}
          disabled={disabled}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          fullWidth
          label="Title below the thumbnail"
          placeholder="Leave blank to use the title from YouTube"
          value={row.title}
          onChange={(e) => onChange({ title: e.target.value })}
          disabled={disabled}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>
      <Box sx={{ gridArea: 'actions', display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip title="Move up">
          <span>
            <IconButton size="small" aria-label="Move up" disabled={disabled || first} onClick={() => onMove(-1)}>
              <ArrowUpward fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Move down">
          <span>
            <IconButton size="small" aria-label="Move down" disabled={disabled || last} onClick={() => onMove(1)}>
              <ArrowDownward fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Remove video">
          <span>
            <IconButton size="small" aria-label="Remove video" disabled={disabled} onClick={onRemove} sx={{ '&:hover': { color: 'error.main' } }}>
              <DeleteOutlined fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

export function VideosDialog({ open, videos, onClose, onSave }) {
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const [rows, setRows] = useState([]);
  const [links, setLinks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setRows(videos.map((v) => ({ id: v.id, url: v.url, heading: v.heading || '', title: v.title })));
      setLinks('');
      setError(null);
    }
  }, [open, videos]);

  // The pasted links as new rows, skipping videos already listed → [rows, error].
  const pasted = () => {
    const added = [];
    for (const link of links.split(/\s+/).filter(Boolean)) {
      const id = youtubeId(link);
      if (!id) return [added, `Not a YouTube link: ${link}`];
      if (![...rows, ...added].some((r) => r.id === id)) added.push({ id, url: `https://youtu.be/${id}`, heading: '', title: '' });
    }
    return [added, null];
  };

  const addLinks = () => {
    const [added, problem] = pasted();
    setError(problem);
    if (problem) return;
    setRows([...rows, ...added]);
    setLinks('');
  };

  const submit = async () => {
    // Links still sitting in the paste box count too.
    const [added, problem] = pasted();
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      await onSave([...rows, ...added].map(({ url, heading, title }) => ({ url, heading, title })));
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const move = (i, by) => {
    const next = [...rows];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setRows(next);
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md" fullScreen={fullScreen} onKeyDown={onKeyDown}>
      <DialogTitle>
        Videos
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Each video shows its YouTube thumbnail with a title below it, and an optional title above it. Use the arrows to reorder.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: '0 !important' }}>
        {rows.map((row, i) => (
          <VideoRow
            key={row.id}
            row={row}
            first={i === 0}
            last={i === rows.length - 1}
            disabled={saving}
            onChange={(patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))}
            onMove={(by) => move(i, by)}
            onRemove={() => setRows(rows.filter((_, j) => j !== i))}
          />
        ))}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mt: 3 }}>
          <TextField
            multiline
            minRows={2}
            maxRows={8}
            fullWidth
            autoFocus={videos.length === 0}
            label="Add videos"
            placeholder="Paste YouTube links, one per line"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            disabled={saving}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { spellCheck: false, sx: { fontFamily: mono, fontSize: 13.5, lineHeight: 1.65 } } }}
          />
          <Button variant="outlined" startIcon={<Add />} onClick={addLinks} disabled={saving || !links.trim()} sx={{ flexShrink: 0, mt: 0.25 }}>
            Add
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Typography variant="caption" sx={{ mr: 'auto', color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
          ⌘/Ctrl + Enter to save
        </Typography>
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
