export type Operator = '+' | '-' | '×' | '÷' | '²' | '³';

export interface MachineStep {
  id: string;
  op: Operator;
  operand: string; // numeric string e.g. "0", "-3", "2.5" or "x"
  exponent: string; // indices/exponent string, defaults to "1"
}

export function isUnaryOp(op: Operator): boolean {
  return op === '²' || op === '³';
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return 'undefined';
  const roundedInt = Math.round(n);
  if (Math.abs(n - roundedInt) < 1e-9) {
    return Object.is(roundedInt, -0) ? '0' : String(roundedInt);
  }
  const fixed = Math.round(n * 10000) / 10000;
  return Object.is(fixed, -0) ? '0' : String(fixed);
}

export function parseValueNumber(val: string): number {
  if (val === 'x' || val === '-x') return 0;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
}

export function hasVariableInSteps(steps: MachineStep[]): boolean {
  return steps.some(
    (s) => !isUnaryOp(s.op) && (s.operand === 'x' || s.exponent === 'x'),
  );
}

function safePow(base: number, exp: number): number | null {
  if (Math.abs(exp - 1) < 1e-12) return base;
  if (Math.abs(exp) < 1e-12) return 1;
  if (Math.abs(base) < 1e-12 && exp < 0) return null;
  const res = Math.pow(base, exp);
  return Number.isFinite(res) ? res : null;
}

export function getNumericSeed(
  steps: MachineStep[],
  seedInput?: string,
  seedExponent: string = '1',
): number | undefined {
  if (seedInput === undefined || seedInput === 'x' || !hasVariableInSteps(steps)) {
    return undefined;
  }
  if (seedExponent === 'x') {
    return undefined;
  }
  const base = parseValueNumber(seedInput);
  const exp = parseValueNumber(seedExponent);
  const val = safePow(base, exp);
  return val === null ? undefined : val;
}

// Evaluate the pipeline numerically for a given x value
export function evaluatePipelineNumeric(
  steps: MachineStep[],
  xVal: number,
  options?: {
    startVal?: number;
    inputExponent?: string;
  },
): number | null {
  let curr: number | null;
  if (options?.startVal !== undefined) {
    curr = options.startVal;
  } else {
    const expStr = options?.inputExponent ?? '1';
    const expNum = expStr === 'x' ? xVal : parseValueNumber(expStr);
    curr = safePow(xVal, expNum);
  }

  if (curr === null) return null;

  for (const step of steps) {
    if (step.op === '²') {
      curr = curr * curr;
    } else if (step.op === '³') {
      curr = curr * curr * curr;
    } else {
      const base = step.operand === 'x' ? xVal : parseValueNumber(step.operand);
      const exp = step.exponent === 'x' ? xVal : parseValueNumber(step.exponent);
      const rhs = safePow(base, exp);
      if (rhs === null) return null;

      switch (step.op) {
        case '+':
          curr = curr + rhs;
          break;
        case '-':
          curr = curr - rhs;
          break;
        case '×':
          curr = curr * rhs;
          break;
        case '÷':
          if (Math.abs(rhs) < 1e-12) return null;
          curr = curr / rhs;
          break;
      }
    }
    if (!Number.isFinite(curr)) return null;
  }
  return curr;
}

// --- Symbolic AST for clean algebraic formulas ---
type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'bin'; op: '+' | '-' | '×' | '÷'; left: Expr; right: Expr }
  | { kind: 'pow'; base: Expr; exp: Expr };

function isNumValue(e: Expr, target: number): boolean {
  return e.kind === 'num' && Math.abs(e.value - target) < 1e-12;
}

function isSameExpr(a: Expr, b: Expr): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'num' && b.kind === 'num') return Math.abs(a.value - b.value) < 1e-12;
  if (a.kind === 'var' && b.kind === 'var') return a.name === b.name;
  if (a.kind === 'pow' && b.kind === 'pow') {
    return isSameExpr(a.base, b.base) && isSameExpr(a.exp, b.exp);
  }
  if (a.kind === 'bin' && b.kind === 'bin') {
    return a.op === b.op && isSameExpr(a.left, b.left) && isSameExpr(a.right, b.right);
  }
  return false;
}

