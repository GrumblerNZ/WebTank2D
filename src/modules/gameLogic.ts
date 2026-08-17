/**
 * Game logic module – evolved from the old Java turn manager +
 * XOR hit detection on polygons.
 *
 * Turn state machine + projectile sim with 2D wind, terrain,
 * aerial skill objects (bounce pad / black hole), impact flash.
 */

import * as THREE from 'three';
import { AIModule, ShotDecision } from './ai';
import { GeometryModule } from './geometry';
import { SkyObjectsModule, SkyObject } from './skyObjects';

export type Turn = 'player' | 'ai' | 'animating';

export interface Wind2D {
  x: number;
  y: number;
}

export class GameLogicModule {
  private turn: Turn = 'player';
  private ai: AIModule;
  private scene: THREE.Scene;
  private projectile: THREE.Mesh | null = null;
  private impactGroup: THREE.Group | null = null;
  private onTurnChange: (turn: Turn) => void;
  private onStatus: (msg: string) => void;
  private onHit: (winner: 'player' | 'ai' | null) => void;
  private lastShooter: 'player' | 'ai' = 'player';

  private gravity = -9.8;
  private wind: Wind2D = { x: 0, y: 0 };
  private getGroundHeight: (x: number) => number = () => 0;
  private sky: SkyObjectsModule | null = null;
  private bounceUsed = false; // one bounce per flight to avoid sticky loops

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

  setGravity(g: number) {
    this.gravity = g;
  }

  setGroundHeightFn(fn: (x: number) => number) {
    this.getGroundHeight = fn;
  }

  setSkyObjects(sky: SkyObjectsModule) {
    this.sky = sky;
  }

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

  aiFire(
    aiPos: THREE.Vector3,
    playerPos: THREE.Vector3,
    playerMesh: THREE.Object3D,
    aiMesh?: THREE.Group
  ) {
    if (this.turn !== 'ai') return;
    const decision: ShotDecision = this.ai.decideShot(aiPos.x, playerPos.x);
    this.lastShooter = 'ai';
    this.turn = 'animating';
    this.onTurnChange(this.turn);
    this.onStatus(`AI fires @ ${decision.angle}° power ${decision.power}`);
    if (aiMesh) {
      GeometryModule.setBarrelAngle(aiMesh, decision.angle);
    }
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
    this.clearImpact();
    this.bounceUsed = false;

    const geo = new THREE.SphereGeometry(0.15, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    this.projectile = new THREE.Mesh(geo, mat);
    this.projectile.position.copy(from);
    this.projectile.position.y += 0.8;
    this.scene.add(this.projectile);

    const angleRad = (angleDeg * Math.PI) / 180;
    const speed = 5 + (power / 100) * 20;
    let vx = Math.cos(angleRad) * speed;
    let vy = Math.sin(angleRad) * speed;

    let lastTime = performance.now();
    const startTime = lastTime;
    const maxFlight = 6000;

    const animate = (now: number) => {
      if (!this.projectile) return;

      if (now - startTime > maxFlight) {
        this.endShot(null, this.projectile.position.clone(), null);
        return;
      }

      // Variable dt, clamped for stability
      let dt = (now - lastTime) / 1000;
      lastTime = now;
      if (dt > 0.05) dt = 0.05;
      if (dt <= 0) {
        requestAnimationFrame(animate);
        return;
      }

      // Base forces: gravity + wind
      let ax = this.wind.x;
      let ay = this.gravity + this.wind.y;

      // Black hole pull
      const skyObj = this.sky?.active ?? null;
      if (skyObj && skyObj.type === 'blackhole') {
        const pull = this.sky!.blackHoleAccel(
          this.projectile.position.x,
          this.projectile.position.y,
          skyObj
        );
        ax += pull.ax;
        ay += pull.ay;

        // Swallowed by the hole
        const dx = this.projectile.position.x - skyObj.x;
        const dy = this.projectile.position.y - skyObj.y;
        if (dx * dx + dy * dy < skyObj.radius * skyObj.radius * 0.35) {
          this.onStatus('Swallowed by the black hole!');
          this.endShot(null, this.projectile.position.clone(), null);
          return;
        }
      }

      vx += ax * dt;
      vy += ay * dt;
      this.projectile.position.x += vx * dt;
      this.projectile.position.y += vy * dt;

      // Bounce pad
      if (skyObj && skyObj.type === 'bounce' && !this.bounceUsed) {
        if (this.sky!.hitsBounce(this.projectile.position.x, this.projectile.position.y, skyObj)) {
          const reflected = this.sky!.reflect(vx, vy, skyObj);
          vx = reflected.vx;
          vy = reflected.vy;
          this.bounceUsed = true;
          // Nudge out so we don't re-collide next frame
          this.projectile.position.x += reflected.vx * 0.05;
          this.projectile.position.y += reflected.vy * 0.05;
          this.onStatus('Bounce!');
        }
      }

      // Tank hit
      const dist = this.projectile.position.distanceTo(targetMesh.position);
      if (dist < 1.3) {
        const hitPos = this.projectile.position.clone();
        this.endShot(shooter === 'player' ? 'player' : 'ai', hitPos, targetMesh);
        return;
      }

      // Terrain
      const groundY = this.getGroundHeight(this.projectile.position.x);
      if (this.projectile.position.y <= groundY + 0.15) {
        const hitPos = this.projectile.position.clone();
        hitPos.y = groundY + 0.2;
        this.onStatus('Missed.');
        this.endShot(null, hitPos, null);
        return;
      }

      // Out of bounds
      if (
        this.projectile.position.x < -22 ||
        this.projectile.position.x > 22 ||
        this.projectile.position.y > 30
      ) {
        this.endShot(null, this.projectile.position.clone(), null);
        return;
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  private clearImpact() {
    if (this.impactGroup) {
      this.scene.remove(this.impactGroup);
      this.impactGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            (obj.material as THREE.Material).dispose();
          }
        }
      });
      this.impactGroup = null;
    }
  }

