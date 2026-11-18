import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  MachineStep,
  buildFormulaString,
  evaluatePipelineNumeric,
  formatNumber,
  getNumericSeed,
  hasVariableInSteps,
} from '../utils/mathEngine';

interface GraphModalProps {
  isOpen: boolean;
  steps: MachineStep[];
  seedInput: string;
  seedExponent: string;
  activeXValue: string;
  onClose: () => void;
}

const MIN = -10;
const MAX = 10;
const SVG_SIZE = 440;
const PAD = 38;
const PLOT_SIZE = SVG_SIZE - PAD * 2;

function toSvgX(x: number): number {
  return PAD + ((x - MIN) / (MAX - MIN)) * PLOT_SIZE;
}

function toSvgY(y: number): number {
  return PAD + ((MAX - y) / (MAX - MIN)) * PLOT_SIZE;
}

export const GraphModal: React.FC<GraphModalProps> = ({
  isOpen,
  steps,
  seedInput,
  seedExponent,
  activeXValue,
  onClose,
}) => {
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number | null } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const formula = useMemo(
    () => buildFormulaString(steps, seedInput, seedExponent),
    [steps, seedInput, seedExponent],
  );
  const startVal = useMemo(
    () => getNumericSeed(steps, seedInput, seedExponent),
    [steps, seedInput, seedExponent],
  );
  const expForX = startVal !== undefined ? '1' : seedExponent;
  const usesVarStep = useMemo(() => hasVariableInSteps(steps), [steps]);

  // Build smooth SVG path segments with discontinuity detection (e.g. 1/x asymptotes)
  const curvePaths = useMemo(() => {
    const samples = 900;
    const paths: string[] = [];
    let currentSegment: string[] = [];
    let prevY: number | null = null;
    let prevX: number | null = null;

    for (let i = 0; i <= samples; i++) {
      const x = MIN + (i / samples) * (MAX - MIN);
      const y = evaluatePipelineNumeric(steps, x, {
        startVal,
        inputExponent: expForX,
      });

      if (y === null || !Number.isFinite(y) || Math.abs(y) > 40) {
        if (currentSegment.length > 1) {
          paths.push(currentSegment.join(' '));
        }
        currentSegment = [];
        prevY = null;
        prevX = null;
        continue;
      }

      // Detect vertical asymptotes or massive slope jumps (e.g. -6 to +6 across x=0)
      if (prevY !== null && prevX !== null) {
        const dy = Math.abs(y - prevY);
        const dx = x - prevX;
        const signFlipJump = prevY * y < 0 && dy > 6;
        if (signFlipJump || dy / dx > 180) {
          if (currentSegment.length > 1) {
            paths.push(currentSegment.join(' '));
          }
          currentSegment = [];
        }
      }

      const sx = toSvgX(x).toFixed(2);
      const sy = toSvgY(y).toFixed(2);
      currentSegment.push(currentSegment.length === 0 ? `M ${sx} ${sy}` : `L ${sx} ${sy}`);
      prevY = y;
      prevX = x;
    }

    if (currentSegment.length > 1) {
      paths.push(currentSegment.join(' '));
    }
    return paths;
  }, [steps, startVal, expForX]);

  // Integer lattice points (x, y) inside [-10, 10] x [-10, 10]
  const integerDots = useMemo(() => {
    const dots: Array<{ x: number; y: number }> = [];
    for (let x = MIN; x <= MAX; x++) {
      const y = evaluatePipelineNumeric(steps, x, {
        startVal,
        inputExponent: expForX,
      });
      if (y !== null && y >= MIN && y <= MAX) {
        const nearestInt = Math.round(y);
        if (Math.abs(y - nearestInt) < 1e-6) {
          dots.push({ x, y: nearestInt });
        }
      }
    }
    return dots;
  }, [steps, startVal, expForX]);

  // Current active input point if numeric and in range
  const activePoint = useMemo(() => {
    if (usesVarStep || activeXValue === 'x') return null;
    const x = parseFloat(activeXValue);
    if (!Number.isFinite(x) || x < MIN || x > MAX) return null;
    const y = evaluatePipelineNumeric(steps, x, {
      startVal,
      inputExponent: expForX,
    });
    if (y === null || y < MIN || y > MAX) return null;
    return { x, y };
  }, [steps, activeXValue, startVal, expForX, usesVarStep]);

  if (!isOpen) return null;

  const ticks = Array.from({ length: 21 }, (_, idx) => idx - 10);
  const originX = toSvgX(0);
  const originY = toSvgY(0);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * SVG_SIZE;
    const xMath = MIN + ((px - PAD) / PLOT_SIZE) * (MAX - MIN);
    if (xMath < MIN || xMath > MAX) {
      setHoverCoord(null);
      return;
    }
    const snappedX = Math.round(xMath * 10) / 10;
    const yMath = evaluatePipelineNumeric(steps, snappedX, {
      startVal,
      inputExponent: expForX,
    });
    setHoverCoord({ x: snappedX, y: yMath });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="graph-modal-title"
    >
      <div
        className="w-full max-w-[540px] overflow-hidden rounded-[26px] bg-[#f8fafc] shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-[#f0f7f7] px-6 py-3.5 border-b border-slate-200/80">
          <div className="w-8" />
          <h2 id="graph-modal-title" className="text-xl font-extrabold text-[#0f766e]">
            X–Y Graph
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close graph"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/80 text-slate-700 transition-colors hover:bg-slate-300 cursor-pointer"
          >
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Formula Banner */}
        <div className="flex items-center justify-center gap-3 bg-white px-6 py-4 shadow-2xs">
          <span className="text-xl font-extrabold text-slate-900">y =</span>
          <div className="min-w-[160px] max-w-[340px] truncate rounded-2xl border-2 border-[#60a5fa] bg-[#eff6ff] px-5 py-2 text-center text-xl font-bold text-[#1d4ed8]">
            {formula}
          </div>
        </div>

        {/* Plot Card */}
        <div className="flex flex-col items-center p-5">
          <div className="w-full max-w-[440px] rounded-2xl border border-slate-300 bg-white p-2 shadow-xs">
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="w-full h-auto select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverCoord(null)}
            >
              <defs>
                <clipPath id="xy-plot-clip">
                  <rect x={PAD} y={PAD} width={PLOT_SIZE} height={PLOT_SIZE} />
                </clipPath>
              </defs>

              {/* Gridlines */}
              {ticks.map((t) => {
                const gx = toSvgX(t);
                const gy = toSvgY(t);
                return (
                  <g key={`grid-${t}`}>
                    <line
                      x1={gx}
                      y1={PAD}
                      x2={gx}
                      y2={PAD + PLOT_SIZE}
                      stroke="#e2e8f0"
                      strokeWidth={1.1}
                    />
                    <line
                      x1={PAD}
                      y1={gy}
                      x2={PAD + PLOT_SIZE}
                      y2={gy}
                      stroke="#e2e8f0"
                      strokeWidth={1.1}
                    />
                  </g>
                );
              })}

              {/* Axes */}
              <line
                x1={PAD - 4}
                y1={originY}
                x2={PAD + PLOT_SIZE + 10}
                y2={originY}
                stroke="#0f172a"
                strokeWidth={2.5}
              />
              <polygon
                points={`${PAD + PLOT_SIZE + 15},${originY} ${PAD + PLOT_SIZE + 4},${originY - 5} ${PAD + PLOT_SIZE + 4},${originY + 5}`}
                fill="#0f172a"
              />
              <text
                x={PAD + PLOT_SIZE + 18}
                y={originY + 4}
                fontSize="13"
                fontWeight="700"
                fill="#0f172a"
              >
                x
              </text>

              <line
                x1={originX}
                y1={PAD + PLOT_SIZE + 4}
                x2={originX}
                y2={PAD - 10}
                stroke="#0f172a"
                strokeWidth={2.5}
              />
              <polygon
                points={`${originX},${PAD - 14} ${originX - 4.5},${PAD - 4} ${originX + 4.5},${PAD - 4}`}
                fill="#0f172a"
              />
              <text
                x={originX}
                y={PAD - 19}
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="#0f172a"
              >
                y
              </text>

              {/* Tick Labels */}
              {ticks.map((t) => {
                if (t === 0) return null;
                return (
                  <g key={`label-${t}`}>
                    <text
                      x={toSvgX(t)}
                      y={originY + 13}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="500"
                      fill="#475569"
                    >
                      {t}
                    </text>
                    <text
                      x={originX - 7}
                      y={toSvgY(t) + 3.5}
                      textAnchor="end"
                      fontSize="9.5"
                      fontWeight="500"
                      fill="#475569"
                    >
                      {t}
                    </text>
                  </g>
                );
              })}

              {/* Plotted Function Curve */}
              <g clipPath="url(#xy-plot-clip)">
                {curvePaths.map((d, idx) => (
                  <path
                    key={idx}
                    d={d}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}

                {/* Integer lattice dots */}
                {integerDots.map((pt) => (
                  <circle
                    key={`dot-${pt.x}-${pt.y}`}
                    cx={toSvgX(pt.x)}
                    cy={toSvgY(pt.y)}
                    r={4.5}
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                ))}

                {/* Active Input Point Highlight */}
                {activePoint && (
                  <circle
                    cx={toSvgX(activePoint.x)}
                    cy={toSvgY(activePoint.y)}
                    r={6}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                )}

                {/* Hover Indicator */}
                {hoverCoord && hoverCoord.y !== null && hoverCoord.y >= MIN && hoverCoord.y <= MAX && (
                  <g>
                    <line
                      x1={toSvgX(hoverCoord.x)}
                      y1={PAD}
                      x2={toSvgX(hoverCoord.x)}
                      y2={PAD + PLOT_SIZE}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />
                    <circle
                      cx={toSvgX(hoverCoord.x)}
                      cy={toSvgY(hoverCoord.y)}
                      r={5}
                      fill="#1d4ed8"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  </g>
                )}
              </g>
            </svg>
          </div>

          {/* Coordinate Readout */}
          <div className="mt-3 flex h-6 items-center justify-center text-xs font-medium text-slate-600">
            {hoverCoord ? (
              <span className="font-mono-tabular">
                x = {formatNumber(hoverCoord.x)}, y ={' '}
                {hoverCoord.y === null ? 'undefined' : formatNumber(hoverCoord.y)}
              </span>
            ) : (
              <span>Move cursor across the graph to inspect coordinates</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
