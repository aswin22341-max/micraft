import React, { useState } from 'react';
import { BookOpen, FolderOpen, Play, Plus, Power, Settings } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { WorldMeta } from '../game/types';

interface MainMenuProps {
  worlds: WorldMeta[];
  onPlayQuick: () => void;
  onOpenWorlds: () => void;
  onCreateNew: () => void;
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  worlds,
  onPlayQuick,
  onOpenWorlds,
  onCreateNew,
  onOpenSettings,
  onOpenHowToPlay,
}) => {
  const [exited, setExited] = useState(false);

  if (exited) {
    return (
      <div className="fixed inset-0 z-20 bg-stone-950/92 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="font-display text-4xl font-bold text-stone-100 mb-2">Block World</h1>
        <p className="text-sm text-stone-400 mb-6">
          Your worlds and settings are safely stored in your browser.
        </p>
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setExited(false);
          }}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg cursor-pointer"
        >
          Return to Title Screen
        </button>
      </div>
    );
  }

  const latest = worlds[0];

  return (
    <div className="fixed inset-0 z-20 bg-gradient-to-b from-black/45 via-black/35 to-black/75 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-stone-950/90 border border-white/15 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-7">
          <h1 className="font-display text-5xl font-bold tracking-tight text-white">
            BLOCK WORLD
          </h1>
          <p className="text-xs text-stone-300 mt-2">
            Procedural 3D Voxel Sandbox · Mining, Crafting & Survival
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onPlayQuick();
            }}
            className="w-full py-3 px-5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-xl flex items-center justify-center gap-2.5 cursor-pointer transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            {latest ? `PLAY — ${latest.name}` : 'PLAY'}
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onCreateNew();
              }}
              className="py-2.5 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-100 font-medium text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              CREATE NEW WORLD
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenWorlds();
              }}
              className="py-2.5 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-100 font-medium text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
            >
              <FolderOpen className="w-4 h-4 text-amber-400" />
              LOAD WORLDS ({worlds.length})
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenSettings();
              }}
              className="py-2.5 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-medium text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Settings className="w-4 h-4" />
              SETTINGS
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenHowToPlay();
              }}
              className="py-2.5 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-medium text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              HOW TO PLAY
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setExited(true);
            }}
            className="w-full py-2.5 px-4 bg-stone-950 hover:bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 font-medium text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Power className="w-4 h-4" />
            EXIT
          </button>
        </div>
      </div>
    </div>
  );
};
