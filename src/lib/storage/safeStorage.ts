/**
 * localStorage wrapper that never throws (private mode, blocked storage, SSR).
 * Falls back to an in-memory map so the game keeps working for the session.
 */
const memory = new Map<string, string>();

export const safeStorage: Storage = {
  get length() {
    try {
      return window.localStorage.length;
    } catch {
      return memory.size;
    }
  },
  clear() {
    try {
      window.localStorage.clear();
    } catch {
      memory.clear();
    }
  },
  getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  key(index) {
    try {
      return window.localStorage.key(index);
    } catch {
      return [...memory.keys()][index] ?? null;
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
};
