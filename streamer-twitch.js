"use strict";

window.CapyStreamer = (() => {
  const VALID_COMMANDS = new Set(["start", "left", "right", "drop", "gold", "bomb", "shield"]);

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function connect() {
    emit("capycatch:stream-status", {
      status: "error",
      message: "Подключение к чату доступно только в стримерской версии сайта",
      channel: ""
    });
    return false;
  }

  function simulate(command) {
    if (!VALID_COMMANDS.has(command)) return;
    emit("capycatch:chat-command", {
      command,
      username: "Тестовый зритель",
      login: "local_test",
      source: "test"
    });
  }

  function creditViewer(username, points) {
    if (!username || points <= 0) return;
    const score = window.CapyProgression.addViewerPoints(username, points);
    emit("capycatch:viewer-score", { username, score });
  }

  return {
    connect,
    disconnect: () => {},
    simulate,
    creditViewer,
    isConnected: () => false,
    isConnecting: () => false,
    isObsMode: () => false,
    setObsMode: () => false,
    getObsLink: () => ""
  };
})();
