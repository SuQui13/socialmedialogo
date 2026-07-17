import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, extname, join, normalize, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = 8765;
const root = normalize(fileURLToPath(new URL(".", import.meta.url)));
const exportRoot = join(root, "EXPORTS");
const sessions = new Map();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
};

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
}

function sendJson(response, statusCode, payload) {
  setCors(response);
  response.writeHead(statusCode, { "Content-Type": contentTypes[".json"], "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function safeLabel(value) {
  return String(value || "batch")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "batch";
}

function safeFilename(value) {
  const file = basename(String(value || ""))
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 180);
  return /\.(png|jpe?g|mp4)$/i.test(file) ? file : "";
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

function isInside(parent, child) {
  const base = normalize(parent).replace(/[\\/]+$/, "").toLowerCase();
  const candidate = normalize(child).toLowerCase();
  return candidate === base || candidate.startsWith(`${base}${sep}`);
}

async function startExport(url, response) {
  const label = safeLabel(url.searchParams.get("label"));
  const expected = Math.max(0, Number(url.searchParams.get("expected")) || 0);
  const id = `${timestamp()}-${randomUUID().slice(0, 8)}`;
  const folderName = `APCM-${label}-${id}`;
  const folderPath = join(exportRoot, folderName);

  await mkdir(folderPath, { recursive: true });
  sessions.set(id, { id, folderName, folderPath, expected, files: new Set() });
  sendJson(response, 201, { id, folderName, folderPath });
}

async function writeExportFile(request, response, url, session) {
  const filename = safeFilename(url.searchParams.get("name"));
  if (!filename) {
    sendJson(response, 400, { error: "Invalid export filename." });
    return;
  }

  const destination = join(session.folderPath, filename);
  if (!isInside(session.folderPath, destination)) {
    sendJson(response, 400, { error: "Invalid export path." });
    return;
  }

  const temporary = `${destination}.part`;
  try {
    await pipeline(request, createWriteStream(temporary, { flags: "w" }));
    await rename(temporary, destination);
    session.files.add(filename);
    sendJson(response, 200, { written: session.files.size, filename });
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function openExportFolder(response, session) {
  const process = spawn("explorer.exe", [session.folderPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  process.unref();
  sendJson(response, 200, { opened: true, folderPath: session.folderPath });
}

async function serveStatic(request, response, url) {
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
  const file = normalize(join(root, relative));
  if (!isInside(root, file)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const details = await stat(file);
    if (!details.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": details.size,
      "Cache-Control": "no-store",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${HOST}:${PORT}`);
    if (request.method === "OPTIONS") {
      setCors(response);
      response.writeHead(204).end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/status") {
      sendJson(response, 200, { ready: true, exportRoot });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/exports") {
      await startExport(url, response);
      return;
    }

    const match = url.pathname.match(/^\/api\/exports\/([a-z0-9-]+)\/(file|finish|open)$/);
    if (request.method === "POST" && match) {
      const session = sessions.get(match[1]);
      if (!session) {
        sendJson(response, 404, { error: "Export session not found." });
        return;
      }

      if (match[2] === "file") await writeExportFile(request, response, url, session);
      else if (match[2] === "open") openExportFolder(response, session);
      else sendJson(response, 200, {
        folderName: session.folderName,
        folderPath: session.folderPath,
        written: session.files.size,
        expected: session.expected,
      });
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      await serveStatic(request, response, url);
      return;
    }

    response.writeHead(405).end("Method not allowed");
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Local export failed." });
  }
});

server.listen(PORT, HOST, async () => {
  await mkdir(exportRoot, { recursive: true });
  console.log(`Social Photo Exporter ready at http://${HOST}:${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") process.exit(0);
  throw error;
});
