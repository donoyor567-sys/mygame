import { soundEngine } from './audio';
import {
  BotDifficulty,
  Fighter,
  FloatingText,
  GamePhase,
  HudSnapshot,
  MatchConfig,
  Particle,
  Shockwave,
} from './types';

export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 520;
const GROUND_Y = 402;
const LEFT_BOUND = 48;
const RIGHT_BOUND = 912;

const MOVE_SPEED = 278;
const GUARD_MOVE_FACTOR = 0.35;
const JUMP_VELOCITY = -690;
const GRAVITY = 1980;
const COYOTE_TIME = 0.095;
const JUMP_BUFFER_TIME = 0.11;
const ATTACK_BUFFER_TIME = 0.13;

const LIGHT_DURATION = 0.26;
const LIGHT_COOLDOWN = 0.4;
const LIGHT_HIT_AT = 0.15;
const LIGHT_DAMAGE = 10;
const LIGHT_RANGE = 108;

const HEAVY_DURATION = 0.46;
const HEAVY_COOLDOWN = 0.8;
const HEAVY_HIT_AT = 0.2;
const HEAVY_DAMAGE = 18;
const HEAVY_RANGE = 124;

interface Building {
  x: number;
  w: number;
  h: number;
  layer: 0 | 1;
  windows: Array<{ rx: number; ry: number; lit: boolean; warm: boolean }>;
  antenna: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export interface VirtualInputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  guard: boolean;
  light: boolean;
  heavy: boolean;
}

