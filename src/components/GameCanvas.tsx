import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { formatTokens } from '../game/constants';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  scale: number;
}

interface GoldenPacket {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulse: number;
}

interface BugDrone {
  active: boolean;
  telegraph: number; // >0 = 1.4s windup telegraph before targetable
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  wobble: number;
}

interface BgStream {
  xRatio: number;
  y: number;
  speed: number;
  len: number;
  alpha: number;
}

export interface GameCanvasHandle {
  triggerCorePulse: (amount: number, isCrit: boolean) => void;
  triggerShake: (intensity: number) => void;
  zapActiveBug: () => boolean;
}

interface GameCanvasProps {
  isPlaying: boolean;
  isFever: boolean;
  tps: number;
  stageIndex: number;
  stageColor: string;
  activeTiersCount: number;
  overclockRatio: number; // 0..1
  onCoreClick: (clientX?: number, clientY?: number) => { amount: number; isCrit: boolean };
  onGoldenCatch: () => number;
  onBugZap: () => number;
  onBugSpawn?: () => void;
}

const PARTICLE_POOL_SIZE = 220;
const TEXT_POOL_SIZE = 40;
const BG_STREAM_COUNT = 26;

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  (
    {
      isPlaying,
      isFever,
      tps,
      stageIndex,
      stageColor,
      activeTiersCount,
      overclockRatio,
      onCoreClick,
      onGoldenCatch,
      onBugZap,
      onBugSpawn,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const simRef = useRef({
      isPlaying,
      isFever,
      tps,
      stageIndex,
      stageColor,
      activeTiersCount,
      overclockRatio,
      coreScaleX: 1,
      coreScaleY: 1,
      coreFlash: 0,
      shake: 0,
      rotation: 0,
      hitstop: 0,
      goldenTimer: 10,
      bugTimer: 15,
    });

    simRef.current.isPlaying = isPlaying;
    simRef.current.isFever = isFever;
    simRef.current.tps = tps;
    simRef.current.stageIndex = stageIndex;
    simRef.current.stageColor = stageColor;
    simRef.current.activeTiersCount = activeTiersCount;
    simRef.current.overclockRatio = overclockRatio;

    const callbacksRef = useRef({
      onCoreClick,
      onGoldenCatch,
      onBugZap,
      onBugSpawn,
    });
    callbacksRef.current = { onCoreClick, onGoldenCatch, onBugZap, onBugSpawn };

    const particlesRef = useRef<Particle[]>(
      Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 3,
        color: '#22d3ee',
      }))
    );

    const textsRef = useRef<FloatingText[]>(
      Array.from({ length: TEXT_POOL_SIZE }, () => ({
        active: false,
        x: 0,
        y: 0,
        vy: -60,
        life: 0,
        maxLife: 0.85,
        text: '',
        color: '#22d3ee',
        scale: 1,
      }))
    );

    const goldenRef = useRef<GoldenPacket>({
      active: false,
      x: -100,
      y: 200,
      vx: 130,
      vy: 0,
      radius: 25,
      pulse: 0,
    });

    const bugRef = useRef<BugDrone>({
      active: false,
      telegraph: 0,
      x: 200,
      y: 200,
      vx: 40,
      vy: 30,
      radius: 22,
      life: 0,
      wobble: 0,
    });

    const streamsRef = useRef<BgStream[]>(
      Array.from({ length: BG_STREAM_COUNT }, () => ({
        xRatio: Math.random(),
        y: Math.random() * 1200,
        speed: 35 + Math.random() * 75,
        len: 28 + Math.random() * 64,
        alpha: 0.06 + Math.random() * 0.14,
      }))
    );

    const getCoreCenter = (width: number, height: number) => {
      const isDesktop = width >= 900;
      return {
        cx: isDesktop ? width * 0.34 : width * 0.5,
        cy: isDesktop ? height * 0.52 : height * 0.4,
        radius: Math.min(width, height) * (isDesktop ? 0.135 : 0.15),
      };
    };

    const spawnParticles = (x: number, y: number, count: number, color: string) => {
      const pool = particlesRef.current;
      let spawned = 0;
      for (let i = 0; i < pool.length && spawned < count; i++) {
        if (!pool[i].active) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 90 + Math.random() * 260;
          pool[i].active = true;
          pool[i].x = x;
          pool[i].y = y;
          pool[i].vx = Math.cos(angle) * speed;
          pool[i].vy = Math.sin(angle) * speed;
          pool[i].life = 0;
          pool[i].maxLife = 0.42 + Math.random() * 0.36;
          pool[i].size = 2 + Math.random() * 3.5;
          pool[i].color = color;
          spawned++;
        }
      }
    };

    const spawnFloatingText = (x: number, y: number, text: string, color: string, scale = 1) => {
      const pool = textsRef.current;
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].active) {
          pool[i].active = true;
          pool[i].x = x + (Math.random() - 0.5) * 34;
          pool[i].y = y - 10;
          pool[i].vy = -78 - Math.random() * 24;
          pool[i].life = 0;
          pool[i].maxLife = 0.85;
          pool[i].text = text;
          pool[i].color = color;
          pool[i].scale = scale;
          break;
        }
      }
    };

    const triggerBugExplosion = () => {
      const bug = bugRef.current;
      bug.active = false;
      const bounty = callbacksRef.current.onBugZap();
      spawnParticles(bug.x, bug.y, 30, '#fb7185');
      spawnParticles(bug.x, bug.y, 14, '#fde047');
      spawnFloatingText(bug.x, bug.y, `BUG ZAPPED +${formatTokens(bounty)}!`, '#fb7185', 1.25);
      simRef.current.shake = Math.max(simRef.current.shake, 9);
      simRef.current.hitstop = 0.03;
    };

    useImperativeHandle(ref, () => ({
      triggerCorePulse(amount: number, isCrit: boolean) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const { cx, cy } = getCoreCenter(rect.width, rect.height);

        simRef.current.coreScaleX = isCrit ? 1.24 : 1.13;
        simRef.current.coreScaleY = isCrit ? 0.82 : 0.89;
        simRef.current.coreFlash = isCrit ? 1 : 0.52;
        if (isCrit) {
          simRef.current.shake = Math.max(simRef.current.shake, 7);
          simRef.current.hitstop = 0.032;
        }

        const color = simRef.current.isFever
          ? '#fbbf24'
          : isCrit
          ? '#f472b6'
          : simRef.current.stageColor;

        spawnParticles(cx, cy, isCrit ? 22 : 10, color);
        spawnFloatingText(
          cx,
          cy - 30,
          `${isCrit ? 'CRIT! ' : ''}+${formatTokens(amount)}`,
          color,
          isCrit ? 1.25 : 1
        );
      },
      triggerShake(intensity: number) {
        simRef.current.shake = Math.max(simRef.current.shake, intensity);
      },
      zapActiveBug() {
        if (bugRef.current.active && bugRef.current.telegraph <= 0) {
          triggerBugExplosion();
          return true;
        }
        return false;
      },
    }));

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!simRef.current.isPlaying) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      // 1. Check Bug Drone first (active target encounter)
      const bug = bugRef.current;
      if (bug.active && bug.telegraph <= 0) {
        const dx = px - bug.x;
        const dy = py - bug.y;
        if (dx * dx + dy * dy <= (bug.radius + 22) * (bug.radius + 22)) {
          triggerBugExplosion();
          return;
        }
      }

      // 2. Check Golden VC Packet
      const g = goldenRef.current;
      if (g.active) {
        const dx = px - g.x;
        const dy = py - g.y;
        if (dx * dx + dy * dy <= (g.radius + 20) * (g.radius + 20)) {
          g.active = false;
          const bonus = callbacksRef.current.onGoldenCatch();
          spawnParticles(g.x, g.y, 28, '#fbbf24');
          spawnFloatingText(g.x, g.y, `VC$ +${formatTokens(bonus)}!`, '#fbbf24', 1.3);
          simRef.current.shake = Math.max(simRef.current.shake, 8);
          return;
        }
      }

      // 3. Otherwise click AI Core
      const { amount, isCrit } = callbacksRef.current.onCoreClick(e.clientX, e.clientY);
      simRef.current.coreScaleX = isCrit ? 1.24 : 1.13;
      simRef.current.coreScaleY = isCrit ? 0.82 : 0.89;
      simRef.current.coreFlash = isCrit ? 1 : 0.52;
      if (isCrit) {
        simRef.current.shake = Math.max(simRef.current.shake, 7);
        simRef.current.hitstop = 0.032;
      }

      const color = simRef.current.isFever
        ? '#fbbf24'
        : isCrit
        ? '#f472b6'
        : simRef.current.stageColor;

      spawnParticles(px, py, isCrit ? 20 : 10, color);
      spawnFloatingText(
        px,
        py - 12,
        `${isCrit ? 'CRIT! ' : ''}+${formatTokens(amount)}`,
        color,
        isCrit ? 1.25 : 1
      );
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animId = 0;
      let lastTime = performance.now();

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      resize();
      window.addEventListener('resize', resize);

      const drawPolygon = (sides: number, r: number, rot: number) => {
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = rot + (i * Math.PI * 2) / sides;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };

      const loop = (now: number) => {
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(rawDt, 0.05);

        const s = simRef.current;
        const w = window.innerWidth;
        const h = window.innerHeight;

        if (s.hitstop > 0) {
          s.hitstop -= dt;
          animId = requestAnimationFrame(loop);
          return;
        }

        // Update simulation (frame-rate independent)
        const speedMult = s.isFever ? 2.6 : 1 + s.overclockRatio * 0.9;
        s.rotation += dt * 0.55 * speedMult;
        s.coreScaleX += (1 - s.coreScaleX) * Math.min(1, dt * 14);
        s.coreScaleY += (1 - s.coreScaleY) * Math.min(1, dt * 14);
        s.coreFlash = Math.max(0, s.coreFlash - dt * 4.5);
        s.shake = Math.max(0, s.shake - dt * 28);

        const { cx, cy, radius } = getCoreCenter(w, h);

        // Background data streams
        const streams = streamsRef.current;
        for (let i = 0; i < streams.length; i++) {
          const st = streams[i];
          st.y -= st.speed * (s.isFever ? 2.4 : 1) * dt;
          if (st.y < -st.len) {
            st.y = h + st.len;
            st.xRatio = Math.random();
          }
        }

        // Golden VC Packet spawner
        if (s.isPlaying) {
          const g = goldenRef.current;
          if (!g.active) {
            s.goldenTimer -= dt;
            if (s.goldenTimer <= 0) {
              g.active = true;
              const fromLeft = Math.random() > 0.5;
              g.x = fromLeft ? -40 : w + 40;
              g.y = h * (0.22 + Math.random() * 0.44);
              g.vx = (fromLeft ? 1 : -1) * (125 + Math.random() * 70);
              g.vy = (Math.random() - 0.5) * 40;
              s.goldenTimer = 16 + Math.random() * 14;
            }
          } else {
            g.x += g.vx * dt;
            g.y += g.vy * dt;
            g.pulse += dt * 6;
            if (g.x < -80 || g.x > w + 80) {
              g.active = false;
            }
          }

          // Rogue Bug Drone spawner (only after player has some momentum)
          const bug = bugRef.current;
          if (!bug.active) {
            s.bugTimer -= dt;
            if (s.bugTimer <= 0) {
              bug.active = true;
              bug.telegraph = 1.3; // Clear 1.3s windup telegraph
              bug.life = 9.5;
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.min(w, h) * 0.32;
              bug.x = Math.max(60, Math.min(w - 60, cx + Math.cos(angle) * dist));
              bug.y = Math.max(95, Math.min(h - 95, cy + Math.sin(angle) * dist));
              bug.vx = (Math.random() - 0.5) * 90;
              bug.vy = (Math.random() - 0.5) * 90;
              bug.wobble = 0;
              s.bugTimer = 18 + Math.random() * 14;
              callbacksRef.current.onBugSpawn?.();
            }
          } else {
            bug.wobble += dt * 7;
            if (bug.telegraph > 0) {
              bug.telegraph = Math.max(0, bug.telegraph - dt);
            } else {
              bug.life -= dt;
              bug.x += bug.vx * dt;
              bug.y += bug.vy * dt;
              if (bug.x < 50 || bug.x > w - 50) bug.vx *= -1;
              if (bug.y < 90 || bug.y > h - 90) bug.vy *= -1;
              if (bug.life <= 0) {
                bug.active = false;
              }
            }
          }
        }

        // Update particles
        const particles = particlesRef.current;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!p.active) continue;
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.active = false;
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.96;
          p.vy *= 0.96;
        }

        // Update floating texts
        const texts = textsRef.current;
        for (let i = 0; i < texts.length; i++) {
          const t = texts[i];
          if (!t.active) continue;
          t.life += dt;
          if (t.life >= t.maxLife) {
            t.active = false;
            continue;
          }
          t.y += t.vy * dt;
        }

        // RENDER
        ctx.save();
        if (s.shake > 0.2) {
          const sx = (Math.random() - 0.5) * s.shake * 2;
          const sy = (Math.random() - 0.5) * s.shake * 2;
          ctx.translate(sx, sy);
        }

        // Deep background
        ctx.fillStyle = '#070b14';
        ctx.fillRect(0, 0, w, h);

        const primary = s.isFever ? '#fbbf24' : s.stageColor;
        const secondary = s.isFever ? '#f97316' : '#34d399';

        // Cyber perspective grid
        ctx.strokeStyle = s.isFever ? 'rgba(251, 191, 36, 0.08)' : 'rgba(34, 211, 238, 0.055)';
        ctx.lineWidth = 1;
        const gridSize = 48;
        const offset = (now * 0.015) % gridSize;
        ctx.beginPath();
        for (let x = offset; x < w; x += gridSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        for (let y = offset; y < h; y += gridSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();

        // Data streams
        for (let i = 0; i < streams.length; i++) {
          const st = streams[i];
          const sx = st.xRatio * w;
          ctx.strokeStyle = primary;
          ctx.globalAlpha = st.alpha;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(sx, st.y);
          ctx.lineTo(sx, st.y + st.len);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Ambient core aura
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 2.3);
        grad.addColorStop(0, s.isFever ? 'rgba(251, 191, 36, 0.34)' : 'rgba(34, 211, 238, 0.22)');
        grad.addColorStop(1, 'rgba(7, 11, 20, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 2.3, 0, Math.PI * 2);
        ctx.fill();

        // Overclock Combo Ring (outer gauge)
        if (s.overclockRatio > 0.01) {
          ctx.strokeStyle = s.overclockRatio > 0.7 ? '#f472b6' : '#38bdf8';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            radius * 1.56,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * s.overclockRatio
          );
          ctx.stroke();
        }

        // Orbiting Compute Satellites (1 per unlocked generator tier)
        const satCount = Math.min(8, s.activeTiersCount);
        for (let i = 0; i < satCount; i++) {
          const orbitR = radius * (1.42 + (i % 2) * 0.24);
          const angle = s.rotation * (i % 2 === 0 ? 1.1 : -0.85) + (i * Math.PI * 2) / Math.max(1, satCount);
          const sx = cx + Math.cos(angle) * orbitR;
          const sy = cy + Math.sin(angle) * orbitR;
          ctx.fillStyle = i % 2 === 0 ? primary : secondary;
          ctx.beginPath();
          ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Neural Core Assembly
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s.coreScaleX, s.coreScaleY);

        // Outer orbital ring
        ctx.save();
        ctx.rotate(s.rotation);
        ctx.strokeStyle = primary;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Inner orbital ring
        ctx.save();
        ctx.rotate(-s.rotation * 1.45);
        ctx.strokeStyle = secondary;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);

        // Stage-Evolved Geometric Shield
        if (s.stageIndex >= 1) {
          ctx.strokeStyle = primary;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 1.8;
          drawPolygon(s.stageIndex >= 3 ? 8 : 6, radius * 0.98, s.rotation * 0.7);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Core Body
        ctx.fillStyle = s.coreFlash > 0.1 ? '#ffffff' : '#0b1222';
        ctx.strokeStyle = primary;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.82, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Stage-Evolved Inner Lattice
        if (s.stageIndex >= 2) {
          ctx.strokeStyle = secondary;
          ctx.lineWidth = 1.5;
          drawPolygon(s.stageIndex >= 4 ? 5 : 3, radius * 0.58, -s.rotation * 1.3);
          ctx.stroke();
        }

        // Inner Neural Plasma Orb
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.arc(0, 0, radius * (0.3 + Math.sin(now * 0.005) * 0.03), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Golden VC Packet
        const g = goldenRef.current;
        if (g.active && s.isPlaying) {
          const pulseR = g.radius + Math.sin(g.pulse) * 4;
          ctx.save();
          ctx.translate(g.x, g.y);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.24)';
          ctx.beginPath();
          ctx.arc(0, 0, pulseR * 1.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fbbf24';
          ctx.strokeStyle = '#fef3c7';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('VC$', 0, 1);
          ctx.restore();
        }

        // Rogue Bug Drone (with 1.3s windup telegraph)
        const bug = bugRef.current;
        if (bug.active && s.isPlaying) {
          ctx.save();
          ctx.translate(bug.x, bug.y);
          if (bug.telegraph > 0) {
            const tRatio = 1 - bug.telegraph / 1.3;
            ctx.strokeStyle = '#fb7185';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, bug.radius * (2.2 - tRatio), 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#fb7185';
            ctx.font = 'bold 11px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.fillText('!', 0, 4);
          } else {
            const pulse = 1 + Math.sin(bug.wobble) * 0.12;
            ctx.scale(pulse, pulse);
            ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
            ctx.beginPath();
            ctx.arc(0, 0, bug.radius * 1.45, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#e11d48';
            ctx.strokeStyle = '#fda4af';
            ctx.lineWidth = 2.2;
            drawPolygon(6, bug.radius, bug.wobble * 0.3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#fff1f2';
            ctx.font = 'bold 10px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('BUG', 0, 1);
          }
          ctx.restore();
        }

        // Particles
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!p.active) continue;
          const alpha = 1 - p.life / p.maxLife;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Floating texts
        for (let i = 0; i < texts.length; i++) {
          const t = texts[i];
          if (!t.active) continue;
          const alpha = 1 - t.life / t.maxLife;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = t.color;
          ctx.font = `700 ${Math.round(16 * t.scale)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(t.text, t.x, t.y);
        }
        ctx.globalAlpha = 1;

        ctx.restore();
        animId = requestAnimationFrame(loop);
      };

      animId = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="fixed inset-0 block w-full h-full cursor-pointer select-none touch-none"
      />
    );
  }
);

GameCanvas.displayName = 'GameCanvas';
