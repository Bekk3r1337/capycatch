"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = __dirname;
const outputDirectory = path.join(projectRoot, "dist-twitch");
const archivePath = path.join(projectRoot, "CapyCatch-Twitch-4.0.zip");
const copiedFiles = [
  "style.css",
  "twitch.js",
  "adventure.js",
  "progression.js",
  "game.js",
  "capy.webp",
  "mandarin.webp",
  "gold.webp",
  "bomb.webp"
];

function fail(message) {
  throw new Error(`[twitch-build] ${message}`);
}

function createPanelHtml() {
  let html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  html = html.replace(
    '<html lang="ru">',
    '<html lang="ru" class="twitch-panel twitch-theme-dark">'
  );
  html = html.replace(
    "<head>",
    '<head>\n  <script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js"></script>'
  );
  html = html.replace("<body>", '<body class="twitch-panel twitch-theme-dark">');
  html = html.replace(/\n\s*<div id="chat-badge"[^\n]*<\/div>/, "");
  html = html.replace(/\n\s*<button id="streamer-button"[^\n]*<\/button>/, "");
  html = html.replace(/<button id="online-board-button"[^\n]*<\/button>/, "");
  html = html.replace(/\n\s*<dialog id="streamer-dialog"[\s\S]*?\n\s*<\/dialog>/, "");
  html = html.replace(
    '  <script src="config.js" defer></script>',
    '  <script src="twitch.js" defer></script>'
  );

  if (!html.includes("extension-files.twitch.tv/helper/v1/twitch-ext.min.js")) fail("Twitch Helper was not injected");
  if (!html.includes('class="twitch-panel twitch-theme-dark"')) fail("Twitch panel class was not injected");
  if (html.includes('id="streamer-dialog"') || html.includes('id="streamer-button"')) fail("Streamer-only UI remained in the panel package");
  if (html.includes('id="online-board-button"') || html.includes("config.js")) fail("Online-only UI remained in the local panel package");
  return html;
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.rmSync(archivePath, { force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

fs.writeFileSync(path.join(outputDirectory, "index.html"), createPanelHtml());
for (const file of copiedFiles) {
  const source = path.join(projectRoot, file);
  if (!fs.existsSync(source)) fail(`Missing source file: ${file}`);
  fs.copyFileSync(source, path.join(outputDirectory, file));
}
fs.copyFileSync(path.join(projectRoot, "streamer-twitch.js"), path.join(outputDirectory, "streamer.js"));

const packagedFiles = fs.readdirSync(outputDirectory).sort();
const zip = spawnSync("zip", ["-q", archivePath, ...packagedFiles], {
  cwd: outputDirectory,
  encoding: "utf8"
});
if (zip.status !== 0) fail(zip.stderr || "zip failed");

const sizeKb = Math.ceil(fs.statSync(archivePath).size / 1024);
console.log(JSON.stringify({ ok: true, archive: path.basename(archivePath), sizeKb, files: packagedFiles }, null, 2));
