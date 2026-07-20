import { describe, it, expect } from 'vitest';
import {
	addDays,
	columnsWidth,
	daysBetween,
	dateToPixelOffset,
	fitZoomToViewport,
	formatDate,
	generateColumns,
	getPixelsPerDay,
	getTaskBarBounds,
	snapToDay,
} from '../src/core/timeline.ts';
import { makeConfig, makeTask } from './helpers.ts';

describe('day arithmetic', () => {
	it('daysBetween counts calendar days', () => {
		expect(daysBetween(new Date(2026, 3, 1), new Date(2026, 3, 15))).toBe(14);
		expect(daysBetween(new Date(2026, 3, 15), new Date(2026, 3, 1))).toBe(-14);
		expect(daysBetween(new Date(2026, 3, 1), new Date(2026, 3, 1))).toBe(0);
	});

	it('daysBetween is exact across a US DST transition (Mar 8 2026)', () => {
		// In a DST timezone Mar 7 → Mar 10 is 71 wall-clock hours; still 3 days.
		expect(daysBetween(new Date(2026, 2, 7), new Date(2026, 2, 10))).toBe(3);
	});

	it('addDays crosses month boundaries', () => {
		expect(formatDate(addDays(new Date(2026, 3, 28), 5))).toBe('2026-05-03');
		expect(formatDate(addDays(new Date(2026, 4, 3), -5))).toBe('2026-04-28');
	});

	it('snapToDay zeroes the time of day', () => {
		const d = snapToDay(new Date(2026, 3, 14, 17, 45, 12));
		expect(d.getHours()).toBe(0);
		expect(d.getDate()).toBe(14);
	});

	it('formatDate pads to YYYY-MM-DD', () => {
		expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
	});
});

describe('dateToPixelOffset', () => {
	it('aligns exactly with the day grid, including across DST', () => {
		const config = makeConfig(new Date(2026, 2, 1), new Date(2026, 4, 1), 'day');
		// 31 days in March — Apr 1 must land exactly at 31 * 40px even in
		// timezones where March has a 23-hour day.
		expect(dateToPixelOffset(new Date(2026, 3, 1), config)).toBe(31 * 40);
	});

	it('preserves intra-day position for times within a day', () => {
		const config = makeConfig(new Date(2026, 2, 1), new Date(2026, 2, 20), 'day');
		const noon = new Date(2026, 2, 2, 12, 0, 0);
		expect(dateToPixelOffset(noon, config)).toBe(40 + 20);
	});
});

describe('fitZoomToViewport', () => {
	it('scales year zooms so exactly N years span the viewport width', () => {
		// Regression: with the fixed fallback densities, a ~1100px viewport
		// showed ~3 years at "1Y", ~6 at "2Y", and ~9 at "3Y".
		const viewport = 1100;
		for (const [zoom, years] of [['1year', 1], ['2year', 2], ['3year', 3]] as const) {
			const base = makeConfig(new Date(2026, 0, 1), new Date(2033, 0, 1), zoom);
			const fitted = fitZoomToViewport(base, viewport);
			const nYearsLater = new Date(2026 + years, 0, 1);
			// N years from the start lands at the right edge of the viewport (±5px
			// for leap-year drift against the 365.25-day average).
			expect(Math.abs(dateToPixelOffset(nYearsLater, fitted) - viewport)).toBeLessThanOrEqual(5);
		}
	});

	it('leaves fixed-density zooms and zero-width viewports unchanged', () => {
		const day = makeConfig(new Date(2026, 0, 1), new Date(2026, 5, 1), 'day');
		expect(fitZoomToViewport(day, 1100)).toEqual(day);

		const year = makeConfig(new Date(2026, 0, 1), new Date(2027, 0, 1), '2year');
		expect(fitZoomToViewport(year, 0)).toEqual(year);
	});
});

