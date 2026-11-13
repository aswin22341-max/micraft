import React from 'react';
import { RotateCcw, Home } from 'lucide-react';
import { soundEngine } from '../game/audio';

interface DeathModalProps {
  onRespawn: () => void;
  onMainMenu: () => void;
}

export const DeathModal: React.FC<DeathModalProps> = ({ onRespawn, onMainMenu }) => {
  return (
    <div className="fixed inset-0 z-40 bg-rose-950/80 flex items-center justify-center p-4">
      <div className="bg-stone-950 border border-rose-800/70 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
        <h2 className="font-display text-3xl font-bold text-rose-400">You Died</h2>
        <p className="text-xs text-stone-300">
          Your adventure continues. Respawn nearby or return to the main menu.
        </p>
        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onRespawn();
            }}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Respawn
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onMainMenu();
            }}
            className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-medium text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Save & Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
