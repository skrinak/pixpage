import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import useMediaQuery from '@mui/material/useMediaQuery';
import { normalizeKeywords, formatDate } from './util.js';

export function EditDialog({ open, item, keywordOptions, onClose, onSave }) {
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && item) {
      setDescription(item.description || '');
      setKeywords(item.keywords || []);
      setInput('');
      setError(null);
    }
  }, [open, item]);

  if (!item) return null;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      // Anything still sitting in the keyword box counts too.
      await onSave(item, { description: description.trim(), keywords: normalizeKeywords([...keywords, ...input.split(',')]) });
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

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} onKeyDown={onKeyDown}>
      <DialogTitle sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Box component="img" src={item.thumb.src} alt="" sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1.5, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" component="div" noWrap>
            {item.type === 'video' ? 'Describe this video' : 'Describe this photo'}
          </Typography>
          <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
            {[item.name, formatDate(item.taken)].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '8px !important' }}>
        <TextField
          label="Description"
          multiline
          minRows={4}
          maxRows={16}
          fullWidth
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's happening here? Who, where, why it matters…"
        />
        <Autocomplete
          multiple
          freeSolo
          autoSelect
          filterSelectedOptions
          options={keywordOptions}
          value={keywords}
          onChange={(_, v) => setKeywords(normalizeKeywords(v))}
          inputValue={input}
          onInputChange={(_, v, reason) => {
            if (reason === 'input' && v.includes(',')) {
              const parts = v.split(',');
              setKeywords((k) => normalizeKeywords([...k, ...parts.slice(0, -1)]));
              setInput(parts[parts.length - 1]);
            } else {
              setInput(v);
            }
          }}
          renderInput={(params) => (
            <TextField {...params} label="Keywords" placeholder={keywords.length ? '' : 'beach, sunset, family…'} helperText="Enter or comma adds a keyword. Keywords are searchable." />
          )}
        />
        {error && <Alert severity="error">{error}</Alert>}
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

export function LoginDialog({ open, onClose, onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError(null);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onLogin(password);
      onClose();
    } catch (err) {
      setError(err.status === 401 ? 'Incorrect password.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>Unlock editing</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Enter the gallery edit password to add descriptions and keywords.
          </Typography>
          <TextField
            type="password"
            label="Password"
            autoFocus
            fullWidth
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" loading={busy} disabled={!password} disableElevation>
            Unlock
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
