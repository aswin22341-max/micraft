import React, { useMemo, useState } from 'react';
import { Flame, Hammer, Package, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  CRAFTING_RECIPES,
  CraftingRecipe,
  getRecipeIngredients,
  matchCraftingRecipe,
} from '../game/recipes';
import { FurnaceState, GameMode, InventorySlot, ITEM_DEFS } from '../game/types';
import { ItemIcon } from './ItemIcon';

interface InventoryModalProps {
  mode: 'inventory' | 'crafting' | 'furnace';
  gameMode: GameMode;
  inventory: InventorySlot[];
  furnaceKey?: string;
  furnace?: FurnaceState;
  onUpdate: (newInventory: InventorySlot[], furnaceKey?: string, newFurnace?: FurnaceState) => void;
  onClose: () => void;
}

type SlotTarget =
  | { zone: 'inv'; index: number }
  | { zone: 'craft'; index: number }
  | { zone: 'furnace'; field: 'input' | 'fuel' | 'output' };

export const InventoryModal: React.FC<InventoryModalProps> = ({
  mode,
  gameMode,
  inventory,
  furnaceKey,
  furnace,
  onUpdate,
  onClose,
}) => {
  const gridSize: 2 | 3 = mode === 'crafting' ? 3 : 2;
  const [inv, setInv] = useState<InventorySlot[]>(() => inventory.map((s) => ({ ...s })));
  const [craftGrid, setCraftGrid] = useState<InventorySlot[]>(() =>
    Array.from({ length: gridSize * gridSize }, () => ({ itemId: null, count: 0 }))
  );
  const [furnaceState, setFurnaceState] = useState<FurnaceState | undefined>(() =>
    furnace ? JSON.parse(JSON.stringify(furnace)) : undefined
  );
  const [held, setHeld] = useState<InventorySlot>({ itemId: null, count: 0 });
  const [dragSource, setDragSource] = useState<SlotTarget | null>(null);
  const [activeTab, setActiveTab] = useState<'craft' | 'creative'>(
    gameMode === 'creative' && mode === 'inventory' ? 'creative' : 'craft'
  );

  const matchedRecipe = useMemo(
    () => matchCraftingRecipe(craftGrid.map((s) => s.itemId), gridSize),
    [craftGrid, gridSize]
  );

  const commit = (
    nextInv: InventorySlot[],
    nextCraft: InventorySlot[] = craftGrid,
    nextFurnace: FurnaceState | undefined = furnaceState
  ) => {
    setInv(nextInv);
    setCraftGrid(nextCraft);
    setFurnaceState(nextFurnace);
    onUpdate(nextInv, furnaceKey, nextFurnace);
  };

  const getSlot = (
    target: SlotTarget,
    curInv: InventorySlot[],
    curCraft: InventorySlot[],
    curFurnace?: FurnaceState
  ): InventorySlot => {
    if (target.zone === 'inv') return curInv[target.index];
    if (target.zone === 'craft') return curCraft[target.index];
    return curFurnace ? curFurnace[target.field] : { itemId: null, count: 0 };
  };

  const setSlot = (
    target: SlotTarget,
    val: InventorySlot,
    curInv: InventorySlot[],
    curCraft: InventorySlot[],
    curFurnace?: FurnaceState
  ) => {
    if (target.zone === 'inv') curInv[target.index] = val;
    else if (target.zone === 'craft') curCraft[target.index] = val;
    else if (curFurnace) curFurnace[target.field] = val;
  };

  const handleSlotClick = (target: SlotTarget, e: React.MouseEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    const isRight = e.button === 2;
    const nextInv = inv.map((s) => ({ ...s }));
    const nextCraft = craftGrid.map((s) => ({ ...s }));
    const nextFurnace = furnaceState ? JSON.parse(JSON.stringify(furnaceState)) : undefined;

    const slot = { ...getSlot(target, nextInv, nextCraft, nextFurnace) };

    // Prevent placing items directly into furnace output slot
    if (target.zone === 'furnace' && target.field === 'output' && held.itemId) {
      return;
    }

    if (!held.itemId) {
      if (!slot.itemId || slot.count <= 0) return;
      if (isRight && slot.count > 1) {
        const take = Math.ceil(slot.count / 2);
        setHeld({ itemId: slot.itemId, count: take });
        slot.count -= take;
        setSlot(target, slot, nextInv, nextCraft, nextFurnace);
      } else {
        setHeld({ ...slot });
        setSlot(target, { itemId: null, count: 0 }, nextInv, nextCraft, nextFurnace);
      }
      commit(nextInv, nextCraft, nextFurnace);
      return;
    }

    // Holding an item
    const def = ITEM_DEFS[held.itemId];
    const maxStack = def?.maxStack || 64;

    if (!slot.itemId) {
      const amount = isRight ? 1 : held.count;
      setSlot(target, { itemId: held.itemId, count: amount }, nextInv, nextCraft, nextFurnace);
      const rem = held.count - amount;
      setHeld(rem > 0 ? { itemId: held.itemId, count: rem } : { itemId: null, count: 0 });
    } else if (slot.itemId === held.itemId && slot.count < maxStack) {
      const amount = isRight ? 1 : Math.min(held.count, maxStack - slot.count);
      slot.count += amount;
      setSlot(target, slot, nextInv, nextCraft, nextFurnace);
      const rem = held.count - amount;
      setHeld(rem > 0 ? { itemId: held.itemId, count: rem } : { itemId: null, count: 0 });
    } else if (!isRight) {
      // Swap
      const prevHeld = { ...held };
      setHeld({ ...slot });
      setSlot(target, prevHeld, nextInv, nextCraft, nextFurnace);
    }

    commit(nextInv, nextCraft, nextFurnace);
  };

  const handleDropOnSlot = (target: SlotTarget) => {
    if (!dragSource) return;
    if (
      dragSource.zone === target.zone &&
      ((dragSource.zone === 'inv' && target.zone === 'inv' && dragSource.index === target.index) ||
        (dragSource.zone === 'craft' && target.zone === 'craft' && dragSource.index === target.index) ||
        (dragSource.zone === 'furnace' && target.zone === 'furnace' && dragSource.field === target.field))
    ) {
      setDragSource(null);
      return;
    }

    if (target.zone === 'furnace' && target.field === 'output') {
      setDragSource(null);
      return;
    }

    const nextInv = inv.map((s) => ({ ...s }));
    const nextCraft = craftGrid.map((s) => ({ ...s }));
    const nextFurnace = furnaceState ? JSON.parse(JSON.stringify(furnaceState)) : undefined;

    const src = { ...getSlot(dragSource, nextInv, nextCraft, nextFurnace) };
    const dst = { ...getSlot(target, nextInv, nextCraft, nextFurnace) };
    if (!src.itemId) {
      setDragSource(null);
      return;
    }

    const maxStack = ITEM_DEFS[src.itemId]?.maxStack || 64;
    if (!dst.itemId) {
      setSlot(target, src, nextInv, nextCraft, nextFurnace);
      setSlot(dragSource, { itemId: null, count: 0 }, nextInv, nextCraft, nextFurnace);
    } else if (dst.itemId === src.itemId && dst.count < maxStack) {
      const move = Math.min(src.count, maxStack - dst.count);
      dst.count += move;
      src.count -= move;
      setSlot(target, dst, nextInv, nextCraft, nextFurnace);
      setSlot(
        dragSource,
        src.count > 0 ? src : { itemId: null, count: 0 },
        nextInv,
        nextCraft,
        nextFurnace
      );
    } else {
      setSlot(target, src, nextInv, nextCraft, nextFurnace);
      setSlot(dragSource, dst, nextInv, nextCraft, nextFurnace);
    }

    soundEngine.playClick();
    setDragSource(null);
    commit(nextInv, nextCraft, nextFurnace);
  };

  const handleCraftOutput = () => {
    if (!matchedRecipe) return;
    const outDef = ITEM_DEFS[matchedRecipe.outputId];
    if (!outDef) return;

    if (
      held.itemId &&
      (held.itemId !== matchedRecipe.outputId ||
        held.count + matchedRecipe.outputCount > outDef.maxStack)
    ) {
      return;
    }

    const nextCraft = craftGrid.map((s) => {
      if (!s.itemId) return s;
      const nc = s.count - 1;
      return nc > 0 ? { itemId: s.itemId, count: nc } : { itemId: null, count: 0 };
    });

    setHeld({
      itemId: matchedRecipe.outputId,
      count: (held.itemId ? held.count : 0) + matchedRecipe.outputCount,
    });
    soundEngine.playPickup();
    commit(inv, nextCraft, furnaceState);
  };

  const canQuickCraft = (recipe: CraftingRecipe): boolean => {
    if (recipe.requiresTable && gridSize < 3) return false;
    const reqs = getRecipeIngredients(recipe);
    for (const r of reqs) {
      const total = inv.reduce((sum, s) => (s.itemId === r.itemId ? sum + s.count : sum), 0);
      if (total < r.count) return false;
    }
    return true;
  };

  const handleQuickCraft = (recipe: CraftingRecipe) => {
    if (!canQuickCraft(recipe)) return;
    const nextInv = inv.map((s) => ({ ...s }));
    const reqs = getRecipeIngredients(recipe);

    for (const r of reqs) {
      let rem = r.count;
      for (let i = 0; i < nextInv.length && rem > 0; i++) {
        if (nextInv[i].itemId === r.itemId) {
          const take = Math.min(rem, nextInv[i].count);
          nextInv[i].count -= take;
          rem -= take;
          if (nextInv[i].count <= 0) nextInv[i] = { itemId: null, count: 0 };
        }
      }
    }

    // Add output to inventory
    let addRem = recipe.outputCount;
    const maxS = ITEM_DEFS[recipe.outputId]?.maxStack || 64;
    for (let i = 0; i < nextInv.length && addRem > 0; i++) {
      if (nextInv[i].itemId === recipe.outputId && nextInv[i].count < maxS) {
        const put = Math.min(addRem, maxS - nextInv[i].count);
        nextInv[i].count += put;
        addRem -= put;
      }
    }
    for (let i = 0; i < nextInv.length && addRem > 0; i++) {
      if (!nextInv[i].itemId) {
        const put = Math.min(addRem, maxS);
        nextInv[i] = { itemId: recipe.outputId, count: put };
        addRem -= put;
      }
    }

    soundEngine.playPickup();
    commit(nextInv, craftGrid, furnaceState);
  };

  const handleCreativePick = (itemId: string) => {
    const nextInv = inv.map((s) => ({ ...s }));
    const maxS = ITEM_DEFS[itemId]?.maxStack || 64;
    for (let i = 0; i < nextInv.length; i++) {
      if (!nextInv[i].itemId) {
        nextInv[i] = { itemId, count: maxS === 1 ? 1 : 64 };
        soundEngine.playPickup();
        commit(nextInv);
        return;
      }
    }
  };

  const handleClose = () => {
    // Return any remaining crafting grid or held items back to inventory
    const nextInv = inv.map((s) => ({ ...s }));
    const extras: InventorySlot[] = [...craftGrid];
    if (held.itemId && held.count > 0) extras.push(held);

    for (const ex of extras) {
      if (!ex.itemId || ex.count <= 0) continue;
      let rem = ex.count;
      const maxS = ITEM_DEFS[ex.itemId]?.maxStack || 64;
      for (let i = 0; i < nextInv.length && rem > 0; i++) {
        if (nextInv[i].itemId === ex.itemId && nextInv[i].count < maxS) {
          const put = Math.min(rem, maxS - nextInv[i].count);
          nextInv[i].count += put;
          rem -= put;
        }
      }
      for (let i = 0; i < nextInv.length && rem > 0; i++) {
        if (!nextInv[i].itemId) {
          const put = Math.min(rem, maxS);
          nextInv[i] = { itemId: ex.itemId, count: put };
          rem -= put;
        }
      }
    }
    onUpdate(nextInv, furnaceKey, furnaceState);
    onClose();
  };

  const renderSlot = (slot: InventorySlot, target: SlotTarget, label?: string) => (
    <button
      key={
        target.zone === 'inv'
          ? `inv-${target.index}`
          : target.zone === 'craft'
            ? `craft-${target.index}`
            : `fur-${target.field}`
      }
      type="button"
      draggable={Boolean(slot.itemId)}
      onDragStart={() => setDragSource(target)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleDropOnSlot(target);
      }}
      onMouseDown={(e) => handleSlotClick(target, e)}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-12 h-12 rounded-lg bg-stone-900 border border-stone-700 hover:border-amber-400/70 flex items-center justify-center transition-colors cursor-pointer"
      title={slot.itemId ? ITEM_DEFS[slot.itemId]?.name : label}
    >
      {slot.itemId && slot.count > 0 ? (
        <ItemIcon itemId={slot.itemId} count={slot.count} size={34} />
      ) : (
        label && <span className="text-[10px] text-stone-500">{label}</span>
      )}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="bg-stone-950 border border-stone-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div className="flex items-center gap-4">
            <h2 className="font-display text-xl font-bold text-stone-100">
              {mode === 'crafting'
                ? 'Crafting Table'
                : mode === 'furnace'
                  ? 'Furnace'
                  : 'Inventory & Crafting'}
            </h2>
            {gameMode === 'creative' && mode === 'inventory' && (
              <div className="flex items-center gap-1 p-1 bg-stone-900 rounded-lg border border-stone-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('creative')}
                  className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'creative' ? 'bg-amber-500 text-stone-950' : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('craft')}
                  className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'craft' ? 'bg-amber-500 text-stone-950' : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <Hammer className="w-3.5 h-3.5" />
                  Crafting
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {held.itemId && (
              <div className="flex items-center gap-2 bg-stone-900 border border-amber-400/50 rounded-lg px-2.5 py-1 text-xs text-amber-200">
                <span>Holding:</span>
                <ItemIcon itemId={held.itemId} count={held.count} size={22} />
                <span>{ITEM_DEFS[held.itemId]?.name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
              aria-label="Close inventory"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col lg:flex-row gap-6 overflow-y-auto custom-scroll">
          {/* Left Side: Crafting / Furnace / Creative + 36-Slot Inventory */}
          <div className="flex-1 flex flex-col gap-5">
            {activeTab === 'creative' && gameMode === 'creative' ? (
              <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
                <p className="text-xs text-stone-400 mb-3">
                  Click any item below to add a full stack to your inventory.
                </p>
                <div className="grid grid-cols-8 sm:grid-cols-9 gap-1.5 max-h-44 overflow-y-auto custom-scroll pr-1">
                  {Object.values(ITEM_DEFS).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleCreativePick(item.id)}
                      className="w-11 h-11 rounded-lg bg-stone-900 border border-stone-700 hover:border-amber-400 flex items-center justify-center cursor-pointer"
                      title={item.name}
                    >
                      <ItemIcon itemId={item.id} size={30} />
                    </button>
                  ))}
                </div>
              </div>
            ) : mode === 'furnace' && furnaceState ? (
              <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 flex items-center justify-center gap-8">
                <div className="flex flex-col items-center gap-3">
                  {renderSlot(furnaceState.input, { zone: 'furnace', field: 'input' }, 'Ore/Food')}
                  <div className="flex items-center gap-1.5 text-xs text-stone-400">
                    <Flame
                      className={`w-5 h-5 ${
                        furnaceState.burnTime > 0 ? 'text-orange-400' : 'text-stone-600'
                      }`}
                    />
                    <span className="font-mono-num">
                      {furnaceState.burnTime > 0 ? `${furnaceState.burnTime.toFixed(1)}s` : 'Idle'}
                    </span>
                  </div>
                  {renderSlot(furnaceState.fuel, { zone: 'furnace', field: 'fuel' }, 'Fuel')}
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-24 h-2.5 bg-stone-800 rounded-full overflow-hidden border border-stone-700">
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{ width: `${Math.round(furnaceState.cookProgress * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-stone-400">Smelting</span>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  {renderSlot(furnaceState.output, { zone: 'furnace', field: 'output' }, 'Output')}
                  <span className="text-[11px] text-stone-400">Result</span>
                </div>
              </div>
            ) : (
              /* 2x2 or 3x3 Crafting Grid */
              <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
                  >
                    {craftGrid.map((slot, idx) => renderSlot(slot, { zone: 'craft', index: idx }))}
                  </div>

                  <div className="text-stone-400 text-xl font-bold">→</div>

                  <button
                    type="button"
                    onClick={handleCraftOutput}
                    className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-colors ${
                      matchedRecipe
                        ? 'bg-amber-500/20 border-amber-400 hover:bg-amber-500/30'
                        : 'bg-stone-900 border-stone-700'
                    }`}
                    title={matchedRecipe ? `Craft ${matchedRecipe.name}` : 'Crafting Output'}
                  >
                    {matchedRecipe && (
                      <ItemIcon
                        itemId={matchedRecipe.outputId}
                        count={matchedRecipe.outputCount}
                        size={38}
                      />
                    )}
                  </button>
                </div>

                <div className="text-xs text-stone-400 max-w-[180px]">
                  {matchedRecipe ? (
                    <span className="text-amber-300 font-medium">
                      Ready: {matchedRecipe.name} ×{matchedRecipe.outputCount}
                    </span>
                  ) : gridSize === 2 ? (
                    <span>2×2 Personal Grid. Place a Crafting Table for 3×3 tools & furnaces.</span>
                  ) : (
                    <span>3×3 Crafting Grid. Arrange items or use Quick Craft on the right.</span>
                  )}
                </div>
              </div>
            )}

            {/* 27-slot Main Backpack (indices 9..35) */}
            <div>
              <div className="text-xs font-medium text-stone-400 mb-2">
                Backpack · Left-click / Drag to move · Right-click to split
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {inv.slice(9, 36).map((slot, i) => renderSlot(slot, { zone: 'inv', index: i + 9 }))}
              </div>
            </div>

            {/* 9-slot Hotbar (indices 0..8) */}
            <div>
              <div className="text-xs font-medium text-stone-400 mb-2">Hotbar (Keys 1–9)</div>
              <div className="grid grid-cols-9 gap-1.5">
                {inv.slice(0, 9).map((slot, i) => renderSlot(slot, { zone: 'inv', index: i }))}
              </div>
            </div>
          </div>

          {/* Right Side: Interactive Recipe Book */}
          <div className="w-full lg:w-72 bg-stone-900/60 border border-stone-800 rounded-xl p-4 flex flex-col">
            <h3 className="text-sm font-semibold text-stone-200 mb-1">Crafting Recipes</h3>
            <p className="text-[11px] text-stone-400 mb-3">
              Click a highlighted recipe to craft immediately from your inventory.
            </p>
            <div className="flex-1 space-y-1.5 max-h-[380px] overflow-y-auto custom-scroll pr-1">
              {CRAFTING_RECIPES.map((recipe) => {
                const craftable = canQuickCraft(recipe);
                const needsTable = recipe.requiresTable && gridSize < 3;
                const reqs = getRecipeIngredients(recipe);

                return (
                  <button
                    key={recipe.id}
                    type="button"
                    disabled={!craftable}
                    onClick={() => handleQuickCraft(recipe)}
                    className={`w-full text-left p-2.5 rounded-lg border flex items-center gap-3 transition-colors ${
                      craftable
                        ? 'bg-stone-900 border-amber-500/45 hover:bg-amber-500/15 cursor-pointer'
                        : 'bg-stone-950/60 border-stone-800/80 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <ItemIcon itemId={recipe.outputId} count={recipe.outputCount} size={30} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-stone-100 truncate">
                        {recipe.name}
                      </div>
                      <div className="text-[11px] text-stone-400 truncate">
                        {reqs.map((r) => `${ITEM_DEFS[r.itemId]?.name} ×${r.count}`).join(' + ')}
                      </div>
                      {needsTable && (
                        <div className="text-[10px] text-amber-400">Requires Crafting Table</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
