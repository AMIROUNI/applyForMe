import { computeProgress, lerp, shouldSeek, smoothstep } from './hero-scroll-video.util';

describe('hero-scroll-video utilities', () => {
  describe('computeProgress', () => {
    it('returns 0 before section', () => {
      const result = computeProgress(0, 1000, 2000, 800);
      expect(result).toBe(0);
    });

    it('returns 1 after section', () => {
      const result = computeProgress(5000, 1000, 2000, 800);
      expect(result).toBe(1);
    });

    it('returns clamped value inside section', () => {
      const result = computeProgress(1500, 1000, 2000, 800);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('returns 0.5 at middle of section', () => {
      const sectionTop = 1000;
      const sectionHeight = 2000;
      const viewportHeight = 800;
      const middle = sectionTop + (sectionHeight - viewportHeight) / 2;
      const result = computeProgress(middle, sectionTop, sectionHeight, viewportHeight);
      expect(result).toBeCloseTo(0.5, 1);
    });
  });

  describe('lerp', () => {
    it('returns current when factor is 0', () => {
      expect(lerp(10, 20, 0)).toBe(10);
    });

    it('returns target when factor is 1', () => {
      expect(lerp(10, 20, 1)).toBe(20);
    });

    it('interpolates correctly at 0.5', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
    });

    it('handles negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
    });
  });

  describe('shouldSeek', () => {
    it('returns true when difference exceeds threshold', () => {
      const duration = 8;
      const threshold = duration / 60;
      expect(shouldSeek(0, threshold + 0.1, duration)).toBe(true);
    });

    it('returns false when difference is below threshold', () => {
      const duration = 8;
      const threshold = duration / 60;
      expect(shouldSeek(0, threshold / 2, duration)).toBe(false);
    });
  });

  describe('smoothstep', () => {
    it('returns 0 below edge0', () => {
      expect(smoothstep(0, 1, -0.5)).toBe(0);
    });

    it('returns 1 above edge1', () => {
      expect(smoothstep(0, 1, 1.5)).toBe(1);
    });

    it('returns 0.5 at midpoint', () => {
      expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 1);
    });

    it('is smooth at edges', () => {
      expect(smoothstep(0, 1, 0)).toBe(0);
      expect(smoothstep(0, 1, 1)).toBe(1);
    });
  });
});