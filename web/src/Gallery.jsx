import { useEffect, useRef, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import SearchIcon from '@mui/icons-material/Search';
import Close from '@mui/icons-material/Close';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { Print, VideoBadge, fit } from './Print.jsx';
import { ColorModeButton, EditLock, HelpButton, barSx } from './Toolbar.jsx';
import { HeaderMarkdown } from './Header.jsx';
import { buildHash, navigate } from './route.js';
import { keywordQuery, tilt, tokenize } from './util.js';

// Thumbnail display box — identical to the original iPhoto gallery (360 × 240).
const THUMB_W = 360;
const THUMB_H = 240;
const PAGE = 60;

function SearchField({ value, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        height: 40,
        borderRadius: 99,
        width: { xs: '100%', sm: 300, md: 380 },
        bgcolor: 'rgba(255,255,255,.7)',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'box-shadow .2s, border-color .2s',
        '&:focus-within': { borderColor: 'primary.main', boxShadow: '0 0 0 3px rgba(44,95,93,.15)' },
        ...theme.applyStyles('dark', { bgcolor: 'rgba(255,255,255,.06)' }),
      })}
    >
      <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
      <InputBase
        inputRef={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        placeholder="Search descriptions & keywords"
        sx={{ flex: 1, fontSize: 14 }}
        slotProps={{ input: { 'aria-label': 'Search', enterKeyHint: 'search' } }}
      />
      {value && (
        <IconButton size="small" onClick={() => onChange('')} aria-label="Clear search">
          <Close fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}

function Card({ item, route, editing, onEdit, onKeyword }) {
  const size = fit(item.thumb.w, item.thumb.h, THUMB_W, THUMB_H);
  const kws = item.keywords || [];
  return (
    <Box
      id={`card-${item.id}`}
      sx={{ width: '100%', maxWidth: THUMB_W + 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: THUMB_H + 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&:hover .edit-btn, &:focus-within .edit-btn': { opacity: 1 },
        }}
      >
        <Print
          component="a"
          href={buildHash({ view: 'detail', id: item.id, q: route.q, t: route.t })}
          rotate={tilt(item.id)}
          interactive
          aria-label={item.description || item.name}
        >
          <Box
            component="img"
            src={item.thumb.src}
            alt={item.description || item.name}
            loading="lazy"
            decoding="async"
            width={size.w}
            height={size.h}
            sx={{
              display: 'block',
              width: size.w,
              maxWidth: '100%',
              height: 'auto',
              aspectRatio: `${item.thumb.w} / ${item.thumb.h}`,
              bgcolor: '#d9d4ca',
            }}
          />
          {item.type === 'video' && <VideoBadge duration={item.duration} />}
        </Print>
        {editing && (
          <Tooltip title="Edit description">
            <IconButton
              className="edit-btn"
              onClick={() => onEdit(item)}
              size="small"
              aria-label="Edit description"
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                opacity: { xs: 1, md: 0 },
                transition: 'opacity .2s',
                bgcolor: 'background.paper',
                boxShadow: 2,
                '&:hover': { bgcolor: 'background.paper' },
              }}
            >
              <EditOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box sx={{ mt: 1, px: 1, width: '100%', textAlign: 'center', minHeight: 8 }}>
        {item.description ? (
          <Typography
            variant="body2"
            sx={{
              color: 'text.primary',
              lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.description}
          </Typography>
        ) : (
          editing && (
            <Button size="small" startIcon={<EditOutlined />} onClick={() => onEdit(item)} sx={{ color: 'text.secondary' }}>
              Add description
            </Button>
          )
        )}
        {kws.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
            {kws.slice(0, 5).map((kw) => (
              <Chip key={kw} label={kw} size="small" variant="outlined" onClick={() => onKeyword(kw)} />
            ))}
            {kws.length > 5 && <Chip size="small" label={`+${kws.length - 5}`} sx={{ opacity: 0.7 }} />}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function Gallery({ title, header, headerVars, onEditHeader, onHelp, allItems, items, keywordCounts, route, api, editing, onUnlock, onLock, onEdit, focusId }) {
  const setRoute = (patch) => navigate({ view: 'gallery', q: route.q, t: route.t, ...patch }, { replace: true });
  const focusIndex = focusId ? items.findIndex((it) => it.id === focusId) : -1;
  const [limit, setLimit] = useState(Math.max(PAGE, focusIndex + PAGE));
  const sentinel = useRef(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE);
    }, { rootMargin: '1200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, limit]);

  // Returning from a detail page: bring that print back into view.
  useEffect(() => {
    if (focusId) document.getElementById(`card-${focusId}`)?.scrollIntoView({ block: 'center' });
  }, [focusId]);

  const photos = allItems.filter((it) => it.type === 'photo').length;
  const videos = allItems.length - photos;
  const active = new Set(tokenize(route.q));
  const toggleKeyword = (kw) => {
    const tok = kw.toLowerCase();
    if (active.has(tok)) {
      setRoute({ q: tokenize(route.q).filter((t) => t !== tok).map(keywordQuery).join(' ') });
    } else {
      setRoute({ q: [route.q.trim(), keywordQuery(kw)].filter(Boolean).join(' ') });
    }
  };
  const cloud = keywordCounts.slice(0, 24);
  const filtered = route.q || route.t !== 'all';

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={barSx}>
        <Toolbar sx={{ gap: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' }, py: { xs: 1, sm: 0 } }}>
          <Typography
            variant="h6"
            component="a"
            href="#/"
            noWrap
            sx={{ color: 'inherit', textDecoration: 'none', flexShrink: 0, mr: 'auto', maxWidth: { xs: '60%', sm: 'none' } }}
          >
            {title}
          </Typography>
          <Box sx={{ order: { xs: 3, sm: 0 }, width: { xs: '100%', sm: 'auto' } }}>
            <SearchField value={route.q} onChange={(q) => setRoute({ q })} />
          </Box>
          {photos > 0 && videos > 0 && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={route.t}
              onChange={(_, t) => t && setRoute({ t })}
              sx={{ display: { xs: 'none', md: 'flex' }, '& .MuiToggleButton-root': { px: 1.5, py: 0.5 } }}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="photo">Photos</ToggleButton>
              <ToggleButton value="video">Videos</ToggleButton>
            </ToggleButtonGroup>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ColorModeButton />
            <HelpButton api={api} onHelp={onHelp} />
            <EditLock api={api} editing={editing} onUnlock={onUnlock} onLock={onLock} />
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ pt: { xs: 5, md: 8 }, pb: { xs: 3, md: 4 }, textAlign: 'center' }}>
        <Box component="header" sx={{ maxWidth: 960, mx: 'auto' }}>
          <HeaderMarkdown markdown={header} vars={headerVars} />
        </Box>
        {editing && (
          <Button size="small" variant="outlined" startIcon={<EditOutlined />} onClick={onEditHeader} sx={{ mt: 2.5, bgcolor: 'background.paper' }}>
            Edit header
          </Button>
        )}
        {cloud.length > 0 && (
          <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 900, mx: 'auto' }}>
            {cloud.map(([kw, n]) => (
              <Chip
                key={kw}
                label={`${kw} · ${n}`}
                size="small"
                color={active.has(kw.toLowerCase()) ? 'primary' : 'default'}
                variant={active.has(kw.toLowerCase()) ? 'filled' : 'outlined'}
                onClick={() => toggleKeyword(kw)}
              />
            ))}
          </Box>
        )}
        {filtered && (
          <Box sx={{ mt: 3, display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {items.length} of {allItems.length} shown
            </Typography>
            <Button size="small" onClick={() => setRoute({ q: '', t: 'all' })}>
              Clear filters
            </Button>
          </Box>
        )}
      </Container>

      <Container maxWidth="xl" sx={{ pb: 12 }}>
        {items.length === 0 ? (
          <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 10 }}>
            {allItems.length ? 'Nothing matches your search.' : 'No photos or videos yet — add some to the source folder.'}
          </Typography>
        ) : (
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
            {items.slice(0, limit).map((item) => (
              <Card key={item.id} item={item} route={route} editing={editing} onEdit={onEdit} onKeyword={toggleKeyword} />
            ))}
          </Box>
        )}
        {limit < items.length && <Box ref={sentinel} sx={{ height: 1 }} />}
      </Container>
    </>
  );
}
