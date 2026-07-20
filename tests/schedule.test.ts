import { describe, it, expect } from 'vitest';
import { checkConstraint, detectViolations, isViolated, fixDatesFor, planCascadingFixes } from '../src/core/schedule.ts';
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

	it('milestone predecessors constrain by their single date', () => {
		// Start-only milestone at Apr 7: FS successors must start Apr 7 or later.
		const milestone = makeTask('kickoff', { startDate: apr(7), isMilestone: true });
		const early = makeTask('early', { startDate: apr(5), endDate: apr(15) });
		expect(checkConstraint('FS', milestone, early)).toEqual({ fixField: 'start', requiredDate: apr(7) });
		expect(checkConstraint('FF', milestone, early)).toBeNull(); // early ends Apr 15 >= Apr 7

		const onTime = makeTask('onTime', { startDate: apr(7), endDate: apr(15) });
		expect(checkConstraint('FS', milestone, onTime)).toBeNull();
	});

	it('timeEstimate predecessors finish after their estimated workdays', () => {
		// Apr 1 + 16h at 8h/day → finishes Apr 3.
		const est = makeTask('est', { startDate: apr(1), timeEstimate: 16 * 60 });
		const succ = makeTask('succ', { startDate: apr(2), endDate: apr(10) });
		expect(checkConstraint('FS', est, succ)).toEqual({ fixField: 'start', requiredDate: apr(3) });
	});

	it('deadline-only predecessors start the day before their due date', () => {
		const deadline = makeTask('deadline', { endDate: apr(15) });
		const succ = makeTask('succ', { startDate: apr(10), endDate: apr(20) });
		expect(checkConstraint('SS', deadline, succ)).toEqual({ fixField: 'start', requiredDate: apr(14) });
	});

	it('a task depending on itself is never a violation', () => {
		const t = makeTask('t', { startDate: apr(5), endDate: apr(1) });
		expect(checkConstraint('FS', t, t)).toBeNull();
	});

	it('returns null when a side has no usable date', () => {
		// Predecessor with no dates at all can't constrain anything.
		const dateless = makeTask('pred');
		const succ = makeTask('succ', { startDate: apr(5), endDate: apr(15) });
		expect(checkConstraint('FS', dateless, succ)).toBeNull();

		// Successor without the constrained date is not flagged — we never
		// invent successor dates just to report a violation on them.
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

describe('fixDatesFor', () => {
	it('start fixes shift the end too, preserving duration', () => {
		const task = makeTask('t', { startDate: apr(15), endDate: apr(18) });
		expect(fixDatesFor(task, 'start', apr(28))).toEqual({ newStart: apr(28), newEnd: new Date(2026, 4, 1) });
	});

	it('start fixes normalize reversed dates to zero length', () => {
		const task = makeTask('t', { startDate: apr(28), endDate: apr(1) });
		expect(fixDatesFor(task, 'start', apr(21))).toEqual({ newStart: apr(21), newEnd: apr(21) });
	});

	it('end fixes leave the start alone', () => {
		const task = makeTask('t', { startDate: apr(14), endDate: apr(17) });
		expect(fixDatesFor(task, 'end', apr(21))).toEqual({ newStart: apr(14), newEnd: apr(21) });
	});
});

describe('planCascadingFixes', () => {
	function fsChain() {
		// A (1–10) ← B (5–8, FS on A) ← C (9–11, FS on B)
		const a = makeTask('a', { startDate: apr(1), endDate: apr(10) });
		const b = makeTask('b', {
			startDate: apr(5), endDate: apr(8),
			dependencies: [{ targetPath: 'a', targetName: '[[a]]', type: 'FS' as const }],
		});
		const c = makeTask('c', {
			startDate: apr(9), endDate: apr(11),
			dependencies: [{ targetPath: 'b', targetName: '[[b]]', type: 'FS' as const }],
		});
		return [a, b, c];
	}

	it('ripples fixes through dependent tasks', () => {
		const tasks = fsChain();
		const plan = planCascadingFixes(tasks);
		expect(plan.converged).toBe(true);

		// B moves to start Apr 10 (duration 3 → ends Apr 13);
		// C was fine on its own but must now follow B's new finish.
		expect(plan.fixes.get('b')).toMatchObject({ newStart: apr(10), newEnd: apr(13) });
		expect(plan.fixes.get('c')).toMatchObject({ newStart: apr(13), newEnd: apr(15) });
		expect(plan.fixes.has('a')).toBe(false);

		// The plan must not mutate the input tasks.
		expect(tasks[1].startDate).toEqual(apr(5));
	});

	it('multi-dep tasks settle on the strictest requirement', () => {
		const testing = makeTask('testing', { startDate: apr(8), endDate: apr(28) });
		const docs = makeTask('docs', { startDate: apr(14), endDate: apr(21) });
		const handoff = makeTask('handoff', {
			startDate: apr(15), endDate: apr(18),
			dependencies: [
				{ targetPath: 'docs', targetName: '[[docs]]', type: 'FS' as const },
				{ targetPath: 'testing', targetName: '[[testing]]', type: 'FS' as const },
			],
		});
		const plan = planCascadingFixes([testing, docs, handoff]);
		expect(plan.converged).toBe(true);
		expect(plan.fixes.get('handoff')).toMatchObject({ newStart: apr(28), newEnd: new Date(2026, 4, 1) });
	});

	it('reports non-convergence for circular dependencies instead of looping', () => {
		// A must start after B finishes and vice versa — unsatisfiable.
		const a = makeTask('a', {
			startDate: apr(1), endDate: apr(5),
			dependencies: [{ targetPath: 'b', targetName: '[[b]]', type: 'FS' as const }],
		});
		const b = makeTask('b', {
			startDate: apr(1), endDate: apr(5),
			dependencies: [{ targetPath: 'a', targetName: '[[a]]', type: 'FS' as const }],
		});
		const plan = planCascadingFixes([a, b]);
		expect(plan.converged).toBe(false);
	});

	it('returns an empty plan when nothing is violated', () => {
		const a = makeTask('a', { startDate: apr(1), endDate: apr(7) });
		const b = makeTask('b', {
			startDate: apr(7), endDate: apr(10),
			dependencies: [{ targetPath: 'a', targetName: '[[a]]', type: 'FS' as const }],
		});
		const plan = planCascadingFixes([a, b]);
		expect(plan.converged).toBe(true);
		expect(plan.fixes.size).toBe(0);
	});
});
