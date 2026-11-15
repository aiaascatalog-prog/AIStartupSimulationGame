import {
  AchievementDef,
  BuyAmount,
  Locale,
  ResearchDef,
  SaveState,
  StartupStage,
  UpgradeDef,
} from './types';

export const SAVE_KEY = 'ai_startup_sim_save_v2';
export const FEVER_DURATION_SEC = 300;
export const FEVER_MULTIPLIER = 10;
export const IPO_BASE_THRESHOLD = 500_000;
export const SHARE_BONUS_MULTIPLIER = 0.15; // +15% per VC Equity Share

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'auto_script',
    name: { en: 'Auto-Mint Script', 'zh-TW': '自動打工腳本', 'zh-CN': '自动打工脚本' },
    subtitle: { en: '+4 TPS', 'zh-TW': '+4 TPS', 'zh-CN': '+4 TPS' },
    baseCost: 15,
    costMultiplier: 1.15,
    baseTps: 4,
    clickBonus: 0,
    accent: '#22d3ee',
  },
  {
    id: 'gpu_rack',
    name: { en: 'H100 GPU Rack', 'zh-TW': 'H100 GPU 機櫃', 'zh-CN': 'H100 GPU 机柜' },
    subtitle: { en: '+20 TPS · +2 Click', 'zh-TW': '+20 TPS · +2 點擊', 'zh-CN': '+20 TPS · +2 点击' },
    baseCost: 120,
    costMultiplier: 1.17,
    baseTps: 20,
    clickBonus: 2,
    accent: '#34d399',
  },
  {
    id: 'prompt_team',
    name: { en: 'AI Engineer Team', 'zh-TW': 'AI 工程師團隊', 'zh-CN': 'AI 工程师团队' },
    subtitle: { en: '+105 TPS · +10 Click', 'zh-TW': '+105 TPS · +10 點擊', 'zh-CN': '+105 TPS · +10 点击' },
    baseCost: 1100,
    costMultiplier: 1.18,
    baseTps: 105,
    clickBonus: 10,
    accent: '#a78bfa',
  },
  {
    id: 'rlhf_flywheel',
    name: { en: 'RLHF Data Flywheel', 'zh-TW': 'RLHF 數據飛輪', 'zh-CN': 'RLHF 数据飞轮' },
    subtitle: { en: '+580 TPS · +48 Click', 'zh-TW': '+580 TPS · +48 點擊', 'zh-CN': '+580 TPS · +48 点击' },
    baseCost: 12000,
    costMultiplier: 1.2,
    baseTps: 580,
    clickBonus: 48,
    accent: '#f472b6',
  },
  {
    id: 'vector_dc',
    name: { en: 'Liquid Datacenter', 'zh-TW': '液冷超算中心', 'zh-CN': '液冷超算中心' },
    subtitle: { en: '+3,400 TPS · +260 Click', 'zh-TW': '+3,400 TPS · +260 點擊', 'zh-CN': '+3,400 TPS · +260 点击' },
    baseCost: 135000,
    costMultiplier: 1.21,
    baseTps: 3400,
    clickBonus: 260,
    accent: '#38bdf8',
  },
  {
    id: 'multimodal_pod',
    name: { en: 'Multi-Modal Pod', 'zh-TW': '多模態運算艙', 'zh-CN': '多模态运算舱' },
    subtitle: { en: '+22K TPS · +1.4K Click', 'zh-TW': '+22K TPS · +1.4K 點擊', 'zh-CN': '+22K TPS · +1.4K 点击' },
    baseCost: 1500000,
    costMultiplier: 1.22,
    baseTps: 22000,
    clickBonus: 1400,
    accent: '#fb923c',
  },
  {
    id: 'robotics_lab',
    name: { en: 'Embodied Robotics Lab', 'zh-TW': '具身機器人實驗室', 'zh-CN': '具身机器人实验室' },
    subtitle: { en: '+145K TPS · +9K Click', 'zh-TW': '+145K TPS · +9K 點擊', 'zh-CN': '+145K TPS · +9K 点击' },
    baseCost: 18000000,
    costMultiplier: 1.23,
    baseTps: 145000,
    clickBonus: 9000,
    accent: '#4ade80',
  },
  {
    id: 'agi_cluster',
    name: { en: 'AGI Singularity Core', 'zh-TW': 'AGI 奇點核心', 'zh-CN': 'AGI 奇点核心' },
    subtitle: { en: '+1.1M TPS · +65K Click', 'zh-TW': '+1.1M TPS · +65K 點擊', 'zh-CN': '+1.1M TPS · +65K 点击' },
    baseCost: 220000000,
    costMultiplier: 1.25,
    baseTps: 1100000,
    clickBonus: 65000,
    accent: '#fbbf24',
  },
];

