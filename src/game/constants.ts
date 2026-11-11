import { StartupStage, UpgradeDef } from './types';

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'auto_script',
    name: '自動打工腳本',
    subtitle: 'Python Cron +4 TPS',
    baseCost: 15,
    costMultiplier: 1.15,
    baseTps: 4,
    clickBonus: 0,
    accent: '#22d3ee',
  },
  {
    id: 'gpu_rack',
    name: '升級 GPU 伺服器',
    subtitle: 'H100 Cluster +18 TPS · +2 Click',
    baseCost: 120,
    costMultiplier: 1.18,
    baseTps: 18,
    clickBonus: 2,
    accent: '#34d399',
  },
  {
    id: 'prompt_team',
    name: '招募 AI 工程師',
    subtitle: 'Prompt & Eval +95 TPS · +10 Click',
    baseCost: 1100,
    costMultiplier: 1.2,
    baseTps: 95,
    clickBonus: 10,
    accent: '#a78bfa',
  },
  {
    id: 'rlhf_flywheel',
    name: 'RLHF 數據飛輪',
    subtitle: 'Synthetic Data +540 TPS · +45 Click',
    baseCost: 12000,
    costMultiplier: 1.22,
    baseTps: 540,
    clickBonus: 45,
    accent: '#f472b6',
  },
  {
    id: 'agi_cluster',
    name: 'AGI 超算集群',
    subtitle: 'Singularity Core +3,200 TPS · +250 Click',
    baseCost: 130000,
    costMultiplier: 1.25,
    baseTps: 3200,
    clickBonus: 250,
    accent: '#fbbf24',
  },
];

export const STARTUP_STAGES: StartupStage[] = [
  { name: '車庫獨立開發者 (Garage)', minTokens: 0, badgeColor: '#94a3b8' },
  { name: '種子輪新創 (Seed)', minTokens: 500, badgeColor: '#22d3ee' },
  { name: 'A 輪高速成長 (Series A)', minTokens: 10000, badgeColor: '#34d399' },
  { name: 'AI 獨角獸 (Unicorn)', minTokens: 250000, badgeColor: '#a78bfa' },
  { name: 'AGI 奇點帝國 (Singularity)', minTokens: 5000000, badgeColor: '#fbbf24' },
];

export const SAVE_KEY = 'ai_startup_sim_save_v1';
export const FEVER_DURATION_SEC = 300; // 5 minutes
export const FEVER_MULTIPLIER = 10;

export function getUpgradeCost(def: UpgradeDef, owned: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, owned));
}

export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n < 1000) return Math.floor(n).toLocaleString('en-US');
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  const tier = Math.floor(Math.log10(Math.abs(n)) / 3);
  if (tier <= 0) return Math.floor(n).toLocaleString('en-US');
  const suffix = units[tier - 1] ?? `e${tier * 3}`;
  const scale = Math.pow(10, tier * 3);
  return (n / scale).toFixed(2) + suffix;
}
