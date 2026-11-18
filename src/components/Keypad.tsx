import React, { useEffect, useState } from 'react';
import { Delete, Check } from 'lucide-react';

interface KeypadProps {
  targetKey: string;
  targetLabel: string;
  currentValue: string;
  defaultResetValue?: string;
  onChangeValue: (next: string) => void;
  onDone: () => void;
}

export const Keypad: React.FC<KeypadProps> = ({
  targetKey,
  targetLabel,
  currentValue,
  defaultResetValue = '0',
  onChangeValue,
  onDone,
}) => {
  const [isFresh, setIsFresh] = useState(true);

  useEffect(() => {
    setIsFresh(true);
  }, [targetKey]);

  const handleDigit = (d: string) => {
    if (isFresh || currentValue === 'x' || currentValue === '0') {
      setIsFresh(false);
      onChangeValue(d);
    } else if (currentValue === '-0') {
      setIsFresh(false);
      onChangeValue(`-${d}`);
    } else if (currentValue.length < 8) {
      onChangeValue(currentValue + d);
    }
  };

  const handleClear = () => {
    setIsFresh(true);
    onChangeValue(defaultResetValue);
  };

  const handleBackspace = () => {
    setIsFresh(false);
    if (currentValue === 'x') {
      onChangeValue(defaultResetValue);
      return;
    }
    if (currentValue.length <= 1 || (currentValue.length === 2 && currentValue.startsWith('-'))) {
      onChangeValue(defaultResetValue);
    } else {
      onChangeValue(currentValue.slice(0, -1));
    }
  };

  const handleToggleSign = () => {
    setIsFresh(false);
    if (currentValue === 'x' || currentValue === '0') return;
    if (currentValue.startsWith('-')) {
      onChangeValue(currentValue.slice(1));
    } else {
      onChangeValue(`-${currentValue}`);
    }
  };

  const handleVariableX = () => {
    setIsFresh(false);
    onChangeValue('x');
  };

  const handleDecimal = () => {
    if (isFresh || currentValue === 'x') {
      setIsFresh(false);
      onChangeValue('0.');
    } else if (!currentValue.includes('.')) {
      onChangeValue(currentValue + '.');
    }
  };

  // Support physical keyboard input while keypad is open
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleDecimal();
      } else if (e.key === '-') {
        e.preventDefault();
        handleToggleSign();
      } else if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleVariableX();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const numBtnClass =
    'flex h-12 items-center justify-center rounded-2xl bg-[#f1f5f9] text-xl font-bold text-slate-900 shadow-2xs transition-all duration-100 hover:bg-[#e2e8f0] active:scale-97 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563eb]';

  return (
    <div
      className="w-full max-w-[290px] rounded-[30px] bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] border border-slate-100 select-none"
      role="group"
      aria-label={`Number keypad editing ${targetLabel}`}
    >
      <div className="grid grid-cols-3 gap-2.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            className={numBtnClass}
          >
            {digit}
          </button>
        ))}

        {/* C */}
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear value to 0"
          className="flex h-12 items-center justify-center rounded-2xl bg-[#fecaca] text-lg font-extrabold text-[#991b1b] transition-all duration-100 hover:bg-[#fca5a5] active:scale-97 cursor-pointer"
        >
          C
        </button>

        {/* 0 */}
        <button
          type="button"
          onClick={() => handleDigit('0')}
          className={numBtnClass}
        >
          0
        </button>

        {/* Backspace */}
        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Backspace"
          className="flex h-12 items-center justify-center rounded-2xl bg-[#fed7aa] text-[#9a3412] transition-all duration-100 hover:bg-[#fdba74] active:scale-97 cursor-pointer"
        >
          <Delete className="h-5 w-5" />
        </button>

        {/* +/- */}
        <button
          type="button"
          onClick={handleToggleSign}
          aria-label="Toggle positive or negative sign"
          className="flex h-12 items-center justify-center rounded-2xl bg-[#e0e7ff] text-base font-bold text-[#3730a3] transition-all duration-100 hover:bg-[#c7d2fe] active:scale-97 cursor-pointer"
        >
          +/−
        </button>

        {/* x */}
        <button
          type="button"
          onClick={handleVariableX}
          aria-label="Set value to variable x"
          className="flex h-12 items-center justify-center rounded-2xl bg-[#fef08a] text-xl font-extrabold italic text-[#854d0e] transition-all duration-100 hover:bg-[#fde047] active:scale-97 cursor-pointer"
        >
          x
        </button>

        {/* Decimal point */}
        <button
          type="button"
          onClick={handleDecimal}
          aria-label="Decimal point"
          className={numBtnClass}
        >
          .
        </button>

        {/* Done */}
        <button
          type="button"
          onClick={onDone}
          className="col-span-3 flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-[#bbf7d0] text-base font-bold text-[#065f46] transition-all duration-100 hover:bg-[#86efac] active:scale-98 cursor-pointer"
        >
          <span>Done</span>
          <Check className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
