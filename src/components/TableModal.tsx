import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  MachineStep,
  buildFormulaString,
  evaluatePipelineNumeric,
  formatNumber,
  getNumericSeed,
} from '../utils/mathEngine';

interface TableModalProps {
  isOpen: boolean;
  steps: MachineStep[];
  seedInput: string;
  seedExponent: string;
  activeXValue: string;
  onSelectX: (xVal: string) => void;
  onClose: () => void;
}

const TABLE_X_VALUES = Array.from({ length: 21 }, (_, idx) => idx - 10);

export const TableModal: React.FC<TableModalProps> = ({
  isOpen,
  steps,
  seedInput,
  seedExponent,
  activeXValue,
  onSelectX,
  onClose,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      // Scroll so -5..4 sits cleanly in the viewport like the screenshot
      const rowHeight = 45;
      scrollContainerRef.current.scrollTop = 5 * rowHeight;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formula = buildFormulaString(steps, seedInput, seedExponent);
  const startVal = getNumericSeed(steps, seedInput, seedExponent);
  const expForX = startVal !== undefined ? '1' : seedExponent;
  const activeNum = activeXValue === 'x' ? null : parseFloat(activeXValue);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="table-modal-title"
    >
      <div
        className="w-full max-w-[440px] overflow-hidden rounded-[26px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Blue Header */}
        <div className="flex items-center justify-between bg-[#2563eb] px-6 py-4 text-white">
          <h2 id="table-modal-title" className="text-xl font-bold tracking-tight">
            Input → Output Table
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close table"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Table Body */}
        <div className="p-4">
          <div className="grid grid-cols-2 rounded-xl bg-[#1e3a8a] px-4 py-3 text-center text-sm font-bold text-white shadow-xs">
            <span>x</span>
            <span className="truncate" title={`y = ${formula}`}>
              y = {formula}
            </span>
          </div>

          <div
            ref={scrollContainerRef}
            className="mt-1 max-h-[420px] overflow-y-auto divide-y divide-slate-100 pr-1"
          >
            {TABLE_X_VALUES.map((xVal) => {
              const yVal = evaluatePipelineNumeric(steps, xVal, {
                startVal,
                inputExponent: expForX,
              });
              const isCurrent = activeNum !== null && Math.abs(activeNum - xVal) < 1e-9;

              return (
                <button
                  key={xVal}
                  type="button"
                  onClick={() => {
                    onSelectX(String(xVal));
                    onClose();
                  }}
                  title={`Use x = ${xVal} in Function Machine`}
                  className={`grid w-full grid-cols-2 items-center px-4 py-2.5 text-center text-base transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[#eff6ff] font-bold'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono-tabular font-semibold text-[#b45309]">
                    {xVal}
                  </span>
                  <span
                    className={`font-mono-tabular font-semibold ${
                      yVal === null ? 'text-rose-600' : 'text-[#15803d]'
                    }`}
                  >
                    {yVal === null ? 'undefined' : formatNumber(yVal)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">
            Click any row to send x into the machine
          </p>
        </div>
      </div>
    </div>
  );
};
