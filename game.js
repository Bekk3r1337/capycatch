"use strict";

const $ = id => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d");
const progression = window.CapyProgression;
const streamer = window.CapyStreamer;

const ui = {
  soundButton: $("sound-button"),
  settingsButton: $("settings-button"),
  pauseButton: $("pause-button"),
  leftButton: $("left-button"),
  rightButton: $("right-button"),
  liveStatus: $("live-status"),
  coinsDisplay: $("coins-display"),
  toastLayer: $("toast-layer"),
  chatBadge: $("chat-badge"),
  chatBadgeText: $("chat-badge-text"),
  modeButton: $("mode-button"),
  modeButtonLabel: $("mode-button-label"),
  shopButton: $("shop-button"),
  achievementsButton: $("achievements-button"),
  leaderboardButton: $("leaderboard-button"),
  streamerButton: $("streamer-button"),
  modeDialog: $("mode-dialog"),
  shopDialog: $("shop-dialog"),
  achievementsDialog: $("achievements-dialog"),
  settingsDialog: $("settings-dialog"),
  leaderboardDialog: $("leaderboard-dialog"),
  streamerDialog: $("streamer-dialog"),
  shopGrid: $("shop-grid"),
  shopCoins: $("shop-coins"),
  achievementsGrid: $("achievements-grid"),
  achievementSummary: $("achievement-summary"),
  playerName: $("player-name"),
  leaderboardMode: $("leaderboard-mode"),
  localBoardButton: $("local-board-button"),
  onlineBoardButton: $("online-board-button"),
  leaderboardNote: $("leaderboard-note"),
  leaderboardList: $("leaderboard-list"),
  effectsVolume: $("effects-volume"),
  effectsVolumeValue: $("effects-volume-value"),
  musicVolume: $("music-volume"),
  musicVolumeValue: $("music-volume-value"),
  reducedMotion: $("reduced-motion"),
  resetProgressButton: $("reset-progress-button"),
  obsModeButton: $("obs-mode-button"),
  copyObsLinkButton: $("copy-obs-link-button"),
  twitchChannel: $("twitch-channel"),
  twitchUsername: $("twitch-username"),
  twitchToken: $("twitch-token"),
  twitchConnectButton: $("twitch-connect-button"),
  twitchDisconnectButton: $("twitch-disconnect-button"),
  twitchStatus: $("twitch-status"),
  viewerLeaderboard: $("viewer-leaderboard"),
  dailyDescription: $("daily-description")
};

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_Y = 390;
const PLAYER_WIDTH = 140;
const PLAYER_HEIGHT = 210;

const COLORS = {
  white: "#fffaf4",
  muted: "#c7b9dc",
  violet: "#8b5cf6",
  violetLight: "#c4b5fd",
  violetDark: "#4c1d95",
  pink: "#ec4899",
  orange: "#ff9f43",
  gold: "#ffd166",
  red: "#fb7185",
  green: "#6ee7b7",
  blue: "#60a5fa",
  panel: "rgba(18, 7, 35, 0.76)"
};

const ITEM_INFO = {
  normal: { size: 44, label: "+1", color: COLORS.orange },
  gold: { size: 48, label: "+5", color: COLORS.gold },
  bomb: { size: 52, label: "!", color: COLORS.red },
  magnet: { size: 45, label: "M", color: COLORS.red },
  shield: { size: 46, label: "S", color: COLORS.blue },
  time: { size: 45, label: "+5", color: COLORS.green },
  rotten: { size: 44, label: "-", color: "#86a84a" }
};

const assets = {};
const assetSources = {
  capy: "capy.webp",
  mandarin: "mandarin.webp",
  gold: "gold.webp",
  bomb: "bomb.webp"
};

const input = { left: false, right: false };
const player = {
  x: WIDTH / 2 - PLAYER_WIDTH / 2,
  width: PLAYER_WIDTH,
  speed: 430,
  targetX: null,
  bounce: 0,
  tilt: 0,
  runPhase: 0
};

let gameState = "loading";
let mode = progression.getMode();
let lastFrameTime = performance.now();
let elapsed = 0;
let extraTime = 0;
let lives = mode.lives;
let spawnTimer = 0;
let nextSpawnDelay = 0.8;
let score = 0;
let streak = 0;
let feverMeter = 0;
let bestCombo = 1;
let objects = [];
let particles = [];
let floatingTexts = [];
let playerTrails = [];
let shakeTime = 0;
let shakeStrength = 0;
let pointerActive = false;
let isNewRecord = false;
let rewardSummary = null;
let seededState = 1;
let lastResult = null;
let statusSecond = -1;
let dialogPausedGame = false;
let soundEnabled = true;
let audioContext = null;
let musicTimer = null;
let musicStep = 0;
let leaderboardView = "local";

const powerups = { magnet: 0, shield: 0, fever: 0 };
let metrics = createMetrics();

const backgroundDots = Array.from({ length: 28 }, (_, index) => ({
  x: (index * 83 + 37) % WIDTH,
  y: (index * 47 + 21) % HEIGHT,
  size: 1 + (index % 3) * 0.55,
  phase: index * 0.73
}));

function createMetrics() {
  return {
    mode: mode?.id || "classic",
    score: 0,
    caught: 0,
    missed: 0,
    bombsCaught: 0,
    goldenCaught: 0,
    powerupsCaught: 0,
    shieldSaves: 0,
    maxCombo: 1,
    feverActivations: 0,
    duration: 0
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function random(min, max, source = Math.random) {
  return min + source() * (max - min);
}

function seededRandom() {
  seededState += 0x6d2b79f5;
  let value = seededState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function gameplayRandom() {
  return mode.seeded ? seededRandom() : Math.random();
}

function getSettings() {
  return progression.getState().settings;
}

function loadImage(name, source) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      assets[name] = image;
      resolve(true);
    };
    image.onerror = () => resolve(false);
    image.src = source;
  });
}

async function loadAssets() {
  await Promise.all(Object.entries(assetSources).map(([name, source]) => loadImage(name, source)));
  gameState = "start";
  ui.liveStatus.textContent = "Игра загружена. Нажмите Играть";
  refreshAllUi();
}

function initAudio() {
  if (!soundEnabled) return;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
}

