"use strict";

window.CapyStreamer = (() => {
  const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";
  const VALID_COMMANDS = new Set(["start", "left", "right", "drop", "gold", "bomb", "shield"]);
  const userCooldowns = new Map();
  let socket = null;
  let connected = false;
  let connecting = false;
  let currentChannel = "";
  let globalCommandAt = 0;

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function setStatus(status, message) {
    connected = status === "connected";
    connecting = status === "connecting";
    emit("capycatch:stream-status", { status, message, channel: currentChannel });
  }

  function normalizeToken(value) {
    const clean = String(value || "").trim();
    if (!clean) return "";
    return clean.startsWith("oauth:") ? clean : `oauth:${clean}`;
  }

  function parseTags(rawTags) {
    const result = {};
    for (const pair of String(rawTags || "").split(";")) {
      const separator = pair.indexOf("=");
      if (separator < 0) continue;
      result[pair.slice(0, separator)] = pair.slice(separator + 1)
        .replace(/\\s/g, " ")
        .replace(/\\:/g, ";")
        .replace(/\\r/g, "\r")
        .replace(/\\n/g, "\n")
        .replace(/\\\\/g, "\\");
    }
    return result;
  }

  function parsePrivmsg(line) {
    const match = line.match(/^@([^ ]+) :([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.*)$/);
    if (!match) return null;
    const tags = parseTags(match[1]);
    return {
      username: tags["display-name"] || match[2],
      login: match[2].toLowerCase(),
      userId: tags["user-id"] || "",
      message: match[3].trim(),
      badges: tags.badges || "",
      rewardId: tags["custom-reward-id"] || ""
    };
  }

  function commandAllowed(user, command) {
    const now = Date.now();
    const userKey = `${user.login}:${command}`;
    const cooldown = command === "drop" || command === "gold" || command === "bomb" || command === "shield" ? 12000 : 3000;
    if (now - Number(userCooldowns.get(userKey) || 0) < cooldown) return false;
    if (now - globalCommandAt < 650) return false;
    userCooldowns.set(userKey, now);
    globalCommandAt = now;
    return true;
  }

  function handleChatMessage(user) {
    const match = user.message.toLowerCase().match(/^!(start|left|right|drop|gold|bomb|shield)\b/);
    if (!match) return;
    const command = match[1];
    if (command === "start" && !user.rewardId && !/broadcaster\/1|moderator\/1/.test(user.badges)) return;
    if (!VALID_COMMANDS.has(command) || !commandAllowed(user, command)) return;
    emit("capycatch:chat-command", { command, username: user.username, login: user.login, source: "twitch" });
  }

  function handleIrcPayload(payload) {
    for (const line of String(payload || "").split("\r\n")) {
      if (!line) continue;
      if (line.startsWith("PING")) {
        socket?.send(line.replace("PING", "PONG"));
        continue;
      }
      if (line.includes(" 001 ")) {
        setStatus("connected", `Подключено к #${currentChannel}`);
        continue;
      }
      if (line.includes("NOTICE") && /authentication failed|login authentication failed/i.test(line)) {
        setStatus("error", "Twitch отклонил логин или OAuth-токен");
        socket?.close();
        continue;
      }
      if (line.includes(" RECONNECT ")) {
        setStatus("error", "Twitch попросил переподключиться");
        socket?.close();
        continue;
      }
      const message = parsePrivmsg(line);
      if (message) handleChatMessage(message);
    }
  }

  function connect({ channel, username, token }) {
    if (connecting || connected) disconnect();

    currentChannel = String(channel || "").replace(/^#/, "").trim().toLowerCase();
    const cleanUsername = String(username || "").trim().toLowerCase();
    const cleanToken = normalizeToken(token);
    if (!currentChannel || !cleanUsername || !cleanToken) {
      setStatus("error", "Заполни канал, логин и OAuth-токен");
      return false;
    }

    window.CapyProgression.setTwitchIdentity(currentChannel, cleanUsername);
    setStatus("connecting", "Подключаемся к Twitch...");

    try {
      socket = new WebSocket(IRC_URL);
      socket.addEventListener("open", () => {
        socket.send(`PASS ${cleanToken}`);
        socket.send(`NICK ${cleanUsername}`);
        socket.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
        socket.send(`JOIN #${currentChannel}`);
      });
      socket.addEventListener("message", event => handleIrcPayload(event.data));
      socket.addEventListener("error", () => setStatus("error", "Ошибка соединения с Twitch"));
      socket.addEventListener("close", () => {
        const wasConnected = connected;
        connected = false;
        connecting = false;
        socket = null;
        if (wasConnected) setStatus("disconnected", "Twitch-чат отключён");
      });
      return true;
    } catch {
      setStatus("error", "Браузер не смог открыть соединение с Twitch");
      return false;
    }
  }

  function disconnect() {
    if (socket) {
      try {
        socket.close(1000, "CapyCatch disconnect");
      } catch {
        // Соединение уже закрыто.
      }
    }
    socket = null;
    connected = false;
    connecting = false;
    setStatus("disconnected", "Twitch-чат отключён");
  }

  function simulate(command) {
    if (!VALID_COMMANDS.has(command)) return;
    emit("capycatch:chat-command", { command, username: "Тестовый зритель", login: "local_test", source: "test" });
  }

  function creditViewer(username, points) {
    if (!username || points <= 0) return;
    const score = window.CapyProgression.addViewerPoints(username, points);
    emit("capycatch:viewer-score", { username, score });
  }

  function isObsMode() {
    return new URLSearchParams(location.search).get("obs") === "1";
  }

  function setObsMode(enabled) {
    const url = new URL(location.href);
    if (enabled) url.searchParams.set("obs", "1");
    else url.searchParams.delete("obs");
    history.replaceState({}, "", url);
    document.body.classList.toggle("obs-mode", enabled);
    document.documentElement.classList.toggle("obs-mode", enabled);
    emit("capycatch:obs-mode", { enabled });
    return enabled;
  }

  function getObsLink() {
    const url = new URL(location.href);
    url.searchParams.set("obs", "1");
    return url.toString();
  }

  document.body.classList.toggle("obs-mode", isObsMode());
  document.documentElement.classList.toggle("obs-mode", isObsMode());

  return {
    connect,
    disconnect,
    simulate,
    creditViewer,
    isConnected: () => connected,
    isConnecting: () => connecting,
    isObsMode,
    setObsMode,
    getObsLink
  };
})();
