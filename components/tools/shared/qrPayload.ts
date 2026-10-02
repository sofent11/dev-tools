export const escapeWifiValue = (value: string) => value.replace(/[\\;,:"]/g, character => `\\${character}`);
export const escapeCardValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/[,;]/g, character => `\\${character}`);
export const buildWifiQr = (wifi: { ssid: string; password: string; encryption: string }) => `WIFI:T:${wifi.encryption};S:${escapeWifiValue(wifi.ssid)};P:${wifi.encryption === 'nopass' ? '' : escapeWifiValue(wifi.password)};;`;
export function buildEventQr(event: { title: string; start: string; end: string }): string {
  const parse = (input: string) => {
    const match = input.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (!match) throw new Error('时间格式需要为 YYYYMMDDTHHmmss，可加 Z 表示 UTC。');
    const [, year, month, day, hour, minute, second] = match;
    const values = [year, month, day, hour, minute, second].map(Number);
    const date = new Date(0);
    date.setUTCFullYear(values[0], values[1] - 1, values[2]);
    date.setUTCHours(values[3], values[4], values[5], 0);
    if ([date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].some((value, index) => value !== values[index])) throw new Error('请输入真实有效的日期和时间。');
    return date.getTime();
  };
  if (event.start.endsWith('Z') !== event.end.endsWith('Z')) throw new Error('开始和结束时间需要使用相同的时区格式。');
  if (parse(event.end) <= parse(event.start)) throw new Error('结束时间需要晚于开始时间。');
  return `BEGIN:VEVENT\nSUMMARY:${escapeCardValue(event.title)}\nDTSTART:${event.start}\nDTEND:${event.end}\nEND:VEVENT`;
}
