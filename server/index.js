import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { handleApi, bootstrap } from "./routes.js";
import url from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");
const PORT = process.env.PORT || 3000;

await bootstrap();

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname } = parsedUrl;

  if (pathname.startsWith("/api/")) {
    return handleApi(req, res, parsedUrl);
  }

  // Serve static assets
  const assetPath = resolvePublicPath(pathname);
  if (assetPath) {
    fs.createReadStream(assetPath)
      .on("open", () => {
        const ext = path.extname(assetPath);
        const mime = contentTypes[ext] || "text/plain";
        res.writeHead(200, { "Content-Type": mime });
      })
      .on("error", () => {
        res.writeHead(404);
        res.end();
      })
      .pipe(res);
    return;
  }

  // Fallback to SPA entry
  const indexFile = path.join(publicDir, "index.html");
  fs.createReadStream(indexFile)
    .on("open", () => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    })
    .on("error", () => {
      res.writeHead(500);
      res.end("Missing index file");
    })
    .pipe(res);
});

server.listen(PORT, () => {
  console.log(`Cabinet meeting app running at http://localhost:${PORT}`);
});

function resolvePublicPath(requestPath) {
  const cleanPath = requestPath.split("?")[0];
  const target = path.join(publicDir, cleanPath);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return target;
  }
  const alt = path.join(publicDir, cleanPath.replace(/^\//, ""));
  if (fs.existsSync(alt) && fs.statSync(alt).isFile()) {
    return alt;
  }
  return null;
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
