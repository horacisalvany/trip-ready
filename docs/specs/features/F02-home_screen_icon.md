# The home-screen shortcut should show the app logo

## Problem

When a user adds the site to their phone's home screen, the shortcut shows a
browser-generated letter tile (a plain `W`) instead of the TripReady logo. The
site declares no web app manifest and no `apple-touch-icon`, so the browser has
no icon to use and falls back to drawing a letter.

## Expected behavior

The shortcut shows the same bag glyph used in the toolbar, and opens the app as
a standalone app rather than a browser tab.

## Requirements

- Adding the site to the home screen shows the TripReady bag logo.
- The icon is legible on both light and dark home screens, so the glyph sits on
  the toolbar's purple-to-indigo gradient instead of a transparent background.
- The glyph survives Android's maskable crop without being clipped.
- The shortcut is titled `TripReady` and opens standalone (no browser chrome).
- iOS and Android are both covered.
- The browser tab favicon stays consistent with the home-screen icon.

## Acceptance criteria

- [x] The home screen shows the logo, never a generated letter tile.
- [x] The icon is declared at 192x192 and 512x512, the sizes install prompts
      require.
- [x] Maskable icons are declared so Android does not reject the icon set.
- [x] Every icon path declared in the manifest resolves to a served file.
- [x] The production build copies the manifest and all icons into `dist/`.

## Technical notes

`src/assets/img/tripReady_logo.svg` is white-on-transparent, drawn to sit on the
coloured toolbar. Reusing it directly would render white-on-white on a light home
screen, so the icon is a separate source file rather than the same asset.

- `src/assets/img/tripReady_icon.svg` — the same glyph, centred on the toolbar
  gradient (`#9c27b0` -> `#3f51b5`). The glyph is scaled to stay inside the
  central 80% of the canvas, which is the safe zone for a maskable crop.
- `tripReady_icon-192.png`, `tripReady_icon-512.png` and
  `apple-touch-icon.png` (180x180) are rasterized from that SVG.
- `src/manifest.webmanifest` declares the icons for both `any` and `maskable`
  purposes, plus `display: standalone` and `theme_color: #9c27b0`.
- `src/index.html` links the manifest for Android/Chrome and the
  `apple-touch-icon` for iOS, which ignores the manifest icons.
- `src/manifest.webmanifest` is added to the `assets` array of both the `build`
  and `test` targets in `angular.json`, so it is copied into `dist/` and served
  to Karma.
- `src/manifest.spec.ts` asserts the manifest is served, declares the required
  sizes and purposes, and that each declared icon file actually resolves — that
  last check is what catches a renamed or missing asset.
- Firebase Hosting's `**` -> `/index.html` rewrite does not shadow these files:
  static files take priority over rewrites.

Phones cache home-screen icons aggressively, so an existing shortcut has to be
removed and re-added to pick up the new icon.