function playTone(frequency, duration, type = "sine", strength = 1, delay = 0, channel = "effects") {
  if (!soundEnabled || !audioContext) return;
  const settings = getSettings();
  const volume = channel === "music" ? settings.musicVolume : settings.effectsVolume;
  if (volume <= 0) return;

  const startAt = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(Math.max(0.0001, volume * strength * 0.07), startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

function playCatchSound(type, combo) {
  if (type === "bomb" || type === "rotten") {
    playTone(type === "bomb" ? 110 : 165, 0.22, "sawtooth", 0.9);
    playTone(type === "bomb" ? 72 : 120, 0.28, "square", 0.45, 0.04);
    return;
  }
  if (type === "magnet" || type === "shield" || type === "time") {
    playTone(type === "shield" ? 620 : type === "time" ? 760 : 530, 0.16, "triangle", 0.65);
    playTone(940, 0.2, "sine", 0.42, 0.09);
    return;
  }

  const base = type === "gold" ? 720 : 480;
  playTone(base + combo * 35, 0.11, "sine", 0.62);
  if (type === "gold") playTone(980, 0.18, "triangle", 0.48, 0.06);
}

function musicTick() {
  if (gameState !== "playing") return;
  const normalNotes = [261.6, 329.6, 392, 329.6, 293.7, 349.2, 440, 349.2];
  const feverNotes = [523.3, 659.3, 784, 1046.5];
  const notes = powerups.fever > 0 ? feverNotes : normalNotes;
  const note = notes[musicStep % notes.length];
  playTone(note, 0.24, "triangle", powerups.fever > 0 ? 0.32 : 0.19, 0, "music");
  if (musicStep % 2 === 0) playTone(note / 2, 0.32, "sine", 0.1, 0, "music");
  musicStep += 1;
}

function startMusic() {
  stopMusic();
  musicStep = 0;
  musicTick();
  musicTimer = window.setInterval(musicTick, powerups.fever > 0 ? 420 : 720);
}

function stopMusic() {
  if (musicTimer) window.clearInterval(musicTimer);
  musicTimer = null;
}

function restartMusicTempo() {
  if (gameState === "playing") startMusic();
}

function setSound(enabled) {
  soundEnabled = enabled;
  ui.soundButton.textContent = enabled ? "🔊" : "🔇";
  ui.soundButton.setAttribute("aria-label", enabled ? "Выключить звук" : "Включить звук");
  if (enabled) {
    initAudio();
    if (gameState === "playing") startMusic();
  } else {
    stopMusic();
  }
}

function currentCombo() {
  if (powerups.fever > 0) return 4;
  return clamp(1 + Math.floor(streak / 5), 1, 3);
}

function getTimeLeft() {
  if (mode.duration === null) return Infinity;
  return Math.max(0, mode.duration + extraTime - elapsed);
}

function resetRound() {
  mode = progression.getMode();
  score = 0;
  streak = 0;
  feverMeter = 0;
  bestCombo = 1;
  elapsed = 0;
  extraTime = 0;
  lives = mode.lives;
  spawnTimer = 0;
  nextSpawnDelay = 0.72 * mode.spawnMultiplier;
  objects = [];
  particles = [];
  floatingTexts = [];
  playerTrails = [];
  shakeTime = 0;
  isNewRecord = false;
  rewardSummary = null;
  statusSecond = -1;
  powerups.magnet = 0;
  powerups.shield = 0;
  powerups.fever = 0;
  seededState = mode.seed || Math.floor(Math.random() * 0xffffffff);
  player.x = WIDTH / 2 - player.width / 2;
  player.targetX = null;
  player.bounce = 0;
  player.tilt = 0;
  metrics = createMetrics();
  metrics.mode = mode.id;
}

function startGame() {
  closeAllDialogs();
  initAudio();
  resetRound();
  gameState = "playing";
  ui.pauseButton.disabled = false;
  ui.pauseButton.textContent = "Пауза";
  ui.liveStatus.textContent = `Игра началась. Режим: ${mode.name}`;
  playTone(392, 0.1, "sine", 0.6);
  playTone(523, 0.16, "sine", 0.6, 0.09);
  startMusic();
}

async function finishRound() {
  if (gameState !== "playing") return;
  gameState = "gameover";
  stopMusic();
  ui.pauseButton.disabled = true;
  input.left = false;
  input.right = false;
  setMoveButtonState();

  metrics.score = score;
  metrics.maxCombo = bestCombo;
  metrics.duration = Math.round(elapsed);
  lastResult = { ...metrics };
  rewardSummary = progression.recordRound(lastResult);
  isNewRecord = rewardSummary.newRecord;
  refreshAllUi();

  showToast(`+${rewardSummary.coinsEarned} монет за раунд`, "🍊");
  for (const achievement of rewardSummary.unlocked) {
    showToast(`<strong>${achievement.title}</strong> +${achievement.reward} монет`, achievement.icon, 4200);
  }

  progression.submitRemoteScore(lastResult).catch(() => {});
  ui.liveStatus.textContent = `Игра окончена. Результат: ${score}. Рекорд: ${rewardSummary.highScore}`;
  playTone(523, 0.12, "sine", 0.58);
  playTone(659, 0.12, "sine", 0.58, 0.1);
  playTone(784, 0.24, "sine", 0.58, 0.2);
}

function togglePause(forcePause = false) {
  if (gameState === "playing") {
    gameState = "paused";
    ui.pauseButton.textContent = "Продолжить";
    input.left = false;
    input.right = false;
    setMoveButtonState();
    stopMusic();
    ui.liveStatus.textContent = "Игра на паузе";
  } else if (gameState === "paused" && !forcePause) {
    gameState = "playing";
    ui.pauseButton.textContent = "Пауза";
    lastFrameTime = performance.now();
    startMusic();
    ui.liveStatus.textContent = "Игра продолжена";
  }
}

function getDifficulty() {
  const progress = mode.duration === null
    ? clamp(elapsed / 150, 0, 1)
    : clamp(elapsed / Math.max(1, mode.duration + extraTime), 0, 1);
  return {
    progress,
    spawnDelay: lerp(0.86, 0.44, progress) * mode.spawnMultiplier,
    fallSpeed: lerp(155, 275, progress) * mode.speedMultiplier,
    bombChance: clamp(lerp(0.075, 0.165, progress) + mode.bombBonus, 0.025, 0.28),
    goldChance: clamp(0.12 + Number(mode.goldBonus || 0), 0.08, 0.32),
    bonusChance: mode.id === "chaos" ? 0.115 : 0.075,
    rottenChance: progress > 0.2 ? (mode.id === "chaos" ? 0.07 : 0.045) : 0
  };
}

function selectRandomType() {
  const difficulty = getDifficulty();
  const roll = gameplayRandom();

  if (powerups.fever > 0) {
    if (roll < 0.66) return "gold";
    if (roll < 0.92) return "normal";
    return gameplayRandom() < 0.5 ? "time" : "shield";
  }

  let cursor = difficulty.bombChance;
  if (roll < cursor) return "bomb";
  cursor += difficulty.goldChance;
  if (roll < cursor) return "gold";
  cursor += difficulty.rottenChance;
  if (roll < cursor) return "rotten";
  cursor += difficulty.bonusChance;
  if (roll < cursor) {
    const bonusRoll = gameplayRandom();
    if (bonusRoll < 0.4) return "magnet";
    if (bonusRoll < 0.75) return "shield";
    return mode.duration === null ? "gold" : "time";
  }
  return "normal";
}

function spawnObject(typeOverride = null, viewer = null, xOverride = null) {
  const difficulty = getDifficulty();
  const type = typeOverride || selectRandomType();
  const info = ITEM_INFO[type] || ITEM_INFO.normal;
  const specialSlowdown = ["magnet", "shield", "time"].includes(type) ? 0.9 : 1;
  objects.push({
    x: xOverride ?? random(info.size / 2 + 7, WIDTH - info.size / 2 - 7, gameplayRandom),
    y: -info.size,
    size: info.size,
    speed: difficulty.fallSpeed * random(0.88, 1.13, gameplayRandom) * specialSlowdown,
    type,
    angle: random(0, Math.PI * 2),
    rotationSpeed: random(-2.8, 2.8),
    viewer
  });
  nextSpawnDelay = difficulty.spawnDelay * random(0.86, 1.14, gameplayRandom);
}

function getBasket() {
  return { x: player.x + 28, y: 270, width: 84, height: 47 };
}

function overlapsBasket(object, basket) {
  const half = object.size * 0.36;
  return object.x + half > basket.x + 4 &&
    object.x - half < basket.x + basket.width - 4 &&
    object.y + half > basket.y &&
    object.y - half < basket.y + basket.height;
}

function addScore(points, object, color) {
  score = Math.max(0, score + points);
  addFloatingText(object.x, object.y, `${points >= 0 ? "+" : ""}${points}`, color, Math.abs(points) >= 5 ? 27 : 22);
}

function loseLife(reasonX, reasonY) {
  if (mode.lives === null) return false;
  lives = Math.max(0, lives - 1);
  addFloatingText(reasonX, reasonY, "-1 ❤️", COLORS.red, 24);
  if (lives <= 0) finishRound();
  return true;
}

function activateFever() {
  if (powerups.fever > 0 || currentCombo() < 3 || feverMeter < 100) return;
  powerups.fever = 7;
  feverMeter = 100;
  metrics.feverActivations += 1;
  showToast("Золотой дождь начался! Комбо x4", "🌟", 3000);
  addFloatingText(WIDTH / 2, 145, "FEVER x4!", COLORS.gold, 34);
  burst(WIDTH / 2, 150, COLORS.gold, 28, 190);
  playTone(784, 0.18, "triangle", 0.7);
  playTone(1046, 0.28, "triangle", 0.65, 0.12);
  restartMusicTempo();
}

function handleCatch(object) {
  const comboBeforeCatch = currentCombo();

  if (object.type === "bomb") {
    metrics.bombsCaught += 1;
    streak = 0;
    if (powerups.shield > 0) {
      powerups.shield -= 1;
      metrics.shieldSaves += 1;
      addFloatingText(object.x, object.y, "ЩИТ!", COLORS.blue, 25);
      burst(object.x, object.y, COLORS.blue, 18, 150);
      playTone(660, 0.2, "triangle", 0.7);
      if (object.viewer) streamer.creditViewer(object.viewer, 1);
      return;
    }

    addScore(-5, object, COLORS.red);
    player.bounce = -1;
    if (!getSettings().reducedMotion) {
      shakeTime = 0.28;
      shakeStrength = 8;
    }
    burst(object.x, object.y, COLORS.red, 16, 170);
    burst(object.x, object.y, "#5b2135", 9, 120);
    playCatchSound("bomb", 1);
    loseLife(object.x, object.y - 25);
    return;
  }

  if (object.type === "rotten") {
    metrics.caught += 1;
    streak = 0;
    feverMeter = Math.max(0, feverMeter - 25);
    addScore(-3, object, "#a3b85b");
    player.bounce = -0.6;
    burst(object.x, object.y, "#86a84a", 10, 95);
    playCatchSound("rotten", 1);
    return;
  }

  if (object.type === "magnet") {
    metrics.powerupsCaught += 1;
    powerups.magnet = Math.max(powerups.magnet, 6);
    addFloatingText(object.x, object.y, "МАГНИТ 6с", COLORS.red, 22);
    burst(object.x, object.y, COLORS.red, 13, 125);
    playCatchSound("magnet", 1);
    return;
  }

  if (object.type === "shield") {
    metrics.powerupsCaught += 1;
    powerups.shield = Math.min(2, powerups.shield + 1);
    addFloatingText(object.x, object.y, "ЩИТ", COLORS.blue, 23);
    burst(object.x, object.y, COLORS.blue, 13, 125);
    playCatchSound("shield", 1);
    return;
  }

  if (object.type === "time") {
    metrics.powerupsCaught += 1;
    extraTime += 5;
    addFloatingText(object.x, object.y, "+5 СЕК", COLORS.green, 23);
    burst(object.x, object.y, COLORS.green, 13, 125);
    playCatchSound("time", 1);
    return;
  }

  streak += 1;
  metrics.caught += 1;
  if (object.type === "gold") metrics.goldenCaught += 1;
  const combo = currentCombo();
  bestCombo = Math.max(bestCombo, combo);
  metrics.maxCombo = bestCombo;
  const basePoints = object.type === "gold" ? 5 : 1;
  const gained = basePoints * combo;
  addScore(gained, object, object.type === "gold" ? COLORS.gold : COLORS.orange);
  feverMeter = clamp(feverMeter + (object.type === "gold" ? 18 : 7), 0, 100);
  player.bounce = 1;
  burst(object.x, object.y, object.type === "gold" ? COLORS.gold : COLORS.orange, object.type === "gold" ? 15 : 9, object.type === "gold" ? 150 : 100);
  playCatchSound(object.type, combo);

  if (object.viewer) streamer.creditViewer(object.viewer, gained);

  if (combo > comboBeforeCatch && combo <= 3) {
    addFloatingText(WIDTH / 2, 124, `КОМБО x${combo}!`, COLORS.green, 27);
    burst(WIDTH / 2, 132, COLORS.green, 18, 155);
  }
  activateFever();
}

function handleMiss(object) {
  if (object.type === "bomb") return;
  if (["normal", "gold", "rotten"].includes(object.type)) {
    metrics.missed += 1;
    streak = 0;
    if (mode.lives !== null && object.type !== "rotten") loseLife(object.x, HEIGHT - 20);
  }
}

function burst(x, y, color, amount, speed) {
  const multiplier = getSettings().reducedMotion ? 0.35 : 1;
  const count = Math.max(2, Math.round(amount * multiplier));
  for (let index = 0; index < count; index += 1) {
    const angle = random(0, Math.PI * 2);
    const velocity = random(speed * 0.35, speed);
    const life = random(0.35, 0.68);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - 25,
      life,
      maxLife: life,
      color,
      size: random(2.5, 6)
    });
  }
}