export const RESEARCH_LIST: ResearchDef[] = [
  {
    id: 'cuda_overclock',
    name: { en: 'CUDA Kernel Overclock', 'zh-TW': 'CUDA 核心超頻', 'zh-CN': 'CUDA 核心超频' },
    description: { en: '2x Click Power', 'zh-TW': '點擊算力 x2', 'zh-CN': '点击算力 x2' },
    cost: 250,
    target: 'click',
    multiplier: 2,
  },
  {
    id: 'cron_parallel',
    name: { en: 'Async Script Workers', 'zh-TW': '非同步腳本排程', 'zh-CN': '异步脚本调度' },
    description: { en: '2x Auto-Mint Script TPS', 'zh-TW': '自動打工腳本產量 x2', 'zh-CN': '自动打工脚本产量 x2' },
    cost: 600,
    target: 'auto_script',
    multiplier: 2,
    unlockRequirement: { upgradeId: 'auto_script', minOwned: 5 },
  },
  {
    id: 'tensor_cores',
    name: { en: 'FP8 Tensor Quantization', 'zh-TW': 'FP8 張量量化', 'zh-CN': 'FP8 张量量化' },
    description: { en: '2x H100 GPU Rack Output', 'zh-TW': 'GPU 機櫃產量 x2', 'zh-CN': 'GPU 机柜产量 x2' },
    cost: 2800,
    target: 'gpu_rack',
    multiplier: 2,
    unlockRequirement: { upgradeId: 'gpu_rack', minOwned: 5 },
  },
  {
    id: 'crit_model',
    name: { en: 'Speculative Decoding', 'zh-TW': '推測解碼暴擊算法', 'zh-CN': '推测解码暴击算法' },
    description: { en: '+10% Crit Chance (22%)', 'zh-TW': '暴擊率提升至 22%', 'zh-CN': '暴击率提升至 22%' },
    cost: 6500,
    target: 'crit',
    multiplier: 0.1,
  },
  {
    id: 'vc_pitch_deck',
    name: { en: 'Viral Pitch Deck', 'zh-TW': '爆款融資簡報', 'zh-CN': '爆款融资路演' },
    description: { en: '2x Golden VC$ & Bug Bounty', 'zh-TW': 'VC$ 封包與除蟲賞金 x2', 'zh-CN': 'VC$ 红包与除虫赏金 x2' },
    cost: 18000,
    target: 'vc',
    multiplier: 2,
  },
  {
    id: 'flash_attn',
    name: { en: 'FlashAttention-3', 'zh-TW': 'FlashAttention-3 加速', 'zh-CN': 'FlashAttention-3 加速' },
    description: { en: '1.5x All Token Output', 'zh-TW': '全域 Token 產出 x1.5', 'zh-CN': '全局 Token 产出 x1.5' },
    cost: 75000,
    target: 'global',
    multiplier: 1.5,
  },
  {
    id: 'moe_routing',
    name: { en: 'Sparse MoE Routing', 'zh-TW': '稀疏 MoE 專家路由', 'zh-CN': '稀疏 MoE 专家路由' },
    description: { en: '3x Click Power', 'zh-TW': '點擊算力 x3', 'zh-CN': '点击算力 x3' },
    cost: 350000,
    target: 'click',
    multiplier: 3,
  },
  {
    id: 'quantum_cooling',
    name: { en: 'Zero-Kelvin Photonic Bus', 'zh-TW': '光子匯流排超導架構', 'zh-CN': '光子总线超导架构' },
    description: { en: '2x All Token Output', 'zh-TW': '全域 Token 產出 x2', 'zh-CN': '全局 Token 产出 x2' },
    cost: 2500000,
    target: 'global',
    multiplier: 2,
  },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_mint',
    name: { en: 'Hello World', 'zh-TW': '初次編譯', 'zh-CN': '初次编译' },
    description: { en: 'Click the Neural Core 10 times', 'zh-TW': '點擊算力核心 10 次', 'zh-CN': '点击算力核心 10 次' },
    rewardTokens: 50,
    check: (s) => s.totalClicks >= 10,
  },
  {
    id: 'automation',
    name: { en: 'Hello Cron', 'zh-TW': '自動化起點', 'zh-CN': '自动化起点' },
    description: { en: 'Own 5 Auto-Mint Scripts', 'zh-TW': '擁有 5 個自動腳本', 'zh-CN': '拥有 5 个自动脚本' },
    rewardTokens: 150,
    check: (s) => (s.upgrades.auto_script || 0) >= 5,
  },
  {
    id: 'bug_hunter',
    name: { en: 'Hotfix Hero', 'zh-TW': '線上除蟲大師', 'zh-CN': '线上除虫大师' },
    description: { en: 'Zap 3 Rogue Bug Drones', 'zh-TW': '擊破 3 隻故障無人機', 'zh-CN': '击破 3 只故障无人机' },
    rewardTokens: 500,
    check: (s) => s.bugsZapped >= 3,
  },
  {
    id: 'seed_round',
    name: { en: 'Seed Funded', 'zh-TW': '種子輪獲投', 'zh-CN': '种子轮获投' },
    description: { en: 'Reach 1,000 lifetime Tokens', 'zh-TW': '累計產出 1,000 Tokens', 'zh-CN': '累计产出 1,000 Tokens' },
    rewardTokens: 300,
    check: (s) => s.lifetimeTokens >= 1000,
  },
  {
    id: 'vc_magnet',
    name: { en: 'Term Sheet', 'zh-TW': '風投青睞', 'zh-CN': '风投青睐' },
    description: { en: 'Catch 3 Golden VC$ Orbs', 'zh-TW': '搶奪 3 個黃金 VC$ 封包', 'zh-CN': '抢夺 3 个黄金 VC$ 红包' },
    rewardTokens: 1200,
    check: (s) => s.vcCaught >= 3,
  },
  {
    id: 'scale_tps',
    name: { en: 'Hyperscale', 'zh-TW': '算力起飛', 'zh-CN': '算力起飞' },
    description: { en: 'Reach 1,000 TPS', 'zh-TW': '達到 1,000 TPS', 'zh-CN': '达到 1,000 TPS' },
    rewardTokens: 5000,
    check: (_, tps) => tps >= 1000,
  },
  {
    id: 'series_a',
    name: { en: 'Series A Growth', 'zh-TW': 'A 輪高速擴張', 'zh-CN': 'A 轮高速扩张' },
    description: { en: 'Reach 50K lifetime Tokens', 'zh-TW': '累計產出 50K Tokens', 'zh-CN': '累计产出 50K Tokens' },
    rewardTokens: 8000,
    check: (s) => s.lifetimeTokens >= 50000,
  },
  {
    id: 'unicorn',
    name: { en: 'AI Unicorn', 'zh-TW': 'AI 獨角獸', 'zh-CN': 'AI 独角兽' },
    description: { en: 'Reach 1M lifetime Tokens', 'zh-TW': '累計產出 1M Tokens', 'zh-CN': '累计产出 1M Tokens' },
    rewardTokens: 50000,
    check: (s) => s.lifetimeTokens >= 1000000,
  },
  {
    id: 'ipo_founder',
    name: { en: 'Wall Street Bell', 'zh-TW': '敲鐘上市', 'zh-CN': '敲钟上市' },
    description: { en: 'Complete your first IPO Re-Founding', 'zh-TW': '完成第一次 IPO 上市重啟', 'zh-CN': '完成第一次 IPO 上市重启' },
    rewardTokens: 10000,
    check: (s) => s.prestigeCount >= 1,
  },
];

