import { useCallback, useEffect, useRef, useState } from 'react';
import { CreateWorldModal } from './components/CreateWorldModal';
import { DeathModal } from './components/DeathModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { HUD } from './components/HUD';
import { InventoryModal } from './components/InventoryModal';
import { MainMenu } from './components/MainMenu';
import { MenuBackdrop } from './components/MenuBackdrop';
import { PauseMenu } from './components/PauseMenu';
import { SettingsModal } from './components/SettingsModal';
import { WorldsModal } from './components/WorldsModal';
import { VoxelGameEngine } from './game/engine';
import { deleteWorld, listWorlds, loadSettings, loadWorld, saveSettings, saveWorld } from './game/storage';
import {
  Difficulty,
  FurnaceState,
  GameMode,
  GameSettings,
  HudSnapshot,
  InventorySlot,
  SaveWorldData,
  WorldMeta,
} from './game/types';

function createEmptyInventory(mode: GameMode): InventorySlot[] {
  const slots: InventorySlot[] = Array.from({ length: 36 }, () => ({ itemId: null, count: 0 }));
  if (mode === 'creative') {
    const starter = [
      'grass',
      'stone',
      'wood',
      'planks',
      'cobblestone',
      'glass',
      'torch',
      'crafting_table',
      'diamond_sword',
    ];
    starter.forEach((id, i) => {
      slots[i] = { itemId: id, count: id === 'diamond_sword' ? 1 : 64 };
    });
  } else {
    slots[0] = { itemId: 'wooden_pickaxe', count: 1 };
    slots[1] = { itemId: 'torch', count: 6 };
    slots[2] = { itemId: 'apple', count: 3 };
  }
  return slots;
}

