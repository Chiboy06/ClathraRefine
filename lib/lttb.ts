/** Largest-Triangle-Three-Buckets downsampling for long chart ranges. Keeps first and last points. */
export function lttb<T>(data: T[], threshold: number, x: (d: T) => number, y: (d: T) => number): T[] {
  if (threshold >= data.length || threshold < 3) return data;
  const out: T[] = [data[0]];
  const every = (data.length - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgStart = Math.floor((i + 1) * every) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, data.length);
    let avgX = 0, avgY = 0;
    for (let j = avgStart; j < avgEnd; j++) {
      avgX += x(data[j]);
      avgY += y(data[j]);
    }
    const len = avgEnd - avgStart || 1;
    avgX /= len;
    avgY /= len;
    const start = Math.floor(i * every) + 1;
    const end = Math.floor((i + 1) * every) + 1;
    let maxArea = -1, next = start;
    for (let j = start; j < end; j++) {
      const area = Math.abs((x(data[a]) - avgX) * (y(data[j]) - y(data[a])) - (x(data[a]) - x(data[j])) * (avgY - y(data[a])));
      if (area > maxArea) {
        maxArea = area;
        next = j;
      }
    }
    out.push(data[next]);
    a = next;
  }
  out.push(data[data.length - 1]);
  return out;
}
