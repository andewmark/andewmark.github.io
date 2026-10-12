#!/usr/bin/env python3
"""Rebuild photos.json from the files in the photos/ folder.

Usage (from the site folder):  python3 tools/update-photos.py

What it does on each run:
- Adds any new image in photos/ to photos.json (title comes from the file name).
- Keeps what you've typed by hand: title, place, date, tags, featured, alt.
- Drops entries whose file no longer exists.
- Reads camera settings (EXIF) straight from each photo and stores them under
  an "exif" key. This part is refreshed every run, so don't edit it by hand.
- Fills in "date" from the photo's capture date, but only if you left it empty.
- Reads width/height, accounting for rotated (portrait) photos.

Needs Pillow:  pip install pillow
"""
import json, os, re, sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Install Pillow first:  pip install pillow")

from datetime import datetime

root = Path(__file__).resolve().parent.parent
photo_dir = root / "photos"
manifest = root / "photos.json"
exts = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}

# EXIF tag numbers
ORIENTATION, MAKE, MODEL = 274, 271, 272
EXIF_IFD = 0x8769
EXPOSURE, FNUMBER, ISO, ISO_ALT = 33434, 33437, 34855, 34867
DATE_ORIGINAL, FOCAL, FOCAL_35, LENS = 36867, 37386, 41989, 42036


def num(v):
    """EXIF rationals come back as numbers or (num, den) tuples."""
    try:
        if isinstance(v, tuple):
            return v[0] / v[1] if v[1] else None
        return float(v)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def clean(v):
    return str(v).replace("\x00", "").strip() if v is not None else ""


def read_exif(im):
    """Return (settings dict, capture datetime or None, orientation)."""
    try:
        raw = im.getexif()
    except Exception:
        return {}, None, 1
    if not raw:
        return {}, None, 1
    try:
        ifd = raw.get_ifd(EXIF_IFD)
    except Exception:
        ifd = {}
    get = lambda tag: ifd.get(tag, raw.get(tag))

    out = {}

    make, model = clean(raw.get(MAKE)), clean(raw.get(MODEL))
    if model:
        out["camera"] = model if make.lower() in model.lower() else f"{make} {model}".strip()
    lens = clean(get(LENS))
    if lens:
        out["lens"] = lens

    f = num(get(FNUMBER))
    if f:
        out["aperture"] = f"f/{f:.1f}".replace(".0", "")
    t = num(get(EXPOSURE))
    if t:
        out["shutter"] = f"1/{round(1 / t)} s" if t < 0.4 else f"{t:g} s"
    iso = get(ISO) or get(ISO_ALT)
    if isinstance(iso, (tuple, list)):
        iso = iso[0] if iso else None
    if iso:
        out["iso"] = f"ISO {iso}"
    fl = num(get(FOCAL))
    if fl:
        out["focal_length"] = f"{fl:g}mm"
        fl35 = get(FOCAL_35)
        if fl35 and round(fl35) != round(fl):
            out["focal_length_35mm"] = f"{round(fl35)}mm"

    taken = None
    stamp = clean(get(DATE_ORIGINAL))
    if stamp:
        try:
            taken = datetime.strptime(stamp[:19], "%Y:%m:%d %H:%M:%S")
        except ValueError:
            pass
    if taken:
        out["taken"] = taken.strftime("%Y-%m-%dT%H:%M:%S")

    orientation = raw.get(ORIENTATION) or 1
    return out, taken, orientation


def pretty_date(d):
    return f"{d.strftime('%b')} {d.day}, {d.year}"


old = {}
if manifest.exists():
    for p in json.loads(manifest.read_text()):
        old[p["file"]] = p

files = sorted(f for f in os.listdir(photo_dir) if Path(f).suffix.lower() in exts)
out, with_exif = [], 0
for f in files:
    with Image.open(photo_dir / f) as im:
        w, h = im.size
        exif, taken, orientation = read_exif(im)
    if orientation in (5, 6, 7, 8):  # photo is stored sideways; display is rotated
        w, h = h, w
    if exif:
        with_exif += 1

    entry = old.get(f, {})
    title = entry.get("title") or re.sub(r"[-_]+", " ", Path(f).stem).strip().capitalize()
    date = entry.get("date") or (pretty_date(taken) if taken else "")
    item = {
        "file": f,
        "title": title,
        "place": entry.get("place", ""),
        "date": date,
        "tags": entry.get("tags", []),
        "featured": entry.get("featured", False),
        "alt": entry.get("alt", title),
        "w": w,
        "h": h,
    }
    if exif:
        item["exif"] = exif
    out.append(item)

manifest.write_text(json.dumps(out, indent=2) + "\n")
print(f"Wrote {len(out)} photos to {manifest.name} ({with_exif} with camera data)")