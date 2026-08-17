/**
 * WebTank2D – browser evolution of the old Java artillery game.
 * Modules:
 *   Geometry   → terrain + tanks
 *   SkyObjects → aerial skill items (bounce pad / black hole)
 *   AI         → angle/power decision
 *   GameLogic  → turns + physics + hits
 *   UI         → HUD + input
 */

import * as THREE from 'three';
import { GeometryModule } from './modules/geometry';
import { GameLogicModule, Turn, Wind2D } from './modules/gameLogic';
import { UIModule } from './modules/ui';
import { SkyObjectsModule } from './modules/skyObjects';

// ---- scene setup ----
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 25, 60);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 12, 22);
camera.lookAt(0, 0, 0);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
sun.position.set(10, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// ---- modules ----
const geometry = new GeometryModule(scene);
geometry.createTerrain();
let units = geometry.placeUnits();

const skyObjects = new SkyObjectsModule(scene);

let playerScore = 0;
let aiScore = 0;

function randomWind(): Wind2D {
  const mild = () => {
    const r = (Math.random() + Math.random() + Math.random()) / 3;
    return (r - 0.5) * 2;
  };
  return {
    x: mild() * 5.5,
    y: mild() * 4.0,
  };
}

function randomGravity(): number {
  return -(6 + Math.random() * 8);
}

function applyWeather() {
  const wind = randomWind();
  const g = randomGravity();
  game.setWind(wind);
  game.setGravity(g);
  ui.setWind(wind);
  ui.setGravity(g);
}

function aimPlayerBarrel(angleDeg: number) {
  GeometryModule.setBarrelAngle(units.player.mesh, angleDeg);
}

function describeSkyObject(): string {
  const obj = skyObjects.active;
  if (!obj) return '';
  if (obj.type === 'blackhole') return 'Black hole in the air – it pulls your shell.';
  const names = ['', '', '', 'triangle', 'square', 'pentagon', 'hexagon', 'heptagon', 'octagon'];
  return `Bounce ${names[obj.sides] ?? 'pad'} in the air – ricochet off it or avoid it.`;
}

const ui = new UIModule(
  (angle, power) => {
    game.playerFire(units.player.position, angle, power, units.ai.mesh);
  },
  (angle) => {
    aimPlayerBarrel(angle);
  }
);

function resetRound() {
  geometry.removeUnits(units);

  const hill = geometry.randomHillParams();
  geometry.rebuildTerrain(hill.centerX, hill.height, hill.width);

  units = geometry.placeUnits();
  aimPlayerBarrel(ui.getAngle());

  // One random aerial skill object per round
  skyObjects.spawnRandom();

  game.setTurn('player');
  ui.setStatus(`New round. ${describeSkyObject()}`);
}

const game = new GameLogicModule(
  scene,
  (turn: Turn) => {
    ui.setTurn(turn);
    if (turn === 'player' || turn === 'ai') {
      applyWeather();
    }
    if (turn === 'ai') {
      setTimeout(() => {
        game.aiFire(
          units.ai.position,
          units.player.position,
          units.player.mesh,
          units.ai.mesh
        );
      }, 900);
    }
  },
  (msg) => ui.setStatus(msg),
  (winner) => {
    if (winner === 'player') playerScore++;
    else if (winner === 'ai') aiScore++;
    ui.setScore(playerScore, aiScore);

    setTimeout(() => {
      resetRound();
    }, 1800);
  }
);

game.setGroundHeightFn((x) => geometry.getHeightAt(x));
game.setSkyObjects(skyObjects);

// initial state
ui.setScore(0, 0);
aimPlayerBarrel(ui.getAngle());
skyObjects.spawnRandom();
applyWeather();
ui.setTurn('player');
ui.setStatus(`Aim and fire. ${describeSkyObject()}`);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  // Gentle spin on black hole ring for readability
  const obj = skyObjects.active;
  if (obj && obj.type === 'blackhole') {
    obj.mesh.rotation.z += 0.01;
  }
  renderer.render(scene, camera);
}
animate();
