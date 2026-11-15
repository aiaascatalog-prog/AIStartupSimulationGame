import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Bug,
  Cpu,
  FlaskConical,
  Globe,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { soundEngine } from './audio/synth';
import { GameCanvas, GameCanvasHandle } from './components/GameCanvas';
import {
  ACHIEVEMENTS,
  FEVER_DURATION_SEC,
  FEVER_MULTIPLIER,
  IPO_BASE_THRESHOLD,
  LOCALE_STORAGE_KEY,
  RESEARCH_LIST,
  SAVE_KEY,
  SHARE_BONUS_MULTIPLIER,
  STARTUP_STAGES,
  UI_COPY,
  UPGRADES,
  calculatePendingShares,
  detectDefaultLocale,
  formatTokens,
  getBulkUpgradeQuote,
} from './game/constants';
import { AdModalState, BuyAmount, DockTab, GameScreen, Locale, SaveState } from './game/types';
import { platformSDK } from './sdk/crazygames';

function createFreshSave(ipoShares = 0, prestigeCount = 0, achievements: string[] = []): SaveState {
  return {
    tokens: 0,
    lifetimeTokens: 0,
    totalClicks: 0,
    bugsZapped: 0,
    vcCaught: 0,
    ipoShares,
    prestigeCount,
    upgrades: {},
    research: [],
    achievements,
    lastSavedAt: Date.now(),
  };
}

function loadLocalSave(): SaveState {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem('ai_startup_sim_save_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      if (typeof parsed.tokens === 'number') {
        return {
          ...createFreshSave(),
          ...parsed,
          upgrades: parsed.upgrades ?? {},
          research: Array.isArray(parsed.research) ? parsed.research : [],
          achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
        };
      }
    }
  } catch {
    // ignore corrupted save
  }
  return createFreshSave();
}

