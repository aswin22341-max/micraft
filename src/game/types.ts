export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Wood = 5,
  Leaves = 6,
  Water = 7,
  Lava = 8,
  CoalOre = 9,
  IronOre = 10,
  GoldOre = 11,
  DiamondOre = 12,
  Snow = 13,
  Planks = 14,
  CraftingTable = 15,
  Torch = 16,
  Furnace = 17,
  Bedrock = 18,
  Cobblestone = 19,
  Glass = 20,
}

export type ToolType = 'pickaxe' | 'sword' | 'axe' | 'shovel' | 'none';

export type ItemCategory = 'block' | 'tool' | 'material' | 'food';

export interface BlockTextures {
  top: number;
  side: number;
  bottom: number;
  front?: number;
}

export interface BlockDef {
  id: BlockId;
  name: string;
  hardness: number; // seconds to break by hand (-1 = unbreakable)
  solid: boolean;
  transparent: boolean;
  liquid: boolean;
  lightLevel: number;
  preferredTool: ToolType;
  minTier: number; // 0 = hand, 1 = wood, 2 = stone, 3 = iron
  dropItem: string | null;
  dropCount: number;
  textures: BlockTextures;
  soundMaterial: 'grass' | 'stone' | 'wood' | 'sand' | 'glass';
}

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  maxStack: number;
  blockId?: BlockId;
  toolType?: ToolType;
  toolTier?: number; // 1=wood, 2=stone, 3=iron, 4=diamond
  miningSpeed?: number;
  attackDamage?: number;
  foodRestore?: number;
  isFuel?: boolean;
  fuelDuration?: number;
  smeltResult?: string;
}

export interface InventorySlot {
  itemId: string | null;
  count: number;
}

export type GameMode = 'survival' | 'creative';
export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard';
export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  renderDistance: number; // 2 to 6 chunks radius
  mouseSensitivity: number; // 0.3 to 2.5
  soundVolume: number; // 0 to 1
  fov: number; // 60 to 105
}

export interface WorldMeta {
  id: string;
  name: string;
  seed: string;
  mode: GameMode;
  difficulty: Difficulty;
  createdAt: number;
  lastPlayed: number;
}

export interface FurnaceState {
  input: InventorySlot;
  fuel: InventorySlot;
  output: InventorySlot;
  burnTime: number;
  maxBurnTime: number;
  cookProgress: number;
}

export interface SaveWorldData {
  meta: WorldMeta;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    hunger: number;
    selectedSlot: number;
  };
  inventory: InventorySlot[]; // 36 slots (0..8 hotbar, 9..35 backpack)
  modifiedBlocks: Record<string, number>; // "x,y,z" -> BlockId
  furnaces: Record<string, FurnaceState>; // "x,y,z" -> FurnaceState
  timeOfDay: number; // 0..1 (0.25 = noon, 0.75 = midnight)
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  mode: GameMode;
  difficulty: Difficulty;
  selectedSlot: number;
  inventory: InventorySlot[];
  dayCount: number;
  timeOfDay: number;
  coords: { x: number; y: number; z: number };
  biome: string;
  targetedBlock: {
    x: number;
    y: number;
    z: number;
    blockId: BlockId;
    name: string;
  } | null;
  breakProgress: number;
  inWater: boolean;
  inLava: boolean;
  hurtFlash: number;
  isDead: boolean;
  fps: number;
}

// Tile indices inside the 16x16 procedural texture atlas
export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD_SIDE: 5,
  WOOD_TOP: 6,
  LEAVES: 7,
  WATER: 8,
  LAVA: 9,
  COAL_ORE: 10,
  IRON_ORE: 11,
  GOLD_ORE: 12,
  DIAMOND_ORE: 13,
  SNOW: 14,
  PLANKS: 15,
  CRAFT_TOP: 16,
  CRAFT_SIDE: 17,
  TORCH: 18,
  FURNACE_FRONT: 19,
  FURNACE_SIDE: 20,
  FURNACE_TOP: 21,
  BEDROCK: 22,
  COBBLESTONE: 23,
  GLASS: 24,
} as const;

