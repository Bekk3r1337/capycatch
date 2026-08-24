"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const soundButton = document.getElementById("sound-button");
const pauseButton = document.getElementById("pause-button");
const leftButton = document.getElementById("left-button");
const rightButton = document.getElementById("right-button");
const liveStatus = document.getElementById("live-status");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const ROUND_DURATION = 60;
const PLAYER_Y = 390;
const STORAGE_KEY = "capycatch-high-score-v2";

const COLORS = {
  white: "#fffaf4",
  muted: "#c7b9dc",
  violet: "#8b5cf6",
  violetDark: "#4c1d95",
  pink: "#ec4899",
  orange: "#ff9f43",
  orangeLight: "#ffd166",
  red: "#fb7185",
  green: "#6ee7b7",
  panel: "rgba(18, 7, 35, 0.72)"
};

const assets = {};
const assetSources = {
  capy: "capy.png",
  mandarin: "mandarin.png",
  gold: "gold.png",
  bomb: "bomb.png"
};

let gameState = "loading";
let lastFrameTime = performance.now();
let elapsed = 0;
let spawnTimer = 0;
let nextSpawnDelay = 0.8;
let score = 0;
let highScore = readHighScore();
let streak = 0;
let bestCombo = 1;
let isNewRecord = false;
let objects = [];
let particles = [];
let floatingTexts = [];
let shakeTime = 0;
let shakeStrength = 0;
let audioContext = null;
let soundEnabled = true;
let pointerActive = false;
let statusSecond = -1;

const input = { left: false, right: false };

const player = {
  x: WIDTH / 2 - 70,
  width: 140,
  speed: 430,
  targetX: null,
  bounce: 0,
  tilt: 0
};

const backgroundDots = Array.from({ length: 24 }, (_, index) => ({
  x: (index * 83 + 37) % WIDTH,
  y: (index * 47 + 21) % HEIGHT,
  size: 1 + (index % 3) * 0.55,
  phase: index * 0.73
}));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function readHighScore() {
  try {
    return Math.max(0, Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0);
  } catch {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Игра продолжит работать, даже если хранилище браузера недоступно.
  }
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
  liveStatus.textContent = "Игра загружена. Нажмите Старт";
}

function initAudio() {
  if (!soundEnabled) return;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
}

