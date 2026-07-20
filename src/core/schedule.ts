import type { GanttTask, TaskDependency, DependencyType } from './model.ts';
import { addDays, daysBetween, formatDate } from './timeline.ts';

/**
 * Dependency constraint semantics (MS Project conventions). The task that
 * declares the dependency is the SUCCESSOR; the linked task is the PREDECESSOR.
 *
 *   FS — successor starts   after the predecessor's finish
 *   SS — successor starts   no earlier than predecessor's start
 *   FF — successor finishes no earlier than predecessor's finish
 *   SF — successor finishes no earlier than predecessor's start
 *
 * Dates are inclusive all-day dates: a task finishes at the END of its due
 * day, so an FS successor can start no earlier than the NEXT day. Milestones
 * are zero-duration — an FS successor may start the same day. SS compares
 * starts-of-day and FF/SF compare against moments that end or begin within
 * the day, so same-day satisfies those.
 */

export interface ScheduleViolation {
	predecessor: GanttTask;
	successor: GanttTask;
	dep: TaskDependency;
	/** Which successor date must move to satisfy the constraint. */
	fixField: 'start' | 'end';
	/** Earliest date that satisfies the constraint. */
	suggestedDate: Date;
	description: string;
}

interface Constraint {
	/** Successor date the constraint applies to. */
	fixField: 'start' | 'end';
	/** Predecessor date the successor is bound to. */
	boundTo: 'start' | 'end';
}

const CONSTRAINTS: Record<DependencyType, Constraint> = {
	FS: { fixField: 'start', boundTo: 'end' },
	SS: { fixField: 'start', boundTo: 'start' },
	FF: { fixField: 'end', boundTo: 'end' },
	SF: { fixField: 'end', boundTo: 'start' },
};

export const DEP_VERBS: Record<DependencyType, [string, string]> = {
	FS: ['must start after', 'finishes'],
	SS: ['must start no earlier than', 'starts'],
	FF: ['must finish after', 'finishes'],
	SF: ['must finish after', 'starts'],
};

/**
 * The date a PREDECESSOR constrains by, matching what its bar shows even when
 * one side is missing (all inclusive dates): a milestone's finish is its own
 * date, a timeEstimate task finishes on its last estimated workday, and a
 * deadline-only task occupies just its due day.
 */
export function effectiveConstraintDate(task: GanttTask, which: 'start' | 'end'): Date | null {
	if (which === 'start') {
		return task.startDate ?? task.endDate ?? null;
	}
	if (task.endDate) return task.endDate;
	if (task.startDate) {
		return task.timeEstimate
			? addDays(task.startDate, Math.max(1, Math.ceil(task.timeEstimate / (60 * 8))) - 1)
			: task.startDate; // milestone: finishes the moment it happens
	}
	return null;
}

/** Zero-duration point event: only a start date, no end and no estimate. */
function isZeroDuration(task: GanttTask): boolean {
	return task.startDate !== null && task.endDate === null && task.timeEstimate === null;
}

/**
 * Evaluates one dependency. Returns the successor date required to satisfy
 * the constraint when it's violated, or null when it holds (or can't be
 * evaluated for missing dates). The predecessor side uses effective dates
 * (so e.g. milestones still constrain); the successor is only checked on
 * dates it actually has. `predDate` is the predecessor date the constraint
 * references, for display.
 */
export function checkConstraint(
	type: DependencyType,
	predecessor: GanttTask,
	successor: GanttTask,
): { fixField: 'start' | 'end'; requiredDate: Date; predDate: Date } | null {
	if (predecessor === successor) return null;
	const { fixField, boundTo } = CONSTRAINTS[type];
	const predDate = effectiveConstraintDate(predecessor, boundTo);
	const actualDate = fixField === 'start' ? successor.startDate : successor.endDate;
	if (!predDate || !actualDate) return null;

	// FS: the predecessor finishes at the END of its due day, so the successor
	// starts the next day — except after zero-duration milestones, which
	// consume no time, so a same-day start is fine.
	const requiredDate = type === 'FS' && !isZeroDuration(predecessor)
		? addDays(predDate, 1)
		: predDate;

	return actualDate < requiredDate ? { fixField, requiredDate, predDate } : null;
}

export function isViolated(
	dep: TaskDependency,
	predecessor: GanttTask,
	successor: GanttTask,
): boolean {
	return checkConstraint(dep.type, predecessor, successor) !== null;
}

/**
 * The dates that satisfy one violation. Moving a start keeps the task's
 * duration by shifting the end with it (a plain start move could otherwise
 * push the start past the end); reversed-date tasks are normalized to a
 * zero-length task at the required date. Moving an end never touches the start.
 */