function simplifyPow(base: Expr, exp: Expr): Expr {
  if (isNumValue(exp, 1)) return base;
  if (isNumValue(exp, 0)) return { kind: 'num', value: 1 };
  if (base.kind === 'num' && exp.kind === 'num') {
    const res = safePow(base.value, exp.value);
    if (res !== null) {
      return { kind: 'num', value: res };
    }
  }
  return { kind: 'pow', base, exp };
}

function simplifyBin(op: '+' | '-' | '×' | '÷', left: Expr, right: Expr): Expr {
  // Constant folding
  if (left.kind === 'num' && right.kind === 'num') {
    if (op === '+') return { kind: 'num', value: left.value + right.value };
    if (op === '-') return { kind: 'num', value: left.value - right.value };
    if (op === '×') return { kind: 'num', value: left.value * right.value };
    if (op === '÷' && Math.abs(right.value) > 1e-12) {
      return { kind: 'num', value: left.value / right.value };
    }
  }

  if (op === '+') {
    if (isNumValue(right, 0)) return left;
    if (isNumValue(left, 0)) return right;
    if (right.kind === 'num' && right.value < 0) {
      return simplifyBin('-', left, { kind: 'num', value: -right.value });
    }
    if (isSameExpr(left, right)) {
      return simplifyBin('×', { kind: 'num', value: 2 }, left);
    }
  }

  if (op === '-') {
    if (isNumValue(right, 0)) return left;
    if (right.kind === 'num' && right.value < 0) {
      return simplifyBin('+', left, { kind: 'num', value: -right.value });
    }
    if (isSameExpr(left, right)) {
      return { kind: 'num', value: 0 };
    }
  }

  if (op === '×') {
    if (isNumValue(left, 0) || isNumValue(right, 0)) return { kind: 'num', value: 0 };
    if (isNumValue(left, 1)) return right;
    if (isNumValue(right, 1)) return left;
    if (isSameExpr(left, right)) {
      return { kind: 'pow', base: left, exp: { kind: 'num', value: 2 } };
    }
    if (
      left.kind === 'pow' &&
      left.exp.kind === 'num' &&
      isSameExpr(left.base, right)
    ) {
      return simplifyPow(left.base, { kind: 'num', value: left.exp.value + 1 });
    }
    // Keep constant on the left for cleaner output e.g. 2(x + 3), 2x²
    if (right.kind === 'num' && left.kind !== 'num') {
      return { kind: 'bin', op: '×', left: right, right: left };
    }
    if (left.kind === 'num' && right.kind === 'bin' && right.op === '×' && right.left.kind === 'num') {
      return simplifyBin('×', { kind: 'num', value: left.value * right.left.value }, right.right);
    }
  }

  if (op === '÷') {
    if (isNumValue(right, 1)) return left;
    if (isNumValue(left, 0) && !isNumValue(right, 0)) {
      return { kind: 'num', value: 0 };
    }
    if (isNumValue(right, -1)) {
      return simplifyBin('×', { kind: 'num', value: -1 }, left);
    }
  }

  return { kind: 'bin', op, left, right };
}

function exprPrecedence(e: Expr): number {
  if (e.kind === 'num') return e.value < 0 ? 3 : 4;
  if (e.kind === 'var') return 4;
  if (e.kind === 'pow') return 3;
  if (e.op === '+' || e.op === '-') return 1;
  return 2;
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};

function toSuperscriptInt(n: number): string | null {
  if (!Number.isInteger(n) || Math.abs(n) > 99) return null;
  return String(n)
    .split('')
    .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
    .join('');
}

