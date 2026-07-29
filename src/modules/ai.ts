/**
 * Computer AI move module – evolved from the old Java random initial coords +
 * simple angle/speed decision logic.
 *
 * For now: very simple heuristic. Later we can move the heavy math to Lambda.
 */

export interface ShotDecision {
  angle: number; // degrees from horizontal
  power: number; // 10-100
}

export class AIModule {
  /**
   * Decide a shot against the player.
   * Simple version: aim roughly toward player with some noise.
   */
  decideShot(aiX: number, playerX: number): ShotDecision {
    const dx = playerX - aiX;
    // rough angle that would hit on flat ground (placeholder physics)
    let angle = 35 + Math.random() * 25; // 35-60°
    // bias a bit based on distance
    if (Math.abs(dx) > 18) angle = 50 + Math.random() * 15;
    if (Math.abs(dx) < 10) angle = 25 + Math.random() * 20;

    const power = 40 + Math.random() * 40; // 40-80

    return {
      angle: Math.round(angle),
      power: Math.round(power),
    };
  }
}
