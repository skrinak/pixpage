import { createTheme } from '@mui/material/styles';

export const serif = '"Fraunces Variable", "Iowan Old Style", Georgia, serif';
export const sans = '"Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Fine paper grain, borrowed from the common SVG feTurbulence "noise" technique.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const heading = { fontFamily: serif, fontWeight: 560, letterSpacing: '-0.015em' };

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#2c5f5d' },
        secondary: { main: '#b5562f' },
        background: { default: '#d3dce2', paper: '#f7fbfe' },
        text: { primary: '#1d2630', secondary: '#4b5a68' },
        divider: 'rgba(25, 60, 95, 0.14)',
      },
    },
    dark: {
      palette: {
        primary: { main: '#8fc9c2' },
        secondary: { main: '#e59b74' },
        background: { default: '#1a1917', paper: '#25231f' },
        text: { primary: '#eeeae3', secondary: '#a9a296' },
        divider: 'rgba(255, 245, 225, 0.12)',
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: sans,
    h1: heading,
    h2: heading,
    h3: heading,
    h4: heading,
    h5: heading,
    h6: { ...heading, fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    overline: { fontWeight: 600, letterSpacing: '0.12em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        html: { scrollPaddingTop: 96 },
        body: {
          minHeight: '100vh',
          backgroundColor: '#d3dce2',
          backgroundImage: `${GRAIN}, radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.55), transparent 60%)`,
          backgroundAttachment: 'fixed',
          ...theme.applyStyles('dark', {
            backgroundColor: '#1a1917',
            backgroundImage: `${GRAIN}, radial-gradient(ellipse at 50% 0%, rgba(255,240,215,.06), transparent 60%)`,
          }),
        },
      }),
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiDialog: { styleOverrides: { paper: { backgroundImage: 'none' } } },
  },
});
