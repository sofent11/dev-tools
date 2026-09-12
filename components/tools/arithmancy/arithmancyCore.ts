export const MASTER_NUMBERS = [11, 22, 33] as const;

export type MasterNumber = typeof MASTER_NUMBERS[number];
export type ArithmancyNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | MasterNumber;

export interface ReductionResult {
  value: ArithmancyNumber;
  steps: number[];
  isMaster: boolean;
}

export interface LetterMapping {
  letter: string;
  value: number;
}

export interface NameReading {
  source: string;
  normalized: string;
  ignoredCharacters: string[];
  expression: NumberCalculation;
  soul: NumberCalculation;
  personality: NumberCalculation;
}

export interface NumberCalculation {
  letters: LetterMapping[];
  total: number;
  reduction: ReductionResult;
}

export interface LifePathResult {
  year: DatePartCalculation;
  month: DatePartCalculation;
  day: DatePartCalculation;
  total: number;
  reduction: ReductionResult;
}

export interface DatePartCalculation {
  value: number;
  digitSum: number;
  reduction: ReductionResult;
}

export interface CompatibilityResult {
  first: NameReading;
  second: NameReading;
  combinedTotal: number;
  reduction: ReductionResult;
}

export interface NumberInterpretation {
  keywords: string[];
  strength: string;
  challenge: string;
  advice: string;
}

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const NUMBER_INTERPRETATIONS: Record<Exclude<ArithmancyNumber, 0>, NumberInterpretation> = {
  1: {
    keywords: ['独立', '开端', '自我', '领导'],
    strength: '适合开局、决策和承担主导。',
    challenge: '容易把独立变成逞强。',
    advice: '把目标拆成一个可执行的第一步。',
  },
  2: {
    keywords: ['平衡', '合作', '敏感', '关系'],
    strength: '擅长连接人、调和节奏和照顾细节。',
    challenge: '容易为了和谐压低自己的需求。',
    advice: '先确认边界，再投入协作。',
  },
  3: {
    keywords: ['表达', '社交', '乐观', '创造'],
    strength: '能把感受、想法和灵感转成可见作品。',
    challenge: '容易分心，或把情绪包装成玩笑。',
    advice: '选择一个出口，把灵感持续发布出来。',
  },
  4: {
    keywords: ['稳定', '秩序', '务实', '结构'],
    strength: '适合搭建流程、复盘细节和长期执行。',
    challenge: '容易过度控制，抗拒必要变化。',
    advice: '给计划预留弹性，不必把所有答案一次写死。',
  },
  5: {
    keywords: ['变化', '自由', '冒险', '突破'],
    strength: '善于探索新机会，也能快速适应环境。',
    challenge: '容易追逐刺激而忽略承诺。',
    advice: '把自由放进规则里，用小实验代替冲动跳跃。',
  },
  6: {
    keywords: ['责任', '关爱', '和谐', '服务'],
    strength: '能照看关系、空间和长期承诺。',
    challenge: '容易过度承担，把帮助变成压力。',
    advice: '分清照顾与拯救，让爱保留呼吸感。',
  },
  7: {
    keywords: ['智慧', '内省', '灵性', '研究'],
    strength: '适合深度学习、观察模式和独立思考。',
    challenge: '容易退回孤岛，或用分析回避感受。',
    advice: '保留独处，也把关键发现说给可信的人听。',
  },
  8: {
    keywords: ['成就', '权力', '资源', '因果'],
    strength: '擅长管理资源、推进目标和承担结果。',
    challenge: '容易把价值感绑在控制与输赢上。',
    advice: '把野心和伦理一起写进决策标准。',
  },
  9: {
    keywords: ['慈悲', '完成', '理想', '整合'],
    strength: '能看见更大的图景，并把经验转化为贡献。',
    challenge: '容易沉溺旧故事，或过度牺牲。',
    advice: '完成该完成的，也温柔地放下该放下的。',
  },
  11: {
    keywords: ['直觉', '启发', '灵感', '敏锐'],
    strength: '能捕捉微妙信号，并把洞见点亮给他人。',
    challenge: '能量敏感，容易焦虑或理想化。',
    advice: '用规律作息和具体行动承接灵感。',
  },
  22: {
    keywords: ['建造', '愿景', '落地', '规模'],
    strength: '有把长期理想建成现实系统的潜力。',
    challenge: '愿景过大时，容易拖延或背负过重责任。',
    advice: '把宏大蓝图切成可验证的阶段成果。',
  },
  33: {
    keywords: ['疗愈', '教导', '利他', '慈悲'],
    strength: '能以温柔而稳定的方式支持他人成长。',
    challenge: '容易过度奉献，忘记自己也需要被照顾。',
    advice: '先让自己的杯子有水，再把光分享出去。',
  },
};

