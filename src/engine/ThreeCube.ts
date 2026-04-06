/**
 * ThreeCube — High-fidelity WebGL Rubik's Cube renderer
 * 
 * Creates a photorealistic 3D Rubik's Cube using Three.js with:
 *   - 26 individually modeled cubies
 *   - 54 addressable facelet meshes with PBR materials
 *   - GSAP-powered color transitions
 *   - Face rotation animations for solve playback
 *   - Ghost solve mode (translucent 5× speed animation)
 *   - Color-blind text overlays (U/D/L/R/F/B sprites)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import type { FaceName } from './CubeStateManager';

// ─── Constants ──────────────────────────────────────────

const CUBIE_SIZE = 0.95;
const GAP = 0.04;
const STICKER_INSET = 0.08;
const STICKER_RAISE = 0.005;
const CORNER_RADIUS = 0.06;

const GREY_COLOR = new THREE.Color('#808080');
const BODY_COLOR = new THREE.Color('#1a1a1a');

const FACE_NORMALS: Record<string, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
};

const MOVE_AXIS: Record<string, { axis: THREE.Vector3; layer: number; sign: number }> = {
  U:  { axis: new THREE.Vector3(0, 1, 0), layer:  1, sign: -1 },
  "U'": { axis: new THREE.Vector3(0, 1, 0), layer:  1, sign:  1 },
  U2: { axis: new THREE.Vector3(0, 1, 0), layer:  1, sign: -2 },
  D:  { axis: new THREE.Vector3(0, 1, 0), layer: -1, sign:  1 },
  "D'": { axis: new THREE.Vector3(0, 1, 0), layer: -1, sign: -1 },
  D2: { axis: new THREE.Vector3(0, 1, 0), layer: -1, sign:  2 },
  R:  { axis: new THREE.Vector3(1, 0, 0), layer:  1, sign: -1 },
  "R'": { axis: new THREE.Vector3(1, 0, 0), layer:  1, sign:  1 },
  R2: { axis: new THREE.Vector3(1, 0, 0), layer:  1, sign: -2 },
  L:  { axis: new THREE.Vector3(1, 0, 0), layer: -1, sign:  1 },
  "L'": { axis: new THREE.Vector3(1, 0, 0), layer: -1, sign: -1 },
  L2: { axis: new THREE.Vector3(1, 0, 0), layer: -1, sign:  2 },
  F:  { axis: new THREE.Vector3(0, 0, 1), layer:  1, sign: -1 },
  "F'": { axis: new THREE.Vector3(0, 0, 1), layer:  1, sign:  1 },
  F2: { axis: new THREE.Vector3(0, 0, 1), layer:  1, sign: -2 },
  B:  { axis: new THREE.Vector3(0, 0, 1), layer: -1, sign:  1 },
  "B'": { axis: new THREE.Vector3(0, 0, 1), layer: -1, sign: -1 },
  B2: { axis: new THREE.Vector3(0, 0, 1), layer: -1, sign:  2 },
};

// ─── Types ──────────────────────────────────────────────

interface CubieData {
  group: THREE.Group;
  position: THREE.Vector3; // Logical position (-1, 0, 1 per axis)
  facelets: Map<string, THREE.Mesh>; // face → mesh
  labels: Map<string, THREE.Sprite>; // face → text label (color-blind)
}

interface FaceletAddress {
  face: FaceName;
  row: number;
  col: number;
}

// ─── Main Class ─────────────────────────────────────────

export class ThreeCube {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private cubies: CubieData[] = [];
  private faceletMap: Map<string, THREE.Mesh> = new Map(); // "U-0-0" → mesh
  private labelMap: Map<string, THREE.Sprite> = new Map();
  private cubeGroup: THREE.Group;
  private ghostGroup: THREE.Group | null = null;
  private animating = false;
  private disposed = false;
  private colorBlindEnabled = false;
  private animationFrameId: number = 0;

  constructor(private container: HTMLElement) {
    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(4.5, 3.5, 4.5);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 12;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;

    // Cube group
    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    // Build
    this.setupLights();
    this.buildCube();
    this.animate();

    // Resize handler
    window.addEventListener('resize', this.handleResize);
  }

  // ─── Public API ────────────────────────────────────────

  /**
   * Update a single facelet color with GSAP transition.
   */
  updateFacelet(face: FaceName, row: number, col: number, hexColor: string | null): void {
    const key = `${face}-${row}-${col}`;
    const mesh = this.faceletMap.get(key);
    if (!mesh) return;

    const material = mesh.material as THREE.MeshStandardMaterial;
    const targetColor = hexColor ? new THREE.Color(hexColor) : GREY_COLOR.clone();

    gsap.to(material.color, {
      r: targetColor.r,
      g: targetColor.g,
      b: targetColor.b,
      duration: 0.4,
      ease: 'power2.out',
    });

    // Update roughness based on whether identified
    gsap.to(material, {
      roughness: hexColor ? 0.3 : 0.7,
      metalness: hexColor ? 0.05 : 0,
      duration: 0.4,
    });
  }

  /**
   * Update all facelets from a full state map.
   */
  updateAllFacelets(colors: Record<FaceName, (string | null)[][]>): void {
    const faces: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];
    for (const face of faces) {
      if (!colors[face]) continue;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          this.updateFacelet(face, r, c, colors[face][r][c]);
        }
      }
    }
  }

  /**
   * Execute a single move animation on the cube.
   */
  async executeMove(move: string, duration: number = 0.35): Promise<void> {
    const moveInfo = MOVE_AXIS[move];
    if (!moveInfo || this.animating) return;

    this.animating = true;

    const { axis, layer, sign } = moveInfo;
    const affectedCubies = this.cubies.filter(c => {
      if (axis.x !== 0) return Math.round(c.position.x) === layer;
      if (axis.y !== 0) return Math.round(c.position.y) === layer;
      if (axis.z !== 0) return Math.round(c.position.z) === layer;
      return false;
    });

    // Create temp rotation group
    const rotGroup = new THREE.Group();
    this.cubeGroup.add(rotGroup);

    for (const cubie of affectedCubies) {
      this.cubeGroup.remove(cubie.group);
      rotGroup.add(cubie.group);
    }

    const angle = (Math.PI / 2) * sign;
    const rotProp = axis.x ? 'x' : axis.y ? 'y' : 'z';

    await new Promise<void>(resolve => {
      gsap.to(rotGroup.rotation, {
        [rotProp]: angle,
        duration,
        ease: 'power2.inOut',
        onComplete: () => {
          // Apply rotation to world positions
          for (const cubie of affectedCubies) {
            // Get world position/rotation
            cubie.group.getWorldPosition(cubie.group.position);
            cubie.group.getWorldQuaternion(cubie.group.quaternion);
            rotGroup.remove(cubie.group);
            this.cubeGroup.add(cubie.group);

            // Update logical position
            const pos = cubie.group.position;
            cubie.position.set(
              Math.round(pos.x),
              Math.round(pos.y),
              Math.round(pos.z)
            );
          }

          this.cubeGroup.remove(rotGroup);
          this.animating = false;
          resolve();
        },
      });
    });
  }

  /**
   * Execute a sequence of moves.
   */
  async executeMoves(moves: string[], speedMultiplier: number = 1): Promise<void> {
    for (const move of moves) {
      if (this.disposed) return;
      await this.executeMove(move, 0.35 / speedMultiplier);
      // Small gap between moves
      await new Promise(r => setTimeout(r, 50 / speedMultiplier));
    }
  }

  /**
   * Ghost Solve — create a translucent clone and play the solution at speed.
   */
  async ghostSolve(moves: string[], speedMultiplier: number = 5): Promise<void> {
    // Make the real cube semi-transparent
    this.setOpacity(0.25);

    // Create ghost clone
    this.ghostGroup = this.cubeGroup.clone(true);
    this.ghostGroup.traverse(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.7;
        child.material.emissive = new THREE.Color('#3b82f6');
        child.material.emissiveIntensity = 0.15;
      }
    });
    this.scene.add(this.ghostGroup);

    // Animate ghost solving
    await this.executeMoves(moves, speedMultiplier);

    // Cleanup ghost
    if (this.ghostGroup) {
      this.scene.remove(this.ghostGroup);
      this.ghostGroup = null;
    }

    // Restore real cube opacity
    this.setOpacity(1);
  }

  /**
   * Toggle color-blind mode (text overlays on facets).
   */
  setColorBlindMode(enabled: boolean): void {
    this.colorBlindEnabled = enabled;
    this.labelMap.forEach((sprite, key) => {
      sprite.visible = enabled;
    });
  }

  /**
   * Set auto-rotate.
   */
  setAutoRotate(enabled: boolean): void {
    this.controls.autoRotate = enabled;
  }

  /**
   * Reset camera to default viewing angle.
   */
  resetCamera(): void {
    gsap.to(this.camera.position, {
      x: 4.5,
      y: 3.5,
      z: 4.5,
      duration: 1,
      ease: 'power3.out',
    });
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.handleResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.scene.clear();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }

  // ─── Build ────────────────────────────────────────────

  private setupLights(): void {
    // Ambient
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.6));

    // Key light
    const key = new THREE.DirectionalLight('#ffffff', 1.2);
    key.position.set(5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    this.scene.add(key);

    // Fill light
    const fill = new THREE.DirectionalLight('#c7d2fe', 0.4);
    fill.position.set(-3, 4, -2);
    this.scene.add(fill);

    // Rim light
    const rim = new THREE.PointLight('#818cf8', 0.5);
    rim.position.set(-2, -3, 5);
    this.scene.add(rim);

    // Subtle environment
    const envColor = new THREE.Color('#0a0a0f');
    this.scene.background = null; // transparent
    this.scene.fog = null;
  }

  private buildCube(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: BODY_COLOR,
      roughness: 0.9,
      metalness: 0.1,
    });

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue; // No center cubie

          const group = new THREE.Group();
          group.position.set(x, y, z);

          // Cubie body
          const bodyGeo = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
          // Round edges
          const body = new THREE.Mesh(bodyGeo, bodyMat.clone());
          body.castShadow = true;
          body.receiveShadow = true;
          group.add(body);

          const cubieData: CubieData = {
            group,
            position: new THREE.Vector3(x, y, z),
            facelets: new Map(),
            labels: new Map(),
          };

          // Add facelets
          this.addFacelets(cubieData, x, y, z);

          this.cubies.push(cubieData);
          this.cubeGroup.add(group);
        }
      }
    }
  }

  private addFacelets(cubie: CubieData, x: number, y: number, z: number): void {
    const stickerSize = CUBIE_SIZE - STICKER_INSET * 2;
    const stickerGeo = new THREE.PlaneGeometry(stickerSize, stickerSize);

    // Determine which faces this cubie has stickers on
    if (y === 1) this.createFacelet(cubie, stickerGeo, 'U', x, y, z);
    if (y === -1) this.createFacelet(cubie, stickerGeo, 'D', x, y, z);
    if (x === 1) this.createFacelet(cubie, stickerGeo, 'R', x, y, z);
    if (x === -1) this.createFacelet(cubie, stickerGeo, 'L', x, y, z);
    if (z === 1) this.createFacelet(cubie, stickerGeo, 'F', x, y, z);
    if (z === -1) this.createFacelet(cubie, stickerGeo, 'B', x, y, z);
  }

  private createFacelet(
    cubie: CubieData,
    geo: THREE.PlaneGeometry,
    face: string,
    x: number, y: number, z: number
  ): void {
    const mat = new THREE.MeshStandardMaterial({
      color: GREY_COLOR.clone(),
      roughness: 0.5,
      metalness: 0.02,
      side: THREE.FrontSide,
    });

    const mesh = new THREE.Mesh(geo.clone(), mat);
    const normal = FACE_NORMALS[face];
    const offset = (CUBIE_SIZE / 2) + STICKER_RAISE;

    // Position facelet on the correct face
    mesh.position.copy(normal.clone().multiplyScalar(offset));

    // Rotate facelet to face outward
    if (face === 'U') mesh.rotation.x = -Math.PI / 2;
    else if (face === 'D') mesh.rotation.x = Math.PI / 2;
    else if (face === 'R') mesh.rotation.y = Math.PI / 2;
    else if (face === 'L') mesh.rotation.y = -Math.PI / 2;
    else if (face === 'F') { /* default: faces +Z */ }
    else if (face === 'B') mesh.rotation.y = Math.PI;

    cubie.group.add(mesh);
    cubie.facelets.set(face, mesh);

    // Compute facelet address (face, row, col)
    const addr = this.cubieToFacelet(face as FaceName, x, y, z);
    if (addr) {
      const key = `${addr.face}-${addr.row}-${addr.col}`;
      this.faceletMap.set(key, mesh);

      // Create color-blind label sprite
      const label = this.createLabelSprite(addr.face);
      label.position.copy(mesh.position);
      label.position.add(normal.clone().multiplyScalar(0.02));
      label.visible = false;
      cubie.group.add(label);
      cubie.labels.set(face, label);
      this.labelMap.set(key, label);
    }
  }

  /**
   * Maps a cubie's logical position to its facelet grid address.
   */
  private cubieToFacelet(face: FaceName, x: number, y: number, z: number): FaceletAddress | null {
    switch (face) {
      case 'U': // y=1, looking down: row = -z+1, col = x+1
        return { face, row: -z + 1, col: x + 1 };
      case 'D': // y=-1, looking up: row = z+1, col = x+1
        return { face, row: z + 1, col: x + 1 };
      case 'F': // z=1, looking at front: row = -y+1, col = x+1
        return { face, row: -y + 1, col: x + 1 };
      case 'B': // z=-1, looking at back: row = -y+1, col = -x+1
        return { face, row: -y + 1, col: -x + 1 };
      case 'R': // x=1, looking at right: row = -y+1, col = -z+1
        return { face, row: -y + 1, col: -z + 1 };
      case 'L': // x=-1, looking at left: row = -y+1, col = z+1
        return { face, row: -y + 1, col: z + 1 };
      default:
        return null;
    }
  }

  private createLabelSprite(face: FaceName): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(face, 32, 34);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.35, 0.35, 1);
    return sprite;
  }

  private setOpacity(opacity: number): void {
    this.cubies.forEach(cubie => {
      cubie.group.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.transparent = opacity < 1;
          gsap.to(child.material, {
            opacity,
            duration: 0.5,
          });
        }
      });
    });
  }

  // ─── Animation Loop ───────────────────────────────────

  private animate = (): void => {
    if (this.disposed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private handleResize = (): void => {
    if (!this.container || this.disposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
