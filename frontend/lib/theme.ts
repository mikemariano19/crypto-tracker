export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

// Runs in <head> before the page paints, so a dark-mode visitor never sees a
// white flash. With no saved choice it follows the OS setting, live.
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      var saved = localStorage.getItem("${THEME_STORAGE_KEY}");
      var dark = saved ? saved === "dark" : media.matches;
      document.documentElement.classList.toggle("dark", dark);
    }
    apply();
    media.addEventListener("change", apply);
  } catch (e) {}
})();`;

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice just won't survive a reload.
  }
}