export default function App() {
  const isTrailerMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('trailer') === '1',
    []
  );

  const [locale, setLocale] = useState<Locale>(() => detectDefaultLocale());
  const [screen, setScreen] = useState<GameScreen>(() => (isTrailerMode ? 'playing' : 'title'));
  const [save, setSave] = useState<SaveState>(() => loadLocalSave());
  const [muted, setMuted] = useState(false);
  const [feverLeft, setFeverLeft] = useState(0);
  const [overclock, setOverclock] = useState(0); // 0..100
  const [dockTab, setDockTab] = useState<DockTab>('compute');
  const [buyAmount, setBuyAmount] = useState<BuyAmount>(1);
  const [adModal, setAdModal] = useState<AdModalState | null>(null);
  const [offlinePending, setOfflinePending] = useState<number | null>(null);
  const [toastTitle, setToastTitle] = useState<string | null>(null);
  const [bugAlertActive, setBugAlertActive] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const canvasRef = useRef<GameCanvasHandle | null>(null);
  const comboRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const prevStageIdxRef = useRef(0);
  const saveRef = useRef(save);
  saveRef.current = save;

  const t = UI_COPY[locale];

  // Derived multipliers from Research + IPO Equity Shares
  const stats = useMemo(() => {
    const researched = new Set(save.research);
    let globalMult = 1 + save.ipoShares * SHARE_BONUS_MULTIPLIER;
    let clickMult = 1;
    let critChance = 0.12;
    let vcMult = 1;

    for (const r of RESEARCH_LIST) {
      if (!researched.has(r.id)) continue;
      if (r.target === 'global') globalMult *= r.multiplier;
      else if (r.target === 'click') clickMult *= r.multiplier;
      else if (r.target === 'crit') critChance += r.multiplier;
      else if (r.target === 'vc') vcMult *= r.multiplier;
    }

    let tps = 0;
    let clickFlat = 1;
    let activeTiers = 0;

    for (const u of UPGRADES) {
      const count = save.upgrades[u.id] || 0;
      if (count > 0) activeTiers++;
      let tierMult = 1;
      for (const r of RESEARCH_LIST) {
        if (r.target === u.id && researched.has(r.id)) {
          tierMult *= r.multiplier;
        }
      }
      tps += count * u.baseTps * tierMult;
      clickFlat += count * u.clickBonus * tierMult;
    }

    return {
      baseTps: tps * globalMult,
      clickBase: clickFlat * clickMult * globalMult,
      critChance,
      vcMult,
      globalMult,
      activeTiers,
    };
  }, [save.upgrades, save.research, save.ipoShares]);

  const isFever = feverLeft > 0;
  const overclockMultiplier = 1 + (overclock / 100) * 2; // 1.0x .. 3.0x
  const effectiveTps = stats.baseTps * (isFever ? FEVER_MULTIPLIER : 1);
  const effectiveClick = stats.clickBase * overclockMultiplier * (isFever ? FEVER_MULTIPLIER : 1);
  const pendingShares = useMemo(() => calculatePendingShares(save), [save]);

  const currentStage = useMemo(() => {
    let stage = STARTUP_STAGES[0];
    for (const s of STARTUP_STAGES) {
      if (save.lifetimeTokens >= s.minTokens) {
        stage = s;
      }
    }
    return stage;
  }, [save.lifetimeTokens]);

  // Initialize CrazyGames SDK & hydrate cloud save if newer
  useEffect(() => {
    let active = true;
    platformSDK.init().then(async () => {
      if (!active) return;
      const cloudRaw = await platformSDK.loadCloudData(SAVE_KEY);
      if (cloudRaw && active) {
        try {
          const parsed = JSON.parse(cloudRaw) as SaveState;
          if (
            typeof parsed.lifetimeTokens === 'number' &&
            parsed.lifetimeTokens > saveRef.current.lifetimeTokens
          ) {
            setSave({
              ...createFreshSave(),
              ...parsed,
              upgrades: parsed.upgrades ?? {},
              research: Array.isArray(parsed.research) ? parsed.research : [],
              achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
            });
          }
        } catch {
          // ignore
        }
      }
      if (isTrailerMode) {
        platformSDK.gameplayStart();
      }
    });
    return () => {
      active = false;
    };
  }, [isTrailerMode]);

  // Check offline earnings on mount
  useEffect(() => {
    if (isTrailerMode) return;
    const now = Date.now();
    const elapsedSec = Math.floor((now - save.lastSavedAt) / 1000);
    if (elapsedSec >= 20 && stats.baseTps > 0) {
      const cappedSec = Math.min(elapsedSec, 8 * 3600);
      const earned = Math.floor(cappedSec * stats.baseTps * 0.5);
      if (earned >= 15) {
        setOfflinePending(earned);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save to localStorage & CrazyGames Cloud every 5s
  useEffect(() => {
    const id = setInterval(() => {
      const payload = JSON.stringify({
        ...saveRef.current,
        lastSavedAt: Date.now(),
      });
      platformSDK.saveCloudData(SAVE_KEY, payload);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Stage-up celebration
  useEffect(() => {
    if (currentStage.index > prevStageIdxRef.current) {
      prevStageIdxRef.current = currentStage.index;
      if (screen === 'playing') {
        soundEngine.playAchievement();
        platformSDK.happytime();
        setToastTitle(`${currentStage.name[locale]}!`);
      }
    } else {
      prevStageIdxRef.current = currentStage.index;
    }
  }, [currentStage, screen, locale]);

  // Check Achievements
  useEffect(() => {
    if (screen !== 'playing') return;
    const unlockedSet = new Set(save.achievements);
    const newlyUnlocked = ACHIEVEMENTS.filter(
      (a) => !unlockedSet.has(a.id) && a.check(save, effectiveTps)
    );
    if (newlyUnlocked.length > 0) {
      const reward = newlyUnlocked.reduce((acc, a) => acc + a.rewardTokens, 0);
      soundEngine.playAchievement();
      platformSDK.happytime();
      setToastTitle(`${newlyUnlocked[0].name[locale]} (+${formatTokens(reward)})`);
      setSave((prev) => ({
        ...prev,
        tokens: prev.tokens + reward,
        lifetimeTokens: prev.lifetimeTokens + reward,
        achievements: [...prev.achievements, ...newlyUnlocked.map((a) => a.id)],
      }));
    }
  }, [save, effectiveTps, screen, locale]);

  // Clear toast after 3.2s
  useEffect(() => {
    if (!toastTitle) return;
    const id = setTimeout(() => setToastTitle(null), 3200);
    return () => clearTimeout(id);
  }, [toastTitle]);

  // Passive TPS, Fever & Overclock decay loop (10Hz)
  useEffect(() => {
    if (screen !== 'playing' || adModal || offlinePending) return;
    const id = setInterval(() => {
      if (effectiveTps > 0) {
        const delta = effectiveTps * 0.1;
        setSave((prev) => ({
          ...prev,
          tokens: prev.tokens + delta,
          lifetimeTokens: prev.lifetimeTokens + delta,
        }));
      }
      setFeverLeft((prev) => (prev > 0 ? Math.max(0, prev - 0.1) : 0));
      setOverclock((prev) => (prev > 0 ? Math.max(0, prev - 1.6) : 0));
    }, 100);
    return () => clearInterval(id);
  }, [screen, adModal, offlinePending, effectiveTps]);

  // Simulated fallback ad countdown timer
  useEffect(() => {
    if (!adModal || adModal.secondsLeft <= 0) return;
    const id = setTimeout(() => {
      setAdModal((prev) => (prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null));
    }, 1000);
    return () => clearTimeout(id);
  }, [adModal]);

  const enterGame = useCallback(() => {
    setScreen('playing');
    soundEngine.playUpgrade();
    platformSDK.gameplayStart();
  }, []);

  const togglePause = useCallback(() => {
    setScreen((prev) => {
      const next = prev === 'playing' ? 'paused' : 'playing';
      if (next === 'paused') platformSDK.gameplayStop();
      else platformSDK.gameplayStart();
      setConfirmReset(false);
      return next;
    });
  }, []);

  const handleCoreClick = useCallback(() => {
    const now = performance.now();
    if (now - lastClickTimeRef.current < 480) {
      comboRef.current = Math.min(comboRef.current + 1, 20);
    } else {
      comboRef.current = 0;
    }
    lastClickTimeRef.current = now;
    setOverclock((prev) => Math.min(100, prev + 8));

    const isCrit = Math.random() < stats.critChance;
    const amount = effectiveClick * (isCrit ? 3 : 1);

    soundEngine.playClick(isCrit, comboRef.current);

    setSave((prev) => ({
      ...prev,
      tokens: prev.tokens + amount,
      lifetimeTokens: prev.lifetimeTokens + amount,
      totalClicks: prev.totalClicks + 1,
    }));

    return { amount, isCrit };
  }, [effectiveClick, stats.critChance]);

  const handleGoldenCatch = useCallback(() => {
    const bonus = Math.max(150, Math.floor(effectiveTps * 25 * stats.vcMult));
    soundEngine.playGoldenCatch();
    platformSDK.happytime();
    setSave((prev) => ({
      ...prev,
      tokens: prev.tokens + bonus,
      lifetimeTokens: prev.lifetimeTokens + bonus,
      vcCaught: prev.vcCaught + 1,
    }));
    return bonus;
  }, [effectiveTps, stats.vcMult]);

  const handleBugSpawn = useCallback(() => {
    soundEngine.playBugSpawn();
    setBugAlertActive(true);
    setTimeout(() => setBugAlertActive(false), 3200);
  }, []);

  const handleBugZap = useCallback(() => {
    const bounty = Math.max(80, Math.floor((effectiveTps * 15 + effectiveClick * 12) * stats.vcMult));
    soundEngine.playBugZap();
    setBugAlertActive(false);
    setSave((prev) => ({
      ...prev,
      tokens: prev.tokens + bounty,
      lifetimeTokens: prev.lifetimeTokens + bounty,
      bugsZapped: prev.bugsZapped + 1,
    }));
    return bounty;
  }, [effectiveTps, effectiveClick, stats.vcMult]);

  const buyUpgrade = useCallback(
    (id: string) => {
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) return;
      setSave((prev) => {
        const owned = prev.upgrades[id] || 0;
        const { count, totalCost } = getBulkUpgradeQuote(def, owned, prev.tokens, buyAmount);
        if (prev.tokens < totalCost || count <= 0) return prev;
        soundEngine.playUpgrade();
        return {
          ...prev,
          tokens: prev.tokens - totalCost,
          upgrades: {
            ...prev.upgrades,
            [id]: owned + count,
          },
        };
      });
    },
    [buyAmount]
  );

  const buyResearch = useCallback((id: string) => {
    const def = RESEARCH_LIST.find((r) => r.id === id);
    if (!def) return;
    setSave((prev) => {
      if (prev.research.includes(id) || prev.tokens < def.cost) return prev;
      soundEngine.playAchievement();
      return {
        ...prev,
        tokens: prev.tokens - def.cost,
        research: [...prev.research, id],
      };
    });
  }, []);

  const triggerIPO = useCallback(() => {
    if (pendingShares <= 0) return;
    soundEngine.playPrestige();
    platformSDK.happytime();
    canvasRef.current?.triggerShake(12);
    setSave((prev) => {
      const gained = calculatePendingShares(prev);
      if (gained <= 0) return prev;
      return createFreshSave(
        prev.ipoShares + gained,
        prev.prestigeCount + 1,
        prev.achievements
      );
    });
    setFeverLeft(0);
    setOverclock(0);
    setDockTab('compute');
  }, [pendingShares]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const cycleLocale = useCallback(() => {
    setLocale((prev) => {
      const next: Locale = prev === 'en' ? 'zh-TW' : prev === 'zh-TW' ? 'zh-CN' : 'en';
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const activateFever = useCallback(() => {
    setFeverLeft(FEVER_DURATION_SEC);
    soundEngine.playFeverStart();
    platformSDK.happytime();
    canvasRef.current?.triggerShake(10);
  }, []);

  const startFeverAd = useCallback(() => {
    if (isFever) return;
    if (isTrailerMode) {
      activateFever();
      return;
    }
    platformSDK.requestRewardedAd(
      () => activateFever(),
      () => {
        platformSDK.gameplayStop();
        setAdModal({ type: 'fever', secondsLeft: 3 });
      }
    );
  }, [isFever, isTrailerMode, activateFever]);

  const startOfflineDoubleAd = useCallback(() => {
    if (!offlinePending) return;
    const amount = offlinePending;
    platformSDK.requestRewardedAd(
      () => {
        const doubled = amount * 2;
        soundEngine.playGoldenCatch();
        setSave((prev) => ({
          ...prev,
          tokens: prev.tokens + doubled,
          lifetimeTokens: prev.lifetimeTokens + doubled,
        }));
        setOfflinePending(null);
      },
      () => {
        platformSDK.gameplayStop();
        setAdModal({ type: 'offline', secondsLeft: 3, offlineAmount: amount });
      }
    );
  }, [offlinePending]);

  const claimAdReward = useCallback(() => {
    if (!adModal || adModal.secondsLeft > 0) return;
    if (adModal.type === 'fever') {
      activateFever();
    } else if (adModal.type === 'offline' && adModal.offlineAmount) {
      const doubled = adModal.offlineAmount * 2;
      soundEngine.playGoldenCatch();
      setSave((prev) => ({
        ...prev,
        tokens: prev.tokens + doubled,
        lifetimeTokens: prev.lifetimeTokens + doubled,
      }));
      setOfflinePending(null);
    }
    setAdModal(null);
    platformSDK.gameplayStart();
  }, [adModal, activateFever]);

  const claimOfflineNormal = useCallback(() => {
    if (!offlinePending) return;
    soundEngine.playUpgrade();
    setSave((prev) => ({
      ...prev,
      tokens: prev.tokens + offlinePending,
      lifetimeTokens: prev.lifetimeTokens + offlinePending,
    }));
    setOfflinePending(null);
    platformSDK.gameplayStart();
  }, [offlinePending]);

  const resetSave = useCallback(() => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    const fresh = createFreshSave();
    setSave(fresh);
    setFeverLeft(0);
    setOverclock(0);
    setConfirmReset(false);
    platformSDK.saveCloudData(SAVE_KEY, JSON.stringify(fresh));
    setScreen('playing');
    platformSDK.gameplayStart();
  }, [confirmReset]);

  // Keyboard controls (prevent default scroll on Space/Arrows)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.repeat) return;

      if (screen === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          enterGame();
        }
        return;
      }

      if (e.code === 'Escape') {
        togglePause();
        return;
      }

      if (screen !== 'playing' || adModal || offlinePending) return;

      if (e.code === 'Space') {
        const { amount, isCrit } = handleCoreClick();
        canvasRef.current?.triggerCorePulse(amount, isCrit);
      } else if (e.key >= '1' && e.key <= '8') {
        const idx = Number(e.key) - 1;
        if (UPGRADES[idx]) {
          buyUpgrade(UPGRADES[idx].id);
        }
      } else if (e.key.toLowerCase() === 'f') {
        startFeverAd();
      } else if (e.key.toLowerCase() === 'z') {
        canvasRef.current?.zapActiveBug();
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, adModal, offlinePending, enterGame, togglePause, handleCoreClick, buyUpgrade, startFeverAd]);

  const ipoProgress = Math.min(100, (save.lifetimeTokens / IPO_BASE_THRESHOLD) * 100);

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-[#070b14] text-slate-100 font-sans select-none ${
        isTrailerMode ? '[&_*]:!cursor-none !cursor-none' : ''
      }`}
    >
      {/* Isolated 60fps Canvas */}
      <GameCanvas
        ref={canvasRef}
        isPlaying={screen === 'playing' && !adModal && !offlinePending}
        isFever={isFever}
        tps={effectiveTps}
        stageIndex={currentStage.index}
        stageColor={currentStage.ringColor}
        activeTiersCount={stats.activeTiers}
        overclockRatio={overclock / 100}
        onCoreClick={handleCoreClick}
        onGoldenCatch={handleGoldenCatch}
        onBugZap={handleBugZap}
        onBugSpawn={handleBugSpawn}
      />

      {/* TITLE SCREEN */}
      {screen === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center p-6 pointer-events-auto bg-[#070b14]/55">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={cycleLocale}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0b1222]/90 border border-slate-700 hover:border-cyan-400 text-xs font-bold text-slate-200 cursor-pointer"
            >
              <Globe className="w-4 h-4 text-cyan-400" />
              {locale === 'en' ? 'EN' : locale === 'zh-TW' ? '繁中' : '简中'}
            </button>
          </div>

          <div className="max-w-xl w-full flex flex-col items-center text-center gap-5">
            <svg
              viewBox="0 0 440 112"
              className="w-full max-w-[420px] h-auto drop-shadow-[0_0_26px_rgba(34,211,238,0.35)]"
              aria-label="AI Startup Simulator"
            >
              <defs>
                <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
              </defs>
              <rect
                x="6"
                y="6"
                width="428"
                height="100"
                rx="14"
                fill="#0b1222"
                fillOpacity="0.9"
                stroke="url(#titleGrad)"
                strokeWidth="2.2"
              />
              <text
                x="220"
                y="50"
                textAnchor="middle"
                fill="url(#titleGrad)"
                fontSize="26"
                fontWeight="800"
                letterSpacing="3"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                AI STARTUP SIM
              </text>
              <text
                x="220"
                y="82"
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="13"
                fontWeight="600"
                letterSpacing="2.5"
              >
                {t.subtitle}
              </text>
            </svg>

            <button
              onClick={enterGame}
              className="px-9 py-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-slate-950 font-extrabold text-lg tracking-wide transition cursor-pointer shadow-[0_0_30px_rgba(34,211,238,0.45)]"
            >
              {t.playCta} (ENTER)
            </button>

            <p className="text-xs sm:text-sm text-slate-400 font-mono tracking-wide max-w-lg">
              {t.controlsHint}
            </p>
          </div>
        </div>
      )}

      {/* PLAYING HUD */}
      {screen !== 'title' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
          {/* Top Bar */}
          <div className="flex items-start justify-between gap-3">
            {/* Top-Left: Token & Stage Cluster */}
            <div className="pointer-events-auto bg-[#0b1222]/90 border border-cyan-500/30 rounded-xl px-3.5 py-2.5 shadow-lg min-w-[215px]">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: currentStage.badgeColor }}
                  />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    {currentStage.name[locale]}
                  </span>
                </div>
                {save.ipoShares > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300">
                    +{Math.round(save.ipoShares * SHARE_BONUS_MULTIPLIER * 100)}%
                  </span>
                )}
              </div>

              <div className="text-xl sm:text-3xl font-extrabold font-mono tabular-nums text-cyan-300 leading-tight">
                {formatTokens(save.tokens)}{' '}
                <span className="text-xs sm:text-sm text-slate-400">{t.tokens}</span>
              </div>

              <div className="flex items-center gap-3 mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-slate-400">
                <span>
                  {t.tps}: <strong className="text-emerald-400">{formatTokens(effectiveTps)}/s</strong>
                </span>
                <span>
                  {t.click}: <strong className="text-cyan-300">+{formatTokens(effectiveClick)}</strong>
                </span>
                {overclock > 5 && (
                  <span className="text-pink-400 font-bold">
                    {overclockMultiplier.toFixed(1)}x
                  </span>
                )}
              </div>
            </div>

            {/* Top-Center: Toast / Bug Alert */}
            <div className="hidden md:flex flex-col items-center gap-1.5">
              {toastTitle && (
                <div className="px-4 py-2 rounded-xl bg-emerald-500/90 text-slate-950 font-extrabold text-xs tracking-wide shadow-lg flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  {toastTitle}
                </div>
              )}
              {bugAlertActive && (
                <div className="px-4 py-1.5 rounded-xl bg-rose-600/90 text-white font-bold text-xs tracking-wide shadow-lg flex items-center gap-2 animate-pulse">
                  <Bug className="w-4 h-4" />
                  {t.bugAlert}
                </div>
              )}
            </div>

            {/* Top-Right: Fever + Locale + Audio + Pause */}
            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={startFeverAd}
                disabled={isFever}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-bold text-xs sm:text-sm transition cursor-pointer ${
                  isFever
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-amber-400 hover:bg-amber-300 border-amber-300 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.35)]'
                }`}
              >
                <Zap className="w-4 h-4" />
                {isFever ? (
                  <span className="font-mono tabular-nums">
                    {t.feverActive} {Math.floor(feverLeft / 60)}:
                    {String(Math.floor(feverLeft % 60)).padStart(2, '0')}
                  </span>
                ) : (
                  <span>{t.feverBtn}</span>
                )}
              </button>

              <button
                onClick={cycleLocale}
                aria-label="Language"
                className="px-2.5 py-2 rounded-xl bg-[#0b1222]/90 border border-slate-700 hover:border-cyan-400 text-xs font-bold text-slate-200 transition cursor-pointer"
              >
                {locale === 'en' ? 'EN' : locale === 'zh-TW' ? '繁' : '简'}
              </button>

              <button
                onClick={toggleMute}
                aria-label="Toggle Mute"
                className="p-2 rounded-xl bg-[#0b1222]/90 border border-slate-700 hover:border-cyan-400 text-slate-200 transition cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              <button
                onClick={togglePause}
                aria-label="Pause Game"
                className="p-2 rounded-xl bg-[#0b1222]/90 border border-slate-700 hover:border-cyan-400 text-slate-200 transition cursor-pointer"
              >
                <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* First-click onboarding prompt */}
          {save.totalClicks < 3 && !isTrailerMode && (
            <div className="self-center md:self-start md:ml-[18%] px-4 py-2 rounded-xl bg-[#0b1222]/85 border border-cyan-400/40 text-cyan-300 text-xs sm:text-sm font-mono animate-bounce">
              {t.onboardingHint}
            </div>
          )}

          {/* Right-Side Tabbed Dock (Desktop) / Bottom Dock (Mobile) */}
          <div className="pointer-events-auto self-end w-full sm:w-88 bg-[#0b1222]/94 border border-slate-700/80 rounded-2xl p-3 flex flex-col gap-2 shadow-2xl max-h-[46vh] sm:max-h-[72vh]">
            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-1 rounded-xl">
              <button
                onClick={() => setDockTab('compute')}
                className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  dockTab === 'compute' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" /> {t.tabCompute}
              </button>
              <button
                onClick={() => setDockTab('research')}
                className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  dockTab === 'research' ? 'bg-violet-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" /> {t.tabResearch}
              </button>
              <button
                onClick={() => setDockTab('milestones')}
                className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  dockTab === 'milestones' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Rocket className="w-3.5 h-3.5" /> {t.tabMilestones}
              </button>
            </div>

            {/* TAB 1: COMPUTE GENERATORS */}
            {dockTab === 'compute' && (
              <>
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-mono text-slate-400">
                    {t.clicksLabel}: {save.totalClicks.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    {([1, 10, 'max'] as BuyAmount[]).map((amt) => (
                      <button
                        key={String(amt)}
                        onClick={() => setBuyAmount(amt)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer ${
                          buyAmount === amt
                            ? 'bg-cyan-400/25 text-cyan-300 border border-cyan-400/50'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {amt === 'max' ? 'MAX' : `x${amt}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-y-auto custom-scroll pr-1 flex flex-col gap-1.5">
                  {UPGRADES.map((u, idx) => {
                    const owned = save.upgrades[u.id] || 0;
                    const { count, totalCost } = getBulkUpgradeQuote(u, owned, save.tokens, buyAmount);
                    const canAfford = save.tokens >= totalCost;
                    return (
                      <button
                        key={u.id}
                        onClick={() => buyUpgrade(u.id)}
                        disabled={!canAfford}
                        className={`w-full text-left px-3 py-2 rounded-xl border transition flex items-center justify-between gap-2 ${
                          canAfford
                            ? 'bg-slate-900/90 border-slate-700 hover:border-cyan-400 cursor-pointer active:scale-[0.99]'
                            : 'bg-slate-950/60 border-slate-800/70 opacity-55 cursor-not-allowed'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                              {u.name[locale]}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {u.subtitle[locale]}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`text-xs font-mono font-bold tabular-nums ${
                              canAfford ? 'text-cyan-300' : 'text-slate-500'
                            }`}
                          >
                            {formatTokens(totalCost)} {count > 1 ? `(${count})` : ''}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">Lv.{owned}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* TAB 2: RESEARCH LAB */}
            {dockTab === 'research' && (
              <div className="overflow-y-auto custom-scroll pr-1 flex flex-col gap-1.5">
                {RESEARCH_LIST.map((r) => {
                  const done = save.research.includes(r.id);
                  const reqMet =
                    !r.unlockRequirement ||
                    !r.unlockRequirement.upgradeId ||
                    (save.upgrades[r.unlockRequirement.upgradeId] || 0) >=
                      (r.unlockRequirement.minOwned || 0);
                  const canAfford = !done && reqMet && save.tokens >= r.cost;
                  return (
                    <button
                      key={r.id}
                      onClick={() => buyResearch(r.id)}
                      disabled={!canAfford}
                      className={`w-full text-left px-3 py-2 rounded-xl border transition flex items-center justify-between gap-2 ${
                        done
                          ? 'bg-emerald-950/40 border-emerald-500/40 opacity-85'
                          : canAfford
                          ? 'bg-slate-900/90 border-violet-500/50 hover:border-violet-400 cursor-pointer'
                          : 'bg-slate-950/60 border-slate-800/70 opacity-55 cursor-not-allowed'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                          {r.name[locale]}
                        </div>
                        <div className="text-[11px] text-violet-300 truncate">{r.description[locale]}</div>
                      </div>
                      <div className="text-right shrink-0 font-mono text-xs font-bold">
                        {done ? (
                          <span className="text-emerald-400">{t.purchased}</span>
                        ) : !reqMet ? (
                          <span className="text-slate-500">{t.locked}</span>
                        ) : (
                          <span className={canAfford ? 'text-violet-300' : 'text-slate-500'}>
                            {formatTokens(r.cost)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* TAB 3: IPO & ACHIEVEMENTS */}
            {dockTab === 'milestones' && (
              <div className="overflow-y-auto custom-scroll pr-1 flex flex-col gap-2.5">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/35 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-300">{t.ipoTitle}</span>
                    <span className="text-[11px] font-mono text-amber-200">
                      {t.equityBonus}: +{Math.round(save.ipoShares * SHARE_BONUS_MULTIPLIER * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{t.ipoDesc}</p>

                  {pendingShares > 0 ? (
                    <button
                      onClick={triggerIPO}
                      className="w-full py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer"
                    >
                      {t.ipoBtn} (+{pendingShares} Shares)
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all"
                          style={{ width: `${ipoProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{t.ipoNeedMore}</span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  {t.achievementsTitle} ({save.achievements.length}/{ACHIEVEMENTS.length})
                </div>
                {ACHIEVEMENTS.map((a) => {
                  const unlocked = save.achievements.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 ${
                        unlocked
                          ? 'bg-emerald-950/35 border-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800/70 opacity-60'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-100 truncate">{a.name[locale]}</div>
                        <div className="text-[11px] text-slate-400 truncate">{a.description[locale]}</div>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-amber-300 shrink-0">
                        +{formatTokens(a.rewardTokens)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {screen === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm bg-[#0b1222] border border-slate-700 rounded-2xl p-6 flex flex-col gap-3.5 text-center shadow-2xl">
            <h2 className="text-xl font-extrabold tracking-wide text-cyan-300">{t.pausedTitle}</h2>
            <p className="text-xs text-slate-400 font-mono">
              {t.lifetime}: {formatTokens(save.lifetimeTokens)}
            </p>
            <button
              onClick={togglePause}
              className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4" /> {t.resume}
            </button>
            <button
              onClick={resetSave}
              className="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> {confirmReset ? t.resetConfirm : t.reset}
            </button>
          </div>
        </div>
      )}

      {/* OFFLINE EARNINGS MODAL */}
      {offlinePending !== null && screen === 'playing' && !adModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm bg-[#0b1222] border border-amber-400/50 rounded-2xl p-6 flex flex-col gap-4 text-center shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-300">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-amber-300">{t.offlineTitle}</h2>
            <p className="text-sm text-slate-300">{t.offlineDesc}</p>
            <div className="text-3xl font-mono font-extrabold text-cyan-300 tabular-nums">
              +{formatTokens(offlinePending)}
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={startOfflineDoubleAd}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold cursor-pointer"
              >
                {t.offlineDouble} (+{formatTokens(offlinePending * 2)})
              </button>
              <button
                onClick={claimOfflineNormal}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold cursor-pointer"
              >
                {t.offlineClaim}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NON-CRAZYGAMES FALLBACK REWARDED MODAL */}
      {adModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-sm bg-[#0b1222] border border-cyan-500/40 rounded-2xl p-6 flex flex-col gap-4 text-center shadow-2xl">
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">{t.adTitle}</div>
            <h3 className="text-lg font-bold text-slate-100">
              {adModal.type === 'fever' ? t.adFever : t.adOffline}
            </h3>
            <div className="py-6 rounded-xl bg-slate-900 border border-slate-800 font-mono text-sm text-slate-400">
              {adModal.secondsLeft > 0 ? `${t.adWait} ${adModal.secondsLeft}s` : t.adClaim}
            </div>
            <button
              onClick={claimAdReward}
              disabled={adModal.secondsLeft > 0}
              className={`w-full py-3 rounded-xl font-extrabold transition ${
                adModal.secondsLeft > 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 cursor-pointer'
              }`}
            >
              {adModal.secondsLeft > 0 ? `${adModal.secondsLeft}s` : t.adClaim}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
