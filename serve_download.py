import http.server
import os
import socketserver

PORT = 8765
VIDEO_PATH = r"c:\Users\mania\.antigravity-ide\mansa-musa-film\mansa_musa_final.mp4"

HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mansa Musa — The Golden Hajj (Download & Preview)</title>
  <style>
    body {
      margin: 0;
      padding: 40px 24px;
      background: #14100b;
      color: #f4ebd9;
      font-family: Georgia, serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      color: #d8a632;
      letter-spacing: 0.04em;
    }
    p {
      margin: 0 0 24px 0;
      color: #b8a686;
      font-family: monospace;
      font-size: 14px;
    }
    .actions {
      margin-bottom: 24px;
      display: flex;
      gap: 16px;
    }
    a.btn {
      display: inline-block;
      background: #d8a632;
      color: #14100b;
      font-family: monospace;
      font-weight: bold;
      font-size: 16px;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 6px;
      box-shadow: 0 6px 20px rgba(216, 166, 50, 0.3);
    }
    a.btn:hover {
      background: #e9b949;
    }
    video {
      width: 100%;
      max-width: 1120px;
      aspect-ratio: 1920 / 824;
      border: 1px solid #3a2e1e;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.65);
      background: #000;
    }
  </style>
</head>
<body>
  <h1>MANSA MUSA — THE GOLDEN HAJJ</h1>
  <p>1920×824 (21:9) · 30 fps · 78.60s · H.264 yuv420p CRF 16 · Studio Audio (-15.4 LUFS)</p>
  <div class="actions">
    <a class="btn" href="/download" download="mansa_musa_final.mp4">⬇ Download MP4 (95.2 MB)</a>
  </div>
  <video controls autoplay preload="metadata" src="/stream"></video>
</body>
</html>
"""

class DownloadHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path.startswith("/index"):
            data = HTML_PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif self.path.startswith("/download") or self.path.startswith("/mansa_musa_final.mp4"):
            size = os.path.getsize(VIDEO_PATH)
            self.send_response(200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Content-Disposition", 'attachment; filename="mansa_musa_final.mp4"')
            self.send_header("Content-Length", str(size))
            self.end_headers()
            with open(VIDEO_PATH, "rb") as f:
                while chunk := f.read(1024 * 256):
                    try:
                        self.wfile.write(chunk)
                    except (ConnectionResetError, BrokenPipeError):
                        break
        elif self.path.startswith("/stream"):
            size = os.path.getsize(VIDEO_PATH)
            range_header = self.headers.get("Range")
            if range_header and range_header.startswith("bytes="):
                ranges = range_header.replace("bytes=", "").split("-")
                start = int(ranges[0]) if ranges[0] else 0
                end = int(ranges[1]) if len(ranges) > 1 and ranges[1] else size - 1
                end = min(end, size - 1)
                length = end - start + 1
                self.send_response(206)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.send_header("Content-Length", str(length))
                self.end_headers()
                with open(VIDEO_PATH, "rb") as f:
                    f.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk = f.read(min(1024 * 256, remaining))
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                        except (ConnectionResetError, BrokenPipeError):
                            break
                        remaining -= len(chunk)
            else:
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(size))
                self.end_headers()
                with open(VIDEO_PATH, "rb") as f:
                    while chunk := f.read(1024 * 256):
                        try:
                            self.wfile.write(chunk)
                        except (ConnectionResetError, BrokenPipeError):
                            break
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        pass

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == "__main__":
    server = ThreadedHTTPServer(("127.0.0.1", PORT), DownloadHandler)
    print(f"Serving download page at http://127.0.0.1:{PORT}/ and direct download at http://127.0.0.1:{PORT}/download")
    server.serve_forever()