describe('generateColumns', () => {
	it('day zoom: one column per day, banded by month', () => {
		const config = makeConfig(new Date(2026, 3, 29), new Date(2026, 4, 2), 'day');
		const cols = generateColumns(config);
		expect(cols.map(c => c.label)).toEqual(['29', '30', '1', '2']);
		expect(cols[0].group).toBe('Apr 2026');
		expect(cols[2].group).toBe('May 2026');
	});

	it('week zoom: ISO week labels from Monday-snapped columns', () => {
		// Mon Apr 6 2026 starts ISO week 15.
		const config = makeConfig(new Date(2026, 3, 6), new Date(2026, 3, 19), 'week');
		const cols = generateColumns(config);
		expect(cols.map(c => c.label)).toEqual(['W15', 'W16']);
		expect(cols[0].group).toBe('2026');
	});

	it('month zoom: column widths match the days in each month', () => {
		const config = makeConfig(new Date(2026, 0, 1), new Date(2026, 2, 31), 'month');
		const cols = generateColumns(config);
		expect(cols.map(c => c.label)).toEqual(['Jan', 'Feb', 'Mar']);
		expect(cols.map(c => c.widthPx)).toEqual([31 * 3, 28 * 3, 31 * 3]);
	});

	it('year zooms: quarter columns banded by year', () => {
		const config = makeConfig(new Date(2026, 0, 1), new Date(2026, 11, 31), '1year');
		const cols = generateColumns(config);
		expect(cols.map(c => c.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
		expect(cols.every(c => c.group === '2026')).toBe(true);
	});

	it('columns tile the timeline: each startDate matches the previous endDateExclusive', () => {
		for (const zoom of ['day', 'week', 'month', '1year'] as const) {
			const config = makeConfig(new Date(2026, 0, 4), new Date(2026, 5, 30), zoom);
			const cols = generateColumns(config);
			for (let i = 1; i < cols.length; i++) {
				expect(cols[i].startDate.getTime()).toBe(cols[i - 1].endDateExclusive.getTime());
			}
			// Width always equals the day span times pixelsPerDay.
			for (const col of cols) {
				const days = daysBetween(col.startDate, col.endDateExclusive);
				expect(col.widthPx).toBeCloseTo(days * config.pixelsPerDay, 5);
			}
		}
	});

	it('columnsWidth sums column widths', () => {
		const config = makeConfig(new Date(2026, 0, 1), new Date(2026, 1, 28), 'month');
		const cols = generateColumns(config);
		expect(columnsWidth(cols)).toBe(31 * 3 + 28 * 3);
	});
});

describe('getTaskBarBounds', () => {
	const config = makeConfig(new Date(2026, 3, 1), new Date(2026, 4, 1), 'day');
	const ppd = getPixelsPerDay('day');

	it('renders a normal start→end bar with an inclusive end date', () => {
		// Apr 3 → Apr 8 occupies 6 days, ending at the end of the 8th.
		const task = makeTask('t', { startDate: new Date(2026, 3, 3), endDate: new Date(2026, 3, 8) });
		expect(getTaskBarBounds(task, config)).toEqual({ left: 2 * ppd, width: 6 * ppd });
	});

	it('same-day start/end renders as a 1-day bar', () => {
		const task = makeTask('t', { startDate: new Date(2026, 3, 3), endDate: new Date(2026, 3, 3) });
		expect(getTaskBarBounds(task, config)).toEqual({ left: 2 * ppd, width: ppd });
	});

	it('returns null when the task has no dates', () => {
		expect(getTaskBarBounds(makeTask('t'), config)).toBeNull();
	});

	it('start-only: falls back to a 1-day bar', () => {
		const task = makeTask('t', { startDate: new Date(2026, 3, 3) });
		expect(getTaskBarBounds(task, config)).toEqual({ left: 2 * ppd, width: ppd });
	});

	it('start-only with timeEstimate: sizes by 8-hour workdays', () => {
		const task = makeTask('t', { startDate: new Date(2026, 3, 3), timeEstimate: 16 * 60 });
		expect(getTaskBarBounds(task, config)).toEqual({ left: 2 * ppd, width: 2 * ppd });
	});

	it('deadline-only: a 1-day bar occupying the due date', () => {
		const task = makeTask('t', { endDate: new Date(2026, 3, 15) });
		expect(getTaskBarBounds(task, config)).toEqual({ left: 14 * ppd, width: ppd });
	});

	it('reversed dates: width never goes negative', () => {
		const task = makeTask('t', { startDate: new Date(2026, 3, 28), endDate: new Date(2026, 3, 1) });
		const bounds = getTaskBarBounds(task, config)!;
		expect(bounds.width).toBe(ppd);
	});
});
