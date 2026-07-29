/**
 * WebTank2D – browser evolution of the old Java artillery game.
 * Modules mirror the original structure:
 *   Geometry  → procedural terrain + unit placement
 *   AI        → simple angle/power decision
 *   GameLogic → turns + projectile + hit detection
 *   UI        → input + HUD
 */

import * as THREE from 'three';
import { GeometryModule } from './modules/geometry';
import { GameLogicModule, Turn } from './modules/gameLogic';
import { UIModule } from './modules/ui';

// ---- scene setup ----
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // sky
scene.fog = new THREE.Fog(0x87ceeb, 25, 60);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 12, 22);
camera.lookAt(0, 0, 0);

// lights
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
const units = geometry.placeUnits();

const ui = new UIModule((angle, power) => {
  game.playerFire(units.player.position, angle, power, units.ai.mesh);
});

const game = new GameLogicModule(
  scene,
  (turn: Turn) => {
    ui.setTurn(turn);
    if (turn === 'ai') {
      // short “thinking” delay then AI fires
      setTimeout(() => {
        game.aiFire(units.ai.position, units.player.position, units.player.mesh);
      }, 900);
    }
  },
  (msg) => ui.setStatus(msg),
  (_winner) => {
    // round over – for now just continue; later add score / reset
  }
);

// initial state
ui.setTurn('player');
ui.setStatus('Aim with sliders or arrows, Space / FIRE to shoot.');

// ---- resize ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- render loop ----
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