export const letterValue = (character: string): number | null => {
  const normalized = character.trim().toUpperCase();
  if (!/^[A-Z]$/.test(normalized)) return null;
  return ((normalized.charCodeAt(0) - 65) % 9) + 1;
};

const isMasterNumber = (value: number): value is MasterNumber =>
  MASTER_NUMBERS.includes(value as MasterNumber);

const sumDigits = (value: number | string) =>
  String(value)
    .replace(/\D/g, '')
    .split('')
    .reduce((sum, digit) => sum + Number(digit), 0);

export const reduceNumber = (value: number): ReductionResult => {
  const steps = [Math.max(0, Math.trunc(Math.abs(value)))];

  while (steps[steps.length - 1] > 9 && !isMasterNumber(steps[steps.length - 1])) {
    steps.push(sumDigits(steps[steps.length - 1]));
  }

  const reduced = steps[steps.length - 1] as ArithmancyNumber;
  return {
    value: reduced,
    steps,
    isMaster: isMasterNumber(reduced),
  };
};

const calculateLetters = (letters: LetterMapping[]): NumberCalculation => {
  const total = letters.reduce((sum, item) => sum + item.value, 0);
  return {
    letters,
    total,
    reduction: reduceNumber(total),
  };
};

const collectNameLetters = (source: string) => {
  const letters: LetterMapping[] = [];
  const ignoredCharacters: string[] = [];

  for (const character of Array.from(source)) {
    if (/[\s'-]/.test(character)) continue;
    const value = letterValue(character);
    if (value === null) {
      ignoredCharacters.push(character);
      continue;
    }
    letters.push({ letter: character.toUpperCase(), value });
  }

  return { letters, ignoredCharacters };
};

export const calculateNameReading = (source: string): NameReading => {
  const { letters, ignoredCharacters } = collectNameLetters(source);
  const soulLetters = letters.filter(item => VOWELS.has(item.letter));
  const personalityLetters = letters.filter(item => !VOWELS.has(item.letter));

  return {
    source,
    normalized: letters.map(item => item.letter).join(''),
    ignoredCharacters,
    expression: calculateLetters(letters),
    soul: calculateLetters(soulLetters),
    personality: calculateLetters(personalityLetters),
  };
};

const parseDateInput = (dateInput: string | Date) => {
  if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) return null;
    return {
      year: dateInput.getFullYear(),
      month: dateInput.getMonth() + 1,
      day: dateInput.getDate(),
    };
  }

  const match = dateInput.match(DATE_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  return isValid ? { year, month, day } : null;
};

const calculateDatePart = (value: number): DatePartCalculation => {
  const digitSum = sumDigits(value);
  return {
    value,
    digitSum,
    reduction: reduceNumber(digitSum),
  };
};

export const calculateLifePath = (dateInput: string | Date): LifePathResult | null => {
  const parts = parseDateInput(dateInput);
  if (!parts) return null;

  const year = calculateDatePart(parts.year);
  const month = calculateDatePart(parts.month);
  const day = calculateDatePart(parts.day);
  const total = year.reduction.value + month.reduction.value + day.reduction.value;

  return {
    year,
    month,
    day,
    total,
    reduction: reduceNumber(total),
  };
};

export const calculatePersonalYear = (
  dateInput: string | Date,
  targetYear: number,
): ReductionResult | null => {
  const parts = parseDateInput(dateInput);
  if (!parts || !Number.isFinite(targetYear)) return null;

  return reduceNumber(sumDigits(parts.month) + sumDigits(parts.day) + sumDigits(Math.trunc(targetYear)));
};

export const calculateCompatibility = (
  firstName: string,
  secondName: string,
): CompatibilityResult => {
  const first = calculateNameReading(firstName);
  const second = calculateNameReading(secondName);
  const combinedTotal = first.expression.reduction.value + second.expression.reduction.value;

  return {
    first,
    second,
    combinedTotal,
    reduction: reduceNumber(combinedTotal),
  };
};

export const formatReductionSteps = (reduction: ReductionResult) =>
  reduction.steps.join(' -> ');

export const formatLetterTrail = (letters: LetterMapping[]) =>
  letters.map(item => `${item.letter}=${item.value}`).join(' + ');
