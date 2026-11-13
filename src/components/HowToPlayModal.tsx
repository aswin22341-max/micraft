import React from 'react';
import { X } from 'lucide-react';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  const controls = [
    ['W / A / S / D', 'Move around'],
    ['Mouse', 'Look around (click viewport to lock pointer)'],
    ['Left Click', 'Mine blocks or attack mobs'],
    ['Right Click', 'Place blocks, eat food, or open Crafting Table / Furnace'],
    ['Space', 'Jump or swim upward (double-tap in Creative to fly)'],
    ['Shift / Ctrl', 'Sprint / Crouch (prevents falling off ledges)'],
    ['1–9 / Scroll', 'Select hotbar item'],
    ['E', 'Open Inventory & 2×2 Crafting'],
    ['ESC', 'Unlock mouse & pause game'],
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-stone-950 border border-stone-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <h2 className="font-display text-xl font-bold text-stone-100">How to Play</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scroll space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-amber-300 mb-3">Controls</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {controls.map(([key, desc]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 bg-stone-900 border border-stone-800 rounded-lg px-3.5 py-2.5 text-xs"
                >
                  <span className="font-mono-num font-semibold text-stone-100 shrink-0">{key}</span>
                  <span className="text-stone-400 text-right">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-stone-100 mb-2">Crafting & Mining</h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                Chop Oak Trees to gather Wood, press E to craft Wooden Planks and a Crafting Table,
                then place the Crafting Table and right-click it for a 3×3 grid. Craft a Wooden
                Pickaxe to mine Stone and Coal, then upgrade to Stone and Iron tools to mine Gold
                and Diamonds deep underground.
              </p>
            </div>
            <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-stone-100 mb-2">Survival & Smelting</h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                Craft a Furnace from 8 Cobblestone to smelt Iron Ore, Gold Ore, and cook Raw Meat
                using Coal or Wood as fuel. Hunt Cows, Pigs, and Sheep or pick Apples from trees to
                keep your hunger bar full, and build shelter with Torches before nightfall when
                hostile mobs emerge.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-stone-900/50 border-t border-stone-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