function playTone(frequency, duration, type = "sine", volume = 0.045, delay = 0) {
  if (!soundEnabled || !audioContext) return;

  const startAt = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

function playCatchSound(type, combo) {
  if (type === "bomb") {
    playTone(110, 0.22, "sawtooth", 0.06);
    playTone(72, 0.28, "square", 0.035, 0.04);
    return;
  }

  const base = type === "gold" ? 720 : 480;
  playTone(base + combo * 35, 0.11, "sine", 0.045);
  if (type === "gold") playTone(980, 0.18, "triangle", 0.035, 0.06);
}

function setSound(enabled) {
  soundEnabled = enabled;
  soundButton.textContent = enabled ? "🔊" : "🔇";
  soundButton.setAttribute("aria-label", enabled ? "Выключить звук" : "Включить звук");
  if (enabled) initAudio();
}

function currentCombo() {
  return clamp(1 + Math.floor(streak / 5), 1, 3);
}

function startGame() {
  initAudio();
  score = 0;
  streak = 0;
  bestCombo = 1;
  elapsed = 0;
  spawnTimer = 0;
  nextSpawnDelay = 0.72;
  objects = [];
  particles = [];
  floatingTexts = [];
  shakeTime = 0;
  isNewRecord = false;
  statusSecond = -1;
  player.x = WIDTH / 2 - player.width / 2;
  player.targetX = null;
  player.bounce = 0;
  gameState = "playing";
  pauseButton.disabled = false;
  pauseButton.textContent = "Пауза";
  liveStatus.textContent = "Игра началась. Осталось 60 секунд";
  playTone(392, 0.1, "sine", 0.04);
  playTone(523, 0.16, "sine", 0.04, 0.09);
}

function endGame() {
  if (gameState !== "playing") return;
  gameState = "gameover";
  pauseButton.disabled = true;
  input.left = false;
  input.right = false;
  setMoveButtonState();

  if (score > highScore) {
    highScore = score;
    isNewRecord = true;
    saveHighScore(highScore);
  }

  liveStatus.textContent = `Игра окончена. Результат: ${score}. Рекорд: ${highScore}`;
  playTone(523, 0.12, "sine", 0.04);
  playTone(659, 0.12, "sine", 0.04, 0.1);
  playTone(784, 0.24, "sine", 0.04, 0.2);
}

function togglePause(forcePause = false) {
  if (gameState === "playing") {
    gameState = "paused";
    pauseButton.textContent = "Продолжить";
    input.left = false;
    input.right = false;
    setMoveButtonState();
    liveStatus.textContent = "Игра на паузе";
  } else if (gameState === "paused" && !forcePause) {
    gameState = "playing";
    pauseButton.textContent = "Пауза";
    lastFrameTime = performance.now();
    liveStatus.textContent = "Игра продолжена";
  }
}

function getDifficulty() {
  const progress = clamp(elapsed / ROUND_DURATION, 0, 1);
  return {
    progress,
    spawnDelay: lerp(0.82, 0.46, progress),
    fallSpeed: lerp(165, 265, progress),
    bombChance: lerp(0.08, 0.16, progress)
  };
}

function spawnObject() {
  const difficulty = getDifficulty();
  const roll = Math.random();
  let type = "normal";

  if (roll < difficulty.bombChance) type = "bomb";
  else if (roll < difficulty.bombChance + 0.13) type = "gold";

  const size = type === "bomb" ? 52 : type === "gold" ? 48 : 44;
  objects.push({
    x: random(size / 2 + 6, WIDTH - size / 2 - 6),
    y: -size,
    previousY: -size,
    size,
    speed: difficulty.fallSpeed * random(0.88, 1.13),
    type,
    angle: random(0, Math.PI * 2),
    rotationSpeed: random(-2.8, 2.8)
  });

  nextSpawnDelay = difficulty.spawnDelay * random(0.86, 1.14);
}

function getBasket() {
  return {
    x: player.x + 30,
    y: PLAYER_Y - 110,
    width: 80,
    height: 38
  };
}

function overlapsBasket(object, basket) {
  const half = object.size * 0.36;
  const left = object.x - half;
  const right = object.x + half;
  const top = object.y - half;
  const bottom = object.y + half;

  return right > basket.x + 4 &&
    left < basket.x + basket.width - 4 &&
    bottom > basket.y &&
    top < basket.y + basket.height;
}

function handleCatch(object) {
  const comboBeforeCatch = currentCombo();

  if (object.type === "bomb") {
    score = Math.max(0, score - 5);
    streak = 0;
    player.bounce = -1;
    shakeTime = 0.28;
    shakeStrength = 8;
    addFloatingText(object.x, object.y, "-5", COLORS.red, 25);
    burst(object.x, object.y, COLORS.red, 16, 170);
    burst(object.x, object.y, "#5b2135", 9, 120);
    playCatchSound("bomb", 1);
    return;
  }

  streak += 1;
  const combo = currentCombo();
  bestCombo = Math.max(bestCombo, combo);
  const basePoints = object.type === "gold" ? 5 : 1;
  const gained = basePoints * combo;
  score += gained;
  player.bounce = 1;

  const color = object.type === "gold" ? COLORS.orangeLight : COLORS.orange;
  addFloatingText(object.x, object.y, `+${gained}`, color, object.type === "gold" ? 28 : 22);
  burst(object.x, object.y, color, object.type === "gold" ? 14 : 9, object.type === "gold" ? 145 : 100);
  playCatchSound(object.type, combo);

  if (combo > comboBeforeCatch) {
    addFloatingText(WIDTH / 2, 115, `КОМБО x${combo}!`, COLORS.green, 28);
    burst(WIDTH / 2, 128, COLORS.green, 18, 155);
  }
}

function burst(x, y, color, amount, speed) {
  for (let index = 0; index < amount; index += 1) {
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
  floatingTexts.push({ x, y, text, color, size, life: 0.75, maxLife: 0.75 });
}

function updatePlayer(deltaTime) {
  let direction = 0;
  if (input.left) direction -= 1;
  if (input.right) direction += 1;

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
}

function updateObjects(deltaTime) {
  const basket = getBasket();

  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    object.previousY = object.y;
    object.y += object.speed * deltaTime;
    object.angle += object.rotationSpeed * deltaTime;

    if (overlapsBasket(object, basket)) {
      handleCatch(object);
      objects.splice(index, 1);
      continue;
    }

    if (object.y - object.size / 2 > HEIGHT) {
      if (object.type !== "bomb" && streak > 0) streak = 0;
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

  if (shakeTime > 0) {
    shakeTime = Math.max(0, shakeTime - deltaTime);
    shakeStrength = lerp(shakeStrength, 0, Math.min(1, deltaTime * 8));
  }
}

function updateGame(deltaTime) {
  elapsed += deltaTime;
  if (elapsed >= ROUND_DURATION) {
    elapsed = ROUND_DURATION;
    endGame();
    return;
  }

  spawnTimer += deltaTime;
  if (spawnTimer >= nextSpawnDelay) {
    spawnTimer -= nextSpawnDelay;
    spawnObject();
  }

  updatePlayer(deltaTime);
  updateObjects(deltaTime);
  updateEffects(deltaTime);

  const seconds = Math.ceil(ROUND_DURATION - elapsed);
  if (seconds !== statusSecond && (seconds <= 10 || seconds % 10 === 0)) {
    statusSecond = seconds;
    liveStatus.textContent = `Счёт: ${score}. Осталось ${seconds} секунд`;
  }
}

function roundRect(x, y, width, height, radius, fill, stroke = null) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, safeRadius);
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
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#32155c");
  gradient.addColorStop(0.56, "#241044");
  gradient.addColorStop(1, "#160a2c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(250, 190, 20, 250, 190, 260);
  glow.addColorStop(0, "rgba(236, 72, 153, 0.13)");
  glow.addColorStop(1, "rgba(76, 29, 149, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const dot of backgroundDots) {
    const alpha = 0.16 + Math.sin(time * 0.0015 + dot.phase) * 0.08;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = dot.size > 1.8 ? COLORS.orangeLight : COLORS.violetLight || "#c4b5fd";
    ctx.beginPath();
    ctx.arc(dot.x, dot.y + Math.sin(time * 0.0008 + dot.phase) * 3, dot.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(10, 4, 23, 0.2)";
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
  ctx.font = "800 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + width / 2, y + height / 2);
}

function drawPlayer() {
  const scaleX = 1 + Math.max(0, player.bounce) * 0.035 - Math.max(0, -player.bounce) * 0.025;
  const scaleY = 1 - Math.max(0, player.bounce) * 0.035 + Math.max(0, -player.bounce) * 0.025;
  const drawX = player.x + player.width / 2;
  const drawY = PLAYER_Y - 30;

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.rotate(player.tilt);
  ctx.scale(scaleX, scaleY);
  drawImageOrFallback(assets.capy, -70, -120, 140, 180, "#9b6b43", "CAPY");
  ctx.restore();
}

function drawObjects() {
  for (const object of objects) {
    let image = assets.mandarin;
    let fallback = COLORS.orange;
    let label = "+1";
    if (object.type === "gold") {
      image = assets.gold;
      fallback = COLORS.orangeLight;
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
    ctx.restore();
  }
}

function drawEffects() {
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

function drawHud() {
  const timeLeft = Math.max(0, Math.ceil(ROUND_DURATION - elapsed));
  const combo = currentCombo();

  roundRect(14, 13, 142, 52, 14, COLORS.panel, "rgba(255,255,255,0.08)");
  roundRect(172, 13, 156, 52, 14, COLORS.panel, "rgba(255,255,255,0.08)");
  roundRect(344, 13, 142, 52, 14, COLORS.panel, "rgba(255,255,255,0.08)");

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 11px Arial";
  ctx.fillText("СЧЁТ", 28, 33);
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 22px Arial";
  ctx.fillText(String(score), 28, 55);

  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 11px Arial";
  ctx.fillText("ВРЕМЯ", 250, 33);
  ctx.fillStyle = timeLeft <= 10 ? COLORS.red : COLORS.white;
  ctx.font = "900 22px Arial";
  ctx.fillText(`${timeLeft} сек`, 250, 55);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 11px Arial";
  ctx.fillText("РЕКОРД", 472, 33);
  ctx.fillStyle = COLORS.orangeLight;
  ctx.font = "900 22px Arial";
  ctx.fillText(String(Math.max(highScore, score)), 472, 55);

  roundRect(16, 72, 468, 5, 3, "rgba(255,255,255,0.09)");
  roundRect(16, 72, 468 * clamp(elapsed / ROUND_DURATION, 0, 1), 5, 3, timeLeft <= 10 ? COLORS.red : COLORS.violet);

  if (combo > 1) {
    roundRect(201, 86, 98, 31, 15, combo === 3 ? "rgba(255, 159, 67, 0.9)" : "rgba(110, 231, 183, 0.86)");
    ctx.fillStyle = "#241044";
    ctx.font = "900 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`КОМБО x${combo}`, 250, 102);
  }
}

function drawButton(x, y, width, height, label, accent = COLORS.violet) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 7;
  roundRect(x, y, width, height, 17, accent);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + width / 2, y + height / 2 + 1);
  ctx.restore();
}

function drawStartScreen() {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 29px Arial";
  ctx.fillText("ПОКОРМИ КАПИБАРКУ", WIDTH / 2, 72);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "600 14px Arial";
  ctx.fillText("Лови мандарины и набери максимум за 60 секунд", WIDTH / 2, 99);

  const cards = [
    { x: 91, image: assets.mandarin, color: COLORS.orange, title: "+1", caption: "мандарин" },
    { x: 206, image: assets.gold, color: COLORS.orangeLight, title: "+5", caption: "золотой" },
    { x: 321, image: assets.bomb, color: "#52525b", title: "-5", caption: "бомба" }
  ];

  for (const card of cards) {
    roundRect(card.x, 124, 88, 116, 18, "rgba(255,255,255,0.07)", "rgba(255,255,255,0.08)");
    drawImageOrFallback(card.image, card.x + 20, 138, 48, 48, card.color, card.title);
    ctx.fillStyle = card.color === "#52525b" ? COLORS.red : card.color;
    ctx.font = "900 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(card.title, card.x + 44, 205);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "700 11px Arial";
    ctx.fillText(card.caption, card.x + 44, 224);
  }

  drawButton(155, 277, 190, 58, "ИГРАТЬ");

  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 13px Arial";
  ctx.fillText("Серия из 5 фруктов открывает множитель", WIDTH / 2, 365);

  if (highScore > 0) {
    ctx.fillStyle = COLORS.orangeLight;
    ctx.font = "900 16px Arial";
    ctx.fillText(`Твой рекорд: ${highScore}`, WIDTH / 2, 403);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "700 12px Arial";
    ctx.fillText("Нажми Enter или кнопку «Играть»", WIDTH / 2, 403);
  }
}

function getRank(value) {
  if (value < 20) return { title: "Сонная капибарка", color: COLORS.muted };
  if (value < 45) return { title: "Ловкие лапки", color: COLORS.green };
  if (value < 80) return { title: "Мандариновый мастер", color: COLORS.orange };
  return { title: "Король корзинки", color: COLORS.orangeLight };
}

function drawGameOver() {
  ctx.fillStyle = "rgba(13, 5, 27, 0.76)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  roundRect(65, 45, 370, 350, 26, "rgba(35, 15, 65, 0.94)", "rgba(196,181,253,0.2)");

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = isNewRecord ? COLORS.orangeLight : COLORS.white;
  ctx.font = "900 29px Arial";
  ctx.fillText(isNewRecord ? "НОВЫЙ РЕКОРД!" : "РАУНД ОКОНЧЕН", WIDTH / 2, 94);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 13px Arial";
  ctx.fillText("ТВОЙ РЕЗУЛЬТАТ", WIDTH / 2, 127);
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 68px Arial";
  ctx.fillText(String(score), WIDTH / 2, 194);

  const rank = getRank(score);
  roundRect(132, 217, 236, 40, 20, "rgba(255,255,255,0.07)");
  ctx.fillStyle = rank.color;
  ctx.font = "900 16px Arial";
  ctx.textBaseline = "middle";
  ctx.fillText(rank.title, WIDTH / 2, 237);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 13px Arial";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Рекорд: ${highScore}   •   Лучшее комбо: x${bestCombo}`, WIDTH / 2, 285);

  drawButton(155, 310, 190, 58, "ЕЩЁ РАЗ", isNewRecord ? COLORS.pink : COLORS.violet);
}

function drawPaused() {
  ctx.fillStyle = "rgba(13, 5, 27, 0.72)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  roundRect(112, 155, 276, 132, 24, "rgba(35, 15, 65, 0.95)", "rgba(196,181,253,0.2)");
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 34px Arial";
  ctx.fillText("ПАУЗА", WIDTH / 2, 210);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 14px Arial";
  ctx.fillText("Нажми P, Esc или «Продолжить»", WIDTH / 2, 250);
}

function drawLoading(time) {
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 29px Arial";
  ctx.fillText("CAPYCATCH", WIDTH / 2, 205);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 14px Arial";
  ctx.fillText("Готовим мандарины...", WIDTH / 2, 237);

  const dots = 3;
  for (let index = 0; index < dots; index += 1) {
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

  if (shakeTime > 0 && gameState === "playing") {
    ctx.translate(random(-shakeStrength, shakeStrength), random(-shakeStrength, shakeStrength));
  }

  drawBackground(time);

  if (gameState === "loading") {
    drawLoading(time);
  } else if (gameState === "start") {
    drawStartScreen();
  } else {
    drawObjects();
    drawPlayer();
    drawEffects();
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
  return {
    x: (event.clientX - rect.left) * (WIDTH / rect.width),
    y: (event.clientY - rect.top) * (HEIGHT / rect.height)
  };
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

  if (gameState === "start" && insideButton(point, 155, 277, 190, 58)) {
    startGame();
    return;
  }

  if (gameState === "gameover" && insideButton(point, 155, 310, 190, 58)) {
    startGame();
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

canvas.addEventListener("pointercancel", () => {
  pointerActive = false;
});

function setMoveButtonState() {
  leftButton.classList.toggle("is-active", input.left);
  rightButton.classList.toggle("is-active", input.right);
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

bindMoveButton(leftButton, "left");
bindMoveButton(rightButton, "right");

document.addEventListener("keydown", event => {
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

soundButton.addEventListener("click", () => setSound(!soundEnabled));
pauseButton.addEventListener("click", () => togglePause());

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
