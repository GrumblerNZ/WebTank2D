/**
 * Game logic module – evolved from the old Java turn manager +
 * XOR hit detection on polygons.
 *
 * Now: turn state machine + simple projectile simulation + mesh hit test.
 */

import * as THREE from 'three';
import { AIModule, ShotDecision } from './ai';

export type Turn = 'player' | 'ai' | 'animating';

export class GameLogicModule {
  private turn: Turn = 'player';
  private ai: AIModule;
  private scene: THREE.Scene;
  private projectile: THREE.Mesh | null = null;
  private onTurnChange: (turn: Turn) => void;
  private onStatus: (msg: string) => void;
  private onHit: (winner: 'player' | 'ai' | null) => void;
  private lastShooter: 'player' | 'ai' = 'player';

  // simple gravity + wind placeholders
  private gravity = -9.8;
  private wind = 0;

  constructor(
    scene: THREE.Scene,
    onTurnChange: (turn: Turn) => void,
    onStatus: (msg: string) => void,
    onHit: (winner: 'player' | 'ai' | null) => void
  ) {
    this.scene = scene;
    this.ai = new AIModule();
    this.onTurnChange = onTurnChange;
    this.onStatus = onStatus;
    this.onHit = onHit;
  }

  get currentTurn(): Turn {
    return this.turn;
  }

  setWind(w: number) {
    this.wind = w;
  }

  /** Player fires – starts projectile animation */
  playerFire(
    from: THREE.Vector3,
    angleDeg: number,
    power: number,
    targetMesh: THREE.Object3D
  ) {
    if (this.turn !== 'player') return;
    this.lastShooter = 'player';
    this.turn = 'animating';
    this.onTurnChange(this.turn);
    this.onStatus(`Player fires @ ${angleDeg}° power ${power}`);
    this.launchProjectile(from, angleDeg, power, targetMesh, 'player');
  }

  /** AI takes its turn */
  aiFire(aiPos: THREE.Vector3, playerPos: THREE.Vector3, playerMesh: THREE.Object3D) {
    if (this.turn !== 'ai') return;
    const decision: ShotDecision = this.ai.decideShot(aiPos.x, playerPos.x);
    this.lastShooter = 'ai';
    this.turn = 'animating';
    this.onTurnChange(this.turn);
    this.onStatus(`AI fires @ ${decision.angle}° power ${decision.power}`);
    // AI faces left, so angle is mirrored
    this.launchProjectile(aiPos, 180 - decision.angle, decision.power, playerMesh, 'ai');
  }

  private launchProjectile(
    from: THREE.Vector3,
    angleDeg: number,
    power: number,
    targetMesh: THREE.Object3D,
    shooter: 'player' | 'ai'
  ) {
    // clean previous
    if (this.projectile) {
      this.scene.remove(this.projectile);
      this.projectile = null;
    }

    const geo = new THREE.SphereGeometry(0.15, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    this.projectile = new THREE.Mesh(geo, mat);
    this.projectile.position.copy(from);
    this.projectile.position.y += 0.8;
    this.scene.add(this.projectile);

    const angleRad = (angleDeg * Math.PI) / 180;
    // power 10-100 → speed roughly 8-25
    const speed = 5 + (power / 100) * 20;
    let vx = Math.cos(angleRad) * speed;
    let vy = Math.sin(angleRad) * speed;

    const startTime = performance.now();
    const duration = 4000; // max 4s flight

    const animate = (now: number) => {
      if (!this.projectile) return;

      const t = (now - startTime) / 1000; // seconds
      if (t > duration / 1000) {
        this.endShot(null);
        return;
      }

      // simple physics
      this.projectile.position.x = from.x + vx * t + 0.5 * this.wind * t * t;
      this.projectile.position.y = from.y + 0.8 + vy * t + 0.5 * this.gravity * t * t;

      // hit test (simple distance for now – later raycast / precise mesh)
      const dist = this.projectile.position.distanceTo(targetMesh.position);
      if (dist < 1.2 && this.projectile.position.y < 1.5) {
        this.endShot(shooter === 'player' ? 'player' : 'ai');
        return;
      }

      // ground hit
      if (this.projectile.position.y <= 0.1) {
        this.endShot(null);
        return;
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  private endShot(winner: 'player' | 'ai' | null) {
    if (this.projectile) {
      this.scene.remove(this.projectile);
      this.projectile = null;
    }

    if (winner) {
      this.onStatus(winner === 'player' ? 'HIT! Player wins the round.' : 'HIT! AI wins the round.');
      this.onHit(winner);
      setTimeout(() => {
        this.turn = winner === 'player' ? 'ai' : 'player';
        this.onTurnChange(this.turn);
        this.onStatus(this.turn === 'player' ? 'Your turn.' : 'AI thinking...');
      }, 1500);
    } else {
      this.onStatus('Missed.');
      setTimeout(() => {
        // flip to the other player
        this.turn = this.lastShooter === 'player' ? 'ai' : 'player';
        this.onTurnChange(this.turn);
        this.onStatus(this.turn === 'player' ? 'Your turn.' : 'AI thinking...');
      }, 800);
    }
  }

  /** Force next turn (used by main after AI thinks) */
  setTurn(t: Turn) {
    this.turn = t;
    this.onTurnChange(t);
  }
}
