import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Plus,
  Settings,
} from 'lucide-react';
import {
  MachineStep,
  Operator,
  buildFormulaString,
  evaluatePipelineDisplay,
  hasVariableInSteps,
  isUnaryOp,
  solveInverseX,
} from './utils/mathEngine';
import { MachineCard } from './components/MachineCard';
import { Keypad } from './components/Keypad';
import { TableModal } from './components/TableModal';
import { GraphModal } from './components/GraphModal';

type EditTarget =
  | { type: 'input' }
  | { type: 'inputExp' }
  | { type: 'step'; id: string }
  | { type: 'stepExp'; id: string }
  | null;

type PipelineItem =
  | { kind: 'input' }
  | { kind: 'machine'; step: MachineStep };

function makeId(): string {
  return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function App() {
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([
    { kind: 'input' },
    { kind: 'machine', step: { id: 'step-1', op: '+', operand: '0', exponent: '1' } },
  ]);
  const [inputValue, setInputValue] = useState<string>('0');
  const [inputExponent, setInputExponent] = useState<string>('1');
  const [isSwapped, setIsSwapped] = useState<boolean>(false);
  const [swappedSeed, setSwappedSeed] = useState<string>('0');
  const [swappedSeedExponent, setSwappedSeedExponent] = useState<string>('1');
  const [editTarget, setEditTarget] = useState<EditTarget>({
    type: 'step',
    id: 'step-1',
  });
  const [isTableOpen, setIsTableOpen] = useState<boolean>(false);
  const [isGraphOpen, setIsGraphOpen] = useState<boolean>(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const steps = useMemo(
    () =>
      pipelineItems
        .filter((item): item is { kind: 'machine'; step: MachineStep } => item.kind === 'machine')
        .map((item) => item.step),
    [pipelineItems],
  );

  const activeSeed = isSwapped ? swappedSeed : inputValue;
  const activeSeedExponent = isSwapped ? swappedSeedExponent : inputExponent;

  const formula = useMemo(
    () => buildFormulaString(steps, activeSeed, activeSeedExponent),
    [steps, activeSeed, activeSeedExponent],
  );

  const forwardOutput = useMemo(
    () => evaluatePipelineDisplay(steps, inputValue, inputExponent),
    [steps, inputValue, inputExponent],
  );

  const inverseResult = useMemo(
    () => solveInverseX(steps, inputValue, inputExponent, swappedSeed, swappedSeedExponent),
    [steps, inputValue, inputExponent, swappedSeed, swappedSeedExponent],
  );

  const outputDisplay = isSwapped ? inverseResult.label : forwardOutput;
  const secondaryEquation = isSwapped
    ? `x = ${inverseResult.label}`
    : `y = ${forwardOutput}`;

  const handleAddMachine = () => {
    const newId = makeId();
    setPipelineItems((prev) => [
      ...prev,
      { kind: 'machine', step: { id: newId, op: '+', operand: '0', exponent: '1' } },
    ]);
    setEditTarget({ type: 'step', id: newId });
  };

  const handleClearAll = () => {
    const firstId = makeId();
    setPipelineItems([
      { kind: 'input' },
      { kind: 'machine', step: { id: firstId, op: '+', operand: '0', exponent: '1' } },
    ]);
    setInputValue('0');
    setInputExponent('1');
    setIsSwapped(false);
    setEditTarget({ type: 'step', id: firstId });
  };

  const handleMoveItem = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= pipelineItems.length ||
      toIndex >= pipelineItems.length
    ) {
      return;
    }
    setPipelineItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleChangeOp = (id: string, op: Operator) => {
    setPipelineItems((prev) =>
      prev.map((item) =>
        item.kind === 'machine' && item.step.id === id
          ? { kind: 'machine', step: { ...item.step, op } }
          : item,
      ),
    );
    if (isUnaryOp(op)) {
      if (
        (editTarget?.type === 'step' || editTarget?.type === 'stepExp') &&
        editTarget.id === id
      ) {
        setEditTarget(null);
      }
    } else {
      setEditTarget({ type: 'step', id });
    }
  };

  const handleRemoveStep = (id: string) => {
    setPipelineItems((prev) =>
      prev.filter((item) => !(item.kind === 'machine' && item.step.id === id)),
    );
    if (
      (editTarget?.type === 'step' || editTarget?.type === 'stepExp') &&
      editTarget.id === id
    ) {
      setEditTarget(null);
    }
  };

  const currentKeypadValue = useMemo(() => {
    if (!editTarget) return '0';
    if (editTarget.type === 'input') return inputValue;
    if (editTarget.type === 'inputExp') return inputExponent;
    const found = steps.find((s) => s.id === editTarget.id);
    if (!found) return editTarget.type === 'stepExp' ? '1' : '0';
    return editTarget.type === 'stepExp' ? found.exponent : found.operand;
  }, [editTarget, inputValue, inputExponent, steps]);

  const currentKeypadLabel = useMemo(() => {
    if (!editTarget) return '';
    if (editTarget.type === 'input') return 'input';
    if (editTarget.type === 'inputExp') return 'input index';
    const idx = steps.findIndex((s) => s.id === editTarget.id);
    const label = idx >= 0 ? `Machine ${idx + 1}` : 'Machine';
    return editTarget.type === 'stepExp' ? `${label} index` : label;
  }, [editTarget, steps]);

  const isEditingExponent =
    editTarget?.type === 'inputExp' || editTarget?.type === 'stepExp';

  const handleKeypadChange = (nextVal: string) => {
    if (!editTarget) return;
    if (editTarget.type === 'input') {
      setInputValue(nextVal);
    } else if (editTarget.type === 'inputExp') {
      setInputExponent(nextVal);
    } else if (editTarget.type === 'step') {
      setPipelineItems((prev) =>
        prev.map((item) =>
          item.kind === 'machine' && item.step.id === editTarget.id
            ? { kind: 'machine', step: { ...item.step, operand: nextVal } }
            : item,
        ),
      );
    } else if (editTarget.type === 'stepExp') {
      setPipelineItems((prev) =>
        prev.map((item) =>
          item.kind === 'machine' && item.step.id === editTarget.id
            ? { kind: 'machine', step: { ...item.step, exponent: nextVal } }
            : item,
        ),
      );
    }
  };

  const isInputSelected = editTarget?.type === 'input';
  const isInputExpSelected = editTarget?.type === 'inputExp';

  let machineOrderCounter = 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#f9faf3] text-slate-900">
      {/* Top Header & Equation Summary Zone */}
      <header className="bg-[#f2f8f8] px-4 pt-6 pb-7 border-b border-slate-200/50">
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          {/* App Title */}
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9d5ff]/55 text-[#7c3aed]/80 shadow-2xs">
              <Settings className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0f766e]">
              Function Machine
            </h1>
          </div>

          {/* Two Stacked Equation Display Bars */}
          <div className="flex w-full max-w-[540px] flex-col gap-3">
            {/* Blue Formula Bar */}
            <div
              className="flex min-h-[54px] w-full items-center justify-center rounded-[20px] border-2 border-[#60a5fa] bg-[#eff6ff] px-6 py-2.5 text-center shadow-2xs"
              aria-label="Symbolic function equation"
            >
              <span className="text-xl font-extrabold text-[#1d4ed8] tracking-tight break-all">
                y = {formula}
              </span>
            </div>

            {/* Purple Evaluated / Inverse Bar with Swap Button */}
            <div className="relative">
              <div
                className="flex min-h-[54px] w-full items-center justify-center rounded-[20px] border-2 border-[#a78bfa] bg-[#f5f3ff] px-10 py-2.5 text-center shadow-2xs"
                aria-label={isSwapped ? 'Solved x value' : 'Evaluated y value'}
              >
                <span className="text-xl font-extrabold text-[#6d28d9] tracking-tight break-all">
                  {secondaryEquation}
                </span>
              </div>

              {/* Swap X <-> Y Button */}
              <button
                type="button"
                onClick={() => {
                  if (!isSwapped) {
                    setSwappedSeed(inputValue);
                    setSwappedSeedExponent(inputExponent);
                    setIsSwapped(true);
                  } else {
                    setInputValue(swappedSeed);
                    setInputExponent(swappedSeedExponent);
                    setIsSwapped(false);
                  }
                }}
                title={
                  isSwapped
                    ? 'Switch back to Input → Output'
                    : 'Swap to Reverse Solver'
                }
                aria-label="Swap input and output variables"
                aria-pressed={isSwapped}
                className={`absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d28d9] ${
                  isSwapped
                    ? 'bg-[#5b21b6] text-white scale-105'
                    : 'bg-[#7c3aed] text-white hover:bg-[#6d28d9] hover:scale-105'
                }`}
              >
                <ArrowLeftRight className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main White Machine Pipeline Stage */}
      <section
        className="w-full bg-white py-8 px-4 shadow-[0_4px_20px_rgba(15,23,42,0.035)] border-b border-slate-200/50"
        aria-label="Function machine pipeline"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-start md:justify-center gap-4 overflow-x-auto py-4 px-3">
          {pipelineItems.map((item, idx) => {
            const isDragging = dragIndex === idx;
            const isDragOver = dragOverIndex === idx && dragIndex !== null && dragIndex !== idx;

            if (item.kind === 'input') {
              return (
                <React.Fragment key="pipeline-input">
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(idx);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(idx));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverIndex !== idx) setDragOverIndex(idx);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex !== null) {
                        handleMoveItem(dragIndex, idx);
                      }
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={`relative shrink-0 transition-all duration-150 ${
                      isDragging ? 'opacity-55 scale-95' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setEditTarget({ type: 'input' })}
                      aria-label={`Edit input, current value ${inputValue}`}
                      className={`flex min-w-[126px] h-[116px] flex-col items-center justify-center rounded-[24px] border-[2.5px] bg-[#fde047] px-5 transition-all duration-150 cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ca8a04] ${
                        isDragOver
                          ? 'border-[#10b981] ring-[3px] ring-[#10b981]/60 ring-offset-2 shadow-md'
                          : isInputSelected || isInputExpSelected
                            ? 'border-[#ca8a04] ring-[3px] ring-[#3b82f6] ring-offset-2 shadow-md'
                            : 'border-[#eab308] hover:bg-[#facc15]/90 shadow-sm'
                      }`}
                    >
                      <span className="text-xs font-bold text-[#78350f] mb-1">
                        input
                      </span>
                      {inputValue === 'x' ? (
                        <span className="text-3xl font-extrabold italic text-[#78350f]">x</span>
                      ) : (
                        <span className="font-mono-tabular text-3xl font-extrabold text-[#78350f]">
                          {inputValue}
                        </span>
                      )}
                    </button>

                    {/* Small indices/exponent box at top-right corner */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTarget({ type: 'inputExp' });
                      }}
                      title="Edit input index (power)"
                      aria-label={`Edit input index, current index ${inputExponent}`}
                      className={`absolute -top-2.5 -right-2.5 flex h-6 min-w-[24px] items-center justify-center rounded-lg border-2 px-1 text-xs font-extrabold shadow-xs transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2563eb] ${
                        isInputExpSelected
                          ? 'border-[#2563eb] bg-[#dbeafe] text-[#1d4ed8] scale-110'
                          : 'border-[#ca8a04] bg-[#fef9c3] text-[#78350f] hover:bg-white'
                      }`}
                    >
                      {inputExponent === 'x' ? (
                        <span className="italic">x</span>
                      ) : (
                        <span className="font-mono-tabular">{inputExponent}</span>
                      )}
                    </button>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                </React.Fragment>
              );
            }

            const step = item.step;
            const machineIndex = machineOrderCounter++;

            return (
              <React.Fragment key={step.id}>
                <MachineCard
                  step={step}
                  index={machineIndex}
                  isSelected={editTarget?.type === 'step' && editTarget.id === step.id}
                  isExponentSelected={
                    editTarget?.type === 'stepExp' && editTarget.id === step.id
                  }
                  canMoveLeft={idx > 0}
                  canMoveRight={idx < pipelineItems.length - 1}
                  isDragging={isDragging}
                  isDragOver={isDragOver}
                  onMoveLeft={() => handleMoveItem(idx, idx - 1)}
                  onMoveRight={() => handleMoveItem(idx, idx + 1)}
                  onDragStart={(e) => {
                    setDragIndex(idx);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverIndex !== idx) setDragOverIndex(idx);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) {
                      handleMoveItem(dragIndex, idx);
                    }
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onSelectBox={() => setEditTarget({ type: 'step', id: step.id })}
                  onSelectExponent={() => setEditTarget({ type: 'stepExp', id: step.id })}
                  onChangeOp={(op) => handleChangeOp(step.id, op)}
                  onRemove={() => handleRemoveStep(step.id)}
                />
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              </React.Fragment>
            );
          })}

          {/* Output Box */}
          <div
            className="flex min-w-[132px] max-w-[240px] h-[116px] shrink-0 flex-col items-center justify-center rounded-[24px] border-[2.5px] border-[#16a34a]/80 bg-[#4ade80] px-5 shadow-sm"
            aria-label={`output is ${outputDisplay}`}
          >
            <span className="text-xs font-bold text-[#064e3b] mb-1">
              output
            </span>
            <span
              className={`font-mono-tabular text-center font-extrabold text-[#064e3b] leading-tight break-words ${
                outputDisplay.length > 7 ? 'text-xl' : 'text-3xl'
              }`}
            >
              {outputDisplay}
            </span>
          </div>
        </div>
      </section>

      {/* Controls, Keypad, Table & Graph Buttons */}
      <main className="flex-1 px-4 py-7">
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          {/* + Add Machine & Clear */}
          <div className="mb-7 flex flex-wrap items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={handleAddMachine}
              className="flex items-center gap-2 rounded-2xl bg-[#10b981] px-6 py-3 text-base font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#059669] active:scale-98 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669]"
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
              <span>Add Machine</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-2xl bg-[#f87171] px-5 py-3 text-base font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#ef4444] active:scale-98 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ef4444]"
            >
              Clear
            </button>
          </div>

          {/* Keypad + Table / Graph Buttons */}
          <div className="flex w-full flex-col sm:flex-row items-center sm:items-center justify-center gap-8">
            {editTarget && (
              <Keypad
                targetKey={
                  editTarget.type === 'input' || editTarget.type === 'inputExp'
                    ? editTarget.type
                    : `${editTarget.type}-${editTarget.id}`
                }
                targetLabel={currentKeypadLabel}
                currentValue={currentKeypadValue}
                defaultResetValue={isEditingExponent ? '1' : '0'}
                onChangeValue={handleKeypadChange}
                onDone={() => setEditTarget(null)}
              />
            )}

            <div className="flex flex-row sm:flex-col items-center gap-3.5">
              <button
                type="button"
                onClick={() => setIsTableOpen(true)}
                className="flex min-w-[136px] items-center justify-center gap-2.5 rounded-2xl bg-[#60a5fa] px-5 py-3 text-base font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#3b82f6] active:scale-98 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/95 p-0.5 shadow-2xs" aria-hidden="true">
                  <svg viewBox="0 0 20 20" className="h-4 w-4">
                    <rect x="2" y="10" width="4" height="8" rx="1" fill="#22c55e" />
                    <rect x="8" y="4" width="4" height="14" rx="1" fill="#f43f5e" />
                    <rect x="14" y="7" width="4" height="11" rx="1" fill="#3b82f6" />
                  </svg>
                </span>
                <span>Table</span>
              </button>

              <button
                type="button"
                onClick={() => setIsGraphOpen(true)}
                className="flex min-w-[136px] flex-col items-center justify-center gap-1 rounded-2xl bg-[#fbbf24] px-5 py-3 text-base font-bold text-[#451a03] shadow-sm transition-all duration-150 hover:bg-[#f59e0b] active:scale-98 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d97706]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 p-0.5 shadow-2xs" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-5 w-5">
                    <path d="M4 4v16h16" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M4 12h16M12 4v16" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                    <path d="M5 17 L10 11 L14 14 L19 6" fill="none" stroke="#ef4444" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="10" cy="11" r="1.8" fill="#3b82f6" />
                    <circle cx="19" cy="6" r="1.8" fill="#10b981" />
                  </svg>
                </span>
                <span>Graph</span>
              </button>
            </div>
          </div>

          {!editTarget && (
            <p className="mt-6 text-center text-sm font-medium text-slate-500">
              Click the yellow <span className="font-bold text-[#b45309]">input</span> box, any cyan machine box, or a small index box to edit with the keypad.
            </p>
          )}
        </div>
      </main>

      {/* Input -> Output Table Modal */}
      <TableModal
        isOpen={isTableOpen}
        steps={steps}
        seedInput={activeSeed}
        seedExponent={activeSeedExponent}
        activeXValue={isSwapped || hasVariableInSteps(steps) ? 'x' : inputValue}
        onSelectX={(xVal) => {
          setIsSwapped(false);
          if (!hasVariableInSteps(steps)) {
            setInputValue(xVal);
          }
        }}
        onClose={() => setIsTableOpen(false)}
      />

      {/* X-Y Graph Modal */}
      <GraphModal
        isOpen={isGraphOpen}
        steps={steps}
        seedInput={activeSeed}
        seedExponent={activeSeedExponent}
        activeXValue={isSwapped ? 'x' : inputValue}
        onClose={() => setIsGraphOpen(false)}
      />
    </div>
  );
}
