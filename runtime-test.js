const fs = require("fs");
const vm = require("vm");

function makeClassList() {
  const values = new Set();
  return {
    toggle(name, force) {
      if (force === undefined) force = !values.has(name);
      if (force) values.add(name); else values.delete(name);
      return force;
    },
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name)
  };
}

function makeElement(id = "") {
  const listeners = new Map();
  return {
    id,
    tagName: id.includes("dialog") ? "DIALOG" : "BUTTON",
    textContent: "",
    innerHTML: "",
    value: "",
    checked: false,
    disabled: false,
    hidden: false,
    open: false,
    dataset: {},
    style: {},
    children: [],
    className: "",
    classList: makeClassList(),
    attributes: {},
    lastChild: { textContent: "" },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatch(type, event = {}) {
      for (const handler of listeners.get(type) || []) handler({ target: this, preventDefault() {}, ...event });
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) { this.children.push(child); return child; },
    remove() {},
    click() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    focus() {},
    showModal() { this.open = true; },
    close() { this.open = false; },
    closest() { return null; },
    querySelector(selector) {
      if (selector === ".mode-icon") return { textContent: "🎮" };
      return null;
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 500, height: 450 }; }
  };
}

const gradient = { addColorStop() {} };
const context2d = new Proxy({}, {
  get(target, property) {
    if (property === "createLinearGradient" || property === "createRadialGradient") return () => gradient;
    if (property === "measureText") return text => ({ width: String(text).length * 8 });
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  }
});

const ids = [
  "game", "sound-button", "settings-button", "pause-button", "left-button", "right-button", "live-status",
  "coins-display", "toast-layer", "chat-badge", "chat-badge-text", "mode-button", "mode-button-label",
  "shop-button", "achievements-button", "leaderboard-button", "streamer-button", "mode-dialog", "shop-dialog",
  "achievements-dialog", "settings-dialog", "leaderboard-dialog", "streamer-dialog", "shop-grid", "shop-coins",
  "achievements-grid", "achievement-summary", "player-name", "leaderboard-mode", "local-board-button",
  "online-board-button", "leaderboard-note", "leaderboard-list", "effects-volume", "effects-volume-value",
  "music-volume", "music-volume-value", "reduced-motion", "reset-progress-button", "obs-mode-button",
  "copy-obs-link-button", "twitch-channel", "twitch-username", "twitch-token", "twitch-connect-button",
  "twitch-disconnect-button", "twitch-status", "viewer-leaderboard", "daily-description"
  ,"gadget-button", "gadget-button-icon", "gadget-charges", "adventure-button", "adventure-dialog", "story-dialog",
  "adventure-stars", "adventure-completed", "adventure-event", "adventure-zone-tabs", "adventure-level-grid",
  "adventure-level-detail", "skill-points-badge", "skill-tree", "reset-skills-button", "gadget-grid",
  "adventure-collection", "story-icon", "story-speaker", "story-text", "story-progress", "story-next-button", "story-skip-button"
];
const elements = Object.fromEntries(ids.map(id => [id, makeElement(id)]));
const canvas = elements.game;
canvas.tagName = "CANVAS";
canvas.width = 500;
canvas.height = 450;
canvas.getContext = () => context2d;

elements["leaderboard-mode"].value = "classic";
elements["effects-volume"].value = "70";
elements["music-volume"].value = "25";
elements["twitch-channel"].value = "Bekk3rCapy";

const modes = ["classic", "endless", "chaos", "daily"].map(id => {
  const element = makeElement(`mode-${id}`);
  element.dataset.mode = id;
  return element;
});
const modeScores = ["classic", "endless", "chaos", "daily"].map(id => {
  const element = makeElement(`score-${id}`);
  element.dataset.modeScore = id;
  return element;
});
const dialogs = ids.filter(id => id.endsWith("-dialog")).map(id => elements[id]);

const storage = new Map();
const documentListeners = new Map();
const windowListeners = new Map();

class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
  }
  set src(value) {
    this._src = value;
    this.complete = true;
    this.naturalWidth = 128;
    queueMicrotask(() => this.onload?.());
  }
}

class FakeCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

const body = makeElement("body");
body.tagName = "BODY";
const locationObject = { href: "https://example.test/capycatch/", search: "" };

const documentObject = {
  hidden: false,
  body,
  documentElement: makeElement("html"),
  activeElement: null,
  getElementById: id => elements[id] || makeElement(id),
  addEventListener(type, handler) {
    if (!documentListeners.has(type)) documentListeners.set(type, []);
    documentListeners.get(type).push(handler);
  },
  querySelectorAll(selector) {
    if (selector === "[data-close-dialog]") return [];
    if (selector === "dialog") return dialogs;
    if (selector === "dialog[open]") return dialogs.filter(dialog => dialog.open);
    if (selector === "[data-mode]") return modes;
    if (selector === "[data-mode-score]") return modeScores;
    if (selector === "[data-test-command]") return [];
    return [];
  },
  createElement(tagName) {
    const element = makeElement(tagName);
    element.tagName = tagName.toUpperCase();
    if (tagName === "canvas") {
      element.getContext = () => context2d;
      element.toBlob = callback => callback(Buffer.from("fake"));
    }
    return element;
  }
};

