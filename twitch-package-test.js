"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = __dirname;
const packageRoot = path.join(projectRoot, "dist-twitch");
const archivePath = path.join(projectRoot, "CapyCatch-Twitch-4.0.zip");
const html = fs.readFileSync(path.join(packageRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(packageRoot, "style.css"), "utf8");
const scriptTags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];

assert(scriptTags.length > 0, "The package must contain script tags");
assert(
  /src="https:\/\/extension-files\.twitch\.tv\/helper\/v1\/twitch-ext\.min\.js"/.test(scriptTags[0][1]),
  "Twitch Extension Helper must be the first script"
);
assert(scriptTags.every(match => /\bsrc=/.test(match[1]) && match[2].trim() === ""), "Inline JavaScript is not allowed");
assert(!/oauth:/i.test(html), "The Twitch package must not ask viewers for an OAuth token");
assert(!html.includes('id="streamer-button"'), "Streamer controls must not be present in the viewer panel");
assert(!html.includes('id="streamer-dialog"'), "Streamer dialog must not be present in the viewer panel");
assert(!html.includes('id="online-board-button"'), "Online leaderboard must not be present in the local viewer panel");
assert(!html.includes("config.js"), "Online configuration must not be present in the local viewer panel");
assert(html.includes('class="twitch-panel twitch-theme-dark"'), "Panel mode must be enabled before first paint");
assert(css.includes("body.twitch-panel .game-shell"), "Compact panel layout is missing");
assert(css.includes("height: 100dvh"), "Full-height panel dialogs are missing");

const localReferences = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(match => match[1])
  .filter(reference => !/^https:\/\//.test(reference));
for (const reference of localReferences) {
  assert(fs.existsSync(path.join(packageRoot, reference)), `Missing packaged resource: ${reference}`);
}

const packagedFiles = fs.readdirSync(packageRoot).sort();
assert.deepStrictEqual(packagedFiles, [
  "adventure.js",
  "bomb.webp",
  "capy.webp",
  "game.js",
  "gold.webp",
  "index.html",
  "mandarin.webp",
  "progression.js",
  "streamer.js",
  "style.css",
  "twitch.js"
]);
assert(fs.statSync(archivePath).size < 1024 * 1024, "Initial Twitch package must remain below 1 MB");

const zipTest = spawnSync("unzip", ["-tq", archivePath], { encoding: "utf8" });
assert.strictEqual(zipTest.status, 0, zipTest.stderr || zipTest.stdout || "ZIP integrity check failed");

console.log(JSON.stringify({
  ok: true,
  files: packagedFiles.length,
  sizeKb: Math.ceil(fs.statSync(archivePath).size / 1024),
  helperFirst: true,
  inlineScripts: 0,
  oauthForm: false
}));
