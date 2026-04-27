import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';

interface VisualizationProps {
  analyser: AnalyserNode | null;
}

const PALETTES: Record<string, [string, string]> = {
  park: ['#3A5A47', '#A9C28F'],
  forest: ['#2D4A35', '#85A874'],
  coast: ['#3D7C8B', '#B7D4DC'],
  water: ['#1F4E69', '#9CC4D7'],
  urban: ['#B85A2E', '#F2C572'],
  industrial: ['#5C5751', '#C7B395'],
  residential: ['#6B6451', '#D6C2A0'],
  rural: ['#8E7748', '#E5D2A1'],
  transit: ['#3A364E', '#A39FBE'],
  unknown: ['#564F4A', '#B8A992'],
};

const PHASE_TINTS: Record<string, [number, number, number]> = {
  dawn: [0.92, 0.80, 0.68],
  morning: [0.95, 0.92, 0.82],
  noon: [1.0, 1.0, 0.94],
  afternoon: [0.96, 0.92, 0.78],
  goldenHour: [0.95, 0.74, 0.50],
  dusk: [0.62, 0.50, 0.66],
  night: [0.30, 0.34, 0.55],
  witchingHour: [0.18, 0.20, 0.40],
};

export function Visualization({ analyser }: VisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sv = useStore((s) => s.stateVector);

  useEffect(() => {
    if (!analyser) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bins = analyser.frequencyBinCount;
    const freq = new Uint8Array(bins);
    const time = new Uint8Array(analyser.fftSize);

    let raf = 0;
    let phase = 0;

    const resize = (): void => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (): void => {
      if (document.hidden) {
        raf = window.requestAnimationFrame(loop);
        return;
      }
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(time);

      let sumSq = 0;
      for (let i = 0; i < time.length; i++) {
        const v = (time[i]! - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / time.length);

      let weighted = 0;
      let totalMag = 0;
      for (let i = 0; i < freq.length; i++) {
        const m = freq[i]!;
        weighted += m * i;
        totalMag += m;
      }
      const centroidNorm = totalMag > 0 ? weighted / totalMag / freq.length : 0;

      const placeType = sv?.location?.placeType ?? 'unknown';
      const palette = PALETTES[placeType] ?? PALETTES.unknown!;
      const phaseTint = PHASE_TINTS[sv?.time?.phase ?? 'afternoon'] ?? [1, 1, 1];

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.28;
      const energy = Math.min(1, rms * 2.2);

      ctx.fillStyle = `rgba(${Math.floor(244 * phaseTint[0])}, ${Math.floor(239 * phaseTint[1])}, ${Math.floor(227 * phaseTint[2])}, 0.18)`;
      ctx.fillRect(0, 0, w, h);

      const grad = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, baseR * (1.4 + energy * 0.7));
      grad.addColorStop(0, palette[1]);
      grad.addColorStop(1, palette[0]);

      ctx.beginPath();
      const points = 96;
      for (let i = 0; i <= points; i++) {
        const t = (i / points) * Math.PI * 2;
        const bin = Math.floor((i / points) * (bins / 4));
        const lobe = (freq[bin]! ?? 0) / 255;
        const wobble = Math.sin(phase * 0.018 + t * 3) * 0.04;
        const r = baseR * (0.9 + 0.3 * energy + 0.55 * lobe * (0.6 + 0.4 * centroidNorm) + wobble);
        const x = cx + Math.cos(t) * r;
        const y = cy + Math.sin(t) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(27,27,25,0.18)';
      ctx.lineWidth = 1.25 * dpr;
      ctx.stroke();

      phase += 1;
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [analyser, sv]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-10 h-full w-full" />;
}
