import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
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

export interface GameCanvasHandle {
  triggerCorePulse: (amount: number, isCrit: boolean) => void;
  triggerShake: (intensity: number) => void;
}

interface GameCanvasProps {
  isPlaying: boolean;
  isFever: boolean;
  tps: number;
  onCoreClick: (clientX?: number, clientY?: number) => { amount: number; isCrit: boolean };
  onGoldenCatch: (bonus: number) => void;
}

const PARTICLE_POOL_SIZE = 160;
const TEXT_POOL_SIZE = 32;

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  ({ isPlaying, isFever, tps, onCoreClick, onGoldenCatch }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Mutable simulation state (never triggers React re-renders)
    const simRef = useRef({
      isPlaying,
      isFever,
      tps,
      coreScaleX: 1,
      coreScaleY: 1,
      coreFlash: 0,
      shake: 0,
      rotation: 0,
      hitstop: 0,
      goldenTimer: 12,
    });

    simRef.current.isPlaying = isPlaying;
    simRef.current.isFever = isFever;
    simRef.current.tps = tps;

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
        maxLife: 0.8,
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
      radius: 24,
      pulse: 0,
    });

    const getCoreCenter = (width: number, height: number) => {
      const isDesktop = width >= 900;
      return {
        cx: isDesktop ? width * 0.36 : width * 0.5,
        cy: isDesktop ? height * 0.52 : height * 0.42,
        radius: Math.min(width, height) * (isDesktop ? 0.14 : 0.16),
      };
    };

    const spawnParticles = (x: number, y: number, count: number, color: string) => {
      const pool = particlesRef.current;
      let spawned = 0;
      for (let i = 0; i < pool.length && spawned < count; i++) {
        if (!pool[i].active) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 90 + Math.random() * 240;
          pool[i].active = true;
          pool[i].x = x;
          pool[i].y = y;
          pool[i].vx = Math.cos(angle) * speed;
          pool[i].vy = Math.sin(angle) * speed;
          pool[i].life = 0;
          pool[i].maxLife = 0.45 + Math.random() * 0.35;
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
          pool[i].x = x + (Math.random() - 0.5) * 36;
          pool[i].y = y - 10;
          pool[i].vy = -75 - Math.random() * 25;
          pool[i].life = 0;
          pool[i].maxLife = 0.85;
          pool[i].text = text;
          pool[i].color = color;
          pool[i].scale = scale;
          break;
        }
      }
    };

    useImperativeHandle(ref, () => ({
      triggerCorePulse(amount: number, isCrit: boolean) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const { cx, cy } = getCoreCenter(rect.width, rect.height);

        simRef.current.coreScaleX = isCrit ? 1.24 : 1.14;
        simRef.current.coreScaleY = isCrit ? 0.82 : 0.88;
        simRef.current.coreFlash = isCrit ? 1 : 0.55;
        if (isCrit) {
          simRef.current.shake = Math.max(simRef.current.shake, 7);
          simRef.current.hitstop = 0.035;
        }

        const color = simRef.current.isFever
          ? '#fbbf24'
          : isCrit
          ? '#f472b6'
          : '#22d3ee';

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
    }));

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!simRef.current.isPlaying) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      // Check Golden VC Packet first
      const g = goldenRef.current;
      if (g.active) {
        const dx = px - g.x;
        const dy = py - g.y;
        if (dx * dx + dy * dy <= (g.radius + 16) * (g.radius + 16)) {
          g.active = false;
          const bonus = Math.max(150, Math.floor(simRef.current.tps * 25));
          spawnParticles(g.x, g.y, 28, '#fbbf24');
          spawnFloatingText(g.x, g.y, `VC FUNDING +${formatTokens(bonus)}!`, '#fbbf24', 1.3);
          simRef.current.shake = 9;
          onGoldenCatch(bonus);
          return;
        }
      }

      // Otherwise click AI Core
      const { amount, isCrit } = onCoreClick(e.clientX, e.clientY);
      simRef.current.coreScaleX = isCrit ? 1.24 : 1.14;
      simRef.current.coreScaleY = isCrit ? 0.82 : 0.88;
      simRef.current.coreFlash = isCrit ? 1 : 0.55;
      if (isCrit) {
        simRef.current.shake = Math.max(simRef.current.shake, 7);
        simRef.current.hitstop = 0.035;
      }

      const color = simRef.current.isFever
        ? '#fbbf24'
        : isCrit
        ? '#f472b6'
        : '#22d3ee';

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

        // Update simulation
        s.rotation += dt * (s.isFever ? 1.8 : 0.55);
        s.coreScaleX += (1 - s.coreScaleX) * Math.min(1, dt * 14);
        s.coreScaleY += (1 - s.coreScaleY) * Math.min(1, dt * 14);
        s.coreFlash = Math.max(0, s.coreFlash - dt * 4.5);
        s.shake = Math.max(0, s.shake - dt * 28);

        // Golden VC Packet spawner
        if (s.isPlaying) {
          const g = goldenRef.current;
          if (!g.active) {
            s.goldenTimer -= dt;
            if (s.goldenTimer <= 0) {
              g.active = true;
              const fromLeft = Math.random() > 0.5;
              g.x = fromLeft ? -40 : w + 40;
              g.y = h * (0.22 + Math.random() * 0.45);
              g.vx = (fromLeft ? 1 : -1) * (120 + Math.random() * 70);
              g.vy = (Math.random() - 0.5) * 40;
              s.goldenTimer = 18 + Math.random() * 14;
            }
          } else {
            g.x += g.vx * dt;
            g.y += g.vy * dt;
            g.pulse += dt * 6;
            if (g.x < -80 || g.x > w + 80) {
              g.active = false;
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

        // Render
        ctx.save();
        if (s.shake > 0.2) {
          const sx = (Math.random() - 0.5) * s.shake * 2;
          const sy = (Math.random() - 0.5) * s.shake * 2;
          ctx.translate(sx, sy);
        }

        // Background
        ctx.fillStyle = '#070b14';
        ctx.fillRect(0, 0, w, h);

        // Subtle cyber grid
        ctx.strokeStyle = s.isFever ? 'rgba(251, 191, 36, 0.08)' : 'rgba(34, 211, 238, 0.06)';
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

        // AI Neural Core
        const { cx, cy, radius } = getCoreCenter(w, h);
        const primary = s.isFever ? '#fbbf24' : '#22d3ee';
        const secondary = s.isFever ? '#f97316' : '#34d399';

        // Outer ambient glow
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 2.1);
        grad.addColorStop(0, s.isFever ? 'rgba(251, 191, 36, 0.28)' : 'rgba(34, 211, 238, 0.22)');
        grad.addColorStop(1, 'rgba(7, 11, 20, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 2.1, 0, Math.PI * 2);
        ctx.fill();

        // Orbital rings
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s.coreScaleX, s.coreScaleY);

        ctx.rotate(s.rotation);
        ctx.strokeStyle = primary;
        ctx.lineWidth = 2;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
        ctx.stroke();

        ctx.rotate(-s.rotation * 2.2);
        ctx.strokeStyle = secondary;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Core hexagon / circle
        ctx.fillStyle = s.coreFlash > 0.1 ? '#ffffff' : '#0f172a';
        ctx.strokeStyle = primary;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner neural node
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.34, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Golden VC Packet
        const g = goldenRef.current;
        if (g.active && s.isPlaying) {
          const pulseR = g.radius + Math.sin(g.pulse) * 4;
          ctx.save();
          ctx.translate(g.x, g.y);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
          ctx.beginPath();
          ctx.arc(0, 0, pulseR * 1.45, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fbbf24';
          ctx.strokeStyle = '#fef3c7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('VC$', 0, 1);
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
    }, [onCoreClick, onGoldenCatch]);

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
