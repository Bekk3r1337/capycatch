"use strict";

window.CapyAdventure = (() => {
  const STORAGE_KEY = "capycatch-adventure-v4";

  const ZONES = [
    {
      id: "garden",
      name: "Мандариновый сад",
      icon: "🌿",
      subtitle: "Тёплый ветер и первые испытания",
      mechanic: "breeze",
      colors: ["#40205f", "#172c2b"],
      boss: { name: "Ворон-воришка", icon: "🐦‍⬛", hp: 4, description: "Возвращай заряженные мандарины и не дай ворону унести урожай." },
      reward: "gardener"
    },
    {
      id: "market",
      name: "Ночной рынок",
      icon: "🏮",
      subtitle: "Фонари, палатки и опасные подделки",
      mechanic: "decoys",
      colors: ["#3f174f", "#22142f"],
      boss: { name: "Енот-бомбардир", icon: "🦝", hp: 5, description: "Следи за золотыми приманками между сериями бомб." },
      reward: "lantern"
    },
    {
      id: "port",
      name: "Штормовой порт",
      icon: "⛈️",
      subtitle: "Ливень, волны и сильный боковой ветер",
      mechanic: "storm",
      colors: ["#17365e", "#111a34"],
      boss: { name: "Штормовой краб", icon: "🦀", hp: 6, description: "Пережидай порывы и бей в спокойные окна между волнами." },
      reward: "sailor"
    },
    {
      id: "factory",
      name: "Фиолетовая фабрика",
      icon: "⚙️",
      subtitle: "Конвейеры, магниты и механические ловушки",
      mechanic: "conveyor",
      colors: ["#321261", "#15142c"],
      boss: { name: "Сортировочный дрон", icon: "🤖", hp: 7, description: "Меняй полосу и лови энергетические заряды между лазерными залпами." },
      reward: "mechanic"
    },
    {
      id: "citadel",
      name: "Цитрусовая цитадель",
      icon: "🏰",
      subtitle: "Все опасности сходятся у золотого трона",
      mechanic: "mixed",
      colors: ["#522311", "#24102d"],
      boss: { name: "Король гнилых мандаринов", icon: "👑", hp: 9, description: "Финальное сражение из трёх фаз со всеми механиками приключения." },
      reward: "citrus_king"
    }
  ];

  const OBJECTIVES = [
    { type: "score", label: target => `Набери ${target} очков` },
    { type: "caught", label: target => `Поймай ${target} фруктов` },
    { type: "gold", label: target => `Поймай ${target} золотых` },
    { type: "combo", label: target => `Доберись до комбо x${target}` },
    { type: "survive", label: () => "Продержись до конца" },
    { type: "clean", label: target => `Поймай ${target} фруктов без бомб` },
    { type: "fever", label: target => `Запусти Fever ${target} раз` }
  ];

  const LEVEL_TITLES = [
    ["Первый урожай", "Листопад", "Золотая ветка", "Ритм сада", "Долгая прогулка", "Чистая корзинка", "Солнечный Fever"],
    ["Открытие рынка", "Поток покупателей", "Свет фонарей", "Торговый ритм", "Последний прилавок", "Без подделок", "Золотая распродажа"],
    ["К причалу", "Мандариновый дождь", "Маяк в тумане", "Ритм волны", "Штормовая смена", "Сухая корзинка", "Заряд молнии"],
    ["Первый конвейер", "Сортировочная линия", "Энергоблок", "Точный механизм", "Ночная смена", "Контроль качества", "Перегрузка Fever"],
    ["Ворота цитадели", "Королевский запас", "Золотой коридор", "Марш корзинки", "Последняя стража", "Идеальный урожай", "Сила цитруса"]
  ];

  function buildLevels() {
    const levels = [];
    ZONES.forEach((zone, zoneIndex) => {
      for (let stage = 0; stage < 8; stage += 1) {
        const number = zoneIndex * 8 + stage + 1;
        const boss = stage === 7;
        const objective = boss ? { type: "boss", target: zone.boss.hp } : OBJECTIVES[stage];
        const targetBase = [20, 14, 3, 2, 0, 12, 1][stage] || 0;
        const targetGrowth = [10, 5, 1, 0, 0, 4, zoneIndex > 2 ? 1 : 0][stage] || 0;
        let target = boss ? zone.boss.hp : targetBase + targetGrowth * zoneIndex;
        if (stage === 3) target = zoneIndex === 0 ? 2 : 3;
        const duration = boss ? 75 + zoneIndex * 7 : 44 + zoneIndex * 4 + (stage % 3) * 5;
        const scoreBase = 20 + zoneIndex * 16 + stage * 5;
        levels.push({
          id: `${zone.id}-${stage + 1}`,
          number,
          zoneId: zone.id,
          zoneIndex,
          stage: stage + 1,
          title: boss ? zone.boss.name : LEVEL_TITLES[zoneIndex][stage],
          icon: boss ? zone.boss.icon : zone.icon,
          boss,
          duration,
          lives: boss ? 3 : stage === 4 ? 3 : null,
          objective: { ...objective, target },
          objectiveText: boss ? `Победи босса: ${zone.boss.name}` : objective.label(target),
          starScores: [Math.max(10, scoreBase - 10), scoreBase + 12, scoreBase + 34],
          speedMultiplier: 0.91 + zoneIndex * 0.075 + stage * 0.012,
          spawnMultiplier: Math.max(0.7, 1.03 - zoneIndex * 0.045 - stage * 0.018),
          bombBonus: zoneIndex * 0.012 + (stage >= 4 ? 0.012 : 0),
          goldBonus: stage === 2 || stage === 6 ? 0.075 : 0,
          mechanic: zone.mechanic,
          zone
        });
      }
    });
    return levels;
  }

  const LEVELS = buildLevels();

  const SKILLS = [
    { id: "quick_paws", branch: "agility", icon: "🐾", name: "Быстрые лапки", description: "+12% к скорости движения", cost: 1 },
    { id: "wide_basket", branch: "agility", icon: "🧺", name: "Широкая корзинка", description: "+18 к ширине области ловли", cost: 1 },
    { id: "dash", branch: "agility", icon: "💨", name: "Рывок", description: "Shift или двойное касание мгновенно двигает капибарку", cost: 2, requires: "quick_paws" },
    { id: "time_instinct", branch: "agility", icon: "⏱️", name: "Чувство времени", description: "Опасные предметы замедляются рядом с корзинкой", cost: 2, requires: "wide_basket" },
    { id: "afterimage", branch: "agility", icon: "✨", name: "Ложный след", description: "Первый пропущенный фрукт не сбрасывает серию", cost: 3, requires: "dash" },
    { id: "start_shield", branch: "defense", icon: "🛡️", name: "Щит на старте", description: "Каждый уровень начинается с одним щитом", cost: 1 },
    { id: "padded_basket", branch: "defense", icon: "🧸", name: "Мягкая корзинка", description: "Бомба отнимает только 2 очка", cost: 1 },
    { id: "clean_snout", branch: "defense", icon: "🌿", name: "Чуткий нос", description: "Испорченный фрукт отнимает только 1 очко", cost: 2, requires: "padded_basket" },
    { id: "reinforced_shield", branch: "defense", icon: "💎", name: "Прочный щит", description: "Можно хранить до трёх зарядов щита", cost: 2, requires: "start_shield" },
    { id: "extra_heart", branch: "defense", icon: "❤️", name: "Второе дыхание", description: "+1 жизнь на уровнях с жизнями", cost: 3, requires: "reinforced_shield" },
    { id: "warm_start", branch: "fever", icon: "🌡️", name: "Тёплый старт", description: "Уровень начинается с 25% Fever", cost: 1 },
    { id: "spark", branch: "fever", icon: "⚡", name: "Искра", description: "Fever заполняется на 30% быстрее", cost: 1 },
    { id: "golden_touch", branch: "fever", icon: "🌟", name: "Золотое касание", description: "Золотые мандарины появляются чаще", cost: 2, requires: "spark" },
    { id: "long_fever", branch: "fever", icon: "☀️", name: "Долгий Fever", description: "Золотой дождь длится на 3 секунды дольше", cost: 2, requires: "warm_start" },
    { id: "steady_rhythm", branch: "fever", icon: "🎵", name: "Верный ритм", description: "Первая ошибка не сбрасывает комбо", cost: 3, requires: "long_fever" }
  ];

  const GADGETS = [
    { id: "magnet", icon: "🧲", name: "Карманный магнит", description: "Притягивает хорошие предметы 8 секунд", unlockLevel: 1 },
    { id: "umbrella", icon: "☂️", name: "Защитный зонтик", description: "Сразу добавляет два заряда щита", unlockLevel: 5 },
    { id: "freeze", icon: "❄️", name: "Заморозка времени", description: "Замедляет всё поле на 6 секунд", unlockLevel: 11 },
    { id: "whistle", icon: "📯", name: "Золотой свисток", description: "Мгновенно запускает Fever", unlockLevel: 19 },
    { id: "net", icon: "🕸️", name: "Большая сетка", description: "Ловит все полезные предметы на поле", unlockLevel: 27 }
  ];

  const COSMETICS = [
    { id: "classic", type: "outfit", icon: "🍊", name: "Классический образ", unlock: { type: "start", value: 0 } },
    { id: "gardener", type: "outfit", icon: "🌱", name: "Садовник", unlock: { type: "level", value: 8 } },
    { id: "lantern", type: "outfit", icon: "🏮", name: "Хранитель фонаря", unlock: { type: "level", value: 16 } },
    { id: "sailor", type: "outfit", icon: "⚓", name: "Штормовой моряк", unlock: { type: "level", value: 24 } },
    { id: "mechanic", type: "outfit", icon: "🔧", name: "Механик", unlock: { type: "level", value: 32 } },
    { id: "citrus_king", type: "outfit", icon: "👑", name: "Цитрусовый герой", unlock: { type: "level", value: 40 } },
    { id: "star_scarf", type: "outfit", icon: "🧣", name: "Звёздный шарф", unlock: { type: "stars", value: 30 } },
    { id: "violet_witch", type: "outfit", icon: "🧙", name: "Фиолетовый волшебник", unlock: { type: "stars", value: 60 } },
    { id: "pumpkin", type: "outfit", icon: "🎃", name: "Тыквенный уют", unlock: { type: "event", value: "autumn_harvest" } },
    { id: "snowcap", type: "outfit", icon: "❄️", name: "Снежная шапка", unlock: { type: "event", value: "winter_festival" } },
    { id: "leaves", type: "trail", icon: "🍂", name: "Осенние листья", unlock: { type: "level", value: 8 } },
    { id: "lights", type: "trail", icon: "✨", name: "Огоньки рынка", unlock: { type: "level", value: 16 } },
    { id: "bubbles", type: "trail", icon: "💧", name: "Штормовые брызги", unlock: { type: "level", value: 24 } },
    { id: "sparks", type: "trail", icon: "⚙️", name: "Искры механизма", unlock: { type: "level", value: 32 } },
    { id: "crowns", type: "trail", icon: "👑", name: "Королевский след", unlock: { type: "level", value: 40 } },
    { id: "garden_frame", type: "frame", icon: "🌿", name: "Рамка сада", unlock: { type: "stars", value: 18 } },
    { id: "market_frame", type: "frame", icon: "🏮", name: "Рамка рынка", unlock: { type: "stars", value: 42 } },
    { id: "storm_frame", type: "frame", icon: "⛈️", name: "Рамка шторма", unlock: { type: "stars", value: 66 } },
    { id: "factory_frame", type: "frame", icon: "⚙️", name: "Рамка фабрики", unlock: { type: "stars", value: 90 } },
    { id: "royal_frame", type: "frame", icon: "🏰", name: "Королевская рамка", unlock: { type: "stars", value: 120 } },
    { id: "happy", type: "emote", icon: "🥳", name: "Мандариновый восторг", unlock: { type: "stars", value: 12 } },
    { id: "hero", type: "emote", icon: "😎", name: "Геройская поза", unlock: { type: "stars", value: 48 } },
    { id: "royal", type: "emote", icon: "🤴", name: "Поклон героя", unlock: { type: "level", value: 40 } }
  ];

  const EVENTS = [
    { id: "spring_garden", name: "Весенний сад", icon: "🌸", months: [2, 3, 4], rewards: ["happy", "garden_frame", "gardener"] },
    { id: "purple_week", name: "Фиолетовая неделя", icon: "💜", specialDays: [20, 21, 22, 23, 24, 25, 26], rewards: ["lights", "violet_witch", "market_frame"] },
    { id: "autumn_harvest", name: "Осенний урожай", icon: "🎃", months: [8, 9, 10], rewards: ["leaves", "pumpkin", "garden_frame"] },
    { id: "winter_festival", name: "Зимний мандариновый фестиваль", icon: "❄️", months: [11, 0, 1], rewards: ["bubbles", "snowcap", "storm_frame"] },
    { id: "capy_birthday", name: "День рождения CapyCatch", icon: "🎂", month: 5, days: [12, 13, 14, 15, 16, 17, 18], rewards: ["crowns", "hero", "royal_frame"] }
  ];

  const STORIES = {
    intro: [
      { speaker: "Bekk3r", icon: "🦫", text: "В саду пропадает урожай. Кажется, кто-то уносит золотые мандарины к старой цитадели." },
      { speaker: "Драго", icon: "🐰", text: "Я отмечу путь на карте. Начнём с сада и узнаем, кто за этим стоит." },
      { speaker: "Пельмеш", icon: "🥟", text: "А я подготовлю гаджеты! Только возвращайся со звёздами, без них мастерская не работает." }
    ],
    market: [
      { speaker: "Драго", icon: "🐰", text: "След ведёт на ночной рынок. Здесь много красивых приманок, но не всё золотое стоит ловить." },
      { speaker: "Пельмеш", icon: "🥟", text: "Я открыл новые детали. Скоро сможем замораживать целое игровое поле!" }
    ],
    port: [
      { speaker: "Bekk3r", icon: "🦫", text: "Енот отправлял украденные мандарины через порт. Придётся пройти прямо через шторм." },
      { speaker: "Драго", icon: "🐰", text: "Следи за ветром. Перед сильным порывом небо всегда вспыхивает." }
    ],
    factory: [
      { speaker: "Пельмеш", icon: "🥟", text: "Это фабрика Короля. Конвейеры тянут всё к центру, а дрон охраняет главный подъёмник." },
      { speaker: "Bekk3r", icon: "🦫", text: "Тогда отключим сортировку и поднимемся в цитадель." }
    ],
    citadel: [
      { speaker: "Драго", icon: "🐰", text: "Мы почти у трона. Здесь соединяются ветер, ловушки и испорченные мандарины." },
      { speaker: "Пельмеш", icon: "🥟", text: "Все гаджеты готовы. Покажи Королю, кому принадлежит этот урожай!" }
    ],
    ending: [
      { speaker: "Король", icon: "👑", text: "Ладно! Забирайте золотой урожай. Я просто хотел самый большой Fever в королевстве." },
      { speaker: "Драго", icon: "🐰", text: "Можно было просто попросить поиграть вместе." },
      { speaker: "Bekk3r", icon: "🦫", text: "Цитадель спасена, карта пройдена, а впереди ещё много испытаний!" },
      { speaker: "Пельмеш", icon: "🥟", text: "Идеальная смена! Возвращайся за всеми звёздами и секретными образами." }
    ]
  };

  function defaultState() {
    return {
      version: 4,
      selectedLevel: 1,
      unlockedLevel: 1,
      levels: {},
      skills: [],
      selectedGadget: "magnet",
      ownedCosmetics: ["classic"],
      selectedCosmetics: { outfit: "classic", trail: "", frame: "", emote: "" },
      seenStories: [],
      eventProgress: {}
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeState(saved) {
    const base = defaultState();
    if (!saved || typeof saved !== "object") return base;
    const merged = {
      ...base,
      ...saved,
      levels: { ...base.levels, ...(saved.levels || {}) },
      selectedCosmetics: { ...base.selectedCosmetics, ...(saved.selectedCosmetics || {}) },
      eventProgress: { ...base.eventProgress, ...(saved.eventProgress || {}) }
    };
    merged.skills = Array.from(new Set(saved.skills || [])).filter(id => SKILLS.some(skill => skill.id === id));
    merged.ownedCosmetics = Array.from(new Set(["classic", ...(saved.ownedCosmetics || [])]));
    merged.seenStories = Array.from(new Set(saved.seenStories || []));
    merged.unlockedLevel = Math.max(1, Math.min(40, Number(merged.unlockedLevel) || 1));
    merged.selectedLevel = Math.max(1, Math.min(merged.unlockedLevel, Number(merged.selectedLevel) || 1));
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
      // Приключение продолжает работать без постоянного хранилища.
    }
  }

  function getLevel(levelOrId = state.selectedLevel) {
    if (typeof levelOrId === "string") return LEVELS.find(level => level.id === levelOrId) || LEVELS[0];
    return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, Number(levelOrId || 1) - 1))];
  }

  function getZone(zoneId) {
    return ZONES.find(zone => zone.id === zoneId) || ZONES[0];
  }

  function getTotalStars() {
    return Object.values(state.levels).reduce((sum, result) => sum + Math.max(0, Number(result.stars) || 0), 0);
  }

  function getSpentSkillPoints() {
    return state.skills.reduce((sum, id) => sum + (SKILLS.find(skill => skill.id === id)?.cost || 0), 0);
  }

  function getSkillPoints() {
    return Math.max(0, Math.floor(getTotalStars() / 3) - getSpentSkillPoints());
  }

  function hasSkill(id) {
    return state.skills.includes(id);
  }

  function unlockSkill(id) {
    const skill = SKILLS.find(item => item.id === id);
    if (!skill) return { ok: false, reason: "Навык не найден" };
    if (hasSkill(id)) return { ok: false, reason: "Навык уже открыт" };
    if (skill.requires && !hasSkill(skill.requires)) return { ok: false, reason: "Сначала открой предыдущий навык" };
    if (getSkillPoints() < skill.cost) return { ok: false, reason: "Не хватает очков навыков" };
    state.skills.push(id);
    save();
    return { ok: true, skill: clone(skill) };
  }

  function resetSkills() {
    state.skills = [];
    save();
  }

  function getBonuses() {
    return {
      movementMultiplier: hasSkill("quick_paws") ? 1.12 : 1,
      basketBonus: hasSkill("wide_basket") ? 18 : 0,
      dashEnabled: hasSkill("dash"),
      timeInstinct: hasSkill("time_instinct"),
      missGuard: hasSkill("afterimage") ? 1 : 0,
      startingShield: hasSkill("start_shield") ? 1 : 0,
      bombPenalty: hasSkill("padded_basket") ? 2 : 5,
      rottenPenalty: hasSkill("clean_snout") ? 1 : 3,
      maxShield: hasSkill("reinforced_shield") ? 3 : 2,
      extraLife: hasSkill("extra_heart") ? 1 : 0,
      startingFever: hasSkill("warm_start") ? 25 : 0,
      feverGainMultiplier: hasSkill("spark") ? 1.3 : 1,
      goldBonus: hasSkill("golden_touch") ? 0.045 : 0,
      feverDuration: hasSkill("long_fever") ? 10 : 7,
      comboGuard: hasSkill("steady_rhythm") ? 1 : 0
    };
  }

  function getUnlockedGadgets() {
    return GADGETS.filter(gadget => gadget.unlockLevel <= state.unlockedLevel);
  }

  function selectGadget(id) {
    if (!getUnlockedGadgets().some(gadget => gadget.id === id)) return false;
    state.selectedGadget = id;
    save();
    return true;
  }

  function getSelectedGadget() {
    return GADGETS.find(gadget => gadget.id === state.selectedGadget) || GADGETS[0];
  }

  function unlockAvailableCosmetics() {
    const unlocked = [];
    const totalStars = getTotalStars();
    for (const cosmetic of COSMETICS) {
      if (state.ownedCosmetics.includes(cosmetic.id)) continue;
      const rule = cosmetic.unlock;
      const available = rule.type === "start" ||
        (rule.type === "level" && state.unlockedLevel > rule.value) ||
        (rule.type === "stars" && totalStars >= rule.value);
      if (!available) continue;
      state.ownedCosmetics.push(cosmetic.id);
      unlocked.push(cosmetic);
    }
    return unlocked;
  }

  function selectCosmetic(id) {
    const cosmetic = COSMETICS.find(item => item.id === id);
    if (!cosmetic || !state.ownedCosmetics.includes(id)) return false;
    state.selectedCosmetics[cosmetic.type] = id;
    save();
    return true;
  }

  function objectiveComplete(level, round) {
    const objective = level.objective;
    if (objective.type === "boss") return Boolean(round.bossDefeated);
    if (round.endReason === "lives") return false;
    if (objective.type === "score") return round.score >= objective.target;
    if (objective.type === "caught") return round.caught >= objective.target;
    if (objective.type === "gold") return round.goldenCaught >= objective.target;
    if (objective.type === "combo") return round.maxCombo >= objective.target;
    if (objective.type === "survive") return round.endReason === "time";
    if (objective.type === "clean") return round.caught >= objective.target && round.bombsCaught === 0;
    if (objective.type === "fever") return round.feverActivations >= objective.target;
    return false;
  }

  function calculateStars(level, round, completed) {
    if (!completed) return 0;
    let stars = 1;
    if (round.score >= level.starScores[1]) stars = 2;
    if (round.score >= level.starScores[2] && round.bombsCaught === 0 && round.missed <= Math.max(2, 6 - level.zoneIndex)) stars = 3;
    if (level.boss && round.bossDefeated) {
      stars = 1;
      if ((round.remainingLives || 0) >= 2) stars = 2;
      if ((round.remainingLives || 0) >= 3 && round.bombsCaught === 0) stars = 3;
    }
    return stars;
  }

  function getActiveEvent(date = new Date()) {
    const month = date.getMonth();
    const day = date.getDate();
    const birthday = EVENTS.find(event => event.month === month && event.days?.includes(day));
    if (birthday) return clone(birthday);
    const purple = EVENTS.find(event => event.id === "purple_week" && event.specialDays.includes(day));
    if (purple) return clone(purple);
    return clone(EVENTS.find(event => event.months?.includes(month)) || EVENTS[0]);
  }

  function advanceEvent(level) {
    const event = getActiveEvent();
    const progress = state.eventProgress[event.id] || { points: 0, claimed: [] };
    progress.points += level.boss ? 3 : 1;
    const unlocked = [];
    [2, 5, 9].forEach((target, index) => {
      if (progress.points < target || progress.claimed.includes(index)) return;
      progress.claimed.push(index);
      const cosmeticId = event.rewards[index];
      if (cosmeticId && !state.ownedCosmetics.includes(cosmeticId)) {
        state.ownedCosmetics.push(cosmeticId);
        const cosmetic = COSMETICS.find(item => item.id === cosmeticId);
        if (cosmetic) unlocked.push(cosmetic);
      }
    });
    state.eventProgress[event.id] = progress;
    return { event, progress: clone(progress), unlocked };
  }

  function completeLevel(levelOrId, round) {
    const level = getLevel(levelOrId);
    const completed = objectiveComplete(level, round);
    const stars = calculateStars(level, round, completed);
    const previous = state.levels[level.id] || { stars: 0, bestScore: 0, completed: false };
    const firstCompletion = completed && !previous.completed;
    state.levels[level.id] = {
      completed: previous.completed || completed,
      stars: Math.max(previous.stars || 0, stars),
      bestScore: Math.max(previous.bestScore || 0, Math.max(0, Math.round(round.score || 0)))
    };
    if (completed && level.number < 40) state.unlockedLevel = Math.max(state.unlockedLevel, level.number + 1);
    if (completed && level.number === 40) state.unlockedLevel = 40;
    state.selectedLevel = Math.min(40, Math.max(state.selectedLevel, completed ? level.number + 1 : level.number));

    const eventResult = firstCompletion ? advanceEvent(level) : { event: getActiveEvent(), progress: null, unlocked: [] };
    const unlockedCosmetics = [...unlockAvailableCosmetics(), ...eventResult.unlocked];
    save();
    return {
      completed,
      stars,
      previousStars: previous.stars || 0,
      firstCompletion,
      unlockedLevel: state.unlockedLevel,
      unlockedCosmetics,
      event: eventResult.event,
      eventProgress: eventResult.progress
    };
  }

  function selectLevel(levelNumber) {
    const number = Number(levelNumber);
    if (!Number.isInteger(number) || number < 1 || number > state.unlockedLevel) return false;
    state.selectedLevel = number;
    save();
    return true;
  }

  function getStoryKeyForLevel(levelOrId) {
    const level = getLevel(levelOrId);
    if (level.number === 1) return "intro";
    if ([9, 17, 25, 33].includes(level.number)) return level.zoneId;
    return null;
  }

  function getPendingStory(levelOrId) {
    const key = getStoryKeyForLevel(levelOrId);
    if (!key || state.seenStories.includes(key)) return null;
    return { key, lines: clone(STORIES[key] || []) };
  }

  function getEndingStory() {
    if (!state.levels["citadel-8"]?.completed || state.seenStories.includes("ending")) return null;
    return { key: "ending", lines: clone(STORIES.ending) };
  }

  function markStorySeen(key) {
    if (!STORIES[key] || state.seenStories.includes(key)) return;
    state.seenStories.push(key);
    save();
  }

  function getAdventureMode() {
    const level = getLevel();
    const event = getActiveEvent();
    const eventModifiers = {
      spring_garden: { speed: 0.96, spawn: 1, bomb: -0.018, gold: 0.01, label: "Весенний сад: меньше бомб" },
      purple_week: { speed: 1.05, spawn: 0.93, bomb: 0, gold: 0.025, label: "Фиолетовая неделя: быстрый урожай" },
      autumn_harvest: { speed: 1, spawn: 0.96, bomb: 0, gold: 0.035, label: "Осенний урожай: больше золотых" },
      winter_festival: { speed: 0.91, spawn: 1.04, bomb: 0, gold: 0.02, label: "Зимний фестиваль: снежное замедление" },
      capy_birthday: { speed: 1, spawn: 0.88, bomb: -0.01, gold: 0.05, label: "День рождения: праздничный дождь" }
    };
    const eventModifier = eventModifiers[event.id] || { speed: 1, spawn: 1, bomb: 0, gold: 0, label: event.name };
    return {
      id: "adventure",
      name: `Уровень ${level.number}: ${level.title}`,
      shortName: `Ур. ${level.number}`,
      description: level.objectiveText,
      duration: level.duration,
      lives: level.lives,
      speedMultiplier: level.speedMultiplier * eventModifier.speed,
      spawnMultiplier: level.spawnMultiplier * eventModifier.spawn,
      bombBonus: level.bombBonus + eventModifier.bomb,
      goldBonus: level.goldBonus + eventModifier.gold,
      rewardMultiplier: 1.2,
      adventure: true,
      level,
      event,
      eventModifier
    };
  }

  function getProgressSummary() {
    const completed = Object.values(state.levels).filter(result => result.completed).length;
    const event = getActiveEvent();
    const eventProgress = state.eventProgress[event.id] || { points: 0, claimed: [] };
    return {
      completed,
      total: LEVELS.length,
      stars: getTotalStars(),
      maxStars: LEVELS.length * 3,
      skillPoints: getSkillPoints(),
      event,
      eventProgress: clone(eventProgress)
    };
  }

  function reset() {
    state = defaultState();
    save();
  }

  return {
    zones: ZONES,
    levels: LEVELS,
    skills: SKILLS,
    gadgets: GADGETS,
    cosmetics: COSMETICS,
    events: EVENTS,
    stories: STORIES,
    getState: () => clone(state),
    getLevel,
    getZone,
    getAdventureMode,
    getProgressSummary,
    getTotalStars,
    getSkillPoints,
    getBonuses,
    getUnlockedGadgets,
    getSelectedGadget,
    selectGadget,
    selectLevel,
    unlockSkill,
    resetSkills,
    selectCosmetic,
    completeLevel,
    getActiveEvent,
    getPendingStory,
    getEndingStory,
    markStorySeen,
    reset
  };
})();
