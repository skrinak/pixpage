import { useEffect, useRef } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import EditOutlined from '@mui/icons-material/EditOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import { Print } from './Print.jsx';
import { ColorModeButton, EditLock, HelpButton, barSx } from './Toolbar.jsx';
import { buildHash, navigate } from './route.js';
import { formatDateTime, formatDuration } from './util.js';

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

function NavArrow({ item, route, dir }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <IconButton
      component="a"
      href={item ? buildHash({ view: 'detail', id: item.id, q: route.q, t: route.t, k: route.k }) : undefined}
      onClick={(e) => {
        e.preventDefault();
        if (item) navigate({ view: 'detail', id: item.id, q: route.q, t: route.t, k: route.k }, { replace: true });
      }}
      disabled={!item}
      aria-label={dir === 'prev' ? 'Previous' : 'Next'}
      sx={{
        position: 'absolute',
        top: '50%',
        [dir === 'prev' ? 'left' : 'right']: { xs: 4, md: 20 },
        transform: 'translateY(-50%)',
        width: 52,
        height: 52,
        zIndex: 2,
        bgcolor: 'background.paper',
        boxShadow: 3,
        opacity: item ? 0.92 : 0,
        display: { xs: 'none', sm: 'inline-flex' },
        '&:hover': { bgcolor: 'background.paper', opacity: 1 },
      }}
    >
      <Icon sx={{ fontSize: 32 }} />
    </IconButton>
  );
}

function metaRows(item) {
  const cam = item.camera || {};
  const model = cam.model && cam.make && !cam.model.toLowerCase().startsWith(cam.make.toLowerCase().split(' ')[0])
    ? `${cam.make} ${cam.model}`
    : cam.model || cam.make;
  const ex = item.exposure || {};
  const exposure = [
    ex.f && `ƒ/${ex.f}`,
    ex.t && `${ex.t} s`,
    ex.iso && `ISO ${ex.iso}`,
    (ex.mm35 || ex.mm) && `${ex.mm35 || ex.mm} mm${ex.mm35 ? ' (35mm eq.)' : ''}`,
  ].filter(Boolean).join(' · ');
  const gps = item.gps;
  return [
    ['Taken', formatDateTime(item.taken)],
    ['Camera', model],
    ['Lens', cam.lens],
    ['Exposure', exposure],
    ['Duration', item.type === 'video' ? formatDuration(item.duration) : null],
    ['Original', item.orig && `${item.orig.w} × ${item.orig.h}`],
    ['File', item.name],
    ['Location', gps && (
      <Link
        href={`https://www.openstreetmap.org/?mlat=${gps.lat}&mlon=${gps.lon}#map=15/${gps.lat}/${gps.lon}`}
        target="_blank"
        rel="noopener"
      >
        {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}
      </Link>
    )],
  ].filter(([, v]) => v);
}