export const STARTUP_STAGES: StartupStage[] = [
  {
    index: 0,
    name: { en: 'Garage Indie', 'zh-TW': '車庫獨立開發者', 'zh-CN': '车库独立开发者' },
    minTokens: 0,
    badgeColor: '#94a3b8',
    ringColor: '#22d3ee',
  },
  {
    index: 1,
    name: { en: 'Seed Startup', 'zh-TW': '種子輪新創', 'zh-CN': '种子轮初创' },
    minTokens: 1000,
    badgeColor: '#22d3ee',
    ringColor: '#38bdf8',
  },
  {
    index: 2,
    name: { en: 'Series A Lab', 'zh-TW': 'A 輪高速成長', 'zh-CN': 'A 轮高速成长' },
    minTokens: 25000,
    badgeColor: '#34d399',
    ringColor: '#34d399',
  },
  {
    index: 3,
    name: { en: 'AI Unicorn', 'zh-TW': 'AI 獨角獸', 'zh-CN': 'AI 独角兽' },
    minTokens: 500000,
    badgeColor: '#a78bfa',
    ringColor: '#c084fc',
  },
  {
    index: 4,
    name: { en: 'AGI Singularity', 'zh-TW': 'AGI 奇點帝國', 'zh-CN': 'AGI 奇点帝国' },
    minTokens: 15000000,
    badgeColor: '#fbbf24',
    ringColor: '#fbbf24',
  },
];

