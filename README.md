# Andrew Markarian: personal site

Plain HTML, CSS and JS. No build step. Works on GitHub Pages as is.

## Add or change photos
1. Drop image files into `photos/` (JPG or WebP, around 2000px on the long edge).
2. Run `python3 tools/update-photos.py` (needs `pip install pillow`).
3. Open `photos.json` and fill in `title`, `place`, `date`, `tags` for new entries. Set `"featured": true` to show a photo in the strip at the top of the home page.
4. Delete the `sample-*.jpg` files, run the script again, commit and push.

Tags become the filter buttons above the gallery on `photos.html`.

## Edit text
Everything else (work, projects, about, contact) is in `index.html`. The full photo gallery lives on `photos.html`.

## Deploy
Replace the contents of your `andewmark.github.io` repo with these files, keeping your existing `images/` folder (the headshot and resume PDF are linked from there), then push.
