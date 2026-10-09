# pixpage

**Turn a folder of photos and videos into a beautiful, searchable web gallery.**

pixpage brings back the iPhoto / Photos "Web Page" export that Apple removed, and fixes what
it never handled: HEIC photos, videos, captions you can edit, and search. Point it at a
folder and you get a static website you can browse locally or host on S3.

```sh
uv run pixpage.py ~/Pictures/Oct6
```

- Prints laid out on a table, using the same 360 × 240 thumbnail size as the classic export.
- A Markdown header for the event, with a description and keywords for every photo.
- Detail pages with previous/next, keyboard and swipe navigation.
- Picks up new photos or videos dropped into the folder within seconds.

---

## Contents

- [Quick start](#quick-start)
- [Using the gallery](#using-the-gallery)
- [Editing](#editing)
- [Three ways to view a gallery](#three-ways-to-view-a-gallery)
- [Publishing to S3](#publishing-to-s3)
- [What gets built](#what-gets-built)
- [How it works](#how-it-works)
- [Configuration](#configuration)
- [Frontend development](#frontend-development)
- [Privacy](#privacy)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Quick start

### Requirements

| Tool | Why | Install |
| --- | --- | --- |
| [uv](https://docs.astral.sh/uv/) | Runs the script. Python dependencies (Pillow, pillow-heif, watchfiles) are declared inline and installed automatically | `brew install uv` |
| ffmpeg / ffprobe | Video posters and web playback. Without them, videos are skipped | `brew install ffmpeg` |
| AWS CLI | Stores the edit password; optional publishing to S3 | `brew install awscli` |

Node is **not** needed to run pixpage, because the built frontend is committed in `web/dist`.

### Run it

```sh
git clone git@github.com:skrinak/pixpage.git
cd pixpage
uv run pixpage.py ~/Pictures/Oct6
```

```
[18:12:36] source  /Users/you/Pictures/Oct6
[18:12:36] site    /Users/you/Documents/Websites/Oct6
[18:12:37] processing 68 files…
[18:12:47] gallery: 68 photos, 0 videos
[18:12:47] serving http://127.0.0.1:8000/  — watching for new media (Ctrl-C to stop)
```

Open <http://127.0.0.1:8000/>. The site is written to `~/Documents/Websites/<folder name>/`.

Given the folder of media, the script:

1. builds or updates the site, processing only new or changed files;
2. serves it on `127.0.0.1` (port 8000, or the next free one);
3. watches the folder until you press **Ctrl-C**, and open browsers refresh themselves.

---

## Using the gallery

### Gallery page

- **Header:** an editable Markdown introduction. By default it shows the date range, the
  folder name and the photo/video count.
- **Keyword cloud:** the most-used keywords with counts. Click one to filter; click it again to
  remove the filter.
- **Prints:** each thumbnail sits in a white border with a soft shadow and a slight tilt, like
  photos on a table. Hovering straightens and lifts it. The first two lines of the description
  appear underneath. Videos show a ▶ badge with their duration.
- **Search:** covers descriptions, keywords, file names, dates and camera names. Every word must
  match, and `"quoted phrases"` stay together.
- **Photos / Videos toggle:** appears when the gallery has both.
- **Theme:** light, dark or follow the system.

### Detail page

- Large photo, or a video player with seeking.
- The full description, keywords (click one to search) and details: date and time taken, camera,
  lens, exposure, original size, file name, and location with a map link.
- **Previous / next** with the arrow buttons, the ← → keys, or a swipe on touch screens. When a
  search is active, previous/next stays within the results.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus search |
| `←` `→` | Previous / next photo |
| `Esc` | Back to the gallery |
| `E` | Edit the open photo (editing unlocked) |
| `⌘/Ctrl + Enter` | Save in any edit dialog |
| `?` | Open the help panel |

---

## Editing

Editing works while the pixpage server is running. Everything you write is stored in
`data/captions.json` inside the site. Rebuilds never touch that file, and captions are keyed by
file name, so they survive reprocessing.

### 1. Set the edit password (once)

The password is stored as a SecureString in AWS Systems Manager Parameter Store:

```sh
aws ssm put-parameter --name /pixpage/edit-password --type SecureString \
  --overwrite --value 'choose-a-password'
```

Run the same command to change it. The server re-reads it every 60 seconds, so no restart is
needed. For offline testing, the `PIXPAGE_EDIT_PASSWORD` environment variable overrides SSM.

### 2. Unlock

Click the **lock icon** in the top bar and enter the password. It turns into an **Editing** pill;
click the pill to lock again. Unlocking lasts until the browser tab is closed.

### 3. Edit the header

Click **Edit header** below the title. The editor shows Markdown on the left and a live preview
on the right (Write / Preview tabs on phones).

- The first `# heading` also becomes the top-bar and browser-tab title.
- **Reset to default** restores the date / title / count header.
- Placeholders fill themselves in and stay current as media is added:

| Placeholder | Becomes |
| --- | --- |
| `{{title}}` | Source folder name |
| `{{dates}}` | Date range of the media, e.g. *Oct 6, 2026* |
| `{{counts}}` | *68 photos · 2 videos* |
| `{{photos}}` | *68 photos* |
| `{{videos}}` | *2 videos* |
| `{{count}}` | Total number of items |

Example:

```markdown
###### {{dates}} · AWS Headquarters, Midtown Manhattan

# Modernizing the AI Estate for Financial Services

Financial services leaders gathered for a day of deep dives with six AWS Partners.
**{{counts}}** from the day.

> Three founders, one podium.
```

Headings, paragraphs, **bold**, *italic*, links, images, lists, quotes, tables and `---` dividers
are supported. The output is sanitized with DOMPurify: scripts, event handlers and
`javascript:` links are removed.

### 4. Describe photos

- On the gallery page, click **Add description** or the ✎ button on a print.
- On a detail page, click **Edit** or press **E**.
- Type the description, which can be any length. To add keywords, type them and press **Enter**
  or a comma; earlier keywords are suggested as you type. Save with **⌘/Ctrl + Enter**.

The gallery shows two lines of each description; the detail page shows all of it. Keywords
are searchable and appear in the keyword cloud and on the detail page.

### Help panel

The **?** button (or the `?` key) opens a help panel with these instructions, a Markdown
quick reference and the keyboard shortcuts. Like the lock, it only appears when the server is
running, so visitors to a published site never see editing instructions.

---

## Three ways to view a gallery

| How | Command / URL | Editing | Live updates |
| --- | --- | --- | --- |
| **Local server** | `uv run pixpage.py <folder>` → `http://127.0.0.1:8000/` | ✅ | ✅ new media appears automatically |
| **Straight from disk** | double-click `~/Documents/Websites/<name>/index.html` | — | — snapshot as of the last build |
| **Static hosting (S3)** | see below | — | — re-upload to update |

Opening from disk works because every `data/*.json` file has a `data/*.js` twin that the page
loads with an ordinary `<script>` tag. Browsers block `fetch()` on `file://` URLs, so the
JSON files alone wouldn't load.

---

## Publishing to S3

One command builds the site, uploads it and refreshes CloudFront:

```sh
uv run pixpage.py ~/Pictures/Oct6 --publish s3://<bucket>/Websites/Oct6   # first time
uv run pixpage.py ~/Pictures/Oct6 --publish                               # afterwards
```

```
[21:56:46] publishing to s3://test.tube/Websites/Oct6  (region us-east-1, public-read ACL)
[21:56:47]   media   0 uploaded, 0 removed
[21:56:50]   fonts   10 uploaded
[21:56:51]   site    1 uploaded (page, app, data, assets)
[21:56:52] website http://test.tube.s3-website-us-east-1.amazonaws.com/Websites/Oct6/
[21:56:54] https   https://dpxcj177comrd.cloudfront.net/Websites/Oct6/  (CloudFront E3GYOKCU59QU2W refreshed)
```

What `--publish` does:

- **Builds first** (incrementally), then exits instead of serving.
- **Finds the bucket's region itself.** A wrong region makes every request redirect, and large
  uploads time out.
- **Uses `--acl public-read` only if the bucket allows ACLs.** With ACLs disabled, public access
  must come from the bucket policy.
- **Uploads in three passes with suitable cache headers:**
  - `media/`: cached for a day. This is the only pass that deletes, so photos removed locally
    disappear from S3, but nothing else under the prefix can be touched.
  - `fonts/`: `font/woff2`, cached for a year.
  - Page, `app.js`/`app.css`, `data/` and `assets/`: `no-cache`, so edits show up at once.
- **Never uploads** `.pixpage/` (the build cache), `.DS_Store` or temp files.
- **Prints the S3 website URL** if website hosting is enabled.
- **Refreshes CloudFront:** every enabled distribution whose origin is the bucket is invalidated
  for the gallery's path, and its `https://` URL is printed.
- **Remembers the target** in `.pixpage/publish.json`, so later runs only need `--publish`.

Only changed files are uploaded, so re-publishing is quick and resumes interrupted uploads.

Bucket setup (once): enable **static website hosting** with index document `index.html`, and
allow public reads (bucket policy granting `s3:GetObject`, or ACLs). S3 website endpoints are
http-only; put CloudFront in front for https. The published site has no edit API, so it is
read-only and hides the lock and help.

---

## What gets built

```
~/Documents/Websites/<folder>/
├── index.html                 page shell
├── app.js  app.css  fonts/    frontend (copied from web/dist on every run)
├── data/
│   ├── media.json  (+ .js)    generated: items, sizes, dates, EXIF — rewritten by builds
│   └── captions.json (+ .js)  your header, descriptions & keywords — never overwritten
├── media/
│   ├── thumbs/<id>.jpg        fit within 720 × 480, shown at 360 × 240 (2× for retina)
│   ├── large/<id>.jpg         2560 px on the long side; for videos, the poster frame
│   └── video/<id>.mp4         web-playable video
└── .pixpage/state.json        build cache (do not publish)
```

**IDs** come from file names: `IMG_3892.HEIC` → `img-3892`. When a photo and a video share a name
(e.g. a Live Photo pair), the extension is appended: `img-3892-heic`, `img-3892-mov`.

### Supported formats

| Photos | Videos |
| --- | --- |
| HEIC/HEIF, JPEG, PNG, TIFF, WebP, AVIF, GIF, BMP | MOV, MP4, M4V, AVI, MKV, WebM, 3GP, MTS/M2TS |

Only files directly inside the folder are used. Subfolders and hidden files are ignored.

---

## How it works

**Photos** (Pillow + pillow-heif): EXIF orientation is applied, transparency is flattened onto
white, and the large image and thumbnail are written as progressive JPEGs. The embedded colour
profile is kept, so iPhone Display P3 colours survive. The EXIF date, camera, lens, exposure and
GPS are extracted.

**Videos** (ffmpeg / ffprobe): a poster frame is taken about 1 s in, and the video is made
web-playable:

- **H.264 or HEVC** is remuxed into a fast-start MP4 without re-encoding: lossless and quick.
  HEVC is tagged `hvc1` for Safari and Chrome on macOS.
- **Anything else** is transcoded to H.264/AAC, capped at 1920 px and never upscaled.
- Apple's `creationdate` tag supplies the local capture time, and the location is read when
  present.

**Incremental builds**: `.pixpage/state.json` records each file's size and modification time.
Unchanged files are skipped. Removed files have their outputs deleted. Processing runs in
parallel across CPU cores, and one bad file is logged and skipped rather than stopping the build.

**Watching** (watchfiles): changes are debounced, and the watcher waits until files stop growing,
so AirDrop or Finder copies in progress aren't processed half-written. Each rebuild bumps a
version number that open browsers poll every 3 seconds; when it changes, they reload the data.

**Server**: a small threaded HTTP server bound to `127.0.0.1`. It supports byte ranges, which
Safari requires for video, and marks `index.html` and `data/` as `no-store`. The edit API:

| Endpoint | Body | Purpose |
| --- | --- | --- |
| `GET  /api/status` | — | `{version}`; its presence enables editing in the UI |
| `POST /api/login` | — | Checks the password |
| `POST /api/captions` | `{id, description, keywords[]}` | Saves one item's caption |
| `POST /api/gallery` | `{header}` | Saves the Markdown header (empty = default) |

POST requests carry the password in an `X-Pixpage-Password` header. It is compared in constant
time, and wrong attempts are delayed. Limits: descriptions and the header up to 20,000
characters; up to 64 keywords of 80 characters each.

---

## Configuration

pixpage takes only the folder (plus `--publish`). To change other settings, edit the constants
at the top of `pixpage.py`:

| Constant | Default | Meaning |
| --- | --- | --- |
| `SITES_ROOT` | `~/Documents/Websites` | Where sites are written |
| `THUMB_BOX` | `(360, 240)` | Thumbnail display box |
| `THUMB_SCALE` | `2` | Thumbnail pixel density |
| `LARGE_MAX` | `2560` | Long side of detail images |
| `PORT` | `8000` | First port to try |
| `PASSWORD_PARAM` | `/pixpage/edit-password` | SSM parameter name |
| `PIPELINE` | `1` | Bump to force all media to be reprocessed |

Environment: `PIXPAGE_EDIT_PASSWORD` overrides the SSM password.

---

## Frontend development

The UI is **React 19 + MUI v9**, with Inter and Fraunces variable fonts (via Fontsource). It is
bundled by **esbuild** into a single self-contained `web/dist/app.js`, with no CDN dependencies
at runtime.

```sh
cd web
npm install
npm run build     # or: npm run watch
```

The next `uv run pixpage.py …` copies the new bundle into the site.

| File | Role |
| --- | --- |
| `src/main.jsx` | Entry: theme provider, fonts |
| `src/App.jsx` | Data loading, live-update polling, routing, dialogs |
| `src/Gallery.jsx` | Gallery page: top bar, header, keyword cloud, grid |
| `src/Detail.jsx` | Detail page: media, navigation, details |
| `src/Print.jsx` | The "print on a table" frame and video badge |
| `src/Header.jsx` | Markdown header renderer and editor |
| `src/Dialogs.jsx` | Caption editor and unlock dialog |
| `src/Help.jsx` | Help panel |
| `src/markdown.js` | Markdown (marked + DOMPurify), placeholders |
| `src/theme.js` | Palette, typography, table texture |
| `src/route.js` | Hash routing (`#/`, `#/m/<id>?q=…`), so it works on any static host |
| `src/api.js` | Data and edit-API calls |
| `src/util.js` | Dates, search, keywords |

---

## Privacy

- **Location:** `data/media.json` includes the GPS coordinates of photos that have them, and the
  detail page links to a map. Consider this before publishing photos taken at home.
- **Unlisted, not private:** a published site can be viewed by anyone who has the URL.
- **Local only:** the edit API listens only on `127.0.0.1`. The password is never written into
  the site.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `editing locked: no password (… ParameterNotFound)` | Set the password with `aws ssm put-parameter` (see [Editing](#editing)). |
| No lock icon | Editing needs the local server. Pages opened from disk or S3 are read-only. |
| “The edit password changed — unlock again” | The password was rotated; unlock with the new one. |
| `ffmpeg/ffprobe not found — videos are skipped` | `brew install ffmpeg`, then re-run. |
| `… was built from …, not …` | Two source folders share a name; rename one. Each site is tied to its source. |
| `… exists and wasn't made by pixpage` | pixpage won't overwrite an existing, unrelated folder in `~/Documents/Websites`. |
| CORS error opening `index.html` from disk | Rebuild with the current version, which writes the `data/*.js` twins. |
| S3 uploads time out | `--publish` picks the bucket's region automatically; if it still times out, check your upload bandwidth. |
| Washed-out iPhone HDR video posters | Known limitation: HDR is not tone-mapped yet. |

---

## Roadmap

- A small Lambda behind `api/` (same SSM password) for editing the published site online
- Live Photo pairing (play the motion clip on the photo)
- Albums from subfolders, and a map view
- Option to strip GPS before publishing
- HDR tone-mapping for video posters
