// Shared by the server layout (inline <script>) and the client theme hook.

export const THEME_STORAGE_KEY = "cq-theme";

/**
 * Runs before React hydrates (inlined in <head>), so the right theme is applied
 * on the first paint. It also follows the OS setting while the preference is "system".
 */
export const themeInitScript = `
(function () {
  var KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function pref() {
    try { return localStorage.getItem(KEY) || "system"; } catch (e) { return "system"; }
  }
  function apply() {
    var p = pref();
    var dark = p === "dark" || (p === "system" && mq.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
  apply();
  mq.addEventListener("change", apply);
  window.addEventListener("cq-theme-change", apply);
})();
`;