function formatExpr(e: Expr): string {
  if (e.kind === 'num') return formatNumber(e.value);
  if (e.kind === 'var') return e.name;
  if (e.kind === 'pow') {
    const baseStr = formatExpr(e.base);
    const wrappedBase =
      e.base.kind === 'var' || (e.base.kind === 'num' && e.base.value >= 0)
        ? baseStr
        : `(${baseStr})`;

    if (e.exp.kind === 'num') {
      const sup = toSuperscriptInt(e.exp.value);
      if (sup !== null) return `${wrappedBase}${sup}`;
      return `${wrappedBase}^${formatNumber(e.exp.value)}`;
    }
    if (e.exp.kind === 'var') {
      return `${wrappedBase}^${e.exp.name}`;
    }
    return `${wrappedBase}^(${formatExpr(e.exp)})`;
  }

  if (e.op === '+') {
    const l = formatExpr(e.left);
    const r = formatExpr(e.right);
    if (e.right.kind === 'num' && e.right.value < 0) {
      return `${l} - ${formatNumber(-e.right.value)}`;
    }
    return `${l} + ${r}`;
  }

  if (e.op === '-') {
    const l = formatExpr(e.left);
    const r = exprPrecedence(e.right) <= 1 ? `(${formatExpr(e.right)})` : formatExpr(e.right);
    if (isNumValue(e.left, 0)) {
      return `-${r}`;
    }
    return `${l} - ${r}`;
  }

  if (e.op === '×') {
    if (isNumValue(e.left, -1)) {
      const rStr = exprPrecedence(e.right) < 2 ? `(${formatExpr(e.right)})` : formatExpr(e.right);
      return `-${rStr}`;
    }
    if (e.left.kind === 'num' && (e.right.kind === 'var' || e.right.kind === 'pow')) {
      return `${formatExpr(e.left)}${formatExpr(e.right)}`;
    }
    if (e.left.kind === 'num' && e.right.kind === 'bin' && (e.right.op === '+' || e.right.op === '-')) {
      return `${formatExpr(e.left)}(${formatExpr(e.right)})`;
    }
    if (e.left.kind === 'var' && e.right.kind === 'bin' && (e.right.op === '+' || e.right.op === '-')) {
      return `${formatExpr(e.left)}(${formatExpr(e.right)})`;
    }
    const lStr = exprPrecedence(e.left) < 2 ? `(${formatExpr(e.left)})` : formatExpr(e.left);
    const rStr = exprPrecedence(e.right) <= 2 ? `(${formatExpr(e.right)})` : formatExpr(e.right);
    return `${lStr} × ${rStr}`;
  }

  // Division
  const lStr = exprPrecedence(e.left) < 2 ? `(${formatExpr(e.left)})` : formatExpr(e.left);
  const rStr = exprPrecedence(e.right) <= 2 ? `(${formatExpr(e.right)})` : formatExpr(e.right);
  return `${lStr}/${rStr}`;
}

function strToExpr(val: string): Expr {
  if (val === 'x') return { kind: 'var', name: 'x' };
  return { kind: 'num', value: parseValueNumber(val) };
}

export function buildPipelineExpr(
  steps: MachineStep[],
  startWith: 'x' | number,
  inputExponent: string = '1',
): Expr | null {
  const startBase: Expr =
    startWith === 'x' ? { kind: 'var', name: 'x' } : { kind: 'num', value: startWith };
  const startExp = strToExpr(inputExponent);

  if (
    startBase.kind === 'num' &&
    startExp.kind === 'num' &&
    safePow(startBase.value, startExp.value) === null
  ) {
    return null;
  }

  let curr: Expr = simplifyPow(startBase, startExp);

  for (const step of steps) {
    if (step.op === '²') {
      curr = simplifyPow(curr, { kind: 'num', value: 2 });
    } else if (step.op === '³') {
      curr = simplifyPow(curr, { kind: 'num', value: 3 });
    } else {
      const rhsBase = strToExpr(step.operand);
      const rhsExp = strToExpr(step.exponent);
      if (
        rhsBase.kind === 'num' &&
        rhsExp.kind === 'num' &&
        safePow(rhsBase.value, rhsExp.value) === null
      ) {
        return null;
      }
      const rhs = simplifyPow(rhsBase, rhsExp);
      if (step.op === '÷' && isNumValue(rhs, 0)) {
        return null;
      }
      curr = simplifyBin(step.op, curr, rhs);
    }
  }
  return curr;
}

export function buildFormulaString(
  steps: MachineStep[],
  seedInput?: string,
  seedExponent: string = '1',
): string {
  const startNum = getNumericSeed(steps, seedInput, seedExponent);
  const startWith: 'x' | number = startNum !== undefined ? startNum : 'x';
  const expForStart = startNum !== undefined ? '1' : seedExponent;
  const expr = buildPipelineExpr(steps, startWith, expForStart);
  if (!expr) return 'undefined';
  return formatExpr(expr);
}