  private playImpact(
    pos: THREE.Vector3,
    tankHit: boolean,
    targetMesh: THREE.Object3D | null,
    onDone: () => void
  ) {
    this.clearImpact();

    const group = new THREE.Group();
    group.position.copy(pos);
    this.impactGroup = group;
    this.scene.add(group);

    if (tankHit) {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffee58, transparent: true, opacity: 1 })
      );
      group.add(core);

      const fire = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xff6d00, transparent: true, opacity: 0.85 })
      );
      group.add(fire);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.65, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffeb3b,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);

      const ring2 = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 0.95, 24),
        new THREE.MeshBasicMaterial({
          color: 0xff9100,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        })
      );
      ring2.rotation.x = -Math.PI / 2;
      group.add(ring2);
    } else {
      const dust = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x8d6e63, transparent: true, opacity: 0.75 })
      );
      group.add(dust);

      const dust2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xa1887f, transparent: true, opacity: 0.4 })
      );
      group.add(dust2);
    }

    const start = performance.now();
    const duration = tankHit ? 1100 : 700;
    let blinkOn = true;
    let lastBlink = start;

    const animateImpact = (now: number) => {
      const elapsed = now - start;
      const u = Math.min(1, elapsed / duration);

      const scale = 1 + u * (tankHit ? 2.8 : 1.6);
      group.scale.setScalar(scale);
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mat = obj.material as THREE.MeshBasicMaterial;
          if (mat.transparent) {
            mat.opacity = Math.max(0, (tankHit ? 1 : 0.75) * (1 - u));
          }
        }
      });

      if (tankHit && targetMesh && now - lastBlink > 90) {
        blinkOn = !blinkOn;
        targetMesh.visible = blinkOn;
        lastBlink = now;
      }

      if (u < 1) {
        requestAnimationFrame(animateImpact);
      } else {
        if (targetMesh) targetMesh.visible = true;
        this.clearImpact();
        onDone();
      }
    };

    requestAnimationFrame(animateImpact);
  }

  private endShot(
    winner: 'player' | 'ai' | null,
    hitPos: THREE.Vector3,
    targetMesh: THREE.Object3D | null
  ) {
    if (this.projectile) {
      this.scene.remove(this.projectile);
      this.projectile = null;
    }

    const tankHit = winner !== null;

    if (tankHit) {
      this.onStatus(winner === 'player' ? 'HIT! Player wins the round.' : 'HIT! AI wins the round.');
      this.turn = 'animating';
      this.onTurnChange(this.turn);
    }
    // Miss / swallowed status is set by the caller when needed; default to Missed
    // only if we didn't already announce something special (black hole sets its own).
    // Bounce is mid-flight so does not end the shot.

    this.playImpact(hitPos, tankHit, targetMesh, () => {
      if (winner) {
        this.onHit(winner);
      } else {
        setTimeout(() => {
          this.turn = this.lastShooter === 'player' ? 'ai' : 'player';
          this.onTurnChange(this.turn);
          this.onStatus(this.turn === 'player' ? 'Your turn.' : 'AI thinking...');
        }, 200);
      }
    });
  }

  setTurn(t: Turn) {
    this.turn = t;
    this.onTurnChange(t);
  }
}
