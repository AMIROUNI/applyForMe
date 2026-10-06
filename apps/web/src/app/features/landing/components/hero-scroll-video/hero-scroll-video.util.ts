export function computeProgress(
  scrollY: number,
  sectionTop: number,
  sectionHeight: number,
  viewportHeight: number,
): number {
  const start = sectionTop;
  const end = sectionTop + sectionHeight - viewportHeight;
  const progress = (scrollY - start) / (end - start);
  return Math.max(0, Math.min(1, progress));
}

export function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

export function shouldSeek(currentTime: number, targetTime: number, duration: number): boolean {
  const threshold = duration / 60;
  return Math.abs(targetTime - currentTime) > threshold;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
