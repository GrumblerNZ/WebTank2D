/**
 * UI and user input module – evolved from the old Java keyboard/mouse handler.
 * Now also drives the HUD and range inputs.
 */

export class UIModule {
  private angleInput: HTMLInputElement;
  private powerInput: HTMLInputElement;
  private angleVal: HTMLElement;
  private powerVal: HTMLElement;
  private fireBtn: HTMLButtonElement;
  private moveBtn: HTMLButtonElement;
  private turnInfo: HTMLElement;
  private status: HTMLElement;

  private onFire: (angle: number, power: number) => void;

  constructor(onFire: (angle: number, power: number) => void) {
    this.onFire = onFire;

    this.angleInput = document.getElementById('angle') as HTMLInputElement;
    this.powerInput = document.getElementById('power') as HTMLInputElement;
    this.angleVal = document.getElementById('angle-val') as HTMLElement;
    this.powerVal = document.getElementById('power-val') as HTMLElement;
    this.fireBtn = document.getElementById('fire-btn') as HTMLButtonElement;
    this.moveBtn = document.getElementById('move-btn') as HTMLButtonElement;
    this.turnInfo = document.getElementById('turn-info') as HTMLElement;
    this.status = document.getElementById('status') as HTMLElement;

    this.angleInput.addEventListener('input', () => {
      this.angleVal.textContent = this.angleInput.value;
    });
    this.powerInput.addEventListener('input', () => {
      this.powerVal.textContent = this.powerInput.value;
    });

    this.fireBtn.addEventListener('click', () => {
      const angle = parseInt(this.angleInput.value, 10);
      const power = parseInt(this.powerInput.value, 10);
      this.onFire(angle, power);
    });

    // keyboard shortcuts (Arrow keys + Space)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.fireBtn.click();
      }
      if (e.code === 'ArrowLeft') {
        this.angleInput.value = String(Math.max(5, parseInt(this.angleInput.value) - 2));
        this.angleVal.textContent = this.angleInput.value;
      }
      if (e.code === 'ArrowRight') {
        this.angleInput.value = String(Math.min(85, parseInt(this.angleInput.value) + 2));
        this.angleVal.textContent = this.angleInput.value;
      }
      if (e.code === 'ArrowUp') {
        this.powerInput.value = String(Math.min(100, parseInt(this.powerInput.value) + 2));
        this.powerVal.textContent = this.powerInput.value;
      }
      if (e.code === 'ArrowDown') {
        this.powerInput.value = String(Math.max(10, parseInt(this.powerInput.value) - 2));
        this.powerVal.textContent = this.powerInput.value;
      }
    });
  }

  setTurn(turn: string) {
    if (turn === 'player') {
      this.turnInfo.textContent = 'Player Turn';
      this.turnInfo.style.color = '#7dd3fc';
      this.fireBtn.disabled = false;
    } else if (turn === 'ai') {
      this.turnInfo.textContent = 'AI Turn';
      this.turnInfo.style.color = '#f87171';
      this.fireBtn.disabled = true;
    } else {
      this.turnInfo.textContent = 'Projectile in flight…';
      this.turnInfo.style.color = '#fbbf24';
      this.fireBtn.disabled = true;
    }
  }

  setStatus(msg: string) {
    this.status.textContent = msg;
  }

  enableMove(enabled: boolean) {
    this.moveBtn.disabled = !enabled;
  }
}
