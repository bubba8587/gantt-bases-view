import { describe, it, expect } from 'vitest';
import { packLanes } from '../src/core/lanes.ts';
import { makeConfig, makeTask } from './helpers.ts';

const apr = (day: number) => new Date(2026, 3, day);
const config = makeConfig(new Date(2026, 3, 1), new Date(2026, 5, 1), 'day');

describe('packLanes', () => {
	it('packs an FS-style chain of adjacent tasks onto one lane', () => {
		const a = makeTask('a', { startDate: apr(1), endDate: apr(7) });
		const b = makeTask('b', { startDate: apr(8), endDate: apr(14) });
		const c = makeTask('c', { startDate: apr(15), endDate: apr(20) });
		const { laneOf, laneCount } = packLanes([a, b, c], config);
		expect(laneCount).toBe(1);
		expect([laneOf.get('a'), laneOf.get('b'), laneOf.get('c')]).toEqual([0, 0, 0]);
	});

	it('stacks overlapping tasks and reuses freed lanes', () => {
		const a = makeTask('a', { startDate: apr(1), endDate: apr(10) });
		const b = makeTask('b', { startDate: apr(5), endDate: apr(12) }); // overlaps a → lane 1
		const c = makeTask('c', { startDate: apr(11), endDate: apr(15) }); // fits after a → lane 0
		const { laneOf, laneCount } = packLanes([a, b, c], config);
		expect(laneCount).toBe(2);
		expect(laneOf.get('a')).toBe(0);
		expect(laneOf.get('b')).toBe(1);
		expect(laneOf.get('c')).toBe(0);
	});

	it('reserves the milestone diamond overhang', () => {
		const a = makeTask('a', { startDate: apr(1), endDate: apr(7) });
		// Milestone ON Apr 8: adjacent for a bar, but its diamond paints back
		// over Apr 7's edge, so it must not share the lane.
		const m = makeTask('m', { startDate: apr(8), isMilestone: true });
		const { laneOf, laneCount } = packLanes([a, m], config);
		expect(laneCount).toBe(2);
		expect(laneOf.get('a')).not.toBe(laneOf.get('m'));
	});

	it('skips dateless tasks but always yields at least one lane', () => {
		const none = makeTask('none');
		const { laneOf, laneCount } = packLanes([none], config);
		expect(laneCount).toBe(1);
		expect(laneOf.has('none')).toBe(false);
	});

	it('is order-independent for the same input set', () => {
		const tasks = [
			makeTask('a', { startDate: apr(1), endDate: apr(10) }),
			makeTask('b', { startDate: apr(5), endDate: apr(12) }),
			makeTask('c', { startDate: apr(11), endDate: apr(15) }),
		];
		const forward = packLanes(tasks, config);
		const reversed = packLanes([...tasks].reverse(), config);
		expect(Object.fromEntries(forward.laneOf)).toEqual(Object.fromEntries(reversed.laneOf));
	});
});
