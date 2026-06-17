// Precise mathematical marching edge boundary crawler
export const runMarchingEdges = (canvas: HTMLCanvasElement, threshold: number, invert: boolean, simplifyTol: number): string => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const binary = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const a = data[i+3];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const isFg = a > 50 && gray < threshold;
    binary[i/4] = invert ? (isFg ? 0 : 1) : (isFg ? 1 : 0);
  }

  const getVal = (col: number, row: number) => {
    if (col < 0 || col >= w || row < 0 || row >= h) return 0;
    return binary[row * w + col];
  };

  const adj = new Map<string, string>();
  for (let r = 0; r <= h; r++) {
    for (let c = 0; c <= w; c++) {
      const val = getVal(c, r);
      const valLeft = getVal(c - 1, r);
      const valUp = getVal(c, r - 1);

      if (val !== valUp) {
        const start = val ? `${c+1},${r}` : `${c},${r}`;
        const end = val ? `${c},${r}` : `${c+1},${r}`;
        adj.set(start, end);
      }

      if (val !== valLeft) {
        const start = val ? `${c},${r}` : `${c},${r+1}`;
        const end = val ? `${c},${r+1}` : `${c},${r}`;
        adj.set(start, end);
      }
    }
  }

  const visited = new Set<string>();
  const loops: [number, number][][] = [];

  for (const startKey of adj.keys()) {
    if (visited.has(startKey)) continue;

    const loop: [number, number][] = [];
    let curr = startKey;
    while (curr && !visited.has(curr)) {
      visited.add(curr);
      const [x, y] = curr.split(',').map(Number);
      loop.push([x, y]);
      curr = adj.get(curr) || '';
      if (curr === startKey) {
        break;
      }
    }
    if (loop.length > 2) {
      loops.push(loop);
    }
  }

  let pathD = '';
  loops.forEach(loop => {
    let pts = loop;
    if (simplifyTol > 0) {
      pts = simplifyCollinearPath(loop, simplifyTol);
    }
    if (pts.length < 3) return;
    pathD += `M ${pts[0][0]} ${pts[0][1]} `;
    for (let i = 1; i < pts.length; i++) {
      pathD += `L ${pts[i][0]} ${pts[i][1]} `;
    }
    pathD += 'Z ';
  });

  return pathD.trim();
};

export const simplifyCollinearPath = (points: [number, number][], tol: number): [number, number][] => {
  if (points.length < 3) return points;
  const result: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr[0] - prev[0];
    const dy1 = curr[1] - prev[1];
    const dx2 = next[0] - curr[0];
    const dy2 = next[1] - curr[1];

    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) > tol * 0.25) {
      result.push(curr);
    }
  }
  result.push(points[points.length - 1]);
  return result;
};