const sandbox = {
  console,
  Math,
  Promise,
  JSON,
  Date,
  URL,
  URLSearchParams,
  Image: FakeImage,
  CustomEvent: FakeCustomEvent,
  File: class {},
  Blob,
  fetch: async () => ({ ok: true, json: async () => [] }),
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  },
  performance: { now: () => 0 },
  requestAnimationFrame: callback => { sandbox.nextFrame = callback; return 1; },
  queueMicrotask,
  document: documentObject,
  location: locationObject,
  history: {
    replaceState(state, title, url) {
      locationObject.href = String(url);
      locationObject.search = new URL(String(url)).search;
    }
  },
  navigator: { clipboard: { writeText: async () => {} } },
  confirm: () => true,
  WebSocket: class {},
  setTimeout: () => 1,
  clearTimeout() {},
  setInterval: () => 1,
  clearInterval() {}
};

sandbox.window = {
  ...sandbox,
  window: null,
  addEventListener(type, handler) {
    if (!windowListeners.has(type)) windowListeners.set(type, []);
    windowListeners.get(type).push(handler);
  },
  dispatchEvent(event) {
    for (const handler of windowListeners.get(event.type) || []) handler(event);
    return true;
  },
  AudioContext: null,
  webkitAudioContext: null,
  setTimeout: sandbox.setTimeout,
  clearTimeout: sandbox.clearTimeout,
  setInterval: sandbox.setInterval,
  clearInterval: sandbox.clearInterval,
  confirm: sandbox.confirm,
  CAPYCATCH_LEADERBOARD: undefined
};
sandbox.window.window = sandbox.window;