function addFloatingText(x, y, text, color, size) {
  floatingTexts.push({ x, y, text, color, size, life: 0.82, maxLife: 0.82 });
}

function updatePlayer(deltaTime) {
  let direction = 0;
  if (input.left) direction -= 1;
  if (input.right) direction += 1;
  const previousX = player.x;

  if (direction !== 0) {
    player.targetX = null;
    player.x += direction * player.speed * deltaTime;
    player.tilt = lerp(player.tilt, direction * 0.07, Math.min(1, deltaTime * 12));
  } else if (player.targetX !== null) {
    const distance = player.targetX - player.x;
    const maxStep = player.speed * 1.4 * deltaTime;
    player.x += clamp(distance, -maxStep, maxStep);
    player.tilt = lerp(player.tilt, clamp(distance / 250, -0.07, 0.07), Math.min(1, deltaTime * 10));
    if (Math.abs(distance) < 1) player.targetX = null;
  } else {
    player.tilt = lerp(player.tilt, 0, Math.min(1, deltaTime * 10));
  }

  player.x = clamp(player.x, -20, WIDTH - player.width + 20);
  player.bounce = lerp(player.bounce, 0, Math.min(1, deltaTime * 9));
  player.runPhase += Math.abs(player.x - previousX) * 0.065;

  if (Math.abs(player.x - previousX) > 0.5 && Math.random() < 0.35 && !getSettings().reducedMotion) {
    const skin = progression.getSkin();
    playerTrails.push({
      x: player.x + player.width / 2,
      y: 420,
      life: 0.38,
      maxLife: 0.38,
      color: skin.id === "golden" ? COLORS.gold : skin.id === "berry" ? COLORS.pink : skin.id === "cosmic" ? COLORS.blue : COLORS.violet
    });
  }
}

function updateObjects(deltaTime) {
  const basket = getBasket();
  const basketCenter = basket.x + basket.width / 2;

  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (powerups.magnet > 0 && ["normal", "gold"].includes(object.type) && object.y > 80) {
      object.x += clamp(basketCenter - object.x, -130, 130) * deltaTime * 2.4;
    }
    object.y += object.speed * deltaTime;
    object.angle += object.rotationSpeed * deltaTime;

    if (overlapsBasket(object, basket)) {
      handleCatch(object);
      objects.splice(index, 1);
      continue;
    }

    if (object.y - object.size / 2 > HEIGHT) {
      handleMiss(object);
      objects.splice(index, 1);
    }
  }
}

