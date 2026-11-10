const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const BASE_DIR = __dirname;
const ARTIFACT_DIR = "C:\\Users\\mania\\.gemini\\antigravity\\brain\\2fe53c59-9f89-4e60-83b8-c12b5aa281d3";
const PORT = 8766;
const TOTAL_FRAMES = 2358;
const FPS = 30;
const OUT_MP4 = path.join(BASE_DIR, "mansa_musa_final.mp4");
const VOICEOVER_WAV = path.join(BASE_DIR, "voiceover.wav");

// Spawn FFmpeg pipeline: 30fps image2pipe -> H.264 yuv420p CRF 16 + voiceover.wav
const ffmpeg = spawn(
  "ffmpeg",
  [
    "-y",
    "-f", "image2pipe",
    "-vcodec", "mjpeg",
    "-framerate", String(FPS),
    "-i", "-",
    "-i", VOICEOVER_WAV,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "16",
    "-pix_fmt", "yuv420p",
    "-color_range", "tv",
    "-r", String(FPS),
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    "-movflags", "+faststart",
    OUT_MP4,
  ],
  { stdio: ["pipe", "inherit", "inherit"] }
);

let framesReceived = 0;
const startTime = Date.now();

const RENDER_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1920px; height: 824px; overflow: hidden; background: #140f0a; }
    #stage { display: block; width: 1920px; height: 824px; }
  </style>
