export interface CraftingRecipe {
  id: string;
  name: string;
  outputId: string;
  outputCount: number;
  requiresTable: boolean; // true if needs 3x3 grid
  // Row-major pattern strings (trimmed to minimal bounding box), space = empty
  pattern?: string[];
  key?: Record<string, string>;
  // Or shapeless ingredients
  shapeless?: string[];
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'planks_from_wood',
    name: 'Wooden Planks',
    outputId: 'planks',
    outputCount: 4,
    requiresTable: false,
    shapeless: ['wood'],
  },
  {
    id: 'sticks_from_planks',
    name: 'Sticks',
    outputId: 'stick',
    outputCount: 4,
    requiresTable: false,
    pattern: ['P', 'P'],
    key: { P: 'planks' },
  },
  {
    id: 'crafting_table',
    name: 'Crafting Table',
    outputId: 'crafting_table',
    outputCount: 1,
    requiresTable: false,
    pattern: ['PP', 'PP'],
    key: { P: 'planks' },
  },
  {
    id: 'torch',
    name: 'Torches',
    outputId: 'torch',
    outputCount: 4,
    requiresTable: false,
    pattern: ['C', 'S'],
    key: { C: 'coal', S: 'stick' },
  },
  {
    id: 'furnace',
    name: 'Furnace',
    outputId: 'furnace',
    outputCount: 1,
    requiresTable: true,
    pattern: ['CCC', 'C C', 'CCC'],
    key: { C: 'cobblestone' },
  },
  {
    id: 'wooden_pickaxe',
    name: 'Wooden Pickaxe',
    outputId: 'wooden_pickaxe',
    outputCount: 1,
    requiresTable: true,
    pattern: ['PPP', ' S ', ' S '],
    key: { P: 'planks', S: 'stick' },
  },
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    outputId: 'stone_pickaxe',
    outputCount: 1,
    requiresTable: true,
    pattern: ['CCC', ' S ', ' S '],
    key: { C: 'cobblestone', S: 'stick' },
  },
  {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    outputId: 'iron_pickaxe',
    outputCount: 1,
    requiresTable: true,
    pattern: ['III', ' S ', ' S '],
    key: { I: 'iron_ingot', S: 'stick' },
  },
  {
    id: 'diamond_pickaxe',
    name: 'Diamond Pickaxe',
    outputId: 'diamond_pickaxe',
    outputCount: 1,
    requiresTable: true,
    pattern: ['DDD', ' S ', ' S '],
    key: { D: 'diamond', S: 'stick' },
  },
  {
    id: 'wooden_sword',
    name: 'Wooden Sword',
    outputId: 'wooden_sword',
    outputCount: 1,
    requiresTable: false,
    pattern: ['P', 'P', 'S'],
    key: { P: 'planks', S: 'stick' },
  },
  {
    id: 'stone_sword',
    name: 'Stone Sword',
    outputId: 'stone_sword',
    outputCount: 1,
    requiresTable: false,
    pattern: ['C', 'C', 'S'],
    key: { C: 'cobblestone', S: 'stick' },
  },
  {
    id: 'iron_sword',
    name: 'Iron Sword',
    outputId: 'iron_sword',
    outputCount: 1,
    requiresTable: false,
    pattern: ['I', 'I', 'S'],
    key: { I: 'iron_ingot', S: 'stick' },
  },
  {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    outputId: 'diamond_sword',
    outputCount: 1,
    requiresTable: false,
    pattern: ['D', 'D', 'S'],
    key: { D: 'diamond', S: 'stick' },
  },
];

// Match a square crafting grid (2x2 or 3x3) of itemId | null
export function matchCraftingRecipe(
  grid: (string | null)[],
  gridSize: 2 | 3
): CraftingRecipe | null {
  const nonEmptyItems: string[] = [];
  let minR: number = gridSize;
  let maxR = -1;
  let minC: number = gridSize;
  let maxC = -1;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const item = grid[r * gridSize + c];
      if (item) {
        nonEmptyItems.push(item);
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }

  if (nonEmptyItems.length === 0) return null;

  const height = maxR - minR + 1;
  const width = maxC - minC + 1;

  for (const recipe of CRAFTING_RECIPES) {
    if (recipe.shapeless) {
      if (recipe.shapeless.length !== nonEmptyItems.length) continue;
      const sortedInput = [...nonEmptyItems].sort();
      const sortedReq = [...recipe.shapeless].sort();
      if (sortedInput.every((v, i) => v === sortedReq[i])) {
        return recipe;
      }
      continue;
    }

    if (recipe.pattern && recipe.key) {
      const patH = recipe.pattern.length;
      const patW = recipe.pattern[0].length;
      if (patH !== height || patW !== width) continue;

      let matches = true;
      for (let r = 0; r < patH; r++) {
        for (let c = 0; c < patW; c++) {
          const ch = recipe.pattern[r][c];
          const expected = ch === ' ' ? null : recipe.key[ch];
          const actual = grid[(minR + r) * gridSize + (minC + c)] || null;
          if (actual !== expected) {
            matches = false;
            break;
          }
        }
        if (!matches) break;
      }
      if (matches) return recipe;
    }
  }

  return null;
}

export function getRecipeIngredients(recipe: CraftingRecipe): { itemId: string; count: number }[] {
  const counts = new Map<string, number>();
  if (recipe.shapeless) {
    for (const id of recipe.shapeless) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  } else if (recipe.pattern && recipe.key) {
    for (const row of recipe.pattern) {
      for (const ch of row) {
        if (ch !== ' ' && recipe.key[ch]) {
          const id = recipe.key[ch];
          counts.set(id, (counts.get(id) || 0) + 1);
        }
      }
    }
  }
  return Array.from(counts.entries()).map(([itemId, count]) => ({ itemId, count }));
}
