import { describe, expect, it } from 'vitest';
import { formatDate, formatRating, languageLabel, results } from '../utils/format';

describe('format utils', () => {
  it('formats ratings', () => {
    expect(formatRating('4.25')).toBe('4.3');
    expect(formatRating(null)).toBe('—');
    expect(formatRating(undefined)).toBe('—');
    expect(formatRating('abc')).toBe('—');
  });

  it('formats dates defensively', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate('2024-03-05T10:00:00Z')).toMatch(/05\/03\/2024/);
  });

  it('maps language codes', () => {
    expect(languageLabel('es')).toBe('Español');
    expect(languageLabel('xx')).toBe('XX');
    expect(languageLabel('')).toBe('—');
  });

  it('extracts results from paginated and plain responses', () => {
    expect(results({ results: [1, 2] })).toEqual([1, 2]);
    expect(results([3])).toEqual([3]);
    expect(results(undefined)).toEqual([]);
  });
});
