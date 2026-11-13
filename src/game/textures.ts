import * as THREE from 'three';
import { BLOCK_DEFS, ITEM_DEFS, TILE } from './types';

export const ATLAS_TILES_PER_ROW = 16;
export const TILE_PX = 16;
export const ATLAS_PX = ATLAS_TILES_PER_ROW * TILE_PX; // 256

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tileIndex: number,
  drawer: (px: (x: number, y: number, color: string) => void, rand: () => number) => void
) {
  const tx = (tileIndex % ATLAS_TILES_PER_ROW) * TILE_PX;
  const ty = Math.floor(tileIndex / ATLAS_TILES_PER_ROW) * TILE_PX;
  const rand = seededRand(tileIndex * 9973 + 1337);
  const px = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(tx + x, ty + y, 1, 1);
  };
  drawer(px, rand);
}

function fillNoisyTile(
  px: (x: number, y: number, c: string) => void,
  rand: () => number,
  palette: string[]
) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      px(x, y, palette[Math.floor(rand() * palette.length)]);
    }
  }
}

export function createAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_PX;
  canvas.height = ATLAS_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, ATLAS_PX, ATLAS_PX);

  // 0: Grass Top
  drawTile(ctx, TILE.GRASS_TOP, (px, rand) => {
    fillNoisyTile(px, rand, ['#559e36', '#4d922f', '#60ab3d', '#48882b', '#67b444']);
  });

  // 1: Grass Side
  drawTile(ctx, TILE.GRASS_SIDE, (px, rand) => {
    const dirt = ['#7a5234', '#6b462b', '#875c3c', '#5e3d24'];
    const grass = ['#559e36', '#4d922f', '#62ad3f'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const overhang = 3 + ((x * 7 + 3) % 3);
        if (y < overhang) {
          px(x, y, grass[Math.floor(rand() * grass.length)]);
        } else {
          px(x, y, dirt[Math.floor(rand() * dirt.length)]);
        }
      }
    }
  });

  // 2: Dirt
  drawTile(ctx, TILE.DIRT, (px, rand) => {
    fillNoisyTile(px, rand, ['#7a5234', '#6b462b', '#875c3c', '#5e3d24', '#724d30']);
  });

  // 3: Stone
  drawTile(ctx, TILE.STONE, (px, rand) => {
    fillNoisyTile(px, rand, ['#7e8287', '#71757a', '#8c9096', '#676b70', '#777b80']);
    for (let i = 0; i < 8; i++) {
      const sx = Math.floor(rand() * 13);
      const sy = Math.floor(rand() * 16);
      px(sx, sy, '#61656a');
      px(sx + 1, sy, '#61656a');
    }
  });

  // 4: Sand
  drawTile(ctx, TILE.SAND, (px, rand) => {
    fillNoisyTile(px, rand, ['#e5d59c', '#dcc98c', '#ede0ad', '#d1be7e']);
  });

  // 5: Wood Side (Oak Bark)
  drawTile(ctx, TILE.WOOD_SIDE, (px, rand) => {
    const bark = ['#5b4129', '#4f3721', '#694b30', '#442e1b'];
    for (let x = 0; x < 16; x++) {
      const stripe = x % 3 === 0 ? 1 : 0;
      for (let y = 0; y < 16; y++) {
        const idx = (stripe + Math.floor(rand() * 3)) % bark.length;
        px(x, y, bark[idx]);
      }
    }
  });

  // 6: Wood Top (Rings)
  drawTile(ctx, TILE.WOOD_TOP, (px) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = Math.abs(x - 7.5);
        const dy = Math.abs(y - 7.5);
        const d = Math.max(dx, dy);
        if (d > 6.6) px(x, y, '#4f3721');
        else if (d > 5.2) px(x, y, '#c59e6a');
        else if (d > 3.8) px(x, y, '#ab814e');
        else if (d > 2.2) px(x, y, '#c59e6a');
        else px(x, y, '#9c7241');
      }
    }
  });

  // 7: Leaves (alpha cutouts for crisp foliage)
  drawTile(ctx, TILE.LEAVES, (px, rand) => {
    const greens = ['#387b22', '#2f6b1b', '#458f2b', '#275916'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (rand() < 0.16) continue; // transparent hole
        px(x, y, greens[Math.floor(rand() * greens.length)]);
      }
    }
  });

  // 8: Water
  drawTile(ctx, TILE.WATER, (px, rand) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = ((x + y * 2) % 6 === 0) ? 'rgba(130, 200, 255, 0.82)' : rand() > 0.5 ? 'rgba(42, 118, 208, 0.78)' : 'rgba(34, 102, 188, 0.78)';
        px(x, y, wave);
      }
    }
  });

  // 9: Lava
  drawTile(ctx, TILE.LAVA, (px, rand) => {
    fillNoisyTile(px, rand, ['#e85012', '#f77d19', '#cf3508', '#ffbb29', '#f26415']);
  });

  // Helper for Ores on Stone base
  const drawOre = (tile: number, spots: string[]) => {
    drawTile(ctx, tile, (px, rand) => {
      fillNoisyTile(px, rand, ['#7e8287', '#71757a', '#8c9096', '#676b70']);
      const clusters = [
        [3, 3], [10, 4], [5, 10], [11, 11], [7, 6],
      ];
      for (const [cx, cy] of clusters) {
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            if (rand() > 0.2) {
              px(cx + dx, cy + dy, spots[Math.floor(rand() * spots.length)]);
            }
          }
        }
      }
    });
  };

  // 10..13: Ores
  drawOre(TILE.COAL_ORE, ['#202225', '#151719', '#32353a']);
  drawOre(TILE.IRON_ORE, ['#d8b292', '#c39772', '#edd0b6']);
  drawOre(TILE.GOLD_ORE, ['#f7d034', '#e0a914', '#fff07c']);
  drawOre(TILE.DIAMOND_ORE, ['#4be8e8', '#25c4cb', '#9ff9f9']);

  // 14: Snow
  drawTile(ctx, TILE.SNOW, (px, rand) => {
    fillNoisyTile(px, rand, ['#f2f7fa', '#e5eff5', '#ffffff', '#dbe7ef']);
  });

  // 15: Wooden Planks
  drawTile(ctx, TILE.PLANKS, (px, rand) => {
    const wood = ['#b98d56', '#ab7f49', '#c79a62', '#9e723d'];
    for (let y = 0; y < 16; y++) {
      const isSeam = y % 4 === 0;
      for (let x = 0; x < 16; x++) {
        if (isSeam || (x === (Math.floor(y / 4) % 2 === 0 ? 7 : 14))) {
          px(x, y, '#7e582c');
        } else {
          px(x, y, wood[Math.floor(rand() * wood.length)]);
        }
      }
    }
  });

  // 16: Crafting Table Top
  drawTile(ctx, TILE.CRAFT_TOP, (px) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (x === 0 || x === 15 || y === 0 || y === 15) {
          px(x, y, '#6b4523');
        } else if (x === 5 || x === 10 || y === 5 || y === 10) {
          px(x, y, '#543519');
        } else {
          px(x, y, (x + y) % 2 === 0 ? '#bd8f55' : '#b2834a');
        }
      }
    }
  });

  // 17: Crafting Table Side
  drawTile(ctx, TILE.CRAFT_SIDE, (px, rand) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y < 3) px(x, y, '#794d26');
        else if (x >= 4 && x <= 11 && y >= 5 && y <= 12) {
          px(x, y, (x === 5 || x === 10) ? '#444b54' : '#946838');
        } else {
          px(x, y, rand() > 0.5 ? '#b3864d' : '#a37740');
        }
      }
    }
  });

  // 18: Torch
  drawTile(ctx, TILE.TORCH, (px) => {
    for (let y = 5; y < 16; y++) {
      px(7, y, '#7f572e');
      px(8, y, '#694522');
    }
    for (let y = 2; y <= 4; y++) {
      px(7, y, '#ffae19');
      px(8, y, '#ffd84d');
    }
    px(7, 1, '#fff6a6');
    px(8, 1, '#ff9d00');
  });

  // 19: Furnace Front
  drawTile(ctx, TILE.FURNACE_FRONT, (px, rand) => {
    fillNoisyTile(px, rand, ['#787c82', '#686c72', '#868a90']);
    for (let x = 0; x < 16; x++) {
      px(x, 0, '#55585e');
      px(x, 15, '#55585e');
    }
    // Top mouth
    for (let y = 3; y <= 6; y++) {
      for (let x = 4; x <= 11; x++) px(x, y, '#26282c');
    }
    // Bottom firebox
    for (let y = 10; y <= 14; y++) {
      for (let x = 5; x <= 10; x++) px(x, y, y >= 12 ? '#d95b16' : '#1b1d20');
    }
  });

  // 20: Furnace Side
  drawTile(ctx, TILE.FURNACE_SIDE, (px, rand) => {
    fillNoisyTile(px, rand, ['#787c82', '#6b6f75', '#888c92']);
    for (let x = 0; x < 16; x++) {
      px(x, 0, '#55585e');
      px(x, 7, '#5c6066');
      px(x, 15, '#55585e');
    }
  });

  // 21: Furnace Top
  drawTile(ctx, TILE.FURNACE_TOP, (px, rand) => {
    fillNoisyTile(px, rand, ['#6e7278', '#7d8187', '#606469']);
    for (let i = 0; i < 16; i++) {
      px(i, 0, '#4f5358');
      px(i, 15, '#4f5358');
      px(0, i, '#4f5358');
      px(15, i, '#4f5358');
    }
  });

  // 22: Bedrock
  drawTile(ctx, TILE.BEDROCK, (px, rand) => {
    fillNoisyTile(px, rand, ['#282a2e', '#1a1b1e', '#3e4147', '#111214']);
  });

  // 23: Cobblestone
  drawTile(ctx, TILE.COBBLESTONE, (px, rand) => {
    fillNoisyTile(px, rand, ['#75797e', '#888c92', '#64686d']);
    for (let y = 0; y < 16; y += 4) {
      for (let x = 0; x < 16; x++) px(x, y, '#505458');
    }
    for (let x = 0; x < 16; x += 5) {
      for (let y = 0; y < 16; y++) {
        if ((y % 8 < 4 && x % 10 === 0) || (y % 8 >= 4 && x % 10 === 5)) {
          px(x, y, '#505458');
        }
      }
    }
  });

  // 24: Glass
  drawTile(ctx, TILE.GLASS, (px) => {
    for (let i = 0; i < 16; i++) {
      px(i, 0, '#a8e1f0');
      px(i, 15, '#a8e1f0');
      px(0, i, '#a8e1f0');
      px(15, i, '#a8e1f0');
    }
    px(3, 3, '#e3f9ff');
    px(4, 3, '#e3f9ff');
    px(3, 4, '#e3f9ff');
    px(11, 11, '#e3f9ff');
    px(12, 11, '#e3f9ff');
  });

  return canvas;
}

