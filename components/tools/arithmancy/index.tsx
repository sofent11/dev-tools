import React, { useMemo, useState } from 'react';
import { Check, Copy, Hash, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Textarea } from '../../ui/ToolUi';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';
import { useI18n } from '../../../src/i18n';
import {
  NUMBER_INTERPRETATIONS,
  calculateCompatibility,
  calculateLifePath,
  calculateNameReading,
  calculatePersonalYear,
  formatLetterTrail,
  formatReductionSteps,
  type ArithmancyNumber,
  type NameReading,
  type NumberCalculation,
  type ReductionResult,
} from './arithmancyCore';

const currentYear = new Date().getFullYear();

const toneStyles = {
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100',
  sky: 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100',
  slate: 'border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-100',
};

type Tone = keyof typeof toneStyles;

const hasNumberMeaning = (value: ArithmancyNumber): value is Exclude<ArithmancyNumber, 0> =>
  value !== 0;

const summarizeKeywords = (
  value: ArithmancyNumber,
  translate: (value: string) => string,
) => {
  if (!hasNumberMeaning(value)) return translate('暂无可计算的拉丁字母');
  return NUMBER_INTERPRETATIONS[value].keywords.map(keyword => translate(keyword)).join(' / ');
};

const summarizeMeaning = (
  value: ArithmancyNumber,
  translate: (value: string) => string,
) => {
  if (!hasNumberMeaning(value)) return translate('请输入拼音或英文后生成解读。');
  const meaning = NUMBER_INTERPRETATIONS[value];
  return [meaning.strength, meaning.challenge, meaning.advice].map(item => translate(item));
};

const formatCalculation = (
  calculation: NumberCalculation,
  translate: (value: string) => string,
) => {
  if (calculation.letters.length === 0) return translate('暂无可计算的拉丁字母');
  const rest = calculation.reduction.steps.slice(1);
  return `${formatLetterTrail(calculation.letters)} = ${calculation.total}${rest.length ? ` -> ${rest.join(' -> ')}` : ''}`;
};

const formatReduction = (reduction: ReductionResult) => formatReductionSteps(reduction);

const NumberTile: React.FC<{
  title: string;
  value: ArithmancyNumber | null;
  subtitle?: string;
  tone?: Tone;
}> = ({ title, value, subtitle, tone = 'slate' }) => (
  <div className={`tool-panel min-h-[8.25rem] rounded-lg border p-4 ${toneStyles[tone]}`}>
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="text-xs font-semibold uppercase tracking-wide opacity-75">{title}</div>
      {value === 11 || value === 22 || value === 33 ? (
        <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide opacity-80">
          大师数字
        </span>
      ) : null}
    </div>
    <div className="font-mono text-4xl font-black leading-none tracking-normal">{value || '-'}</div>
    {subtitle && <div className="mt-3 text-xs font-medium leading-5 opacity-80">{subtitle}</div>}
  </div>
);

const MeaningPanel: React.FC<{
  title: string;
  value: ArithmancyNumber;
  translate: (value: string) => string;
}> = ({ title, value, translate }) => {
  const lines = summarizeMeaning(value, translate);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-100">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span>{title}</span>
      </div>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {summarizeKeywords(value, translate)}
      </div>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 dark:text-slate-300 md:grid-cols-3">
        <p><span className="font-semibold text-slate-950 dark:text-slate-100">{translate('优势')}：</span>{lines[0]}</p>
        <p><span className="font-semibold text-slate-950 dark:text-slate-100">{translate('挑战')}：</span>{lines[1]}</p>
        <p><span className="font-semibold text-slate-950 dark:text-slate-100">{translate('建议')}：</span>{lines[2]}</p>
      </div>
    </div>
  );
};

const TrailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
    <div className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div>
    <div className="break-words font-mono text-xs leading-5 text-slate-800 dark:text-slate-200">{value}</div>
  </div>
);

const hasLatinLetters = (reading: NameReading) => reading.expression.letters.length > 0;

