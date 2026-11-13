import * as THREE from 'three';
import { SeededNoise } from './noise';
import { getTileUV } from './textures';
import { BLOCK_DEFS, BlockId, TILE } from './types';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const SEA_LEVEL = 22;

export type BiomeName = 'Plains' | 'Forest' | 'Desert' | 'Snowy Peaks' | 'Highlands';

export interface ChunkData {
  cx: number;
  cz: number;
  blocks: Uint8Array; // CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE
  opaqueMesh: THREE.Mesh | null;
  liquidMesh: THREE.Mesh | null;
  dirty: boolean;
}

export interface RaycastHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  blockId: BlockId;
  distance: number;
}

const FACE_DIRS: {
  dir: [number, number, number];
  corners: [number, number, number][];
  uvOrder: [number, number][];
  shade: number;
  face: 'top' | 'bottom' | 'front' | 'side';
}[] = [
  // +Y Top
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 1.0,
    face: 'top',
  },
  // -Y Bottom
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.55,
    face: 'bottom',
  },
  // +Z Front
  {
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.85,
    face: 'front',
  },
  // -Z Back
  {
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.8,
    face: 'side',
  },
  // +X Right
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.72,
    face: 'side',
  },
  // -X Left
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.72,
    face: 'side',
  },
];

export class WorldManager {
  public noise: SeededNoise;
  public chunks = new Map<string, ChunkData>();
  public modifiedBlocks = new Map<string, BlockId>();
  public torches = new Map<string, THREE.Vector3>();
  private scene: THREE.Scene;
  private opaqueMaterial: THREE.MeshStandardMaterial;
  private liquidMaterial: THREE.MeshStandardMaterial;

