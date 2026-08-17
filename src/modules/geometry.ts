/**
 * Geometry module – evolved from the old Java random-geometry + placement code.
 * Generates procedural terrain with a central hill and places units.
 * (Side elevations rolled back – sky skill objects provide the new challenge.)
 */

import * as THREE from 'three';

export interface UnitPlacement {
  position: THREE.Vector3;
  mesh: THREE.Group;
}

export class GeometryModule {
  private scene: THREE.Scene;
  private terrainMesh: THREE.Mesh | null = null;

  private hillCenterX = 0;
  private hillHeight = 0;
  private hillWidth = 6;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Ground height at world X (central hill only). */
  getHeightAt(x: number): number {
    if (this.hillHeight <= 0.05) return 0;
    const t = (x - this.hillCenterX) / this.hillWidth;
    return this.hillHeight * Math.exp(-(t * t));
  }

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
      const x = pos.getX(i);
      const noise = (Math.random() - 0.5) * 0.2;
      const h = this.getHeightAt(x) + noise;
      pos.setZ(i, h);
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

  createTerrain(): THREE.Mesh {
    const p = this.randomHillParams();
    return this.rebuildTerrain(p.centerX, p.height, p.width);
  }

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
    barrel.position.set(0, 0.55, 0);
    barrel.castShadow = true;

    const aimPivot = new THREE.Group();
    aimPivot.position.set(0.35, 0.6, 0);
    aimPivot.add(barrel);
    aimPivot.rotation.z = -Math.PI / 2;
    group.add(aimPivot);

    group.userData.barrel = barrel;
    group.userData.aimPivot = aimPivot;
    group.userData.turret = turret;

    return group;
  }

  static setBarrelAngle(tank: THREE.Group, angleDeg: number) {
    const pivot = tank.userData.aimPivot as THREE.Group | undefined;
    if (!pivot) return;
    const angleRad = (angleDeg * Math.PI) / 180;
    pivot.rotation.z = -Math.PI / 2 + angleRad;
  }

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

  randomHillParams(): { centerX: number; height: number; width: number } {
    return {
      centerX: -2 + Math.random() * 4,
      height: 1.2 + Math.random() * 4.5,
      width: 4 + Math.random() * 5,
    };
  }

  removeUnits(units: { player: UnitPlacement; ai: UnitPlacement }) {
    this.scene.remove(units.player.mesh);
    this.scene.remove(units.ai.mesh);
  }
}
