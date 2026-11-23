export type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type GameMode = 'PVP' | 'BOT';

export type BotDifficulty = 'EASY' | 'NORMAL' | 'HARD';

export interface MatchConfig {
  mode: GameMode;
  difficulty: BotDifficulty;
  bestOf: 1 | 3;
}

export interface ScarfNode {
  x: number;
  y: number;
}

export interface Fighter {
  id: 0 | 1;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  knockVx: number;
  color: string;
  accentColor: string;
  hp: number;
  trailHp: number;
  face: 1 | -1;
  grounded: boolean;
  coyoteTimer: number;
  jumpBuffer: number;
  attackBuffer: 'LIGHT' | 'HEAVY' | null;
  attackBufferTimer: number;
  attackTimer: number;
  attackDuration: number;
  attackHitDone: boolean;
  attackType: 'LIGHT' | 'HEAVY';
  attackVariant: number;
  cooldown: number;
  hitFlash: number;
  hitStun: number;
  guarding: boolean;
  walkCycle: number;
  idlePhase: number;
  squashX: number;
  squashY: number;
  comboCount: number;
  comboWindow: number;
  maxCombo: number;
  damageDealt: number;
  roundsWon: number;
  koFallProgress: number;
  scarf: ScarfNode[];
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  gravity: number;
}

export interface Shockwave {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  lineWidth: number;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  p1Hp: number;
  p1TrailHp: number;
  p2Hp: number;
  p2TrailHp: number;
  p1Rounds: number;
  p2Rounds: number;
  p1Combo: number;
  p2Combo: number;
  roundNumber: number;
  roundTimer: number;
  bestOf: 1 | 3;
  mode: GameMode;
  winnerId: 0 | 1 | null;
  p1Damage: number;
  p2Damage: number;
  p1MaxCombo: number;
  p2MaxCombo: number;
}