export function createAtlasTexture(maxAnisotropy = 1): {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
} {
  const canvas = createAtlasCanvas();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = Math.min(4, maxAnisotropy);
  texture.needsUpdate = true;
  return { texture, canvas };
}

export function getTileUV(tileIndex: number): [number, number, number, number] {
  const col = tileIndex % ATLAS_TILES_PER_ROW;
  const row = Math.floor(tileIndex / ATLAS_TILES_PER_ROW);
  const step = 1 / ATLAS_TILES_PER_ROW;
  const eps = 0.0015;
  const u0 = col * step + eps;
  const u1 = (col + 1) * step - eps;
  const v1 = 1 - row * step - eps;
  const v0 = 1 - (row + 1) * step + eps;
  return [u0, v0, u1, v1];
}

// Generate crisp 32x32 UI icon data URLs for every item
const iconCache = new Map<string, string>();
let sharedAtlasCanvas: HTMLCanvasElement | null = null;

function getSharedAtlasCanvas(): HTMLCanvasElement {
  if (!sharedAtlasCanvas) {
    sharedAtlasCanvas = createAtlasCanvas();
  }
  return sharedAtlasCanvas;
}

function drawAtlasTileTo(
  dst: CanvasRenderingContext2D,
  tileIndex: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const atlas = getSharedAtlasCanvas();
  const sx = (tileIndex % ATLAS_TILES_PER_ROW) * TILE_PX;
  const sy = Math.floor(tileIndex / ATLAS_TILES_PER_ROW) * TILE_PX;
  dst.drawImage(atlas, sx, sy, TILE_PX, TILE_PX, dx, dy, dw, dh);
}

