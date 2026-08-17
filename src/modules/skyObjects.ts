/**
 * Aerial skill objects – one random item per round.
 *  - Bounce pad: triangle … octagon that reflects the shell
 *  - Black hole: sphere that pulls the shell by proximity
 */

import * as THREE from 'three';

export type SkyObjectType = 'bounce' | 'blackhole';

export interface SkyObject {
  type: SkyObjectType;
  mesh: THREE.Object3D;
  /** Center in world XZ/XY plane we care about (x, y) */
  x: number;
  y: number;
  /** Bounce: approximate radius for collision; blackhole: event-horizon radius */
  radius: number;
  /** Black hole pull strength (only for blackhole) */
  strength: number;
  /** Bounce: outward normal in 2D (x,y) – pad faces the play direction */
  normalX: number;
  normalY: number;
  sides: number; // 3–8 for bounce, 0 for blackhole
}

export class SkyObjectsModule {
  private scene: THREE.Scene;
  private current: SkyObject | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get active(): SkyObject | null {
    return this.current;
  }

  clear() {
    if (this.current) {
      this.scene.remove(this.current.mesh);
      this.current.mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            (obj.material as THREE.Material).dispose();
          }
        }
      });
      this.current = null;
    }
  }

  /** Spawn one random skill object between the tanks, up in the air. */
  spawnRandom(): SkyObject {
    this.clear();
    const useBlackHole = Math.random() < 0.45;
    const obj = useBlackHole ? this.createBlackHole() : this.createBouncePad();
    this.current = obj;
    this.scene.add(obj.mesh);
    return obj;
  }

  private randomAirPosition(): { x: number; y: number } {
    // Between the tanks, mid-high in the air
    return {
      x: -4 + Math.random() * 8,
      y: 4 + Math.random() * 5, // 4 … 9
    };
  }

  private createBlackHole(): SkyObject {
    const { x, y } = this.randomAirPosition();
    const radius = 0.7 + Math.random() * 0.5;
    const strength = 18 + Math.random() * 22;

    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // Dark core
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.55, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x0a0a12 })
    );
    group.add(core);

    // Accretion glow
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
        transparent: true,
        opacity: 0.45,
      })
    );
    group.add(glow);

    // Outer ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.05, radius * 1.45, 32),
      new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    return {
      type: 'blackhole',
      mesh: group,
      x,
      y,
      radius,
      strength,
      normalX: 0,
      normalY: 0,
      sides: 0,
    };
  }

  private createBouncePad(): SkyObject {
    const sides = 3 + Math.floor(Math.random() * 6); // 3 … 8
    const { x, y } = this.randomAirPosition();
    const radius = 1.1 + Math.random() * 0.7;

    // Slight random tilt of the face normal in the X-Y plane
    const angle = (Math.random() - 0.5) * 0.8; // ~±23°
    const normalX = Math.sin(angle);
    const normalY = Math.cos(angle);

    const shape = new THREE.Shape();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * radius;
      const py = Math.sin(a) * radius;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.25,
      bevelEnabled: false,
    });
    // Center the extrusion on Z
    geo.translate(0, 0, -0.125);

    const colors = [0x22d3ee, 0x34d399, 0xfbbf24, 0xf472b6, 0x60a5fa];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const mat = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      metalness: 0.2,
      roughness: 0.45,
      emissive: color,
      emissiveIntensity: 0.15,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 0);
    // Face mostly toward camera / play plane; slight rotation for readability
    mesh.rotation.y = 0;
    mesh.castShadow = true;

    // Edge outline for visibility
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
    mesh.add(line);

    return {
      type: 'bounce',
      mesh,
      x,
      y,
      radius,
      strength: 0,
      normalX,
      normalY,
      sides,
    };
  }

  /**
   * 2D point-in-circle test against bounce pad (approx) or distance to black hole.
   * Returns true if projectile at (px,py) collides with bounce surface.
   */
  hitsBounce(px: number, py: number, obj: SkyObject): boolean {
    if (obj.type !== 'bounce') return false;
    const dx = px - obj.x;
    const dy = py - obj.y;
    return dx * dx + dy * dy <= obj.radius * obj.radius;
  }

  /** Reflect 2D velocity off bounce pad normal. */
  reflect(vx: number, vy: number, obj: SkyObject): { vx: number; vy: number } {
    const nx = obj.normalX;
    const ny = obj.normalY;
    // Ensure normal faces somewhat against incoming velocity
    let nxx = nx;
    let nyy = ny;
    if (vx * nxx + vy * nyy > 0) {
      nxx = -nxx;
      nyy = -nyy;
    }
    const dot = vx * nxx + vy * nyy;
    return {
      vx: (vx - 2 * dot * nxx) * 0.92, // slight energy loss
      vy: (vy - 2 * dot * nyy) * 0.92,
    };
  }

  /**
   * Black-hole acceleration at (px,py). Softened 1/r^2 pull.
   */
  blackHoleAccel(px: number, py: number, obj: SkyObject): { ax: number; ay: number } {
    if (obj.type !== 'blackhole') return { ax: 0, ay: 0 };
    const dx = obj.x - px;
    const dy = obj.y - py;
    const distSq = dx * dx + dy * dy;
    const minR = obj.radius * 0.6;
    const dist = Math.max(Math.sqrt(distSq), minR);
    // Fall off outside influence radius
    const influence = obj.radius * 6;
    if (dist > influence) return { ax: 0, ay: 0 };
    const force = obj.strength / (dist * dist);
    return {
      ax: (dx / dist) * force,
      ay: (dy / dist) * force,
    };
  }
}
