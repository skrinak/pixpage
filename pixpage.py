#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "pillow>=11.0",
#   "pillow-heif>=1.0",
#   "watchfiles>=1.0",
# ]
# ///
"""pixpage — turn a folder of photos and videos into a browsable web gallery.

    uv run pixpage.py ~/Pictures/Oct6

Builds ~/Documents/Websites/<folder name>/, serves it at http://127.0.0.1:8000 and
keeps watching the source folder: new, changed or removed media are picked up
automatically and open browsers refresh themselves.

The gallery is a static site (index.html + data/*.json + media/), so it can later be
copied to S3 as-is. Descriptions and keywords live in data/captions.json and are
edited from the browser after unlocking with the edit password, which is stored in
AWS SSM Parameter Store:

    aws ssm put-parameter --name /pixpage/edit-password --type SecureString \
        --overwrite --value 'your-password'

(PIXPAGE_EDIT_PASSWORD, if set, overrides SSM — handy offline.)
"""

from __future__ import annotations

import hmac
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()

APP_DIR = Path(__file__).resolve().parent
WEB_DIST = APP_DIR / "web" / "dist"
SITES_ROOT = Path.home() / "Documents" / "Websites"

PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".hif", ".tif", ".tiff", ".webp", ".avif", ".bmp", ".gif"}
VIDEO_EXTS = {".mov", ".mp4", ".m4v", ".avi", ".mkv", ".webm", ".3gp", ".mts", ".m2ts"}

THUMB_BOX = (360, 240)  # display size, same as the old iPhoto "web page" export
THUMB_SCALE = 2  # thumbnails are rendered at 2x for sharp retina displays
LARGE_MAX = 2560  # long edge of the detail-page image
PIPELINE = 1  # bump when output formats change to force regeneration

PASSWORD_PARAM = "/pixpage/edit-password"
PASSWORD_TTL = 60  # seconds; re-read from SSM so `aws ssm put-parameter` takes effect quickly
PORT = 8000