export function evaluatePipelineDisplay(
  steps: MachineStep[],
  inputValue: string,
  inputExponent: string = '1',
): string {
  if (inputValue === 'x' || inputExponent === 'x' || hasVariableInSteps(steps)) {
    const startNum = getNumericSeed(steps, inputValue, inputExponent);
    if (startNum !== undefined) {
      const expr = buildPipelineExpr(steps, startNum, '1');
      return expr ? formatExpr(expr) : 'undefined';
    }
    const expr = buildPipelineExpr(steps, 'x', inputExponent);
    return expr ? formatExpr(expr) : 'undefined';
  }

  const baseNum = parseFloat(inputValue);
  const expNum = parseFloat(inputExponent);
  if (!Number.isFinite(baseNum) || !Number.isFinite(expNum)) return '0';
  const poweredInput = safePow(baseNum, expNum);
  if (poweredInput === null) return 'undefined';

  const res = evaluatePipelineNumeric(steps, poweredInput);
  if (res === null) return 'undefined';
  return formatNumber(res);
}

// --- Inverse Solver for Swapped Mode (input(Y) -> output(X)) ---
export interface InverseResult {
  status: 'exact' | 'none' | 'all' | 'symbolic' | 'undefined';
  values: number[];
  label: string;
}

function dedupeAndSort(nums: number[]): number[] {
  const sorted = [...nums].sort((a, b) => a - b);
  const res: number[] = [];
  for (const n of sorted) {
    if (res.length === 0 || Math.abs(n - res[res.length - 1]) > 1e-5) {
      res.push(n);
    }
  }
  return res;
}

