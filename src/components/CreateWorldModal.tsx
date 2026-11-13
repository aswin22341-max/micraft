import React, { useState } from 'react';
import { Dices, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { Difficulty, GameMode } from '../game/types';

interface CreateWorldModalProps {
  onCreate: (opts: { name: string; seed: string; mode: GameMode; difficulty: Difficulty }) => void;
  onClose: () => void;
}

export const CreateWorldModal: React.FC<CreateWorldModalProps> = ({ onCreate, onClose }) => {
  const [name, setName] = useState('New Frontier');
  const [seed, setSeed] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [mode, setMode] = useState<GameMode>('survival');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  const randomizeSeed = () => {
    soundEngine.playClick();
    setSeed(String(Math.floor(100000 + Math.random() * 900000)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    onCreate({
      name: name.trim() || 'Untitled World',
      seed: seed.trim() || 'blockworld',
      mode,
      difficulty,
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-stone-950 border border-stone-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <h2 className="font-display text-xl font-bold text-stone-100">Create New World</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1.5">World Name</label>
            <input
              type="text"
              value={name}
              maxLength={32}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-900 border border-stone-700 rounded-lg text-sm text-stone-100 focus:outline-none focus:border-amber-400"
              placeholder="Enter world name..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1.5">World Seed</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={seed}
                maxLength={24}
                onChange={(e) => setSeed(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-stone-900 border border-stone-700 rounded-lg text-sm font-mono-num text-stone-100 focus:outline-none focus:border-amber-400"
                placeholder="Seed string or number..."
              />
              <button
                type="button"
                onClick={randomizeSeed}
                className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-stone-200 flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                title="Randomize Seed"
              >
                <Dices className="w-4 h-4" />
                Random
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1.5">Game Mode</label>
            <div className="grid grid-cols-2 gap-2.5">
              {(['survival', 'creative'] as GameMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setMode(m);
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    mode === m
                      ? 'bg-amber-500/15 border-amber-400 text-stone-100'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <div className="text-sm font-semibold capitalize">{m} Mode</div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    {m === 'survival'
                      ? 'Health, hunger, mining & night mobs.'
                      : 'Unlimited blocks, instant break & flight.'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1.5">Difficulty</label>
            <div className="grid grid-cols-4 gap-2">
              {(['peaceful', 'easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setDifficulty(d);
                  }}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize cursor-pointer transition-colors ${
                    difficulty === d
                      ? 'bg-amber-500 text-stone-950 border-amber-400 font-semibold'
                      : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-stone-900/50 border-t border-stone-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-300 hover:text-white rounded-lg hover:bg-stone-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg cursor-pointer transition-colors"
          >
            Generate & Play
          </button>
        </div>
      </form>
    </div>
  );
};
