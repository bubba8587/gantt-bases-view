import { describe, it, expect } from 'vitest';
import { applyDragToDates, allowedDragModes } from '../src/core/drag.ts';
import { makeTask } from './helpers.ts';

const apr = (day: number) => new Date(2026, 3, day);

describe('applyDragToDates', () => {
	it('returns null for a zero-day drag or a dateless task', () => {
		const task = makeTask('t', { startDate: apr(3), endDate: apr(8) });
		expect(applyDragToDates(task, 'move', 0)).toBeNull();
		expect(applyDragToDates(makeTask('t'), 'move', 2)).toBeNull();
	});

	it('move shifts both dates, preserving duration', () => {
		const task = makeTask('t', { startDate: apr(3), endDate: apr(8) });
		expect(applyDragToDates(task, 'move', 4)).toEqual({ newStart: apr(7), newEnd: apr(12) });
		expect(applyDragToDates(task, 'move', -2)).toEqual({ newStart: apr(1), newEnd: apr(6) });
	});

	it('move only touches dates that exist', () => {
		const startOnly = makeTask('t', { startDate: apr(3) });
		expect(applyDragToDates(startOnly, 'move', 2)).toEqual({ newStart: apr(5), newEnd: null });

		const deadlineOnly = makeTask('t', { endDate: apr(15) });
		expect(applyDragToDates(deadlineOnly, 'move', -3)).toEqual({ newStart: null, newEnd: apr(12) });
	});

	it('resize-start moves only the start, clamped at the finish', () => {
		const task = makeTask('t', { startDate: apr(3), endDate: apr(8) });
		expect(applyDragToDates(task, 'resize-start', 2)).toEqual({ newStart: apr(5), newEnd: null });
		// Dragging past the end clamps to the end (zero-length task).
		expect(applyDragToDates(task, 'resize-start', 10)).toEqual({ newStart: apr(8), newEnd: null });
	});

	it('resize-end moves only the end, clamped at the start', () => {
		const task = makeTask('t', { startDate: apr(3), endDate: apr(8) });
		expect(applyDragToDates(task, 'resize-end', 3)).toEqual({ newStart: null, newEnd: apr(11) });
		expect(applyDragToDates(task, 'resize-end', -10)).toEqual({ newStart: null, newEnd: apr(3) });
	});

	it('resizing a deadline-only task creates its start from the rendered bar', () => {
		// Bar occupies the due day (Apr 15); dragging the left edge back 4 days → start Apr 11.
		const task = makeTask('t', { endDate: apr(15) });
		expect(applyDragToDates(task, 'resize-start', -4)).toEqual({ newStart: apr(11), newEnd: null });
	});

	it('resizing a timeEstimate task creates its end from the estimated finish', () => {
		// Apr 3 + 16h at 8h/day covers Apr 3–4 (inclusive); +2 days → end Apr 6.
		const task = makeTask('t', { startDate: apr(3), timeEstimate: 16 * 60 });
		expect(applyDragToDates(task, 'resize-end', 2)).toEqual({ newStart: null, newEnd: apr(6) });
	});
});

describe('locks', () => {
	const lock = (over: Partial<{ start: boolean; end: boolean; duration: boolean }>) =>
		({ start: false, end: false, duration: false, ...over });

	it('move is blocked when a present date is locked', () => {
		const task = makeTask('t', { startDate: apr(3), endDate: apr(8), locks: lock({ start: true }) });
		expect(applyDragToDates(task, 'move', 2)).toBeNull();
		expect(allowedDragModes(task)['move']).toBe(false);

		const endLocked = makeTask('t', { startDate: apr(3), endDate: apr(8), locks: lock({ end: true }) });
		expect(applyDragToDates(endLocked, 'move', 2)).toBeNull();
	});

	it('a lock on an absent date does not block moving', () => {
		// Deadline-only task: no start date exists, so a start lock is moot.
		const task = makeTask('t', { endDate: apr(15), locks: lock({ start: true }) });
		expect(applyDragToDates(task, 'move', -3)).toEqual({ newStart: null, newEnd: apr(12) });
	});

	it('duration lock allows moving but blocks both resizes', () => {
		const task = makeTask('t', { startDate: apr(3), endDate: apr(8), locks: lock({ duration: true }) });
		expect(applyDragToDates(task, 'move', 2)).toEqual({ newStart: apr(5), newEnd: apr(10) });
		expect(applyDragToDates(task, 'resize-start', 1)).toBeNull();
		expect(applyDragToDates(task, 'resize-end', 1)).toBeNull();
	});

	it('edge locks block only their own resize', () => {
		const task = makeTask('t', { startDate: apr(3), endDate: apr(8), locks: lock({ start: true }) });
		expect(applyDragToDates(task, 'resize-start', 1)).toBeNull();
		expect(applyDragToDates(task, 'resize-end', 1)).toEqual({ newStart: null, newEnd: apr(9) });
	});
});
