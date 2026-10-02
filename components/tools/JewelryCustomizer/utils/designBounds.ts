/** One shared origin keeps text, loops, and backing frames aligned in preview and export. */
export const getDesignBounds = (polygons: number[][][]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const polygon of polygons) for (const [x, y] of polygon) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('设计包含无效坐标。');
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) throw new Error('设计中没有可导出的轮廓。');
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
};