export class StickmanGameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private phase: GamePhase = 'TITLE_MENU';
  private config: MatchConfig = {
    mode: 'PVP',
    difficulty: 'NORMAL',
    bestOf: 3,
  };

  private fighters: [Fighter, Fighter];
  private particles: Particle[];
  private shockwaves: Shockwave[];
  private floatingTexts: FloatingText[];
  private buildings: Building[];
  private stars: Star[];
  private embers: Ember[];

  private heldKeys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private touchP1: VirtualInputState = {
    left: false,
    right: false,
    jump: false,
    guard: false,
    light: false,
    heavy: false,
  };
  private touchP1Just: { jump: boolean; light: boolean; heavy: boolean } = {
    jump: false,
    light: false,
    heavy: false,
  };

  private roundNumber = 1;
  private roundTimer = 99;
  private roundBannerTimer = 0;
  private roundBannerText = '';
  private roundOverTimer = 0;
  private roundOverReason: 'KO' | 'TIME' | null = null;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private elapsed = 0;
  private winnerId: 0 | 1 | null = null;

  // Bot AI memory
  private botThinkTimer = 0;
  private botDesiredMove: -1 | 0 | 1 = 0;
  private botGuardTimer = 0;

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private hudSyncAccum = 0;
  private lastSnapshotKey = '';

  constructor(canvas: HTMLCanvasElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D canvas context unavailable');
    }
    this.ctx = context;
    this.onHudUpdate = onHudUpdate;

    this.particles = Array.from({ length: 160 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 3,
      life: 0,
      maxLife: 1,
      color: '#ffffff',
      gravity: 0,
    }));

    this.shockwaves = Array.from({ length: 14 }, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 4,
      maxRadius: 60,
      life: 0,
      maxLife: 0.3,
      color: '#ffd166',
      lineWidth: 3,
    }));

    this.floatingTexts = Array.from({ length: 24 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -40,
      text: '',
      color: '#ffffff',
      life: 0,
      maxLife: 0.7,
      scale: 1,
    }));

    this.buildings = this.generateCitySkyline();
    this.stars = this.generateStars();
    this.embers = this.generateEmbers();

    this.fighters = [
      this.createFighter(0, 260, '#ff476b', '#ff8b6c', '1-O‘YINCHI'),
      this.createFighter(1, 700, '#43a8ff', '#7ce0ff', '2-O‘YINCHI'),
    ];
    this.fighters[0].face = 1;
    this.fighters[1].face = -1;

    this.resizeCanvas();
  }

  private createFighter(
    id: 0 | 1,
    x: number,
    color: string,
    accentColor: string,
    label: string
  ): Fighter {
    const face: 1 | -1 = id === 0 ? 1 : -1;
    return {
      id,
      label,
      x,
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      knockVx: 0,
      color,
      accentColor,
      hp: 100,
      trailHp: 100,
      face,
      grounded: true,
      coyoteTimer: 0,
      jumpBuffer: 0,
      attackBuffer: null,
      attackBufferTimer: 0,
      attackTimer: 0,
      attackDuration: 0,
      attackHitDone: false,
      attackType: 'LIGHT',
      attackVariant: 0,
      cooldown: 0,
      hitFlash: 0,
      hitStun: 0,
      guarding: false,
      walkCycle: 0,
      idlePhase: id === 0 ? 0 : Math.PI * 0.7,
      squashX: 1,
      squashY: 1,
      comboCount: 0,
      comboWindow: 0,
      maxCombo: 0,
      damageDealt: 0,
      roundsWon: 0,
      koFallProgress: 0,
      scarf: Array.from({ length: 5 }, (_, idx) => ({
        x: x - face * idx * 7,
        y: GROUND_Y - 76 + idx * 2,
      })),
    };
  }

  private generateCitySkyline(): Building[] {
    const list: Building[] = [];
    // Back layer
    for (let i = 0; i < 16; i++) {
      const w = 52 + ((i * 29) % 44);
      const h = 110 + ((i * 67) % 150);
      const x = i * 64 - 10;
      const windows: Building['windows'] = [];
      const cols = Math.floor((w - 14) / 12);
      const rows = Math.floor((h - 24) / 18);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seed = (i * 31 + r * 17 + c * 13) % 11;
          windows.push({
            rx: 8 + c * 12,
            ry: 12 + r * 18,
            lit: seed < 3,
            warm: seed % 2 === 0,
          });
        }
      }
      list.push({
        x,
        w,
        h,
        layer: 0,
        windows,
        antenna: i % 4 === 1,
      });
    }
    // Midground layer
    for (let i = 0; i < 12; i++) {
      const w = 64 + ((i * 37) % 50);
      const h = 75 + ((i * 53) % 110);
      const x = i * 86 - 20;
      const windows: Building['windows'] = [];
      const cols = Math.floor((w - 16) / 14);
      const rows = Math.floor((h - 20) / 20);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seed = (i * 19 + r * 23 + c * 7) % 9;
          windows.push({
            rx: 9 + c * 14,
            ry: 12 + r * 20,
            lit: seed < 3,
            warm: seed !== 1,
          });
        }
      }
      list.push({
        x,
        w,
        h,
        layer: 1,
        windows,
        antenna: i % 3 === 0,
      });
    }
    return list;
  }

  private generateStars(): Star[] {
    return Array.from({ length: 56 }, (_, i) => ({
      x: (i * 197 + 41) % ARENA_WIDTH,
      y: (i * 83 + 17) % 250,
      size: i % 5 === 0 ? 2.2 : 1.4,
      phase: i * 0.7,
      speed: 1.1 + (i % 4) * 0.45,
    }));
  }

  private generateEmbers(): Ember[] {
    return Array.from({ length: 24 }, (_, i) => ({
      x: (i * 149) % ARENA_WIDTH,
      y: 120 + ((i * 97) % 290),
      vx: -12 + (i % 5) * 6,
      vy: -16 - (i % 4) * 8,
      size: 1.5 + (i % 3) * 0.9,
      alpha: 0.2 + (i % 4) * 0.12,
    }));
  }

  public resizeCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = ARENA_WIDTH * dpr;
    this.canvas.height = ARENA_HEIGHT * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);
      this.step(dt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public setConfig(config: MatchConfig): void {
    this.config = config;
    this.fighters[1].label = config.mode === 'BOT' ? 'BOT' : '2-O‘YINCHI';
    this.pushHudSnapshot(true);
  }

  public getPhase(): GamePhase {
    return this.phase;
  }

  public startMatch(config?: MatchConfig): void {
    if (config) {
      this.config = config;
    }
    soundEngine.unlock();
    this.phase = 'PLAYING';
    this.roundNumber = 1;
    this.winnerId = null;
    this.fighters = [
      this.createFighter(0, 250, '#ff476b', '#ff8b6c', '1-O‘YINCHI'),
      this.createFighter(
        1,
        710,
        '#43a8ff',
        '#7ce0ff',
        this.config.mode === 'BOT' ? 'BOT' : '2-O‘YINCHI'
      ),
    ];
    this.resetRoundEntities();
    soundEngine.playRoundStart();
    this.pushHudSnapshot(true);
  }

  private resetRoundEntities(): void {
    const p1Wins = this.fighters[0].roundsWon;
    const p2Wins = this.fighters[1].roundsWon;
    const p1Damage = this.fighters[0].damageDealt;
    const p2Damage = this.fighters[1].damageDealt;
    const p1MaxCombo = this.fighters[0].maxCombo;
    const p2MaxCombo = this.fighters[1].maxCombo;

    this.fighters[0] = this.createFighter(0, 250, '#ff476b', '#ff8b6c', '1-O‘YINCHI');
    this.fighters[1] = this.createFighter(
      1,
      710,
      '#43a8ff',
      '#7ce0ff',
      this.config.mode === 'BOT' ? 'BOT' : '2-O‘YINCHI'
    );

    this.fighters[0].roundsWon = p1Wins;
    this.fighters[1].roundsWon = p2Wins;
    this.fighters[0].damageDealt = p1Damage;
    this.fighters[1].damageDealt = p2Damage;
    this.fighters[0].maxCombo = p1MaxCombo;
    this.fighters[1].maxCombo = p2MaxCombo;

    this.roundTimer = 99;
    this.roundBannerTimer = 1.05;
    this.roundBannerText =
      this.config.bestOf === 1 ? 'JANG BOSHLANDI!' : `${this.roundNumber}-RAUND · JANG!`;
    this.roundOverTimer = 0;
    this.roundOverReason = null;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.botThinkTimer = 0;
    this.botDesiredMove = 0;
    this.botGuardTimer = 0;

    for (const p of this.particles) p.active = false;
    for (const s of this.shockwaves) s.active = false;
    for (const t of this.floatingTexts) t.active = false;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') {
      this.phase = 'PAUSED';
      this.clearInputs();
      this.pushHudSnapshot(true);
    } else if (this.phase === 'PAUSED') {
      this.phase = 'PLAYING';
      this.lastTimestamp = performance.now();
      this.pushHudSnapshot(true);
    }
  }

  public returnToTitle(): void {
    this.phase = 'TITLE_MENU';
    this.clearInputs();
    this.fighters = [
      this.createFighter(0, 310, '#ff476b', '#ff8b6c', '1-O‘YINCHI'),
      this.createFighter(
        1,
        650,
        '#43a8ff',
        '#7ce0ff',
        this.config.mode === 'BOT' ? 'BOT' : '2-O‘YINCHI'
      ),
    ];
    this.roundBannerTimer = 0;
    this.roundOverTimer = 0;
    this.winnerId = null;
    this.pushHudSnapshot(true);
  }

  public handleKeyDown(code: string, key: string): void {
    const normalized = key.length === 1 ? key.toLowerCase() : key;
    if (!this.heldKeys.has(code) && !this.heldKeys.has(normalized)) {
      this.justPressedKeys.add(code);
      this.justPressedKeys.add(normalized);
    }
    this.heldKeys.add(code);
    this.heldKeys.add(normalized);
  }

  public handleKeyUp(code: string, key: string): void {
    const normalized = key.length === 1 ? key.toLowerCase() : key;
    this.heldKeys.delete(code);
    this.heldKeys.delete(normalized);
  }

  public setTouchControl(action: keyof VirtualInputState, pressed: boolean): void {
    const wasPressed = this.touchP1[action];
    this.touchP1[action] = pressed;
    if (pressed && !wasPressed) {
      if (action === 'jump') this.touchP1Just.jump = true;
      if (action === 'light') this.touchP1Just.light = true;
      if (action === 'heavy') this.touchP1Just.heavy = true;
    }
  }

  public clearInputs(): void {
    this.heldKeys.clear();
    this.justPressedKeys.clear();
    this.touchP1 = {
      left: false,
      right: false,
      jump: false,
      guard: false,
      light: false,
      heavy: false,
    };
    this.touchP1Just = { jump: false, light: false, heavy: false };
  }

  private step(dt: number): void {
    this.elapsed += dt;
    this.updateEmbers(dt);

    if (this.phase === 'TITLE_MENU') {
      this.updateTitleAmbientFighters(dt);
      this.updateParticles(dt);
      this.justPressedKeys.clear();
      this.touchP1Just = { jump: false, light: false, heavy: false };
      return;
    }

    if (this.phase === 'PAUSED') {
      this.justPressedKeys.clear();
      this.touchP1Just = { jump: false, light: false, heavy: false };
      return;
    }

    // Decay camera shake
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 36);

    // Hitstop freeze for heavy/light impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.justPressedKeys.clear();
      this.touchP1Just = { jump: false, light: false, heavy: false };
      return;
    }

    const timeScale = this.roundOverTimer > 0 && this.roundOverReason === 'KO' ? 0.36 : 1;
    const simDt = dt * timeScale;

    if (this.roundBannerTimer > 0) {
      this.roundBannerTimer = Math.max(0, this.roundBannerTimer - dt);
    }

    if (this.phase === 'PLAYING') {
      if (this.roundOverTimer > 0) {
        this.roundOverTimer -= dt;
        for (const f of this.fighters) {
          if (f.hp <= 0) {
            f.koFallProgress = Math.min(1, f.koFallProgress + dt * 2.2);
          }
        }
        this.updateFightersPhysicsOnly(simDt);
        this.updateParticles(simDt);
        this.updateShockwaves(simDt);
        this.updateFloatingTexts(dt);

        if (this.roundOverTimer <= 0) {
          this.advanceAfterRound();
        }
      } else {
        // Active combat
        if (this.roundBannerTimer <= 0.45) {
          this.roundTimer = Math.max(0, this.roundTimer - dt);
        }

        const p1Input = this.readP1Input();
        const p2Input =
          this.config.mode === 'BOT' ? this.computeBotInput(simDt) : this.readP2Input();

        this.updateFighter(this.fighters[0], this.fighters[1], p1Input, simDt);
        this.updateFighter(this.fighters[1], this.fighters[0], p2Input, simDt);

        // Prevent fighters from overlapping completely
        this.resolveFighterSeparation();

        // Check KO or Timeout
        const p1Dead = this.fighters[0].hp <= 0;
        const p2Dead = this.fighters[1].hp <= 0;
        if (p1Dead || p2Dead) {
          this.triggerRoundEnd('KO');
        } else if (this.roundTimer <= 0) {
          this.triggerRoundEnd('TIME');
        }

        this.updateParticles(simDt);
        this.updateShockwaves(simDt);
        this.updateFloatingTexts(dt);
      }
    } else if (this.phase === 'GAME_OVER') {
      this.updateFightersPhysicsOnly(simDt);
      this.updateParticles(simDt);
      this.updateShockwaves(simDt);
      this.updateFloatingTexts(dt);
    }

    // Smooth HP trail decay
    for (const f of this.fighters) {
      if (f.trailHp > f.hp) {
        f.trailHp = Math.max(f.hp, f.trailHp - dt * 42);
      } else {
        f.trailHp = f.hp;
      }
    }

    this.justPressedKeys.clear();
    this.touchP1Just = { jump: false, light: false, heavy: false };

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.05) {
      this.hudSyncAccum = 0;
      this.pushHudSnapshot(false);
    }
  }

  private updateTitleAmbientFighters(dt: number): void {
    this.fighters.forEach((f, idx) => {
      f.idlePhase += dt * 3.4;
      f.x = idx === 0 ? 310 + Math.sin(this.elapsed * 0.9) * 18 : 650 - Math.sin(this.elapsed * 0.9) * 18;
      f.y = GROUND_Y;
      f.face = idx === 0 ? 1 : -1;
      f.squashX += (1 - f.squashX) * Math.min(1, dt * 12);
      f.squashY += (1 - f.squashY) * Math.min(1, dt * 12);
      this.updateScarf(f, dt);
    });
  }

  private readP1Input(): {
    left: boolean;
    right: boolean;
    jumpJust: boolean;
    guard: boolean;
    lightJust: boolean;
    heavyJust: boolean;
  } {
    const left = this.heldKeys.has('KeyA') || this.heldKeys.has('a') || this.touchP1.left;
    const right = this.heldKeys.has('KeyD') || this.heldKeys.has('d') || this.touchP1.right;
    const guard = this.heldKeys.has('KeyS') || this.heldKeys.has('s') || this.touchP1.guard;
    const jumpJust =
      this.justPressedKeys.has('KeyW') || this.justPressedKeys.has('w') || this.touchP1Just.jump;
    const lightJust =
      this.justPressedKeys.has('KeyF') || this.justPressedKeys.has('f') || this.touchP1Just.light;
    const heavyJust =
      this.justPressedKeys.has('KeyG') || this.justPressedKeys.has('g') || this.touchP1Just.heavy;

    return { left, right, jumpJust, guard, lightJust, heavyJust };
  }

  private readP2Input(): {
    left: boolean;
    right: boolean;
    jumpJust: boolean;
    guard: boolean;
    lightJust: boolean;
    heavyJust: boolean;
  } {
    const left = this.heldKeys.has('ArrowLeft');
    const right = this.heldKeys.has('ArrowRight');
    const guard = this.heldKeys.has('ArrowDown');
    const jumpJust = this.justPressedKeys.has('ArrowUp');
    const lightJust = this.justPressedKeys.has('KeyK') || this.justPressedKeys.has('k');
    const heavyJust = this.justPressedKeys.has('KeyL') || this.justPressedKeys.has('l');

    return { left, right, jumpJust, guard, lightJust, heavyJust };
  }

  private computeBotInput(dt: number): {
    left: boolean;
    right: boolean;
    jumpJust: boolean;
    guard: boolean;
    lightJust: boolean;
    heavyJust: boolean;
  } {
    const bot = this.fighters[1];
    const player = this.fighters[0];
    const diff: BotDifficulty = this.config.difficulty;

    const dx = player.x - bot.x;
    const dist = Math.abs(dx);
    const dirToPlayer: 1 | -1 = dx >= 0 ? 1 : -1;

    const reactionPeriod = diff === 'EASY' ? 0.34 : diff === 'NORMAL' ? 0.18 : 0.09;
    const aggroRate = diff === 'EASY' ? 0.42 : diff === 'NORMAL' ? 0.68 : 0.88;
    const guardChance = diff === 'EASY' ? 0.15 : diff === 'NORMAL' ? 0.42 : 0.68;

    let jumpJust = false;
    let lightJust = false;
    let heavyJust = false;

    this.botThinkTimer -= dt;
    if (this.botGuardTimer > 0) {
      this.botGuardTimer -= dt;
    }

    if (this.botThinkTimer <= 0) {
      this.botThinkTimer = reactionPeriod * (0.8 + Math.random() * 0.4);

      // React to incoming heavy telegraph or close attack
      if (player.attackTimer > 0 && dist < 135 && Math.random() < guardChance) {
        this.botGuardTimer = 0.28;
        this.botDesiredMove = 0;
      } else if (dist > 118) {
        // Approach player
        this.botDesiredMove = dirToPlayer;
        if (Math.random() < (diff === 'HARD' ? 0.16 : 0.08) && bot.grounded) {
          jumpJust = true;
        }
      } else if (dist < 62) {
        // Too close, micro-space or strike
        if (Math.random() < aggroRate) {
          if (Math.random() < 0.32) {
            heavyJust = true;
          } else {
            lightJust = true;
          }
          this.botDesiredMove = 0;
        } else {
          this.botDesiredMove = dirToPlayer === 1 ? -1 : 1;
        }
      } else {
        // Sweet spot strike range
        this.botDesiredMove = Math.random() < 0.35 ? dirToPlayer : 0;
        if (Math.random() < aggroRate) {
          if (Math.random() < (diff === 'EASY' ? 0.22 : 0.38)) {
            heavyJust = true;
          } else {
            lightJust = true;
          }
        }
      }
    }

    const guard = this.botGuardTimer > 0 && bot.grounded && bot.attackTimer <= 0;
    return {
      left: !guard && this.botDesiredMove === -1,
      right: !guard && this.botDesiredMove === 1,
      jumpJust,
      guard,
      lightJust,
      heavyJust,
    };
  }

  private updateFighter(
    f: Fighter,
    op: Fighter,
    input: {
      left: boolean;
      right: boolean;
      jumpJust: boolean;
      guard: boolean;
      lightJust: boolean;
      heavyJust: boolean;
    },
    dt: number
  ): void {
    f.idlePhase += dt * 4.2;

    if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (f.hitStun > 0) f.hitStun = Math.max(0, f.hitStun - dt);
    if (f.cooldown > 0) f.cooldown = Math.max(0, f.cooldown - dt);
    if (f.comboWindow > 0) {
      f.comboWindow = Math.max(0, f.comboWindow - dt);
      if (f.comboWindow === 0) {
        f.comboCount = 0;
      }
    }

    // Input buffers
    if (input.jumpJust) {
      f.jumpBuffer = JUMP_BUFFER_TIME;
    } else if (f.jumpBuffer > 0) {
      f.jumpBuffer = Math.max(0, f.jumpBuffer - dt);
    }

    if (input.heavyJust) {
      f.attackBuffer = 'HEAVY';
      f.attackBufferTimer = ATTACK_BUFFER_TIME;
    } else if (input.lightJust) {
      f.attackBuffer = 'LIGHT';
      f.attackBufferTimer = ATTACK_BUFFER_TIME;
    } else if (f.attackBufferTimer > 0) {
      f.attackBufferTimer = Math.max(0, f.attackBufferTimer - dt);
      if (f.attackBufferTimer === 0) f.attackBuffer = null;
    }

    // Coyote time
    if (f.grounded) {
      f.coyoteTimer = COYOTE_TIME;
    } else if (f.coyoteTimer > 0) {
      f.coyoteTimer = Math.max(0, f.coyoteTimer - dt);
    }

    const canAct = f.hitStun <= 0 && this.roundBannerTimer <= 0.45;
    f.guarding = canAct && input.guard && f.grounded && f.attackTimer <= 0;

    // Movement
    let moveDir = 0;
    if (canAct && f.attackTimer <= 0) {
      if (input.left) moveDir -= 1;
      if (input.right) moveDir += 1;
    }
    const speedFactor = f.guarding ? GUARD_MOVE_FACTOR : 1;
    f.vx = moveDir * MOVE_SPEED * speedFactor;

    // Jump with coyote time & input buffer
    if (canAct && f.attackTimer <= 0 && !f.guarding && f.jumpBuffer > 0 && f.coyoteTimer > 0) {
      f.vy = JUMP_VELOCITY;
      f.grounded = false;
      f.coyoteTimer = 0;
      f.jumpBuffer = 0;
      f.squashX = 0.82;
      f.squashY = 1.22;
      soundEngine.playJump();
      this.spawnDust(f.x, GROUND_Y + 6, 6);
    }

    // Trigger buffered attack
    if (canAct && f.attackBuffer && f.cooldown <= 0 && f.attackTimer <= 0 && !f.guarding) {
      const heavy = f.attackBuffer === 'HEAVY';
      f.attackType = f.attackBuffer;
      f.attackDuration = heavy ? HEAVY_DURATION : LIGHT_DURATION;
      f.attackTimer = f.attackDuration;
      f.attackHitDone = false;
      f.attackVariant = (f.attackVariant + 1) % 2;
      f.cooldown = heavy ? HEAVY_COOLDOWN : LIGHT_COOLDOWN;
      f.attackBuffer = null;
      f.attackBufferTimer = 0;
      soundEngine.playWhoosh(heavy);

      // Slight forward step on attack
      f.knockVx += f.face * (heavy ? 115 : 55);
    }

    // Resolve active attack hit frame
    if (f.attackTimer > 0) {
      f.attackTimer = Math.max(0, f.attackTimer - dt);
      const hitAt = f.attackType === 'HEAVY' ? HEAVY_HIT_AT : LIGHT_HIT_AT;
      if (!f.attackHitDone && f.attackTimer <= hitAt) {
        f.attackHitDone = true;
        this.tryHitOpponent(f, op);
      }
    }

    // Apply physics
    f.x += (f.vx + f.knockVx) * dt;
    f.knockVx *= Math.pow(0.0025, dt);
    if (Math.abs(f.knockVx) < 4) f.knockVx = 0;

    const wasGrounded = f.grounded;
    f.y += f.vy * dt;
    f.vy += GRAVITY * dt;

    if (f.y >= GROUND_Y) {
      f.y = GROUND_Y;
      if (!wasGrounded && f.vy > 220) {
        f.squashX = 1.2;
        f.squashY = 0.82;
        soundEngine.playLand();
        this.spawnDust(f.x, GROUND_Y + 6, 5);
      }
      f.vy = 0;
      f.grounded = true;
    } else {
      f.grounded = false;
    }

    f.x = Math.max(LEFT_BOUND, Math.min(RIGHT_BOUND, f.x));

    // Auto face opponent when not mid-attack
    if (f.attackTimer <= 0 && Math.abs(op.x - f.x) > 4) {
      f.face = op.x >= f.x ? 1 : -1;
    }

    // Walk cycle
    if (f.grounded && Math.abs(f.vx) > 10) {
      f.walkCycle += Math.abs(f.vx) * dt * 0.048;
    }

    // Recover squash & stretch smoothly
    f.squashX += (1 - f.squashX) * Math.min(1, dt * 14);
    f.squashY += (1 - f.squashY) * Math.min(1, dt * 14);

    this.updateScarf(f, dt);
  }

  private updateFightersPhysicsOnly(dt: number): void {
    for (const f of this.fighters) {
      f.x += f.knockVx * dt;
      f.knockVx *= Math.pow(0.004, dt);
      f.y += f.vy * dt;
      f.vy += GRAVITY * dt;
      if (f.y >= GROUND_Y) {
        f.y = GROUND_Y;
        f.vy = 0;
        f.grounded = true;
      }
      f.x = Math.max(LEFT_BOUND, Math.min(RIGHT_BOUND, f.x));
      if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);
      f.squashX += (1 - f.squashX) * Math.min(1, dt * 10);
      f.squashY += (1 - f.squashY) * Math.min(1, dt * 10);
      this.updateScarf(f, dt);
    }
  }

  private updateScarf(f: Fighter, dt: number): void {
    const anchorX = f.x - f.face * 5;
    const anchorY = f.y - 76;
    f.scarf[0].x = anchorX;
    f.scarf[0].y = anchorY;

    const windX = -f.face * 26 - f.vx * 0.16 - f.knockVx * 0.12;
    for (let i = 1; i < f.scarf.length; i++) {
      const prev = f.scarf[i - 1];
      const curr = f.scarf[i];
      const targetX = prev.x + windX * 0.28 + Math.sin(this.elapsed * 7 + i * 0.9 + f.id) * 2.4;
      const targetY = prev.y + 3.2 + Math.cos(this.elapsed * 5 + i) * 1.4;
      const lerp = Math.min(1, dt * 22);
      curr.x += (targetX - curr.x) * lerp;
      curr.y += (targetY - curr.y) * lerp;
    }
  }

  private resolveFighterSeparation(): void {
    const [p1, p2] = this.fighters;
    const minDist = 34;
    const dx = p2.x - p1.x;
    const dy = Math.abs(p2.y - p1.y);
    if (Math.abs(dx) < minDist && dy < 72) {
      const push = (minDist - Math.abs(dx)) * 0.5;
      const sign = dx >= 0 ? 1 : -1;
      p1.x = Math.max(LEFT_BOUND, Math.min(RIGHT_BOUND, p1.x - sign * push));
      p2.x = Math.max(LEFT_BOUND, Math.min(RIGHT_BOUND, p2.x + sign * push));
    }
  }

  private tryHitOpponent(att: Fighter, def: Fighter): void {
    const heavy = att.attackType === 'HEAVY';
    const range = heavy ? HEAVY_RANGE : LIGHT_RANGE;
    const dx = (def.x - att.x) * att.face;
    const dy = Math.abs(def.y - att.y);

    // Must be mostly in front of attacker (or overlapping) and within vertical band
    if (dx < -22 || dx > range || dy > 86) {
      return;
    }

    const blocked = def.guarding && def.face !== att.face;
    const rawDamage = heavy ? HEAVY_DAMAGE : LIGHT_DAMAGE;
    const damage = blocked ? Math.ceil(rawDamage * 0.25) : rawDamage;

    def.hp = Math.max(0, def.hp - damage);
    att.damageDealt += damage;

    const hitX = (att.x + def.x) * 0.5 + att.face * 12;
    const hitY = def.y - 54;

    if (blocked) {
      def.knockVx = att.face * (heavy ? 185 : 95);
      def.hitFlash = 0.06;
      def.squashX = 0.9;
      def.squashY = 1.08;
      this.hitstopTimer = 0.025;
      this.shakeIntensity = Math.max(this.shakeIntensity, 4);
      soundEngine.playBlock();
      this.spawnSparks(hitX, hitY, '#7ce0ff', 10, 240);
      this.spawnShockwave(hitX, hitY, '#7ce0ff', 38, 0.22);
      this.spawnFloatingText(def.x, def.y - 110, 'HIMOYA!', '#7ce0ff', 0.95);
    } else {
      def.hitFlash = heavy ? 0.16 : 0.1;
      def.hitStun = heavy ? 0.26 : 0.14;
      def.attackTimer = 0;
      def.knockVx = att.face * (heavy ? 450 : 215);
      if (heavy) {
        def.vy = Math.min(def.vy, -210);
        def.grounded = false;
      }
      def.squashX = heavy ? 1.28 : 1.16;
      def.squashY = heavy ? 0.76 : 0.88;

      // Combo tracking
      att.comboCount += 1;
      att.comboWindow = 1.65;
      att.maxCombo = Math.max(att.maxCombo, att.comboCount);
      def.comboCount = 0;
      def.comboWindow = 0;

      this.hitstopTimer = heavy ? 0.075 : 0.036;
      this.shakeIntensity = Math.max(this.shakeIntensity, heavy ? 13 : 6.5);
      soundEngine.playHit(heavy);

      const sparkColor = heavy ? '#ffd166' : att.accentColor;
      this.spawnSparks(hitX, hitY, sparkColor, heavy ? 22 : 12, heavy ? 390 : 260);
      this.spawnShockwave(hitX, hitY, sparkColor, heavy ? 72 : 44, heavy ? 0.3 : 0.2);

      const dmgLabel =
        att.comboCount >= 2 ? `-${damage} · ${att.comboCount}x` : `-${damage}`;
      this.spawnFloatingText(
        def.x,
        def.y - 114,
        dmgLabel,
        heavy ? '#ffd166' : '#ffffff',
        heavy ? 1.25 : 1.0
      );
    }

    this.pushHudSnapshot(true);
  }

  private triggerRoundEnd(reason: 'KO' | 'TIME'): void {
    if (this.roundOverTimer > 0) return;
    this.roundOverReason = reason;
    this.roundOverTimer = 1.85;

    const [p1, p2] = this.fighters;
    if (reason === 'KO') {
      soundEngine.playKO();
      this.shakeIntensity = 18;
      this.hitstopTimer = 0.09;
      if (p1.hp <= 0 && p2.hp > 0) {
        p2.roundsWon += 1;
        this.roundBannerText = 'NOKAUT!';
      } else if (p2.hp <= 0 && p1.hp > 0) {
        p1.roundsWon += 1;
        this.roundBannerText = 'NOKAUT!';
      } else {
        this.roundBannerText = 'DURRANG!';
      }
    } else {
      if (p1.hp > p2.hp) {
        p1.roundsWon += 1;
        this.roundBannerText = 'VAQT TUGADI!';
      } else if (p2.hp > p1.hp) {
        p2.roundsWon += 1;
        this.roundBannerText = 'VAQT TUGADI!';
      } else {
        this.roundBannerText = 'DURRANG!';
      }
    }

    this.roundBannerTimer = 1.85;
    this.pushHudSnapshot(true);
  }

  private advanceAfterRound(): void {
    const neededWins = this.config.bestOf === 1 ? 1 : 2;
    const [p1, p2] = this.fighters;

    if (p1.roundsWon >= neededWins || p2.roundsWon >= neededWins) {
      this.phase = 'GAME_OVER';
      this.winnerId = p1.roundsWon >= neededWins ? 0 : 1;
      soundEngine.playVictory();
      this.pushHudSnapshot(true);
      return;
    }

    this.roundNumber += 1;
    this.resetRoundEntities();
    soundEngine.playRoundStart();
    this.pushHudSnapshot(true);
  }

  private spawnSparks(x: number, y: number, color: string, count: number, speed: number): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const mag = speed * (0.35 + Math.random() * 0.75);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * mag;
      p.vy = Math.sin(angle) * mag - 40;
      p.size = 2 + Math.random() * 3.5;
      p.maxLife = 0.25 + Math.random() * 0.28;
      p.life = p.maxLife;
      p.color = color;
      p.gravity = 520;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  private spawnDust(x: number, y: number, count: number): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 26;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 90;
      p.vy = -20 - Math.random() * 45;
      p.size = 3 + Math.random() * 4;
      p.maxLife = 0.26 + Math.random() * 0.16;
      p.life = p.maxLife;
      p.color = '#94a3b8';
      p.gravity = -10;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  private spawnShockwave(
    x: number,
    y: number,
    color: string,
    maxRadius: number,
    duration: number
  ): void {
    for (const s of this.shockwaves) {
      if (s.active) continue;
      s.active = true;
      s.x = x;
      s.y = y;
      s.radius = 8;
      s.maxRadius = maxRadius;
      s.life = duration;
      s.maxLife = duration;
      s.color = color;
      s.lineWidth = 4;
      break;
    }
  }

  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale: number
  ): void {
    for (const t of this.floatingTexts) {
      if (t.active) continue;
      t.active = true;
      t.x = x + (Math.random() - 0.5) * 18;
      t.y = y;
      t.vy = -52;
      t.text = text;
      t.color = color;
      t.maxLife = 0.72;
      t.life = t.maxLife;
      t.scale = scale;
      break;
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  private updateShockwaves(dt: number): void {
    for (const s of this.shockwaves) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        continue;
      }
      const progress = 1 - s.life / s.maxLife;
      s.radius = 8 + (s.maxRadius - 8) * (1 - Math.pow(1 - progress, 3));
    }
  }

  private updateFloatingTexts(dt: number): void {
    for (const t of this.floatingTexts) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.25, dt);
    }
  }

  private updateEmbers(dt: number): void {
    for (const e of this.embers) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.y < 60) {
        e.y = GROUND_Y + 4;
        e.x = Math.random() * ARENA_WIDTH;
      }
      if (e.x < 0) e.x = ARENA_WIDTH;
      if (e.x > ARENA_WIDTH) e.x = 0;
    }
  }

  private pushHudSnapshot(force: boolean): void {
    const [p1, p2] = this.fighters;
    const timerInt = Math.ceil(this.roundTimer);
    const p1HpInt = Math.ceil(p1.hp);
    const p2HpInt = Math.ceil(p2.hp);
    const p1TrailInt = Math.ceil(p1.trailHp);
    const p2TrailInt = Math.ceil(p2.trailHp);

    const key = [
      this.phase,
      p1HpInt,
      p1TrailInt,
      p2HpInt,
      p2TrailInt,
      p1.roundsWon,
      p2.roundsWon,
      p1.comboCount,
      p2.comboCount,
      this.roundNumber,
      timerInt,
      this.config.bestOf,
      this.config.mode,
      this.winnerId,
    ].join('|');

    if (!force && key === this.lastSnapshotKey) return;
    this.lastSnapshotKey = key;

    this.onHudUpdate({
      phase: this.phase,
      p1Hp: p1HpInt,
      p1TrailHp: p1TrailInt,
      p2Hp: p2HpInt,
      p2TrailHp: p2TrailInt,
      p1Rounds: p1.roundsWon,
      p2Rounds: p2.roundsWon,
      p1Combo: p1.comboCount,
      p2Combo: p2.comboCount,
      roundNumber: this.roundNumber,
      roundTimer: timerInt,
      bestOf: this.config.bestOf,
      mode: this.config.mode,
      winnerId: this.winnerId,
      p1Damage: p1.damageDealt,
      p2Damage: p2.damageDealt,
      p1MaxCombo: p1.maxCombo,
      p2MaxCombo: p2.maxCombo,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    const sx = this.shakeIntensity > 0 ? (Math.random() * 2 - 1) * this.shakeIntensity : 0;
    const sy = this.shakeIntensity > 0 ? (Math.random() * 2 - 1) * this.shakeIntensity * 0.6 : 0;

    ctx.save();
    ctx.translate(sx, sy);

    this.drawSkyAndMoon(ctx);
    this.drawSkyline(ctx);
    this.drawArenaDeck(ctx);
    this.drawEmbers(ctx);
    this.drawShockwaves(ctx);

    // Draw fighters
    this.drawFighter(ctx, this.fighters[0]);
    this.drawFighter(ctx, this.fighters[1]);

    this.drawParticles(ctx);
    this.drawFloatingTexts(ctx);

    if (this.phase === 'PLAYING' && this.roundBannerTimer > 0 && this.roundBannerText) {
      this.drawRoundBanner(ctx);
    }

    ctx.restore();
  }

  private drawSkyAndMoon(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
    grad.addColorStop(0, '#090e1f');
    grad.addColorStop(0.55, '#131d3a');
    grad.addColorStop(1, '#1e2c4f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Subtle moon glow in upper sky
    const moonX = 760;
    const moonY = 98;
    const glow = ctx.createRadialGradient(moonX, moonY, 12, moonX, moonY, 130);
    glow.addColorStop(0, 'rgba(205, 224, 255, 0.22)');
    glow.addColorStop(1, 'rgba(205, 224, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 130, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#dce8ff';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 22, 0, Math.PI * 2);
    ctx.fill();

    // Twinkling stars
    for (const star of this.stars) {
      const alpha = 0.22 + 0.35 * (0.5 + 0.5 * Math.sin(this.elapsed * star.speed + star.phase));
      ctx.fillStyle = `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    // Distant arena spotlight cones
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const sweep = Math.sin(this.elapsed * 0.45) * 35;
    const leftBeam = ctx.createLinearGradient(180, 410, 340 + sweep, 60);
    leftBeam.addColorStop(0, 'rgba(255, 71, 107, 0.08)');
    leftBeam.addColorStop(1, 'rgba(255, 71, 107, 0)');
    ctx.fillStyle = leftBeam;
    ctx.beginPath();
    ctx.moveTo(150, 410);
    ctx.lineTo(290 + sweep, 40);
    ctx.lineTo(420 + sweep, 40);
    ctx.lineTo(210, 410);
    ctx.closePath();
    ctx.fill();

    const rightBeam = ctx.createLinearGradient(780, 410, 620 - sweep, 60);
    rightBeam.addColorStop(0, 'rgba(67, 168, 255, 0.08)');
    rightBeam.addColorStop(1, 'rgba(67, 168, 255, 0)');
    ctx.fillStyle = rightBeam;
    ctx.beginPath();
    ctx.moveTo(750, 410);
    ctx.lineTo(540 - sweep, 40);
    ctx.lineTo(670 - sweep, 40);
    ctx.lineTo(810, 410);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawSkyline(ctx: CanvasRenderingContext2D): void {
    const horizonY = 408;

    for (const layer of [0, 1] as const) {
      const baseColor = layer === 0 ? '#0c1327' : '#080e1d';
      for (const b of this.buildings) {
        if (b.layer !== layer) continue;
        const topY = horizonY - b.h;
        ctx.fillStyle = baseColor;
        ctx.fillRect(b.x, topY, b.w, b.h);

        if (b.antenna) {
          ctx.fillRect(b.x + b.w * 0.5 - 1, topY - 18, 2, 18);
          ctx.fillStyle = '#ff476b66';
          ctx.fillRect(b.x + b.w * 0.5 - 1.5, topY - 20, 3, 3);
          ctx.fillStyle = baseColor;
        }

        for (const win of b.windows) {
          if (!win.lit) continue;
          ctx.fillStyle = win.warm ? 'rgba(255, 214, 120, 0.16)' : 'rgba(125, 200, 255, 0.14)';
          ctx.fillRect(b.x + win.rx, topY + win.ry, 5, 8);
        }
      }
    }

    // Horizon mist
    const mist = ctx.createLinearGradient(0, 340, 0, horizonY);
    mist.addColorStop(0, 'rgba(19, 29, 58, 0)');
    mist.addColorStop(1, 'rgba(30, 44, 79, 0.55)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 340, ARENA_WIDTH, horizonY - 340);
  }

  private drawArenaDeck(ctx: CanvasRenderingContext2D): void {
    const floorY = 408;

    // Rooftop surface
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, ARENA_HEIGHT);
    floorGrad.addColorStop(0, '#273452');
    floorGrad.addColorStop(1, '#141c30');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, ARENA_WIDTH, ARENA_HEIGHT - floorY);

    // Top concrete ledge highlight
    ctx.fillStyle = '#53658a';
    ctx.fillRect(0, floorY, ARENA_WIDTH, 5);

    // Perspective floor grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1.5;
    for (let x = -40; x <= ARENA_WIDTH + 60; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, floorY + 5);
      ctx.lineTo(x + (x - ARENA_WIDTH * 0.5) * 0.25, ARENA_HEIGHT);
      ctx.stroke();
    }

    // Horizontal depth line
    ctx.beginPath();
    ctx.moveTo(0, floorY + 42);
    ctx.lineTo(ARENA_WIDTH, floorY + 42);
    ctx.stroke();

    // Center duel line & subtle ring
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ARENA_WIDTH * 0.5, floorY + 5);
    ctx.lineTo(ARENA_WIDTH * 0.5, ARENA_HEIGHT);
    ctx.stroke();

    // Corner boundary markers
    ctx.fillStyle = 'rgba(255, 71, 107, 0.35)';
    ctx.fillRect(LEFT_BOUND - 10, floorY, 12, 5);
    ctx.fillStyle = 'rgba(67, 168, 255, 0.35)';
    ctx.fillRect(RIGHT_BOUND - 2, floorY, 12, 5);
  }

  private drawEmbers(ctx: CanvasRenderingContext2D): void {
    for (const e of this.embers) {
      ctx.fillStyle = `rgba(255, 209, 102, ${e.alpha})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFighter(ctx: CanvasRenderingContext2D, f: Fighter): void {
    const heightAboveGround = Math.max(0, GROUND_Y - f.y);
    const shadowScale = Math.max(0.35, 1 - heightAboveGround / 280);

    // Ground shadow
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.38 * shadowScale).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(f.x, GROUND_Y + 9, 28 * shadowScale, 7.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const mainColor = f.hitFlash > 0 ? '#ffffff' : f.color;
    const isHeavy = f.attackType === 'HEAVY';

    // Flowing headband scarf (world space)
    if (f.koFallProgress < 0.5) {
      ctx.save();
      ctx.strokeStyle = f.hitFlash > 0 ? '#ffffff' : f.accentColor;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(f.scarf[0].x, f.scarf[0].y);
      for (let i = 1; i < f.scarf.length; i++) {
        ctx.lineTo(f.scarf[i].x, f.scarf[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    // Anchor at feet for squash/stretch and KO fall
    ctx.translate(f.x, f.y + 8);
    if (f.koFallProgress > 0) {
      const fallAngle = -f.face * (Math.PI * 0.48) * f.koFallProgress;
      ctx.rotate(fallAngle);
    }
    ctx.scale(f.face * f.squashX, f.squashY);

    // Subtle idle breathing bob
    const breath = f.grounded && Math.abs(f.vx) < 5 && f.attackTimer <= 0 ? Math.sin(f.idlePhase) * 2.2 : 0;

    // Attack progress (0 -> 1)
    const atkProg =
      f.attackTimer > 0 && f.attackDuration > 0
        ? 1 - f.attackTimer / f.attackDuration
        : 0;

    // Heavy windup telegraph glint
    if (f.attackTimer > 0 && isHeavy && atkProg < 0.52) {
      const chargePulse = atkProg / 0.52;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 209, 102, ${(0.35 + chargePulse * 0.55).toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-18, -56, 22 - chargePulse * 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Lean torso during sprint, hitstun, or attack
    let torsoLean = 0;
    if (f.hitStun > 0) torsoLean = -0.22;
    else if (f.attackTimer > 0) {
      if (isHeavy) {
        torsoLean = atkProg < 0.48 ? -0.24 : 0.34;
      } else {
        torsoLean = atkProg < 0.25 ? -0.06 : 0.2;
      }
    } else if (Math.abs(f.vx) > 20) {
      torsoLean = 0.14;
    }

    ctx.translate(0, -14); // Hip center relative to feet
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 7.5;

    // Legs
    const isKick = f.attackTimer > 0 && !isHeavy && f.attackVariant === 1 && atkProg >= 0.22 && atkProg <= 0.72;
    if (!f.grounded) {
      // Airborne tuck
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-14, 14);
      ctx.lineTo(-10, 26);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(15, 10);
      ctx.lineTo(12, 24);
      ctx.stroke();
    } else if (isKick) {
      // Planted back leg + high snap kick
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-13, 15);
      ctx.lineTo(-18, 22);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(26, -14);
      ctx.lineTo(54, -22);
      ctx.stroke();

      // Kick arc
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(18, -16, 40, -0.65, 0.25);
      ctx.stroke();
      ctx.restore();
    } else {
      const swing = Math.abs(f.vx) > 10 ? Math.sin(f.walkCycle) * 14 : 0;
      const stanceW = f.guarding ? 11 : 14;
      // Back leg
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-stanceW + swing * 0.6, 12);
      ctx.lineTo(-stanceW - 4 + swing, 22);
      ctx.stroke();
      // Front leg
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(stanceW - swing * 0.6, 12);
      ctx.lineTo(stanceW + 5 - swing, 22);
      ctx.stroke();
    }

    // Upper body pivot
    ctx.rotate(torsoLean);

    // Torso
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -56 + breath);
    ctx.stroke();

    // Head
    const headY = -74 + breath;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, headY, 16.5, 0, Math.PI * 2);
    ctx.fill();

    // Headband band across forehead
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : f.accentColor;
    ctx.fillRect(-15, headY - 7, 30, 5);

    // Eye visor slit
    ctx.fillStyle = '#0d1224';
    ctx.beginPath();
    ctx.arc(7, headY - 1, 3.1, 0, Math.PI * 2);
    ctx.fill();

    // Arms
    const shoulderY = -46 + breath;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 6.5;

    if (f.guarding) {
      // Crossed guard arms
      ctx.beginPath();
      ctx.moveTo(0, shoulderY);
      ctx.lineTo(18, shoulderY - 4);
      ctx.lineTo(12, shoulderY - 20);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, shoulderY + 3);
      ctx.lineTo(22, shoulderY + 2);
      ctx.lineTo(18, shoulderY - 14);
      ctx.stroke();

      // Guard shield arc
      ctx.save();
      ctx.strokeStyle = 'rgba(124, 224, 255, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(14, shoulderY - 8, 28, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.stroke();
      ctx.restore();
    } else if (f.attackTimer > 0 && !isKick) {
      if (isHeavy) {
        if (atkProg < 0.48) {
          // Heavy windup pull-back
          ctx.beginPath();
          ctx.moveTo(0, shoulderY);
          ctx.lineTo(-22, shoulderY - 8);
          ctx.lineTo(-30, shoulderY + 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, shoulderY);
          ctx.lineTo(16, shoulderY + 6);
          ctx.lineTo(20, shoulderY - 4);
          ctx.stroke();
        } else {
          // Heavy lunging haymaker
          const thrust = Math.sin(Math.min(1, (atkProg - 0.48) / 0.32) * Math.PI * 0.5);
          const reach = 34 + thrust * 44;
          ctx.beginPath();
          ctx.moveTo(0, shoulderY);
          ctx.lineTo(-18, shoulderY + 10);
          ctx.lineTo(-24, shoulderY + 20);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, shoulderY);
          ctx.lineTo(reach * 0.55, shoulderY - 4);
          ctx.lineTo(reach, shoulderY - 2);
          ctx.stroke();

          // Golden heavy slash arc
          ctx.save();
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.arc(reach - 8, shoulderY - 2, 24, -Math.PI * 0.48, Math.PI * 0.48);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // Snappy light jab
        const reach = atkProg < 0.68 ? 58 : 30;
        ctx.beginPath();
        ctx.moveTo(0, shoulderY);
        ctx.lineTo(-16, shoulderY + 10);
        ctx.lineTo(-14, shoulderY - 4);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, shoulderY);
        ctx.lineTo(reach * 0.5, shoulderY - 2);
        ctx.lineTo(reach, shoulderY - 3);
        ctx.stroke();

        if (atkProg >= 0.18 && atkProg <= 0.72) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(reach - 4, shoulderY - 3, 15, -Math.PI * 0.42, Math.PI * 0.42);
          ctx.stroke();
          ctx.restore();
        }
      }
    } else {
      // Boxing idle / walk guard stance
      const bob = Math.sin(f.idlePhase * 1.1) * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, shoulderY);
      ctx.lineTo(-15, shoulderY + 12);
      ctx.lineTo(-6, shoulderY + 2 + bob);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, shoulderY);
      ctx.lineTo(16, shoulderY + 10);
      ctx.lineTo(22, shoulderY - 4 + bob);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + alpha * 0.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawShockwaves(ctx: CanvasRenderingContext2D): void {
    for (const s of this.shockwaves) {
      if (!s.active) continue;
      const alpha = Math.max(0, s.life / s.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth * alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const t of this.floatingTexts) {
      if (!t.active) continue;
      const alpha = Math.min(1, (t.life / t.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.round(22 * t.scale)}px "Barlow Condensed", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#080d1a';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  private drawRoundBanner(ctx: CanvasRenderingContext2D): void {
    const t = this.roundBannerTimer;
    const alpha = Math.min(1, t * 2.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = '800 54px "Barlow Condensed", system-ui, sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#080d1a';
    ctx.strokeText(this.roundBannerText, ARENA_WIDTH * 0.5, 200);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(this.roundBannerText, ARENA_WIDTH * 0.5, 200);
    ctx.restore();
  }
}
