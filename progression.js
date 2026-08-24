"use strict";

window.CapyProgression = (() => {
  const STORAGE_KEY = "capycatch-progress-v3";
  const LEGACY_SCORE_KEY = "capycatch-high-score-v2";

  const MODES = {
    classic: {
      id: "classic",
      name: "Классика",
      shortName: "Классика",
      duration: 60,
      lives: null,
      speedMultiplier: 1,
      spawnMultiplier: 1,
      bombBonus: 0,
      rewardMultiplier: 1,
      description: "60 секунд и привычные правила"
    },
    endless: {
      id: "endless",
      name: "Бесконечный",
      shortName: "Бесконечный",
      duration: null,
      lives: 3,
      speedMultiplier: 0.96,
      spawnMultiplier: 1.04,
      bombBonus: -0.01,
      rewardMultiplier: 1.25,
      description: "Три жизни и растущая сложность"
    },
    chaos: {
      id: "chaos",
      name: "Хаос",
      shortName: "Хаос",
      duration: 30,
      lives: null,
      speedMultiplier: 1.28,
      spawnMultiplier: 0.74,
      bombBonus: 0.05,
      rewardMultiplier: 1.55,
      description: "30 быстрых и безумных секунд"
    },
    daily: {
      id: "daily",
      name: "Испытание дня",
      shortName: "Испытание",
      duration: 60,
      lives: null,
      speedMultiplier: 1,
      spawnMultiplier: 1,
      bombBonus: 0,
      rewardMultiplier: 1.35,
      seeded: true,
      description: "Одинаковый раунд для всех"
    }
  };

  const SKINS = [
    {
      id: "classic",
      name: "Классика",
      icon: "🍊",
      price: 0,
      description: "Тёплая капибарка и фиолетовая корзинка",
      glow: "rgba(255, 159, 67, 0.34)",
      gradient: "linear-gradient(145deg, rgba(255,159,67,.38), rgba(139,92,246,.2))"
    },
    {
      id: "berry",
      name: "Ягодная",
      icon: "🍓",
      price: 75,
      description: "Розовая аура, ягодный след и листик",
      glow: "rgba(236, 72, 153, 0.54)",
      gradient: "linear-gradient(145deg, rgba(236,72,153,.52), rgba(139,92,246,.22))"
    },
    {
      id: "golden",
      name: "Золотая",
      icon: "👑",
      price: 160,
      description: "Корона, золотое сияние и искры",
      glow: "rgba(255, 209, 102, 0.6)",
      gradient: "linear-gradient(145deg, rgba(255,209,102,.58), rgba(255,159,67,.24))"
    },
    {
      id: "cosmic",
      name: "Космическая",
      icon: "🪐",
      price: 280,
      description: "Орбита, звёзды и неоновый след",
      glow: "rgba(96, 165, 250, 0.58)",
      gradient: "linear-gradient(145deg, rgba(96,165,250,.48), rgba(139,92,246,.42))"
    }
  ];

  const ACHIEVEMENTS = [
    { id: "first_game", icon: "🎮", title: "Первый раунд", description: "Заверши любую игру", reward: 5, test: (round, data) => data.stats.games >= 1 },
    { id: "first_catch", icon: "🍊", title: "Первая добыча", description: "Поймай первый мандарин", reward: 5, test: (round, data) => data.stats.totalCaught >= 1 },
    { id: "combo2", icon: "✌️", title: "Поймал ритм", description: "Получи комбо x2", reward: 8, test: round => round.maxCombo >= 2 },
    { id: "combo3", icon: "🔥", title: "Без промаха", description: "Получи комбо x3", reward: 15, test: round => round.maxCombo >= 3 },
    { id: "score25", icon: "🥉", title: "Разогрев", description: "Набери 25 очков за раунд", reward: 10, test: round => round.score >= 25 },
    { id: "score75", icon: "🥇", title: "Король корзинки", description: "Набери 75 очков за раунд", reward: 25, test: round => round.score >= 75 },
    { id: "golden10", icon: "✨", title: "Золотая лихорадка", description: "Поймай 10 золотых за раунд", reward: 20, test: round => round.goldenCaught >= 10 },
    { id: "shield", icon: "🛡️", title: "Не сегодня", description: "Заблокируй бомбу щитом", reward: 12, test: round => round.shieldSaves >= 1 },
    { id: "fever", icon: "🌟", title: "Fever!", description: "Запусти золотую лихорадку", reward: 18, test: round => round.feverActivations >= 1 },
    { id: "endless", icon: "❤️", title: "Упрямая капибара", description: "Набери 35 очков в бесконечном режиме", reward: 20, test: round => round.mode === "endless" && round.score >= 35 },
    { id: "daily", icon: "📅", title: "Сегодня в деле", description: "Заверши испытание дня", reward: 12, test: round => round.mode === "daily" },
    { id: "collector", icon: "🛍️", title: "Коллекционер", description: "Получи три скина", reward: 30, test: (round, data) => data.ownedSkins.length >= 3 },
    { id: "veteran", icon: "🏆", title: "Ветеран ловли", description: "Сыграй 20 раундов", reward: 35, test: (round, data) => data.stats.games >= 20 }
  ];

  const DAILY_MODIFIERS = [
    { id: "golden_hour", label: "Золотой час: больше золотых", goldBonus: 0.08, speed: 1, spawn: 1, bomb: 0 },
    { id: "fruit_rain", label: "Фруктовый дождь: предметы падают чаще", goldBonus: 0.02, speed: 1, spawn: 0.78, bomb: 0 },
    { id: "quick_paws", label: "Быстрые лапки: всё движется быстрее", goldBonus: 0, speed: 1.17, spawn: 0.9, bomb: 0.01 },
    { id: "safe_basket", label: "Добрый день: меньше бомб, больше бонусов", goldBonus: 0.03, speed: 1, spawn: 1, bomb: -0.04 }
  ];

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function defaultState() {
    let legacyScore = 0;
    try {
      legacyScore = Math.max(0, Number.parseInt(localStorage.getItem(LEGACY_SCORE_KEY) || "0", 10) || 0);
    } catch {
      legacyScore = 0;
    }

    return {
      version: 3,
      coins: 0,
      selectedMode: "classic",
      selectedSkin: "classic",
      ownedSkins: ["classic"],
      achievements: {},
      highScores: { classic: legacyScore, endless: 0, chaos: 0, daily: {} },
      localBoards: { classic: [], endless: [], chaos: [], daily: [] },
      viewerScores: {},
      playerName: "Bekk3r",
      twitch: { channel: "Bekk3rCapy", username: "" },
      settings: { effectsVolume: 0.7, musicVolume: 0.25, reducedMotion: false },
      stats: {
        games: 0,
        totalScore: 0,
        totalCaught: 0,
        totalMissed: 0,
        totalBombs: 0,
        totalGolden: 0,
        maxCombo: 1,
        feverActivations: 0
      }
    };
  }

  function mergeState(saved) {
    const base = defaultState();
    if (!saved || typeof saved !== "object") return base;

    const merged = {
      ...base,
      ...saved,
      highScores: { ...base.highScores, ...(saved.highScores || {}) },
      localBoards: { ...base.localBoards, ...(saved.localBoards || {}) },
      viewerScores: { ...base.viewerScores, ...(saved.viewerScores || {}) },
      settings: { ...base.settings, ...(saved.settings || {}) },
      twitch: { ...base.twitch, ...(saved.twitch || {}) },
      stats: { ...base.stats, ...(saved.stats || {}) }
    };

    merged.ownedSkins = Array.from(new Set(["classic", ...(saved.ownedSkins || [])]));
    merged.achievements = { ...(saved.achievements || {}) };
    if (!merged.highScores.daily || typeof merged.highScores.daily !== "object") merged.highScores.daily = {};
    return merged;
  }

  function load() {
    try {
      return mergeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch {
      return defaultState();
    }
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Игра продолжает работать без постоянного хранилища.
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getDailyModifier(date = todayKey()) {
    return DAILY_MODIFIERS[hashString(date) % DAILY_MODIFIERS.length];
  }

  function getMode(modeId = state.selectedMode) {
    const base = MODES[modeId] || MODES.classic;
    if (base.id !== "daily") return { ...base };

    const modifier = getDailyModifier();
    return {
      ...base,
      seed: hashString(todayKey()),
      dailyKey: todayKey(),
      dailyModifier: modifier,
      speedMultiplier: base.speedMultiplier * modifier.speed,
      spawnMultiplier: base.spawnMultiplier * modifier.spawn,
      bombBonus: base.bombBonus + modifier.bomb,
      goldBonus: modifier.goldBonus,
      description: modifier.label
    };
  }

  function getHighScore(modeId) {
    if (modeId === "daily") return Number(state.highScores.daily[todayKey()] || 0);
    return Number(state.highScores[modeId] || 0);
  }

  function setMode(modeId) {
    if (!MODES[modeId]) return false;
    state.selectedMode = modeId;
    save();
    return true;
  }

  function setSkin(skinId) {
    if (!state.ownedSkins.includes(skinId)) return false;
    state.selectedSkin = skinId;
    save();
    return true;
  }

  function unlockAchievements(round = {}) {
    const unlocked = [];
    for (const achievement of ACHIEVEMENTS) {
      if (state.achievements[achievement.id]) continue;
      if (!achievement.test(round, state)) continue;

      state.achievements[achievement.id] = new Date().toISOString();
      state.coins += achievement.reward;
      unlocked.push({ ...achievement });
    }
    return unlocked;
  }

  function buySkin(skinId) {
    const skin = SKINS.find(item => item.id === skinId);
    if (!skin) return { ok: false, reason: "Скин не найден" };
    if (state.ownedSkins.includes(skinId)) {
      setSkin(skinId);
      return { ok: true, selected: true, unlocked: [] };
    }
    if (state.coins < skin.price) return { ok: false, reason: "Не хватает мандариновых монет" };

    state.coins -= skin.price;
    state.ownedSkins.push(skinId);
    state.selectedSkin = skinId;
    const unlocked = unlockAchievements({});
    save();
    return { ok: true, selected: true, unlocked };
  }

  function sanitizeName(value) {
    const clean = String(value || "").replace(/[^\p{L}\p{N}_\- ]/gu, "").trim().slice(0, 18);
    return clean || "Игрок";
  }

  function addLocalScore(round) {
    const entry = {
      name: sanitizeName(state.playerName),
      score: Math.max(0, Math.round(round.score || 0)),
      combo: Math.max(1, Math.round(round.maxCombo || 1)),
      mode: round.mode,
      date: new Date().toISOString()
    };
    const board = Array.isArray(state.localBoards[round.mode]) ? state.localBoards[round.mode] : [];
    board.push(entry);
    board.sort((left, right) => right.score - left.score || new Date(left.date) - new Date(right.date));
    state.localBoards[round.mode] = board.slice(0, 10);
    return entry;
  }

  function recordRound(round) {
    const mode = getMode(round.mode);
    const oldScore = getHighScore(round.mode);
    const newRecord = round.score > oldScore;

    if (newRecord) {
      if (round.mode === "daily") state.highScores.daily[todayKey()] = round.score;
      else state.highScores[round.mode] = round.score;
    }

    state.stats.games += 1;
    state.stats.totalScore += Math.max(0, round.score || 0);
    state.stats.totalCaught += Math.max(0, round.caught || 0);
    state.stats.totalMissed += Math.max(0, round.missed || 0);
    state.stats.totalBombs += Math.max(0, round.bombsCaught || 0);
    state.stats.totalGolden += Math.max(0, round.goldenCaught || 0);
    state.stats.maxCombo = Math.max(state.stats.maxCombo, round.maxCombo || 1);
    state.stats.feverActivations += Math.max(0, round.feverActivations || 0);

    const baseCoins = Math.max(2, Math.floor((round.score * 0.1 + round.caught * 0.12) * mode.rewardMultiplier));
    const completionBonus = round.mode === "daily" ? 5 : round.mode === "chaos" ? 3 : 0;
    const coinsEarned = baseCoins + completionBonus;
    state.coins += coinsEarned;

    const entry = addLocalScore(round);
    const unlocked = unlockAchievements(round);
    save();

    return { newRecord, coinsEarned, unlocked, entry, highScore: getHighScore(round.mode) };
  }

  function setPlayerName(value) {
    state.playerName = sanitizeName(value);
    save();
    return state.playerName;
  }

  function setTwitchIdentity(channel, username) {
    state.twitch.channel = String(channel || "").replace(/^#/, "").trim().slice(0, 25) || "Bekk3rCapy";
    state.twitch.username = String(username || "").trim().slice(0, 25);
    save();
  }

  function setSetting(key, value) {
    if (!(key in state.settings)) return;
    state.settings[key] = value;
    save();
  }

  function addViewerPoints(username, points) {
    const name = sanitizeName(username);
    state.viewerScores[name] = Math.max(0, Number(state.viewerScores[name] || 0) + Number(points || 0));
    save();
    return state.viewerScores[name];
  }

  function getViewerBoard() {
    return Object.entries(state.viewerScores)
      .map(([name, score]) => ({ name, score }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 10);
  }

  function remoteConfig() {
    const config = window.CAPYCATCH_LEADERBOARD || {};
    const url = String(config.supabaseUrl || "").replace(/\/$/, "");
    const key = String(config.anonKey || "").trim();
    const table = String(config.table || "capycatch_scores").replace(/[^a-zA-Z0-9_]/g, "");
    return { url, key, table, ready: Boolean(url && key && table) };
  }

  async function fetchRemoteScores(modeId) {
    const config = remoteConfig();
    if (!config.ready) throw new Error("Онлайн-рейтинг ещё не подключён");

    const query = new URLSearchParams({
      select: "player_name,score,combo,mode,created_at",
      mode: `eq.${modeId}`,
      order: "score.desc",
      limit: "20"
    });
    const response = await fetch(`${config.url}/rest/v1/${config.table}?${query}`, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` }
    });
    if (!response.ok) throw new Error("Не удалось загрузить онлайн-рейтинг");
    return response.json();
  }

  async function submitRemoteScore(round) {
    const config = remoteConfig();
    if (!config.ready) return { skipped: true };

    const payload = {
      player_name: sanitizeName(state.playerName),
      score: Math.max(0, Math.round(round.score || 0)),
      combo: Math.max(1, Math.round(round.maxCombo || 1)),
      mode: round.mode
    };
    const response = await fetch(`${config.url}/rest/v1/${config.table}`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Не удалось отправить результат в онлайн-рейтинг");
    return { skipped: false };
  }

  function reset() {
    state = defaultState();
    save();
  }

  return {
    modes: MODES,
    skins: SKINS,
    achievements: ACHIEVEMENTS,
    todayKey,
    getDailyModifier,
    getMode,
    getHighScore,
    setMode,
    setSkin,
    buySkin,
    recordRound,
    setPlayerName,
    setTwitchIdentity,
    setSetting,
    addViewerPoints,
    getViewerBoard,
    fetchRemoteScores,
    submitRemoteScore,
    remoteReady: () => remoteConfig().ready,
    reset,
    getState: () => clone(state),
    getSkin: () => SKINS.find(skin => skin.id === state.selectedSkin) || SKINS[0]
  };
})();