MAX_DESCRIPTION = 20_000
MAX_KEYWORDS = 64
MAX_KEYWORD_LEN = 80


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def write_json(path: Path, data) -> None:
    """Atomic write so a browser never sees a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    text = json.dumps(data, ensure_ascii=False, indent=1)
    tmp.write_text(text)
    os.replace(tmp, path)
    if path.parent.name == "data":
        # Script twin (data/x.js) so index.html also works when opened straight from disk,
        # where browsers refuse fetch() on file:// URLs.
        js, tmp = path.with_suffix(".js"), path.with_suffix(".js.tmp")
        tmp.write_text(f"(window.PIXPAGE_DATA = window.PIXPAGE_DATA || {{}})[{json.dumps(path.stem)}] = {text};\n")
        os.replace(tmp, js)


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


# --------------------------------------------------------------------------- media


def media_kind(path: Path) -> str | None:
    if path.name.startswith("."):
        return None
    ext = path.suffix.lower()
    return "photo" if ext in PHOTO_EXTS else "video" if ext in VIDEO_EXTS else None


def scan(src: Path) -> list[Path]:
    return sorted((p for p in src.iterdir() if p.is_file() and media_kind(p)), key=lambda p: p.name.lower())


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "item"


def assign_ids(files: list[Path]) -> dict[str, str]:
    """Stable, URL-friendly ids from file names (IMG_3892.HEIC -> img-3892).
    A photo and video sharing a name (e.g. Live Photos) get the extension appended."""
    stems: dict[str, int] = {}
    for f in files:
        stems[slug(f.stem)] = stems.get(slug(f.stem), 0) + 1
    return {f.name: slug(f.stem) if stems[slug(f.stem)] == 1 else slug(f.name) for f in files}


def save_jpeg(im: Image.Image, path: Path, quality: int, icc: bytes | None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.jpg")
    im.save(tmp, "JPEG", quality=quality, optimize=True, progressive=True, icc_profile=icc)
    os.replace(tmp, path)


def render_sizes(im: Image.Image, out: Path, item_id: str, icc: bytes | None) -> dict:
    """Write the large and thumbnail JPEGs; keep the colour profile (iPhone shoots Display P3)."""
    large = im.copy()
    large.thumbnail((LARGE_MAX, LARGE_MAX), Image.LANCZOS, reducing_gap=3.0)
    save_jpeg(large, out / "media" / "large" / f"{item_id}.jpg", 86, icc)
    thumb = large.copy()
    thumb.thumbnail((THUMB_BOX[0] * THUMB_SCALE, THUMB_BOX[1] * THUMB_SCALE), Image.LANCZOS)
    save_jpeg(thumb, out / "media" / "thumbs" / f"{item_id}.jpg", 80, icc)
    return {
        "w": large.width,
        "h": large.height,
        "large": f"media/large/{item_id}.jpg",
        "thumb": {"src": f"media/thumbs/{item_id}.jpg", "w": thumb.width, "h": thumb.height},
    }


def to_rgb(im: Image.Image) -> Image.Image:
    if im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.getchannel("A"))
        return bg
    return im if im.mode == "RGB" else im.convert("RGB")


def _num(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    return f if f == f else None  # drop NaN


def _round(v, nd=1):
    f = _num(v)
    if f is None:
        return None
    r = round(f, nd)
    return int(r) if r == int(r) else r


def exif_info(exif) -> dict:
    ifd = exif.get_ifd(0x8769)
    gps_ifd = exif.get_ifd(0x8825)
    info: dict = {}

    raw = ifd.get(36867) or ifd.get(36868) or exif.get(306)
    if isinstance(raw, str):
        try:
            info["taken"] = datetime.strptime(raw.strip()[:19], "%Y:%m:%d %H:%M:%S").isoformat()
            if off := ifd.get(36881):
                info["taken"] += off.strip()
        except ValueError:
            pass

    cam = {k: v.strip("\x00 ").strip() for k, v in (("make", exif.get(271)), ("model", exif.get(272)), ("lens", ifd.get(42036))) if isinstance(v, str) and v.strip("\x00 ")}
    if cam:
        info["camera"] = cam

    ex: dict = {}
    if f := _round(ifd.get(33437)):
        ex["f"] = f
    if (t := _num(ifd.get(33434))) and t > 0:
        ex["t"] = f"1/{round(1 / t)}" if t < 1 else str(_round(t))
    if iso := ifd.get(34855):
        ex["iso"] = int(iso[0] if isinstance(iso, tuple) else iso)
    if mm := _round(ifd.get(37386)):
        ex["mm"] = mm
    if mm35 := ifd.get(41989):
        ex["mm35"] = int(mm35)
    if ex:
        info["exposure"] = ex

    def dms(v):
        d, m, s = (_num(x) or 0.0 for x in v)
        return d + m / 60 + s / 3600

    try:
        if 2 in gps_ifd and 4 in gps_ifd:
            lat = dms(gps_ifd[2]) * (-1 if gps_ifd.get(1) == "S" else 1)
            lon = dms(gps_ifd[4]) * (-1 if gps_ifd.get(3) == "W" else 1)
            if lat or lon:
                info["gps"] = {"lat": round(lat, 6), "lon": round(lon, 6)}
    except (TypeError, ValueError):
        pass
    return info


def process_photo(src: str, out: str, item_id: str) -> dict:
    with Image.open(src) as im:
        exif = im.getexif()
        icc = im.info.get("icc_profile")
        orig = ImageOps.exif_transpose(im)
        item = {"type": "photo", "orig": {"w": orig.width, "h": orig.height}}
        item |= render_sizes(to_rgb(orig), Path(out), item_id, icc)
    item |= exif_info(exif)
    return item


def ffprobe(src: str) -> dict:
    res = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", src],
        capture_output=True, text=True, check=True,
    )
    return json.loads(res.stdout)


def video_taken(fmt_tags: dict) -> str | None:
    # Apple writes the local wall-clock time with offset; creation_time is UTC.
    apple = fmt_tags.get("com.apple.quicktime.creationdate")
    if apple:
        try:
            return datetime.fromisoformat(apple.replace("Z", "+00:00")).isoformat()
        except ValueError:
            pass
    utc = fmt_tags.get("creation_time")
    if utc:
        try:
            return datetime.fromisoformat(utc.replace("Z", "+00:00")).astimezone().isoformat()
        except ValueError:
            pass
    return None


def process_video(src: str, out: str, item_id: str) -> dict:
    outp = Path(out)
    probe = ffprobe(src)
    fmt = probe.get("format", {})
    tags = {k.lower(): v for k, v in (fmt.get("tags") or {}).items()}
    vs = next((s for s in probe.get("streams", []) if s.get("codec_type") == "video"), None)
    if not vs:
        raise ValueError("no video stream")
    aud = next((s for s in probe.get("streams", []) if s.get("codec_type") == "audio"), None)
    duration = _num(fmt.get("duration")) or _num(vs.get("duration")) or 0.0
    width, height = vs.get("width", 0), vs.get("height", 0)
    rotation = 0
    for sd in vs.get("side_data_list", []) or []:
        rotation = int(_num(sd.get("rotation")) or rotation)
    rotation = int(_num((vs.get("tags") or {}).get("rotate")) or rotation)
    if abs(rotation) % 180 == 90:
        width, height = height, width

    # Poster frame (ffmpeg applies rotation itself), then sizes via Pillow.
    poster = outp / "media" / "posters" / f"{item_id}.jpg"
    poster.parent.mkdir(parents=True, exist_ok=True)
    seek = f"{min(1.0, duration / 2):.2f}"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-ss", seek, "-i", src, "-frames:v", "1",
         "-vf", f"scale=w='min({LARGE_MAX},iw)':h='min({LARGE_MAX},ih)':force_original_aspect_ratio=decrease", "-q:v", "2", str(poster)],
        check=True, capture_output=True,
    )
    with Image.open(poster) as im:
        item = render_sizes(to_rgb(im), outp, item_id, None)
    poster.unlink(missing_ok=True)

    # Web playback: remux H.264/HEVC into a fast-start MP4 (lossless, quick);
    # anything else is transcoded to H.264/AAC.
    dest = outp / "media" / "video" / f"{item_id}.mp4"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp.mp4")
    vcodec = vs.get("codec_name")
    acodec = aud.get("codec_name") if aud else None
    base = ["ffmpeg", "-y", "-v", "error", "-i", src, "-map", "0:v:0", "-map", "0:a:0?", "-movflags", "+faststart"]
    remux = base + ["-c:v", "copy"] + (["-tag:v", "hvc1"] if vcodec == "hevc" else []) + (
        ["-c:a", "copy"] if acodec in {"aac", "mp3", "alac", "ac3", "eac3", "opus"} else ["-c:a", "aac", "-b:a", "192k"]
    ) + [str(tmp)]
    transcode = base + [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
        "-vf", "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-c:a", "aac", "-b:a", "160k", str(tmp),
    ]
    if vcodec not in {"h264", "hevc"} or subprocess.run(remux, capture_output=True).returncode != 0:
        subprocess.run(transcode, check=True, capture_output=True)
    os.replace(tmp, dest)

    item |= {
        "type": "video",
        "video": f"media/video/{item_id}.mp4",
        "duration": round(duration, 2),
        "orig": {"w": width, "h": height},
    }
    if taken := video_taken(tags):
        item["taken"] = taken
    cam = {k: tags[t] for k, t in (("make", "com.apple.quicktime.make"), ("model", "com.apple.quicktime.model")) if tags.get(t)}
    if cam:
        item["camera"] = cam
    if loc := tags.get("com.apple.quicktime.location.iso6709") or tags.get("location"):
        if m := re.match(r"([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)", loc):
            item["gps"] = {"lat": float(m.group(1)), "lon": float(m.group(2))}
    return item


def process(kind: str, src: str, out: str, item_id: str) -> dict:
    return (process_photo if kind == "photo" else process_video)(src, out, item_id)


# --------------------------------------------------------------------------- build


def item_outputs(out: Path, item: dict) -> list[Path]:
    paths = [item.get("large"), item.get("thumb", {}).get("src"), item.get("video")]
    return [out / p for p in paths if p]


def install_frontend(out: Path, title: str) -> None:
    if not (WEB_DIST / "app.js").exists():
        sys.exit(f"Frontend bundle missing: {WEB_DIST}/app.js — run `npm install && npm run build` in {APP_DIR / 'web'}")
    for name in ("app.js", "app.css"):
        shutil.copy2(WEB_DIST / name, out / name)
    shutil.copytree(WEB_DIST / "fonts", out / "fonts", dirs_exist_ok=True)
    esc = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    version = int((WEB_DIST / "app.js").stat().st_mtime)
    (out / "index.html").write_text(f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="generator" content="pixpage">
<title>{esc}</title>
<link rel="stylesheet" href="app.css?v={version}">
<script src="data/media.js"></script>
<script src="data/captions.js"></script>
<style>body{{margin:0;background:#ebe5da}}@media (prefers-color-scheme:dark){{body{{background:#1a1917}}}}</style>
</head>
<body>
<div id="root"></div>
<noscript>This gallery needs JavaScript.</noscript>
<script defer src="app.js?v={version}"></script>
</body>
</html>
""")


