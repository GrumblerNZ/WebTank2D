/**
 * Geometry module – evolved from the old Java random-geometry + placement code.
 * Generates procedural terrain with a random hill between players, and places units.
 */

import * as THREE from 'three';

export interface UnitPlacement {
  position: THREE.Vector3;
  mesh: THREE.Group;
}

export class GeometryModule {
  private scene: THREE.Scene;
  private terrainMesh: THREE.Mesh | null = null;

  // Analytic hill used for both mesh generation and ground collision
  private hillCenterX = 0;
  private hillHeight = 0;
  private hillWidth = 6;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Ground height at world X (matches the hill shape on the terrain mesh). */
  getHeightAt(x: number): number {
    if (this.hillHeight <= 0.05) return 0;
    const t = (x - this.hillCenterX) / this.hillWidth;
    return this.hillHeight * Math.exp(-(t * t));
  }

  /**
   * Build / rebuild terrain with a random-height hill between the two sides.
   * centerX / height / width control the hill; mild noise keeps it from looking too smooth.
   */
  rebuildTerrain(centerX: number, height: number, width: number): THREE.Mesh {
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
      this.terrainMesh = null;
    }

    this.hillCenterX = centerX;
    this.hillHeight = height;
    this.hillWidth = Math.max(width, 2);

    const geometry = new THREE.PlaneGeometry(40, 20, 80, 30);
    const pos = geometry.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); // plane is in XY before rotation; X stays world-X after rot
      const noise = (Math.random() - 0.5) * 0.25;
      const h = this.getHeightAt(x) + noise;
      pos.setZ(i, h); // Z becomes world Y after rotation.x = -PI/2
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x3d5a3d,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = 0;
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    this.terrainMesh = terrain;
    return terrain;
  }

  /** First-time terrain (mild central hill so the first round is interesting). */
  createTerrain(): THREE.Mesh {
    return this.rebuildTerrain(0, 1.5 + Math.random() * 2.5, 5 + Math.random() * 4);
  }

  /** Build a simple tank-like unit (body + turret + barrel) */
  private createTankMesh(color: number): THREE.Group {
    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(1.4, 0.5, 0.9);
    const bodyMat = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.25;
    body.castShadow = true;
    group.add(body);

    const turretGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.3, 8);
    const turret = new THREE.Mesh(turretGeo, bodyMat);
    turret.position.y = 0.6;
    turret.castShadow = true;
    group.add(turret);

    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.55, 0.6, 0);
    barrel.castShadow = true;
    group.add(barrel);

    group.userData.barrel = barrel;
    group.userData.turret = turret;

    return group;
  }

  /** Place player (left) and AI (right); Y follows terrain height. */
  placeUnits(): { player: UnitPlacement; ai: UnitPlacement } {
    const playerMesh = this.createTankMesh(0x3b82f6);
    const aiMesh = this.createTankMesh(0xef4444);

    const playerX = -12 + Math.random() * 4;
    const aiX = 8 + Math.random() * 4;

    const playerY = this.getHeightAt(playerX) + 0.25;
    const aiY = this.getHeightAt(aiX) + 0.25;

    playerMesh.position.set(playerX, playerY, 0);
    aiMesh.position.set(aiX, aiY, 0);
    aiMesh.rotation.y = Math.PI;

    this.scene.add(playerMesh);
    this.scene.add(aiMesh);

    return {
      player: { position: playerMesh.position.clone(), mesh: playerMesh },
      ai: { position: aiMesh.position.clone(), mesh: aiMesh },
    };
  }

  /** Random hill params for a new round (peak between the two tanks). */
  randomHillParams(): { centerX: number; height: number; width: number } {
    return {
      centerX: -2 + Math.random() * 4, // roughly between the sides
      height: 1.2 + Math.random() * 4.5, // 1.2 … 5.7
      width: 4 + Math.random() * 5, // 4 … 9
    };
  }

  removeUnits(units: { player: UnitPlacement; ai: UnitPlacement }) {
    this.scene.remove(units.player.mesh);
    this.scene.remove(units.ai.mesh);
  }
}
