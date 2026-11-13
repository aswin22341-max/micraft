import React from 'react';
import { BookOpen, LogOut, Play, Save, Settings } from 'lucide-react';
import { soundEngine } from '../game/audio';

interface PauseMenuProps {
  worldName: string;
  saveStatus: string | null;
  onResume: () => void;
  onSaveWorld: () => void;
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
  onSaveAndQuit: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  worldName,
  saveStatus,
  onResume,
  onSaveWorld,
  onOpenSettings,
  onOpenHowToPlay,
  onSaveAndQuit,
}) => {
  return (
    <div className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-stone-950 border border-stone-700 rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-3">
        <div className="text-center mb-2">
          <h2 className="font-display text-2xl font-bold text-stone-100">Game Paused</h2>
          <p className="text-xs text-stone-400 mt-1">{worldName}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onResume();
          }}
          className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Play className="w-4 h-4 fill-current" />
          Resume Game
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onSaveWorld();
          }}
          className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-100 font-medium text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Save className="w-4 h-4" />
          {saveStatus || 'Save Progress'}
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onOpenSettings();
          }}
          className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-100 font-medium text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onOpenHowToPlay();
          }}
          className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-100 font-medium text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          How to Play
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onSaveAndQuit();
          }}
          className="w-full py-2.5 px-4 bg-stone-900 hover:bg-rose-950/60 border border-stone-700 hover:border-rose-700 text-stone-200 hover:text-rose-200 font-medium text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors mt-1"
        >
          <LogOut className="w-4 h-4" />
          Save & Quit to Menu
        </button>
      </div>
    </div>
  );
};