export const UI_COPY: Record<
  Locale,
  {
    subtitle: string;
    playCta: string;
    controlsHint: string;
    tokens: string;
    tps: string;
    click: string;
    overclock: string;
    feverBtn: string;
    feverActive: string;
    tabCompute: string;
    tabResearch: string;
    tabMilestones: string;
    clicksLabel: string;
    purchased: string;
    locked: string;
    ipoTitle: string;
    ipoDesc: string;
    ipoGain: string;
    ipoBtn: string;
    ipoNeedMore: string;
    equityBonus: string;
    achievementsTitle: string;
    onboardingHint: string;
    bugAlert: string;
    pausedTitle: string;
    lifetime: string;
    resume: string;
    reset: string;
    resetConfirm: string;
    offlineTitle: string;
    offlineDesc: string;
    offlineDouble: string;
    offlineClaim: string;
    adTitle: string;
    adFever: string;
    adOffline: string;
    adWait: string;
    adClaim: string;
  }
> = {
  en: {
    subtitle: 'FROM GARAGE GPU TO AGI SINGULARITY',
    playCta: 'LAUNCH STARTUP',
    controlsHint: 'Click / Space: Mint Tokens · Zap Red Bug Drones · Catch VC$ Orbs · 1-8: Buy · F: 10x Fever',
    tokens: 'TOKENS',
    tps: 'TPS',
    click: 'Click',
    overclock: 'Overclock',
    feverBtn: '5m 10x Fever',
    feverActive: '10x FEVER',
    tabCompute: 'Compute',
    tabResearch: 'Research',
    tabMilestones: 'IPO & Goals',
    clicksLabel: 'Clicks',
    purchased: 'MAXED',
    locked: 'LOCKED',
    ipoTitle: 'IPO & Re-Founding',
    ipoDesc: 'Take your startup public to convert valuation into permanent VC Equity Shares (+15% output each).',
    ipoGain: 'Claim on IPO',
    ipoBtn: 'Launch IPO',
    ipoNeedMore: 'Reach 500K lifetime Tokens for next share',
    equityBonus: 'Equity Boost',
    achievementsTitle: 'Milestones',
    onboardingHint: 'Click Neural Core or Press SPACE to Train AI',
    bugAlert: 'ROGUE BUG DETECTED! ZAP IT!',
    pausedTitle: 'GAME PAUSED',
    lifetime: 'Lifetime Valuation',
    resume: 'Resume (ESC)',
    reset: 'Reset Save',
    resetConfirm: 'Confirm Reset?',
    offlineTitle: 'Offline Compute Yield',
    offlineDesc: 'Your server clusters kept mining while you were away:',
    offlineDouble: 'Watch Ad for 2x Yield',
    offlineClaim: 'Claim 1x',
    adTitle: 'Rewarded Boost',
    adFever: 'Unlock 5-Min 10x Fever Overdrive',
    adOffline: 'Unlock 2x Offline Compute Yield',
    adWait: 'Loading reward...',
    adClaim: 'Claim Reward',
  },
  'zh-TW': {
    subtitle: '從車庫算力邁向 AGI 奇點帝國',
    playCta: '啟動創業公司',
    controlsHint: '點擊 / 空白鍵生成 Token · 擊破紅色故障蟲 · 搶奪黃金 VC$ · 1-8 購買 · F 狂暴模式',
    tokens: 'TOKENS',
    tps: '算力',
    click: '點擊',
    overclock: '超頻倍率',
    feverBtn: '5m 10x 狂暴',
    feverActive: '10x 狂暴',
    tabCompute: '算力擴張',
    tabResearch: '技術研發',
    tabMilestones: '上市與成就',
    clicksLabel: '點擊',
    purchased: '已研發',
    locked: '未解鎖',
    ipoTitle: 'IPO 敲鐘上市重啟',
    ipoDesc: '將公司估值轉化為永久「VC 股權」（每股永久提升 +15% 全域產出）。',
    ipoGain: '本次上市可獲得',
    ipoBtn: '發起 IPO 上市',
    ipoNeedMore: '累計產出達 500K 解鎖下一股權',
    equityBonus: '股權加成',
    achievementsTitle: '創業里程碑',
    onboardingHint: '點擊中央算力核心 或按 SPACE 開始訓練 AI',
    bugAlert: '偵測到異常 Bug 無人機！點擊擊破賺賞金！',
    pausedTitle: '遊戲暫停',
    lifetime: '累計總估值',
    resume: '繼續遊戲 (ESC)',
    reset: '重置存檔',
    resetConfirm: '確定重置嗎？',
    offlineTitle: '離線算力收益',
    offlineDesc: '在您離開期間，伺服器機櫃持續產出了：',
    offlineDouble: '觀看廣告領取 2x 雙倍收益',
    offlineClaim: '直接領取 1x',
    adTitle: '激勵獎勵',
    adFever: '解鎖 5 分鐘 10 倍狂暴模式',
    adOffline: '解鎖 2 倍離線算力收益',
    adWait: '獎勵準備中...',
    adClaim: '領取獎勵',
  },
  'zh-CN': {
    subtitle: '从车库算力迈向 AGI 奇点帝国',
    playCta: '启动创业公司',
    controlsHint: '点击 / 空格键生成 Token · 击破红色故障虫 · 抢夺黄金 VC$ · 1-8 购买 · F 狂暴模式',
    tokens: 'TOKENS',
    tps: '算力',
    click: '点击',
    overclock: '超频倍率',
    feverBtn: '5m 10x 狂暴',
    feverActive: '10x 狂暴',
    tabCompute: '算力扩张',
    tabResearch: '技术研发',
    tabMilestones: '上市与成就',
    clicksLabel: '点击',
    purchased: '已研发',
    locked: '未解锁',
    ipoTitle: 'IPO 敲钟上市重启',
    ipoDesc: '将公司估值转化为永久“VC 股权”（每股永久提升 +15% 全局产出）。',
    ipoGain: '本次上市可获得',
    ipoBtn: '发起 IPO 上市',
    ipoNeedMore: '累计产出达 500K 解锁下一股权',
    equityBonus: '股权加成',
    achievementsTitle: '创业里程碑',
    onboardingHint: '点击中央算力核心 或按 SPACE 开始训练 AI',
    bugAlert: '检测到异常 Bug 无人机！点击击破赚赏金！',
    pausedTitle: '游戏暂停',
    lifetime: '累计总估值',
    resume: '继续游戏 (ESC)',
    reset: '重置存档',
    resetConfirm: '确定重置吗？',
    offlineTitle: '离线算力收益',
    offlineDesc: '在您离开期间，服务器机柜持续产出了：',
    offlineDouble: '观看广告领取 2x 双倍收益',
    offlineClaim: '直接领取 1x',
    adTitle: '激励奖励',
    adFever: '解锁 5 分钟 10 倍狂暴模式',
    adOffline: '解锁 2 倍离线算力收益',
    adWait: '奖励准备中...',
    adClaim: '领取奖励',
  },
};

