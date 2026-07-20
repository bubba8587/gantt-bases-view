import { describe, it, expect } from 'vitest';
import { parseDate, parseNumber, parseString, parseArrayOfStrings } from '../src/core/parse.ts';

describe('parseDate', () => {
	it('parses YYYY-MM-DD as local midnight', () => {
		const d = parseDate('2026-04-14')!;
		expect(d.getFullYear()).toBe(2026);
		expect(d.getMonth()).toBe(3);
		expect(d.getDate()).toBe(14);
		expect(d.getHours()).toBe(0);
	});

	it('parses other date strings via Date', () => {
		const d = parseDate('2026-04-14T10:30:00')!;
		expect(d.getHours()).toBe(10);
	});

	it('returns null for null, empty, and invalid input', () => {
		expect(parseDate(null)).toBeNull();
		expect(parseDate(undefined)).toBeNull();
		expect(parseDate('')).toBeNull();
		expect(parseDate('  ')).toBeNull();
		expect(parseDate('not a date')).toBeNull();
	});

	it('stringifies non-string values before parsing', () => {
		expect(parseDate({ toString: () => '2026-01-02' })?.getDate()).toBe(2);
	});
});

describe('parseNumber', () => {
	it('parses numeric strings and numbers', () => {
		expect(parseNumber('480')).toBe(480);
		expect(parseNumber(60)).toBe(60);
		expect(parseNumber('1.5')).toBe(1.5);
	});

	it('treats empty and missing values as null, not zero', () => {
		expect(parseNumber('')).toBeNull();
		expect(parseNumber('   ')).toBeNull();
		expect(parseNumber(null)).toBeNull();
		expect(parseNumber(undefined)).toBeNull();
	});

	it('returns null for non-numeric strings', () => {
		expect(parseNumber('soon')).toBeNull();
	});
});

describe('parseString', () => {
	it('trims and normalizes', () => {
		expect(parseString('  done  ')).toBe('done');
	});

	it('maps null-ish values and stringified null to empty', () => {
		expect(parseString(null)).toBe('');
		expect(parseString(undefined)).toBe('');
		expect(parseString('null')).toBe('');
		expect(parseString('undefined')).toBe('');
	});
});

describe('parseArrayOfStrings', () => {
	it('passes arrays through with trimming and null filtering', () => {
		expect(parseArrayOfStrings([' [[A]] ', null, 'null', '[[B]]'])).toEqual(['[[A]]', '[[B]]']);
	});

	it('splits a scalar string containing multiple wikilinks', () => {
		expect(parseArrayOfStrings('[[A]], [[B]]')).toEqual(['[[A]]', '[[B]]']);
	});

	it('keeps a single value as a one-element array', () => {
		expect(parseArrayOfStrings('[[A]]')).toEqual(['[[A]]']);
		expect(parseArrayOfStrings('Plain name')).toEqual(['Plain name']);
	});

	it('returns [] for empty input', () => {
		expect(parseArrayOfStrings(null)).toEqual([]);
		expect(parseArrayOfStrings('')).toEqual([]);
		expect(parseArrayOfStrings('null')).toEqual([]);
	});
});
