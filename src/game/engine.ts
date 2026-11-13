import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from './audio';
import { EntityManager, MobEntity } from './entities';
import { createAtlasTexture, getTileUV } from './textures';
import {
  BLOCK_DEFS,
  BlockId,
  FurnaceState,
  GameSettings,
  HudSnapshot,
  InventorySlot,
  ITEM_DEFS,
  SaveWorldData,
} from './types';
import { CHUNK_HEIGHT, WorldManager } from './world';

// Pre-allocated math helpers (zero GC in loop)
const _camDir = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _torchVec = new THREE.Vector3();
const _dummy = new THREE.Object3D();

const _daySky = new THREE.Color(0x7cc4ff);
const _dawnSky = new THREE.Color(0xf4a261);
const _nightSky = new THREE.Color(0x0b1026);
const _skyColor = new THREE.Color();

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onPointerLockChange: (locked: boolean) => void;
  onOpenInventory: (mode: 'inventory' | 'crafting' | 'furnace', furnaceKey?: string) => void;
  onPauseRequest: () => void;
}

export class VoxelGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private settings: GameSettings;
  private worldData: SaveWorldData;

  private renderer!: THREE.WebGLRenderer;
  private isSoftwareGl = false;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private frameId = 0;
  private isDisposed = false;

  private world!: WorldManager;
  private entities!: EntityManager;

  private atlasTex!: THREE.CanvasTexture;
  private opaqueMaterial!: THREE.MeshStandardMaterial;
  private liquidMaterial!: THREE.MeshStandardMaterial;

  // Lighting & Sky
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private sunMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;
  private starPoints!: THREE.Points;
  private cloudMesh!: THREE.InstancedMesh;
  private cloudOffsets: { x: number; y: number; z: number; sx: number; sz: number }[] = [];
  private torchLights: THREE.PointLight[] = [];

  // Selection & Hand
  private targetBox!: THREE.LineSegments;
  private breakOverlay!: THREE.Mesh;
  private handGroup!: THREE.Group;
  private handItemKey = '';
  private swingTimer = 0;

  // Player state
  public playerPos = new THREE.Vector3();
  public playerVel = new THREE.Vector3();
  public yaw = 0;
  public pitch = 0;
  public health = 20;
  public hunger = 20;
  public selectedSlot = 0;
  public inventory: InventorySlot[] = [];
  public furnaces: Record<string, FurnaceState> = {};
  public timeOfDay = 0.22;
  public dayCount = 1;
  public isDead = false;

  private onGround = false;
  private isFlying = false;
  private lastSpaceTime = 0;
  private fallStartY = 0;
  private wasFalling = false;
  private hurtFlash = 0;
  private hungerTimer = 0;
  private healTimer = 0;
  private lavaTimer = 0;
  private stepDist = 0;
  private wasInWater = false;
  private currentFov = 75;
  private currentEyeHeight = 1.62;

  // Input state
  private keys = new Set<string>();
  private isPointerLocked = false;
  private isPaused = false;
  private isLeftMouseDown = false;
  private breakProgress = 0;
  private breakingCoordKey = '';
  private attackCooldown = 0;

  private hudTimer = 0;
  private fpsCounter = 0;
  private fpsTimer = 0;
  private currentFps = 60;

  constructor(
    container: HTMLElement,
    worldData: SaveWorldData,
    settings: GameSettings,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.worldData = worldData;
    this.settings = { ...settings };
    this.callbacks = callbacks;

    this.playerPos.set(worldData.player.x, worldData.player.y, worldData.player.z);
    this.yaw = worldData.player.yaw;
    this.pitch = worldData.player.pitch;
    this.health = worldData.player.health;
    this.hunger = worldData.player.hunger;
    this.selectedSlot = worldData.player.selectedSlot;
    this.inventory = worldData.inventory.map((s) => ({ ...s }));
    this.furnaces = JSON.parse(JSON.stringify(worldData.furnaces || {}));
    this.timeOfDay = worldData.timeOfDay ?? 0.22;
    this.currentFov = settings.fov;

    soundEngine.setVolume(settings.soundVolume);
    this.initRendererAndScene();
    this.bindEvents();
    this.startLoop();
  }

  private initRendererAndScene() {
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.settings.graphicsQuality === 'high',
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(
      this.isSoftwareGl
        ? 1
        : this.settings.graphicsQuality === 'low'
          ? 1
          : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.settings.graphicsQuality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7cc4ff);
    const fogFar = this.settings.renderDistance * 16 * 0.92;
    this.scene.fog = new THREE.Fog(0x7cc4ff, fogFar * 0.45, fogFar);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, width / height, 0.1, 450);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Atlas & Chunk Materials
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const { texture } = createAtlasTexture(maxAniso);
    this.atlasTex = texture;

    this.opaqueMaterial = new THREE.MeshStandardMaterial({
      map: this.atlasTex,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
      alphaTest: 0.35,
      side: THREE.FrontSide,
    });

    this.liquidMaterial = new THREE.MeshStandardMaterial({
      map: this.atlasTex,
      vertexColors: true,
      roughness: 0.18,
      metalness: 0.1,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0xaad8ff, 0x4f4336, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4dc, 1.35);
    this.sunLight.castShadow = !this.isSoftwareGl && this.settings.graphicsQuality !== 'low';
    const shadowRes = this.settings.graphicsQuality === 'high' ? 2048 : 1024;
    this.sunLight.shadow.mapSize.set(shadowRes, shadowRes);
    const d = 38;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 160;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.03;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Sun & Moon Sky Bodies
    this.sunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false })
    );
    this.moonMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xdce6f5, fog: false })
    );
    this.scene.add(this.sunMesh, this.moonMesh);

    // Starfield
    const starCount = 320;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.12);
      const r = 175;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true, opacity: 0, fog: false })
    );
    this.scene.add(this.starPoints);

    // Drifting Voxel Clouds (InstancedMesh)
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.85,
    });
    const cloudCount = 34;
    this.cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
    this.cloudMesh.frustumCulled = false;
    for (let i = 0; i < cloudCount; i++) {
      this.cloudOffsets.push({
        x: (Math.random() - 0.5) * 180,
        y: 55 + Math.random() * 4,
        z: (Math.random() - 0.5) * 180,
        sx: 8 + Math.random() * 14,
        sz: 6 + Math.random() * 10,
      });
    }
    this.scene.add(this.cloudMesh);

    // Torch PointLights pool (up to 4 nearest torches)
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0xffa940, 0, 12, 1.6);
      this.scene.add(pl);
      this.torchLights.push(pl);
    }

    // Block Target Outline & Break Progress Overlay
    const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    this.targetBox = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.75 })
    );
    this.targetBox.visible = false;
    this.scene.add(this.targetBox);

    this.breakOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({
        color: 0x111111,
        wireframe: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.breakOverlay.visible = false;
    this.scene.add(this.breakOverlay);

    // First-person Hand Group attached to camera
    this.handGroup = new THREE.Group();
    this.handGroup.position.set(0.42, -0.34, -0.58);
    this.camera.add(this.handGroup);
    this.rebuildHandModel();

    // Initialize World & Entities
    this.world = new WorldManager(
      this.worldData.meta.seed,
      this.scene,
      this.opaqueMaterial,
      this.liquidMaterial,
      this.worldData.modifiedBlocks
    );
    this.world.ensureImmediateArea(this.playerPos.x, this.playerPos.z, 2);

    // Ensure spawn position is safely on surface if new world
    if (this.playerPos.y <= 0) {
      this.playerPos.y = this.world.getSurfaceY(this.playerPos.x, this.playerPos.z) + 0.2;
    }
    this.fallStartY = this.playerPos.y;

    this.entities = new EntityManager(this.scene, this.opaqueMaterial);
    this.entities.spawnInitialAnimals(this.world, this.playerPos.x, this.playerPos.z);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private rebuildHandModel() {
    const slot = this.inventory[this.selectedSlot];
    const key = slot?.itemId || '__hand__';
    if (key === this.handItemKey) return;
    this.handItemKey = key;

    while (this.handGroup.children.length > 0) {
      const child = this.handGroup.children[0];
      this.handGroup.remove(child);
      child.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).geometry.dispose();
        }
      });
    }

    if (!slot?.itemId) {
      // Bare voxel arm
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.42, 0.16),
        new THREE.MeshStandardMaterial({ color: 0xd69f7e, roughness: 0.8 })
      );
      arm.rotation.set(-0.6, -0.3, 0.2);
      this.handGroup.add(arm);
      return;
    }

    const def = ITEM_DEFS[slot.itemId];
    if (def?.blockId !== undefined && slot.itemId !== 'torch') {
      const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      const bdef = BLOCK_DEFS[def.blockId];
      const [u0, v0, u1, v1] = getTileUV(bdef.textures.side);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) < 0.5 ? u0 : u1, uv.getY(i) < 0.5 ? v0 : v1);
      }
      uv.needsUpdate = true;
      const mesh = new THREE.Mesh(geo, this.opaqueMaterial);
      mesh.rotation.set(0.2, -0.65, 0.1);
      this.handGroup.add(mesh);
    } else if (slot.itemId === 'torch') {
      const stick = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.34, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x7a5229, roughness: 0.9 })
      );
      const flame = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.08, 0.075),
        new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xff8c1a, emissiveIntensity: 1.5 })
      );
      flame.position.y = 0.2;
      const g = new THREE.Group();
      g.add(stick, flame);
      g.rotation.set(-0.25, 0, 0.15);
      this.handGroup.add(g);
    } else if (def?.toolType === 'pickaxe') {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.42, 0.045),
        new THREE.MeshStandardMaterial({ color: 0x7a4e26, roughness: 0.85 })
      );
      const headColor =
        def.toolTier === 4
          ? 0x3ae5eb
          : def.toolTier === 3
            ? 0xd9dfe6
            : def.toolTier === 2
              ? 0x8a9099
              : 0xb8874d;
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.06, 0.06),
        new THREE.MeshStandardMaterial({
          color: headColor,
          roughness: def.toolTier && def.toolTier >= 3 ? 0.25 : 0.75,
          metalness: def.toolTier && def.toolTier >= 3 ? 0.7 : 0.05,
        })
      );
      head.position.y = 0.2;
      g.add(handle, head);
      g.rotation.set(-0.55, -0.35, 0.2);
      this.handGroup.add(g);
    } else if (def?.toolType === 'sword') {
      const g = new THREE.Group();
      const hilt = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.14, 0.045),
        new THREE.MeshStandardMaterial({ color: 0x694320, roughness: 0.85 })
      );
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.04, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x523418, roughness: 0.7 })
      );
      guard.position.y = 0.08;
      const bladeColor =
        def.toolTier === 4
          ? 0x3ae5eb
          : def.toolTier === 3
            ? 0xd9dfe6
            : def.toolTier === 2
              ? 0x8a9099
              : 0xb8874d;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.38, 0.03),
        new THREE.MeshStandardMaterial({
          color: bladeColor,
          roughness: def.toolTier && def.toolTier >= 3 ? 0.2 : 0.75,
          metalness: def.toolTier && def.toolTier >= 3 ? 0.75 : 0.05,
        })
      );
      blade.position.y = 0.28;
      g.add(hilt, guard, blade);
      g.rotation.set(-0.45, -0.3, 0.15);
      this.handGroup.add(g);
    } else {
      const color =
        slot.itemId === 'apple'
          ? 0xdc2626
          : slot.itemId === 'diamond'
            ? 0x3ae5eb
            : slot.itemId.includes('gold')
              ? 0xf5c72e
              : slot.itemId.includes('iron')
                ? 0xd8dce0
                : 0xb56547;
      const itemMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.06),
        new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
      );
      itemMesh.rotation.set(-0.2, -0.4, 0.1);
      this.handGroup.add(itemMesh);
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isDead) return;

    if (e.code === 'KeyE') {
      if (!this.isPaused && this.isPointerLocked) {
        e.preventDefault();
        this.unlockPointer();
        this.callbacks.onOpenInventory('inventory');
      }
      return;
    }

    if (e.code === 'Escape') {
      if (this.isPointerLocked) {
        this.unlockPointer();
      }
      return;
    }

    if (this.isPaused) return;

    // Hotbar 1-9
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.replace('Digit', ''));
      if (n >= 1 && n <= 9) {
        this.setSelectedSlot(n - 1);
      }
    }

    // Creative mode double-tap space to fly
    if (e.code === 'Space' && !e.repeat && this.worldData.meta.mode === 'creative') {
      const now = performance.now();
      if (now - this.lastSpaceTime < 280) {
        this.isFlying = !this.isFlying;
        this.playerVel.y = 0;
      }
      this.lastSpaceTime = now;
    }

    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isPointerLocked || this.isPaused || this.isDead) return;
    const sens = 0.0022 * this.settings.mouseSensitivity;
    this.yaw -= e.movementX * sens;
    this.pitch -= e.movementY * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.isPaused || this.isDead) return;
    if (!this.isPointerLocked) {
      return;
    }

    if (e.button === 0) {
      this.isLeftMouseDown = true;
      this.swingTimer = 0.22;
      this.tryAttackOrInstantBreak();
    } else if (e.button === 2) {
      this.swingTimer = 0.2;
      this.handleRightClick();
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isLeftMouseDown = false;
      this.breakProgress = 0;
      this.breakingCoordKey = '';
      this.breakOverlay.visible = false;
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.isPointerLocked || this.isPaused || this.isDead) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    this.setSelectedSlot((this.selectedSlot + dir + 9) % 9);
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.isPointerLocked = locked;
    if (!locked) {
      this.keys.clear();
      this.isLeftMouseDown = false;
      this.breakProgress = 0;
      this.breakOverlay.visible = false;
    }
    this.callbacks.onPointerLockChange(locked);
  };

  private onResize = () => {
    if (this.isDisposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('resize', this.onResize);
  }

  public requestPointerLock() {
    if (this.isDead || this.isPaused) return;
    try {
      this.renderer.domElement.requestPointerLock();
    } catch {
      // ignore pointer lock rejection
    }
  }

  public unlockPointer() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      this.keys.clear();
      this.isLeftMouseDown = false;
      this.unlockPointer();
    }
  }

  public setSelectedSlot(idx: number) {
    this.selectedSlot = ((idx % 9) + 9) % 9;
    this.rebuildHandModel();
    this.emitHud();
  }

  public updateSettings(newSettings: GameSettings) {
    this.settings = { ...newSettings };
    soundEngine.setVolume(newSettings.soundVolume);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && newSettings.graphicsQuality !== 'low';
    this.sunLight.castShadow = !this.isSoftwareGl && newSettings.graphicsQuality !== 'low';
    this.renderer.setPixelRatio(
      this.isSoftwareGl
        ? 1
        : newSettings.graphicsQuality === 'low'
          ? 1
          : Math.min(window.devicePixelRatio, 2)
    );
    const fogFar = newSettings.renderDistance * 16 * 0.92;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = fogFar * 0.45;
      this.scene.fog.far = fogFar;
    }
  }

  public syncInventoryFromUI(newInv: InventorySlot[], newFurnaces?: Record<string, FurnaceState>) {
    this.inventory = newInv.map((s) => ({ ...s }));
    if (newFurnaces) {
      this.furnaces = newFurnaces;
    }
    this.rebuildHandModel();
    this.emitHud();
  }

  public respawnPlayer() {
    this.health = 20;
    this.hunger = 20;
    this.isDead = false;
    this.hurtFlash = 0;
    this.playerVel.set(0, 0, 0);
    const rx = Math.floor(this.playerPos.x);
    const rz = Math.floor(this.playerPos.z);
    const sy = this.world.getSurfaceY(rx, rz);
    this.playerPos.set(rx + 0.5, sy + 0.5, rz + 0.5);
    this.fallStartY = this.playerPos.y;
    this.setPaused(false);
    this.requestPointerLock();
    this.emitHud();
  }

  public exportSaveData(): SaveWorldData {
    const modified: Record<string, number> = {};
    for (const [k, v] of this.world.modifiedBlocks.entries()) {
      modified[k] = v;
    }
    return {
      meta: {
        ...this.worldData.meta,
        lastPlayed: Date.now(),
      },
      player: {
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        hunger: this.hunger,
        selectedSlot: this.selectedSlot,
      },
      inventory: this.inventory.map((s) => ({ ...s })),
      modifiedBlocks: modified,
      furnaces: JSON.parse(JSON.stringify(this.furnaces)),
      timeOfDay: this.timeOfDay,
    };
  }

  private addItemToInventory(itemId: string, count: number): boolean {
    const def = ITEM_DEFS[itemId];
    if (!def) return false;
    let remaining = count;

    // First stack onto existing slots
    for (let i = 0; i < 36; i++) {
      const slot = this.inventory[i];
      if (slot.itemId === itemId && slot.count < def.maxStack) {
        const take = Math.min(remaining, def.maxStack - slot.count);
        slot.count += take;
        remaining -= take;
        if (remaining <= 0) {
          this.rebuildHandModel();
          return true;
        }
      }
    }

    // Then empty slots
    for (let i = 0; i < 36; i++) {
      const slot = this.inventory[i];
      if (!slot.itemId || slot.count === 0) {
        const take = Math.min(remaining, def.maxStack);
        slot.itemId = itemId;
        slot.count = take;
        remaining -= take;
        if (remaining <= 0) {
          this.rebuildHandModel();
          return true;
        }
      }
    }

    return remaining < count;
  }

  private tryAttackOrInstantBreak() {
    this.camera.getWorldDirection(_camDir);
    const mob = this.entities.raycastMob(this.camera.position, _camDir, 4.2);
    if (mob && this.attackCooldown <= 0) {
      this.attackCooldown = 0.35;
      const held = this.inventory[this.selectedSlot]?.itemId;
      const dmg = held && ITEM_DEFS[held]?.attackDamage ? ITEM_DEFS[held].attackDamage! : 2;
      const knock = new THREE.Vector3(_camDir.x, 0, _camDir.z).normalize();
      soundEngine.playHit();
      this.entities.damageMob(mob, dmg, knock, (killed) => {
        this.spawnMobLoot(killed);
      });
      return;
    }

    const hit = this.world.raycast(this.camera.position, _camDir, 5.8);
    if (hit && this.worldData.meta.mode === 'creative') {
      this.breakBlockAt(hit.x, hit.y, hit.z, hit.blockId, false);
    }
  }

  private spawnMobLoot(mob: MobEntity) {
    const { x, y, z } = mob.position;
    if (mob.kind === 'cow') {
      this.entities.spawnDroppedItem('raw_beef', 1 + Math.floor(Math.random() * 2), x, y + 0.5, z);
    } else if (mob.kind === 'pig') {
      this.entities.spawnDroppedItem('raw_pork', 1 + Math.floor(Math.random() * 2), x, y + 0.5, z);
    } else if (mob.kind === 'sheep') {
      this.entities.spawnDroppedItem('wool', 1, x, y + 0.5, z);
      this.entities.spawnDroppedItem('raw_beef', 1, x, y + 0.5, z);
    } else if (mob.kind === 'zombie') {
      this.entities.spawnDroppedItem(Math.random() > 0.65 ? 'iron_ingot' : 'coal', 1, x, y + 0.6, z);
    } else if (mob.kind === 'skeleton') {
      this.entities.spawnDroppedItem('stick', 2, x, y + 0.6, z);
      if (Math.random() > 0.5) this.entities.spawnDroppedItem('coal', 1, x, y + 0.6, z);
    }
  }

  private breakBlockAt(x: number, y: number, z: number, blockId: BlockId, dropResources: boolean) {
    const bdef = BLOCK_DEFS[blockId];
    if (bdef.hardness < 0) return;

    soundEngine.playBreak(bdef.soundMaterial);
    this.entities.spawnBlockParticles(x, y, z, blockId);
    this.world.setBlock(x, y, z, BlockId.Air);

    if (blockId === BlockId.Furnace) {
      delete this.furnaces[`${x},${y},${z}`];
    }

    if (dropResources) {
      const held = this.inventory[this.selectedSlot]?.itemId;
      const heldDef = held ? ITEM_DEFS[held] : null;
      const tier = heldDef?.toolType === bdef.preferredTool ? heldDef.toolTier || 0 : 0;

      if (bdef.minTier === 0 || tier >= bdef.minTier) {
        if (bdef.dropItem) {
          this.entities.spawnDroppedItem(bdef.dropItem, bdef.dropCount, x + 0.5, y + 0.5, z + 0.5);
        }
        // Bonus apple drop from leaves
        if (blockId === BlockId.Leaves && Math.random() < 0.16) {
          this.entities.spawnDroppedItem('apple', 1, x + 0.5, y + 0.5, z + 0.5);
        }
      }
    }
  }

  private handleRightClick() {
    this.camera.getWorldDirection(_camDir);
    const hit = this.world.raycast(this.camera.position, _camDir, 5.8);

    // Check interactive blocks (Crafting Table / Furnace) unless sneaking
    if (hit && !this.keys.has('ControlLeft')) {
      if (hit.blockId === BlockId.CraftingTable) {
        this.unlockPointer();
        this.callbacks.onOpenInventory('crafting');
        return;
      }
      if (hit.blockId === BlockId.Furnace) {
        const key = `${hit.x},${hit.y},${hit.z}`;
        if (!this.furnaces[key]) {
          this.furnaces[key] = {
            input: { itemId: null, count: 0 },
            fuel: { itemId: null, count: 0 },
            output: { itemId: null, count: 0 },
            burnTime: 0,
            maxBurnTime: 0,
            cookProgress: 0,
          };
        }
        this.unlockPointer();
        this.callbacks.onOpenInventory('furnace', key);
        return;
      }
    }

    const slot = this.inventory[this.selectedSlot];
    if (!slot?.itemId || slot.count <= 0) return;
    const def = ITEM_DEFS[slot.itemId];
    if (!def) return;

    // Eat food if survival and hungry
    if (def.category === 'food' && def.foodRestore) {
      if (this.worldData.meta.mode === 'survival' && this.hunger < 20) {
        this.hunger = Math.min(20, this.hunger + def.foodRestore);
        soundEngine.playEat();
        slot.count--;
        if (slot.count <= 0) {
          slot.itemId = null;
          slot.count = 0;
        }
        this.rebuildHandModel();
        this.emitHud();
        return;
      }
    }

    // Place block
    if (def.blockId !== undefined && hit) {
      const px = hit.x + hit.nx;
      const py = hit.y + hit.ny;
      const pz = hit.z + hit.nz;
      if (py <= 0 || py >= CHUNK_HEIGHT) return;

      // Prevent placing solid block inside player AABB
      const bdef = BLOCK_DEFS[def.blockId];
      if (bdef.solid) {
        const pMinX = this.playerPos.x - 0.3;
        const pMaxX = this.playerPos.x + 0.3;
        const pMinY = this.playerPos.y;
        const pMaxY = this.playerPos.y + 1.75;
        const pMinZ = this.playerPos.z - 0.3;
        const pMaxZ = this.playerPos.z + 0.3;
        const overlap =
          px < pMaxX &&
          px + 1 > pMinX &&
          py < pMaxY &&
          py + 1 > pMinY &&
          pz < pMaxZ &&
          pz + 1 > pMinZ;
        if (overlap) return;
      }

      this.world.setBlock(px, py, pz, def.blockId);
      soundEngine.playPlace(bdef.soundMaterial);

      if (this.worldData.meta.mode === 'survival') {
        slot.count--;
        if (slot.count <= 0) {
          slot.itemId = null;
          slot.count = 0;
        }
        this.rebuildHandModel();
        this.emitHud();
      }
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.isDisposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.05);

      this.fpsCounter++;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 0.5) {
        this.currentFps = Math.round(this.fpsCounter / this.fpsTimer);
        this.fpsCounter = 0;
        this.fpsTimer = 0;
      }

      if (!this.isPaused && !this.isDead) {
        this.updateSimulation(dt);
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } catch {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private updateSimulation(dt: number) {
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);

    // 1. Update chunks around player
    this.world.updateChunksAround(this.playerPos.x, this.playerPos.z, this.settings.renderDistance);

    // 2. Day / Night cycle (1 full day = 360 seconds)
    this.timeOfDay += dt / 360;
    if (this.timeOfDay >= 1) {
      this.timeOfDay -= 1;
      this.dayCount++;
    }
    const isNight = this.updateSkyAndLights(dt);

    // 3. Player Movement & Physics
    this.updatePlayerPhysics(dt);

    // 4. Survival Hunger, Regeneration, & Lava
    this.updateSurvival(dt);

    // 5. Block Targeting & Mining Progress
    this.updateMining(dt);

    // 6. Update Furnaces
    this.updateFurnaces(dt);

    // 7. Update Entities (Animals, Hostile Mobs, Dropped Items, Particles)
    this.entities.update(
      dt,
      this.world,
      this.playerPos,
      isNight,
      this.worldData.meta.difficulty,
      this.worldData.meta.mode === 'creative',
      (dmg, knockDir) => {
        this.applyPlayerDamage(dmg, knockDir);
      },
      (itemId, count) => {
        const ok = this.addItemToInventory(itemId, count);
        if (ok) soundEngine.playPickup();
        return ok;
      }
    );

    // 8. Animate Water shimmer & Hand
    this.liquidMaterial.opacity = 0.76 + Math.sin(performance.now() * 0.003) * 0.05;
    this.updateCameraAndHand(dt);

    // 9. Periodic HUD snapshot
    this.hudTimer += dt;
    if (this.hudTimer >= 0.08) {
      this.hudTimer = 0;
      this.emitHud();
    }
  }

  private updateSkyAndLights(dt: number): boolean {
    const angle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunY = Math.cos(angle);
    const sunX = Math.sin(angle);

    // Sky color blending
    if (sunY > 0.25) {
      _skyColor.copy(_daySky);
    } else if (sunY > -0.15) {
      const t = (sunY + 0.15) / 0.4;
      _skyColor.copy(_dawnSky).lerp(_daySky, t * t);
      if (sunY < 0.05) {
        const nt = (0.05 - sunY) / 0.2;
        _skyColor.lerp(_nightSky, Math.min(1, nt));
      }
    } else {
      _skyColor.copy(_nightSky);
    }

    (this.scene.background as THREE.Color).copy(_skyColor);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(_skyColor);
    }

    // Sun & Moon positions centered around player
    this.sunMesh.position.set(
      this.playerPos.x + sunX * 140,
      this.playerPos.y + sunY * 140,
      this.playerPos.z - 40
    );
    this.sunMesh.lookAt(this.playerPos);

    this.moonMesh.position.set(
      this.playerPos.x - sunX * 140,
      this.playerPos.y - sunY * 140,
      this.playerPos.z + 40
    );
    this.moonMesh.lookAt(this.playerPos);

    // Directional light follows player so shadows stay crisp
    const isNight = sunY < -0.05;
    const dayFactor = THREE.MathUtils.clamp((sunY + 0.2) / 0.6, 0, 1);
    if (!isNight) {
      this.sunLight.position.set(
        this.playerPos.x + sunX * 55,
        this.playerPos.y + Math.max(12, sunY * 65),
        this.playerPos.z - 20
      );
      this.sunLight.color.setHex(sunY < 0.2 ? 0xffb36b : 0xfff5de);
      this.sunLight.intensity = 0.35 + dayFactor * 1.15;
    } else {
      this.sunLight.position.set(
        this.playerPos.x - sunX * 55,
        this.playerPos.y + Math.max(15, -sunY * 55),
        this.playerPos.z + 20
      );
      this.sunLight.color.setHex(0x6d8bc9);
      this.sunLight.intensity = 0.28;
    }
    this.sunLight.target.position.copy(this.playerPos);
    this.sunLight.target.updateMatrixWorld();

    this.hemiLight.intensity = 0.24 + dayFactor * 0.56;
    this.hemiLight.color.setHex(isNight ? 0x22335c : 0xaad8ff);

    // Stars at night
    this.starPoints.position.copy(this.playerPos);
    const starMat = this.starPoints.material as THREE.PointsMaterial;
    starMat.opacity = THREE.MathUtils.clamp((-sunY - 0.05) * 2.5, 0, 0.9);

    // Drifting clouds
    for (let i = 0; i < this.cloudOffsets.length; i++) {
      const c = this.cloudOffsets[i];
      c.x += dt * 1.4;
      if (c.x > 110) c.x = -110;
      _dummy.position.set(this.playerPos.x + c.x, c.y, this.playerPos.z + c.z);
      _dummy.scale.set(c.sx, 1.8, c.sz);
      _dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    // Nearest 4 placed Torches get warm PointLights
    const nearest: { pos: THREE.Vector3; dist: number }[] = [];
    for (const tPos of this.world.torches.values()) {
      const dist = tPos.distanceToSquared(this.playerPos);
      if (dist < 28 * 28) {
        nearest.push({ pos: tPos, dist });
      }
    }
    nearest.sort((a, b) => a.dist - b.dist);
    const flicker = 1.0 + Math.sin(performance.now() * 0.012) * 0.08;
    for (let i = 0; i < this.torchLights.length; i++) {
      const pl = this.torchLights[i];
      if (i < nearest.length) {
        _torchVec.copy(nearest[i].pos);
        pl.position.copy(_torchVec);
        pl.intensity = 3.2 * flicker;
      } else {
        pl.intensity = 0;
      }
    }

    return isNight;
  }

  private updatePlayerPhysics(dt: number) {
    const isCrouching = this.keys.has('ControlLeft') || this.keys.has('ControlRight');
    const isSprinting =
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) &&
      !isCrouching &&
      (this.worldData.meta.mode === 'creative' || this.hunger > 4);

    // Check water/lava at player feet & head
    const feetBlock = this.world.getBlock(
      Math.floor(this.playerPos.x),
      Math.floor(this.playerPos.y + 0.2),
      Math.floor(this.playerPos.z)
    );
    const headBlock = this.world.getBlock(
      Math.floor(this.playerPos.x),
      Math.floor(this.playerPos.y + 1.5),
      Math.floor(this.playerPos.z)
    );
    const inWater = feetBlock === BlockId.Water || headBlock === BlockId.Water;
    const inLava = feetBlock === BlockId.Lava || headBlock === BlockId.Lava;

    if (inWater && !this.wasInWater && this.playerVel.y < -3) {
      soundEngine.playSplash();
    }
    this.wasInWater = inWater;

    // Movement directions from yaw
    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    _moveVec.set(0, 0, 0);
    if (this.keys.has('KeyW')) _moveVec.add(_forward);
    if (this.keys.has('KeyS')) _moveVec.sub(_forward);
    if (this.keys.has('KeyD')) _moveVec.add(_right);
    if (this.keys.has('KeyA')) _moveVec.sub(_right);
    if (_moveVec.lengthSq() > 0) _moveVec.normalize();

    const baseSpeed = this.isFlying ? 11.5 : isCrouching ? 2.8 : isSprinting ? 6.8 : 4.6;
    const accel = this.onGround || this.isFlying ? 16 : 6;
    this.playerVel.x = THREE.MathUtils.lerp(this.playerVel.x, _moveVec.x * baseSpeed, Math.min(1, dt * accel));
    this.playerVel.z = THREE.MathUtils.lerp(this.playerVel.z, _moveVec.z * baseSpeed, Math.min(1, dt * accel));

    if (this.isFlying) {
      let vy = 0;
      if (this.keys.has('Space')) vy += 7.5;
      if (isCrouching) vy -= 7.5;
      this.playerVel.y = THREE.MathUtils.lerp(this.playerVel.y, vy, Math.min(1, dt * 10));
    } else if (inWater) {
      this.playerVel.y -= 9.5 * dt;
      if (this.keys.has('Space')) {
        this.playerVel.y = THREE.MathUtils.lerp(this.playerVel.y, 4.4, dt * 8);
      }
      this.playerVel.y = Math.max(this.playerVel.y, -4.0);
    } else {
      this.playerVel.y -= 24 * dt;
      if (this.keys.has('Space') && this.onGround) {
        this.playerVel.y = 8.4;
        this.onGround = false;
      }
    }

    // AABB collision resolution per axis
    const pHeight = isCrouching ? 1.38 : 1.78;
    const radius = 0.29;

    // X axis
    const nextX = this.playerPos.x + this.playerVel.x * dt;
    if (!this.collidesAABB(nextX, this.playerPos.y, this.playerPos.z, radius, pHeight)) {
      if (isCrouching && this.onGround && !this.hasSupportAt(nextX, this.playerPos.y, this.playerPos.z, radius)) {
        this.playerVel.x = 0;
      } else {
        this.playerPos.x = nextX;
      }
    } else {
      this.playerVel.x = 0;
    }

    // Z axis
    const nextZ = this.playerPos.z + this.playerVel.z * dt;
    if (!this.collidesAABB(this.playerPos.x, this.playerPos.y, nextZ, radius, pHeight)) {
      if (isCrouching && this.onGround && !this.hasSupportAt(this.playerPos.x, this.playerPos.y, nextZ, radius)) {
        this.playerVel.z = 0;
      } else {
        this.playerPos.z = nextZ;
      }
    } else {
      this.playerVel.z = 0;
    }

    // Y axis
    const nextY = this.playerPos.y + this.playerVel.y * dt;
    if (!this.collidesAABB(this.playerPos.x, nextY, this.playerPos.z, radius, pHeight)) {
      this.playerPos.y = nextY;
      this.onGround = false;
      if (this.playerVel.y < 0 && !this.wasFalling) {
        this.wasFalling = true;
        this.fallStartY = this.playerPos.y;
      }
    } else {
      if (this.playerVel.y < 0) {
        this.playerPos.y = Math.floor(nextY) + 1;
        // Fall damage check
        if (this.wasFalling && !inWater && !this.isFlying && this.worldData.meta.mode === 'survival') {
          const fallen = this.fallStartY - this.playerPos.y;
          if (fallen > 3.8) {
            const dmg = Math.floor(fallen - 3.2);
            if (dmg > 0) this.applyPlayerDamage(dmg);
          }
        }
        this.onGround = true;
        this.wasFalling = false;
      }
      this.playerVel.y = 0;
    }

    if (inWater || this.isFlying) {
      this.wasFalling = false;
    }

    // Footstep audio
    if (this.onGround && _moveVec.lengthSq() > 0.1) {
      const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
      this.stepDist += horizSpeed * dt;
      if (this.stepDist > 1.85) {
        this.stepDist = 0;
        const under = this.world.getBlock(
          Math.floor(this.playerPos.x),
          Math.floor(this.playerPos.y - 0.1),
          Math.floor(this.playerPos.z)
        );
        soundEngine.playStep(BLOCK_DEFS[under]?.soundMaterial || 'grass');
      }
    }

    // Keep out of void
    if (this.playerPos.y < -10) {
      this.playerPos.y = this.world.getSurfaceY(this.playerPos.x, this.playerPos.z) + 1;
      this.playerVel.set(0, 0, 0);
    }

    // Smooth camera eye height & sprint FOV
    const targetEye = isCrouching ? 1.22 : 1.62;
    this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 12, dt);
    const targetFov = isSprinting && _moveVec.lengthSq() > 0.1 ? this.settings.fov + 8 : this.settings.fov;
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 10, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Hunger drain from sprinting
    if (this.worldData.meta.mode === 'survival' && isSprinting && _moveVec.lengthSq() > 0.1) {
      this.hungerTimer += dt * 1.8;
    }

    if (inLava && this.worldData.meta.mode === 'survival') {
      this.lavaTimer += dt;
      if (this.lavaTimer >= 0.45) {
        this.lavaTimer = 0;
        this.applyPlayerDamage(4);
      }
    } else {
      this.lavaTimer = 0;
    }
  }

  private collidesAABB(x: number, y: number, z: number, r: number, h: number): boolean {
    const minX = Math.floor(x - r);
    const maxX = Math.floor(x + r);
    const minY = Math.floor(y + 0.01);
    const maxY = Math.floor(y + h);
    const minZ = Math.floor(z - r);
    const maxZ = Math.floor(z + r);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const b = this.world.getBlock(bx, by, bz);
          if (BLOCK_DEFS[b].solid) return true;
        }
      }
    }
    return false;
  }

  private hasSupportAt(x: number, y: number, z: number, r: number): boolean {
    const minX = Math.floor(x - r);
    const maxX = Math.floor(x + r);
    const minZ = Math.floor(z - r);
    const maxZ = Math.floor(z + r);
    const by = Math.floor(y - 0.15);
    for (let bx = minX; bx <= maxX; bx++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        if (BLOCK_DEFS[this.world.getBlock(bx, by, bz)].solid) return true;
      }
    }
    return false;
  }

  private updateSurvival(dt: number) {
    if (this.worldData.meta.mode !== 'survival') return;

    this.hungerTimer += dt * 0.22;
    if (this.hungerTimer >= 12) {
      this.hungerTimer = 0;
      if (this.hunger > 0) {
        this.hunger = Math.max(0, this.hunger - 1);
      } else if (this.worldData.meta.difficulty !== 'peaceful') {
        this.applyPlayerDamage(1);
      }
    }

    if (this.hunger >= 16 && this.health < 20) {
      this.healTimer += dt;
      if (this.healTimer >= 3.5) {
        this.healTimer = 0;
        this.health = Math.min(20, this.health + 1);
      }
    } else {
      this.healTimer = 0;
    }
  }

  private applyPlayerDamage(amount: number, knockDir?: THREE.Vector3) {
    if (this.worldData.meta.mode !== 'survival' || this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = 1.0;
    soundEngine.playHurt();

    if (knockDir) {
      this.playerVel.x += knockDir.x * 6;
      this.playerVel.z += knockDir.z * 6;
      this.playerVel.y = Math.max(this.playerVel.y, 4.2);
    }

    if (this.health <= 0) {
      this.isDead = true;
      this.unlockPointer();
      this.emitHud();
    }
  }

  private updateMining(dt: number) {
    this.camera.getWorldDirection(_camDir);
    const hit = this.world.raycast(this.camera.position, _camDir, 5.8);

    if (hit) {
      this.targetBox.visible = true;
      this.targetBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.targetBox.visible = false;
      this.breakProgress = 0;
      this.breakingCoordKey = '';
      this.breakOverlay.visible = false;
      return;
    }

    if (!this.isLeftMouseDown || !this.isPointerLocked) {
      this.breakProgress = 0;
      this.breakOverlay.visible = false;
      return;
    }

    // Continuous swinging animation while holding left mouse
    if (this.swingTimer <= 0) this.swingTimer = 0.2;

    if (this.worldData.meta.mode === 'creative') return;

    const bdef = BLOCK_DEFS[hit.blockId];
    if (bdef.hardness < 0) return;

    const key = `${hit.x},${hit.y},${hit.z}`;
    if (key !== this.breakingCoordKey) {
      this.breakingCoordKey = key;
      this.breakProgress = 0;
    }

    const held = this.inventory[this.selectedSlot]?.itemId;
    const heldDef = held ? ITEM_DEFS[held] : null;
    let speedMult = 1.0;
    if (heldDef?.toolType === bdef.preferredTool && heldDef.miningSpeed) {
      speedMult = heldDef.miningSpeed;
    } else if (bdef.minTier > 0) {
      speedMult = 0.5;
    }

    this.breakProgress += (dt * speedMult) / Math.max(0.15, bdef.hardness);
    this.breakOverlay.visible = true;
    this.breakOverlay.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    (this.breakOverlay.material as THREE.MeshBasicMaterial).opacity = Math.min(0.65, this.breakProgress * 0.65);

    if (this.breakProgress >= 1) {
      this.breakProgress = 0;
      this.breakOverlay.visible = false;
      this.breakBlockAt(hit.x, hit.y, hit.z, hit.blockId, true);
    }
  }

  private updateFurnaces(dt: number) {
    for (const f of Object.values(this.furnaces)) {
      const inputDef = f.input.itemId ? ITEM_DEFS[f.input.itemId] : null;
      const canSmelt =
        Boolean(inputDef?.smeltResult) &&
        f.input.count > 0 &&
        (!f.output.itemId || (f.output.itemId === inputDef!.smeltResult && f.output.count < 64));

      if (f.burnTime > 0) {
        f.burnTime = Math.max(0, f.burnTime - dt);
      }

      if (canSmelt && f.burnTime <= 0 && f.fuel.itemId && f.fuel.count > 0) {
        const fuelDef = ITEM_DEFS[f.fuel.itemId];
        if (fuelDef?.isFuel && fuelDef.fuelDuration) {
          f.burnTime = fuelDef.fuelDuration;
          f.maxBurnTime = fuelDef.fuelDuration;
          f.fuel.count--;
          if (f.fuel.count <= 0) {
            f.fuel.itemId = null;
            f.fuel.count = 0;
          }
        }
      }

      if (canSmelt && f.burnTime > 0) {
        f.cookProgress += dt / 3.0; // 3 seconds per smelt
        if (f.cookProgress >= 1) {
          f.cookProgress = 0;
          const resultId = inputDef!.smeltResult!;
          f.input.count--;
          if (f.input.count <= 0) {
            f.input.itemId = null;
            f.input.count = 0;
          }
          if (!f.output.itemId) {
            f.output.itemId = resultId;
            f.output.count = 1;
          } else {
            f.output.count++;
          }
        }
      } else {
        f.cookProgress = Math.max(0, f.cookProgress - dt * 0.5);
      }
    }
  }

  private updateCameraAndHand(dt: number) {
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const bob =
      this.onGround && horizSpeed > 0.5 ? Math.sin(performance.now() * 0.011) * 0.035 : 0;

    this.camera.position.set(
      this.playerPos.x,
      this.playerPos.y + this.currentEyeHeight + bob,
      this.playerPos.z
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // Hand swing animation
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
    }
    const swingAngle = Math.sin((this.swingTimer / 0.22) * Math.PI) * 0.65;
    const handBobX = this.onGround && horizSpeed > 0.5 ? Math.cos(performance.now() * 0.008) * 0.025 : 0;
    const handBobY = this.onGround && horizSpeed > 0.5 ? Math.abs(Math.sin(performance.now() * 0.008)) * 0.025 : 0;

    this.handGroup.position.set(0.42 + handBobX, -0.34 - handBobY - swingAngle * 0.12, -0.58 - swingAngle * 0.15);
    this.handGroup.rotation.set(-swingAngle * 0.9, swingAngle * 0.25, 0);
  }

  public emitHud() {
    this.camera.getWorldDirection(_camDir);
    const hit = this.world.raycast(this.camera.position, _camDir, 5.8);
    const { biome } = this.world.getBiomeAt(this.playerPos.x, this.playerPos.z);
    const headBlock = this.world.getBlock(
      Math.floor(this.playerPos.x),
      Math.floor(this.playerPos.y + 1.5),
      Math.floor(this.playerPos.z)
    );
    const feetBlock = this.world.getBlock(
      Math.floor(this.playerPos.x),
      Math.floor(this.playerPos.y + 0.2),
      Math.floor(this.playerPos.z)
    );

    this.callbacks.onHudUpdate({
      health: this.health,
      maxHealth: 20,
      hunger: this.hunger,
      maxHunger: 20,
      mode: this.worldData.meta.mode,
      difficulty: this.worldData.meta.difficulty,
      selectedSlot: this.selectedSlot,
      inventory: this.inventory.map((s) => ({ ...s })),
      dayCount: this.dayCount,
      timeOfDay: this.timeOfDay,
      coords: {
        x: Math.floor(this.playerPos.x),
        y: Math.floor(this.playerPos.y),
        z: Math.floor(this.playerPos.z),
      },
      biome,
      targetedBlock: hit
        ? {
            x: hit.x,
            y: hit.y,
            z: hit.z,
            blockId: hit.blockId,
            name: BLOCK_DEFS[hit.blockId].name,
          }
        : null,
      breakProgress: this.breakProgress,
      inWater: headBlock === BlockId.Water,
      inLava: headBlock === BlockId.Lava || feetBlock === BlockId.Lava,
      hurtFlash: this.hurtFlash,
      isDead: this.isDead,
      fps: this.currentFps,
    });
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('resize', this.onResize);

    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }

    this.world.disposeAll();
    this.entities.disposeAll();
    this.atlasTex.dispose();
    this.opaqueMaterial.dispose();
    this.liquidMaterial.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