export default function Detail({ item, index, list, route, api, editing, onUnlock, onLock, onEdit, onHelp, dialogOpen }) {
  const prev = list[index - 1];
  const next = list[index + 1];
  const touch = useRef(null);
  const backHref = buildHash({ view: 'gallery', q: route.q, t: route.t, k: route.k });
  const go = (it) => it && navigate({ view: 'detail', id: it.id, q: route.q, t: route.t, k: route.k }, { replace: true });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [item.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (dialogOpen || isTyping(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') go(prev);
      else if (e.key === 'ArrowRight') go(next);
      else if (e.key === 'Escape') window.location.hash = backHref;
      else if (e.key === 'e' && editing) onEdit(item);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Warm the cache for the neighbours so prev/next feel instant.
  useEffect(() => {
    for (const it of [prev, next]) if (it) new Image().src = it.large;
  }, [prev, next]);

  const ratio = item.w / item.h;
  const mediaSx = {
    display: 'block',
    width: `min(calc(100vw - 56px), calc((100svh - 190px) * ${ratio}), ${item.w}px)`,
    height: 'auto',
    aspectRatio: `${item.w} / ${item.h}`,
    bgcolor: '#d9d4ca',
    animation: 'pp-fade .35s ease',
    '@keyframes pp-fade': { from: { opacity: 0.25 }, to: { opacity: 1 } },
  };
  const rows = metaRows(item);

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={barSx}>
        <Toolbar sx={{ gap: 1 }}>
          <Button href={backHref} startIcon={<ArrowBack />} sx={{ color: 'text.primary' }}>
            Gallery
          </Button>
          <Typography variant="body2" sx={{ mx: 'auto', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
            {index + 1} of {list.length}
          </Typography>
          <IconButton onClick={() => go(prev)} disabled={!prev} aria-label="Previous">
            <ChevronLeft />
          </IconButton>
          <IconButton onClick={() => go(next)} disabled={!next} aria-label="Next">
            <ChevronRight />
          </IconButton>
          <Tooltip title="Open full size">
            <IconButton component="a" href={item.video || item.large} target="_blank" rel="noopener" aria-label="Open full size">
              <OpenInNew fontSize="small" />
            </IconButton>
          </Tooltip>
          <ColorModeButton />
          <HelpButton api={api} onHelp={onHelp} />
          <EditLock api={api} editing={editing} onUnlock={onUnlock} onLock={onLock} />
        </Toolbar>
      </AppBar>

      <Box
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
          if (Math.abs(dx) > 60) go(dx > 0 ? prev : next);
        }}
        sx={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 1.5, sm: 10 },
          pt: { xs: 3, md: 4 },
          pb: { xs: 3, md: 5 },
        }}
      >
        <NavArrow item={prev} route={route} dir="prev" />
        <Print large>
          {item.type === 'video' ? (
            <Box
              key={item.id}
              component="video"
              src={item.video}
              poster={item.large}
              controls
              playsInline
              preload="metadata"
              sx={{ ...mediaSx, bgcolor: '#000' }}
            />
          ) : (
            <Box key={item.id} component="img" src={item.large} alt={item.description || item.name} sx={mediaSx} />
          )}
        </Print>
        <NavArrow item={next} route={route} dir="next" />
      </Box>

      <Container maxWidth="md" sx={{ pb: 12 }}>
        <Box
          sx={(theme) => ({
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            bgcolor: 'rgba(253,252,249,.72)',
            border: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'blur(6px)',
            ...theme.applyStyles('dark', { bgcolor: 'rgba(37,35,31,.72)' }),
          })}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {item.description ? (
                <Typography sx={{ fontSize: { xs: '1.05rem', md: '1.2rem' }, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {item.description}
                </Typography>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>No description yet.</Typography>
              )}
            </Box>
            {editing && (
              <Button variant="outlined" size="small" startIcon={<EditOutlined />} onClick={() => onEdit(item)} sx={{ flexShrink: 0 }}>
                Edit
              </Button>
            )}
          </Box>
          {item.keywords?.length > 0 && (
            <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {item.keywords.map((kw) => (
                <Chip key={kw} label={kw} variant="outlined" component="a" clickable href={buildHash({ view: 'gallery', k: [kw] })} />
              ))}
            </Box>
          )}
          <Divider sx={{ my: 3 }} />
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '120px 1fr' },
              columnGap: 3,
              rowGap: { xs: 0.25, sm: 1.25 },
              fontSize: 14,
              '& dt': { color: 'text.secondary', fontWeight: 500, mt: { xs: 1.25, sm: 0 } },
              '& dd': { m: 0, overflowWrap: 'anywhere' },
            }}
          >
            {rows.map(([k, v]) => (
              <Box key={k} sx={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </Box>
            ))}
          </Box>
        </Box>
        <Typography variant="caption" sx={{ display: { xs: 'none', md: 'block' }, mt: 2, textAlign: 'center', color: 'text.secondary' }}>
          ← → to browse · Esc for gallery{editing ? ' · E to edit' : ''}
        </Typography>
      </Container>
    </>
  );
}
