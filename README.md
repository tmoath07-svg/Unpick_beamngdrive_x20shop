# BEAMNG CARS STUDIO
Browser-only BeamNG mod studio. All files stay in your browser memory; nothing is uploaded.

## Deploy on GitHub Pages (works from iPad/iPhone in Safari)
1. Create a repository, upload everything in this folder (keep the folder structure).
2. Settings → Pages → Source: "Deploy from a branch" → `main` / `/ (root)` → Save.
3. Open `https://<user>.github.io/<repo>/`.
Do not open `index.html` from `file://` (ES module imports and fonts.json need http).

## Fonts (owner only)
Put font files in `fonts/` and list them in `fonts/fonts.json`:
`{"name":"Cairo","file":"fonts/Cairo-Regular.ttf"}`. Entries without `file` use installed system fonts. Users can only pick from this list.

## RAR support (optional setup)
RAR extraction uses libarchive.js (WASM). Download the package from npm (`libarchive.js`), copy its `dist/` contents into `vendor/libarchive/` so that `vendor/libarchive/libarchive.js` and `worker-bundle.js` exist. Without it, ZIP still works and RAR shows a clear message. RAR *creation* is not possible in browsers; export is ZIP.

## Limits
Whole archives are held in RAM (iPad Safari: expect problems above ~500 MB). Nothing persists after reload (a warning is shown). No DDS decoding, UV preview, or textures on 3D models. No Web Workers yet.