export const LOCALE_STORAGE_KEY = 'ai_startup_sim_locale';

export function detectDefaultLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'zh-TW' || saved === 'zh-CN') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'en';
}

export function getUpgradeCost(def: UpgradeDef, owned: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, owned));
}

export function getBulkUpgradeQuote(
  def: UpgradeDef,
  owned: number,
  tokens: number,
  buyAmount: BuyAmount
): { count: number; totalCost: number } {
  if (buyAmount === 1) {
    return { count: 1, totalCost: getUpgradeCost(def, owned) };
  }
  if (buyAmount === 10) {
    let total = 0;
    for (let i = 0; i < 10; i++) {
      total += getUpgradeCost(def, owned + i);
    }
    return { count: 10, totalCost: total };
  }
  // 'max': calculate how many affordable (at least 1 shown)
  let count = 0;
  let total = 0;
  let currentOwned = owned;
  while (count < 100) {
    const nextCost = getUpgradeCost(def, currentOwned);
    if (total + nextCost > tokens) break;
    total += nextCost;
    currentOwned++;
    count++;
  }
  if (count === 0) {
    return { count: 1, totalCost: getUpgradeCost(def, owned) };
  }
  return { count, totalCost: total };
}

export function calculatePendingShares(state: SaveState): number {
  const totalEarnedShares = Math.floor(Math.sqrt(state.lifetimeTokens / IPO_BASE_THRESHOLD));
  return Math.max(0, totalEarnedShares - state.ipoShares);
}

export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n < 1000) return Math.floor(n).toLocaleString('en-US');
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];
  const tier = Math.floor(Math.log10(Math.abs(n)) / 3);
  if (tier <= 0) return Math.floor(n).toLocaleString('en-US');
  const suffix = units[tier - 1] ?? `e${tier * 3}`;
  const scale = Math.pow(10, tier * 3);
  return (n / scale).toFixed(2) + suffix;
}
