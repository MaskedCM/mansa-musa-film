// ============================================================================
// MANSA MUSA — CINEMATIC HTML5 CANVAS FILM V2 (1920x824, 30fps, 78.6s)
// Pure function of time t: window.seek(t)
// Deterministic seeded noise (mulberry32) — zero Math.random()
// ============================================================================

(function () {
  "use strict";

  const VIEW_W = 1920;
  const VIEW_H = 824;
  const WORLD_W = 4800;
  const WORLD_H = 2600;
  const TOTAL_DUR = 78.6;

  const DISPLAY_FONT = "'EB Garamond', 'Palatino Linotype', 'Book Antiqua', 'Georgia', serif";
  const UI_FONT = "'JetBrains Mono', 'Consolas', 'Courier New', monospace";
  const GOLD_HEX = "#E5B842";
  const GOLD_BRIGHT = "#FFE07D";
  const GOLD_DEEP = "#A67614";
  const INK_DARK = "#1E150D";
  const INK_MID = "#3A291B";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d", { alpha: false });

  // Offscreen canvases for static map, motion-blur sub-frame, and deterministic grain tiles
  const baseMapCanvas = document.createElement("canvas");
  baseMapCanvas.width = WORLD_W;
  baseMapCanvas.height = WORLD_H;

  const sceneBuffer = document.createElement("canvas");
  sceneBuffer.width = VIEW_W;
  sceneBuffer.height = VIEW_H;
  const sceneCtx = sceneBuffer.getContext("2d", { alpha: false });

  const grainTiles = [];
  const NUM_GRAIN_TILES = 6;
  const GRAIN_W = 480;
  const GRAIN_H = 206;

  // --------------------------------------------------------------------------
  // 1. DETERMINISTIC SEEDED PRNG (mulberry32) & VALUE NOISE
  // --------------------------------------------------------------------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2i(ix, iy, seed) {
    let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function valueNoise2D(x, y, seed) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash2i(ix, iy, seed);
    const b = hash2i(ix + 1, iy, seed);
    const c = hash2i(ix, iy + 1, seed);
    const d = hash2i(ix + 1, iy + 1, seed);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm2D(x, y, seed, octaves) {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += amp * valueNoise2D(x * freq, y * freq, seed + i * 101);
      freq *= 2.03;
      amp *= 0.5;
    }
    return val;
  }

  // Math & Motion Easing Curves (including softLand velvet deceleration)
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function smootherstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function easeOutCubic(t) {
    const u = clamp(t, 0, 1);
    return 1 - Math.pow(1 - u, 3);
  }
  // softLand: Fast initial arrival (65% of travel in first 30%), long velvet settle tail
  function easeSoftLand(t) {
    const u = clamp(t, 0, 1);
    return 1 - Math.pow(1 - u, 4.2);
  }
  function easeOutBack(t) {
    const u = clamp(t, 0, 1);
    const c1 = 1.35;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
  }

  // --------------------------------------------------------------------------
  // 2. GEOGRAPHY & WORLD COORDINATES
  // --------------------------------------------------------------------------
  // Lon [-20..48] -> X [240..4560], Lat [40..4] -> Y [140..2460]
  function geoToWorld(lon, lat) {
    const x = 240 + ((lon - -20) / 68) * 4320;
    const y = 140 + ((40 - lat) / 36) * 2320;
    return [x, y];
  }

  const LOC = {
    maliHeart: geoToWorld(-8.8, 12.6),        // [951, 1906]
    maliGold: geoToWorld(-10.2, 11.6),        // [862, 1970]
    maliEmpireCenter: geoToWorld(-6.2, 14.3), // [1117, 1796]
    timbuktu: geoToWorld(-3.0, 16.8),         // [1320, 1635]
    walata: geoToWorld(-7.0, 20.5),           // [1066, 1397]
    taghaza: geoToWorld(-5.0, 23.6),          // [1193, 1197]
    tuat: geoToWorld(-0.2, 27.2),             // [1498, 965]
    ghadames: geoToWorld(9.5, 30.1),          // [2114, 778]
    fezzan: geoToWorld(14.5, 27.5),           // [2431, 946]
    siwa: geoToWorld(25.5, 29.2),             // [3130, 836]
    cairo: geoToWorld(31.2, 30.05),           // [3493, 781]
    mediterranean: geoToWorld(4.5, 33.2),     // [1796, 578]
    mecca: geoToWorld(39.8, 21.4),            // [4039, 1339]
  };

  const MALI_EMPIRE_GEO = [
    [-16.2, 15.8], [-13.5, 16.8], [-9.2, 17.6], [-4.5, 18.2],
    [-0.5, 17.4],  [1.8, 15.8],   [0.8, 13.2],  [-2.8, 11.4],
    [-6.5, 10.2],  [-10.8, 9.8],  [-13.8, 11.2], [-16.0, 13.2]
  ];
  const MALI_POLY = MALI_EMPIRE_GEO.map(([lon, lat]) => geoToWorld(lon, lat));

  const ROUTE_TO_CAIRO_GEO = [
    [-6.6, 14.4],  // Mali heartland departure
    [-4.6, 15.6],  // Niger river valley
    [-3.0, 16.8],  // Timbuktu
    [-5.2, 19.8],  // Walata / Western Sahara
    [-5.0, 23.6],  // Taghaza salt mines
    [-0.2, 27.2],  // Tuat Oasis
    [5.8, 28.4],   // In Salah
    [11.8, 29.0],  // Ghadames / Fezzan
    [19.5, 28.8],  // Awjila
    [25.5, 29.2],  // Siwa Oasis
    [31.2, 30.05], // Cairo
  ];

  const ROUTE_MECCA_RETURN_GEO = [
    [31.2, 30.05], // Cairo
    [33.8, 28.5],  // Sinai
    [36.8, 25.2],  // Red Sea coast (Yanbu)
    [39.8, 21.4],  // Mecca
    [36.5, 24.0],  // Return via Red Sea
    [31.2, 30.05], // Cairo return
    [22.0, 26.8],  // Libyan desert return arc
    [11.0, 24.2],  // Ghat / Hoggar
    [2.5, 20.5],   // Adrar des Ifoghas
    [-3.0, 16.8],  // Timbuktu
  ];

  function buildDenseCatmullSpline(geoPoints, samplesPerSeg) {
    const pts = geoPoints.map(([lon, lat]) => geoToWorld(lon, lat));
    const dense = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < samplesPerSeg; s++) {
        const u = s / samplesPerSeg;
        const u2 = u * u;
        const u3 = u2 * u;
        const x =
          0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * u +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3);
        const y =
          0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * u +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
        dense.push([x, y]);
      }
    }
    dense.push(pts[pts.length - 1]);
    return dense;
  }

  const ROUTE_CAIRO_PTS = buildDenseCatmullSpline(ROUTE_TO_CAIRO_GEO, 28);
  const ROUTE_RETURN_PTS = buildDenseCatmullSpline(ROUTE_MECCA_RETURN_GEO, 24);

  // --------------------------------------------------------------------------
  // 3. PROCEDURAL PARCHMENT & HAND-INKED MAP GENERATION
  // --------------------------------------------------------------------------
  const AFRICA_COAST_GEO = [
    [10.0, 4.0], [5.5, 4.3], [1.0, 5.8], [-4.0, 5.2], [-7.8, 4.5],
    [-11.0, 6.4], [-13.6, 9.5], [-16.7, 12.4], [-17.5, 14.7], [-16.5, 16.5],
    [-16.1, 19.5], [-17.0, 21.0], [-14.8, 24.5], [-13.2, 27.8], [-10.5, 30.0],
    [-9.4, 32.3], [-5.9, 35.8], [-5.3, 35.9], [-2.2, 35.2], [0.5, 35.9],
    [3.2, 36.8], [7.8, 36.9], [10.2, 37.3], [11.0, 37.0], [10.6, 35.0],
    [10.1, 33.5], [13.2, 32.9], [15.2, 32.3], [19.8, 30.3], [20.1, 32.1],
    [22.8, 32.8], [25.2, 31.6], [29.8, 31.2], [31.2, 31.5], [32.5, 31.3],
    [33.8, 30.0], [32.6, 29.8], [33.8, 27.8], [34.8, 24.0], [37.2, 21.0],
    [38.8, 18.2], [41.5, 15.0], [43.3, 12.6], [45.0, 11.5], [48.0, 11.2],
    [48.0, 4.0]
  ];

  const ARABIA_LEVANT_GEO = [
    [48.0, 29.8], [48.0, 24.0], [45.0, 13.0], [43.5, 12.7], [42.6, 15.5],
    [40.8, 18.8], [39.1, 21.5], [38.0, 24.1], [36.2, 26.8], [34.9, 29.5],
    [34.5, 28.0], [33.8, 29.9], [34.4, 31.5], [35.1, 33.0], [35.8, 35.5],
    [36.1, 36.8], [34.5, 36.8], [32.0, 36.5], [29.0, 36.6], [27.2, 38.4],
    [26.2, 40.0], [48.0, 40.0]
  ];

  const EUROPE_IBERIA_GEO = [
    [-5.6, 36.0], [-6.3, 36.5], [-8.9, 37.0], [-9.4, 38.8], [-9.0, 40.0],
    [3.2, 40.0], [3.3, 42.0], [5.0, 43.3], [7.5, 43.8], [9.0, 44.2],
    [10.3, 43.5], [12.4, 41.7], [14.2, 40.8], [15.8, 40.0], [16.2, 38.2],
    [15.6, 38.0], [17.2, 39.1], [18.4, 40.1], [16.0, 41.8], [13.8, 44.0],
    [19.5, 41.5], [20.0, 39.5], [22.5, 36.8], [24.0, 37.9], [23.0, 40.0],
    [0.0, 40.0], [-0.4, 39.4], [-0.7, 37.6], [-2.2, 36.7], [-4.4, 36.6]
  ];

  const SICILY_GEO = [
    [12.5, 37.8], [15.5, 38.2], [15.2, 36.7], [12.5, 37.6]
  ];
  const CRETE_GEO = [
    [23.5, 35.5], [26.3, 35.2], [26.2, 34.9], [23.6, 35.2]
  ];
  const CYPRUS_GEO = [
    [32.3, 35.1], [34.6, 35.6], [34.0, 34.6], [32.4, 34.7]
  ];

  const NIGER_RIVER_GEO = [
    [-10.6, 9.6], [-9.5, 11.5], [-7.8, 12.8], [-5.8, 14.2], [-4.2, 15.8],
    [-3.0, 16.8], [-1.2, 17.0], [0.4, 15.6], [2.2, 13.4], [4.5, 10.5],
    [6.2, 7.8], [6.0, 4.6]
  ];
  const SENEGAL_RIVER_GEO = [
    [-11.2, 12.2], [-12.5, 14.0], [-14.2, 15.8], [-16.5, 16.2]
  ];
  const NILE_RIVER_GEO = [
    [32.5, 15.6], [33.8, 18.2], [31.8, 19.5], [30.5, 21.8], [32.9, 24.0],
    [32.6, 25.8], [31.2, 27.2], [31.2, 30.05]
  ];
  const NILE_DELTA_LEFT_GEO = [
    [31.2, 30.05], [30.8, 30.8], [30.4, 31.4]
  ];
  const NILE_DELTA_RIGHT_GEO = [
    [31.2, 30.05], [31.5, 30.8], [31.8, 31.4]
  ];

  function drawHandInkedPath(bctx, pts, rng, width, color, jitterAmt) {
    if (pts.length < 2) return;
    bctx.save();
    bctx.strokeStyle = color;
    bctx.lineWidth = width;
    bctx.lineCap = "round";
    bctx.lineJoin = "round";
    bctx.beginPath();
    bctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const dist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
      const steps = Math.max(1, Math.floor(dist / 18));
      for (let s = 1; s <= steps; s++) {
        const u = s / steps;
        const jx = (rng() - 0.5) * jitterAmt;
        const jy = (rng() - 0.5) * jitterAmt;
        bctx.lineTo(lerp(prev[0], curr[0], u) + jx, lerp(prev[1], curr[1], u) + jy);
      }
    }
    bctx.stroke();
    bctx.restore();
  }

  function buildBaseMap() {
    const bctx = baseMapCanvas.getContext("2d", { alpha: false });
    const rng = mulberry32(132401);

    const texW = 600;
    const texH = 325;
    const texCanvas = document.createElement("canvas");
    texCanvas.width = texW;
    texCanvas.height = texH;
    const tctx = texCanvas.getContext("2d");
    const imgData = tctx.createImageData(texW, texH);
    const d = imgData.data;

    for (let y = 0; y < texH; y++) {
      const ny = y / texH;
      for (let x = 0; x < texW; x++) {
        const nx = x / texW;
        const n1 = fbm2D(nx * 5.5, ny * 5.5, 17, 4);
        const n2 = fbm2D(nx * 18.0, ny * 18.0, 93, 3);
        const n3 = valueNoise2D(nx * 55.0, ny * 55.0, 211);

        const edgeDist = Math.min(nx, 1 - nx, ny, 1 - ny);
        const edgeShade = smoothstep(0.0, 0.14, edgeDist);
        const stain = smoothstep(0.58, 0.78, fbm2D(nx * 9.0 + 3.1, ny * 9.0 + 1.7, 409, 3));

        const baseVal = 0.84 + (n1 - 0.5) * 0.16 + (n2 - 0.5) * 0.08 + (n3 - 0.5) * 0.04;
        const darkFactor = (0.83 + 0.17 * edgeShade) * (1.0 - stain * 0.11);

        const r = clamp(Math.round(234 * baseVal * darkFactor), 145, 246);
        const g = clamp(Math.round(209 * baseVal * darkFactor), 120, 224);
        const b = clamp(Math.round(166 * baseVal * darkFactor), 85, 185);

        const idx = (y * texW + x) * 4;
        d[idx] = r;
        d[idx + 1] = g;
        d[idx + 2] = b;
        d[idx + 3] = 255;
      }
    }
    tctx.putImageData(imgData, 0, 0);

    bctx.save();
    bctx.imageSmoothingEnabled = true;
    bctx.drawImage(texCanvas, 0, 0, WORLD_W, WORLD_H);
    bctx.restore();

    // Sea vs land tinting
    bctx.save();
    bctx.fillStyle = "rgba(155, 134, 102, 0.16)";
    bctx.fillRect(0, 0, WORLD_W, WORLD_H);

    function fillGeoPoly(geoArr, fillStyle) {
      bctx.beginPath();
      geoArr.forEach(([lon, lat], idx) => {
        const [x, y] = geoToWorld(lon, lat);
        if (idx === 0) bctx.moveTo(x, y);
        else bctx.lineTo(x, y);
      });
      bctx.closePath();
      bctx.fillStyle = fillStyle;
      bctx.fill();
    }

    const landTint = "rgba(232, 211, 172, 0.62)";
    fillGeoPoly(AFRICA_COAST_GEO, landTint);
    fillGeoPoly(ARABIA_LEVANT_GEO, landTint);
    fillGeoPoly(EUROPE_IBERIA_GEO, landTint);
    fillGeoPoly(SICILY_GEO, landTint);
    fillGeoPoly(CRETE_GEO, landTint);
    fillGeoPoly(CYPRUS_GEO, landTint);
    bctx.restore();

    // Portolan Atlas Fold Creases
    for (let i = 1; i < 6; i++) {
      const fx = (WORLD_W / 6) * i;
      const grad = bctx.createLinearGradient(fx - 18, 0, fx + 18, 0);
      grad.addColorStop(0, "rgba(60, 40, 20, 0)");
      grad.addColorStop(0.46, "rgba(60, 40, 20, 0.12)");
      grad.addColorStop(0.52, "rgba(255, 242, 215, 0.14)");
      grad.addColorStop(1, "rgba(60, 40, 20, 0)");
      bctx.fillStyle = grad;
      bctx.fillRect(fx - 18, 0, 36, WORLD_H);
    }

    // Portolan Compass Rose & Rhumb Line Web
    const compassCenters = [
      geoToWorld(-6.0, 21.0),
      geoToWorld(14.0, 29.0),
      geoToWorld(33.5, 25.0),
    ];
    for (const [cx, cy] of compassCenters) {
      for (let r = 0; r < 32; r++) {
        const ang = (r / 32) * Math.PI * 2;
        const len = 3400;
        bctx.beginPath();
        bctx.moveTo(cx, cy);
        bctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        if (r % 4 === 0) {
          bctx.strokeStyle = "rgba(138, 42, 28, 0.17)";
          bctx.lineWidth = 1.4;
        } else if (r % 2 === 0) {
          bctx.strokeStyle = "rgba(58, 86, 56, 0.14)";
          bctx.lineWidth = 1.1;
        } else {
          bctx.strokeStyle = "rgba(52, 36, 22, 0.11)";
          bctx.lineWidth = 0.85;
        }
        bctx.stroke();
      }
      bctx.save();
      bctx.translate(cx, cy);
      bctx.strokeStyle = "rgba(65, 38, 20, 0.38)";
      bctx.lineWidth = 1.6;
      bctx.beginPath();
      bctx.arc(0, 0, 24, 0, Math.PI * 2);
      bctx.stroke();
      bctx.beginPath();
      bctx.arc(0, 0, 6, 0, Math.PI * 2);
      bctx.fillStyle = "rgba(145, 45, 30, 0.38)";
      bctx.fill();
      bctx.restore();
    }

    // Hand-inked Coastlines & Multi-line Coastal Hatching
    const allCoasts = [
      AFRICA_COAST_GEO,
      ARABIA_LEVANT_GEO,
      EUROPE_IBERIA_GEO,
      SICILY_GEO,
      CRETE_GEO,
      CYPRUS_GEO,
    ];
    for (const geoPoly of allCoasts) {
      const worldPts = geoPoly.map(([lon, lat]) => geoToWorld(lon, lat));
      drawHandInkedPath(bctx, worldPts, rng, 14, "rgba(120, 88, 52, 0.12)", 2.2);
      drawHandInkedPath(bctx, worldPts, rng, 7, "rgba(95, 68, 38, 0.18)", 1.8);
      drawHandInkedPath(bctx, worldPts, rng, 3.2, "rgba(42, 28, 16, 0.78)", 2.4);
      drawHandInkedPath(bctx, worldPts, rng, 1.4, "rgba(25, 16, 8, 0.55)", 3.5);
    }

    // Major Rivers
    const rivers = [
      { geo: NIGER_RIVER_GEO, w: 4.2 },
      { geo: SENEGAL_RIVER_GEO, w: 3.0 },
      { geo: NILE_RIVER_GEO, w: 4.5 },
      { geo: NILE_DELTA_LEFT_GEO, w: 3.0 },
      { geo: NILE_DELTA_RIGHT_GEO, w: 3.0 },
    ];
    for (const rv of rivers) {
      const dense = buildDenseCatmullSpline(rv.geo, 16);
      drawHandInkedPath(bctx, dense, rng, rv.w + 3.5, "rgba(92, 110, 102, 0.22)", 1.2);
      drawHandInkedPath(bctx, dense, rng, rv.w, "rgba(52, 68, 66, 0.68)", 1.5);
    }

    // Hand-drawn Portolan Mountain Ranges
    function drawMountainChain(geoStart, geoEnd, count, scale) {
      const [x0, y0] = geoToWorld(geoStart[0], geoStart[1]);
      const [x1, y1] = geoToWorld(geoEnd[0], geoEnd[1]);
      bctx.save();
      for (let i = 0; i <= count; i++) {
        const u = i / count;
        const mx = lerp(x0, x1, u) + (rng() - 0.5) * 18;
        const my = lerp(y0, y1, u) + (rng() - 0.5) * 14;
        const mw = (26 + rng() * 16) * scale;
        const mh = (18 + rng() * 14) * scale;
        bctx.beginPath();
        bctx.moveTo(mx - mw, my + 4);
        bctx.quadraticCurveTo(mx - mw * 0.3, my - mh, mx, my - mh);
        bctx.quadraticCurveTo(mx + mw * 0.3, my - mh, mx + mw, my + 4);
        bctx.fillStyle = "rgba(162, 124, 78, 0.28)";
        bctx.fill();
        bctx.strokeStyle = "rgba(58, 40, 24, 0.52)";
        bctx.lineWidth = 1.8;
        bctx.stroke();
        for (let h = 1; h <= 3; h++) {
          const hx = mx + (mw * h) / 4.5;
          bctx.beginPath();
          bctx.moveTo(hx - 3, my - mh * (1 - h * 0.22));
          bctx.lineTo(hx + 2, my + 2);
          bctx.strokeStyle = "rgba(58, 40, 24, 0.36)";
          bctx.lineWidth = 1.1;
          bctx.stroke();
        }
      }
      bctx.restore();
    }

    drawMountainChain([-8.5, 31.2], [5.5, 34.8], 18, 1.15);
    drawMountainChain([4.2, 23.8], [8.5, 22.5], 7, 0.9);
    drawMountainChain([16.0, 21.8], [19.8, 20.2], 7, 0.95);
    drawMountainChain([-12.5, 10.5], [-8.0, 9.2], 7, 0.85);
    drawMountainChain([36.8, 27.0], [41.5, 18.0], 12, 0.9);

    // Subtle Sahara Dune Stippling & Paper Fibers
    bctx.save();
    for (let i = 0; i < 6500; i++) {
      const fx = rng() * WORLD_W;
      const fy = rng() * WORLD_H;
      const flen = 4 + rng() * 14;
      const fang = rng() * Math.PI * 2;
      bctx.strokeStyle =
        rng() > 0.5 ? "rgba(75, 52, 28, 0.085)" : "rgba(255, 245, 222, 0.09)";
      bctx.lineWidth = 0.7 + rng() * 0.7;
      bctx.beginPath();
      bctx.moveTo(fx, fy);
      bctx.lineTo(fx + Math.cos(fang) * flen, fy + Math.sin(fang) * flen);
      bctx.stroke();
    }
    bctx.restore();
  }

  function buildGrainTiles() {
    for (let t = 0; t < NUM_GRAIN_TILES; t++) {
      const gc = document.createElement("canvas");
      gc.width = GRAIN_W;
      gc.height = GRAIN_H;
      const gctx = gc.getContext("2d");
      const img = gctx.createImageData(GRAIN_W, GRAIN_H);
      const gd = img.data;
      const rng = mulberry32(9001 + t * 773);
      for (let i = 0; i < gd.length; i += 4) {
        const v = (rng() - 0.5) * 255;
        const val = v > 0 ? 255 : 0;
        gd[i] = val;
        gd[i + 1] = val;
        gd[i + 2] = val;
        gd[i + 3] = Math.round(Math.abs(v) * 0.13);
      }
      gctx.putImageData(img, 0, 0);
      grainTiles.push(gc);
    }
  }

  // --------------------------------------------------------------------------
  // 4. CONTINUOUS CINEMATIC CAMERA PATH (7-Tap C2 Spline + Pre-Roll Handoffs)
  // --------------------------------------------------------------------------
  // Synced to the V2 78.6s narrator timeline. Every move starts ~0.55s before
  // the previous beat finishes so the camera leads the viewer's eye into each picture.
  const CAM_SEGMENTS = [
    // Beat 1 (0.00 - 5.42s): Mansa Musa 01 print in Mali, slow push-in toward the golden orb
    { t0: 0.00, t1: 5.25, x0: 922,  y0: 1912, z0: 1.54, r0: -0.012, x1: 950,  y1: 1888, z1: 1.86, r1: -0.003 },
    // Beat 2 (5.84 - 7.80s): Pull back slightly & drift east for huge MANSA MUSA hero type
    { t0: 5.25, t1: 7.55, x0: 1055, y0: 1855, z0: 1.48, r0: 0.000,  x1: 1102, y1: 1832, z1: 1.38, r1: 0.005 },
    // Beat 3 (8.00 - 12.29s): Pull back to reveal full Mali Empire lighting up + MALI
    { t0: 7.55, t1: 12.35,x0: 1110, y0: 1795, z0: 1.16, r0: 0.004,  x1: 1085, y1: 1828, z1: 1.25, r1: -0.004 },
    // Beat 4 (13.00 - 17.70s): Push in on 02 Gold nuggets in southern Mali
    { t0: 12.35,t1: 18.15,x0: 918,  y0: 1955, z0: 1.48, r0: -0.008, x1: 938,  y1: 1942, z1: 1.86, r1: 0.004 },
    // Beat 5 (18.80 - 23.99s): Glide north-east as 1324 slams in & route starts drawing
    { t0: 18.15,t1: 23.35,x0: 1150, y0: 1685, z0: 1.36, r0: 0.007,  x1: 1255, y1: 1575, z1: 1.30, r1: 0.013 },
    // Beat 6 (24.00 - 28.25s): Glide north across Western Sahara with 03 Caravan + 60,000
    { t0: 23.35,t1: 28.30,x0: 1465, y0: 1205, z0: 1.34, r0: 0.010,  x1: 1535, y1: 1180, z1: 1.44, r1: 0.004 },
    // Beat 7 (29.00 - 33.77s): Glide north-east across Central Sahara with 04 Catalan Atlas Sahara
    { t0: 28.30,t1: 33.55,x0: 2185, y0: 862,  z0: 1.32, r0: -0.008, x1: 2300, y1: 842,  z1: 1.45, r1: -0.002 },
    // Beat 8 (34.20 - 38.00s): Arrive in Cairo (05 Cairo print + CAIRO)
    { t0: 33.55,t1: 38.05,x0: 3470, y0: 782,  z0: 1.35, r0: 0.006,  x1: 3532, y1: 774,  z1: 1.48, r1: 0.010 },
    // Beat 9 (38.60 - 43.27s): Push in on 06 Gold dinar & coins scattering across Cairo
    { t0: 38.05,t1: 43.55,x0: 3535, y0: 790,  z0: 1.52, r0: 0.008,  x1: 3590, y1: 812,  z1: 1.68, r1: -0.005 },
    // Beat 10 (44.20 - 48.50s): Drift to Ledger Paper as gold-price line collapses
    { t0: 43.55,t1: 49.00,x0: 3655, y0: 870,  z0: 1.56, r0: -0.006, x1: 3692, y1: 878,  z1: 1.66, r1: 0.000 },
    // Beat 11 (49.60 - 54.11s): Push in on Ledger Paper as 12 YEARS stamps down
    { t0: 49.00,t1: 54.25,x0: 3692, y0: 878,  z0: 1.66, r0: 0.000,  x1: 3722, y1: 874,  z1: 1.82, r1: -0.008 },
    // Beat 12 (55.00 - 60.15s): Sweep back south-west to Timbuktu for 07 Manuscript page
    { t0: 54.25,t1: 59.75,x0: 1475, y0: 1585, z0: 1.42, r0: -0.010, x1: 1425, y1: 1605, z1: 1.58, r1: -0.003 },
    // Beat 13 (60.40 - 65.14s): Drift into Timbuktu for 08 Djinguereber Mosque + 1327
    { t0: 59.75,t1: 65.10,x0: 1355, y0: 1630, z0: 1.48, r0: 0.004,  x1: 1392, y1: 1615, z1: 1.58, r1: 0.008 },
    // Beat 14 (65.80 - 70.94s): Glide north toward Mediterranean for 09 Dulcert map (1339)
    { t0: 65.10,t1: 71.20,x0: 1695, y0: 712,  z0: 1.38, r0: -0.006, x1: 1738, y1: 688,  z1: 1.52, r1: 0.004 },
    // Beat 15 (72.00 - 78.60s): Grand pull-back to the entire parchment world map
    { t0: 71.20,t1: 78.60,x0: 2340, y0: 1405, z0: 0.455,r0: 0.000,  x1: 2385, y1: 1425, z1: 0.435,r1: 0.000 },
  ];

  function evalBaseSegment(seg, t) {
    const dur = seg.t1 - seg.t0;
    const u = clamp((t - seg.t0) / dur, 0, 1);
    const s = smootherstep(0, 1, u);
    return {
      x: lerp(seg.x0, seg.x1, s),
      y: lerp(seg.y0, seg.y1, s),
      lz: lerp(Math.log(seg.z0), Math.log(seg.z1), s),
      rot: lerp(seg.r0, seg.r1, s),
    };
  }

  function getRawCamera(t) {
    const tc = clamp(t, 0, TOTAL_DUR);
    let idx = 0;
    for (let i = 0; i < CAM_SEGMENTS.length; i++) {
      if (tc >= CAM_SEGMENTS[i].t0) idx = i;
    }
    const curr = CAM_SEGMENTS[idx];
    const base = evalBaseSegment(curr, tc);

    if (idx > 0) {
      const prev = CAM_SEGMENTS[idx - 1];
      const distLen = Math.hypot(curr.x0 - prev.x1, curr.y0 - prev.y1);
      // Generous smooth glide window + natural crane altitude arc on cross-map moves
      const transDur = distLen > 900 ? 1.85 : distLen > 350 ? 1.35 : 0.95;
      const elapsed = tc - curr.t0;
      if (elapsed < transDur) {
        const w = smootherstep(0, transDur, elapsed);
        const pEval = evalBaseSegment(prev, tc);
        const arcDip = distLen > 500 ? Math.sin(w * Math.PI) * Math.min(0.34, distLen / 5200) : 0;
        base.x = lerp(pEval.x, base.x, w);
        base.y = lerp(pEval.y, base.y, w);
        base.lz = lerp(pEval.lz, base.lz, w) - arcDip;
        base.rot = lerp(pEval.rot, base.rot, w);
      }
    }
    return base;
  }

  function getCameraState(t) {
    // 7-tap Gaussian filter in time for velvet C2-continuous camera acceleration
    const offsets = [-0.24, -0.16, -0.08, 0, 0.08, 0.16, 0.24];
    const weights = [0.06, 0.12, 0.21, 0.22, 0.21, 0.12, 0.06];
    let x = 0, y = 0, lz = 0, rot = 0;
    for (let i = 0; i < 7; i++) {
      const c = getRawCamera(t + offsets[i]);
      x += c.x * weights[i];
      y += c.y * weights[i];
      lz += c.lz * weights[i];
      rot += c.rot * weights[i];
    }
    const zoom = Math.exp(lz);

    // Subtle organic handheld camera breathing (seeded, deterministic)
    const hhScale = (0.80 / zoom) * smoothstep(0.35, 0.9, zoom);
    const hx =
      (Math.sin(t * 1.25 + 0.8) * 3.5 +
        Math.sin(t * 2.71 + 2.1) * 1.4 +
        Math.cos(t * 4.83 + 4.0) * 0.5) *
      hhScale;
    const hy =
      (Math.cos(t * 1.12 + 1.4) * 3.0 +
        Math.sin(t * 2.48 + 0.5) * 1.2 +
        Math.sin(t * 4.55 + 3.2) * 0.4) *
      hhScale;
    const hrot =
      (Math.sin(t * 0.88 + 1.1) * 0.0016 + Math.cos(t * 2.05 + 0.3) * 0.0007) *
      smoothstep(0.35, 0.9, zoom);

    // Physical stamp impact thumps on "1324" (18.80s), "60,000" (24.00s), "collapsed" (47.54s), "12 YEARS" (51.72s)
    let impactY = 0;
    let impactRot = 0;
    for (const impT of [18.80, 24.00, 47.54, 51.72, 61.66]) {
      const dt = t - impT;
      if (dt >= 0 && dt < 0.38) {
        const decay = Math.exp(-dt * 14);
        impactY += (Math.sin(dt * 52) * 6.0 * decay) / zoom;
        impactRot += Math.sin(dt * 44) * 0.0032 * decay;
      }
    }

    return {
      x: x + hx,
      y: y + hy + impactY,
      zoom,
      rot: rot + hrot + impactRot,
    };
  }

  // --------------------------------------------------------------------------
  // 5. SMOOTH PICTURE CHOREOGRAPHY & MINIMAL CARTOGRAPHIC EFFECTS
  // --------------------------------------------------------------------------
  function getObjectOpacity(t, enterT, heroEndT, fadeOutT) {
    if (t < enterT) return 0;
    const fadeIn = smoothstep(enterT, enterT + 0.52, t);
    if (fadeOutT && t >= fadeOutT) {
      return fadeIn * (1 - smoothstep(fadeOutT, fadeOutT + 1.1, t)) * 0.16;
    }
    if (t <= heroEndT) return fadeIn;
    // Smooth velvet dim-back over 1.05s when handing off to the next hero
    const dim = smoothstep(heroEndT, heroEndT + 1.05, t);
    return lerp(1.0, 0.16, dim);
  }

  // Minimal Cartographic Astrolabe / Caliper Ring around active historical hubs
  function drawCartographicCaliper(rctx, x, y, radius, t, startT, endT) {
    if (t < startT || t > endT + 1.2) return;
    const drawIn = easeSoftLand(clamp((t - startT) / 1.1, 0, 1));
    const fadeOut = t > endT ? 1 - smoothstep(endT, endT + 1.1, t) : 1;
    const alpha = drawIn * fadeOut * 0.52;
    if (alpha <= 0.01) return;

    rctx.save();
    rctx.translate(x, y);
    rctx.rotate(t * 0.045);
    rctx.globalAlpha = alpha;

    // Outer thin golden caliper arc (sweeps open as drawIn progresses)
    const sweep = Math.PI * 1.65 * drawIn;
    rctx.strokeStyle = GOLD_HEX;
    rctx.lineWidth = 1.6;
    rctx.beginPath();
    rctx.arc(0, 0, radius, -Math.PI * 0.82, -Math.PI * 0.82 + sweep);
    rctx.stroke();

    // Inner dashed iron-gall measurement ring
    rctx.strokeStyle = INK_MID;
    rctx.lineWidth = 1.1;
    rctx.setLineDash([6, 8]);
    rctx.beginPath();
    rctx.arc(0, 0, radius * 0.88, 0, Math.PI * 2 * drawIn);
    rctx.stroke();
    rctx.setLineDash([]);

    // 8 delicate degree ticks around caliper
    const tickCount = Math.floor(8 * drawIn);
    for (let i = 0; i < tickCount; i++) {
      const a = (i / 8) * Math.PI * 2;
      rctx.beginPath();
      rctx.moveTo(Math.cos(a) * (radius - 6), Math.sin(a) * (radius - 6));
      rctx.lineTo(Math.cos(a) * (radius + 6), Math.sin(a) * (radius + 6));
      rctx.strokeStyle = GOLD_DEEP;
      rctx.lineWidth = 1.4;
      rctx.stroke();
    }
    rctx.restore();
  }

  function drawArchivalPrint(rctx, img, opts) {
    const {
      t, enterT, heroEndT, fadeOutT,
      x, y, w, h, angle = -0.02,
      slideFrom = [0, 26], // Directional entry glide vector
      kbDir = [1, -1],     // Subtle inner Ken Burns drift direction
      crop = null,
      goldGlow = 0,
      orbSpot = null,
      cam = null,
    } = opts;

    const alpha = getObjectOpacity(t, enterT, heroEndT, fadeOutT);
    if (alpha <= 0.005 || !img || !img.complete) return;

    // 1. Velvet softLand arrival (0.88s) + subtle receding handoff after heroEndT
    const dropProg = clamp((t - enterT) / 0.88, 0, 1);
    const dropEase = easeSoftLand(dropProg);
    const recedeEase = t > heroEndT ? smoothstep(heroEndT, heroEndT + 1.1, t) : 0;

    const scale = lerp(1.15, 1.0, dropEase) * lerp(1.0, 0.965, recedeEase);
    const lift = lerp(38, 9, dropEase) * lerp(1.0, 0.55, recedeEase);
    const curAngle = angle + lerp(0.052, 0, dropEase);

    // Gliding arrival offset along curved path
    const glideX = lerp(slideFrom[0], 0, dropEase);
    const glideY = lerp(slideFrom[1], 0, dropEase);

    // 2. Dynamic 3D Parallax & Directional Shadow relative to active camera center
    let parX = 0;
    let parY = 0;
    let shadDirX = 0.55;
    let shadDirY = 0.95;
    if (cam) {
      const dx = clamp((x - cam.x) / 900, -1, 1);
      const dy = clamp((y - cam.y) / 500, -1, 1);
      const elev = lerp(1.0, 0.35, recedeEase);
      parX = dx * 12 * elev;
      parY = dy * 9 * elev;
      shadDirX = 0.55 + dx * 0.35;
      shadDirY = 0.95 + dy * 0.25;
    }

    rctx.save();
    rctx.globalAlpha = alpha;
    rctx.translate(x + glideX + parX, y + glideY + parY);
    rctx.rotate(curAngle);
    rctx.scale(scale, scale);

    // 3. Soft physical drop shadow on the parchment map
    const pad = 14;
    const totalW = w + pad * 2;
    const totalH = h + pad * 2;
    rctx.save();
    rctx.shadowColor = `rgba(12, 7, 3, ${0.48 * alpha})`;
    rctx.shadowBlur = lift * 1.85;
    rctx.shadowOffsetX = lift * shadDirX;
    rctx.shadowOffsetY = lift * shadDirY;
    rctx.fillStyle = "#F2E6CE";
    rctx.fillRect(-totalW / 2, -totalH / 2, totalW, totalH);
    rctx.restore();

    // 4. Inner clipped photograph with continuous slow Ken Burns drift (never static!)
    const holdDur = Math.max(2.5, heroEndT - enterT);
    const kbProg = clamp((t - enterT) / (holdDur + 1.5), 0, 1);
    const kbScale = lerp(1.0, 1.062, smoothstep(0, 1, kbProg));
    const kbPanX = lerp(-kbDir[0] * 6, kbDir[0] * 6, kbProg);
    const kbPanY = lerp(-kbDir[1] * 4, kbDir[1] * 4, kbProg);

    rctx.save();
    rctx.beginPath();
    rctx.rect(-w / 2, -h / 2, w, h);
    rctx.clip();
    rctx.translate(kbPanX, kbPanY);
    rctx.scale(kbScale, kbScale);

    if (crop) {
      const sx = crop.sx * img.naturalWidth;
      const sy = crop.sy * img.naturalHeight;
      const sw = crop.sw * img.naturalWidth;
      const sh = crop.sh * img.naturalHeight;
      rctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    } else {
      rctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
    rctx.restore();

    // 5. Warm sepia parchment integration glaze + soft paper vignette on print edges
    rctx.fillStyle = "rgba(185, 142, 78, 0.08)";
    rctx.fillRect(-w / 2, -h / 2, w, h);

    // 6. Self-drawing double ink frame line on paper mount as the print settles
    const frameProg = smoothstep(0.05, 0.85, dropProg);
    const bx = -totalW / 2 + 4;
    const by = -totalH / 2 + 4;
    const bw = totalW - 8;
    const bh = totalH - 8;

    rctx.strokeStyle = "rgba(58, 40, 24, 0.48)";
    rctx.lineWidth = 1.5;
    rctx.beginPath();
    rctx.moveTo(bx, by);
    rctx.lineTo(bx + bw * frameProg, by);
    rctx.moveTo(bx + bw, by);
    rctx.lineTo(bx + bw, by + bh * frameProg);
    rctx.moveTo(bx + bw, by + bh);
    rctx.lineTo(bx + bw * (1 - frameProg), by + bh);
    rctx.moveTo(bx, by + bh);
    rctx.lineTo(bx, by + bh * (1 - frameProg));
    rctx.stroke();

    // Crisp inner image bevel & minimal golden corner registration ticks
    rctx.strokeStyle = "rgba(35, 22, 12, 0.58)";
    rctx.lineWidth = 1.2;
    rctx.strokeRect(-w / 2, -h / 2, w, h);

    if (frameProg > 0.3) {
      const cAlpha = smoothstep(0.3, 0.9, frameProg) * 0.75;
      const tickL = 9;
      rctx.strokeStyle = `rgba(182, 132, 34, ${cAlpha})`;
      rctx.lineWidth = 2.0;
      const corners = [
        [-w / 2, -h / 2, 1, 1],
        [w / 2, -h / 2, -1, 1],
        [w / 2, h / 2, -1, -1],
        [-w / 2, h / 2, 1, -1],
      ];
      rctx.beginPath();
      for (const [cx, cy, sx, sy] of corners) {
        rctx.moveTo(cx, cy + sy * tickL);
        rctx.lineTo(cx, cy);
        rctx.lineTo(cx + sx * tickL, cy);
      }
      rctx.stroke();
    }

    // 7. Optional soft golden glow on gold elements (Beat 1/15 orb, Beat 4 nugget, Beat 7 gold)
    if (goldGlow > 0.01) {
      const gx = orbSpot ? orbSpot.rx * w : 0;
      const gy = orbSpot ? orbSpot.ry * h : 0;
      const rad = orbSpot ? Math.max(w, h) * 0.48 : Math.max(w, h) * 0.65;
      rctx.save();
      const baseGrad = rctx.createRadialGradient(gx, gy, 2, gx, gy, rad);
      baseGrad.addColorStop(0, `rgba(255, 215, 65, ${0.72 * goldGlow})`);
      baseGrad.addColorStop(0.28, `rgba(228, 158, 22, ${0.42 * goldGlow})`);
      baseGrad.addColorStop(0.65, `rgba(195, 125, 12, ${0.16 * goldGlow})`);
      baseGrad.addColorStop(1, "rgba(195, 125, 12, 0)");
      rctx.fillStyle = baseGrad;
      rctx.beginPath();
      rctx.arc(gx, gy, rad, 0, Math.PI * 2);
      rctx.fill();

      rctx.globalCompositeOperation = "screen";
      const coreGrad = rctx.createRadialGradient(gx, gy, 1, gx, gy, rad * 0.55);
      coreGrad.addColorStop(0, `rgba(255, 250, 210, ${0.95 * goldGlow})`);
      coreGrad.addColorStop(0.35, `rgba(255, 215, 80, ${0.65 * goldGlow})`);
      coreGrad.addColorStop(1, "rgba(255, 200, 50, 0)");
      rctx.fillStyle = coreGrad;
      rctx.beginPath();
      rctx.arc(gx, gy, rad * 0.55, 0, Math.PI * 2);
      rctx.fill();

      if (orbSpot) {
        rctx.strokeStyle = `rgba(255, 232, 130, ${0.55 * goldGlow})`;
        rctx.lineWidth = 1.8;
        for (let r = 0; r < 12; r++) {
          const a = (r / 12) * Math.PI * 2 + t * 0.35;
          const rIn = 18;
          const rOut = r % 2 === 0 ? 58 : 38;
          rctx.beginPath();
          rctx.moveTo(gx + Math.cos(a) * rIn, gy + Math.sin(a) * rIn);
          rctx.lineTo(gx + Math.cos(a) * rOut, gy + Math.sin(a) * rOut);
          rctx.stroke();
        }
      }
      rctx.restore();
    }

    rctx.restore();
  }

  // Draw crisp, phone-readable Hero Text (zero neon glow on text chrome, 100% contrast)
  function drawHeroText(rctx, text, opts) {
    const {
      t, startT, endT,
      x, y,
      fontSize = 116,
      fontFamily = DISPLAY_FONT,
      mode = "type", // "type" | "slam" | "stamp"
      color = INK_DARK,
      accentGold = false,
      align = "center",
    } = opts;

    if (t < startT || t > endT + 0.65) return;
    const fadeOut = t > endT ? 1 - smoothstep(endT, endT + 0.60, t) : 1;
    if (fadeOut <= 0.005) return;

    rctx.save();
    rctx.translate(x, y);

    let visibleText = text;
    let scale = 1.0;
    let alpha = fadeOut;

    if (mode === "type") {
      const typeDur = Math.min(0.82, Math.max(0.38, text.length * 0.068));
      const prog = clamp((t - startT) / typeDur, 0, 1);
      const charCount = Math.max(1, Math.floor(prog * text.length + 0.01));
      visibleText = text.slice(0, charCount);
      alpha *= smoothstep(startT, startT + 0.08, t);
    } else if (mode === "slam") {
      const prog = clamp((t - startT) / 0.24, 0, 1);
      scale = lerp(1.50, 1.0, easeOutBack(prog));
      alpha *= smoothstep(startT, startT + 0.06, t);
    } else if (mode === "stamp") {
      const prog = clamp((t - startT) / 0.20, 0, 1);
      scale = lerp(1.62, 1.0, easeOutCubic(prog));
      alpha *= smoothstep(startT, startT + 0.05, t);
      rctx.rotate(-0.045);
    }

    rctx.scale(scale, scale);
    rctx.globalAlpha = alpha;
    rctx.font = `800 ${fontSize}px ${fontFamily}`;
    rctx.textAlign = align;
    rctx.textBaseline = "middle";

    const fullMetrics = rctx.measureText(text);
    const fullW = fullMetrics.width;
    const boxX = align === "left" ? fullW / 2 : align === "right" ? -fullW / 2 : 0;

    // Soft warm parchment readability halo underneath so map ink lines never clutter the letters
    const haloGrad = rctx.createRadialGradient(
      boxX, 0, fontSize * 0.15,
      boxX, 0, Math.max(fullW * 0.68, fontSize * 1.2)
    );
    haloGrad.addColorStop(0, "rgba(232, 212, 174, 0.88)");
    haloGrad.addColorStop(0.65, "rgba(232, 212, 174, 0.52)");
    haloGrad.addColorStop(1, "rgba(232, 212, 174, 0)");
    rctx.fillStyle = haloGrad;
    rctx.fillRect(boxX - fullW * 0.75, -fontSize * 0.9, fullW * 1.5, fontSize * 1.8);

    if (mode === "stamp") {
      const padX = 28;
      const padY = 16;
      rctx.fillStyle = "rgba(238, 222, 188, 0.94)";
      rctx.fillRect(
        boxX - fullW / 2 - padX,
        -fontSize * 0.56 - padY,
        fullW + padX * 2,
        fontSize * 1.12 + padY * 2
      );
      rctx.strokeStyle = accentGold ? GOLD_DEEP : INK_DARK;
      rctx.lineWidth = 6;
      rctx.strokeRect(
        boxX - fullW / 2 - padX,
        -fontSize * 0.56 - padY,
        fullW + padX * 2,
        fontSize * 1.12 + padY * 2
      );
      rctx.lineWidth = 2;
      rctx.strokeRect(
        boxX - fullW / 2 - padX + 9,
        -fontSize * 0.56 - padY + 9,
        fullW + padX * 2 - 18,
        fontSize * 1.12 + padY * 2 - 18
      );
    }

    // Crisp engraved block shadow (zero neon glow on text chrome)
    rctx.fillStyle = accentGold ? "rgba(24, 15, 6, 0.85)" : "rgba(255, 244, 218, 0.75)";
    rctx.fillText(visibleText, 4, 5);

    if (accentGold) {
      rctx.lineWidth = 9;
      rctx.lineJoin = "round";
      rctx.strokeStyle = INK_DARK;
      rctx.strokeText(visibleText, 0, 0);
      rctx.fillStyle = GOLD_HEX;
      rctx.fillText(visibleText, 0, 0);
    } else {
      rctx.fillStyle = color;
      rctx.fillText(visibleText, 0, 0);
    }

    rctx.restore();
  }

  // --------------------------------------------------------------------------
  // 6. SPECIALIZED STORY VISUALS (MALI BORDER, ROUTE, COINS, LEDGER CHART)
  // --------------------------------------------------------------------------
  function drawMaliEmpireRegion(rctx, t) {
    // Lights up in Beat 3 ("He ruled the vast empire of Mali@9.63, deep in the heart of West Africa")
    if (t < 8.10) return;

    const enterProg = smoothstep(8.10, 9.60, t);
    const borderProg = smoothstep(8.15, 11.10, t);
    const isHero = t >= 8.10 && t < 12.85;
    const isFinale = t >= 71.8;
    const fillAlpha = isHero
      ? 0.35 * enterProg
      : isFinale
      ? lerp(0.10, 0.25, smoothstep(71.8, 74.5, t))
      : 0.10;
    const strokeAlpha = isHero
      ? 0.92 * enterProg
      : isFinale
      ? lerp(0.32, 0.68, smoothstep(71.8, 74.5, t))
      : 0.28;

    rctx.save();
    rctx.beginPath();
    MALI_POLY.forEach(([px, py], i) => {
      if (i === 0) rctx.moveTo(px, py);
      else rctx.lineTo(px, py);
    });
    rctx.closePath();

    const [cx, cy] = LOC.maliEmpireCenter;
    const grad = rctx.createRadialGradient(cx, cy, 40, cx, cy, 420);
    grad.addColorStop(0, `rgba(245, 196, 62, ${fillAlpha * 1.25})`);
    grad.addColorStop(0.7, `rgba(212, 158, 36, ${fillAlpha})`);
    grad.addColorStop(1, `rgba(180, 122, 20, ${fillAlpha * 0.4})`);
    rctx.fillStyle = grad;
    rctx.fill();

    const totalPts = MALI_POLY.length;
    const drawCount = borderProg * totalPts;
    rctx.beginPath();
    rctx.moveTo(MALI_POLY[0][0], MALI_POLY[0][1]);
    for (let i = 1; i <= totalPts; i++) {
      if (i - 1 > drawCount) break;
      const pPrev = MALI_POLY[i - 1];
      const pNext = MALI_POLY[i % totalPts];
      const segU = clamp(drawCount - (i - 1), 0, 1);
      const tx = lerp(pPrev[0], pNext[0], segU);
      const ty = lerp(pPrev[1], pNext[1], segU);
      rctx.lineTo(tx, ty);
    }
    rctx.strokeStyle = `rgba(238, 186, 52, ${strokeAlpha})`;
    rctx.lineWidth = 6.5;
    rctx.lineCap = "round";
    rctx.lineJoin = "round";
    rctx.stroke();

    rctx.strokeStyle = `rgba(42, 26, 12, ${strokeAlpha * 0.85})`;
    rctx.lineWidth = 2.2;
    rctx.setLineDash([12, 8]);
    rctx.stroke();
    rctx.restore();
  }

  function getRouteProgressToCairo(t) {
    // Starts drawing right on "set@20.69 out@20.96" and arrives at Cairo on "Cairo@37.09"
    if (t < 20.65) return 0;
    if (t >= 37.09) return 1;
    const stops = [
      { t: 20.65, p: 0.00 },
      { t: 23.40, p: 0.32 }, // Draws boldly out of Mali / Timbuktu into Western Sahara in Beat 5
      { t: 28.30, p: 0.49 }, // Western Sahara caravan (Beat 6)
      { t: 33.60, p: 0.78 }, // Central Sahara Catalan Atlas (Beat 7)
      { t: 37.09, p: 1.00 }, // Reaches Cairo right on spoken "Cairo@37.09" (Beat 8)
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].t && t <= stops[i + 1].t) {
        const u = smoothstep(stops[i].t, stops[i + 1].t, t);
        return lerp(stops[i].p, stops[i + 1].p, u);
      }
    }
    return 1;
  }

  function drawPolylineProgress(rctx, pts, prog, width, isHero, drawHeadGlow, t) {
    if (prog <= 0.001) return;
    const maxIdx = prog * (pts.length - 1);
    const fullCount = Math.floor(maxIdx);
    const rem = maxIdx - fullCount;

    rctx.save();
    rctx.beginPath();
    rctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= fullCount; i++) {
      rctx.lineTo(pts[i][0], pts[i][1]);
    }
    let tipX = pts[fullCount][0];
    let tipY = pts[fullCount][1];
    if (fullCount < pts.length - 1 && rem > 0) {
      tipX = lerp(pts[fullCount][0], pts[fullCount + 1][0], rem);
      tipY = lerp(pts[fullCount][1], pts[fullCount + 1][1], rem);
      rctx.lineTo(tipX, tipY);
    }

    rctx.lineCap = "round";
    rctx.lineJoin = "round";
    rctx.strokeStyle = isHero
      ? "rgba(248, 200, 70, 0.38)"
      : "rgba(218, 165, 45, 0.20)";
    rctx.lineWidth = width * 2.8;
    rctx.stroke();

    rctx.strokeStyle = isHero
      ? "rgba(35, 22, 10, 0.85)"
      : "rgba(35, 22, 10, 0.45)";
    rctx.lineWidth = width + 3.5;
    rctx.stroke();

    rctx.strokeStyle = isHero ? GOLD_BRIGHT : GOLD_HEX;
    rctx.lineWidth = width;
    rctx.stroke();

    // Glowing lead point + minimal trailing golden caravan shimmer motes while drawing
    if (drawHeadGlow && prog > 0.002 && prog < 0.998) {
      const g = rctx.createRadialGradient(tipX, tipY, 2, tipX, tipY, 36);
      g.addColorStop(0, "rgba(255, 245, 190, 0.95)");
      g.addColorStop(0.4, "rgba(242, 190, 55, 0.65)");
      g.addColorStop(1, "rgba(242, 190, 55, 0)");
      rctx.fillStyle = g;
      rctx.beginPath();
      rctx.arc(tipX, tipY, 36, 0, Math.PI * 2);
      rctx.fill();

      // 12 seeded golden shimmer motes along the active caravan head
      for (let m = 0; m < 12; m++) {
        const backIdx = Math.max(0, Math.floor(maxIdx - m * 2.2));
        const bp = pts[backIdx];
        const phase = t * 4.2 + m * 1.3;
        const ox = Math.sin(phase) * (5 + (m % 4) * 2.5);
        const oy = Math.cos(phase * 1.1) * (5 + (m % 3) * 2.5);
        const ma = (1 - m / 12) * (0.45 + 0.35 * Math.sin(phase * 1.5));
        rctx.fillStyle = `rgba(255, 236, 145, ${ma})`;
        rctx.beginPath();
        rctx.arc(bp[0] + ox, bp[1] + oy, 2.2 - m * 0.1, 0, Math.PI * 2);
        rctx.fill();
      }
    }
    rctx.restore();
  }

  function drawPilgrimageRoutes(rctx, t) {
    const p1 = getRouteProgressToCairo(t);
    const routeHero = (t >= 20.65 && t <= 38.4) || t >= 71.8;
    const w = t >= 71.8 ? 11.0 : 6.5;
    drawPolylineProgress(rctx, ROUTE_CAIRO_PTS, p1, w, routeHero, t < 37.2, t);

    // Return & Mecca loop draws during Beat 12 ("On his journey home...")
    if (t >= 54.4) {
      const p2 = smoothstep(54.4, 57.3, t);
      drawPolylineProgress(
        rctx,
        ROUTE_RETURN_PTS,
        p2,
        t >= 71.8 ? 8.5 : 5.0,
        t >= 54.4 && t < 58.0,
        t < 57.5,
        t
      );
    }

    // Subtle city medallions along active route (Mali, Timbuktu, Cairo, Mecca)
    const hubs = [
      { pos: LOC.maliHeart, showT: 0.0, r: 9 },
      { pos: LOC.timbuktu, showT: 21.1, r: 10 },
      { pos: LOC.cairo, showT: 36.9, r: 12 },
      { pos: LOC.mecca, showT: 54.8, r: 11 },
    ];
    for (const h of hubs) {
      if (t < h.showT) continue;
      const a = smoothstep(h.showT, h.showT + 0.4, t);
      const rad = t >= 71.8 ? h.r * 1.8 : h.r;
      rctx.save();
      rctx.globalAlpha = a;
      rctx.beginPath();
      rctx.arc(h.pos[0], h.pos[1], rad + 4, 0, Math.PI * 2);
      rctx.fillStyle = INK_DARK;
      rctx.fill();
      rctx.beginPath();
      rctx.arc(h.pos[0], h.pos[1], rad, 0, Math.PI * 2);
      rctx.fillStyle = GOLD_HEX;
      rctx.fill();
      rctx.restore();
    }
  }

  // Beat 9: Gold dinar hero coin + 18 scattered coins across Cairo
  const SCATTER_COINS = (function () {
    const rng = mulberry32(132409);
    const list = [];
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + (rng() - 0.5) * 0.28;
      const dist = 125 + rng() * 215;
      list.push({
        dx: Math.cos(ang) * dist * 1.25,
        dy: Math.sin(ang) * dist * 0.78,
        delay: 0.20 + (i % 6) * 0.16 + rng() * 0.22,
        r: 24 + rng() * 14,
        rot: (rng() - 0.5) * Math.PI * 2,
      });
    }
    return list;
  })();

  function drawGoldCoinsBeat9(rctx, img06, t) {
    // Beat 9: 38.60s - 43.27s ("Where he gave@39.03 gold@39.29 away freely...")
    if (t < 38.55) return;
    const alpha = getObjectOpacity(t, 38.55, 43.65, 54.0);
    if (alpha <= 0.005) return;

    const [cx, cy] = [3555, 800];

    // 1. Scattered gold dinars radiating out right on "gave@39.03 gold@39.29"
    for (let i = 0; i < SCATTER_COINS.length; i++) {
      const sc = SCATTER_COINS[i];
      const st = 38.95 + sc.delay;
      if (t < st) continue;
      const u = easeSoftLand(clamp((t - st) / 0.85, 0, 1));
      const x = cx + sc.dx * u;
      const y = cy + sc.dy * u;

      rctx.save();
      rctx.globalAlpha = alpha * smoothstep(st, st + 0.18, t);
      rctx.translate(x, y);
      rctx.rotate(sc.rot + (1 - u) * 1.8);

      rctx.beginPath();
      rctx.arc(4, 6, sc.r, 0, Math.PI * 2);
      rctx.fillStyle = "rgba(18, 10, 4, 0.42)";
      rctx.fill();

      if (img06 && img06.complete) {
        rctx.save();
        rctx.beginPath();
        rctx.arc(0, 0, sc.r, 0, Math.PI * 2);
        rctx.clip();
        rctx.drawImage(img06, -sc.r * 1.04, -sc.r * 1.04, sc.r * 2.08, sc.r * 2.08);
        rctx.restore();
      } else {
        rctx.beginPath();
        rctx.arc(0, 0, sc.r, 0, Math.PI * 2);
        rctx.fillStyle = GOLD_HEX;
        rctx.fill();
      }

      rctx.strokeStyle = GOLD_BRIGHT;
      rctx.lineWidth = 2;
      rctx.beginPath();
      rctx.arc(0, 0, sc.r - 1, 0, Math.PI * 2);
      rctx.stroke();
      rctx.restore();
    }

    // 2. Central Hero 06 Mamluk Gold Dinar Coin
    const heroDrop = easeSoftLand(clamp((t - 38.55) / 0.68, 0, 1));
    const heroR = 112 * lerp(1.22, 1.0, heroDrop);
    rctx.save();
    rctx.globalAlpha = alpha;
    rctx.translate(cx, cy);
    rctx.rotate((t - 38.55) * 0.03);

    if (t < 43.9) {
      const aura = rctx.createRadialGradient(0, 0, heroR * 0.4, 0, 0, heroR * 2.1);
      aura.addColorStop(0, "rgba(255, 228, 120, 0.55)");
      aura.addColorStop(0.5, "rgba(232, 178, 45, 0.22)");
      aura.addColorStop(1, "rgba(232, 178, 45, 0)");
      rctx.fillStyle = aura;
      rctx.beginPath();
      rctx.arc(0, 0, heroR * 2.1, 0, Math.PI * 2);
      rctx.fill();
    }

    rctx.beginPath();
    rctx.arc(10, 14, heroR, 0, Math.PI * 2);
    rctx.fillStyle = "rgba(15, 9, 3, 0.52)";
    rctx.fill();

    if (img06 && img06.complete) {
      rctx.save();
      rctx.beginPath();
      rctx.arc(0, 0, heroR, 0, Math.PI * 2);
      rctx.clip();
      rctx.drawImage(img06, -heroR * 1.03, -heroR * 1.03, heroR * 2.06, heroR * 2.06);
      rctx.restore();
    }
    rctx.strokeStyle = GOLD_BRIGHT;
    rctx.lineWidth = 4;
    rctx.beginPath();
    rctx.arc(0, 0, heroR - 2, 0, Math.PI * 2);
    rctx.stroke();
    rctx.restore();
  }

  // Beat 10 & 11: Merchant Ledger Sheet + Gold-Price Line Collapse + "12 YEARS" Stamp
  function drawCairoLedger(rctx, t) {
    // Beat 10 starts at 44.20s ("He flooded the streets with so much bullion, that the price of gold collapsed@47.56")
    // Beat 11 starts at 49.60s ("Shattering Egypt's markets, taking twelve@51.77 years@52.12 for the economy to recover")
    if (t < 44.10) return;
    const alpha = getObjectOpacity(t, 44.10, 54.35, 57.5);
    if (alpha <= 0.005) return;

    const lx = 3695;
    const ly = 875;
    const lw = 640;
    const lh = 350;

    const dropProg = easeSoftLand(clamp((t - 44.10) / 0.78, 0, 1));
    const scale = lerp(1.14, 1.0, dropProg);
    const glideY = lerp(24, 0, dropProg);

    rctx.save();
    rctx.globalAlpha = alpha;
    rctx.translate(lx, ly + glideY);
    rctx.rotate(0.015);
    rctx.scale(scale, scale);

    rctx.save();
    rctx.shadowColor = `rgba(14, 8, 3, ${0.48 * alpha})`;
    rctx.shadowBlur = 26;
    rctx.shadowOffsetX = 10;
    rctx.shadowOffsetY = 16;
    rctx.fillStyle = "#EFE2C6";
    rctx.fillRect(-lw / 2, -lh / 2, lw, lh);
    rctx.restore();

    rctx.strokeStyle = "rgba(62, 44, 28, 0.55)";
    rctx.lineWidth = 2;
    rctx.strokeRect(-lw / 2 + 12, -lh / 2 + 12, lw - 24, lh - 24);

    // Rule 3: Soft grey abstract paper lines (zero filler words)
    const rows = 9;
    const topY = -lh / 2 + 40;
    const botY = lh / 2 - 36;
    for (let r = 0; r <= rows; r++) {
      const ry = lerp(topY, botY, r / rows);
      rctx.beginPath();
      rctx.moveTo(-lw / 2 + 26, ry);
      rctx.lineTo(lw / 2 - 26, ry);
      rctx.strokeStyle =
        r === 0 || r === rows
          ? "rgba(85, 68, 50, 0.38)"
          : "rgba(115, 102, 86, 0.24)";
      rctx.lineWidth = r === 0 ? 1.8 : 1.1;
      rctx.stroke();

      if (r < rows) {
        const barY = ry + ((botY - topY) / rows) * 0.45;
        const barW = 42 + ((r * 19) % 28);
        rctx.strokeStyle = "rgba(128, 116, 102, 0.28)";
        rctx.lineWidth = 5;
        rctx.lineCap = "round";
        rctx.beginPath();
        rctx.moveTo(-lw / 2 + 36, barY);
        rctx.lineTo(-lw / 2 + 36 + barW, barY);
        rctx.stroke();
      }
    }

    rctx.beginPath();
    rctx.moveTo(-lw / 2 + 102, topY);
    rctx.lineTo(-lw / 2 + 102, botY);
    rctx.strokeStyle = "rgba(138, 52, 38, 0.28)";
    rctx.lineWidth = 1.4;
    rctx.stroke();

    // Gold-price curve: steady high plateau until 47.52s ("collapsed@47.56"), then sharp vertical plunge!
    const chartX0 = -lw / 2 + 122;
    const chartX1 = lw / 2 - 42;
    const highY = topY + 34;
    const crashY = botY - 22;

    const priceKeyframes = [
      { t: 44.45, x: 0.00, y: highY + 6 },
      { t: 45.20, x: 0.05, y: highY - 4 },
      { t: 46.00, x: 0.10, y: highY + 3 },
      { t: 46.80, x: 0.15, y: highY - 6 },
      { t: 47.52, x: 0.19, y: highY + 2 },   // Exact onset of "collapsed" (47.56s)!
      { t: 47.74, x: 0.22, y: lerp(highY, crashY, 0.68) },
      { t: 47.98, x: 0.25, y: crashY },      // Bottom of crash (completely clear of 12 YEARS stamp!)
      { t: 49.60, x: 0.54, y: crashY - 4 },  // Flat depressed trough
      { t: 53.60, x: 0.94, y: crashY - 22 }, // Slow 12-year crawl during Beat 11
    ];

    if (t >= priceKeyframes[0].t) {
      const drawnPts = [];
      for (let i = 0; i < priceKeyframes.length; i++) {
        const kf = priceKeyframes[i];
        const px = lerp(chartX0, chartX1, kf.x);
        const py = kf.y;
        if (t >= kf.t) {
          drawnPts.push([px, py]);
        } else if (i > 0 && t > priceKeyframes[i - 1].t) {
          const prev = priceKeyframes[i - 1];
          const u = smoothstep(prev.t, kf.t, t);
          drawnPts.push([
            lerp(lerp(chartX0, chartX1, prev.x), px, u),
            lerp(prev.y, py, u),
          ]);
          break;
        }
      }

      if (drawnPts.length >= 2) {
        rctx.save();
        rctx.beginPath();
        rctx.moveTo(drawnPts[0][0], botY);
        for (const [px, py] of drawnPts) rctx.lineTo(px, py);
        rctx.lineTo(drawnPts[drawnPts.length - 1][0], botY);
        rctx.closePath();
        const areaGrad = rctx.createLinearGradient(0, highY, 0, botY);
        areaGrad.addColorStop(0, "rgba(232, 180, 48, 0.34)");
        areaGrad.addColorStop(1, "rgba(168, 62, 32, 0.06)");
        rctx.fillStyle = areaGrad;
        rctx.fill();

        rctx.beginPath();
        drawnPts.forEach(([px, py], i) => {
          if (i === 0) rctx.moveTo(px, py + 2);
          else rctx.lineTo(px, py + 2);
        });
        rctx.strokeStyle = "rgba(28, 18, 8, 0.78)";
        rctx.lineWidth = 8.5;
        rctx.lineCap = "round";
        rctx.lineJoin = "round";
        rctx.stroke();

        rctx.beginPath();
        drawnPts.forEach(([px, py], i) => {
          if (i === 0) rctx.moveTo(px, py);
          else rctx.lineTo(px, py);
        });
        const lineGrad = rctx.createLinearGradient(0, highY, 0, crashY);
        lineGrad.addColorStop(0, GOLD_BRIGHT);
        lineGrad.addColorStop(0.55, GOLD_HEX);
        lineGrad.addColorStop(1, "#C84B28");
        rctx.strokeStyle = lineGrad;
        rctx.lineWidth = 5.5;
        rctx.stroke();

        const [tx, ty] = drawnPts[drawnPts.length - 1];
        rctx.beginPath();
        rctx.arc(tx, ty, 7, 0, Math.PI * 2);
        rctx.fillStyle = t >= 47.52 ? "#E05A32" : GOLD_BRIGHT;
        rctx.fill();
        rctx.restore();
      }
    }

    rctx.restore();

    // Beat 11 Hero Text: "12 YEARS" stamped cleanly on the right side of the ledger at "twelve@51.77 years@52.12"
    drawHeroText(rctx, "12 YEARS", {
      t,
      startT: 51.72,
      endT: 54.35,
      x: lx + 128,
      y: ly - 36,
      fontSize: 64,
      fontFamily: UI_FONT,
      mode: "stamp",
      color: INK_DARK,
      accentGold: true,
    });
  }

  // --------------------------------------------------------------------------
  // 7. SCENE RENDERER AT TIME t (SINGLE EXPOSURE PASS)
  // --------------------------------------------------------------------------
  function renderExposure(targetCtx, t, cam) {
    targetCtx.save();
    targetCtx.fillStyle = "#16100B";
    targetCtx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Apply camera transform
    targetCtx.translate(VIEW_W / 2, VIEW_H / 2);
    targetCtx.scale(cam.zoom, cam.zoom);
    targetCtx.rotate(cam.rot);
    targetCtx.translate(-cam.x, -cam.y);

    // 1. Draw procedural hand-inked parchment world map
    targetCtx.drawImage(baseMapCanvas, 0, 0);

    // 2. Draw Mali Empire illuminated region & animated border (Beat 3 + Beat 15)
    drawMaliEmpireRegion(targetCtx, t);

    // 3. Minimal Cartographic Caliper / Astrolabe Rings around active story hubs
    drawCartographicCaliper(targetCtx, 945, 1900, 250, t, 0.05, 5.45);     // Mali Heart (Beat 1)
    drawCartographicCaliper(targetCtx, 1117, 1796, 370, t, 8.10, 12.60);   // Mali Empire (Beat 3)
    drawCartographicCaliper(targetCtx, 3493, 781, 260, t, 34.20, 43.70);   // Cairo Hub (Beats 8-9)
    drawCartographicCaliper(targetCtx, 1320, 1635, 275, t, 55.20, 65.20);  // Timbuktu Hub (Beats 12-13)
    drawCartographicCaliper(targetCtx, 1720, 700, 265, t, 65.80, 71.20);   // Mediterranean (Beat 14)

    // 4. Draw Golden Pilgrimage Routes (Beat 5 -> 8, Beat 12 -> 15)
    drawPilgrimageRoutes(targetCtx, t);

    // 5. Draw Physical Archival Prints & Documents in World Space
    // Beat 1 (0.00 - 5.42s): 01 Mansa Musa print lands in Mali, glowing gold orb
    const beat1Glow =
      t < 5.65
        ? smoothstep(-0.35, 0.15, t) * (0.85 + 0.15 * Math.sin(t * 4.2))
        : 0;
    drawArchivalPrint(targetCtx, IMAGES.img01, {
      t,
      enterT: -0.35,
      heroEndT: 5.55,
      fadeOutT: 12.8,
      x: 945,
      y: 1900,
      w: 440,
      h: 315,
      angle: -0.025,
      slideFrom: [-18, 24],
      kbDir: [1, -1],
      goldGlow: beat1Glow,
      orbSpot: { rx: -0.123, ry: -0.194 },
      cam,
    });

    // Beat 1 Hook: Expanding golden cartographic rings from the orb in the first 2.5 seconds
    if (t >= 0.05 && t <= 4.8) {
      const orbWorldX = 945 - 0.123 * 440;
      const orbWorldY = 1900 - 0.194 * 315;
      for (const pulseStart of [0.05, 0.70, 1.55, 2.55, 3.60]) {
        const dt = t - pulseStart;
        if (dt > 0 && dt < 1.95) {
          const u = dt / 1.95;
          const r = 20 + easeOutCubic(u) * 275;
          targetCtx.save();
          targetCtx.strokeStyle = `rgba(245, 188, 38, ${(1 - u) * 0.78})`;
          targetCtx.lineWidth = 3.8 * (1 - u * 0.45);
          targetCtx.beginPath();
          targetCtx.arc(orbWorldX, orbWorldY, r, 0, Math.PI * 2);
          targetCtx.stroke();
          targetCtx.restore();
        }
      }
    }

    // Beat 4 (13.00 - 17.70s): 02 Gold nuggets photo drops in over Mali goldfields
    const beat4Glow =
      t >= 12.95 && t <= 18.2
        ? smoothstep(13.2, 15.2, t) * (0.78 + 0.22 * Math.sin(t * 3.8))
        : 0;
    drawArchivalPrint(targetCtx, IMAGES.img02, {
      t,
      enterT: 12.95,
      heroEndT: 18.25,
      fadeOutT: 24.0,
      x: 930,
      y: 1950,
      w: 410,
      h: 270,
      angle: 0.022,
      slideFrom: [-16, 26],
      kbDir: [1, 1],
      goldGlow: beat4Glow,
      cam,
    });

    // Beat 6 (24.00 - 28.25s): 03 Caravan engraving print in Western Sahara
    drawArchivalPrint(targetCtx, IMAGES.img03, {
      t,
      enterT: 23.95,
      heroEndT: 28.65,
      fadeOutT: 54.0,
      x: 1255,
      y: 1215,
      w: 430,
      h: 310,
      angle: -0.028,
      slideFrom: [-22, 22],
      kbDir: [1, -0.5],
      crop: { sx: 0.02, sy: 0.08, sw: 0.96, sh: 0.88 },
      cam,
    });

    // Beat 7 (29.00 - 33.77s): 04 Catalan Atlas Sahara section in Central Sahara
    const beat7Glow =
      t >= 28.95 && t <= 34.0 ? smoothstep(30.5, 32.6, t) * 0.68 : 0;
    drawArchivalPrint(targetCtx, IMAGES.img04, {
      t,
      enterT: 28.95,
      heroEndT: 33.95,
      fadeOutT: 54.0,
      x: 2260,
      y: 850,
      w: 470,
      h: 345,
      angle: 0.018,
      slideFrom: [-24, 18],
      kbDir: [1, -1],
      goldGlow: beat7Glow,
      orbSpot: { rx: 0.02, ry: 0.07 },
      cam,
    });

    // Beat 8 (34.20 - 38.00s): 05 Cairo print by David Roberts at Nile Delta
    drawArchivalPrint(targetCtx, IMAGES.img05, {
      t,
      enterT: 34.18,
      heroEndT: 38.35,
      fadeOutT: 54.2,
      x: 3290,
      y: 785,
      w: 310,
      h: 395,
      angle: -0.02,
      slideFrom: [-22, 16],
      kbDir: [0.6, -1],
      cam,
    });

    // Beat 9 (38.60 - 43.27s): 06 Gold dinar coin + scattered coins across Cairo
    drawGoldCoinsBeat9(targetCtx, IMAGES.img06, t);

    // Beat 10 & 11 (44.20 - 54.11s): Ledger paper + collapsing gold price line + 12 YEARS stamp
    drawCairoLedger(targetCtx, t);

    // Beat 12 (55.00 - 60.15s): 07 Timbuktu manuscript page on return to Timbuktu
    drawArchivalPrint(targetCtx, IMAGES.img07, {
      t,
      enterT: 55.55,
      heroEndT: 60.20,
      fadeOutT: 71.5,
      x: 1445,
      y: 1595,
      w: 440,
      h: 320,
      angle: 0.022,
      slideFrom: [24, -18],
      kbDir: [-1, 0.8],
      cam,
    });

    // Beat 13 (60.40 - 65.14s): 08 Djinguereber Mosque print at Timbuktu
    drawArchivalPrint(targetCtx, IMAGES.img08, {
      t,
      enterT: 60.35,
      heroEndT: 65.35,
      fadeOutT: 71.8,
      x: 1185,
      y: 1625,
      w: 430,
      h: 315,
      angle: -0.018,
      slideFrom: [-18, 22],
      kbDir: [1, -0.8],
      crop: { sx: 0.04, sy: 0.03, sw: 0.92, sh: 0.86 },
      cam,
    });

    // Beat 14 (65.80 - 70.94s): 09 Dulcert map (1339) print in Mediterranean / North Africa
    drawArchivalPrint(targetCtx, IMAGES.img09, {
      t,
      enterT: 65.75,
      heroEndT: 71.30,
      fadeOutT: 73.2,
      x: 1720,
      y: 700,
      w: 450,
      h: 340,
      angle: -0.015,
      slideFrom: [16, -24],
      kbDir: [0.8, 0.8],
      goldGlow: t >= 68.5 && t <= 71.3 ? 0.48 : 0,
      cam,
    });

    // Beat 15 (72.00 - 78.60s): 01 Mansa Musa print returns small on the full pulled-back world map
    if (t >= 71.80) {
      drawArchivalPrint(targetCtx, IMAGES.img01, {
        t,
        enterT: 71.85,
        heroEndT: 79.5,
        x: 1080,
        y: 1680,
        w: 760,
        h: 545,
        angle: -0.02,
        slideFrom: [0, 20],
        kbDir: [0.6, -0.6],
        goldGlow: 0.92,
        orbSpot: { rx: -0.123, ry: -0.194 },
        cam,
      });
    }

    // 6. Draw Exact Word-Synced Hero On-Screen Text (2-frame lead before spoken word onset)
    // Beat 2: "His name was Mansa@6.60 Musa@7.00" -> MANSA MUSA
    drawHeroText(targetCtx, "MANSA MUSA", {
      t,
      startT: 6.53,
      endT: 7.90,
      x: 1085,
      y: 1840,
      fontSize: 112,
      fontFamily: DISPLAY_FONT,
      mode: "type",
      accentGold: true,
    });

    // Beat 3: "He ruled the vast empire of Mali@9.63..." -> MALI
    drawHeroText(targetCtx, "MALI", {
      t,
      startT: 9.56,
      endT: 12.60,
      x: 1105,
      y: 1805,
      fontSize: 138,
      fontFamily: DISPLAY_FONT,
      mode: "type",
      accentGold: true,
    });

    // Beat 5: "In 1324@18.84, he set out..." -> 1324
    drawHeroText(targetCtx, "1324", {
      t,
      startT: 18.80,
      endT: 23.75,
      x: 1185,
      y: 1560,
      fontSize: 134,
      fontFamily: UI_FONT,
      mode: "slam",
      accentGold: true,
    });

    // Beat 6: "Sixty@24.05 thousand@24.51 people marched..." -> 60,000
    drawHeroText(targetCtx, "60,000", {
      t,
      startT: 24.00,
      endT: 28.55,
      x: 1715,
      y: 1215,
      fontSize: 114,
      fontFamily: UI_FONT,
      mode: "slam",
      accentGold: true,
    });

    // Beat 8: "...he finally reached Cairo@37.09" -> CAIRO
    drawHeroText(targetCtx, "CAIRO", {
      t,
      startT: 37.02,
      endT: 38.45,
      x: 3725,
      y: 775,
      fontSize: 114,
      fontFamily: DISPLAY_FONT,
      mode: "type",
      accentGold: true,
    });

    // Beat 13: "In Timbuktu, they built@61.72 a legendary mud-brick mosque@63.05..." -> 1327
    drawHeroText(targetCtx, "1327", {
      t,
      startT: 61.66,
      endT: 65.30,
      x: 1590,
      y: 1615,
      fontSize: 114,
      fontFamily: UI_FONT,
      mode: "stamp",
      accentGold: true,
    });

    // Beat 15: "Mansa@72.05 Musa@72.53. The golden emperor of Mali..." -> 1312–1337
    drawHeroText(targetCtx, "1312–1337", {
      t,
      startT: 72.55,
      endT: 79.00,
      x: 2680,
      y: 1640,
      fontSize: 285,
      fontFamily: UI_FONT,
      mode: "type",
      accentGold: true,
    });

    targetCtx.restore();
  }

  // --------------------------------------------------------------------------
  // 8. POST-PROCESS FILM PIPELINE (WARM LIGHT SWEEP, GRAIN, DUST & VIGNETTE)
  // --------------------------------------------------------------------------
  function applyFilmPostProcess(t) {
    const frameIdx = Math.round(t * 30);
    const rng = mulberry32(700001 + frameIdx * 1009);

    // 1. Subtle Warm Anamorphic Parchment Light Sweep
    ctx.save();
    const beamX = VIEW_W * (0.28 + 0.44 * (0.5 + 0.5 * Math.sin(t * 0.14)));
    const beamGrad = ctx.createRadialGradient(
      beamX, VIEW_H * 0.38, 40,
      beamX, VIEW_H * 0.45, VIEW_W * 0.55
    );
    beamGrad.addColorStop(0, "rgba(255, 232, 175, 0.065)");
    beamGrad.addColorStop(0.5, "rgba(240, 195, 110, 0.025)");
    beamGrad.addColorStop(1, "rgba(240, 195, 110, 0)");
    ctx.fillStyle = beamGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();

    // 2. Deterministic film grain overlay
    const tile = grainTiles[frameIdx % NUM_GRAIN_TILES];
    if (tile) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.32;
      const ox = -Math.floor(rng() * 64);
      const oy = -Math.floor(rng() * 64);
      for (let y = oy; y < VIEW_H; y += GRAIN_H) {
        for (let x = ox; x < VIEW_W; x += GRAIN_W) {
          ctx.drawImage(tile, x, y);
        }
      }
      ctx.restore();
    }

    // 3. Subtle floating golden dust motes & archival specks (seeded, deterministic)
    ctx.save();
    for (let i = 0; i < 20; i++) {
      const seed = i * 317 + 19;
      const bx = ((seed * 73.1 + t * (13 + (i % 5) * 4)) % (VIEW_W + 80)) - 40;
      const by =
        (((seed * 41.7 + Math.sin(t * 0.65 + i) * 38) % (VIEW_H + 80)) +
          (VIEW_H + 80)) %
          (VIEW_H + 80) -
        40;
      const r = 1.1 + (i % 3) * 0.65;
      const a = 0.13 + 0.11 * Math.sin(t * 2.0 + i * 1.7);
      ctx.fillStyle = `rgba(255, 228, 152, ${a})`;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 4. Optical 21:9 Cinema Vignette
    ctx.save();
    const vig = ctx.createRadialGradient(
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_W * 0.28,
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_W * 0.62
    );
    vig.addColorStop(0, "rgba(18, 11, 5, 0)");
    vig.addColorStop(0.68, "rgba(18, 11, 5, 0.18)");
    vig.addColorStop(1, "rgba(10, 6, 2, 0.64)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 9. ASSET LOADER & PURE window.seek(t) ENTRY POINT
  // --------------------------------------------------------------------------
  const IMAGES = {};

  function seek(t) {
    const tc = clamp(Number(t) || 0, 0, TOTAL_DUR);
    const camNow = getCameraState(tc);
    const camPrev = getCameraState(Math.max(0, tc - 1 / 30));

    // Measure screen-space camera speed for authentic optical shutter motion blur
    const screenSpeed =
      Math.hypot(camNow.x - camPrev.x, camNow.y - camPrev.y) * camNow.zoom +
      Math.abs(Math.log(camNow.zoom / camPrev.zoom)) * 650;

    if (screenSpeed > 14.0) {
      const subOffsets = [-0.015, -0.0075, 0];
      const subAlphas = [1.0, 0.45, 0.42];
      for (let s = 0; s < 3; s++) {
        const st = clamp(tc + subOffsets[s], 0, TOTAL_DUR);
        const scam = getCameraState(st);
        if (s === 0) {
          renderExposure(ctx, st, scam);
        } else {
          renderExposure(sceneCtx, st, scam);
          ctx.save();
          ctx.globalAlpha = subAlphas[s];
          ctx.drawImage(sceneBuffer, 0, 0);
          ctx.restore();
        }
      }
    } else {
      renderExposure(ctx, tc, camNow);
    }

    applyFilmPostProcess(tc);
    return true;
  }

  window.seek = seek;
  window.getCameraState = getCameraState;

  async function init() {
    buildBaseMap();
    buildGrainTiles();

    const assetMap = window.FILM_ASSETS || {};
    const keys = Object.keys(assetMap);
    await Promise.all(
      keys.map(
        (k) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              IMAGES[k] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = assetMap[k];
          })
      )
    );

    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (_) {}
    }

    // Register HyperFrames seek protocol & GSAP master timeline after async build completes
    window.addEventListener("hf-seek", (e) => {
      if (e && e.detail && typeof e.detail.time === "number") {
        seek(e.detail.time);
      }
    });

    if (typeof window.gsap !== "undefined") {
      const proxy = { t: 0 };
      const tl = window.gsap.timeline({ paused: true });
      tl.fromTo(
        proxy,
        { t: 0 },
        {
          t: TOTAL_DUR,
          duration: TOTAL_DUR,
          ease: "none",
          onUpdate: function () {
            seek(proxy.t);
          },
        },
        0
      );
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = tl;
    }

    window.__READY = true;
    seek(0.45);

    // Interactive browser playback when clicked directly (e.g., on GitHub Pages)
    const audioEl = document.getElementById("voiceover");
    if (canvas && audioEl && typeof window.gsap !== "undefined") {
      canvas.style.cursor = "pointer";
      canvas.addEventListener("click", () => {
        if (audioEl.paused) {
          audioEl.play();
          window.gsap.ticker.add(syncAudioTick);
        } else {
          audioEl.pause();
          window.gsap.ticker.remove(syncAudioTick);
        }
      });
      function syncAudioTick() {
        if (!audioEl.paused) {
          seek(audioEl.currentTime);
        }
      }
    }
  }

  init();
})();
