export type GameScreen = 'title' | 'playing' | 'paused';

export interface UpgradeDef {
  id: string;
  name: string;
  subtitle: string;
  baseCost: number;
  costMultiplier: number;
  baseTps: number;
  clickBonus: number;
  accent: string;
}

export interface StartupStage {
  name: string;
  minTokens: number;
  badgeColor: string;
}

export interface SaveState {
  tokens: number;
  lifetimeTokens: number;
  totalClicks: number;
  upgrades: Record<string, number>;
  lastSavedAt: number;
}

export interface AdModalState {
  type: 'fever' | 'offline';
  secondsLeft: number;
  offlineAmount?: number;
}
