/**
 * Game logic module – evolved from the old Java turn manager +
 * XOR hit detection on polygons.
 *
 * Now: turn state machine + projectile sim with 2D wind + terrain height.
 */

import * as THREE from 'three';
import { AIModule, ShotDecision } from './ai';

export type Turn = 'player' | 'ai' | 'animating';

export interface Wind2D {
  x: number; // horizontal: + = right, - = left
  y: number; // vertical:   + = lift,  - = extra gravity
}

export class GameLogicModule {
  private turn: Turn = 'player';
  private ai: AIModule;
  private scene: THREE.Scene;
  private projectile: THREE.Mesh | null = null;
  private onTurnChange: (turn: Turn) => void;
  private onStatus: (msg: string) => void;
  private onHit: (winner: 'player' | 'ai' | null) => void;
  private lastShooter: 'player' | 'ai' = 'player';

  private gravity = -9.8;
  private wind: Wind2D = { x: 0, y: 0 };
  private getGroundHeight: (x: number) => number = () => 0;

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

  setWind(w: Wind2D) {
    this.wind = w;
  }

  setGroundHeightFn(fn: (x: number) => number) {
    this.getGroundHeight = fn;
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
    const speed = 5 + (power / 100) * 20;
    const vx = Math.cos(angleRad) * speed;
    const vy = Math.sin(angleRad) * speed;

    const startY = from.y + 0.8;
    const startTime = performance.now();
    const duration = 5000;

    const animate = (now: number) => {
      if (!this.projectile) return;

      const t = (now - startTime) / 1000;
      if (t > duration / 1000) {
        this.endShot(null);
        return;
      }

      // 2D wind: horizontal (x) + vertical lift/downforce (y)
      this.projectile.position.x =
        from.x + vx * t + 0.5 * this.wind.x * t * t;
      this.projectile.position.y =
        startY + vy * t + 0.5 * (this.gravity + this.wind.y) * t * t;

      // tank hit (simple distance)
      const dist = this.projectile.position.distanceTo(targetMesh.position);
      if (dist < 1.3) {
        this.endShot(shooter === 'player' ? 'player' : 'ai');
        return;
      }

      // terrain hit – use analytic hill height
      const groundY = this.getGroundHeight(this.projectile.position.x);
      if (this.projectile.position.y <= groundY + 0.15) {
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
      this.turn = 'animating';
      this.onTurnChange(this.turn);
      this.onHit(winner);
    } else {
      this.onStatus('Missed.');
      setTimeout(() => {
        this.turn = this.lastShooter === 'player' ? 'ai' : 'player';
        this.onTurnChange(this.turn);
        this.onStatus(this.turn === 'player' ? 'Your turn.' : 'AI thinking...');
      }, 800);
    }
  }

  setTurn(t: Turn) {
    this.turn = t;
    this.onTurnChange(t);
  }
}