export const BLOCK_DEFS: Record<BlockId, BlockDef> = {
  [BlockId.Air]: {
    id: BlockId.Air,
    name: 'Air',
    hardness: 0,
    solid: false,
    transparent: true,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'none',
    minTier: 0,
    dropItem: null,
    dropCount: 0,
    textures: { top: 0, side: 0, bottom: 0 },
    soundMaterial: 'stone',
  },
  [BlockId.Grass]: {
    id: BlockId.Grass,
    name: 'Grass Block',
    hardness: 0.6,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'shovel',
    minTier: 0,
    dropItem: 'dirt',
    dropCount: 1,
    textures: { top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT },
    soundMaterial: 'grass',
  },
  [BlockId.Dirt]: {
    id: BlockId.Dirt,
    name: 'Dirt',
    hardness: 0.55,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'shovel',
    minTier: 0,
    dropItem: 'dirt',
    dropCount: 1,
    textures: { top: TILE.DIRT, side: TILE.DIRT, bottom: TILE.DIRT },
    soundMaterial: 'grass',
  },
  [BlockId.Stone]: {
    id: BlockId.Stone,
    name: 'Stone',
    hardness: 1.8,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'pickaxe',
    minTier: 1,
    dropItem: 'cobblestone',
    dropCount: 1,
    textures: { top: TILE.STONE, side: TILE.STONE, bottom: TILE.STONE },
    soundMaterial: 'stone',
  },
  [BlockId.Sand]: {
    id: BlockId.Sand,
    name: 'Sand',
    hardness: 0.5,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'shovel',
    minTier: 0,
    dropItem: 'sand',
    dropCount: 1,
    textures: { top: TILE.SAND, side: TILE.SAND, bottom: TILE.SAND },
    soundMaterial: 'sand',
  },
  [BlockId.Wood]: {
    id: BlockId.Wood,
    name: 'Oak Wood',
    hardness: 1.2,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'axe',
    minTier: 0,
    dropItem: 'wood',
    dropCount: 1,
    textures: { top: TILE.WOOD_TOP, side: TILE.WOOD_SIDE, bottom: TILE.WOOD_TOP },
    soundMaterial: 'wood',
  },
  [BlockId.Leaves]: {
    id: BlockId.Leaves,
    name: 'Oak Leaves',
    hardness: 0.25,
    solid: true,
    transparent: true,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'none',
    minTier: 0,
    dropItem: 'leaves',
    dropCount: 1,
    textures: { top: TILE.LEAVES, side: TILE.LEAVES, bottom: TILE.LEAVES },
    soundMaterial: 'grass',
  },
  [BlockId.Water]: {
    id: BlockId.Water,
    name: 'Water',
    hardness: -1,
    solid: false,
    transparent: true,
    liquid: true,
    lightLevel: 0,
    preferredTool: 'none',
    minTier: 0,
    dropItem: null,
    dropCount: 0,
    textures: { top: TILE.WATER, side: TILE.WATER, bottom: TILE.WATER },
    soundMaterial: 'grass',
  },
  [BlockId.Lava]: {
    id: BlockId.Lava,
    name: 'Lava',
    hardness: -1,
    solid: false,
    transparent: true,
    liquid: true,
    lightLevel: 14,
    preferredTool: 'none',
    minTier: 0,
    dropItem: null,
    dropCount: 0,
    textures: { top: TILE.LAVA, side: TILE.LAVA, bottom: TILE.LAVA },
    soundMaterial: 'stone',
  },
  [BlockId.CoalOre]: {
    id: BlockId.CoalOre,
    name: 'Coal Ore',
    hardness: 2.0,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'pickaxe',
    minTier: 1,
    dropItem: 'coal',
    dropCount: 1,
    textures: { top: TILE.COAL_ORE, side: TILE.COAL_ORE, bottom: TILE.COAL_ORE },
    soundMaterial: 'stone',
  },
  [BlockId.IronOre]: {
    id: BlockId.IronOre,
    name: 'Iron Ore',
    hardness: 2.4,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'pickaxe',
    minTier: 2,
    dropItem: 'iron_ore',
    dropCount: 1,
    textures: { top: TILE.IRON_ORE, side: TILE.IRON_ORE, bottom: TILE.IRON_ORE },
    soundMaterial: 'stone',
  },
  [BlockId.GoldOre]: {
    id: BlockId.GoldOre,
    name: 'Gold Ore',
    hardness: 2.8,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'pickaxe',
    minTier: 3,
    dropItem: 'gold_ore',
    dropCount: 1,
    textures: { top: TILE.GOLD_ORE, side: TILE.GOLD_ORE, bottom: TILE.GOLD_ORE },
    soundMaterial: 'stone',
  },
  [BlockId.DiamondOre]: {
    id: BlockId.DiamondOre,
    name: 'Diamond Ore',
    hardness: 3.4,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'pickaxe',
    minTier: 3,
    dropItem: 'diamond',
    dropCount: 1,
    textures: { top: TILE.DIAMOND_ORE, side: TILE.DIAMOND_ORE, bottom: TILE.DIAMOND_ORE },
    soundMaterial: 'stone',
  },
  [BlockId.Snow]: {
    id: BlockId.Snow,
    name: 'Snow Block',
    hardness: 0.4,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'shovel',
    minTier: 0,
    dropItem: 'snow',
    dropCount: 1,
    textures: { top: TILE.SNOW, side: TILE.SNOW, bottom: TILE.SNOW },
    soundMaterial: 'sand',
  },
  [BlockId.Planks]: {
    id: BlockId.Planks,
    name: 'Wooden Planks',
    hardness: 1.0,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'axe',
    minTier: 0,
    dropItem: 'planks',
    dropCount: 1,
    textures: { top: TILE.PLANKS, side: TILE.PLANKS, bottom: TILE.PLANKS },
    soundMaterial: 'wood',
  },
  [BlockId.CraftingTable]: {
    id: BlockId.CraftingTable,
    name: 'Crafting Table',
    hardness: 1.1,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'axe',
    minTier: 0,
    dropItem: 'crafting_table',
    dropCount: 1,
    textures: { top: TILE.CRAFT_TOP, side: TILE.CRAFT_SIDE, bottom: TILE.PLANKS },
    soundMaterial: 'wood',
  },
  [BlockId.Torch]: {
    id: BlockId.Torch,
    name: 'Torch',
    hardness: 0.1,
    solid: false,
    transparent: true,
    liquid: false,
    lightLevel: 14,
    preferredTool: 'none',
    minTier: 0,
    dropItem: 'torch',
    dropCount: 1,
    textures: { top: TILE.TORCH, side: TILE.TORCH, bottom: TILE.TORCH },
    soundMaterial: 'wood',
  },
  [BlockId.Furnace]: {
    id: BlockId.Furnace,
    name: 'Furnace',
    hardness: 2.0,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'pickaxe',
    minTier: 1,
    dropItem: 'furnace',
    dropCount: 1,
    textures: {
      top: TILE.FURNACE_TOP,
      side: TILE.FURNACE_SIDE,
      bottom: TILE.FURNACE_TOP,
      front: TILE.FURNACE_FRONT,
    },
    soundMaterial: 'stone',
  },
  [BlockId.Bedrock]: {
    id: BlockId.Bedrock,
    name: 'Bedrock',
    hardness: -1,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'none',
    minTier: 99,
    dropItem: null,
    dropCount: 0,
    textures: { top: TILE.BEDROCK, side: TILE.BEDROCK, bottom: TILE.BEDROCK },
    soundMaterial: 'stone',
  },
  [BlockId.Cobblestone]: {
    id: BlockId.Cobblestone,
    name: 'Cobblestone',
    hardness: 1.8,
    solid: true,
    transparent: false,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'pickaxe',
    minTier: 1,
    dropItem: 'cobblestone',
    dropCount: 1,
    textures: { top: TILE.COBBLESTONE, side: TILE.COBBLESTONE, bottom: TILE.COBBLESTONE },
    soundMaterial: 'stone',
  },
  [BlockId.Glass]: {
    id: BlockId.Glass,
    name: 'Glass',
    hardness: 0.4,
    solid: true,
    transparent: true,
    liquid: false,
    lightLevel: 0,
    preferredTool: 'none',
    minTier: 0,
    dropItem: 'glass',
    dropCount: 1,
    textures: { top: TILE.GLASS, side: TILE.GLASS, bottom: TILE.GLASS },
    soundMaterial: 'glass',
  },
};