vm.createContext(sandbox);
for (const file of ["config.js", "adventure.js", "progression.js", "streamer.js", "game.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
}

(async () => {
  await new Promise(resolve => setImmediate(resolve));
  const evaluate = source => vm.runInContext(source, sandbox);

  if (evaluate("gameState") !== "start") throw new Error("Игра не перешла на стартовый экран");
  if (evaluate("mode.id") !== "classic") throw new Error("Неверный режим по умолчанию");
  if (evaluate("adventure.levels.length") !== 40 || evaluate("adventure.zones.length") !== 5) throw new Error("Карта приключения собрана не полностью");
  if (evaluate("adventure.skills.length") !== 15 || evaluate("adventure.gadgets.length") !== 5) throw new Error("Навыки или гаджеты приключения собраны не полностью");
  if (!evaluate("new Set(adventure.levels.map(level => level.id)).size === 40")) throw new Error("На карте есть повторяющиеся ID уровней");
  if (!evaluate("adventure.zones.every(zone => adventure.levels.filter(level => level.zoneId === zone.id).length === 8)")) throw new Error("В одной из зон не восемь уровней");
  if (!evaluate("adventure.zones.every(zone => { const levels=adventure.levels.filter(level => level.zoneId===zone.id); return levels.filter(level => level.boss).length===1 && levels[7].boss; })")) throw new Error("Боссы стоят не в конце зон");
  if (!evaluate("adventure.levels.every(level => level.duration >= 40 && level.objective && level.starScores.length === 3)")) throw new Error("Конфигурация одного из уровней неполна");
  if (evaluate("adventure.getActiveEvent(new Date('2026-10-10T12:00:00Z')).id") !== "autumn_harvest") throw new Error("Осеннее событие выбирается неверно");
  if (evaluate("adventure.getActiveEvent(new Date('2026-12-10T12:00:00Z')).id") !== "winter_festival") throw new Error("Зимнее событие выбирается неверно");

  evaluate("startGame()");
  if (evaluate("gameState") !== "playing") throw new Error("Классический режим не стартовал");
  evaluate("for (let i = 0; i < 5; i += 1) handleCatch({type:'normal',x:250,y:250})");
  if (evaluate("currentCombo()") !== 2) throw new Error("Комбо x2 не включилось");

  const beforeShield = evaluate("score");
  evaluate("handleCatch({type:'shield',x:250,y:250}); handleCatch({type:'bomb',x:250,y:250})");
  if (evaluate("score") !== beforeShield) throw new Error("Щит не заблокировал штраф бомбы");
  if (evaluate("metrics.shieldSaves") !== 1) throw new Error("Спасение щитом не записалось в статистику");

  evaluate("streak=9; feverMeter=100; handleCatch({type:'normal',x:250,y:250})");
  if (evaluate("powerups.fever") <= 0 || evaluate("currentCombo()") !== 4) throw new Error("Fever x4 не активировался");

  evaluate("handleCatch({type:'magnet',x:250,y:250}); handleCatch({type:'time',x:250,y:250})");
  if (evaluate("powerups.magnet") <= 0 || evaluate("extraTime") !== 5) throw new Error("Бонусы работают неверно");

  evaluate("finishRound()");
  if (evaluate("gameState") !== "gameover") throw new Error("Классический раунд не завершился");
  if (evaluate("progression.getState().stats.games") !== 1) throw new Error("Раунд не записался в прогресс");

  evaluate("progression.setMode('endless'); mode=progression.getMode(); startGame()");
  if (evaluate("lives") !== 3) throw new Error("Бесконечный режим не выдал три жизни");
  evaluate("handleMiss({type:'normal',x:200}); handleMiss({type:'normal',x:200}); handleMiss({type:'normal',x:200})");
  if (evaluate("gameState") !== "gameover") throw new Error("Бесконечный режим не завершился после трёх ошибок");

  evaluate("progression.setMode('chaos'); mode=progression.getMode(); startGame()");
  if (evaluate("mode.duration") !== 30 || evaluate("mode.spawnMultiplier") >= 1) throw new Error("Параметры Хаоса неверны");

  evaluate("streamer.simulate('drop')");
  if (evaluate("objects.length") < 1) throw new Error("Стримерская команда не создала предмет");

  evaluate("progression.setMode('daily'); mode=progression.getMode(); startGame()");
  if (!evaluate("mode.seeded") || !evaluate("mode.dailyModifier")) throw new Error("Испытание дня не получило seed и модификатор");

  evaluate("progression.recordRound({mode:'classic',score:1000,caught:100,missed:0,bombsCaught:0,goldenCaught:10,maxCombo:4,shieldSaves:1,feverActivations:1})");
  const purchase = evaluate("progression.buySkin('berry')");
  if (!purchase.ok || evaluate("progression.getSkin().id") !== "berry") throw new Error("Магазин скинов не работает");

  if (evaluate("progression.remoteReady()") !== false) throw new Error("Пустая онлайн-конфигурация ошибочно считается активной");
  evaluate("streamer.setObsMode(true)");
  if (!body.classList.contains("obs-mode")) throw new Error("OBS-режим не включился");

  evaluate("streamer.setObsMode(false); adventure.selectLevel(1); progression.setMode('adventure'); mode=progression.getMode(); startGame()");
  if (evaluate("mode.level.number") !== 1 || evaluate("gadgetCharges") !== 1) throw new Error("Первый уровень приключения не стартовал");
  if (!evaluate("useAdventureGadget()") || evaluate("powerups.magnet") <= 0) throw new Error("Гаджет приключения не сработал");
  evaluate("score=120; metrics.caught=30; finishRound('time')");
  if (!evaluate("adventure.getState().levels['garden-1'].completed")) throw new Error("Прогресс уровня приключения не сохранился");
  if (evaluate("adventure.getState().unlockedLevel") < 2) throw new Error("Следующий уровень приключения не открылся");

  evaluate("for (let n=2;n<=7;n+=1){ adventure.selectLevel(n); const level=adventure.getLevel(); adventure.completeLevel(level.id,{score:999,caught:99,goldenCaught:20,maxCombo:4,bombsCaught:0,missed:0,feverActivations:3,endReason:'time'}); }");
  if (evaluate("adventure.getSkillPoints()") < 1) throw new Error("Звёзды не выдали очки навыков");
  if (!evaluate("adventure.unlockSkill('quick_paws').ok")) throw new Error("Навык приключения не открылся");
  evaluate("adventure.selectLevel(8); progression.setMode('adventure'); mode=progression.getMode(); startGame()");
  if (!evaluate("bossState") || evaluate("bossState.maxHp") !== 4) throw new Error("Босс сада не появился");
  evaluate("while (bossState.hp > 0) handleCatch({type:'strike',x:250,y:250}); finishRound('boss')");
  if (!evaluate("adventure.getState().levels['garden-8'].completed")) throw new Error("Победа над боссом не сохранилась");
  evaluate("for (const level of adventure.levels) adventure.completeLevel(level.id,{score:999,caught:999,goldenCaught:99,maxCombo:4,bombsCaught:0,missed:0,feverActivations:9,endReason:level.boss?'boss':'time',remainingLives:4,bossDefeated:level.boss})");
  if (evaluate("adventure.getProgressSummary().completed") !== 40 || evaluate("adventure.getTotalStars()") !== 120) throw new Error("Не все 40 уровней проходят проверку целей и звёзд");
  if (evaluate("adventure.getUnlockedGadgets().length") !== 5) throw new Error("После прохождения карты открылись не все гаджеты");

  console.log(JSON.stringify({
    ok: true,
    games: evaluate("progression.getState().stats.games"),
    achievements: evaluate("Object.keys(progression.getState().achievements).length"),
    skin: evaluate("progression.getSkin().id"),
    daily: evaluate("progression.getDailyModifier().label"),
    optimizedAssets: ["capy.webp", "mandarin.webp", "gold.webp", "bomb.webp"].every(file => fs.existsSync(file)),
    adventureLevels: evaluate("adventure.levels.length"),
    adventureStars: evaluate("adventure.getTotalStars()"),
    firstBoss: evaluate("adventure.getState().levels['garden-8'].completed")
  }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