export function fixDatesFor(
	task: Pick<GanttTask, 'startDate' | 'endDate'>,
	fixField: 'start' | 'end',
	requiredDate: Date,
): { newStart: Date | null; newEnd: Date | null } {
	if (fixField === 'start') {
		let newEnd = task.endDate;
		if (task.startDate && task.endDate) {
			const duration = Math.max(0, daysBetween(task.startDate, task.endDate));
			newEnd = addDays(requiredDate, duration);
		}
		return { newStart: requiredDate, newEnd };
	}
	return { newStart: task.startDate, newEnd: requiredDate };
}

export interface CascadePlan {
	/** Final dates per task id, for every task any fix touched. */
	fixes: Map<string, { task: GanttTask; newStart: Date | null; newEnd: Date | null }>;
	/** False when the graph never settled (circular dependencies). */
	converged: boolean;
}

/**
 * Repeatedly applies fixes until no violations remain, so fixing one task
 * ripples through the tasks that depend on it. Bounded by the task count
 * (the longest possible dependency chain) — a cycle exhausts the bound and
 * reports converged: false with the best-effort plan.
 */
export function planCascadingFixes(tasks: GanttTask[]): CascadePlan {
	const working = tasks.map(t => ({ ...t }));
	const maxPasses = tasks.length + 1;

	let converged = false;
	for (let pass = 0; pass < maxPasses; pass++) {
		const violations = detectViolations(working);
		if (violations.length === 0) {
			converged = true;
			break;
		}
		for (const v of violations) {
			// v.successor IS the working copy (detectViolations ran on `working`).
			const target = v.successor;
			// Fixes only ever move dates later. Skip if an earlier fix this pass
			// already pushed the date to (or past) this requirement — keeps
			// updates monotonic so multi-dep tasks converge on the max.
			const current = v.fixField === 'start' ? target.startDate : target.endDate;
			if (current && current >= v.suggestedDate) continue;
			const { newStart, newEnd } = fixDatesFor(target, v.fixField, v.suggestedDate);
			target.startDate = newStart;
			target.endDate = newEnd;
		}
	}

	const fixes: CascadePlan['fixes'] = new Map();
	for (let i = 0; i < tasks.length; i++) {
		const original = tasks[i];
		const updated = working[i];
		if (updated.startDate?.getTime() !== original.startDate?.getTime() ||
			updated.endDate?.getTime() !== original.endDate?.getTime()) {
			fixes.set(original.id, { task: original, newStart: updated.startDate, newEnd: updated.endDate });
		}
	}
	return { fixes, converged };
}

/**
 * Finds circular dependency chains (A waits on B, B waits on A — directly or
 * transitively). Cycles can't be scheduled and make violation fixes chase
 * each other forever, so they're surfaced as their own kind of problem.
 * Returns each distinct cycle once, as the tasks along it in order.
 * Self-references are ignored (already dropped by constraint checks).
 */
export function findDependencyCycles(tasks: GanttTask[]): GanttTask[][] {
	const taskById = new Map(tasks.map(t => [t.id, t]));
	// Edges successor → predecessor ("waits on")
	const waitsOn = new Map<string, string[]>();
	for (const task of tasks) {
		const targets = task.dependencies
			.map(d => d.targetPath)
			.filter(p => p && p !== task.id && taskById.has(p));
		if (targets.length) waitsOn.set(task.id, [...new Set(targets)]);
	}

	const cycles: GanttTask[][] = [];
	const seenCycleKeys = new Set<string>();
	const state = new Map<string, 'visiting' | 'done'>();
	const stack: string[] = [];

	const visit = (id: string): void => {
		state.set(id, 'visiting');
		stack.push(id);
		for (const next of waitsOn.get(id) ?? []) {
			const s = state.get(next);
			if (s === 'done') continue;
			if (s === 'visiting') {
				// Back edge — the cycle is the stack slice from `next` onward.
				const cycleIds = stack.slice(stack.indexOf(next));
				const key = [...cycleIds].sort().join(' ');
				if (!seenCycleKeys.has(key)) {
					seenCycleKeys.add(key);
					cycles.push(cycleIds.map(cid => taskById.get(cid)!));
				}
				continue;
			}
			visit(next);
		}
		stack.pop();
		state.set(id, 'done');
	};

	for (const task of tasks) {
		if (!state.has(task.id)) visit(task.id);
	}
	return cycles;
}

export function detectViolations(tasks: GanttTask[]): ScheduleViolation[] {
	const violations: ScheduleViolation[] = [];

	const taskById = new Map<string, GanttTask>();
	for (const task of tasks) taskById.set(task.id, task);

	for (const successor of tasks) {
		for (const dep of successor.dependencies) {
			const predecessor = taskById.get(dep.targetPath);
			if (!predecessor) continue;

			const result = checkConstraint(dep.type, predecessor, successor);
			if (!result) continue;

			const [verb, predVerb] = DEP_VERBS[dep.type];
			violations.push({
				predecessor,
				successor,
				dep,
				fixField: result.fixField,
				suggestedDate: result.requiredDate,
				description:
					`${successor.title} ${verb} ${predecessor.title} ` +
					`${predVerb} (${formatDate(result.predDate)})`,
			});
		}
	}

	return violations;
}