class Builder:
    """Incremental: only new or changed files are processed; outputs of removed files are deleted."""

    def __init__(self, src: Path, out: Path):
        self.src, self.out = src, out
        self.state_path = out / ".pixpage" / "state.json"
        self.lock = threading.Lock()
        self.has_ffmpeg = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))
        self.warned_ffmpeg = False

    def build(self) -> bool:
        with self.lock:
            return self._build()

    def _build(self) -> bool:
        state = read_json(self.state_path, {})
        known = state.get("files", {}) if state.get("pipeline") == PIPELINE else {}
        files = scan(self.src)
        ids = assign_ids(files)
        entries: dict[str, dict] = {}
        todo: list[tuple[Path, str, list[int]]] = []

        for f in files:
            st = f.stat()
            sig = [st.st_size, st.st_mtime_ns]
            prev = known.get(f.name)
            if prev and prev["sig"] == sig and prev["item"]["id"] == ids[f.name] and all(p.exists() for p in item_outputs(self.out, prev["item"])):
                entries[f.name] = prev
            elif media_kind(f) == "video" and not self.has_ffmpeg:
                if not self.warned_ffmpeg:
                    log("ffmpeg/ffprobe not found — videos are skipped (brew install ffmpeg)")
                    self.warned_ffmpeg = True
            else:
                todo.append((f, ids[f.name], sig))

        removed = [name for name in known if name not in entries and name not in {f.name for f, _, _ in todo}]
        for name in removed:
            for p in item_outputs(self.out, known[name]["item"]):
                p.unlink(missing_ok=True)
            log(f"removed {name}")

        if todo:
            log(f"processing {len(todo)} file{'s' if len(todo) != 1 else ''}…")
            workers = max(1, min(len(todo), (os.cpu_count() or 4) - 1, 8))
            with ProcessPoolExecutor(max_workers=workers) as pool:
                futures = {pool.submit(process, media_kind(f), str(f), str(self.out), item_id): (f, item_id, sig) for f, item_id, sig in todo}
                for n, fut in enumerate(as_completed(futures), 1):
                    f, item_id, sig = futures[fut]
                    try:
                        item = fut.result()
                    except Exception as e:  # noqa: BLE001 — a bad file must not stop the gallery
                        detail = e.stderr.decode(errors="replace").strip() if isinstance(e, subprocess.CalledProcessError) and e.stderr else e
                        log(f"  ✗ {f.name}: {detail}")
                        continue
                    if "taken" not in item:
                        item["taken"] = datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds")
                    item = {"id": item_id, "name": f.name} | item
                    entries[f.name] = {"sig": sig, "item": item}
                    log(f"  ✓ [{n}/{len(todo)}] {f.name}")

        changed = bool(todo or removed) or not (self.out / "data" / "media.js").exists()
        if changed:
            items = sorted((e["item"] for e in entries.values()), key=lambda it: (it.get("taken", ""), it["name"].lower()))
            write_json(self.out / "data" / "media.json", {
                "schema": 1,
                "title": self.src.name,
                "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "items": items,
            })
            write_json(self.state_path, {"pipeline": PIPELINE, "source": str(self.src), "files": entries})
            photos = sum(1 for it in items if it["type"] == "photo")
            videos = len(items) - photos
            log(f"gallery: {photos} photo{'' if photos == 1 else 's'}, {videos} video{'' if videos == 1 else 's'}")
        captions = self.out / "data" / "captions.json"
        if not captions.with_suffix(".js").exists():
            write_json(captions, read_json(captions, {"schema": 1, "items": {}}))
        return changed


