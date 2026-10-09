import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import { useColorScheme } from '@mui/material/styles';
import LightMode from '@mui/icons-material/LightMode';
import DarkMode from '@mui/icons-material/DarkMode';
import SettingsBrightness from '@mui/icons-material/SettingsBrightness';
import LockOutlined from '@mui/icons-material/LockOutlined';
import LockOpen from '@mui/icons-material/LockOpen';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';

export const barSx = (theme) => ({
  bgcolor: 'rgba(220, 227, 232, 0.82)',
  color: 'text.primary',
  backdropFilter: 'saturate(160%) blur(16px)',
  borderBottom: '1px solid',
  borderColor: 'divider',
  ...theme.applyStyles('dark', { bgcolor: 'rgba(26, 25, 23, 0.78)' }),
});

const NEXT = { system: 'light', light: 'dark', dark: 'system' };
const ICON = { system: SettingsBrightness, light: LightMode, dark: DarkMode };

export function ColorModeButton() {
  const { mode, setMode } = useColorScheme();
  if (!mode) return null;
  const Icon = ICON[mode] || SettingsBrightness;
  return (
    <Tooltip title={`Theme: ${mode}`}>
      <IconButton onClick={() => setMode(NEXT[mode] || 'system')} aria-label="Change theme">
        <Icon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

// Only rendered when an edit API answers (local pixpage server today).
export function EditLock({ api, editing, onUnlock, onLock }) {
  if (!api) return null;
  if (editing) {
    return (
      <Tooltip title="Editing is on — click to lock">
        <Chip
          icon={<LockOpen />}
          label="Editing"
          color="primary"
          onClick={onLock}
          sx={{ ml: 0.5, '& .MuiChip-label': { display: { xs: 'none', sm: 'block' } }, '& .MuiChip-icon': { mr: { xs: '-6px', sm: 0 } } }}
        />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Unlock editing">
      <IconButton onClick={onUnlock} aria-label="Unlock editing">
        <LockOutlined fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

// Help is about editing, so like the lock it only shows where editing is possible.
export function HelpButton({ api, onHelp }) {
  if (!api) return null;
  return (
    <Tooltip title="Help (?)">
      <IconButton onClick={() => onHelp()} aria-label="Help">
        <HelpOutlineRounded fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
