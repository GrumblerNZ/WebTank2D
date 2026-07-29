# WebTank2D

Browser evolution of a classic 2D artillery / tank duel game (the one many of us first saw on an Apple II at a friend’s house).

**Goal of this repo**  
Use the next ~2 months (while the dogs recover from TPLO) to get solid, practical AWS exposure by building and deploying this game.

## Module mapping (old Java → modern)

| Old Java module              | New location                  | Notes |
|-----------------------------|-------------------------------|-------|
| Geometry module             | `src/modules/geometry.ts`     | Procedural terrain + unit placement |
| Computer AI move module     | `src/modules/ai.ts`           | Simple angle/power heuristic (later → Lambda) |
| Game logic module           | `src/modules/gameLogic.ts`    | Turns, projectile physics, hit detection |
| UI + user input module      | `src/modules/ui.ts`           | HUD, keyboard, mouse/touch |

## Quick start (local)

```bash
git clone https://github.com/GrumblerNZ/WebTank2D.git
cd WebTank2D
# (or copy the files from this scaffold into the empty repo)
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

Controls:
- Angle / Power sliders or ← → ↑ ↓
- Space or FIRE button to shoot
- Move button is a placeholder for the “mover” feature

## Planned AWS learning path (game as the test application)

1. **Weeks 1-2** – Finish local 3D prototype (terrain, mover, better physics, scoring)
2. **Weeks 3-4** – Static hosting: S3 + CloudFront  
   + first Lambda + API Gateway + DynamoDB (high-score table)
3. **Weeks 5-6** – Cognito (or Amplify Auth) + move AI decision into Lambda
4. **Weeks 7-8** – CDK (TypeScript), CloudWatch, basic cost alerts

## Tech stack right now

- Vite + TypeScript
- Three.js (3D from day one – the “evolved” version)
- Pure client-side for the first playable loop

## Status

Scaffold only. Playable single-player vs AI loop is present but intentionally simple so we can iterate quickly while learning AWS.
