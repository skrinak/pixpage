import Box from '@mui/material/Box';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import { formatDuration } from './util.js';

// A photographic print lying on a table: white border, deeper bottom margin,
// softly rounded corners and a layered contact shadow (after the classic iPhoto frame).
const SHADOW = [
  '0 0.5px 0.5px rgba(30,20,10,.18)',
  '0 2px 3px rgba(30,20,10,.12)',
  '0 10px 22px -8px rgba(30,20,10,.38)',
].join(', ');
const SHADOW_LIFT = [
  '0 1px 1px rgba(30,20,10,.16)',
  '0 6px 10px rgba(30,20,10,.12)',
  '0 26px 40px -14px rgba(30,20,10,.5)',
].join(', ');

export function Print({ children, rotate = 0, interactive = false, large = false, sx, ...rest }) {
  return (
    <Box
      sx={[
        (theme) => ({
          display: 'inline-block',
          position: 'relative',
          lineHeight: 0,
          maxWidth: '100%',
          bgcolor: '#fdfcf9',
          p: large ? { xs: '8px 8px 16px', md: '12px 12px 26px' } : '7px 7px 13px',
          borderRadius: '3px',
          boxShadow: SHADOW,
          transform: `rotate(${rotate}deg)`,
          transition: 'transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s ease',
          color: 'inherit',
          ...theme.applyStyles('dark', { bgcolor: '#e9e5dc' }),
        }),
        interactive && {
          cursor: 'pointer',
          '&:hover, &:focus-visible': {
            transform: 'rotate(0deg) translateY(-4px) scale(1.025)',
            boxShadow: SHADOW_LIFT,
          },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 6 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    >
      {children}
    </Box>
  );
}

export function VideoBadge({ duration, size = 'small' }) {
  const big = size === 'large';
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: big ? '50% auto auto 50%' : 'auto auto 18px 14px',
        transform: big ? 'translate(-50%, -50%)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        pl: 0.5,
        pr: duration != null ? 1 : 0.5,
        py: 0.25,
        borderRadius: 99,
        bgcolor: 'rgba(15,15,15,.62)',
        backdropFilter: 'blur(6px)',
        color: '#fff',
        lineHeight: 1,
        fontSize: 12,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        pointerEvents: 'none',
      }}
    >
      <PlayArrowRounded sx={{ fontSize: big ? 44 : 18 }} />
      {duration != null && formatDuration(duration)}
    </Box>
  );
}

// Fit (w, h) inside a box, never upscaling.
export function fit(w, h, maxW, maxH) {
  const s = Math.min(maxW / w, maxH / h, 1);
  return { w: Math.round(w * s), h: Math.round(h * s) };
}
