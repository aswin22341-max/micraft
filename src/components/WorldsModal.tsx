import React from 'react';
import { Play, Plus, Trash2, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { WorldMeta } from '../game/types';

interface WorldsModalProps {
  worlds: WorldMeta[];
  onLoadWorld: (worldId: string) => void;
  onDeleteWorld: (worldId: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

export const WorldsModal: React.FC<WorldsModalProps> = ({
  worlds,
  onLoadWorld,
  onDeleteWorld,
  onCreateNew,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-stone-950 border border-stone-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <h2 className="font-display text-xl font-bold text-stone-100">Saved Worlds</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onCreateNew();
              }}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New World
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scroll space-y-3">
          {worlds.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <p className="text-sm mb-4">No saved worlds yet. Create your first world to begin exploring.</p>
              <button
                type="button"
                onClick={onCreateNew}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg cursor-pointer"
              >
                Create New World
              </button>
            </div>
          ) : (
            worlds.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between p-4 bg-stone-900 border border-stone-800 rounded-xl hover:border-stone-700 transition-colors"
              >
                <div className="min-w-0 pr-4">
                  <div className="text-base font-semibold text-stone-100 truncate">{w.name}</div>
                  <div className="text-xs text-stone-400 flex items-center gap-2 mt-1">
                    <span className="capitalize text-amber-300">{w.mode}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{w.difficulty}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">Seed {w.seed}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(w.lastPlayed).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onLoadWorld(w.id);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Play
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onDeleteWorld(w.id);
                    }}
                    className="p-2 bg-stone-800 hover:bg-rose-600/20 text-stone-400 hover:text-rose-400 border border-stone-700 rounded-lg cursor-pointer transition-colors"
                    title="Delete World"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