# --------------------------------------------------------------------------- password


class Password:
    """The edit password lives in SSM so it can be rotated with the AWS CLI."""

    def __init__(self):
        self.value: str | None = None
        self.fetched = 0.0
        self.error: str | None = None
        self.lock = threading.Lock()

    def get(self) -> str | None:
        if env := os.environ.get("PIXPAGE_EDIT_PASSWORD"):
            return env
        with self.lock:
            if time.monotonic() - self.fetched < PASSWORD_TTL:
                return self.value
            try:
                res = subprocess.run(
                    ["aws", "ssm", "get-parameter", "--name", PASSWORD_PARAM, "--with-decryption",
                     "--query", "Parameter.Value", "--output", "text"],
                    capture_output=True, text=True, timeout=20,
                )
                if res.returncode == 0 and res.stdout.strip():
                    self.value, self.error = res.stdout.rstrip("\n"), None
                else:
                    self.value, self.error = None, (res.stderr.strip().splitlines() or ["empty parameter"])[-1]
            except (OSError, subprocess.TimeoutExpired) as e:
                self.value, self.error = None, str(e)
            self.fetched = time.monotonic()
            return self.value

    def check(self, attempt: str) -> bool | None:
        """True/False, or None when no password is configured."""
        actual = self.get()
        if actual is None:
            return None
        return hmac.compare_digest(attempt.encode(), actual.encode())


