import * as THREE from 'three';
import { BLOCK_DEFS, BlockId, Difficulty, ITEM_DEFS } from './types';
import { WorldManager } from './world';

export type MobKind = 'cow' | 'pig' | 'sheep' | 'zombie' | 'skeleton';

export interface MobEntity {
  id: number;
  kind: MobKind;
  hostile: boolean;
  group: THREE.Group;
  head: THREE.Object3D;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  meshes: THREE.Mesh[];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  targetYaw: number;
  health: number;
  maxHealth: number;
  hurtTimer: number;
  aiTimer: number;
  attackCooldown: number;
  walkPhase: number;
  isMoving: boolean;
  onGround: boolean;
  radius: number;
  height: number;
}

export interface DroppedItemEntity {
  id: number;
  itemId: string;
  count: number;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
}

export interface ParticleEntity {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const _matCache = new Map<string, THREE.MeshStandardMaterial>();
function getMobMat(hex: number, roughness = 0.85, emissive = 0x000000): THREE.MeshStandardMaterial {
  const key = `${hex}_${roughness}_${emissive}`;
  let mat = _matCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness,
      metalness: 0.04,
      emissive,
      emissiveIntensity: emissive ? 0.45 : 0,
    });
    _matCache.set(key, mat);
  }
  return mat;
}

