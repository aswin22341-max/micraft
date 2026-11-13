import { DEFAULT_SETTINGS, GameSettings, SaveWorldData, WorldMeta } from './types';

const SETTINGS_KEY = 'block_world_settings_v1';
const DB_NAME = 'block_world_db_v1';
const STORE_NAME = 'worlds';

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'meta.id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveWorld(world: SaveWorldData): Promise<void> {
  world.meta.lastPlayed = Date.now();
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(world);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback to localStorage if IndexedDB is unavailable
    try {
      localStorage.setItem(`bw_world_${world.meta.id}`, JSON.stringify(world));
    } catch {
      // ignore
    }
  }
}

export async function loadWorld(worldId: string): Promise<SaveWorldData | null> {
  try {
    const db = await openDB();
    const res = await new Promise<SaveWorldData | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(worldId);
      req.onsuccess = () => resolve(req.result as SaveWorldData | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (res) return res;
  } catch {
    // fallback below
  }
  try {
    const raw = localStorage.getItem(`bw_world_${worldId}`);
    return raw ? (JSON.parse(raw) as SaveWorldData) : null;
  } catch {
    return null;
  }
}

export async function listWorlds(): Promise<WorldMeta[]> {
  try {
    const db = await openDB();
    const all = await new Promise<SaveWorldData[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as SaveWorldData[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all.map((w) => w.meta).sort((a, b) => b.lastPlayed - a.lastPlayed);
  } catch {
    const metas: WorldMeta[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('bw_world_')) {
        try {
          const w = JSON.parse(localStorage.getItem(key) || '') as SaveWorldData;
          if (w?.meta) metas.push(w.meta);
        } catch {
          // skip
        }
      }
    }
    return metas.sort((a, b) => b.lastPlayed - a.lastPlayed);
  }
}

export async function deleteWorld(worldId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(worldId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
  localStorage.removeItem(`bw_world_${worldId}`);
}
