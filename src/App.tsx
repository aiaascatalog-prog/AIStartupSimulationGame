import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX, Pause, Play, Zap, RotateCcw, Sparkles } from 'lucide-react';
import { GameCanvas, GameCanvasHandle } from './components/GameCanvas';
import { soundEngine } from './audio/synth';
import {
  FEVER_DURATION_SEC,
  FEVER_MULTIPLIER,
  SAVE_KEY,
  STARTUP_STAGES,
  UPGRADES,
  formatTokens,
  getUpgradeCost,
} from './game/constants';
import { AdModalState, GameScreen, SaveState } from './game/types';

function loadSave(): SaveState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveState;
      if (typeof parsed.tokens === 'number') {
        return parsed;
      }
    }
  } catch {
    // ignore corrupted save
  }
  return {
    tokens: 0,
    lifetimeTokens: 0,
    totalClicks: 0,
    upgrades: {},
    lastSavedAt: Date.now(),
  };
}

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('title');
  const [save, setSave] = useState<SaveState>(() => loadSave());
  const [muted, setMuted] = useState(false);
  const [feverLeft, setFeverLeft] = useState(0);
  const [adModal, setAdModal] = useState<AdModalState | null>(null);
  const [offlinePending, setOfflinePending] = useState<number | null>(null);

  const canvasRef = useRef<GameCanvasHandle | null>(null);
  const comboRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  // Compute TPS & Click Power
  const { baseTps, clickPower } = useMemo(() => {
    let tps = 0;
    let click = 1;
    for (const u of UPGRADES) {
      const count = save.upgrades[u.id] || 0;
      tps += count * u.baseTps;
      click += count * u.clickBonus;
    }
    return { baseTps: tps, clickPower: click };
  }, [save.upgrades]);

  const isFever = feverLeft > 0;
  const effectiveTps = baseTps * (isFever ? FEVER_MULTIPLIER : 1);
  const effectiveClick = clickPower * (isFever ? FEVER_MULTIPLIER : 1);

  const currentStage = useMemo(() => {
    let stage = STARTUP_STAGES[0];
    for (const s of STARTUP_STAGES) {
      if (save.lifetimeTokens >= s.minTokens) {
        stage = s;
      }
    }
    return stage;
  }, [save.lifetimeTokens]);

  // Check offline earnings on mount
  useEffect(() => {
    const now = Date.now();
    const elapsedSec = Math.floor((now - save.lastSavedAt) / 1000);
    if (elapsedSec >= 15 && baseTps > 0) {
      const cappedSec = Math.min(elapsedSec, 8 * 3600); // cap at 8 hours
      const earned = Math.floor(cappedSec * baseTps * 0.5);
      if (earned >= 10) {
        setOfflinePending(earned);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save every 5s
  useEffect(() => {
    const id = setInterval(() => {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          ...save,
          lastSavedAt: Date.now(),
        })
      );
    }, 5000);
    return () => clearInterval(id);
  }, [save]);

  // Passive TPS & Fever countdown loop (10Hz UI tick)
  useEffect(() => {
    if (screen !== 'playing') return;
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
    }, 100);
    return () => clearInterval(id);
  }, [screen, effectiveTps]);

  // Ad countdown timer
  useEffect(() => {
    if (!adModal || adModal.secondsLeft <= 0) return;
    const id = setTimeout(() => {
      setAdModal((prev) => (prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null));
    }, 1000);
    return () => clearTimeout(id);
  }, [adModal]);

  const handleCoreClick = useCallback(() => {
    const now = performance.now();
    if (now - lastClickTimeRef.current < 450) {
      comboRef.current = Math.min(comboRef.current + 1, 20);
    } else {
      comboRef.current = 0;
    }
    lastClickTimeRef.current = now;

    const isCrit = Math.random() < 0.12;
    const amount = effectiveClick * (isCrit ? 3 : 1);

    soundEngine.playClick(isCrit, comboRef.current);

    setSave((prev) => ({
      ...prev,
      tokens: prev.tokens + amount,
      lifetimeTokens: prev.lifetimeTokens + amount,
      totalClicks: prev.totalClicks + 1,
    }));

    return { amount, isCrit };
  }, [effectiveClick]);

  const handleGoldenCatch = useCallback((bonus: number) => {
    soundEngine.playGoldenCatch();
    setSave((prev) => ({
      ...prev,
      tokens: prev.tokens + bonus,
      lifetimeTokens: prev.lifetimeTokens + bonus,
    }));
  }, []);

  const buyUpgrade = useCallback(
    (id: string) => {
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) return;
      setSave((prev) => {
        const owned = prev.upgrades[id] || 0;
        const cost = getUpgradeCost(def, owned);
        if (prev.tokens < cost) return prev;
        soundEngine.playUpgrade();
        return {
          ...prev,
          tokens: prev.tokens - cost,
          upgrades: {
            ...prev.upgrades,
            [id]: owned + 1,
          },
        };
      });
    },
    []
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const startFeverAd = useCallback(() => {
    if (isFever) return;
    if (new URLSearchParams(window.location.search).get('trailer') === '1') {
      setFeverLeft(FEVER_DURATION_SEC);
      soundEngine.playFeverStart();
      canvasRef.current?.triggerShake(10);
      return;
    }
    setAdModal({ type: 'fever', secondsLeft: 3 });
  }, [isFever]);

  const claimAdReward = useCallback(() => {
    if (!adModal || adModal.secondsLeft > 0) return;
    if (adModal.type === 'fever') {
      setFeverLeft(FEVER_DURATION_SEC);
      soundEngine.playFeverStart();
      canvasRef.current?.triggerShake(10);
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
  }, [adModal]);

  const claimOfflineNormal = useCallback(() => {
    if (!offlinePending) return;
    soundEngine.playUpgrade();
    setSave((prev) => ({
      ...prev,
      tokens: prev.tokens + offlinePending,
      lifetimeTokens: prev.lifetimeTokens + offlinePending,
    }));
    setOfflinePending(null);
  }, [offlinePending]);

  const resetSave = useCallback(() => {
    const fresh: SaveState = {
      tokens: 0,
      lifetimeTokens: 0,
      totalClicks: 0,
      upgrades: {},
      lastSavedAt: Date.now(),
    };
    setSave(fresh);
    setFeverLeft(0);
    localStorage.setItem(SAVE_KEY, JSON.stringify(fresh));
    setScreen('playing');
  }, []);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (screen === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          setScreen('playing');
          soundEngine.playUpgrade();
        }
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        setScreen((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        return;
      }

      if (screen !== 'playing' || adModal || offlinePending) return;

      if (e.code === 'Space') {
        e.preventDefault();
        const { amount, isCrit } = handleCoreClick();
        canvasRef.current?.triggerCorePulse(amount, isCrit);
      } else if (e.key >= '1' && e.key <= '5') {
        const idx = Number(e.key) - 1;
        if (UPGRADES[idx]) {
          buyUpgrade(UPGRADES[idx].id);
        }
      } else if (e.key.toLowerCase() === 'f') {
        startFeverAd();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, adModal, offlinePending, handleCoreClick, buyUpgrade, startFeverAd]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070b14] text-slate-100 font-sans select-none">
      {/* Isolated 60fps Canvas */}
      <GameCanvas
        ref={canvasRef}
        isPlaying={screen === 'playing' && !adModal && !offlinePending}
        isFever={isFever}
        tps={effectiveTps}
        onCoreClick={handleCoreClick}
        onGoldenCatch={handleGoldenCatch}
      />

      {/* TITLE SCREEN */}
      {screen === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center p-6 pointer-events-auto bg-[#070b14]/55">
          <div className="max-w-xl w-full flex flex-col items-center text-center gap-6">
            {/* Bespoke Inline SVG Title Lockup */}
            <svg
              viewBox="0 0 420 110"
              className="w-full max-w-[400px] h-auto drop-shadow-[0_0_24px_rgba(34,211,238,0.35)]"
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
                width="408"
                height="98"
                rx="12"
                fill="#0b1222"
                fillOpacity="0.88"
                stroke="url(#titleGrad)"
                strokeWidth="2"
              />
              <text
                x="210"
                y="48"
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
                x="210"
                y="80"
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="16"
                fontWeight="600"
                letterSpacing="4"
              >
                AI 創業公司模擬器
              </text>
            </svg>

            <button
              onClick={() => {
                setScreen('playing');
                soundEngine.playUpgrade();
              }}
              className="px-8 py-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-slate-950 font-extrabold text-lg tracking-wide transition cursor-pointer shadow-[0_0_28px_rgba(34,211,238,0.45)]"
            >
              LAUNCH STARTUP (ENTER)
            </button>

            <p className="text-xs sm:text-sm text-slate-400 font-mono tracking-wide">
              Click / Space Mint Token · 1-5 Buy Upgrades · F Fever Mode · Esc Pause
            </p>
          </div>
        </div>
      )}

      {/* PLAYING HUD */}
      {screen !== 'title' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
          {/* Top Bar */}
          <div className="flex items-start justify-between gap-4">
            {/* Top-Left: Token & Stage Cluster */}
            <div className="pointer-events-auto bg-[#0b1222]/90 border border-cyan-500/30 rounded-xl px-4 py-3 shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: currentStage.badgeColor }}
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {currentStage.name}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-cyan-300">
                {formatTokens(save.tokens)} <span className="text-sm text-slate-400">TOKENS</span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs font-mono tabular-nums text-slate-400">
                <span>
                  TPS: <strong className="text-emerald-400">{formatTokens(effectiveTps)}/s</strong>
                </span>
                <span>
                  Click: <strong className="text-cyan-300">+{formatTokens(effectiveClick)}</strong>
                </span>
              </div>
            </div>

            {/* Top-Right: Fever + Audio + Pause */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={startFeverAd}
                disabled={isFever}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border font-bold text-xs sm:text-sm transition cursor-pointer ${
                  isFever
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-amber-400 hover:bg-amber-300 border-amber-300 text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
                }`}
              >
                <Zap className="w-4 h-4" />
                {isFever ? (
                  <span className="font-mono tabular-nums">
                    10x FEVER {Math.floor(feverLeft / 60)}:
                    {String(Math.floor(feverLeft % 60)).padStart(2, '0')}
                  </span>
                ) : (
                  <span>5m 10x 狂暴模式</span>
                )}
              </button>

              <button
                onClick={toggleMute}
                aria-label="Toggle Mute"
                className="p-2.5 rounded-xl bg-[#0b1222]/90 border border-slate-700 hover:border-cyan-400 text-slate-200 transition cursor-pointer"
              >
                {muted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setScreen((s) => (s === 'playing' ? 'paused' : 'playing'))}
                aria-label="Pause Game"
                className="p-2.5 rounded-xl bg-[#0b1222]/90 border border-slate-700 hover:border-cyan-400 text-slate-200 transition cursor-pointer"
              >
                <Pause className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right-Side Compact Upgrade Dock (Desktop) / Bottom Dock (Mobile) */}
          <div className="pointer-events-auto self-end w-full sm:w-80 bg-[#0b1222]/92 border border-slate-700/80 rounded-2xl p-3 flex flex-col gap-2 shadow-2xl">
            <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                算力與團隊擴張 (1-5)
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Clicks: {save.totalClicks.toLocaleString()}
              </span>
            </div>

            {UPGRADES.map((u, idx) => {
              const owned = save.upgrades[u.id] || 0;
              const cost = getUpgradeCost(u, owned);
              const canAfford = save.tokens >= cost;
              return (
                <button
                  key={u.id}
                  onClick={() => buyUpgrade(u.id)}
                  disabled={!canAfford}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                    canAfford
                      ? 'bg-slate-900/90 border-slate-700 hover:border-cyan-400 cursor-pointer active:scale-[0.99]'
                      : 'bg-slate-950/60 border-slate-800/70 opacity-55 cursor-not-allowed'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm text-slate-100 truncate">{u.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{u.subtitle}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-mono font-bold tabular-nums ${
                        canAfford ? 'text-cyan-300' : 'text-slate-500'
                      }`}
                    >
                      {formatTokens(cost)}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">Lv.{owned}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {screen === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm bg-[#0b1222] border border-slate-700 rounded-2xl p-6 flex flex-col gap-4 text-center shadow-2xl">
            <h2 className="text-xl font-extrabold tracking-wide text-cyan-300">GAME PAUSED</h2>
            <p className="text-xs text-slate-400 font-mono">
              Lifetime Tokens: {formatTokens(save.lifetimeTokens)}
            </p>
            <button
              onClick={() => setScreen('playing')}
              className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4" /> 繼續遊戲 (ESC)
            </button>
            <button
              onClick={resetSave}
              className="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> 重置存檔
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
            <h2 className="text-xl font-extrabold text-amber-300">離線算力收益</h2>
            <p className="text-sm text-slate-300">
              在你離開期間，伺服器自動產出了：
            </p>
            <div className="text-3xl font-mono font-extrabold text-cyan-300 tabular-nums">
              +{formatTokens(offlinePending)}
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={() =>
                  setAdModal({ type: 'offline', secondsLeft: 3, offlineAmount: offlinePending })
                }
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold cursor-pointer"
              >
                看廣告領取 2x 雙倍收益 (+{formatTokens(offlinePending * 2)})
              </button>
              <button
                onClick={claimOfflineNormal}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold cursor-pointer"
              >
                直接領取 1x
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATED REWARDED AD MODAL */}
      {adModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-sm bg-[#0b1222] border border-cyan-500/40 rounded-2xl p-6 flex flex-col gap-4 text-center shadow-2xl">
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              Rewarded Ad Sponsor
            </div>
            <h3 className="text-lg font-bold text-slate-100">
              {adModal.type === 'fever' ? '解鎖 5 分鐘 10x 狂暴模式' : '解鎖 2x 離線雙倍收益'}
            </h3>
            <div className="py-6 rounded-xl bg-slate-900 border border-slate-800 font-mono text-sm text-slate-400">
              {adModal.secondsLeft > 0
                ? `廣告播放中... ${adModal.secondsLeft}s`
                : '獎勵已準備就緒！'}
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
              {adModal.secondsLeft > 0 ? `請稍候 (${adModal.secondsLeft})` : '領取獎勵'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