function makePart(
  w: number,
  h: number,
  d: number,
  color: number,
  roughness = 0.85,
  emissive = 0x000000
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, getMobMat(color, roughness, emissive).clone());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createMobModel(kind: MobKind): {
  group: THREE.Group;
  head: THREE.Object3D;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  meshes: THREE.Mesh[];
  radius: number;
  height: number;
} {
  const group = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  const meshes: THREE.Mesh[] = [];
  const headGroup = new THREE.Group();

  const register = (m: THREE.Mesh) => {
    meshes.push(m);
    return m;
  };

  if (kind === 'cow' || kind === 'pig' || kind === 'sheep') {
    const isCow = kind === 'cow';
    const isPig = kind === 'pig';
    const bodyColor = isCow ? 0x4b382a : isPig ? 0xf2a2a8 : 0xf1f5f9;
    const accentColor = isCow ? 0xebe5dc : isPig ? 0xe07e86 : 0xd6c7b4;
    const legH = isPig ? 0.36 : 0.48;
    const bodyW = isCow ? 0.72 : 0.64;
    const bodyH = isCow ? 0.62 : 0.52;
    const bodyD = isCow ? 1.15 : 0.96;

    // 1. Body
    const body = register(makePart(bodyW, bodyH, bodyD, bodyColor, 0.88));
    body.position.set(0, legH + bodyH / 2, 0);
    group.add(body);

    // Saddle/patches or wool fleece detail
    const patch = register(
      makePart(bodyW + 0.03, bodyH * 0.55, bodyD * 0.45, accentColor, isCow ? 0.72 : 0.95)
    );
    patch.position.set(0, legH + bodyH * 0.62, -0.08);
    group.add(patch);

    // 2. Head group
    const headSize = isCow ? 0.48 : 0.44;
    headGroup.position.set(0, legH + bodyH * 0.72, bodyD / 2 + headSize * 0.38);
    const skull = register(
      makePart(headSize, headSize, headSize, isCow ? 0x4b382a : isPig ? 0xf2a2a8 : 0xe4d5c3, 0.8)
    );
    headGroup.add(skull);

    // Snout
    const snout = register(
      makePart(
        headSize * 0.68,
        headSize * 0.4,
        0.14,
        isCow ? 0xd9c2b2 : isPig ? 0xf7b9be : 0xc4b09b,
        0.65
      )
    );
    snout.position.set(0, -headSize * 0.16, headSize / 2 + 0.05);
    headGroup.add(snout);

    // Eyes
    const eyeL = register(makePart(0.08, 0.08, 0.05, 0x18181b, 0.3));
    eyeL.position.set(-headSize * 0.3, headSize * 0.1, headSize / 2 + 0.01);
    const eyeR = register(makePart(0.08, 0.08, 0.05, 0x18181b, 0.3));
    eyeR.position.set(headSize * 0.3, headSize * 0.1, headSize / 2 + 0.01);
    headGroup.add(eyeL, eyeR);

    if (isCow) {
      const hornL = register(makePart(0.09, 0.16, 0.09, 0xd4d4d8, 0.45));
      hornL.position.set(-headSize * 0.42, headSize * 0.52, 0);
      const hornR = register(makePart(0.09, 0.16, 0.09, 0xd4d4d8, 0.45));
      hornR.position.set(headSize * 0.42, headSize * 0.52, 0);
      headGroup.add(hornL, hornR);
    }

    group.add(headGroup);

    // 3. Four articulated legs pivoted at hip
    const legPositions: [number, number][] = [
      [-bodyW * 0.3, bodyD * 0.32],
      [bodyW * 0.3, bodyD * 0.32],
      [-bodyW * 0.3, -bodyD * 0.32],
      [bodyW * 0.3, -bodyD * 0.32],
    ];
    for (const [lx, lz] of legPositions) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, legH, lz);
      const legMesh = register(
        makePart(0.19, legH, 0.19, isCow ? 0x3b2b20 : isPig ? 0xe8939a : 0x52525b, 0.85)
      );
      legMesh.position.set(0, -legH / 2, 0);
      pivot.add(legMesh);
      group.add(pivot);
      legs.push(pivot);
    }

    return {
      group,
      head: headGroup,
      legs,
      arms,
      meshes,
      radius: 0.48,
      height: legH + bodyH + 0.25,
    };
  }

  // Hostile humanoid voxel mobs: Zombie & Skeleton
  const isZombie = kind === 'zombie';
  const skinColor = isZombie ? 0x4f7d44 : 0xd6d9de;
  const shirtColor = isZombie ? 0x2a7a8c : 0x3f444e;
  const pantsColor = isZombie ? 0x3b3678 : 0x2c3038;
  const eyeColor = isZombie ? 0xb91c1c : 0xef4444;

  // Legs (0.72 tall)
  const legW = isZombie ? 0.24 : 0.14;
  for (const lx of [-0.14, 0.14]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.72, 0);
    const leg = register(makePart(legW, 0.72, legW, pantsColor, 0.88));
    leg.position.set(0, -0.36, 0);
    pivot.add(leg);
    group.add(pivot);
    legs.push(pivot);
  }

  // Torso
  const torso = register(makePart(0.52, 0.68, 0.28, shirtColor, 0.85));
  torso.position.set(0, 1.06, 0);
  group.add(torso);

  // Chest plate / rib accent
  const rib = register(makePart(0.42, 0.3, 0.3, isZombie ? 0x226270 : 0xc4c9d1, 0.65));
  rib.position.set(0, 1.12, 0.01);
  group.add(rib);

  // Head
  headGroup.position.set(0, 1.4, 0);
  const skull = register(makePart(0.46, 0.46, 0.46, skinColor, 0.78));
  skull.position.set(0, 0.23, 0);
  const eyeL = register(makePart(0.09, 0.07, 0.05, eyeColor, 0.3, eyeColor));
  eyeL.position.set(-0.1, 0.25, 0.23);
  const eyeR = register(makePart(0.09, 0.07, 0.05, eyeColor, 0.3, eyeColor));
  eyeR.position.set(0.1, 0.25, 0.23);
  headGroup.add(skull, eyeL, eyeR);
  group.add(headGroup);

  // Extended Zombie/Skeleton Arms
  const armW = isZombie ? 0.2 : 0.13;
  for (const ax of [-0.36, 0.36]) {
    const pivot = new THREE.Group();
    pivot.position.set(ax, 1.34, 0);
    const arm = register(makePart(armW, 0.64, armW, skinColor, 0.8));
    arm.position.set(0, -0.26, 0.16);
    arm.rotation.x = -Math.PI * 0.38;
    pivot.add(arm);
    group.add(pivot);
    arms.push(pivot);
  }

  return {
    group,
    head: headGroup,
    legs,
    arms,
    meshes,
    radius: 0.36,
    height: 1.86,
  };
}

