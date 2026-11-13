import React from 'react';
import { BlockId, HudSnapshot, ITEM_DEFS } from '../game/types';
import { ItemIcon } from './ItemIcon';

interface HUDProps {
  hud: HudSnapshot;
  isLocked: boolean;
  onSelectSlot: (idx: number) => void;
}

export const HUD: React.FC<HUDProps> = ({ hud, isLocked, onSelectSlot }) => {
  const selectedItem = hud.inventory[hud.selectedSlot];
  const selectedName = selectedItem?.itemId ? ITEM_DEFS[selectedItem.itemId]?.name : null;

  // Format in-game clock (0.25 = 12:00 PM)
  const totalMinutes = Math.floor(((hud.timeOfDay + 0.25) % 1) * 24 * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const isNight = hud.timeOfDay > 0.55 || hud.timeOfDay < 0.02;

  const showInteractPrompt =
    hud.targetedBlock &&
    (hud.targetedBlock.blockId === BlockId.CraftingTable ||
      hud.targetedBlock.blockId === BlockId.Furnace);

  return (
    <div className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between">
      {/* Screen Damage / Underwater / Lava Tints */}
      {hud.inWater && (
        <div className="fixed inset-0 bg-sky-700/35 pointer-events-none transition-opacity duration-150" />
      )}
      {hud.inLava && (
        <div className="fixed inset-0 bg-orange-600/45 pointer-events-none transition-opacity duration-100" />
      )}
      {hud.hurtFlash > 0 && (
        <div
          className="fixed inset-0 bg-red-600 pointer-events-none"
          style={{ opacity: hud.hurtFlash * 0.38 }}
        />
      )}

      {/* Top Row: Clean static telemetry badge on left */}
      <div className="flex items-start justify-between p-4">
        <div className="bg-stone-950/75 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-stone-200 flex items-center gap-3 shadow-md">
          <span className="font-semibold text-amber-300">{hud.biome}</span>
          <span className="text-stone-500" aria-hidden="true">·</span>
          <span className="font-mono-num">
            Day {hud.dayCount} · {timeStr} ({isNight ? 'Night' : 'Day'})
          </span>
          <span className="text-stone-500" aria-hidden="true">·</span>
          <span className="font-mono-num text-stone-300">
            XYZ {hud.coords.x}, {hud.coords.y}, {hud.coords.z}
          </span>
          <span className="text-stone-500" aria-hidden="true">·</span>
          <span className="font-mono-num text-stone-400">{hud.fps} FPS</span>
        </div>

        <div className="bg-stone-950/75 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-stone-300 flex items-center gap-2.5">
          <span>E Inventory</span>
          <span className="text-stone-600" aria-hidden="true">·</span>
          <span>ESC Pause</span>
        </div>
      </div>

      {/* Center Crosshair & Block Target Hint */}
      <div className="flex flex-col items-center justify-center relative">
        {isLocked && (
          <div className="relative flex items-center justify-center">
            <div className="w-5 h-0.5 bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
            <div className="h-5 w-0.5 bg-white/90 absolute shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
          </div>
        )}

        {hud.breakProgress > 0 && (
          <div className="mt-4 w-24 h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/15">
            <div
              className="h-full bg-amber-400 transition-all duration-75"
              style={{ width: `${Math.min(100, Math.round(hud.breakProgress * 100))}%` }}
            />
          </div>
        )}

        {hud.targetedBlock && isLocked && (
          <div className="mt-6 text-xs font-medium text-stone-100 bg-stone-950/70 px-2.5 py-1 rounded border border-white/10">
            {hud.targetedBlock.name}
            {showInteractPrompt && (
              <span className="text-amber-300 ml-2">· Right-click to open</span>
            )}
          </div>
        )}
      </div>

      {/* Bottom: Survival Bars + 9-Slot Hotbar */}
      <div className="flex flex-col items-center pb-5 gap-2">
        {selectedName && (
          <div className="text-xs font-medium text-stone-100 bg-stone-950/70 px-3 py-1 rounded border border-white/10">
            {selectedName}
          </div>
        )}

        {hud.mode === 'survival' && (
          <div className="w-[468px] max-w-[94vw] flex items-center justify-between px-1">
            {/* Health Hearts (10 units = 20 HP) */}
            <div className="flex items-center gap-1" aria-label={`Health ${hud.health} of ${hud.maxHealth}`}>
              {Array.from({ length: 10 }).map((_, i) => {
                const hpForHeart = Math.max(0, Math.min(2, hud.health - i * 2));
                return (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-sm border border-black/80 flex items-center justify-center bg-stone-900/90 overflow-hidden"
                  >
                    <div
                      className={`h-full transition-all ${
                        hpForHeart === 2
                          ? 'w-full bg-rose-500'
                          : hpForHeart === 1
                            ? 'w-1/2 mr-auto bg-rose-500'
                            : 'w-0'
                      }`}
                    />
                  </div>
                );
              })}
              <span className="ml-1.5 text-[11px] font-mono-num text-rose-300 font-semibold">
                {Math.ceil(hud.health)}
              </span>
            </div>

            {/* Hunger Drumsticks (10 units = 20 hunger) */}
            <div className="flex items-center gap-1" aria-label={`Hunger ${hud.hunger} of ${hud.maxHunger}`}>
              <span className="mr-1.5 text-[11px] font-mono-num text-amber-300 font-semibold">
                {Math.ceil(hud.hunger)}
              </span>
              {Array.from({ length: 10 }).map((_, i) => {
                const foodForUnit = Math.max(0, Math.min(2, hud.hunger - (9 - i) * 2));
                return (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-sm border border-black/80 flex items-center justify-center bg-stone-900/90 overflow-hidden"
                  >
                    <div
                      className={`h-full transition-all ${
                        foodForUnit === 2
                          ? 'w-full bg-amber-500'
                          : foodForUnit === 1
                            ? 'w-1/2 ml-auto bg-amber-500'
                            : 'w-0'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 9-Slot Hotbar */}
        <div className="flex items-center gap-1 bg-stone-950/85 p-1.5 rounded-xl border border-white/15 shadow-2xl pointer-events-auto">
          {hud.inventory.slice(0, 9).map((slot, idx) => {
            const active = idx === hud.selectedSlot;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectSlot(idx)}
                className={`relative w-12 h-12 rounded-lg flex items-center justify-center transition-transform cursor-pointer ${
                  active
                    ? 'bg-amber-500/25 border-2 border-amber-400 scale-105'
                    : 'bg-stone-900/90 border border-white/10 hover:border-white/25'
                }`}
              >
                <span className="absolute top-0.5 left-1 text-[10px] font-mono-num text-stone-400">
                  {idx + 1}
                </span>
                {slot.itemId && slot.count > 0 && (
                  <ItemIcon itemId={slot.itemId} count={slot.count} size={32} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
