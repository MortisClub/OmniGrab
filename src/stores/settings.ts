import { create } from "zustand";
import { api } from "@/lib/ipc";

interface SettingsState {
  saveDir: string | null;
  proxy: string;
  cookiesBrowser: string;
  lastPreset: string;
  theme: "dark" | "light";
  autoUpdate: boolean;
  ytdlpVersion: string | null;
  updating: boolean;
  ready: boolean;
  init: () => Promise<void>;
  setSaveDir: (dir: string) => void;
  setProxy: (proxy: string) => void;
  setCookiesBrowser: (b: string) => void;
  setLastPreset: (p: string) => void;
  setTheme: (theme: "dark" | "light") => void;
  setAutoUpdate: (v: boolean) => void;
  refreshVersion: () => Promise<void>;
  updateNow: () => Promise<void>;
}

function load(): Partial<SettingsState> {
  try {
    return JSON.parse(localStorage.getItem("omnigrab-settings") ?? "{}");
  } catch {
    return {};
  }
}

function save(s: SettingsState) {
  localStorage.setItem(
    "omnigrab-settings",
    JSON.stringify({
      saveDir: s.saveDir,
      proxy: s.proxy,
      cookiesBrowser: s.cookiesBrowser,
      lastPreset: s.lastPreset,
      theme: s.theme,
      autoUpdate: s.autoUpdate,
    }),
  );
}

export const useSettings = create<SettingsState>((set, get) => ({
  saveDir: null,
  proxy: "",
  cookiesBrowser: "",
  lastPreset: "1080",
  theme: "dark",
  autoUpdate: true,
  ytdlpVersion: null,
  updating: false,
  ready: false,
  ...load(),

  init: async () => {
    const s = get();
    document.documentElement.classList.toggle("light", s.theme === "light");
    document.documentElement.classList.toggle("dark", s.theme !== "light");
    if (!s.saveDir) {
      try {
        const dir = await api.defaultSaveDir();
        if (dir) set({ saveDir: dir });
      } catch {
        /* dialogs unavailable in browser preview */
      }
    }
    set({ ready: true });
    get().refreshVersion();
  },

  setSaveDir: (dir) => {
    set({ saveDir: dir });
    save(get());
  },
  setProxy: (proxy) => {
    set({ proxy });
    save(get());
  },
  setCookiesBrowser: (cookiesBrowser) => {
    set({ cookiesBrowser });
    save(get());
  },
  setLastPreset: (lastPreset) => {
    set({ lastPreset });
    save(get());
  },
  setTheme: (theme) => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("dark", theme !== "light");
    set({ theme });
    save(get());
  },
  setAutoUpdate: (autoUpdate) => {
    set({ autoUpdate });
    save(get());
  },

  refreshVersion: async () => {
    try {
      set({ ytdlpVersion: await api.ytdlpVersion() });
    } catch {
      /* backend not running (browser preview) */
    }
  },

  updateNow: async () => {
    set({ updating: true });
    try {
      const info = await api.updateBinaries();
      set({ ytdlpVersion: info.ytdlpVersion });
    } finally {
      set({ updating: false });
    }
  },
}));