export class EntityManager {
  public mobs: MobEntity[] = [];
  public droppedItems: DroppedItemEntity[] = [];
  public particles: ParticleEntity[] = [];
  private nextId = 1;
  private scene: THREE.Scene;
  private atlasMaterial: THREE.MeshStandardMaterial;
  private spawnTimer = 0;

  constructor(scene: THREE.Scene, atlasMaterial: THREE.MeshStandardMaterial) {
    this.scene = scene;
    this.atlasMaterial = atlasMaterial;
  }

  public spawnInitialAnimals(world: WorldManager, px: number, pz: number) {
    const kinds: MobKind[] = ['cow', 'pig', 'sheep'];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 10 + Math.random() * 22;
      const x = Math.floor(px + Math.cos(angle) * dist) + 0.5;
      const z = Math.floor(pz + Math.sin(angle) * dist) + 0.5;
      const y = world.getSurfaceY(x, z);
      if (y > 22) {
        this.spawnMob(kinds[i % kinds.length], x, y + 0.1, z);
      }
    }
  }

  public spawnMob(kind: MobKind, x: number, y: number, z: number): MobEntity {
    const model = createMobModel(kind);
    model.group.position.set(x, y, z);
    this.scene.add(model.group);

    const hostile = kind === 'zombie' || kind === 'skeleton';
    const maxHealth = kind === 'cow' ? 10 : kind === 'pig' || kind === 'sheep' ? 8 : 16;

    const mob: MobEntity = {
      id: this.nextId++,
      kind,
      hostile,
      group: model.group,
      head: model.head,
      legs: model.legs,
      arms: model.arms,
      meshes: model.meshes,
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      targetYaw: Math.random() * Math.PI * 2,
      health: maxHealth,
      maxHealth,
      hurtTimer: 0,
      aiTimer: Math.random() * 3,
      attackCooldown: 0,
      walkPhase: Math.random() * 6,
      isMoving: false,
      onGround: false,
      radius: model.radius,
      height: model.height,
    };
    this.mobs.push(mob);
    return mob;
  }

  public spawnDroppedItem(itemId: string, count: number, x: number, y: number, z: number) {
    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const def = ITEM_DEFS[itemId];
    let mat: THREE.MeshStandardMaterial;
    if (def?.blockId !== undefined) {
      mat = this.atlasMaterial;
      // Set UVs to tile of the block's top/side texture
      const bdef = BLOCK_DEFS[def.blockId];
      const tile = bdef.textures.top;
      const col = tile % 16;
      const row = Math.floor(tile / 16);
      const step = 1 / 16;
      const u0 = col * step + 0.002;
      const u1 = (col + 1) * step - 0.002;
      const v1 = 1 - row * step - 0.002;
      const v0 = 1 - (row + 1) * step + 0.002;
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const ou = uv.getX(i);
        const ov = uv.getY(i);
        uv.setXY(i, ou < 0.5 ? u0 : u1, ov < 0.5 ? v0 : v1);
      }
      uv.needsUpdate = true;
    } else {
      const color =
        itemId.includes('diamond')
          ? 0x38e3e8
          : itemId.includes('gold')
            ? 0xf5c72e
            : itemId.includes('iron')
              ? 0xd8dce0
              : itemId === 'coal'
                ? 0x24262b
                : itemId === 'apple'
                  ? 0xdc2626
                  : itemId.includes('beef') || itemId === 'steak'
                    ? 0x99352b
                    : itemId.includes('pork')
                      ? 0xf2949c
                      : 0xe2e8f0;
      mat = getMobMat(color, 0.55);
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    this.droppedItems.push({
      id: this.nextId++,
      itemId,
      count,
      mesh,
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2.4, 3.2, (Math.random() - 0.5) * 2.4),
      age: 0,
    });
  }

  public spawnBlockParticles(x: number, y: number, z: number, blockId: BlockId) {
    const color =
      blockId === BlockId.Grass
        ? 0x559e36
        : blockId === BlockId.Dirt
          ? 0x7a5234
          : blockId === BlockId.Sand
            ? 0xe5d59c
            : blockId === BlockId.Wood || blockId === BlockId.Planks
              ? 0x8f6237
              : blockId === BlockId.Leaves
                ? 0x387b22
                : blockId === BlockId.Snow
                  ? 0xf1f5f9
                  : blockId === BlockId.DiamondOre
                    ? 0x4be8e8
                    : blockId === BlockId.GoldOre
                      ? 0xf7d034
                      : 0x7c8085;

    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = getMobMat(color, 0.9);
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        x + 0.2 + Math.random() * 0.6,
        y + 0.2 + Math.random() * 0.6,
        z + 0.2 + Math.random() * 0.6
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4.5,
          1.8 + Math.random() * 3.0,
          (Math.random() - 0.5) * 4.5
        ),
        life: 0,
        maxLife: 0.45 + Math.random() * 0.25,
      });
    }
  }

  public damageMob(
    mob: MobEntity,
    amount: number,
    knockDir: THREE.Vector3,
    onKill?: (mob: MobEntity) => void
  ): boolean {
    mob.health -= amount;
    mob.hurtTimer = 0.25;
    mob.velocity.x += knockDir.x * 5.5;
    mob.velocity.z += knockDir.z * 5.5;
    mob.velocity.y = Math.max(mob.velocity.y, 3.6);

    if (mob.health <= 0) {
      this.removeMob(mob);
      onKill?.(mob);
      return true;
    }
    return false;
  }

  private removeMob(mob: MobEntity) {
    this.scene.remove(mob.group);
    mob.meshes.forEach((m) => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.mobs = this.mobs.filter((m) => m.id !== mob.id);
  }

  public update(
    dt: number,
    world: WorldManager,
    playerPos: THREE.Vector3,
    isNight: boolean,
    difficulty: Difficulty,
    isCreative: boolean,
    onPlayerHit: (damage: number, knockDir: THREE.Vector3) => void,
    onCollectItem: (itemId: string, count: number) => boolean
  ) {
    // Periodic spawning of animals & nighttime hostile mobs
    this.spawnTimer += dt;
    if (this.spawnTimer > 3.5) {
      this.spawnTimer = 0;
      const passiveCount = this.mobs.filter((m) => !m.hostile).length;
      const hostileCount = this.mobs.filter((m) => m.hostile).length;

      if (passiveCount < 10) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 16 + Math.random() * 18;
        const sx = Math.floor(playerPos.x + Math.cos(angle) * dist) + 0.5;
        const sz = Math.floor(playerPos.z + Math.sin(angle) * dist) + 0.5;
        const sy = world.getSurfaceY(sx, sz);
        if (sy > 22) {
          const kinds: MobKind[] = ['cow', 'pig', 'sheep'];
          this.spawnMob(kinds[Math.floor(Math.random() * kinds.length)], sx, sy + 0.1, sz);
        }
      }

      if (isNight && difficulty !== 'peaceful' && hostileCount < 6) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 14 + Math.random() * 16;
        const sx = Math.floor(playerPos.x + Math.cos(angle) * dist) + 0.5;
        const sz = Math.floor(playerPos.z + Math.sin(angle) * dist) + 0.5;
        const sy = world.getSurfaceY(sx, sz);
        if (sy > 20) {
          this.spawnMob(Math.random() > 0.4 ? 'zombie' : 'skeleton', sx, sy + 0.1, sz);
        }
      }
    }

    // Update mobs
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      const distToPlayer = mob.position.distanceTo(playerPos);

      // Despawn very far mobs
      if (distToPlayer > 68) {
        this.removeMob(mob);
        continue;
      }

      // Despawn hostile mobs on Peaceful or slowly burn at midday
      if (mob.hostile && difficulty === 'peaceful') {
        this.removeMob(mob);
        continue;
      }

      if (mob.hurtTimer > 0) {
        mob.hurtTimer -= dt;
        const tint = mob.hurtTimer > 0 ? 0xff4444 : 0x000000;
        for (const m of mob.meshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.emissive.getHex() !== 0xb91c1c && mat.emissive.getHex() !== 0xef4444) {
            mat.emissive.setHex(tint);
            mat.emissiveIntensity = mob.hurtTimer > 0 ? 0.65 : 0;
          }
        }
      }

      if (mob.attackCooldown > 0) mob.attackCooldown -= dt;

      // AI Decision
      if (mob.hostile && !isCreative && distToPlayer < 22) {
        const dx = playerPos.x - mob.position.x;
        const dz = playerPos.z - mob.position.z;
        mob.targetYaw = Math.atan2(dx, dz);
        mob.isMoving = distToPlayer > 1.25;

        if (distToPlayer < 1.55 && Math.abs(playerPos.y - mob.position.y) < 1.8 && mob.attackCooldown <= 0) {
          mob.attackCooldown = 1.1;
          const baseDmg = difficulty === 'easy' ? 2 : difficulty === 'hard' ? 5 : 3;
          const knock = new THREE.Vector3(dx, 0, dz).normalize();
          onPlayerHit(baseDmg, knock);
        }
      } else {
        mob.aiTimer -= dt;
        if (mob.aiTimer <= 0) {
          mob.aiTimer = 1.8 + Math.random() * 3.5;
          mob.isMoving = Math.random() > 0.35;
          mob.targetYaw = mob.yaw + (Math.random() - 0.5) * Math.PI * 1.4;
        }
      }

      // Smooth rotation
      let diff = mob.targetYaw - mob.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      mob.yaw += diff * Math.min(1, dt * 6);

      const moveSpeed = mob.hostile ? (mob.kind === 'skeleton' ? 3.2 : 2.7) : mob.hurtTimer > 0 ? 3.6 : 1.5;
      if (mob.isMoving) {
        mob.velocity.x = THREE.MathUtils.lerp(mob.velocity.x, Math.sin(mob.yaw) * moveSpeed, dt * 6);
        mob.velocity.z = THREE.MathUtils.lerp(mob.velocity.z, Math.cos(mob.yaw) * moveSpeed, dt * 6);
      } else {
        mob.velocity.x = THREE.MathUtils.lerp(mob.velocity.x, 0, dt * 8);
        mob.velocity.z = THREE.MathUtils.lerp(mob.velocity.z, 0, dt * 8);
      }

      // Gravity & Voxel Collision
      mob.velocity.y -= 20 * dt;
      const nextX = mob.position.x + mob.velocity.x * dt;
      const nextZ = mob.position.z + mob.velocity.z * dt;

      const blockedX = this.isSolidAt(world, nextX, mob.position.y + 0.3, mob.position.z, mob.radius);
      if (!blockedX) {
        mob.position.x = nextX;
      } else if (mob.onGround) {
        mob.velocity.y = 6.2; // jump over 1-block ledge
      }

      const blockedZ = this.isSolidAt(world, mob.position.x, mob.position.y + 0.3, nextZ, mob.radius);
      if (!blockedZ) {
        mob.position.z = nextZ;
      } else if (mob.onGround) {
        mob.velocity.y = 6.2;
      }

      const nextY = mob.position.y + mob.velocity.y * dt;
      const floorBlock = world.getBlock(Math.floor(mob.position.x), Math.floor(nextY), Math.floor(mob.position.z));
      if (mob.velocity.y <= 0 && BLOCK_DEFS[floorBlock].solid) {
        mob.position.y = Math.floor(nextY) + 1;
        mob.velocity.y = 0;
        mob.onGround = true;
      } else {
        mob.position.y = nextY;
        mob.onGround = false;
      }

      // Water buoyancy
      const inWater = world.getBlock(Math.floor(mob.position.x), Math.floor(mob.position.y + 0.4), Math.floor(mob.position.z)) === BlockId.Water;
      if (inWater) {
        mob.velocity.y += 28 * dt;
        mob.velocity.y = Math.min(mob.velocity.y, 2.5);
      }

      mob.group.position.copy(mob.position);
      mob.group.rotation.y = mob.yaw;

      // Limb walk animation
      if (mob.isMoving && mob.onGround) {
        mob.walkPhase += dt * moveSpeed * 3.8;
        const swing = Math.sin(mob.walkPhase) * 0.55;
        if (mob.legs.length >= 4) {
          mob.legs[0].rotation.x = swing;
          mob.legs[1].rotation.x = -swing;
          mob.legs[2].rotation.x = -swing;
          mob.legs[3].rotation.x = swing;
        } else if (mob.legs.length === 2) {
          mob.legs[0].rotation.x = swing;
          mob.legs[1].rotation.x = -swing;
        }
      } else {
        for (const l of mob.legs) {
          l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, 0, dt * 8);
        }
      }
    }

    // Update dropped items (gravity, spin, magnetic pickup)
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];
      item.age += dt;
      item.velocity.y -= 16 * dt;

      const nx = item.position.x + item.velocity.x * dt;
      const nz = item.position.z + item.velocity.z * dt;
      if (!BLOCK_DEFS[world.getBlock(Math.floor(nx), Math.floor(item.position.y + 0.15), Math.floor(nz))].solid) {
        item.position.x = nx;
        item.position.z = nz;
      }

      const ny = item.position.y + item.velocity.y * dt;
      if (item.velocity.y <= 0 && BLOCK_DEFS[world.getBlock(Math.floor(item.position.x), Math.floor(ny - 0.14), Math.floor(item.position.z))].solid) {
        item.position.y = Math.floor(ny - 0.14) + 1 + 0.16;
        item.velocity.y = 0;
        item.velocity.x *= 0.8;
        item.velocity.z *= 0.8;
      } else {
        item.position.y = ny;
      }

      // Magnetize toward player
      const dx = playerPos.x - item.position.x;
      const dy = playerPos.y + 0.8 - item.position.y;
      const dz = playerPos.z - item.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (item.age > 0.35 && dist < 2.6) {
        item.position.x += (dx / dist) * 7.5 * dt;
        item.position.y += (dy / dist) * 7.5 * dt;
        item.position.z += (dz / dist) * 7.5 * dt;
      }
      if (item.age > 0.35 && dist < 0.85) {
        if (onCollectItem(item.itemId, item.count)) {
          this.scene.remove(item.mesh);
          item.mesh.geometry.dispose();
          this.droppedItems.splice(i, 1);
          continue;
        }
      }

      if (item.age > 120) {
        this.scene.remove(item.mesh);
        item.mesh.geometry.dispose();
        this.droppedItems.splice(i, 1);
        continue;
      }

      item.mesh.position.set(
        item.position.x,
        item.position.y + Math.sin(item.age * 3.5) * 0.08,
        item.position.z
      );
      item.mesh.rotation.y = item.age * 2.1;
    }

    // Update block break particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.velocity.y -= 18 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      const s = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(s);
    }
  }

  private isSolidAt(world: WorldManager, x: number, y: number, z: number, r: number): boolean {
    const checks = [
      [x - r, z - r],
      [x + r, z - r],
      [x - r, z + r],
      [x + r, z + r],
    ];
    for (const [cx, cz] of checks) {
      const b1 = world.getBlock(Math.floor(cx), Math.floor(y), Math.floor(cz));
      const b2 = world.getBlock(Math.floor(cx), Math.floor(y + 0.9), Math.floor(cz));
      if (BLOCK_DEFS[b1].solid || BLOCK_DEFS[b2].solid) return true;
    }
    return false;
  }

  public raycastMob(origin: THREE.Vector3, dir: THREE.Vector3, maxDist = 4.2): MobEntity | null {
    let closest: MobEntity | null = null;
    let bestDist = maxDist;
    const toMob = new THREE.Vector3();
    for (const mob of this.mobs) {
      toMob.set(mob.position.x - origin.x, mob.position.y + mob.height * 0.5 - origin.y, mob.position.z - origin.z);
      const proj = toMob.dot(dir);
      if (proj < 0 || proj > bestDist) continue;
      const perpSq = toMob.lengthSq() - proj * proj;
      const hitR = mob.radius + 0.35;
      if (perpSq <= hitR * hitR) {
        bestDist = proj;
        closest = mob;
      }
    }
    return closest;
  }

  public disposeAll() {
    for (const m of this.mobs) {
      this.scene.remove(m.group);
      m.meshes.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    }
    for (const d of this.droppedItems) {
      this.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
    }
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    this.mobs = [];
    this.droppedItems = [];
    this.particles = [];
  }
}