  constructor(
    seed: string,
    scene: THREE.Scene,
    opaqueMaterial: THREE.MeshStandardMaterial,
    liquidMaterial: THREE.MeshStandardMaterial,
    initialModifications?: Record<string, number>
  ) {
    this.noise = new SeededNoise(seed || 'blockworld');
    this.scene = scene;
    this.opaqueMaterial = opaqueMaterial;
    this.liquidMaterial = liquidMaterial;

    if (initialModifications) {
      for (const [key, val] of Object.entries(initialModifications)) {
        this.modifiedBlocks.set(key, val as BlockId);
        if (val === BlockId.Torch) {
          const [x, y, z] = key.split(',').map(Number);
          this.torches.set(key, new THREE.Vector3(x + 0.5, y + 0.75, z + 0.5));
        }
      }
    }
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private blockIndex(lx: number, y: number, lz: number): number {
    return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
  }

  public getBiomeAt(wx: number, wz: number): { biome: BiomeName; temp: number; moisture: number } {
    const temp = this.noise.fbm2D(wx * 0.0045 + 100, wz * 0.0045 + 100, 3);
    const moisture = this.noise.fbm2D(wx * 0.005 - 200, wz * 0.005 + 300, 3);
    const ridge = Math.abs(this.noise.fbm2D(wx * 0.007 + 50, wz * 0.007 - 50, 3));

    if (temp < -0.18 || ridge > 0.34) {
      return { biome: temp < -0.05 ? 'Snowy Peaks' : 'Highlands', temp, moisture };
    }
    if (temp > 0.16 && moisture < 0.04) {
      return { biome: 'Desert', temp, moisture };
    }
    if (moisture > 0.05) {
      return { biome: 'Forest', temp, moisture };
    }
    return { biome: 'Plains', temp, moisture };
  }

  public getTerrainHeight(wx: number, wz: number): { height: number; biome: BiomeName; isRiver: boolean } {
    const { biome } = this.getBiomeAt(wx, wz);
    const base = this.noise.fbm2D(wx * 0.012, wz * 0.012, 4);
    const detail = this.noise.fbm2D(wx * 0.045 + 400, wz * 0.045 - 400, 2);
    const riverVal = Math.abs(this.noise.fbm2D(wx * 0.008 - 700, wz * 0.008 + 700, 2));

    let height = SEA_LEVEL + 3 + base * 12 + detail * 3;
    if (biome === 'Snowy Peaks') {
      height += 10 + Math.max(0, base) * 18;
    } else if (biome === 'Highlands') {
      height += 6 + Math.max(0, base) * 14;
    } else if (biome === 'Desert') {
      height = SEA_LEVEL + 2 + base * 6 + detail * 2;
    }

    const isRiver = riverVal < 0.035 && biome !== 'Snowy Peaks';
    if (isRiver) {
      const t = riverVal / 0.035;
      height = THREE.MathUtils.lerp(SEA_LEVEL - 4, height, t * t);
    }

    return {
      height: Math.max(4, Math.min(CHUNK_HEIGHT - 6, Math.floor(height))),
      biome,
      isRiver,
    };
  }

  public generateChunk(cx: number, cz: number): ChunkData {
    const key = this.chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const worldX0 = cx * CHUNK_SIZE;
    const worldZ0 = cz * CHUNK_SIZE;

    const surfaceMap: { h: number; biome: BiomeName }[] = new Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = worldX0 + lx;
        const wz = worldZ0 + lz;
        const { height, biome } = this.getTerrainHeight(wx, wz);
        surfaceMap[lz * CHUNK_SIZE + lx] = { h: height, biome };

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let block = BlockId.Air;

          if (y === 0) {
            block = BlockId.Bedrock;
          } else if (y <= height) {
            // Check 3D cave carving
            let isCave = false;
            if (y > 2 && y < height - 2) {
              const caveN = this.noise.fbm3D(wx * 0.055, y * 0.075, wz * 0.055, 2);
              const caveN2 = this.noise.fbm3D(wx * 0.04 + 90, y * 0.06, wz * 0.04 - 90, 2);
              if (Math.abs(caveN) < 0.065 && Math.abs(caveN2) < 0.14) {
                isCave = true;
              }
            }

            if (isCave) {
              block = y <= 4 ? BlockId.Lava : BlockId.Air;
            } else if (y === height) {
              if (height < SEA_LEVEL - 1) {
                block = BlockId.Sand;
              } else if (biome === 'Desert') {
                block = BlockId.Sand;
              } else if (biome === 'Snowy Peaks' || y >= 42) {
                block = BlockId.Snow;
              } else {
                block = BlockId.Grass;
              }
            } else if (y >= height - 3) {
              if (biome === 'Desert' || height < SEA_LEVEL) {
                block = BlockId.Sand;
              } else {
                block = BlockId.Dirt;
              }
            } else {
              // Stone & Underground Ores
              block = BlockId.Stone;
              const oreHash = this.noise.hashCoord(wx, y, wz);
              const oreCluster = this.noise.noise3D(wx * 0.22, y * 0.22, wz * 0.22);
              if (y < 14 && oreCluster > 0.33 && oreHash < 0.35) {
                block = BlockId.DiamondOre;
              } else if (y < 24 && oreCluster > 0.28 && oreHash < 0.45) {
                block = BlockId.GoldOre;
              } else if (y < 38 && oreCluster > 0.22 && oreHash < 0.55) {
                block = BlockId.IronOre;
              } else if (oreCluster > 0.18 && oreHash < 0.65) {
                block = BlockId.CoalOre;
              }
            }
          } else if (y <= SEA_LEVEL) {
            block = BlockId.Water;
          }

          blocks[this.blockIndex(lx, y, lz)] = block;
        }
      }
    }

    // Place procedural Trees inside chunk boundaries (lx, lz in 2..13)
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        const { h, biome } = surfaceMap[lz * CHUNK_SIZE + lx];
        if (h <= SEA_LEVEL + 1 || h > CHUNK_HEIGHT - 10) continue;
        if (biome === 'Desert') continue;

        const wx = worldX0 + lx;
        const wz = worldZ0 + lz;
        const treeChance = biome === 'Forest' ? 0.045 : biome === 'Plains' ? 0.008 : 0.014;
        const r = this.noise.hashCoord(wx, 123, wz);
        if (r < treeChance) {
          const trunkH = 4 + Math.floor(this.noise.hashCoord(wx, 456, wz) * 3);
          for (let ty = 1; ty <= trunkH; ty++) {
            blocks[this.blockIndex(lx, h + ty, lz)] = BlockId.Wood;
          }
          const leafStart = h + trunkH - 1;
          const leafEnd = h + trunkH + 2;
          for (let ly = leafStart; ly <= leafEnd; ly++) {
            const radius = ly === leafEnd ? 1 : 2;
            for (let dz = -radius; dz <= radius; dz++) {
              for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) === radius && Math.abs(dz) === radius && ly !== leafStart + 1) continue;
                const nx = lx + dx;
                const nz = lz + dz;
                if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE && ly < CHUNK_HEIGHT) {
                  const idx = this.blockIndex(nx, ly, nz);
                  if (blocks[idx] === BlockId.Air) {
                    blocks[idx] = biome === 'Snowy Peaks' && ly === leafEnd ? BlockId.Snow : BlockId.Leaves;
                  }
                }
              }
            }
          }
        }
      }
    }

    // Apply saved modifications inside this chunk
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = worldX0 + lx;
        const wz = worldZ0 + lz;
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const mod = this.modifiedBlocks.get(`${wx},${y},${wz}`);
          if (mod !== undefined) {
            blocks[this.blockIndex(lx, y, lz)] = mod;
          }
        }
      }
    }

    const chunk: ChunkData = {
      cx,
      cz,
      blocks,
      opaqueMesh: null,
      liquidMesh: null,
      dirty: true,
    };
    this.chunks.set(key, chunk);
    return chunk;
  }

  public getBlock(wx: number, y: number, wz: number): BlockId {
    if (y < 0) return BlockId.Bedrock;
    if (y >= CHUNK_HEIGHT) return BlockId.Air;

    const ix = Math.floor(wx);
    const iy = Math.floor(y);
    const iz = Math.floor(wz);

    const mod = this.modifiedBlocks.get(`${ix},${iy},${iz}`);
    if (mod !== undefined) return mod;

    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return BlockId.Air;

    const lx = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((iz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.blocks[this.blockIndex(lx, iy, lz)] as BlockId;
  }

  public setBlock(wx: number, y: number, wz: number, blockId: BlockId): void {
    const ix = Math.floor(wx);
    const iy = Math.floor(y);
    const iz = Math.floor(wz);
    if (iy <= 0 || iy >= CHUNK_HEIGHT) return;

    const key = `${ix},${iy},${iz}`;
    const prev = this.getBlock(ix, iy, iz);
    if (prev === BlockId.Torch && blockId !== BlockId.Torch) {
      this.torches.delete(key);
    }
    if (blockId === BlockId.Torch) {
      this.torches.set(key, new THREE.Vector3(ix + 0.5, iy + 0.75, iz + 0.5));
    }

    this.modifiedBlocks.set(key, blockId);

    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const lx = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((iz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (chunk) {
      chunk.blocks[this.blockIndex(lx, iy, lz)] = blockId;
      chunk.dirty = true;
    }

    // Mark neighbor chunks dirty if on boundary
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
  }

  private markDirty(cx: number, cz: number) {
    const ch = this.chunks.get(this.chunkKey(cx, cz));
    if (ch) ch.dirty = true;
  }

  public getSurfaceY(wx: number, wz: number): number {
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    if (!this.chunks.has(this.chunkKey(cx, cz))) {
      this.generateChunk(cx, cz);
    }
    for (let y = CHUNK_HEIGHT - 2; y >= 1; y--) {
      const b = this.getBlock(ix, y, iz);
      if (BLOCK_DEFS[b].solid) {
        return y + 1;
      }
    }
    return SEA_LEVEL + 2;
  }

  public updateChunksAround(playerX: number, playerZ: number, renderDistance: number): void {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // Unload distant chunks
    for (const [key, chunk] of this.chunks.entries()) {
      if (Math.abs(chunk.cx - pcx) > renderDistance + 1 || Math.abs(chunk.cz - pcz) > renderDistance + 1) {
        this.disposeChunkMeshes(chunk);
        this.chunks.delete(key);
      }
    }

    // Generate & build dirty chunks (limit new builds per frame to keep framerate silky)
    let builtThisTick = 0;
    const coords: { cx: number; cz: number; dist: number }[] = [];
    for (let dz = -renderDistance; dz <= renderDistance; dz++) {
      for (let dx = -renderDistance; dx <= renderDistance; dx++) {
        coords.push({ cx: pcx + dx, cz: pcz + dz, dist: dx * dx + dz * dz });
      }
    }
    coords.sort((a, b) => a.dist - b.dist);

    for (const { cx, cz } of coords) {
      const key = this.chunkKey(cx, cz);
      let chunk = this.chunks.get(key);
      if (!chunk) {
        chunk = this.generateChunk(cx, cz);
      }
      if (chunk.dirty && builtThisTick < 3) {
        this.buildChunkMesh(chunk);
        chunk.dirty = false;
        builtThisTick++;
      }
    }
  }

  public ensureImmediateArea(playerX: number, playerZ: number, radius = 2): void {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunk = this.generateChunk(pcx + dx, pcz + dz);
        if (chunk.dirty) {
          this.buildChunkMesh(chunk);
          chunk.dirty = false;
        }
      }
    }
  }

  private isSolidForAO(wx: number, y: number, wz: number): boolean {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const b = this.getBlock(wx, y, wz);
    return b !== BlockId.Air && !BLOCK_DEFS[b].transparent;
  }

  private buildChunkMesh(chunk: ChunkData): void {
    this.disposeChunkMeshes(chunk);

    const oPos: number[] = [];
    const oNorm: number[] = [];
    const oUV: number[] = [];
    const oCol: number[] = [];
    const oIdx: number[] = [];

    const lPos: number[] = [];
    const lNorm: number[] = [];
    const lUV: number[] = [];
    const lCol: number[] = [];
    const lIdx: number[] = [];

    const worldX0 = chunk.cx * CHUNK_SIZE;
    const worldZ0 = chunk.cz * CHUNK_SIZE;

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const blockId = chunk.blocks[this.blockIndex(lx, y, lz)] as BlockId;
          if (blockId === BlockId.Air) continue;

          const def = BLOCK_DEFS[blockId];
          const wx = worldX0 + lx;
          const wz = worldZ0 + lz;

          // Custom Torch geometry (thin vertical stick)
          if (blockId === BlockId.Torch) {
            const [u0, v0, u1, v1] = getTileUV(TILE.TORCH);
            const uMid0 = u0 + (u1 - u0) * 0.42;
            const uMid1 = u0 + (u1 - u0) * 0.58;
            const vTop = v1 - (v1 - v0) * 0.06;
            const vBot = v0 + (v1 - v0) * 0.05;
            const r = 0.09;
            const h = 0.68;

            for (const f of FACE_DIRS) {
              const baseIdx = oPos.length / 3;
              for (let c = 0; c < 4; c++) {
                const cx = f.corners[c][0] === 0 ? 0.5 - r : 0.5 + r;
                const cy = f.corners[c][1] === 0 ? 0 : h;
                const cz = f.corners[c][2] === 0 ? 0.5 - r : 0.5 + r;
                oPos.push(wx + cx, y + cy, wz + cz);
                oNorm.push(f.dir[0], f.dir[1], f.dir[2]);
                const [uu, vv] = f.uvOrder[c];
                oUV.push(uu === 0 ? uMid0 : uMid1, vv === 0 ? vBot : vTop);
                oCol.push(1.0, 0.96, 0.85);
              }
              oIdx.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
            }
            continue;
          }

          const isLiquid = def.liquid;

          for (const f of FACE_DIRS) {
            const nx = wx + f.dir[0];
            const ny = y + f.dir[1];
            const nz = wz + f.dir[2];

            const neighbor = this.getBlock(nx, ny, nz);
            const nDef = BLOCK_DEFS[neighbor];

            if (isLiquid) {
              // Only draw liquid face if neighbor is air or non-liquid transparent
              if (neighbor === blockId || (!nDef.transparent && nDef.solid)) continue;
            } else {
              // Opaque/leaves/glass block: cull face if neighbor is opaque solid
              if (!nDef.transparent && nDef.solid) continue;
              if (blockId === BlockId.Glass && neighbor === BlockId.Glass) continue;
            }

            const tileIdx =
              f.face === 'top'
                ? def.textures.top
                : f.face === 'bottom'
                  ? def.textures.bottom
                  : f.face === 'front' && def.textures.front !== undefined
                    ? def.textures.front
                    : def.textures.side;

            const [u0, v0, u1, v1] = getTileUV(tileIdx);

            const targetPos = isLiquid ? lPos : oPos;
            const targetNorm = isLiquid ? lNorm : oNorm;
            const targetUV = isLiquid ? lUV : oUV;
            const targetCol = isLiquid ? lCol : oCol;
            const targetIdx = isLiquid ? lIdx : oIdx;

            const baseIdx = targetPos.length / 3;
            const topDrop = isLiquid && this.getBlock(wx, y + 1, wz) !== blockId ? 0.12 : 0;

            for (let c = 0; c < 4; c++) {
              const corner = f.corners[c];
              const vy = corner[1] === 1 ? y + 1 - topDrop : y;
              targetPos.push(wx + corner[0], vy, wz + corner[2]);
              targetNorm.push(f.dir[0], f.dir[1], f.dir[2]);

              const [uu, vv] = f.uvOrder[c];
              targetUV.push(uu === 0 ? u0 : u1, vv === 0 ? v0 : v1);

              // Ambient occlusion per corner for opaque blocks
              let ao = 1.0;
              if (!isLiquid && !def.transparent) {
                const sx = corner[0] === 1 ? 1 : -1;
                const sy = corner[1] === 1 ? 1 : -1;
                const sz = corner[2] === 1 ? 1 : -1;
                let occ = 0;
                if (f.dir[1] !== 0) {
                  if (this.isSolidForAO(wx + sx, ny, wz)) occ++;
                  if (this.isSolidForAO(wx, ny, wz + sz)) occ++;
                  if (this.isSolidForAO(wx + sx, ny, wz + sz)) occ++;
                } else if (f.dir[0] !== 0) {
                  if (this.isSolidForAO(nx, y + sy, wz)) occ++;
                  if (this.isSolidForAO(nx, y, wz + sz)) occ++;
                  if (this.isSolidForAO(nx, y + sy, wz + sz)) occ++;
                } else {
                  if (this.isSolidForAO(wx + sx, y, nz)) occ++;
                  if (this.isSolidForAO(wx, y + sy, nz)) occ++;
                  if (this.isSolidForAO(wx + sx, y + sy, nz)) occ++;
                }
                ao = 1.0 - occ * 0.14;
              }

              const light = f.shade * ao;
              if (blockId === BlockId.Lava) {
                targetCol.push(1.25, 0.95, 0.85);
              } else {
                targetCol.push(light, light, light);
              }
            }

            targetIdx.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
          }
        }
      }
    }

    if (oPos.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(oPos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(oNorm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(oUV, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(oCol, 3));
      geo.setIndex(oIdx);
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, this.opaqueMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      this.scene.add(mesh);
      chunk.opaqueMesh = mesh;
    }

    if (lPos.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(lPos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(lNorm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(lUV, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(lCol, 3));
      geo.setIndex(lIdx);
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, this.liquidMaterial);
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      chunk.liquidMesh = mesh;
    }
  }

  private disposeChunkMeshes(chunk: ChunkData): void {
    if (chunk.opaqueMesh) {
      this.scene.remove(chunk.opaqueMesh);
      chunk.opaqueMesh.geometry.dispose();
      chunk.opaqueMesh = null;
    }
    if (chunk.liquidMesh) {
      this.scene.remove(chunk.liquidMesh);
      chunk.liquidMesh.geometry.dispose();
      chunk.liquidMesh = null;
    }
  }

  public disposeAll(): void {
    for (const chunk of this.chunks.values()) {
      this.disposeChunkMeshes(chunk);
    }
    this.chunks.clear();
  }

  // Fast DDA Voxel Raycast (Amanatides & Woo)
  public raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDistance = 6.0): RaycastHit | null {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;

    const tDeltaX = Math.abs(dir.x) > 1e-6 ? Math.abs(1 / dir.x) : 1e9;
    const tDeltaY = Math.abs(dir.y) > 1e-6 ? Math.abs(1 / dir.y) : 1e9;
    const tDeltaZ = Math.abs(dir.z) > 1e-6 ? Math.abs(1 / dir.z) : 1e9;

    let tMaxX =
      Math.abs(dir.x) > 1e-6
        ? ((dir.x >= 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX)
        : 1e9;
    let tMaxY =
      Math.abs(dir.y) > 1e-6
        ? ((dir.y >= 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY)
        : 1e9;
    let tMaxZ =
      Math.abs(dir.z) > 1e-6
        ? ((dir.z >= 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ)
        : 1e9;

    let nx = 0;
    let ny = 0;
    let nz = 0;
    let dist = 0;

    for (let i = 0; i < 64; i++) {
      if (y >= 0 && y < CHUNK_HEIGHT) {
        const blockId = this.getBlock(x, y, z);
        if (blockId !== BlockId.Air && !BLOCK_DEFS[blockId].liquid) {
          return { x, y, z, nx, ny, nz, blockId, distance: dist };
        }
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          x += stepX;
          tMaxX += tDeltaX;
          nx = -stepX;
          ny = 0;
          nz = 0;
        } else {
          dist = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          y += stepY;
          tMaxY += tDeltaY;
          nx = 0;
          ny = -stepY;
          nz = 0;
        } else {
          dist = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      }

      if (dist > maxDistance) break;
    }

    return null;
  }
}