function updateEffects(deltaTime) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= deltaTime;
    particle.vy += 210 * deltaTime;
    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;
    if (particle.life <= 0) particles.splice(index, 1);
  }

  for (let index = floatingTexts.length - 1; index >= 0; index -= 1) {
    const floating = floatingTexts[index];
    floating.life -= deltaTime;
    floating.y -= 54 * deltaTime;
    if (floating.life <= 0) floatingTexts.splice(index, 1);
  }

  for (let index = playerTrails.length - 1; index >= 0; index -= 1) {
    const trail = playerTrails[index];
    trail.life -= deltaTime;
    trail.y += 8 * deltaTime;
    if (trail.life <= 0) playerTrails.splice(index, 1);
  }

  if (shakeTime > 0) {
    shakeTime = Math.max(0, shakeTime - deltaTime);
    shakeStrength = lerp(shakeStrength, 0, Math.min(1, deltaTime * 8));
  }
}

function updatePowerups(deltaTime) {
  powerups.magnet = Math.max(0, powerups.magnet - deltaTime);
  if (powerups.fever > 0) {
    const old = powerups.fever;
    powerups.fever = Math.max(0, powerups.fever - deltaTime);
    feverMeter = clamp(powerups.fever / 7 * 100, 0, 100);
    if (old > 0 && powerups.fever === 0) {
      feverMeter = 0;
      streak = 0;
      restartMusicTempo();
      showToast("Fever закончился. Собирай новую серию!", "🍊", 2200);
    }
  }
}

function updateGame(deltaTime) {
  elapsed += deltaTime;
  metrics.duration = Math.round(elapsed);
  if (mode.duration !== null && getTimeLeft() <= 0) {
    finishRound();
    return;
  }

  spawnTimer += deltaTime;
  if (spawnTimer >= nextSpawnDelay) {
    spawnTimer -= nextSpawnDelay;
    spawnObject();
  }

  updatePlayer(deltaTime);
  updateObjects(deltaTime);
  updatePowerups(deltaTime);
  updateEffects(deltaTime);

  if (mode.duration !== null) {
    const seconds = Math.ceil(getTimeLeft());
    if (seconds !== statusSecond && (seconds <= 10 || seconds % 10 === 0)) {
      statusSecond = seconds;
      ui.liveStatus.textContent = `Счёт: ${score}. Осталось ${seconds} секунд`;
    }
  }
}

function roundedPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function roundRect(x, y, width, height, radius, fill, stroke = null) {
  roundedPath(x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawBackground(time) {
  if (streamer.isObsMode()) return;

  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, powerups.fever > 0 ? "#50320d" : "#32155c");
  gradient.addColorStop(0.56, powerups.fever > 0 ? "#3c1d28" : "#241044");
  gradient.addColorStop(1, "#160a2c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(250, 190, 20, 250, 190, 280);
  glow.addColorStop(0, powerups.fever > 0 ? "rgba(255, 209, 102, 0.24)" : "rgba(236, 72, 153, 0.13)");
  glow.addColorStop(1, "rgba(76, 29, 149, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const dot of backgroundDots) {
    const alpha = 0.16 + Math.sin(time * 0.0015 + dot.phase) * 0.08;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = dot.size > 1.8 ? COLORS.gold : COLORS.violetLight;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y + Math.sin(time * 0.0008 + dot.phase) * 3, dot.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(10, 4, 23, 0.22)";
  ctx.beginPath();
  ctx.ellipse(WIDTH / 2, 433, 205, 20, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawImageOrFallback(image, x, y, width, height, fallbackColor, label) {
  if (image?.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }
  ctx.fillStyle = fallbackColor;
  ctx.beginPath();
  ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.font = "800 13px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + width / 2, y + height / 2);
}

function drawSkinAura(skin) {
  const centerX = player.x + player.width / 2;
  ctx.save();
  ctx.globalAlpha = 0.26 + Math.sin(performance.now() * 0.004) * 0.05;
  ctx.fillStyle = skin.glow;
  ctx.beginPath();
  ctx.ellipse(centerX, 360, skin.id === "cosmic" ? 92 : 75, 104, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSkinAccessory(skin) {
  if (skin.id === "classic") return;
  ctx.save();
  ctx.translate(player.x + player.width / 2, 0);

  if (skin.id === "berry") {
    ctx.fillStyle = COLORS.pink;
    for (const [x, y, r] of [[-11, 249, 7], [0, 245, 8], [10, 250, 7]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.green;
    ctx.beginPath();
    ctx.ellipse(0, 236, 5, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (skin.id === "golden") {
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.moveTo(-24, 251);
    ctx.lineTo(-17, 232);
    ctx.lineTo(-6, 245);
    ctx.lineTo(0, 225);
    ctx.lineTo(8, 245);
    ctx.lineTo(20, 231);
    ctx.lineTo(25, 252);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#9a5d11";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (skin.id === "cosmic") {
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.ellipse(0, 344, 95, 24, -0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    const orbit = performance.now() * 0.002;
    ctx.beginPath();
    ctx.arc(Math.cos(orbit) * 90, 344 + Math.sin(orbit) * 22, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer() {
  const skin = progression.getSkin();
  drawSkinAura(skin);

  const scaleX = 1 + Math.max(0, player.bounce) * 0.035 - Math.max(0, -player.bounce) * 0.025;
  const scaleY = 1 - Math.max(0, player.bounce) * 0.035 + Math.max(0, -player.bounce) * 0.025;
  const idle = Math.sin(performance.now() * 0.003) * 1.5;
  const drawX = player.x + player.width / 2;
  const drawY = PLAYER_Y - 15 + idle;

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.rotate(player.tilt);
  ctx.scale(scaleX, scaleY);
  drawImageOrFallback(assets.capy, -PLAYER_WIDTH / 2, -150, PLAYER_WIDTH, PLAYER_HEIGHT, "#9b6b43", "CAPY");
  ctx.restore();
  drawSkinAccessory(skin);

  if (powerups.shield > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(96, 165, 250, 0.8)";
    ctx.lineWidth = 3;
    ctx.shadowColor = COLORS.blue;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.ellipse(drawX, 356, 83, 105, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (powerups.magnet > 0) {
    ctx.strokeStyle = "rgba(251, 113, 133, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 7]);
    for (const object of objects.filter(item => ["normal", "gold"].includes(item.type)).slice(0, 5)) {
      ctx.beginPath();
      ctx.moveTo(drawX, 292);
      ctx.lineTo(object.x, object.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}

function drawSpecialItem(object) {
  const size = object.size;
  ctx.save();
  ctx.translate(object.x, object.y);
  ctx.rotate(object.angle);

  if (object.type === "magnet") {
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.strokeStyle = COLORS.red;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.31, 0.12 * Math.PI, 0.88 * Math.PI, true);
    ctx.stroke();
    ctx.strokeStyle = COLORS.blue;
    ctx.beginPath();
    ctx.moveTo(-size * 0.31, size * 0.06);
    ctx.lineTo(-size * 0.31, size * 0.26);
    ctx.moveTo(size * 0.31, size * 0.06);
    ctx.lineTo(size * 0.31, size * 0.26);
    ctx.stroke();
  } else if (object.type === "shield") {
    ctx.fillStyle = "rgba(96, 165, 250, 0.8)";
    ctx.strokeStyle = "#dbeafe";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.42);
    ctx.lineTo(size * 0.36, -size * 0.22);
    ctx.lineTo(size * 0.28, size * 0.27);
    ctx.lineTo(0, size * 0.43);
    ctx.lineTo(-size * 0.28, size * 0.27);
    ctx.lineTo(-size * 0.36, -size * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (object.type === "time") {
    ctx.fillStyle = "rgba(110, 231, 183, 0.88)";
    ctx.strokeStyle = "#ecfdf5";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -size * 0.21);
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.17, size * 0.09);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObjects() {
  for (const object of objects) {
    if (["magnet", "shield", "time"].includes(object.type)) {
      ctx.save();
      ctx.shadowColor = ITEM_INFO[object.type].color;
      ctx.shadowBlur = 17;
      drawSpecialItem(object);
      ctx.restore();
      continue;
    }

    let image = assets.mandarin;
    let fallback = COLORS.orange;
    let label = "+1";
    if (object.type === "gold") {
      image = assets.gold;
      fallback = COLORS.gold;
      label = "+5";
    } else if (object.type === "bomb") {
      image = assets.bomb;
      fallback = "#3f3f46";
      label = "!";
    }

    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.rotate(object.angle);
    ctx.shadowColor = object.type === "gold" ? "rgba(255, 209, 102, 0.68)" : "rgba(0, 0, 0, 0.28)";
    ctx.shadowBlur = object.type === "gold" ? 16 : 7;
    drawImageOrFallback(image, -object.size / 2, -object.size / 2, object.size, object.size, fallback, label);

    if (object.type === "rotten") {
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = "#6d8e35";
      ctx.beginPath();
      ctx.arc(-7, -2, 8, 0, Math.PI * 2);
      ctx.arc(8, 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#4b2f1c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, 8);
      ctx.moveTo(8, -8);
      ctx.lineTo(-8, 8);
      ctx.stroke();
    }
    ctx.restore();

    if (object.viewer) {
      ctx.save();
      ctx.fillStyle = "rgba(18, 7, 35, 0.82)";
      ctx.font = "700 9px Arial";
      ctx.textAlign = "center";
      roundRect(object.x - 34, object.y + object.size / 2 + 3, 68, 16, 8, "rgba(18,7,35,.82)");
      ctx.fillStyle = COLORS.violetLight;
      ctx.fillText(String(object.viewer).slice(0, 11), object.x, object.y + object.size / 2 + 14);
      ctx.restore();
    }
  }
}

function drawEffects() {
  for (const trail of playerTrails) {
    const alpha = clamp(trail.life / trail.maxLife, 0, 1);
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = trail.color;
    ctx.beginPath();
    ctx.arc(trail.x, trail.y, 8 * alpha, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const particle of particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const floating of floatingTexts) {
    const alpha = clamp(floating.life / floating.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = floating.color;
    ctx.font = `900 ${floating.size}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(16, 7, 31, 0.8)";
    ctx.shadowBlur = 8;
    ctx.fillText(floating.text, floating.x, floating.y);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawPowerupStatus() {
  const active = [];
  if (powerups.magnet > 0) active.push({ icon: "🧲", text: `${Math.ceil(powerups.magnet)}с`, color: COLORS.red });
  if (powerups.shield > 0) active.push({ icon: "🛡", text: `x${powerups.shield}`, color: COLORS.blue });

  active.forEach((item, index) => {
    const y = 88 + index * 34;
    roundRect(15, y, 75, 28, 14, "rgba(18,7,35,.72)", "rgba(255,255,255,.08)");
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "14px Arial";
    ctx.fillText(item.icon, 24, y + 14);
    ctx.fillStyle = item.color;
    ctx.font = "900 12px Arial";
    ctx.fillText(item.text, 49, y + 14);
  });
}

function drawHud() {
  const highScore = Math.max(progression.getHighScore(mode.id), score);
  const combo = currentCombo();
  const timeText = mode.duration === null ? `${Math.floor(elapsed)}с` : `${Math.ceil(getTimeLeft())}с`;
  const timeDanger = mode.duration !== null && getTimeLeft() <= 10;

  roundRect(12, 11, 142, 52, 14, COLORS.panel, "rgba(255,255,255,0.08)");
  roundRect(171, 11, 158, 52, 14, COLORS.panel, "rgba(255,255,255,0.08)");
  roundRect(346, 11, 142, 52, 14, COLORS.panel, "rgba(255,255,255,0.08)");

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 10px Arial";
  ctx.fillText("СЧЁТ", 26, 31);
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 22px Arial";
  ctx.fillText(String(score), 26, 54);

  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 10px Arial";
  ctx.fillText(mode.lives === null ? "ВРЕМЯ" : "ЖИЗНИ", 250, 31);
  ctx.fillStyle = timeDanger ? COLORS.red : COLORS.white;
  ctx.font = mode.lives === null ? "900 22px Arial" : "900 19px Arial";
  ctx.fillText(mode.lives === null ? timeText : "❤️".repeat(lives) || "💔", 250, 54);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 10px Arial";
  ctx.fillText("РЕКОРД", 474, 31);
  ctx.fillStyle = COLORS.gold;
  ctx.font = "900 22px Arial";
  ctx.fillText(String(highScore), 474, 54);

  const progress = mode.duration === null ? getDifficulty().progress : clamp(elapsed / (mode.duration + extraTime), 0, 1);
  roundRect(14, 70, 472, 5, 3, "rgba(255,255,255,0.09)");
  roundRect(14, 70, 472 * progress, 5, 3, timeDanger ? COLORS.red : COLORS.violet);

  if (combo > 1) {
    const fever = powerups.fever > 0;
    roundRect(198, 84, 104, 30, 15, fever ? "rgba(255, 209, 102, .94)" : combo === 3 ? "rgba(255, 159, 67, .9)" : "rgba(110, 231, 183, .86)");
    ctx.fillStyle = "#241044";
    ctx.font = "900 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fever ? "FEVER x4" : `КОМБО x${combo}`, 250, 99);
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "800 10px Arial";
  ctx.fillText(mode.shortName, 484, 92);
  if (mode.lives !== null) {
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`Время: ${timeText}`, 484, 107);
  }

  if (powerups.fever <= 0) {
    roundRect(132, 121, 236, 8, 4, "rgba(255,255,255,.08)");
    roundRect(132, 121, 236 * (feverMeter / 100), 8, 4, currentCombo() >= 3 ? COLORS.gold : COLORS.pink);
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.muted;
    ctx.font = "800 9px Arial";
    ctx.fillText("FEVER", 250, 141);
  }
  drawPowerupStatus();
}

function drawButton(x, y, width, height, label, accent = COLORS.violet, fontSize = 17) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 6;
  roundRect(x, y, width, height, 16, accent);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = COLORS.white;
  ctx.font = `900 ${fontSize}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + width / 2, y + height / 2 + 1);
  ctx.restore();
}

function drawStartScreen() {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 28px Arial";
  ctx.fillText("ПОКОРМИ КАПИБАРКУ", WIDTH / 2, 61);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "600 13px Arial";
  ctx.fillText("Лови фрукты, собирай бонусы и запускай Fever", WIDTH / 2, 85);

  roundRect(88, 107, 324, 48, 18, "rgba(255,255,255,.07)", "rgba(196,181,253,.14)");
  ctx.fillStyle = COLORS.violetLight;
  ctx.font = "900 15px Arial";
  ctx.fillText(mode.name, WIDTH / 2, 127);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 10px Arial";
  ctx.fillText(mode.description, WIDTH / 2, 145);

  const cards = [
    { x: 79, icon: assets.mandarin, color: COLORS.orange, title: "+1", caption: "мандарин" },
    { x: 187, icon: assets.gold, color: COLORS.gold, title: "+5", caption: "золотой" },
    { x: 295, icon: null, color: COLORS.blue, title: "БОНУС", caption: "магнит и щит" }
  ];
  for (const card of cards) {
    roundRect(card.x, 175, 96, 102, 17, "rgba(255,255,255,.055)", "rgba(255,255,255,.07)");
    if (card.icon) drawImageOrFallback(card.icon, card.x + 27, 187, 42, 42, card.color, card.title);
    else {
      ctx.font = "27px Arial";
      ctx.fillText("🛡", card.x + 48, 219);
    }
    ctx.fillStyle = card.color;
    ctx.font = "900 16px Arial";
    ctx.fillText(card.title, card.x + 48, 248);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "700 9px Arial";
    ctx.fillText(card.caption, card.x + 48, 265);
  }

  drawButton(150, 303, 200, 57, "ИГРАТЬ");
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 11px Arial";
  ctx.fillText("Режим можно поменять кнопкой под игрой", WIDTH / 2, 388);
  const highScore = progression.getHighScore(mode.id);
  ctx.fillStyle = highScore > 0 ? COLORS.gold : "rgba(255,255,255,.42)";
  ctx.font = "900 14px Arial";
  ctx.fillText(highScore > 0 ? `Рекорд режима: ${highScore}` : "Первый рекорд ещё впереди", WIDTH / 2, 416);
}

function getRank(value) {
  if (value < 20) return { title: "Сонная капибарка", color: COLORS.muted };
  if (value < 45) return { title: "Ловкие лапки", color: COLORS.green };
  if (value < 80) return { title: "Мандариновый мастер", color: COLORS.orange };
  return { title: "Король корзинки", color: COLORS.gold };
}

function drawGameOver() {
  ctx.fillStyle = streamer.isObsMode() ? "rgba(13,5,27,.88)" : "rgba(13,5,27,.76)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  roundRect(39, 25, 422, 403, 25, "rgba(35,15,65,.96)", "rgba(196,181,253,.2)");

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = isNewRecord ? COLORS.gold : COLORS.white;
  ctx.font = "900 25px Arial";
  ctx.fillText(isNewRecord ? "НОВЫЙ РЕКОРД!" : "РАУНД ОКОНЧЕН", WIDTH / 2, 65);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 10px Arial";
  ctx.fillText(mode.name.toUpperCase(), WIDTH / 2, 86);
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 58px Arial";
  ctx.fillText(String(score), WIDTH / 2, 146);

  const rank = getRank(score);
  roundRect(128, 161, 244, 34, 17, "rgba(255,255,255,.07)");
  ctx.fillStyle = rank.color;
  ctx.font = "900 14px Arial";
  ctx.textBaseline = "middle";
  ctx.fillText(rank.title, WIDTH / 2, 178);

  const stats = [
    ["Поймано", metrics.caught],
    ["Пропущено", metrics.missed],
    ["Лучшее комбо", `x${metrics.maxCombo}`],
    ["Золотых", metrics.goldenCaught]
  ];
  stats.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 76 + column * 179;
    const y = 213 + row * 57;
    roundRect(x, y, 169, 47, 13, "rgba(255,255,255,.045)");
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.muted;
    ctx.font = "700 9px Arial";
    ctx.fillText(label.toUpperCase(), x + 12, y + 17);
    ctx.fillStyle = COLORS.white;
    ctx.font = "900 17px Arial";
    ctx.fillText(String(value), x + 12, y + 37);
  });

  if (rewardSummary) {
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.gold;
    ctx.font = "900 12px Arial";
    ctx.fillText(`+${rewardSummary.coinsEarned} 🍊   •   рекорд ${rewardSummary.highScore}`, WIDTH / 2, 333);
  }

  drawButton(62, 354, 177, 51, "ЕЩЁ РАЗ", isNewRecord ? COLORS.pink : COLORS.violet, 15);
  drawButton(261, 354, 177, 51, "ПОДЕЛИТЬСЯ", "#3b2464", 14);
}

function drawPaused() {
  ctx.fillStyle = "rgba(13,5,27,.72)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  roundRect(107, 151, 286, 139, 24, "rgba(35,15,65,.96)", "rgba(196,181,253,.2)");
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 34px Arial";
  ctx.fillText("ПАУЗА", WIDTH / 2, 208);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 13px Arial";
  ctx.fillText("Нажми P, Esc или «Продолжить»", WIDTH / 2, 249);
}

function drawLoading(time) {
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 29px Arial";
  ctx.fillText("CAPYCATCH 3.0", WIDTH / 2, 205);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 14px Arial";
  ctx.fillText("Готовим мандарины...", WIDTH / 2, 237);
  for (let index = 0; index < 3; index += 1) {
    const pulse = 0.4 + 0.6 * Math.max(0, Math.sin(time * 0.006 - index * 0.9));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = index === 1 ? COLORS.orange : COLORS.violet;
    ctx.beginPath();
    ctx.arc(228 + index * 22, 273, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFrame(time) {
  ctx.save();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  if (shakeTime > 0 && gameState === "playing") ctx.translate(random(-shakeStrength, shakeStrength), random(-shakeStrength, shakeStrength));
  drawBackground(time);

  if (gameState === "loading") {
    drawLoading(time);
  } else if (gameState === "start") {
    drawStartScreen();
  } else {
    drawEffects();
    drawObjects();
    drawPlayer();
    drawHud();
    if (gameState === "paused") drawPaused();
    if (gameState === "gameover") drawGameOver();
  }
  ctx.restore();
}

function gameLoop(now) {
  const deltaTime = Math.min((now - lastFrameTime) / 1000, 0.033);
  lastFrameTime = now;
  if (gameState === "playing") updateGame(deltaTime);
  else if (gameState === "gameover") updateEffects(deltaTime);
  drawFrame(now);
  requestAnimationFrame(gameLoop);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * (WIDTH / rect.width), y: (event.clientY - rect.top) * (HEIGHT / rect.height) };
}

function insideButton(point, x, y, width, height) {
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}

function movePlayerToPointer(event) {
  if (gameState !== "playing") return;
  const point = canvasPoint(event);
  player.targetX = clamp(point.x - player.width / 2, -20, WIDTH - player.width + 20);
}

canvas.addEventListener("pointerdown", event => {
  const point = canvasPoint(event);
  canvas.focus({ preventScroll: true });
  initAudio();
  if (gameState === "start" && insideButton(point, 150, 303, 200, 57)) {
    startGame();
    return;
  }
  if (gameState === "gameover") {
    if (insideButton(point, 62, 354, 177, 51)) startGame();
    else if (insideButton(point, 261, 354, 177, 51)) shareResult();
    return;
  }
  if (gameState === "playing") {
    pointerActive = true;
    canvas.setPointerCapture?.(event.pointerId);
    movePlayerToPointer(event);
  }
});

canvas.addEventListener("pointermove", event => {
  if (pointerActive) movePlayerToPointer(event);
});

canvas.addEventListener("pointerup", event => {
  pointerActive = false;
  canvas.releasePointerCapture?.(event.pointerId);
});

canvas.addEventListener("pointercancel", () => { pointerActive = false; });

function setMoveButtonState() {
  ui.leftButton.classList.toggle("is-active", input.left);
  ui.rightButton.classList.toggle("is-active", input.right);
}

function bindMoveButton(button, direction) {
  const press = event => {
    event.preventDefault();
    input[direction] = true;
    player.targetX = null;
    button.setPointerCapture?.(event.pointerId);
    setMoveButtonState();
    initAudio();
  };
  const release = event => {
    input[direction] = false;
    button.releasePointerCapture?.(event.pointerId);
    setMoveButtonState();
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", () => {
    input[direction] = false;
    setMoveButtonState();
  });
}

bindMoveButton(ui.leftButton, "left");
bindMoveButton(ui.rightButton, "right");

document.addEventListener("keydown", event => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", " ", "enter"].includes(key)) event.preventDefault();
  if (key === "arrowleft" || key === "a" || key === "ф") input.left = true;
  if (key === "arrowright" || key === "d" || key === "в") input.right = true;
  if ((key === "enter" || key === " ") && (gameState === "start" || gameState === "gameover")) startGame();
  if ((key === "p" || key === "з" || key === "escape") && (gameState === "playing" || gameState === "paused")) togglePause();
  if (key === "m" || key === "ь") setSound(!soundEnabled);
  if (input.left || input.right) player.targetX = null;
  setMoveButtonState();
});

document.addEventListener("keyup", event => {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a" || key === "ф") input.left = false;
  if (key === "arrowright" || key === "d" || key === "в") input.right = false;
  setMoveButtonState();
});

function showToast(html, icon = "🍊", duration = 2800) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>${icon}</span><span>${html}</span>`;
  ui.toastLayer.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 200);
  }, duration);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openDialog(dialog) {
  if (gameState === "playing") {
    togglePause(true);
    dialogPausedGame = true;
  } else {
    dialogPausedGame = false;
  }
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
}

function closeAllDialogs() {
  document.querySelectorAll("dialog[open]").forEach(closeDialog);
  dialogPausedGame = false;
}

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => closeDialog(button.closest("dialog")));
});

document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) closeDialog(dialog);
  });
});

function renderModes() {
  mode = progression.getMode();
  ui.modeButtonLabel.textContent = mode.shortName;
  ui.dailyDescription.textContent = progression.getDailyModifier().label;
  document.querySelectorAll("[data-mode]").forEach(button => button.classList.toggle("is-selected", button.dataset.mode === mode.id));
  document.querySelectorAll("[data-mode-score]").forEach(element => { element.textContent = progression.getHighScore(element.dataset.modeScore); });
}

function renderShop() {
  const state = progression.getState();
  ui.shopCoins.textContent = state.coins;
  ui.shopGrid.innerHTML = progression.skins.map(skin => {
    const owned = state.ownedSkins.includes(skin.id);
    const selected = state.selectedSkin === skin.id;
    const label = selected ? "Выбрано" : owned ? "Выбрать" : `${skin.price} 🍊`;
    return `<button class="skin-card ${selected ? "is-selected" : ""}" type="button" data-skin="${skin.id}" style="--skin-gradient:${skin.gradient};--skin-glow:${skin.glow}"><span class="skin-preview">${skin.icon}</span><span><h3>${skin.name}</h3><p>${skin.description}</p><span class="skin-action">${label}</span></span></button>`;
  }).join("");
}

function renderAchievements() {
  const state = progression.getState();
  const unlockedCount = progression.achievements.filter(item => state.achievements[item.id]).length;
  ui.achievementSummary.textContent = `${unlockedCount} / ${progression.achievements.length}`;
  ui.achievementsGrid.innerHTML = progression.achievements.map(item => {
    const unlocked = Boolean(state.achievements[item.id]);
    return `<article class="achievement-card ${unlocked ? "" : "is-locked"}"><span class="achievement-icon">${unlocked ? item.icon : "🔒"}</span><span><h3>${item.title}</h3><p>${item.description}</p></span><span class="achievement-reward">${unlocked ? "✓" : `+${item.reward} 🍊`}</span></article>`;
  }).join("");
}

function renderViewerBoard() {
  const board = progression.getViewerBoard();
  ui.viewerLeaderboard.innerHTML = board.length
    ? board.map(entry => `<li><strong>${entry.name}</strong><span class="leaderboard-score">${entry.score}</span></li>`).join("")
    : "<li><strong>Пока никто не участвовал</strong><span></span></li>";
}

async function renderLeaderboard() {
  const selectedMode = ui.leaderboardMode.value;
  ui.localBoardButton.classList.toggle("is-active", leaderboardView === "local");
  ui.onlineBoardButton.classList.toggle("is-active", leaderboardView === "online");
  ui.leaderboardList.innerHTML = "<li><strong>Загрузка...</strong><span></span></li>";

  if (leaderboardView === "online") {
    if (!progression.remoteReady()) {
      ui.leaderboardNote.textContent = "Онлайн-рейтинг подготовлен, но внешняя база ещё не подключена. Локальные рекорды работают полностью.";
      ui.leaderboardList.innerHTML = "<li><strong>Онлайн-рейтинг ожидает подключение</strong><span></span></li>";
      return;
    }
    try {
      const entries = await progression.fetchRemoteScores(selectedMode);
      ui.leaderboardNote.textContent = "Общий рейтинг игроков CapyCatch.";
      ui.leaderboardList.innerHTML = entries.length
        ? entries.map(entry => `<li><strong>${escapeHtml(entry.player_name)}</strong><span class="leaderboard-score">${Number(entry.score) || 0}</span></li>`).join("")
        : "<li><strong>Результатов пока нет</strong><span></span></li>";
    } catch (error) {
      ui.leaderboardNote.textContent = error.message;
      ui.leaderboardList.innerHTML = "<li><strong>Не удалось загрузить рейтинг</strong><span></span></li>";
    }
    return;
  }

  const board = progression.getState().localBoards[selectedMode] || [];
  ui.leaderboardNote.textContent = "Здесь сохраняются десять лучших результатов этого браузера.";
  ui.leaderboardList.innerHTML = board.length
    ? board.map(entry => `<li><strong>${escapeHtml(entry.name)}</strong><span class="leaderboard-score">${Number(entry.score) || 0}</span></li>`).join("")
    : '<li><strong>Сыграй первый раунд</strong><span class="leaderboard-score">0</span></li>';
}

function renderSettings() {
  const state = progression.getState();
  ui.effectsVolume.value = Math.round(state.settings.effectsVolume * 100);
  ui.effectsVolumeValue.textContent = `${ui.effectsVolume.value}%`;
  ui.musicVolume.value = Math.round(state.settings.musicVolume * 100);
  ui.musicVolumeValue.textContent = `${ui.musicVolume.value}%`;
  ui.reducedMotion.checked = state.settings.reducedMotion;
}

function renderStreamerSettings() {
  const state = progression.getState();
  ui.twitchChannel.value = state.twitch.channel || "Bekk3rCapy";
  ui.twitchUsername.value = state.twitch.username || "";
  ui.obsModeButton.textContent = streamer.isObsMode() ? "Выключить OBS-режим" : "Включить OBS-режим";
  renderViewerBoard();
}

function refreshAllUi() {
  const state = progression.getState();
  ui.coinsDisplay.textContent = state.coins;
  ui.playerName.value = state.playerName;
  renderModes();
  renderShop();
  renderAchievements();
  renderSettings();
  renderStreamerSettings();
}

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => {
    progression.setMode(button.dataset.mode);
    mode = progression.getMode();
    renderModes();
    closeDialog(ui.modeDialog);
    showToast(`Режим: ${mode.name}`, button.querySelector(".mode-icon")?.textContent || "🎮");
  });
});

ui.shopGrid.addEventListener("click", event => {
  const card = event.target.closest("[data-skin]");
  if (!card) return;
  const result = progression.buySkin(card.dataset.skin);
  if (!result.ok) {
    showToast(result.reason, "🔒");
    return;
  }
  const skin = progression.getSkin();
  showToast(`Выбран скин «${skin.name}»`, skin.icon);
  for (const achievement of result.unlocked || []) showToast(`<strong>${achievement.title}</strong> +${achievement.reward} монет`, achievement.icon, 4200);
  refreshAllUi();
});

ui.modeButton.addEventListener("click", () => { renderModes(); openDialog(ui.modeDialog); });
ui.shopButton.addEventListener("click", () => { renderShop(); openDialog(ui.shopDialog); });
ui.achievementsButton.addEventListener("click", () => { renderAchievements(); openDialog(ui.achievementsDialog); });
ui.settingsButton.addEventListener("click", () => { renderSettings(); openDialog(ui.settingsDialog); });
ui.leaderboardButton.addEventListener("click", () => { renderLeaderboard(); openDialog(ui.leaderboardDialog); });
ui.streamerButton.addEventListener("click", () => { renderStreamerSettings(); openDialog(ui.streamerDialog); });
ui.soundButton.addEventListener("click", () => setSound(!soundEnabled));
ui.pauseButton.addEventListener("click", () => togglePause());

ui.effectsVolume.addEventListener("input", () => {
  const value = Number(ui.effectsVolume.value) / 100;
  progression.setSetting("effectsVolume", value);
  ui.effectsVolumeValue.textContent = `${ui.effectsVolume.value}%`;
});

ui.musicVolume.addEventListener("input", () => {
  const value = Number(ui.musicVolume.value) / 100;
  progression.setSetting("musicVolume", value);
  ui.musicVolumeValue.textContent = `${ui.musicVolume.value}%`;
});

ui.reducedMotion.addEventListener("change", () => progression.setSetting("reducedMotion", ui.reducedMotion.checked));

ui.resetProgressButton.addEventListener("click", () => {
  if (!window.confirm("Сбросить рекорды, монеты, скины и достижения на этом устройстве?")) return;
  progression.reset();
  mode = progression.getMode();
  refreshAllUi();
  closeDialog(ui.settingsDialog);
  showToast("Локальный прогресс сброшен", "↺");
});

ui.playerName.addEventListener("change", () => { ui.playerName.value = progression.setPlayerName(ui.playerName.value); });
ui.leaderboardMode.addEventListener("change", renderLeaderboard);
ui.localBoardButton.addEventListener("click", () => { leaderboardView = "local"; renderLeaderboard(); });
ui.onlineBoardButton.addEventListener("click", () => { leaderboardView = "online"; renderLeaderboard(); });

ui.obsModeButton.addEventListener("click", () => {
  const enabled = streamer.setObsMode(!streamer.isObsMode());
  ui.obsModeButton.textContent = enabled ? "Выключить OBS-режим" : "Включить OBS-режим";
  if (enabled) closeDialog(ui.streamerDialog);
});

ui.copyObsLinkButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(streamer.getObsLink());
    showToast("OBS-ссылка скопирована", "📋");
  } catch {
    showToast("Не удалось скопировать ссылку", "⚠️");
  }
});

ui.twitchConnectButton.addEventListener("click", () => {
  streamer.connect({ channel: ui.twitchChannel.value, username: ui.twitchUsername.value, token: ui.twitchToken.value });
  ui.twitchToken.value = "";
});

ui.twitchDisconnectButton.addEventListener("click", () => streamer.disconnect());
document.querySelectorAll("[data-test-command]").forEach(button => button.addEventListener("click", () => streamer.simulate(button.dataset.testCommand)));

window.addEventListener("capycatch:stream-status", event => {
  const { status, message, channel } = event.detail;
  ui.twitchStatus.classList.toggle("is-connected", status === "connected");
  ui.twitchStatus.classList.toggle("is-error", status === "error");
  ui.twitchStatus.lastChild.textContent = message;
  ui.twitchConnectButton.disabled = status === "connecting" || status === "connected";
  ui.twitchDisconnectButton.disabled = status !== "connecting" && status !== "connected";
  ui.chatBadge.hidden = status !== "connected";
  ui.chatBadgeText.textContent = channel ? `#${channel}` : "Twitch";
});

window.addEventListener("capycatch:viewer-score", renderViewerBoard);

window.addEventListener("capycatch:chat-command", event => {
  const { command, username } = event.detail;
  if (command === "start") {
    if (gameState === "start" || gameState === "gameover") startGame();
    return;
  }
  if (gameState !== "playing") {
    showToast(`${username}: команда ждёт начала раунда`, "💬", 1600);
    return;
  }

  if (command === "left" || command === "right") {
    const direction = command === "left" ? -1 : 1;
    player.targetX = clamp(player.x + direction * 95, -20, WIDTH - player.width + 20);
    streamer.creditViewer(username, 1);
    addFloatingText(player.x + player.width / 2, 330, `${username} ${direction < 0 ? "←" : "→"}`, COLORS.violetLight, 12);
    return;
  }

  const commandType = command === "drop" ? "normal" : command;
  spawnObject(commandType, username);
  showToast(`${username}: !${command}`, "💬", 1500);
});

async function shareResult() {
  if (!lastResult) return;
  const shareCanvas = document.createElement("canvas");
  shareCanvas.width = 1080;
  shareCanvas.height = 1080;
  const shareCtx = shareCanvas.getContext("2d");
  const gradient = shareCtx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, "#32155c");
  gradient.addColorStop(0.55, "#1e0c3a");
  gradient.addColorStop(1, "#4a183b");
  shareCtx.fillStyle = gradient;
  shareCtx.fillRect(0, 0, 1080, 1080);
  shareCtx.fillStyle = "rgba(255,255,255,.06)";
  shareCtx.beginPath();
  shareCtx.arc(540, 475, 350, 0, Math.PI * 2);
  shareCtx.fill();
  if (assets.capy) shareCtx.drawImage(assets.capy, 390, 130, 300, 450);
  shareCtx.textAlign = "center";
  shareCtx.fillStyle = COLORS.white;
  shareCtx.font = "900 70px Arial";
  shareCtx.fillText("CAPYCATCH 3.0", 540, 100);
  shareCtx.fillStyle = COLORS.muted;
  shareCtx.font = "700 34px Arial";
  shareCtx.fillText(mode.name.toUpperCase(), 540, 650);
  shareCtx.fillStyle = COLORS.gold;
  shareCtx.font = "900 170px Arial";
  shareCtx.fillText(String(lastResult.score), 540, 820);
  shareCtx.fillStyle = COLORS.white;
  shareCtx.font = "800 38px Arial";
  shareCtx.fillText(`Поймано ${lastResult.caught}  •  Комбо x${lastResult.maxCombo}`, 540, 895);
  shareCtx.fillStyle = COLORS.violetLight;
  shareCtx.font = "700 31px Arial";
  shareCtx.fillText("bekk3r1337.github.io/capycatch", 540, 1010);

  const blob = await new Promise(resolve => shareCanvas.toBlob(resolve, "image/png"));
  const text = `Я набрал ${lastResult.score} очков в CapyCatch 3.0!`;
  try {
    const file = new File([blob], "capycatch-result.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "CapyCatch 3.0", text, files: [file] });
      return;
    }
  } catch {
    // Если системный Share отменён, предлагаем обычное скачивание.
  }

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "capycatch-result.png";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  try { await navigator.clipboard.writeText(text); } catch {}
  showToast("Карточка результата сохранена", "📸");
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameState === "playing") togglePause(true);
});

window.addEventListener("blur", () => {
  input.left = false;
  input.right = false;
  setMoveButtonState();
});

loadAssets();
requestAnimationFrame(gameLoop);