# --------------------------------------------------------------------------- server


mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("video/mp4", ".mp4")


class Site:
    def __init__(self, out: Path, builder: Builder):
        self.out = out
        self.builder = builder
        self.version = 1
        self.password = Password()
        self.captions_lock = threading.Lock()

    def bump(self) -> None:
        self.version += 1


def make_handler(site: Site):
    class Handler(SimpleHTTPRequestHandler):
        server_version = "pixpage"

        def __init__(self, *args, **kwargs):
            self._range: int | None = None
            super().__init__(*args, directory=str(site.out), **kwargs)

        def log_message(self, fmt, *args):  # quiet; errors are logged explicitly
            pass

        def end_headers(self):
            path = self.path.split("?")[0]
            if path.startswith(("/data/", "/api/")) or path in ("/", "/index.html"):
                self.send_header("Cache-Control", "no-store")
            self.send_header("Accept-Ranges", "bytes")
            super().end_headers()

        def send_json(self, status: int, body: dict) -> None:
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path == "/api/status":
                return self.send_json(200, {"version": site.version, "editing": True})
            if path.startswith("/.pixpage"):
                return self.send_error(HTTPStatus.NOT_FOUND)
            return super().do_GET()

        # Byte ranges: Safari will not play <video> without them, and seeking needs them.
        def send_head(self):
            rng = self.headers.get("Range")
            path = self.translate_path(self.path)
            m = rng and re.fullmatch(r"bytes=(\d*)-(\d*)", rng.strip())
            if not m or not os.path.isfile(path) or (not m.group(1) and not m.group(2)):
                return super().send_head()
            size = os.path.getsize(path)
            start, end = m.groups()
            if start:
                start, end = int(start), min(int(end), size - 1) if end else size - 1
            else:
                start, end = max(0, size - int(end)), size - 1
            if start >= size or start > end:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return None
            f = open(path, "rb")
            f.seek(start)
            self.send_response(HTTPStatus.PARTIAL_CONTENT)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.end_headers()
            self._range = end - start + 1
            return f

        def copyfile(self, source, outputfile):
            if self._range is None:
                return super().copyfile(source, outputfile)
            remaining = self._range
            while remaining > 0 and (chunk := source.read(min(256 * 1024, remaining))):
                outputfile.write(chunk)
                remaining -= len(chunk)

        def do_POST(self):
            path = self.path.split("?")[0]
            if path not in ("/api/login", "/api/captions", "/api/gallery"):
                return self.send_json(404, {"error": "not found"})
            try:
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(min(length, 1_000_000)) or b"{}")
            except (ValueError, json.JSONDecodeError):
                return self.send_json(400, {"error": "invalid JSON"})

            ok = site.password.check(self.headers.get("X-Pixpage-Password", ""))
            if ok is None:
                return self.send_json(503, {"error": f"No edit password set. Run: aws ssm put-parameter --name {PASSWORD_PARAM} --type SecureString --value '…'"})
            if not ok:
                time.sleep(0.6)  # slow down guessing
                return self.send_json(401, {"error": "wrong password"})
            if path == "/api/login":
                return self.send_json(200, {"ok": True})
            if path == "/api/gallery":
                return self.save_gallery(body)
            return self.save_caption(body)

        def save_caption(self, body: dict):
            item_id = body.get("id")
            media = read_json(site.out / "data" / "media.json", {"items": []})
            if not isinstance(item_id, str) or item_id not in {it["id"] for it in media["items"]}:
                return self.send_json(400, {"error": "unknown item"})
            description = body.get("description", "")
            keywords = body.get("keywords", [])
            if not isinstance(description, str) or not isinstance(keywords, list) or not all(isinstance(k, str) for k in keywords):
                return self.send_json(400, {"error": "description must be text and keywords a list of text"})
            seen, clean = set(), []
            for k in keywords:
                k = " ".join(k.split()).lstrip("#")[:MAX_KEYWORD_LEN]
                if k and k.lower() not in seen:
                    seen.add(k.lower())
                    clean.append(k)
            caption = {
                "description": description.strip()[:MAX_DESCRIPTION],
                "keywords": clean[:MAX_KEYWORDS],
                "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            with site.captions_lock:
                path = site.out / "data" / "captions.json"
                data = read_json(path, {"schema": 1, "items": {}})
                data.setdefault("items", {})[item_id] = caption
                write_json(path, data)
                site.bump()
            log(f"caption saved for {item_id}")
            return self.send_json(200, {"ok": True, "caption": caption})

        def save_gallery(self, body: dict):
            """Gallery-wide text: the Markdown header. An empty header means "use the default"."""
            header = body.get("header", "")
            if not isinstance(header, str) or len(header) > MAX_DESCRIPTION:
                return self.send_json(400, {"error": f"header must be text up to {MAX_DESCRIPTION} characters"})
            with site.captions_lock:
                path = site.out / "data" / "captions.json"
                data = read_json(path, {"schema": 1, "items": {}})
                gallery = data.setdefault("gallery", {})
                if header.strip():
                    gallery["header"] = header.strip()
                else:
                    gallery.pop("header", None)
                gallery["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
                write_json(path, data)
                site.bump()
            log("gallery header saved" if header.strip() else "gallery header reset to default")
            return self.send_json(200, {"ok": True, "gallery": gallery})

    return Handler


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            return  # browsers drop video connections when seeking; that's normal
        super().handle_error(request, client_address)


def start_server(site: Site) -> Server:
    handler = make_handler(site)
    for port in range(PORT, PORT + 50):
        try:
            server = Server(("127.0.0.1", port), handler)
            break
        except OSError:
            continue
    else:
        sys.exit(f"No free port in {PORT}–{PORT + 49}")
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


# --------------------------------------------------------------------------- watch


def wait_until_stable(paths: set[Path], quiet: float = 2.0, timeout: float = 600) -> None:
    """Files still being copied (AirDrop, Finder, card readers) keep growing; wait them out."""
    deadline = time.monotonic() + timeout
    last: dict[Path, tuple] = {}
    while time.monotonic() < deadline:
        now = {}
        for p in paths:
            try:
                st = p.stat()
                now[p] = (st.st_size, st.st_mtime_ns)
            except FileNotFoundError:
                now[p] = None
        if now == last:
            return
        last = now
        time.sleep(quiet)


def watch_source(src: Path, site: Site) -> None:
    from watchfiles import watch

    def relevant(_change, path: str) -> bool:
        p = Path(path)
        return p.parent == src and media_kind(p) is not None

    for changes in watch(src, watch_filter=relevant, debounce=2000, step=200):
        wait_until_stable({Path(p) for _, p in changes})
        try:
            if site.builder.build():
                site.bump()
        except Exception as e:  # noqa: BLE001 — keep watching
            log(f"rebuild failed: {e}")


# --------------------------------------------------------------------------- main


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__.strip())
        sys.exit(0 if len(sys.argv) == 2 else 2)
    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.is_dir():
        sys.exit(f"Not a folder: {src}")
    out = SITES_ROOT / src.name
    state = read_json(out / ".pixpage" / "state.json", {})
    if state.get("source") and state["source"] != str(src):
        sys.exit(f"{out} was built from {state['source']}, not {src}. Rename one of the folders.")
    if out.exists() and not state and any(out.iterdir()):
        sys.exit(f"{out} exists and wasn't made by pixpage — refusing to overwrite it.")
    out.mkdir(parents=True, exist_ok=True)
    (out / ".pixpage").mkdir(exist_ok=True)

    log(f"source  {src}")
    log(f"site    {out}")
    install_frontend(out, src.name)
    builder = Builder(src, out)
    site = Site(out, builder)
    if site.password.get() is None:
        log(f"editing locked: no password ({site.password.error or 'not set'})")
        log(f"  set one with: aws ssm put-parameter --name {PASSWORD_PARAM} --type SecureString --overwrite --value '…'")
    builder.build()

    server = start_server(site)
    host, port = server.server_address[:2]
    log(f"serving http://{host}:{port}/  — watching for new media (Ctrl-C to stop)")
    try:
        watch_source(src, site)
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        log("stopped")


if __name__ == "__main__":
    main()