export const ITEM_DEFS: Record<string, ItemDef> = {
  grass: { id: 'grass', name: 'Grass Block', category: 'block', maxStack: 64, blockId: BlockId.Grass },
  dirt: { id: 'dirt', name: 'Dirt', category: 'block', maxStack: 64, blockId: BlockId.Dirt },
  stone: { id: 'stone', name: 'Stone', category: 'block', maxStack: 64, blockId: BlockId.Stone, smeltResult: 'stone' },
  cobblestone: { id: 'cobblestone', name: 'Cobblestone', category: 'block', maxStack: 64, blockId: BlockId.Cobblestone, smeltResult: 'stone' },
  sand: { id: 'sand', name: 'Sand', category: 'block', maxStack: 64, blockId: BlockId.Sand, smeltResult: 'glass' },
  wood: { id: 'wood', name: 'Oak Wood', category: 'block', maxStack: 64, blockId: BlockId.Wood, isFuel: true, fuelDuration: 5 },
  leaves: { id: 'leaves', name: 'Oak Leaves', category: 'block', maxStack: 64, blockId: BlockId.Leaves },
  snow: { id: 'snow', name: 'Snow Block', category: 'block', maxStack: 64, blockId: BlockId.Snow },
  planks: { id: 'planks', name: 'Wooden Planks', category: 'block', maxStack: 64, blockId: BlockId.Planks, isFuel: true, fuelDuration: 4 },
  crafting_table: { id: 'crafting_table', name: 'Crafting Table', category: 'block', maxStack: 64, blockId: BlockId.CraftingTable },
  torch: { id: 'torch', name: 'Torch', category: 'block', maxStack: 64, blockId: BlockId.Torch },
  furnace: { id: 'furnace', name: 'Furnace', category: 'block', maxStack: 64, blockId: BlockId.Furnace },
  glass: { id: 'glass', name: 'Glass', category: 'block', maxStack: 64, blockId: BlockId.Glass },
  coal_ore: { id: 'coal_ore', name: 'Coal Ore', category: 'block', maxStack: 64, blockId: BlockId.CoalOre, smeltResult: 'coal' },
  iron_ore: { id: 'iron_ore', name: 'Iron Ore', category: 'block', maxStack: 64, blockId: BlockId.IronOre, smeltResult: 'iron_ingot' },
  gold_ore: { id: 'gold_ore', name: 'Gold Ore', category: 'block', maxStack: 64, blockId: BlockId.GoldOre, smeltResult: 'gold_ingot' },
  diamond_ore: { id: 'diamond_ore', name: 'Diamond Ore', category: 'block', maxStack: 64, blockId: BlockId.DiamondOre, smeltResult: 'diamond' },

  // Materials
  stick: { id: 'stick', name: 'Stick', category: 'material', maxStack: 64, isFuel: true, fuelDuration: 2 },
  coal: { id: 'coal', name: 'Coal', category: 'material', maxStack: 64, isFuel: true, fuelDuration: 12 },
  iron_ingot: { id: 'iron_ingot', name: 'Iron Ingot', category: 'material', maxStack: 64 },
  gold_ingot: { id: 'gold_ingot', name: 'Gold Ingot', category: 'material', maxStack: 64 },
  diamond: { id: 'diamond', name: 'Diamond', category: 'material', maxStack: 64 },
  wool: { id: 'wool', name: 'Wool', category: 'material', maxStack: 64 },

  // Tools & Weapons
  wooden_pickaxe: { id: 'wooden_pickaxe', name: 'Wooden Pickaxe', category: 'tool', maxStack: 1, toolType: 'pickaxe', toolTier: 1, miningSpeed: 2.4, attackDamage: 3 },
  stone_pickaxe: { id: 'stone_pickaxe', name: 'Stone Pickaxe', category: 'tool', maxStack: 1, toolType: 'pickaxe', toolTier: 2, miningSpeed: 4.2, attackDamage: 4 },
  iron_pickaxe: { id: 'iron_pickaxe', name: 'Iron Pickaxe', category: 'tool', maxStack: 1, toolType: 'pickaxe', toolTier: 3, miningSpeed: 6.5, attackDamage: 5 },
  diamond_pickaxe: { id: 'diamond_pickaxe', name: 'Diamond Pickaxe', category: 'tool', maxStack: 1, toolType: 'pickaxe', toolTier: 4, miningSpeed: 9.0, attackDamage: 6 },

  wooden_sword: { id: 'wooden_sword', name: 'Wooden Sword', category: 'tool', maxStack: 1, toolType: 'sword', toolTier: 1, miningSpeed: 1.4, attackDamage: 5 },
  stone_sword: { id: 'stone_sword', name: 'Stone Sword', category: 'tool', maxStack: 1, toolType: 'sword', toolTier: 2, miningSpeed: 1.5, attackDamage: 7 },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', category: 'tool', maxStack: 1, toolType: 'sword', toolTier: 3, miningSpeed: 1.6, attackDamage: 9 },
  diamond_sword: { id: 'diamond_sword', name: 'Diamond Sword', category: 'tool', maxStack: 1, toolType: 'sword', toolTier: 4, miningSpeed: 1.8, attackDamage: 12 },

  // Food
  apple: { id: 'apple', name: 'Apple', category: 'food', maxStack: 64, foodRestore: 4 },
  raw_beef: { id: 'raw_beef', name: 'Raw Beef', category: 'food', maxStack: 64, foodRestore: 3, smeltResult: 'steak' },
  steak: { id: 'steak', name: 'Cooked Steak', category: 'food', maxStack: 64, foodRestore: 8 },
  raw_pork: { id: 'raw_pork', name: 'Raw Porkchop', category: 'food', maxStack: 64, foodRestore: 3, smeltResult: 'cooked_pork' },
  cooked_pork: { id: 'cooked_pork', name: 'Cooked Porkchop', category: 'food', maxStack: 64, foodRestore: 8 },
};

export const DEFAULT_SETTINGS: GameSettings = {
  graphicsQuality: 'high',
  renderDistance: 4,
  mouseSensitivity: 1.0,
  soundVolume: 0.7,
  fov: 75,
};
