/**
 * Geometry module – evolved from the old Java random-geometry + placement code.
 * Generates simple procedural terrain and places player / AI units.
 */

import * as THREE from 'three';

export interface UnitPlacement {
  position: THREE.Vector3;
  mesh: THREE.Group;
}

export class GeometryModule {
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Create a simple ground plane (placeholder for future heightmap / noise terrain) */
  createTerrain(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(40, 20, 40, 20);
    // slight random height variation to feel less flat
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = (Math.random() - 0.5) * 0.4;
      pos.setZ(i, y); // plane is XY, we rotate later
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
    return terrain;
  }

  /** Build a simple tank-like unit (body + turret + barrel) */
  private createTankMesh(color: number): THREE.Group {
    const group = new THREE.Group();

    // body
    const bodyGeo = new THREE.BoxGeometry(1.4, 0.5, 0.9);
    const bodyMat = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.25;
    body.castShadow = true;
    group.add(body);

    // turret
    const turretGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.3, 8);
    const turret = new THREE.Mesh(turretGeo, bodyMat);
    turret.position.y = 0.6;
    turret.castShadow = true;
    group.add(turret);

    // barrel
    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.55, 0.6, 0);
    barrel.castShadow = true;
    group.add(barrel);

    // store barrel for later aiming
    group.userData.barrel = barrel;
    group.userData.turret = turret;

    return group;
  }

  /** Place player (left) and AI (right) at random-ish positions on the terrain */
  placeUnits(): { player: UnitPlacement; ai: UnitPlacement } {
    const playerMesh = this.createTankMesh(0x3b82f6); // blue
    const aiMesh = this.createTankMesh(0xef4444);     // red

    // simple random X within safe bounds
    const playerX = -12 + Math.random() * 4;
    const aiX = 8 + Math.random() * 4;

    playerMesh.position.set(playerX, 0.25, 0);
    aiMesh.position.set(aiX, 0.25, 0);
    aiMesh.rotation.y = Math.PI; // face left

    this.scene.add(playerMesh);
    this.scene.add(aiMesh);

    return {
      player: { position: playerMesh.position.clone(), mesh: playerMesh },
      ai: { position: aiMesh.position.clone(), mesh: aiMesh },
    };
  }
}
