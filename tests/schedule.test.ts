import { describe, it, expect } from 'vitest';
import { checkConstraint, detectViolations, isViolated } from '../src/core/schedule.ts';
import { makeTask } from './helpers.ts';
import type { GanttTask, TaskDependency, DependencyType } from '../src/core/model.ts';

const apr = (day: number) => new Date(2026, 3, day);

function dep(targetPath: string, type: DependencyType): TaskDependency {
	return { targetPath, targetName: `[[${targetPath}]]`, type };
}

function pair(predDates: [number, number], succDates: [number, number]): [GanttTask, GanttTask] {
	const pred = makeTask('pred', { startDate: apr(predDates[0]), endDate: apr(predDates[1]) });
	const succ = makeTask('succ', { startDate: apr(succDates[0]), endDate: apr(succDates[1]) });
	return [pred, succ];
}

describe('checkConstraint', () => {
	it('FS: successor must start no earlier than predecessor finishes', () => {
		const [pred, succ] = pair([1, 10], [5, 15]);
		expect(checkConstraint('FS', pred, succ)).toEqual({ fixField: 'start', requiredDate: apr(10) });

		const [pred2, succ2] = pair([1, 10], [10, 15]);
		expect(checkConstraint('FS', pred2, succ2)).toBeNull();
	});

	it('SS: successor must start no earlier than predecessor starts', () => {
		const [pred, succ] = pair([5, 10], [3, 15]);
		expect(checkConstraint('SS', pred, succ)).toEqual({ fixField: 'start', requiredDate: apr(5) });

		const [pred2, succ2] = pair([5, 10], [5, 15]);
		expect(checkConstraint('SS', pred2, succ2)).toBeNull();
	});

	it('FF: successor must finish no earlier than predecessor finishes', () => {
		const [pred, succ] = pair([1, 21], [14, 17]);
		expect(checkConstraint('FF', pred, succ)).toEqual({ fixField: 'end', requiredDate: apr(21) });

		const [pred2, succ2] = pair([1, 21], [14, 21]);
		expect(checkConstraint('FF', pred2, succ2)).toBeNull();
	});

	it('SF: successor must finish no earlier than predecessor starts', () => {
		const [pred, succ] = pair([8, 28], [1, 5]);
		expect(checkConstraint('SF', pred, succ)).toEqual({ fixField: 'end', requiredDate: apr(8) });

		const [pred2, succ2] = pair([8, 28], [1, 8]);
		expect(checkConstraint('SF', pred2, succ2)).toBeNull();
	});

	it('returns null when either side is missing the relevant date', () => {
		const pred = makeTask('pred', { endDate: null, startDate: apr(1) });
		const succ = makeTask('succ', { startDate: apr(5), endDate: apr(15) });
		expect(checkConstraint('FS', pred, succ)).toBeNull();

		const pred2 = makeTask('pred', { startDate: apr(1), endDate: apr(10) });
		const succ2 = makeTask('succ', { startDate: null, endDate: apr(15) });
		expect(checkConstraint('FS', pred2, succ2)).toBeNull();
	});
});

describe('isViolated', () => {
	it('agrees with checkConstraint', () => {
		const [pred, succ] = pair([1, 10], [5, 15]);
		expect(isViolated(dep('pred', 'FS'), pred, succ)).toBe(true);
		expect(isViolated(dep('pred', 'SS'), pred, succ)).toBe(false);
	});
});

describe('detectViolations', () => {
	it('reports one violation per violated dependency, with fix data', () => {
		const design = makeTask('design', { title: 'Design', startDate: apr(1), endDate: apr(7) });
		const dev = makeTask('dev', {
			title: 'Development',
			startDate: apr(5),
			endDate: apr(21),
			dependencies: [dep('design', 'FS')],
		});
		const violations = detectViolations([design, dev]);
		expect(violations).toHaveLength(1);
		expect(violations[0].successor.id).toBe('dev');
		expect(violations[0].predecessor.id).toBe('design');
		expect(violations[0].fixField).toBe('start');
		expect(violations[0].suggestedDate).toEqual(apr(7));
		expect(violations[0].description).toContain('Development must start after Design finishes (2026-04-07)');
	});

	it('checks each dependency of a multi-dep task independently', () => {
		const testing = makeTask('testing', { startDate: apr(8), endDate: apr(28) });
		const docs = makeTask('docs', { startDate: apr(14), endDate: apr(21) });
		const handoff = makeTask('handoff', {
			startDate: apr(22),
			endDate: apr(25),
			dependencies: [dep('testing', 'FS'), dep('docs', 'FS')],
		});
		// Start Apr 22 is after docs finish (Apr 21) but before testing finishes (Apr 28).
		const violations = detectViolations([testing, docs, handoff]);
		expect(violations).toHaveLength(1);
		expect(violations[0].predecessor.id).toBe('testing');
		expect(violations[0].suggestedDate).toEqual(apr(28));
	});

	it('ignores unresolved dependencies', () => {
		const t = makeTask('t', {
			startDate: apr(1),
			endDate: apr(5),
			dependencies: [{ targetPath: '', targetName: '[[Missing]]', type: 'FS' }],
		});
		expect(detectViolations([t])).toEqual([]);
	});
});
