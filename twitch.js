"use strict";

window.CapyTwitch = (() => {
  const params = new URLSearchParams(window.location.search);
  const root = document.documentElement;
  const body = document.body;
  const active = root.classList.contains("twitch-panel")
    || params.get("anchor") === "panel"
    || params.get("platform") === "mobile"
    || params.get("twitch") === "panel";
  const context = {
    active,
    authorized: false,
    channelId: "",
    clientId: "",
    userId: "",
    theme: "dark",
    visible: true
  };

  function emit(name, detail = {}) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function setPanelClass() {
    root.classList.toggle("twitch-panel", active);
    body?.classList.toggle("twitch-panel", active);
  }

  function setTheme(theme) {
    context.theme = theme === "light" ? "light" : "dark";
    for (const element of [root, body]) {
      element?.classList.toggle("twitch-theme-light", context.theme === "light");
      element?.classList.toggle("twitch-theme-dark", context.theme === "dark");
    }
    emit("capycatch:twitch-context", { ...context });
  }

  setPanelClass();

  const extension = window.Twitch?.ext;
  if (active && extension) {
    extension.onAuthorized(auth => {
      context.authorized = true;
      context.channelId = String(auth?.channelId || "");
      context.clientId = String(auth?.clientId || "");
      context.userId = String(auth?.userId || "");
      emit("capycatch:twitch-authorized", { ...context });
    });

    extension.onContext?.(nextContext => {
      if (nextContext?.theme) setTheme(nextContext.theme);
    });

    extension.onVisibilityChanged?.(visible => {
      context.visible = Boolean(visible);
      emit("capycatch:twitch-visibility", { visible: context.visible });
    });

    extension.onError?.(error => {
      emit("capycatch:twitch-error", { message: String(error?.message || error || "Twitch Extension error") });
    });
  }

  return {
    isActive: () => active,
    getContext: () => ({ ...context })
  };
})();
