# SPEC — Mansa Musa: The Emperor Who Crashed Gold

```text
GOAL:    The viewer feels the staggering scale of Mansa Musa's 1324 pilgrimage across the Sahara and sees how one ruler's generosity crashed Cairo's gold market for twelve years and put Mali on European maps.
OUTPUT:  HyperFrames, 1920 x 824 (21:9), 30 fps
TIME:    78.60 seconds x 30 fps = 2,358 frames (Narrated: voiceover is the master clock)
LOOK:    Ground: Procedural aged Portolan vellum (#E8D3AC land, #D6C19A sea, 3-octave FBM paper fibre at 16% contrast, 6 vertical atlas fold creases at 12% shadow, three 32-ray compass roses).
         Ink: Iron-gall dark (#1E150D) and sepia mid-tone (#3A291B).
         One Accent: Burnished Gold (#E5B842, specular highlight #FFE07D, deep border #A67614) used strictly on the active hero print's gold details, the active Mali border, the pilgrimage route, and hero typography.
         Display Face: Playfair Display / Palatino Linotype, weight 800, 112px–138px, tracking -0.01em.
         UI / Numeric Face: JetBrains Mono / Consolas, weight 800, 64px–285px, tracking 0.02em.
         Medium: Physical archival prints and engravings mounted on #F2E6CE antique paper cards (14px border pad, 1.5px double iron-gall frame, 9px gold corner registration ticks) casting dynamic parallax drop shadows (blur 16px–68px, opacity 48%) onto the parchment map.
         Light & Depth: 180-degree shutter motion blur on camera moves > 14px/frame, 13% deterministic mulberry32 film grain, 20 seeded dust motes, and optical 21:9 vignette (64% edge darkening).
OBJECTS: 1. 4800x2600 Hand-Inked Portolan Map (West Africa, Sahara, Mediterranean, Egypt, Arabia; Niger, Senegal, and Nile rivers; Atlas, Hoggar, Tibesti, Guinea, and Hejaz mountain chains).
         2. Nine Archival Prints (01 Catalan Atlas Mansa Musa, 02 Gold Nuggets, 03 Barth Caravan Engraving, 04 Catalan Atlas Western Sahara, 05 David Roberts Cairo, 06 Mamluk Gold Dinar + 18 scattered coins, 07 Timbuktu Astronomy Manuscript, 08 Djinguereber Mosque 1896 Engraving, 09 Angelino Dulcert 1339 Map).
         3. Cairo Merchant Ledger (640x350px #EFE2C6 sheet with 9 abstract grey ruling bars and a live gold-price curve that plunges vertically at t=47.52s).
MOTION:  Camera: 7-tap Gaussian-filtered C2-continuous spline in (x, y, logZoom, rot) with 0.55s pre-roll handoffs and continuous slow directional drift during holds.
         Print Enter: easeSoftLand (1 - (1 - u)^4.2) over 26 frames (0.88s), gliding along a 24px directional vector while scaling 1.15 -> 1.00.
         Print Hold: Continuous inner Ken Burns pan/scale (1.00 -> 1.062) inside the clipped mount + 3D camera parallax.
         Print Exit/Dim: Smooth 32-frame (1.05s) recede (scale 1.00 -> 0.965, opacity 1.00 -> 0.16) as the next hero takes over.
         Hero Type: Landed dead still after entrance ("type" 0.068s/char, "slam" 7 frames back.out(1.35), "stamp" 6 frames power3.out with -0.045 rad tilt).
SHOTS:   B01 (f0000–f0162, 0.00–5.42s):  01 Print lands at [945,1900], gold orb pulses; text: none; SFX: whoosh-soft + subtle paper land.
         B02 (f0163–f0234, 5.42–7.80s):  Camera drifts east; text: "MANSA MUSA" (6.53–7.90s); SFX: typing tick.
         B03 (f0235–f0369, 7.80–12.29s): Mali Empire polygon illuminates & border draws; text: "MALI" (9.56–12.60s).
         B04 (f0370–f0531, 12.29–17.70s):02 Gold nuggets print glides in at [930,1950], slow push-in; text: none; SFX: whoosh-short.
         B05 (f0532–f0719, 17.70–23.99s):Route draws NE from Mali on "set out" (20.65s); text: "1324" slams at 18.80s; SFX: impact-bass-1.
         B06 (f0720–f0847, 23.99–28.25s):03 Caravan print lands at [1255,1215]; text: "60,000" slams at 24.00s; SFX: pop + whoosh-short.
         B07 (f0848–f1013, 28.25–33.77s):04 Catalan Atlas Sahara print lands at [2260,850]; text: none; SFX: whoosh-cinematic.
         B08 (f1014–f1140, 33.77–38.00s):05 Cairo print lands at [3290,785], route reaches Cairo (37.09s); text: "CAIRO" (37.02–38.45s).
         B09 (f1141–f1298, 38.00–43.27s):06 Dinar lands at [3555,800], 18 coins scatter on "gave gold" (38.95s); text: none; SFX: pop.
         B10 (f1299–f1455, 43.27–48.50s):Ledger lands at [3695,875], gold line plunges on "collapsed" (47.52s); text: none; SFX: impact-bass-2.
         B11 (f1456–f1623, 48.50–54.11s):Camera pushes into ledger; text: "12 YEARS" stamps at 51.72s; SFX: impact-bass-1.
         B12 (f1624–f1804, 54.11–60.15s):Return route sweeps SW to Timbuktu, 07 Manuscript lands at [1445,1595]; text: none; SFX: whoosh-cinematic.
         B13 (f1805–f1954, 60.15–65.14s):08 Mosque engraving lands at [1185,1625]; text: "1327" stamps at 61.66s; SFX: impact-bass-2.
         B14 (f1955–f2128, 65.14–70.94s):09 Dulcert Map lands at [1720,700]; text: none; SFX: whoosh-short.
         B15 (f2129–f2358, 70.94–78.60s):Full pull-back to world map, 01 Print returns at [1080,1680]; text: "1312–1337" (72.55–78.60s); SFX: riser.
BANNED:  Dark navy/black void background; neon/cyberpunk glow on text chrome; purple/blue mesh gradients; corner HUD labels or frame borders; filler body text on documents; titles that keep drifting after they land; repeating any phrase on screen; unseeded Math.random(); synthesised sine-wave chimes or dings.
QA:      Check all 15 beat midpoints, seam strips, and 360px phone-width sheet via `npx hyperframes check --json` and `npx hyperframes snapshot --review`.
```

