import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import Gallery from './Gallery.jsx';
import Detail from './Detail.jsx';
import { DeleteDialog, EditDialog, LoginDialog } from './Dialogs.jsx';
import { HeaderDialog } from './Header.jsx';
import { HelpDrawer } from './Help.jsx';
import { VideosDialog } from './Videos.jsx';
import { apiStatus, collectDropbox, deleteItem, loadGallery, login, saveCaption, saveGallery, session } from './api.js';
import { filterItems, formatRange, haystack } from './util.js';
import { DEFAULT_HEADER, fillPlaceholders, firstHeading } from './markdown.js';
import { navigate, useRoute } from './route.js';

const PW_KEY = 'pixpage.password';
const POLL_MS = 3000;
const NO_VIDEOS = [];

function Centered({ children }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, textAlign: 'center' }}>
      <Box>{children}</Box>
    </Box>
  );
}

export default function App() {
  const route = useRoute();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [api, setApi] = useState(null);
  const [password, setPassword] = useState(() => session.get(PW_KEY));
  const [loginOpen, setLoginOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [videosOpen, setVideosOpen] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [help, setHelp] = useState(null); // null = closed, otherwise the section to show
  const lastDetail = useRef(null);
  const version = useRef(null);

  // announce: toast about added or removed items. fresh: re-fetch rather than use the data the page came with.
  const refresh = useCallback(async (announce, fresh = announce) => {
    try {
      const next = await loadGallery(fresh);
      setData((prev) => {
        if (announce && prev) {
          const added = next.media.items.length - prev.media.items.length;
          if (added > 0) setToast(`${added} new item${added === 1 ? '' : 's'} added`);
          else if (added < 0) setToast('Gallery updated');
        }
        return next;
      });
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    refresh(false);
  }, [refresh]);

  // When a pixpage server is behind the site, poll it: new media in the source
  // folder (or edits from another tab) bump its version and we reload.
  useEffect(() => {
    let alive = true;
    let timer;
    const tick = async () => {
      const status = await apiStatus();
      if (!alive) return;
      setApi(status);
      if (!status) return;
      if (version.current !== null && status.version !== version.current) refresh(true);
      version.current = status.version;
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  const items = useMemo(() => {
    if (!data) return [];
    return data.media.items.map((it) => {
      const c = data.captions[it.id] || {};
      const merged = { ...it, description: c.description || '', keywords: c.keywords || [] };
      merged._hay = haystack(merged);
      return merged;
    });
  }, [data]);

  const keywordCounts = useMemo(() => {
    const counts = new Map();
    for (const it of items) for (const kw of it.keywords) counts.set(kw, (counts.get(kw) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  const filtered = useMemo(() => filterItems(items, route.q, route.t, route.k), [items, route.q, route.t, route.k]);
  const header = data?.gallery?.header || '';
  const videos = data?.gallery?.videos || NO_VIDEOS;
  const headerVars = useMemo(() => {
    const photos = items.filter((it) => it.type === 'photo').length;
    const videos = items.length - photos;
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    return {
      title: data?.media.title || 'Gallery',
      dates: formatRange(items),
      photos: plural(photos, 'photo'),
      videos: plural(videos, 'video'),
      counts: [photos && plural(photos, 'photo'), videos && plural(videos, 'video')].filter(Boolean).join(' · '),
      count: String(items.length),
    };
  }, [items, data]);
  const title = firstHeading(fillPlaceholders(header || DEFAULT_HEADER, headerVars)) || headerVars.title;
  const editing = Boolean(api && password);
  const anyDialog = Boolean(editItem) || Boolean(deleteTarget) || loginOpen || headerOpen || videosOpen || help !== null;

  const lock = () => {
    session.set(PW_KEY, null);
    setPassword(null);
  };

  const doLogin = async (pw) => {
    await login(pw);
    session.set(PW_KEY, pw);
    setPassword(pw);
    setToast('Editing unlocked');
  };

  // A 401 means the password was rotated (aws ssm put-parameter) since unlocking.
  const authed = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (e.status === 401) {
        lock();
        setLoginOpen(true);
        throw new Error('The edit password changed — unlock again, then save.');
      }
      throw e;
    }
  };

  const doSave = (item, caption) =>
    authed(async () => {
      const res = await saveCaption(password, item.id, caption);
      setData((d) => ({ ...d, captions: { ...d.captions, [item.id]: res.caption } }));
      setToast('Saved');
    });

  const doSaveHeader = (markdown) =>
    authed(async () => {
      const res = await saveGallery(password, { header: markdown });
      setData((d) => ({ ...d, gallery: res.gallery }));
      setToast('Header saved');
    });

  const doSaveVideos = (list) =>
    authed(async () => {
      const res = await saveGallery(password, { videos: list });
      setData((d) => ({ ...d, gallery: res.gallery }));
      setToast('Videos saved');
    });

  const doDelete = (item) =>
    authed(async () => {
      const res = await deleteItem(password, item.id);
      // On a detail page, move to a neighbour (or back to the gallery) before the item disappears.
      if (route.view === 'detail' && route.id === item.id) {
        const i = filtered.findIndex((it) => it.id === item.id);
        const next = filtered[i + 1] || filtered[i - 1];
        navigate(next ? { ...route, id: next.id } : { ...route, view: 'gallery', id: null }, { replace: true });
      }
      setData((d) => {
        const captions = { ...d.captions };
        delete captions[item.id];
        return { ...d, captions, media: { ...d.media, items: d.media.items.filter((it) => it.id !== item.id) } };
      });
      setToast(res.s3 ? `Deleted. ${res.s3}` : 'Deleted');
    });

  // New originals waiting in the album's S3 dropbox: download them and show them.
  const doCollect = async () => {
    setCollecting(true);
    try {
      const res = await authed(() => collectDropbox(password));
      if (res.added.length) await refresh(false, true);
      setToast(res.message);
    } catch (e) {
      setToast(e.message || 'Could not check the dropbox');
    } finally {
      setCollecting(false);
    }
  };

  // "?" opens help wherever editing is possible.
  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (e.key !== '?' || !api || anyDialog || el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      setHelp('unlock');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, anyDialog]);

  const common = {
    route,
    api,
    editing,
    onUnlock: () => setLoginOpen(true),
    onLock: lock,
    onEdit: setEditItem,
    onDelete: setDeleteTarget,
    onHelp: (section = 'unlock') => setHelp(section),
  };

  useEffect(() => {
    if (route.view === 'detail') lastDetail.current = route.id;
  }, [route.view, route.id]);

  let page;
  if (error && !data) {
    page = (
      <Centered>
        <Typography variant="h5" sx={{ mb: 1 }}>Couldn’t load this gallery</Typography>
        <Typography sx={{ color: 'text.secondary' }}>{String(error.message || error)}</Typography>
      </Centered>
    );
  } else if (!data) {
    page = (
      <Centered>
        <CircularProgress />
      </Centered>
    );
  } else if (route.view === 'detail') {
    // Walk the filtered list when the photo is in it; otherwise the whole gallery.
    let list = filtered;
    let index = list.findIndex((it) => it.id === route.id);
    if (index < 0) {
      list = items;
      index = list.findIndex((it) => it.id === route.id);
    }
    page = index < 0 ? (
      <Centered>
        <Typography variant="h5" sx={{ mb: 2 }}>That photo isn’t in this gallery anymore.</Typography>
        <Button href="#/" variant="contained" disableElevation>Back to gallery</Button>
      </Centered>
    ) : (
      <Detail {...common} item={list[index]} index={index} list={list} dialogOpen={anyDialog} />
    );
  } else {
    page = (
      <Gallery
        {...common}
        title={title}
        header={header}
        headerVars={headerVars}
        onEditHeader={() => setHeaderOpen(true)}
        videos={videos}
        onEditVideos={() => setVideosOpen(true)}
        collecting={collecting}
        onCollect={doCollect}
        allItems={items}
        items={filtered}
        keywordCounts={keywordCounts}
        focusId={lastDetail.current}
      />
    );
  }

  useEffect(() => {
    const item = route.view === 'detail' && items.find((it) => it.id === route.id);
    document.title = item ? `${item.description?.split('\n')[0].slice(0, 60) || item.name} · ${title}` : title;
  }, [route.view, route.id, items, title]);

  return (
    <>
      {page}
      <EditDialog
        open={Boolean(editItem)}
        item={editItem && items.find((it) => it.id === editItem.id)}
        keywordOptions={keywordCounts.map(([kw]) => kw)}
        onClose={() => setEditItem(null)}
        onSave={doSave}
      />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={doLogin} />
      <HeaderDialog
        open={headerOpen}
        markdown={header}
        vars={headerVars}
        onClose={() => setHeaderOpen(false)}
        onSave={doSaveHeader}
        onHelp={() => setHelp('header')}
      />
      <VideosDialog open={videosOpen} videos={videos} onClose={() => setVideosOpen(false)} onSave={doSaveVideos} />
      <HelpDrawer open={help !== null} section={help} onClose={() => setHelp(null)} />
      <DeleteDialog item={deleteTarget} published={api?.published} onClose={() => setDeleteTarget(null)} onDelete={doDelete} />
      <Snackbar
        open={Boolean(toast)}
        message={toast}
        autoHideDuration={toast?.startsWith('Deleted') ? 6000 : toast?.length > 50 ? 9000 : 2600}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