export const ArithmancyTool: React.FC = () => {
  const { t } = useI18n();
  const { copied, copy } = useCopyToClipboard();
  const [birthDate, setBirthDate] = useState('1980-07-31');
  const [name, setName] = useState('Harry Potter');
  const [keyword, setKeyword] = useState('friendship');
  const [targetYear, setTargetYear] = useState(String(currentYear));
  const [partnerName, setPartnerName] = useState('Hermione Granger');

  const targetYearNumber = Number(targetYear) || currentYear;
  const lifePath = useMemo(() => calculateLifePath(birthDate), [birthDate]);
  const nameReading = useMemo(() => calculateNameReading(name), [name]);
  const keywordReading = useMemo(() => calculateNameReading(keyword), [keyword]);
  const personalYear = useMemo(
    () => calculatePersonalYear(birthDate, targetYearNumber),
    [birthDate, targetYearNumber],
  );
  const compatibility = useMemo(
    () => calculateCompatibility(name, partnerName),
    [name, partnerName],
  );

  const hasNameReading = hasLatinLetters(nameReading);
  const hasKeywordReading = hasLatinLetters(keywordReading);
  const hasPartnerReading = hasLatinLetters(compatibility.second);
  const relationNumber = hasNameReading && hasPartnerReading ? compatibility.reduction.value : 0;

  const ignoredCharacters = [
    ...nameReading.ignoredCharacters,
    ...keywordReading.ignoredCharacters,
    ...compatibility.second.ignoredCharacters,
  ];

  const report = useMemo(() => {
    const lines = [
      t('数字占卜报告'),
      `${t('出生日期')}: ${birthDate || t('未填写')}`,
      `${t('姓名或拼音')}: ${name || t('未填写')}`,
    ];

    if (lifePath) {
      lines.push(`${t('生命路径数字')}: ${lifePath.reduction.value} (${summarizeKeywords(lifePath.reduction.value, t)})`);
    }
    if (hasNameReading) {
      lines.push(`${t('表达数字')}: ${nameReading.expression.reduction.value} (${summarizeKeywords(nameReading.expression.reduction.value, t)})`);
      lines.push(`${t('灵魂渴望数字')}: ${nameReading.soul.reduction.value} (${summarizeKeywords(nameReading.soul.reduction.value, t)})`);
      lines.push(`${t('人格数字')}: ${nameReading.personality.reduction.value} (${summarizeKeywords(nameReading.personality.reduction.value, t)})`);
    }
    if (personalYear) {
      lines.push(`${targetYearNumber} ${t('个人年数字')}: ${personalYear.value} (${summarizeKeywords(personalYear.value, t)})`);
    }
    if (hasKeywordReading) {
      lines.push(`${t('问题关键词数字')}: ${keywordReading.expression.reduction.value} (${summarizeKeywords(keywordReading.expression.reduction.value, t)})`);
    }
    if (relationNumber) {
      lines.push(`${t('关系主题数字')}: ${relationNumber} (${summarizeKeywords(relationNumber, t)})`);
    }

    lines.push(t('数字占卜用于娱乐与自我反思，不作为科学预测。'));
    return lines.join('\n');
  }, [
    birthDate,
    hasKeywordReading,
    hasNameReading,
    keywordReading.expression.reduction.value,
    lifePath,
    name,
    nameReading.expression.reduction.value,
    nameReading.personality.reduction.value,
    nameReading.soul.reduction.value,
    personalYear,
    relationNumber,
    t,
    targetYearNumber,
  ]);

  const lifePathSubtitle = lifePath
    ? summarizeKeywords(lifePath.reduction.value, t)
    : t('日期格式无效');
  const expressionSubtitle = summarizeKeywords(nameReading.expression.reduction.value, t);
  const keywordSubtitle = summarizeKeywords(keywordReading.expression.reduction.value, t);
  const personalYearSubtitle = personalYear
    ? summarizeKeywords(personalYear.value, t)
    : t('日期格式无效');
  const relationSubtitle = summarizeKeywords(relationNumber, t);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="数字占卜台"
        description="基于生日、姓名拼音和关键词计算生命路径、姓名数字、个人年与关系主题。"
        actions={
          <Button
            size="sm"
            onClick={() => copy(report)}
            icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          >
            {copied ? '已复制' : '复制报告'}
          </Button>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-5 overflow-auto lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="sticky top-0 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-100">
                <Hash className="h-4 w-4 text-sky-500" />
                <span>输入信息</span>
              </div>
              <div className="space-y-4">
                <div>
                  <FieldLabel>出生日期</FieldLabel>
                  <Input type="date" value={birthDate} onChange={event => setBirthDate(event.target.value)} />
                </div>
                <div>
                  <FieldLabel hint="中文姓名请用拼音或英文输入。">姓名或拼音</FieldLabel>
                  <Input
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="Harry Potter"
                  />
                </div>
                <div>
                  <FieldLabel>问题关键词</FieldLabel>
                  <Input
                    value={keyword}
                    onChange={event => setKeyword(event.target.value)}
                    placeholder="friendship / career / change"
                  />
                </div>
                <div>
                  <FieldLabel>目标年份</FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    max="9999"
                    value={targetYear}
                    onChange={event => setTargetYear(event.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel hint="用于计算关系主题数字。">兼容对象姓名</FieldLabel>
                  <Input
                    value={partnerName}
                    onChange={event => setPartnerName(event.target.value)}
                    placeholder="Hermione Granger"
                  />
                </div>
              </div>
            </div>

            {ignoredCharacters.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                检测到非拉丁字符，已忽略；中文姓名请先转写为拼音。
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              数字占卜用于娱乐与自我反思，不作为科学预测。
            </div>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-8">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <NumberTile title={t('生命路径')} value={lifePath?.reduction.value ?? null} subtitle={lifePathSubtitle} tone="amber" />
            <NumberTile title={t('表达数字')} value={hasNameReading ? nameReading.expression.reduction.value : 0} subtitle={expressionSubtitle} tone="sky" />
            <NumberTile title={t('个人年')} value={personalYear?.value ?? null} subtitle={personalYearSubtitle} tone="emerald" />
            <NumberTile title={t('关系主题')} value={relationNumber} subtitle={relationSubtitle} tone="rose" />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <NumberTile title={t('灵魂渴望')} value={hasNameReading ? nameReading.soul.reduction.value : 0} subtitle={summarizeKeywords(nameReading.soul.reduction.value, t)} />
            <NumberTile title={t('人格数字')} value={hasNameReading ? nameReading.personality.reduction.value : 0} subtitle={summarizeKeywords(nameReading.personality.reduction.value, t)} />
            <NumberTile title={t('问题关键词')} value={hasKeywordReading ? keywordReading.expression.reduction.value : 0} subtitle={keywordSubtitle} />
          </div>

          <div className="grid gap-3">
            {lifePath && (
              <MeaningPanel title={t('生命路径解读')} value={lifePath.reduction.value} translate={t} />
            )}
            {hasNameReading && (
              <MeaningPanel title={t('姓名核心解读')} value={nameReading.expression.reduction.value} translate={t} />
            )}
            {relationNumber ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-slate-100">{t('兼容度解读')}</div>
                <div className="grid gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300 md:grid-cols-3">
                  <p><span className="font-semibold text-slate-950 dark:text-slate-100">{t('共同优势')}：</span>{t(NUMBER_INTERPRETATIONS[relationNumber].strength)}</p>
                  <p><span className="font-semibold text-slate-950 dark:text-slate-100">{t('摩擦点')}：</span>{t(NUMBER_INTERPRETATIONS[relationNumber].challenge)}</p>
                  <p><span className="font-semibold text-slate-950 dark:text-slate-100">{t('相处建议')}：</span>{t(NUMBER_INTERPRETATIONS[relationNumber].advice)}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-slate-100">{t('计算轨迹')}</div>
            <div className="grid gap-3">
              {lifePath ? (
                <>
                  <TrailRow label={t('生命路径拆解')} value={`${t('年份')} ${lifePath.year.value}: ${formatReduction(lifePath.year.reduction)} | ${t('月份')} ${lifePath.month.value}: ${formatReduction(lifePath.month.reduction)} | ${t('日期')} ${lifePath.day.value}: ${formatReduction(lifePath.day.reduction)}`} />
                  <TrailRow label={t('生命路径合计')} value={`${lifePath.year.reduction.value} + ${lifePath.month.reduction.value} + ${lifePath.day.reduction.value} = ${lifePath.total} -> ${formatReduction(lifePath.reduction)}`} />
                </>
              ) : (
                <TrailRow label={t('生命路径拆解')} value={t('日期格式无效')} />
              )}
              <TrailRow label={t('表达数字')} value={formatCalculation(nameReading.expression, t)} />
              <TrailRow label={t('灵魂渴望数字')} value={formatCalculation(nameReading.soul, t)} />
              <TrailRow label={t('人格数字')} value={formatCalculation(nameReading.personality, t)} />
              <TrailRow label={t('问题关键词数字')} value={formatCalculation(keywordReading.expression, t)} />
              {personalYear && (
                <TrailRow label={t('个人年数字')} value={`${birthDate.slice(5)} + ${targetYearNumber} -> ${formatReduction(personalYear)}`} />
              )}
              {relationNumber ? (
                <TrailRow label={t('关系主题数字')} value={`${compatibility.first.expression.reduction.value} + ${compatibility.second.expression.reduction.value} = ${compatibility.combinedTotal} -> ${formatReduction(compatibility.reduction)}`} />
              ) : (
                <TrailRow label={t('关系主题数字')} value={t('请输入两组拼音或英文姓名')} />
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="mb-2 text-sm font-semibold text-slate-950 dark:text-slate-100">{t('报告预览')}</div>
            <Textarea readOnly value={report} className="min-h-40 resize-none bg-white font-mono text-xs dark:bg-slate-900" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
