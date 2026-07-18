"use client";

import { useMemo } from "react";

// A generated, field-themed "cover" for a Papers card (Phase 17). Papers have no
// image, so instead of a photo the card shows a calm, abstract cover keyed to the
// paper's DISCIPLINE: a soft hue gradient + a faint field motif whose exact
// placement is seeded by the paper id (so each cover is subtly unique but stable).
//
// Theme-aware by construction: the hue is layered at low alpha over the card's
// paper/ink base, so the same cover reads in both light and "night library" dark.
// No external assets, no network, no licensing — it draws itself.

// Small deterministic PRNG (mulberry32) so a seed always yields the same cover.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Alpha as an 8-digit hex suffix (widely supported). a in 0..1.
function alpha(a: number): string {
  return Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");
}

function Motif({ motif, hue, seed }: { motif: string; hue: string; seed: number }) {
  const rand = useMemo(() => mulberry32(seed), [seed]);
  const stroke = `${hue}${alpha(0.5)}`;
  const fill = `${hue}${alpha(0.42)}`;
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 0.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const rint = (lo: number, hi: number) => lo + rand() * (hi - lo);

  let els: React.ReactNode = null;
  switch (motif) {
    case "graph": {
      const nodes = Array.from({ length: 7 }, () => ({ x: rint(12, 88), y: rint(12, 88) }));
      els = (
        <>
          {nodes.map((n, i) => {
            const m = nodes[(i + 1) % nodes.length];
            return <line key={`e${i}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} {...common} />;
          })}
          {nodes.map((n, i) => (
            <circle key={`n${i}`} cx={n.x} cy={n.y} r={rint(1.6, 3)} fill={fill} stroke="none" />
          ))}
        </>
      );
      break;
    }
    case "orbits": {
      const cx = rint(40, 60);
      const cy = rint(40, 60);
      els = (
        <>
          {[16, 27, 38].map((r, i) => {
            const a = rand() * Math.PI * 2;
            return (
              <g key={i}>
                <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.66} {...common} />
                <circle cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r * 0.66} r={2} fill={fill} stroke="none" />
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={2.4} fill={fill} stroke="none" />
        </>
      );
      break;
    }
    case "grid": {
      const dots = [];
      for (let x = 12; x <= 88; x += 15) for (let y = 12; y <= 88; y += 15) dots.push({ x, y });
      els = (
        <>
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={1.1} fill={fill} stroke="none" />
          ))}
          {[27, 57].map((y, i) => (
            <line key={`h${i}`} x1={6} y1={y + rint(-4, 4)} x2={94} y2={y + rint(-4, 4)} {...common} strokeWidth={0.5} />
          ))}
        </>
      );
      break;
    }
    case "cells": {
      const hex = (cx: number, cy: number, r: number) =>
        Array.from({ length: 6 }, (_, k) => {
          const a = (Math.PI / 3) * k - Math.PI / 6;
          return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
        }).join(" ");
      const cells = [];
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 4; col++) {
          const cx = 16 + col * 22 + (row % 2) * 11;
          const cy = 16 + row * 20;
          cells.push({ cx, cy });
        }
      els = cells.map((c, i) => <polygon key={i} points={hex(c.cx, c.cy, 9)} {...common} />);
      break;
    }
    case "curve": {
      const peak = rint(42, 58);
      const pts = [];
      for (let x = 8; x <= 92; x += 2) {
        const y = 82 - 58 * Math.exp(-((x - peak) ** 2) / 320);
        pts.push(`${x},${y.toFixed(1)}`);
      }
      els = (
        <>
          <line x1={6} y1={82} x2={94} y2={82} {...common} strokeWidth={0.5} />
          <polyline points={pts.join(" ")} {...common} strokeWidth={1} />
          {[peak - 20, peak, peak + 20].map((x, i) => (
            <line key={i} x1={x} y1={82} x2={x} y2={78} {...common} strokeWidth={0.5} />
          ))}
        </>
      );
      break;
    }
    case "trend": {
      els = [0, 1, 2].map((k) => {
        const base = 70 - k * 6;
        let x = 8;
        let y = base + rint(-4, 6);
        const pts = [`${x},${y}`];
        while (x < 92) {
          x += rint(8, 16);
          y = Math.max(14, y - rint(2, 12));
          pts.push(`${Math.min(x, 92)},${y.toFixed(1)}`);
        }
        return <polyline key={k} points={pts.join(" ")} {...common} strokeWidth={k === 0 ? 1 : 0.6} />;
      });
      break;
    }
    case "wave": {
      els = [0, 1].map((k) => {
        const amp = 10 - k * 3;
        const phase = rand() * Math.PI * 2;
        const midY = 40 + k * 18;
        const pts = [];
        for (let x = 6; x <= 94; x += 2) {
          const y = midY + amp * Math.sin((x / 12) + phase);
          pts.push(`${x},${y.toFixed(1)}`);
        }
        return <polyline key={k} points={pts.join(" ")} {...common} strokeWidth={k === 0 ? 1 : 0.6} />;
      });
      break;
    }
    case "bars":
    default: {
      const bars = Array.from({ length: 11 }, (_, i) => ({
        x: 10 + i * 7.2,
        h: rint(10, 56),
      }));
      els = (
        <>
          <line x1={6} y1={82} x2={94} y2={82} {...common} strokeWidth={0.5} />
          {bars.map((b, i) => (
            <line key={i} x1={b.x} y1={82} x2={b.x} y2={82 - b.h} {...common} strokeWidth={2.4} />
          ))}
        </>
      );
      break;
    }
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {els}
    </svg>
  );
}

export function PaperCover({
  cover,
  label,
}: {
  cover: { hue: string; motif: string; seed: number };
  label?: string;
}) {
  const { hue, motif, seed } = cover;
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(140deg, ${hue}2e, ${hue}0f 55%, ${hue}05)`,
      }}
    >
      <Motif motif={motif} hue={hue} seed={seed} />
      {label && (
        <span
          className="relative z-[1] rounded-full px-3 py-1 text-xs font-medium uppercase tracking-widest"
          style={{ color: `${hue}`, backgroundColor: `${hue}1a` }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
