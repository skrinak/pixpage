# pixpage

A replacement for the long-gone iPhoto/Photos "web page" export: turn a folder of photos
**and videos** (HEIC included) into a browsable, searchable gallery.

```sh
uv run pixpage.py ~/Pictures/Oct6
```

- Builds `~/Documents/Websites/<folder name>/`
- Serves it at <http://127.0.0.1:8000/> (next free port if busy)
- Watches the folder: new, changed or deleted media are processed automatically and open
  browsers refresh themselves. Re-running is incremental, so only new files are processed.

## The gallery

- **Thumbnail page:** prints laid on a table, same 360 × 240 box as the old export (rendered
  at 2× for retina screens). The description (2 lines) and keywords sit under each print.
  Search covers descriptions, keywords, file names and dates; click a keyword to filter.
  Photos/Videos filter appears when both are present. `/` focuses search.
- **Detail page:** large image or video player, the full description, keywords and EXIF details
  (date, camera, lens, exposure, location). Use ← → (or swipe) for previous/next, Esc for the
  gallery and E to edit. Prev/next stays within the current search.
- Light, dark or system theme. Fonts are Inter and Fraunces, bundled in the site so it works
  offline.

## Editing the header

When editing is unlocked, an **Edit header** button appears under the title. It opens a
Markdown editor with a live preview. Placeholders such as `{{dates}}`, `{{title}}` and
`{{counts}}` stay current as media is added. The first `# heading` also becomes the top-bar
and browser-tab title. **Reset to default** restores the original date / title / count. The
header is saved under `gallery.header` in `data/captions.json`, and the HTML is sanitized
with DOMPurify.

The **?** button (or the `?` key) opens a help panel covering unlocking, the header,
Markdown, descriptions, search, adding media and keyboard shortcuts.

## Editing descriptions & keywords

The edit password is a SecureString in AWS SSM Parameter Store. Set or rotate it with:

```sh
aws ssm put-parameter --name /pixpage/edit-password --type SecureString --overwrite --value 'new-password'
```

The server re-reads it every 60 s, so a rotation takes effect without a restart. In the
browser, click the lock icon, enter the password and use the ✎ buttons. Edits are saved to
`data/captions.json` in the site. For offline testing, `PIXPAGE_EDIT_PASSWORD=…` overrides SSM.

On a plain static host (S3) the site is read-only. The lock icon only appears when the
`api/` endpoints answer.

## Site layout

```
index.html  app.js  app.css  fonts/        frontend (copied from web/dist)
data/media.json (+ .js)                    generated: items, sizes, EXIF (rewritten by builds)
data/captions.json (+ .js)                 your descriptions & keywords (never overwritten)
media/thumbs/<id>.jpg                      720×480 max, shown at 360×240
media/large/<id>.jpg                       2560 px long edge (video poster for videos)
media/video/<id>.mp4                       H.264/HEVC remuxed losslessly; other codecs → H.264
.pixpage/state.json                        build cache — don't publish
```

The `.js` twins let `index.html` open straight from disk (file://), read-only.

Ids come from file names (`IMG_3892.HEIC` → `img-3892`), so captions survive rebuilds.
Note that `media.json` includes GPS coordinates when photos have them.

## Requirements

- [uv](https://docs.astral.sh/uv/) (Python dependencies are declared inline in the script)
- `ffmpeg`/`ffprobe` for videos (`brew install ffmpeg`); without them videos are skipped
- AWS CLI for the edit password

## Frontend development

The UI is React 19 + MUI v9 in `web/src`, bundled with esbuild into `web/dist` (committed, so
running the script needs no Node).

```sh
cd web && npm install && npm run build   # or: npm run watch
```

The next `uv run pixpage.py …` copies the new bundle into the site.

## Ideas for next versions

Publishing to S3 (`aws s3 sync --exclude '.pixpage/*'`) plus a small Lambda behind `api/`
that uses the same SSM password, gallery title/intro editing, Live Photo pairing, albums
from subfolders, maps, and stripping GPS before publishing.
