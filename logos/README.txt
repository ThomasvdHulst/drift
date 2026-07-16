# Drift — brand marks

Everything is built from the Fraunces wordmark and the drifting olive sprig.

## Colors
- Ink (text/dark):   #2a2723
- Paper (light bg):  #f4efe4   (app-icon tile: #efe8da)
- Olive (sprig):     #6f7e42   leaves #889a4e / #a2b46b
- Olive on dark:     #9aac5f   leaves #a9bb6c / #c6d492

## Typeface
Fraunces (Google Fonts), weight 600. Used for "Drift" and the D monogram.

## Files

svg/  — editable vectors (scale to any size)
  drift-logo.svg            primary logo, ink
  drift-logo-reversed.svg   primary logo, cream (for dark backgrounds)
  drift-monogram.svg        D + sprig, transparent
  drift-appicon.svg         squircle app icon
  drift-sprig.svg           the sprig motif on its own (pure vector, no font)

png/  — ready-to-use raster (font baked in, transparent where noted)
  drift-logo.png                 1600×600, transparent, ink
  drift-logo-reversed.png        1600×600, transparent, cream
  drift-monogram.png             transparent, ink
  drift-monogram-reversed.png    transparent, cream
  drift-sprig.png                transparent
  drift-appicon-light-1024/512/192.png
  drift-appicon-dark-1024/512/192.png
  drift-icon-master-1024.png     rounded icon master
  apple-touch-icon-180.png
  favicon-512/64/48/32/16.png

## Notes
- The SVG logo/monogram/app-icon use live Fraunces text — they render perfectly
  in a browser and in design tools that have Fraunces installed. If you need a
  font-independent file, use the PNGs (glyphs are baked into pixels) or convert
  the SVG text to outlines in your editor. drift-sprig.svg is pure vector.
- Favicon: point your <link rel="icon"> at favicon-32.png / favicon-16.png, and
  <link rel="apple-touch-icon"> at apple-touch-icon-180.png.