function buildNewWorldData(opts: {
  name: string;
  seed: string;
  mode: GameMode;
  difficulty: Difficulty;
}): SaveWorldData {
  const now = Date.now();
  return {
    meta: {
      id: `world_${now}_${Math.random().toString(36).slice(2, 7)}`,
      name: opts.name,
      seed: opts.seed,
      mode: opts.mode,
      difficulty: opts.difficulty,
      createdAt: now,
      lastPlayed: now,
    },
    player: {
      x: 8.5,
      y: -1, // Engine resolves safe surface height on spawn
      z: 8.5,
      yaw: 0,
      pitch: -0.1,
      health: 20,
      hunger: 20,
      selectedSlot: 0,
    },
    inventory: createEmptyInventory(opts.mode),
    modifiedBlocks: {},
    furnaces: {},
    timeOfDay: 0.22,
  };
}

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'playing'>('menu');
  const [worlds, setWorlds] = useState<WorldMeta[]>([]);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [activeWorld, setActiveWorld] = useState<SaveWorldData | null>(null);

  // Sub-modals
  const [showCreate, setShowCreate] = useState(false);
  const [showWorlds, setShowWorlds] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  // In-game states
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [inventoryPanel, setInventoryPanel] = useState<{
    mode: 'inventory' | 'crafting' | 'furnace';
    furnaceKey?: string;
  } | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelGameEngine | null>(null);
  const inventoryOpenRef = useRef(false);
  const pausedRef = useRef(false);

  inventoryOpenRef.current = Boolean(inventoryPanel);
  pausedRef.current = isPaused;

  const refreshWorldList = useCallback(async () => {
    const list = await listWorlds();
    setWorlds(list);
  }, []);

  useEffect(() => {
    refreshWorldList();
  }, [refreshWorldList]);

  // Mount Three.js engine once per active world session
  useEffect(() => {
    if (screen !== 'playing' || !activeWorld || !canvasMountRef.current) return;

    const engine = new VoxelGameEngine(canvasMountRef.current, activeWorld, settings, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onPointerLockChange: (locked) => {
        setIsLocked(locked);
        if (!locked && !inventoryOpenRef.current && !engine.isDead) {
          setIsPaused(true);
          engine.setPaused(true);
        }
      },
      onOpenInventory: (mode, furnaceKey) => {
        engine.setPaused(true);
        setIsPaused(false);
        setInventoryPanel({ mode, furnaceKey });
      },
      onPauseRequest: () => {
        engine.setPaused(true);
        setIsPaused(true);
      },
    });

    engineRef.current = engine;
    engine.emitHud();

    // Auto-save every 30 seconds
    const saveInterval = window.setInterval(() => {
      const data = engine.exportSaveData();
      saveWorld(data).catch(() => {});
    }, 30000);

    return () => {
      clearInterval(saveInterval);
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, activeWorld?.meta.id]);

  // WebGL context safety listener
  useEffect(() => {
    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener('webglcontextlost', onContextLost);
    return () => window.removeEventListener('webglcontextlost', onContextLost);
  }, []);

  const handleStartWorld = async (data: SaveWorldData) => {
    await saveWorld(data);
    await refreshWorldList();
    setShowCreate(false);
    setShowWorlds(false);
    setIsPaused(false);
    setInventoryPanel(null);
    setActiveWorld(data);
    setScreen('playing');
  };

  const handlePlayQuick = async () => {
    if (worlds.length > 0) {
      const loaded = await loadWorld(worlds[0].id);
      if (loaded) {
        await handleStartWorld(loaded);
        return;
      }
    }
    const fresh = buildNewWorldData({
      name: 'Frontier World',
      seed: String(Math.floor(100000 + Math.random() * 900000)),
      mode: 'survival',
      difficulty: 'normal',
    });
    await handleStartWorld(fresh);
  };

  const handleLoadWorld = async (worldId: string) => {
    const loaded = await loadWorld(worldId);
    if (loaded) {
      await handleStartWorld(loaded);
    }
  };

  const handleDeleteWorld = async (worldId: string) => {
    await deleteWorld(worldId);
    await refreshWorldList();
  };

  const handleSaveSettings = (next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    engineRef.current?.updateSettings(next);
  };

  const handleResume = () => {
    if (!engineRef.current) return;
    setIsPaused(false);
    setInventoryPanel(null);
    engineRef.current.setPaused(false);
    engineRef.current.requestPointerLock();
  };

  const handleManualSave = async () => {
    if (!engineRef.current) return;
    const data = engineRef.current.exportSaveData();
    await saveWorld(data);
    await refreshWorldList();
    setSaveStatus('Saved!');
    setTimeout(() => setSaveStatus(null), 1800);
  };

  const handleSaveAndQuit = async () => {
    if (engineRef.current) {
      const data = engineRef.current.exportSaveData();
      await saveWorld(data);
      await refreshWorldList();
    }
    setIsPaused(false);
    setInventoryPanel(null);
    setHud(null);
    setActiveWorld(null);
    setScreen('menu');
  };

  const handleInventoryUpdate = (
    newInv: InventorySlot[],
    furnaceKey?: string,
    newFurnace?: FurnaceState
  ) => {
    if (!engineRef.current) return;
    const nextFurnaces = { ...engineRef.current.furnaces };
    if (furnaceKey && newFurnace) {
      nextFurnaces[furnaceKey] = newFurnace;
    }
    engineRef.current.syncInventoryFromUI(newInv, nextFurnaces);
  };

  const handleCloseInventory = () => {
    setInventoryPanel(null);
    if (engineRef.current) {
      engineRef.current.setPaused(false);
      engineRef.current.requestPointerLock();
    }
  };

  return (
    <div className="relative w-full h-full bg-stone-950 overflow-hidden">
      {screen === 'menu' && (
        <>
          <MenuBackdrop />
          <MainMenu
            worlds={worlds}
            onPlayQuick={handlePlayQuick}
            onOpenWorlds={() => setShowWorlds(true)}
            onCreateNew={() => setShowCreate(true)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenHowToPlay={() => setShowHowTo(true)}
          />
        </>
      )}

      {screen === 'playing' && (
        <>
          <div
            ref={canvasMountRef}
            onClick={() => {
              if (!isLocked && !isPaused && !inventoryPanel && !hud?.isDead) {
                engineRef.current?.requestPointerLock();
              }
            }}
            className="w-full h-full cursor-crosshair"
          />

          {hud && (
            <HUD
              hud={hud}
              isLocked={isLocked}
              onSelectSlot={(idx) => engineRef.current?.setSelectedSlot(idx)}
            />
          )}

          {/* Prompt when freshly spawned and pointer not locked yet */}
          {!isLocked && !isPaused && !inventoryPanel && !hud?.isDead && (
            <div className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none">
              <button
                type="button"
                onClick={() => engineRef.current?.requestPointerLock()}
                className="pointer-events-auto px-6 py-3 bg-stone-950/90 hover:bg-stone-900 border border-amber-400/60 text-stone-100 rounded-xl shadow-2xl text-sm font-semibold cursor-pointer transition-colors"
              >
                Click to Enter World & Lock Mouse
              </button>
            </div>
          )}

          {inventoryPanel && engineRef.current && (
            <InventoryModal
              mode={inventoryPanel.mode}
              gameMode={activeWorld?.meta.mode || 'survival'}
              inventory={engineRef.current.inventory}
              furnaceKey={inventoryPanel.furnaceKey}
              furnace={
                inventoryPanel.furnaceKey
                  ? engineRef.current.furnaces[inventoryPanel.furnaceKey]
                  : undefined
              }
              onUpdate={handleInventoryUpdate}
              onClose={handleCloseInventory}
            />
          )}

          {isPaused && !inventoryPanel && !hud?.isDead && (
            <PauseMenu
              worldName={activeWorld?.meta.name || 'Block World'}
              saveStatus={saveStatus}
              onResume={handleResume}
              onSaveWorld={handleManualSave}
              onOpenSettings={() => setShowSettings(true)}
              onOpenHowToPlay={() => setShowHowTo(true)}
              onSaveAndQuit={handleSaveAndQuit}
            />
          )}

          {hud?.isDead && (
            <DeathModal
              onRespawn={() => engineRef.current?.respawnPlayer()}
              onMainMenu={handleSaveAndQuit}
            />
          )}
        </>
      )}

      {showCreate && (
        <CreateWorldModal
          onCreate={(opts) => handleStartWorld(buildNewWorldData(opts))}
          onClose={() => setShowCreate(false)}
        />
      )}

      {showWorlds && (
        <WorldsModal
          worlds={worlds}
          onLoadWorld={handleLoadWorld}
          onDeleteWorld={handleDeleteWorld}
          onCreateNew={() => {
            setShowWorlds(false);
            setShowCreate(true);
          }}
          onClose={() => setShowWorlds(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