</head>
<body>
  <canvas id="stage" width="1920" height="824"></canvas>
  <script src="/assets_data.js"></script>
  <script src="/film.js"></script>
  <script>
    async function buildSheetAndPost(canvas, items, filename) {
      const sheet = document.createElement("canvas");
      sheet.width = 1920;
      sheet.height = 824;
      const sctx = sheet.getContext("2d");
      sctx.fillStyle = "#0E0A07";
      sctx.fillRect(0, 0, 1920, 824);
      const cols = 5, rows = 3;
      const cw = Math.floor(1920 / cols);
      const ch = Math.floor(824 / rows);
      items.forEach((b, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const x = c * cw;
        const y = r * ch;
        window.seek(b.t);
        sctx.drawImage(canvas, 0, 0, 1920, 824, x + 4, y + 4, cw - 8, ch - 30);
        sctx.strokeStyle = "#E5B842";
        sctx.lineWidth = 1.2;
        sctx.strokeRect(x + 4, y + 4, cw - 8, ch - 30);
        sctx.fillStyle = "#F2E6CE";
        sctx.font = "bold 13px Consolas, monospace";
        sctx.fillText(b.label, x + 8, y + ch - 10);
      });
      const blob = await new Promise(res => sheet.toBlob(res, "image/jpeg", 0.94));
      const buf = await blob.arrayBuffer();
      await fetch("/save_qa?name=" + encodeURIComponent(filename), {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: buf
      });
    }

    (async function runRender() {
      while (!window.__READY) {
        await new Promise(r => setTimeout(r, 30));
      }
      const canvas = document.getElementById("stage");

      // 1. Export V2 15-Beat Contact Sheet & Camera Move Sequence Sheet
      await buildSheetAndPost(canvas, [
        { t: 1.20,  label: "B01 (1.20s): 01 Print + Gold Orb Glow" },
        { t: 7.30,  label: "B02 (7.30s): MANSA MUSA" },
        { t: 10.50, label: "B03 (10.50s): MALI + Empire Border" },
        { t: 15.50, label: "B04 (15.50s): 02 Gold Nuggets" },
        { t: 21.50, label: "B05 (21.50s): 1324 + Route Draws NE" },
        { t: 25.80, label: "B06 (25.80s): 03 Caravan + 60,000" },
        { t: 31.80, label: "B07 (31.80s): 04 Catalan Atlas Sahara" },
        { t: 37.65, label: "B08 (37.65s): 05 Cairo Print + CAIRO" },
        { t: 41.20, label: "B09 (41.20s): 06 Dinar + Coins Scatter" },
        { t: 48.10, label: "B10 (48.10s): Ledger + Collapsed Line" },
        { t: 52.60, label: "B11 (52.60s): 12 YEARS Stamp" },
        { t: 57.80, label: "B12 (57.80s): 07 Timbuktu Manuscript" },
        { t: 62.80, label: "B13 (62.80s): 08 Mosque + 1327" },
        { t: 68.80, label: "B14 (68.80s): 09 Dulcert Map (1339)" },
        { t: 75.50, label: "B15 (75.50s): World Pull-back + 1312–1337" }
      ], "contact_sheet.jpg");

      await buildSheetAndPost(canvas, [
        { t: 23.20, label: "M1 (23.20s): Leaving Mali (1324)" },
        { t: 23.75, label: "M1 (23.75s): Glide across W. Sahara" },
        { t: 24.25, label: "M1 (24.25s): 03 Caravan softLand + 60,000" },
        { t: 28.55, label: "M1 (28.55s): Handoff to Central Sahara" },
        { t: 29.40, label: "M1 (29.40s): 04 Atlas Sahara softLand" },
        { t: 33.80, label: "M2 (33.80s): Gliding East to Nile" },
        { t: 34.45, label: "M2 (34.45s): 05 Cairo Print softLand" },
        { t: 39.25, label: "M2 (39.25s): 06 Dinar + Coins Scatter" },
        { t: 44.45, label: "M2 (44.45s): Ledger Lands over Cairo" },
        { t: 47.75, label: "M2 (47.75s): Gold Price Collapsing!" },
        { t: 54.80, label: "M3 (54.80s): Sweeping SW to Timbuktu" },
        { t: 56.10, label: "M3 (56.10s): 07 Manuscript softLand" },
        { t: 60.80, label: "M3 (60.80s): 08 Mosque softLand" },
        { t: 71.60, label: "M3 (71.60s): World Pull-back Begins" },
        { t: 76.50, label: "M3 (76.50s): Full World Map + 1312–1337" }
      ], "camera_moves.jpg");

      // 2. Render all 2358 frames deterministically at 30fps
      for (let f = 0; f < ${TOTAL_FRAMES}; f++) {
        const t = f / ${FPS};
        window.seek(t);
        const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.98));
        const buf = await blob.arrayBuffer();
        await fetch("/frame?f=" + f, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: buf
        });
      }
      await fetch("/done", { method: "POST" });
      window.__RENDER_DONE = true;
    })();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (req.method === "GET" && url.pathname === "/render.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(RENDER_HTML);
    return;
  }
  if (req.method === "GET" && (url.pathname === "/film.js" || url.pathname === "/assets_data.js")) {
    const filePath = path.join(BASE_DIR, url.pathname.slice(1));
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/save_qa") {
    const name = path.basename(url.searchParams.get("name") || "qa.jpg");
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(path.join(ARTIFACT_DIR, name), buf);
      console.log(`[QA] Saved ${name} (${buf.length} bytes)`);
      res.writeHead(200);
      res.end("OK");
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/frame") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      const ok = ffmpeg.stdin.write(buf);
      framesReceived++;
      if (framesReceived % 150 === 0 || framesReceived === TOTAL_FRAMES) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Render] Frame ${framesReceived}/${TOTAL_FRAMES} (${((framesReceived / TOTAL_FRAMES) * 100).toFixed(1)}%) - ${elapsed}s elapsed`);
      }
      if (ok) {
        res.writeHead(200);
        res.end("OK");
      } else {
        ffmpeg.stdin.once("drain", () => {
          res.writeHead(200);
          res.end("OK");
        });
      }
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/done") {
    res.writeHead(200);
    res.end("DONE");
    console.log("[Render] All frames received. Closing FFmpeg stdin...");
    ffmpeg.stdin.end();
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

ffmpeg.on("close", (code) => {
  console.log(`[FFmpeg] Exited with code ${code}`);
  server.close(() => {
    process.exit(code || 0);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[Server] Listening on http://127.0.0.1:${PORT}/render.html`);
});