export function solveInverseX(
  steps: MachineStep[],
  inputYStr: string,
  inputYExpStr: string = '1',
  seedInput?: string,
  seedExponent: string = '1',
): InverseResult {
  if (inputYStr === 'x' || inputYExpStr === 'x') {
    return { status: 'symbolic', values: [], label: 'x' };
  }
  const baseY = parseFloat(inputYStr);
  const expY = parseFloat(inputYExpStr);
  if (!Number.isFinite(baseY) || !Number.isFinite(expY)) {
    return { status: 'none', values: [], label: 'No solution' };
  }
  const targetY = safePow(baseY, expY);
  if (targetY === null) {
    return { status: 'undefined', values: [], label: 'undefined' };
  }

  const usesXInStep = hasVariableInSteps(steps);
  const startVal = getNumericSeed(steps, seedInput, seedExponent);
  const expForX = startVal !== undefined ? '1' : seedExponent;

  // Analytical reverse when no 'x' is inside machine steps and input exponent is integer
  const parsedInputExp = parseValueNumber(expForX);
  const isCleanIntExp =
    expForX !== 'x' && Number.isInteger(parsedInputExp) && parsedInputExp >= 1;

  if (!usesXInStep && isCleanIntExp) {
    let candidates: number[] = [targetY];
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      const next: number[] = [];
      if (step.op === '²') {
        for (const v of candidates) {
          if (v < -1e-9) continue;
          if (Math.abs(v) <= 1e-9) {
            next.push(0);
          } else {
            const r = Math.sqrt(v);
            next.push(-r, r);
          }
        }
      } else if (step.op === '³') {
        for (const v of candidates) {
          next.push(Math.cbrt(v));
        }
      } else {
        const rhsBase = parseValueNumber(step.operand);
        const rhsExp = parseValueNumber(step.exponent);
        const k = safePow(rhsBase, rhsExp);
        if (k === null) {
          return { status: 'undefined', values: [], label: 'undefined' };
        }

        if (step.op === '+') {
          for (const v of candidates) next.push(v - k);
        } else if (step.op === '-') {
          for (const v of candidates) next.push(v + k);
        } else if (step.op === '×') {
          if (Math.abs(k) < 1e-12) {
            const hasZero = candidates.some((v) => Math.abs(v) < 1e-9);
            return hasZero
              ? { status: 'all', values: [], label: 'All real x' }
              : { status: 'none', values: [], label: 'No solution' };
          }
          for (const v of candidates) next.push(v / k);
        } else if (step.op === '÷') {
          if (Math.abs(k) < 1e-12) {
            return { status: 'undefined', values: [], label: 'undefined' };
          }
          for (const v of candidates) next.push(v * k);
        }
      }
      candidates = dedupeAndSort(next);
      if (candidates.length === 0) {
        return { status: 'none', values: [], label: 'No solution' };
      }
    }

    // Invert x^p
    if (parsedInputExp > 1) {
      const next: number[] = [];
      for (const v of candidates) {
        if (parsedInputExp % 2 === 0) {
          if (v < -1e-9) continue;
          if (Math.abs(v) <= 1e-9) {
            next.push(0);
          } else {
            const r = Math.pow(v, 1 / parsedInputExp);
            next.push(-r, r);
          }
        } else {
          const r = Math.sign(v) * Math.pow(Math.abs(v), 1 / parsedInputExp);
          next.push(r);
        }
      }
      candidates = dedupeAndSort(next);
      if (candidates.length === 0) {
        return { status: 'none', values: [], label: 'No solution' };
      }
    }

    const formatted = candidates.map(formatNumber);
    if (
      candidates.length === 2 &&
      Math.abs(candidates[0] + candidates[1]) < 1e-7 &&
      Math.abs(candidates[0]) > 1e-7
    ) {
      return {
        status: 'exact',
        values: candidates,
        label: `±${formatNumber(Math.abs(candidates[1]))}`,
      };
    }
    return { status: 'exact', values: candidates, label: formatted.join(', ') };
  }

  // General numerical solver
  const evalOpts = { startVal, inputExponent: expForX };
  const samples = [-7.3, -2.1, 1.4, 5.7, 11.2];
  const sampleVals = samples
    .map((x) => evaluatePipelineNumeric(steps, x, evalOpts))
    .filter((v): v is number => v !== null);
  if (sampleVals.length >= 4 && sampleVals.every((v) => Math.abs(v - sampleVals[0]) < 1e-8)) {
    if (Math.abs(sampleVals[0] - targetY) < 1e-7) {
      return { status: 'all', values: [], label: 'All real x' };
    }
    return { status: 'none', values: [], label: 'No solution' };
  }

  const roots: number[] = [];
  const f = (x: number): number | null => {
    const y = evaluatePipelineNumeric(steps, x, evalOpts);
    return y === null ? null : y - targetY;
  };

  const scanRanges: Array<[number, number, number]> = [
    [-250, -20, 230],
    [-20, 20, 1200],
    [20, 250, 230],
  ];

  for (const [start, end, count] of scanRanges) {
    const dx = (end - start) / count;
    let prevX = start;
    let prevY = f(prevX);

    for (let i = 1; i <= count; i++) {
      const currX = start + i * dx;
      const currY = f(currX);

      if (prevY !== null && Math.abs(prevY) < 1e-7) {
        roots.push(prevX);
      }

      if (prevY !== null && currY !== null) {
        if (prevY * currY < 0 && Math.abs(currY - prevY) < 200) {
          let lo = prevX;
          let hi = currX;
          let fLo = prevY;
          for (let iter = 0; iter < 50; iter++) {
            const mid = 0.5 * (lo + hi);
            const fMid = f(mid);
            if (fMid === null) break;
            if (Math.abs(fMid) < 1e-10) {
              lo = mid;
              hi = mid;
              break;
            }
            if (fLo * fMid <= 0) {
              hi = mid;
            } else {
              lo = mid;
              fLo = fMid;
            }
          }
          const root = 0.5 * (lo + hi);
          const check = f(root);
          if (check !== null && Math.abs(check) < 1e-4) {
            roots.push(root);
          }
        }
      }

      prevX = currX;
      prevY = currY;
    }
  }

  for (let k = -50; k <= 50; k++) {
    const val = f(k);
    if (val !== null && Math.abs(val) < 1e-8) {
      roots.push(k);
    }
  }

  const cleanRoots = dedupeAndSort(
    roots.map((r) => {
      const nearestInt = Math.round(r);
      return Math.abs(r - nearestInt) < 1e-6 ? nearestInt : r;
    }),
  );

  if (cleanRoots.length === 0) {
    return { status: 'none', values: [], label: 'No solution' };
  }
  if (
    cleanRoots.length === 2 &&
    Math.abs(cleanRoots[0] + cleanRoots[1]) < 1e-6 &&
    Math.abs(cleanRoots[0]) > 1e-6
  ) {
    return {
      status: 'exact',
      values: cleanRoots,
      label: `±${formatNumber(Math.abs(cleanRoots[1]))}`,
    };
  }
  return {
    status: 'exact',
    values: cleanRoots,
    label: cleanRoots.map(formatNumber).join(', '),
  };
}
