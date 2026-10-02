export function localDatetimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function parseDateInput(input: string): Date {
  return new Date(input.trim().replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T'));
}
export function dayProgress(date: Date): { percent: number; remainingSeconds: number } {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { percent: (date.getTime() - start.getTime()) / (end.getTime() - start.getTime()) * 100, remainingSeconds: Math.ceil((end.getTime() - date.getTime()) / 1000) };
}
