import { describe, it, expect } from 'vitest';
import {
  parseSekAmount,
  parseMeasurement,
  parsePercent,
  formatSek,
} from '../src/money.js';

describe('parseSekAmount', () => {
  it('parses space-grouped kronor', () => {
    expect(parseSekAmount('3 995 000 kr')).toBe(3995000);
  });
  it('parses non-breaking-space and per-month/per-m² suffixes', () => {
    expect(parseSekAmount('4 689 kr/mån')).toBe(4689);
    expect(parseSekAmount('92 969 kr/m²')).toBe(92969);
  });
  it('parses a comma decimal', () => {
    expect(parseSekAmount('1 234,50 kr')).toBe(1234.5);
  });
  it('parses signed values', () => {
    expect(parseSekAmount('-5 000 kr')).toBe(-5000);
  });
  it('returns null for null/undefined/empty/no-digit input', () => {
    expect(parseSekAmount(null)).toBeNull();
    expect(parseSekAmount(undefined)).toBeNull();
    expect(parseSekAmount('')).toBeNull();
    expect(parseSekAmount('–')).toBeNull();
  });
});

describe('parseMeasurement / parsePercent', () => {
  it('parses m² and rum', () => {
    expect(parseMeasurement('64 m²')).toBe(64);
    expect(parseMeasurement('2 rum')).toBe(2);
  });
  it('parses signed percents', () => {
    expect(parsePercent('+3 %')).toBe(3);
    expect(parsePercent('-5 %')).toBe(-5);
    expect(parsePercent(null)).toBeNull();
  });
});

describe('formatSek', () => {
  it('groups thousands and appends kr', () => {
    expect(formatSek(3995000)).toBe('3 995 000 kr');
    expect(formatSek(999)).toBe('999 kr');
  });
  it('rounds and handles negatives', () => {
    expect(formatSek(1234.6)).toBe('1 235 kr');
    expect(formatSek(-4200)).toBe('-4 200 kr');
  });
});
