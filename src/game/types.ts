export type GameScreen = 'title' | 'playing' | 'paused';
export type Locale = 'en' | 'zh-TW' | 'zh-CN';
export type DockTab = 'compute' | 'research' | 'milestones';
export type BuyAmount = 1 | 10 | 'max';

export interface LocalizedText {
  en: string;
  'zh-TW': string;
  'zh-CN': string;
}

export interface UpgradeDef {
  id: string;
  name: LocalizedText;
  subtitle: LocalizedText;
  baseCost: number;
  costMultiplier: number;
  baseTps: number;
  clickBonus: number;
  accent: string;
}

export interface ResearchDef {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  cost: number;
  target: 'click' | 'global' | 'crit' | 'vc' | string; // upgrade id or global/click/crit/vc
  multiplier: number;
  unlockRequirement?: {
    upgradeId?: string;
    minOwned?: number;
    minLifetime?: number;
  };
}

export interface AchievementDef {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  rewardTokens: number;
  check: (state: SaveState, tps: number) => boolean;
}

export interface StartupStage {
  index: number;
  name: LocalizedText;
  minTokens: number;
  badgeColor: string;
  ringColor: string;
}

export interface SaveState {
  tokens: number;
  lifetimeTokens: number;
  totalClicks: number;
  bugsZapped: number;
  vcCaught: number;
  ipoShares: number;
  prestigeCount: number;
  upgrades: Record<string, number>;
  research: string[];
  achievements: string[];
  lastSavedAt: number;
}

export interface AdModalState {
  type: 'fever' | 'offline';
  secondsLeft: number;
  offlineAmount?: number;
}
