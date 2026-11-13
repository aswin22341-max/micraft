import React, { useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { GameSettings, GraphicsQuality } from '../game/types';

interface SettingsModalProps {
  settings: GameSettings;
  onSave: (next: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
  const [draft, setDraft] = useState<GameSettings>({ ...settings });
  const [isFs, setIsFs] = useState(() => Boolean(document.fullscreenElement));

  const toggleFullscreen = async () => {
    soundEngine.playClick();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFs(true);
      } else {
        await document.exitFullscreen();
        setIsFs(false);
      }
    } catch {
      // ignore if fullscreen blocked by sandbox iframe
    }
  };

  const applyAndClose = () => {
    soundEngine.playClick();
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-stone-950 border border-stone-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <h2 className="font-display text-xl font-bold text-stone-100">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Graphics Quality */}
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-2">
              Graphics Quality
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setDraft({ ...draft, graphicsQuality: q });
                  }}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize cursor-pointer ${
                    draft.graphicsQuality === q
                      ? 'bg-amber-500 text-stone-950 border-amber-400 font-semibold'
                      : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Render Distance */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-stone-300">Render Distance</span>
              <span className="font-mono-num text-amber-300">{draft.renderDistance} chunks</span>
            </div>
            <input
              type="range"
              min={2}
              max={6}
              step={1}
              value={draft.renderDistance}
              onChange={(e) => setDraft({ ...draft, renderDistance: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Field of View */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-stone-300">Field of View</span>
              <span className="font-mono-num text-amber-300">{draft.fov}°</span>
            </div>
            <input
              type="range"
              min={60}
              max={105}
              step={1}
              value={draft.fov}
              onChange={(e) => setDraft({ ...draft, fov: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Mouse Sensitivity */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-stone-300">Mouse Sensitivity</span>
              <span className="font-mono-num text-amber-300">{draft.mouseSensitivity.toFixed(1)}×</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={2.5}
              step={0.1}
              value={draft.mouseSensitivity}
              onChange={(e) => setDraft({ ...draft, mouseSensitivity: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Sound Volume */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-stone-300">Sound Volume</span>
              <span className="font-mono-num text-amber-300">
                {Math.round(draft.soundVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={draft.soundVolume}
              onChange={(e) => setDraft({ ...draft, soundVolume: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Fullscreen Mode */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-800">
            <div>
              <div className="text-xs font-medium text-stone-200">Fullscreen Mode</div>
              <div className="text-[11px] text-stone-400">Expand viewport to fill display</div>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 border border-stone-700 rounded-lg text-xs font-medium text-stone-200 flex items-center gap-2 cursor-pointer"
            >
              {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {isFs ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            </button>
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
            type="button"
            onClick={applyAndClose}
            className="px-6 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
