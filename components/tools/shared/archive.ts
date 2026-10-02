export const uniqueArchiveName = (name: string, used: Set<string>): string => {
  const cleaned = (name.split(/[\\/]/).pop() || 'item.txt')
    .replace(/[<>:"|?*]/g, '_').split('').map(char => char.charCodeAt(0) < 32 ? '_' : char).join('').replace(/[. ]+$/g, '') || 'item.txt';
  const dot = cleaned.lastIndexOf('.');
  const stem = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  const ext = dot > 0 ? cleaned.slice(dot) : '';
  let candidate = cleaned;
  for (let suffix = 2; used.has(candidate.toLowerCase()); suffix++) candidate = `${stem} (${suffix})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
};
