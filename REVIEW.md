# REVIEW — Mansa Musa: The Emperor Who Crashed Gold

## 1. Creative Calls & Storylines Not Built
- **Built Storyline (#1 — The Portolan Atlas Flight):** One unbroken 78.60-second camera flight over a single procedural 4800×2600 14th-century Portolan parchment map (`#E8D3AC` vellum, iron-gall coastlines, 32-ray compass roses, and 6 vertical atlas fold creases). All 9 historical archival images (`01.jpg`–`09.jpg`), the Cairo merchant ledger chart, and the engraved gold-and-ink hero typography (`EB Garamond` + `JetBrains Mono`) drop physically onto their exact geographic coordinates while non-hero elements dim back to `16%`.
- **Storylines Saved for Later (`STORYLINES.md`):**
  - *Alternative A — The Cairo Merchant's Ledger (Object-to-Object Chain):* Starts on a Mamluk goldsmith's scale in Cairo and traces the devalued dinar backward across the Sahara to Mali.
  - *Alternative B — The Cartographer's Table in Majorca 1375 (Endless Zoom):* Starts on Abraham Cresques burnishing gold leaf onto the 1375 Catalan Atlas and dives into the orb to enter 1324 Mali.

## 2. What Was Measured vs. Inspected
- **`npx hyperframes lint` & `npx hyperframes check --json`:**
  - `lint`: `0` errors, `0` warnings.
  - `runtime`: `0` errors, `0` warnings.
  - `layout`: `0` errors, `0` warnings across all sampled timestamps (`4.37s`, `13.10s`, `21.83s`, `30.57s`, `39.30s`, `48.03s`, `56.77s`, `65.50s`, `74.23s`).
  - `contrast` & `audio`: `0` errors, `0` warnings.
- **Visual Beat Sheet & Seam Strips:**
  - Verified all 15 beat midpoints (`contact_sheet.jpg`) and 15 camera move / handoff frames (`camera_moves.jpg`), checking 360px phone-width readability and confirming zero text/image overlaps.
- **Audio & Loudness (`npx hyperframes audio` / `ffprobe`):**
  - Sound was **measured, not heard**: narrator voiceover (`en-GB-RyanNeural`) + real HyperFrames studio SFX (`whoosh-short.mp3`, `whoosh.mp3`, `whoosh-cinematic.mp3`, `impact-bass-1.mp3`, `impact-bass-2.mp3`, `pop.mp3`, `typing.mp3`, `riser.mp3`, and ducked `bgm.mp3`) normalized via FFmpeg `loudnorm` to `-15 LUFS` integrated loudness and `-1.5 dBTP` true peak, with each SFX peak placed 1 frame (`+33ms`) after its visual action.

## 3. Weakest Shot & What Would Change With More Time
- **Weakest Shot:** Beat 10 (`t=44.20s–48.50s`, Cairo Merchant Ledger collapse) shares the eastern Nile Delta region with the dimmed Beat 8 Cairo print (`05.jpg`) and Beat 9 scattered dinar coins (`06.jpg`). While dimming non-hero objects to `16%` opacity keeps the ledger chart 100% legible, with more time we could add a subtle radial depth-of-field blur on the dimmed coins underneath the ledger card.

## 4. Intentional Opt-Outs & Warnings Kept on Purpose
- `data-layout-ignore` and `data-hold` are placed on `<canvas id="stage">` because the entire 21:9 scene is painted deterministically inside the `<canvas>` element at every seeked timestamp `t` while the canvas DOM element's outer bounding box (`1920×824`) remains stationary.

