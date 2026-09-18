import { useEffect, useRef } from 'react';

const NODE_COUNT = 54;
const LINK_DISTANCE = 165;
const POINTER_RADIUS = 190;

const seeded = (index, salt = 0) => {
  const x = Math.sin((index + 1) * 9283.133 + salt * 77.17) * 43758.5453;
  return x - Math.floor(x);
};

export default function NeuralBackdrop({ muted = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: -9999, y: -9999, active: false };
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes = [];
    let links = [];

    const build = () => {
      const cols = 9;
      const rows = 6;
      nodes = Array.from({ length: NODE_COUNT }, (_, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols) % rows;
        const cellW = width / Math.max(cols - 1, 1);
        const cellH = height / Math.max(rows - 1, 1);
        return {
          bx: col * cellW + (seeded(index, 1) - 0.5) * Math.min(110, cellW * 0.7),
          by: row * cellH + (seeded(index, 2) - 0.5) * Math.min(95, cellH * 0.7),
          phase: seeded(index, 3) * Math.PI * 2,
          speed: 0.45 + seeded(index, 4) * 0.7,
          radius: 1.1 + seeded(index, 5) * 1.2,
        };
      });

      links = [];
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const dx = nodes[i].bx - nodes[j].bx;
          const dy = nodes[i].by - nodes[j].by;
          const distance = Math.hypot(dx, dy);
          if (distance < LINK_DISTANCE && seeded(i * 59 + j, 7) > 0.36) {
            links.push([i, j, distance]);
          }
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    const onPointerMove = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };

    const render = (time) => {
      ctx.clearRect(0, 0, width, height);

      const rendered = nodes.map(node => {
        const breath = reduceMotion ? 0 : Math.sin(time * 0.00055 * node.speed + node.phase);
        let x = node.bx + breath * 3;
        let y = node.by + breath * 9;
        let influence = 0;

        if (pointer.active) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.hypot(dx, dy);
          influence = Math.max(0, 1 - distance / POINTER_RADIUS);

          if (influence > 0) {
            const safe = Math.max(distance, 1);
            x += (dx / safe) * influence * 10;
            y -= influence * 34;
          }
        }

        return { ...node, x, y, influence };
      });

      ctx.lineWidth = 1;
      links.forEach(([aIndex, bIndex, baseDistance]) => {
        const a = rendered[aIndex];
        const b = rendered[bIndex];
        const proximity = Math.max(a.influence, b.influence);
        const alpha = (muted ? 0.045 : 0.075) + proximity * 0.22;
        const red = Math.round(92 + proximity * 147);
        ctx.strokeStyle = `rgba(${red}, 28, 36, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        if (!reduceMotion && proximity > 0.14) {
          const pulse = ((time * 0.00016 + baseDistance * 0.004) % 1);
          const px = a.x + (b.x - a.x) * pulse;
          const py = a.y + (b.y - a.y) * pulse;
          ctx.fillStyle = `rgba(239, 68, 68, ${0.18 + proximity * 0.45})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.2 + proximity, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      rendered.forEach(node => {
        const breathe = reduceMotion ? 0 : (Math.sin(time * 0.0012 * node.speed + node.phase) + 1) * 0.5;
        const radius = node.radius + breathe * 0.55 + node.influence * 2.3;
        const alpha = (muted ? 0.16 : 0.24) + node.influence * 0.66;

        if (node.influence > 0.08) {
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 16 + node.influence * 18);
          glow.addColorStop(0, `rgba(239, 68, 68, ${0.15 + node.influence * 0.24})`);
          glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 20 + node.influence * 14, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      if (!reduceMotion) frame = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onPointerLeave);

    if (reduceMotion) {
      render(0);
    } else {
      frame = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('mouseleave', onPointerLeave);
    };
  }, [muted]);

  return (
    <div className={`neural-backdrop ${muted ? 'neural-backdrop-muted' : ''}`} aria-hidden="true">
      <canvas ref={canvasRef} className="neural-canvas" />
      <div className="neural-ambient" />
      <div className="neural-grid" />
      <div className="neural-vignette" />
    </div>
  );
}