export function getItemIconUrl(itemId: string): string {
  const cached = iconCache.get(itemId);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const def = ITEM_DEFS[itemId];
  if (def?.blockId !== undefined) {
    const bdef = BLOCK_DEFS[def.blockId];
    if (def.id === 'torch') {
      drawAtlasTileTo(ctx, TILE.TORCH, 2, 2, 28, 28);
    } else {
      // Draw a clean isometric 3D-styled voxel block icon
      // Top diamond
      ctx.save();
      ctx.translate(16, 4);
      ctx.transform(1, 0.45, -1, 0.45, 0, 0);
      drawAtlasTileTo(ctx, bdef.textures.top, 0, 0, 12, 12);
      ctx.restore();

      // Left face
      ctx.save();
      ctx.translate(4, 9.5);
      ctx.transform(1, 0.45, 0, 1.15, 0, 0);
      drawAtlasTileTo(ctx, bdef.textures.front ?? bdef.textures.side, 0, 0, 12, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, 0, 12, 12);
      ctx.restore();

      // Right face
      ctx.save();
      ctx.translate(16, 15);
      ctx.transform(1, -0.45, 0, 1.15, 0, 0);
      drawAtlasTileTo(ctx, bdef.textures.side, 0, 0, 12, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(0, 0, 12, 12);
      ctx.restore();
    }
  } else {
    drawCustomItemSprite(ctx, itemId);
  }

  const url = canvas.toDataURL();
  iconCache.set(itemId, url);
  return url;
}

function drawCustomItemSprite(ctx: CanvasRenderingContext2D, itemId: string) {
  const p = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x * 2, y * 2, w * 2, h * 2);
  };

  if (itemId === 'stick') {
    for (let i = 3; i <= 12; i++) {
      p(i, 15 - i, 2, 2, i % 2 === 0 ? '#8c5e34' : '#6e4724');
    }
    return;
  }

  if (itemId === 'coal') {
    p(5, 4, 6, 8, '#1e2024');
    p(4, 6, 8, 5, '#2b2e34');
    p(6, 5, 2, 2, '#474c54');
    return;
  }

  if (itemId === 'iron_ingot' || itemId === 'gold_ingot') {
    const main = itemId === 'gold_ingot' ? '#f5c72e' : '#d8dce0';
    const hi = itemId === 'gold_ingot' ? '#fff08a' : '#ffffff';
    const sh = itemId === 'gold_ingot' ? '#b8820a' : '#8d949c';
    p(3, 7, 10, 4, main);
    p(4, 6, 8, 2, hi);
    p(3, 10, 10, 2, sh);
    return;
  }

  if (itemId === 'diamond') {
    p(5, 4, 6, 8, '#38e3e8');
    p(4, 6, 8, 4, '#24c4ca');
    p(6, 5, 3, 2, '#b6ffff');
    return;
  }

  if (itemId === 'wool') {
    p(3, 3, 10, 10, '#f1f5f9');
    p(4, 4, 3, 3, '#ffffff');
    p(9, 9, 3, 3, '#cbd5e1');
    return;
  }

  if (itemId.endsWith('_pickaxe')) {
    const tier = itemId.split('_')[0];
    const head =
      tier === 'diamond' ? '#3ae5eb' : tier === 'iron' ? '#d9dfe6' : tier === 'stone' ? '#8c9199' : '#b8874d';
    const hi =
      tier === 'diamond' ? '#a6ffff' : tier === 'iron' ? '#ffffff' : tier === 'stone' ? '#b4bac2' : '#d6a569';
    // Handle
    for (let i = 3; i <= 11; i++) {
      p(i, 15 - i, 1, 2, '#7d522b');
    }
    // Curved pick head
    p(6, 2, 6, 2, head);
    p(10, 3, 3, 2, head);
    p(11, 4, 2, 5, head);
    p(7, 2, 4, 1, hi);
    return;
  }

  if (itemId.endsWith('_sword')) {
    const tier = itemId.split('_')[0];
    const blade =
      tier === 'diamond' ? '#3ae5eb' : tier === 'iron' ? '#d9dfe6' : tier === 'stone' ? '#8c9199' : '#b8874d';
    const hi =
      tier === 'diamond' ? '#a6ffff' : tier === 'iron' ? '#ffffff' : tier === 'stone' ? '#b4bac2' : '#d6a569';
    // Blade diagonal
    for (let i = 6; i <= 13; i++) {
      p(i, 15 - i, 2, 2, blade);
      p(i, 14 - i, 1, 1, hi);
    }
    // Guard
    p(3, 9, 4, 2, '#694623');
    p(5, 11, 2, 2, '#694623');
    // Hilt
    p(2, 12, 2, 2, '#8c5e34');
    return;
  }

  if (itemId === 'apple') {
    p(7, 2, 1, 2, '#634121');
    p(8, 2, 2, 1, '#4ca638');
    p(4, 4, 8, 8, '#dc2626');
    p(5, 12, 6, 1, '#b91c1c');
    p(5, 5, 2, 2, '#fca5a5');
    return;
  }

  if (itemId === 'raw_beef' || itemId === 'steak' || itemId === 'raw_pork' || itemId === 'cooked_pork') {
    const isCooked = itemId === 'steak' || itemId === 'cooked_pork';
    const isPork = itemId.includes('pork');
    const main = isCooked ? (isPork ? '#c77c4e' : '#7c3f23') : (isPork ? '#f2949c' : '#c9343b');
    const fat = isCooked ? '#e3b28d' : '#fbd0d4';
    p(3, 5, 10, 6, main);
    p(4, 4, 7, 8, main);
    p(5, 6, 4, 2, fat);
    return;
  }

  // Fallback square
  p(4, 4, 8, 8, '#a1a1aa');
}
