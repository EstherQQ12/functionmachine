import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { MachineStep, Operator, isUnaryOp } from '../utils/mathEngine';

interface MachineCardProps {
  step: MachineStep;
  index: number;
  isSelected: boolean;
  isExponentSelected: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onSelectBox: () => void;
  onSelectExponent: () => void;
  onChangeOp: (op: Operator) => void;
  onRemove: () => void;
}

const OPERATORS: { op: Operator; label: string; title: string }[] = [
  { op: '+', label: '+', title: 'Add' },
  { op: '-', label: '−', title: 'Subtract' },
  { op: '×', label: '×', title: 'Multiply' },
  { op: '÷', label: '÷', title: 'Divide' },
  { op: '²', label: '²', title: 'Square' },
  { op: '³', label: '³', title: 'Cube' },
];

export const MachineCard: React.FC<MachineCardProps> = ({
  step,
  index,
  isSelected,
  isExponentSelected,
  canMoveLeft,
  canMoveRight,
  isDragging = false,
  isDragOver = false,
  onMoveLeft,
  onMoveRight,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSelectBox,
  onSelectExponent,
  onChangeOp,
  onRemove,
}) => {
  const unary = isUnaryOp(step.op);
  const isOperandX = !unary && step.operand === 'x';
  const isExpX = !unary && step.exponent === 'x';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative flex flex-col items-center justify-between rounded-[28px] bg-[#67e8f9] px-4 pt-4 pb-4 transition-all duration-150 select-none shrink-0 cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-55 scale-95' : ''
      } ${
        isDragOver
          ? 'border-[2.5px] border-[#10b981] ring-[3px] ring-[#10b981]/60 ring-offset-2 ring-offset-white shadow-md'
          : (isSelected || isExponentSelected) && !unary
            ? 'border-[2.5px] border-[#06b6d4] ring-[3px] ring-[#3b82f6] ring-offset-2 ring-offset-white shadow-md'
            : 'border-[2.5px] border-[#06b6d4]/85 shadow-sm'
      }`}
      aria-label={`Machine step ${index + 1}`}
    >
      {/* Move Left / Right pill */}
      <div className="absolute -top-3 left-2.5 flex items-center overflow-hidden rounded-full border-2 border-[#06b6d4] bg-white shadow-sm">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveLeft();
          }}
          disabled={!canMoveLeft}
          title="Move machine to the front (left)"
          aria-label="Move machine left"
          className={`flex h-6 w-6 items-center justify-center transition-colors ${
            canMoveLeft
              ? 'text-[#0e7490] hover:bg-[#cffafe] cursor-pointer'
              : 'text-slate-300 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="h-3.5 w-3.5 stroke-[2.75]" />
        </button>
        <span className="h-3.5 w-[1.5px] bg-[#a5f3fc]" aria-hidden="true" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveRight();
          }}
          disabled={!canMoveRight}
          title="Move machine to the back (right)"
          aria-label="Move machine right"
          className={`flex h-6 w-6 items-center justify-center transition-colors ${
            canMoveRight
              ? 'text-[#0e7490] hover:bg-[#cffafe] cursor-pointer'
              : 'text-slate-300 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="h-3.5 w-3.5 stroke-[2.75]" />
        </button>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove machine"
        aria-label={`Remove machine ${index + 1}`}
        className="absolute -top-2.5 -right-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#ef4444] text-white shadow-sm transition-transform hover:scale-105 hover:bg-[#dc2626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ef4444] cursor-pointer"
      >
        <X className="h-3.5 w-3.5 stroke-[3]" />
      </button>

      {/* Top row of 6 operation buttons */}
      <div className="flex items-center gap-1.5 mb-3.5 mt-1">
        {OPERATORS.map(({ op, label, title }) => {
          const active = step.op === op;
          const isPower = op === '²' || op === '³';
          return (
            <button
              key={op}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChangeOp(op);
              }}
              title={title}
              aria-label={`${title} operation`}
              aria-pressed={active}
              className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1d4ed8] ${
                isPower ? 'text-xs' : 'text-base'
              } ${
                active
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'bg-white text-slate-800 hover:bg-slate-50 shadow-2xs'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Operand value box with small top-right indices box */}
      {unary ? (
        <div
          className="flex h-[62px] min-w-[82px] items-center justify-center rounded-2xl border-[2.5px] border-[#0284c7] bg-[#e0f2fe]/90 px-4 text-xl font-bold text-[#0369a1]"
          title={step.op === '²' ? 'Squares incoming value' : 'Cubes incoming value'}
        >
          {step.op === '²' ? '( )²' : '( )³'}
        </div>
      ) : (
        <div className="relative inline-flex mt-0.5">
          <button
            type="button"
            onClick={onSelectBox}
            aria-label={`Edit operand for machine ${index + 1}, current value ${step.operand}`}
            className={`flex h-[62px] min-w-[82px] items-center justify-center rounded-2xl bg-[#e0f2fe] px-4 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284c7] ${
              isSelected
                ? 'border-[2.5px] border-[#0284c7] shadow-inner'
                : 'border-[2.5px] border-dashed border-[#0284c7]/80 hover:border-[#0284c7] hover:bg-[#d0ecfd]'
            }`}
          >
            {isOperandX ? (
              <span className="text-2xl font-extrabold italic text-[#92400e]">x</span>
            ) : (
              <span className="font-mono-tabular text-2xl font-extrabold text-[#0c4a6e]">
                {step.operand}
              </span>
            )}
          </button>

          {/* Small indices/exponent box at top-right corner */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectExponent();
            }}
            title="Edit index (power)"
            aria-label={`Edit index for machine ${index + 1}, current index ${step.exponent}`}
            className={`absolute -top-2.5 -right-2.5 flex h-6 min-w-[24px] items-center justify-center rounded-lg border-2 px-1 text-xs font-extrabold shadow-xs transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2563eb] ${
              isExponentSelected
                ? 'border-[#2563eb] bg-[#dbeafe] text-[#1d4ed8] scale-110'
                : 'border-[#0284c7] bg-white text-[#0369a1] hover:bg-[#eff6ff]'
            }`}
          >
            {isExpX ? (
              <span className="italic text-[#92400e]">x</span>
            ) : (
              <span className="font-mono-tabular">{step.exponent}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
