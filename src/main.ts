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
import { GameLogicModule, Turn, Wind2D } from './modules/gameLogic';
import { UIModule } from './modules/ui';

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

let playerScore = 0;
let aiScore = 0;

/** Random 2D wind: horizontal push + vertical lift / downforce. */
function randomWind(): Wind2D {
  const mild = () => {
    const r = (Math.random() + Math.random() + Math.random()) / 3;
    return (r - 0.5) * 2;
  };
  return {
    x: mild() * 5.5, // left / right
    y: mild() * 4.0, // lift (+) or extra gravity (−)
  };
}

function applyWind(wind: Wind2D) {
  game.setWind(wind);
  ui.setWind(wind);
}

const ui = new UIModule((angle, power) => {
  game.playerFire(units.player.position, angle, power, units.ai.mesh);
});

function resetRound() {
  geometry.removeUnits(units);

  // new random hill between the sides
  const hill = geometry.randomHillParams();
  geometry.rebuildTerrain(hill.centerX, hill.height, hill.width);

  units = geometry.placeUnits();
  applyWind(randomWind());
  game.setTurn('player');
  ui.setStatus('New round – aim and fire.');
}

const game = new GameLogicModule(
  scene,
  (turn: Turn) => {
    ui.setTurn(turn);
    if (turn === 'ai') {
      setTimeout(() => {
        game.aiFire(units.ai.position, units.player.position, units.player.mesh);
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

// wire terrain height into physics
game.setGroundHeightFn((x) => geometry.getHeightAt(x));

// initial state
ui.setScore(0, 0);
applyWind(randomWind());
ui.setTurn('player');
ui.setStatus('Aim with sliders or arrows, Space / FIRE to shoot.');

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
