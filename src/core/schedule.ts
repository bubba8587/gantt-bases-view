import type { GanttTask, TaskDependency, DependencyType } from './model.ts';
import { addDays, formatDate } from './timeline.ts';

/**
 * Dependency constraint semantics (MS Project conventions). The task that
 * declares the dependency is the SUCCESSOR; the linked task is the PREDECESSOR.
 *
 *   FS — successor starts   no earlier than predecessor's finish
 *   SS — successor starts   no earlier than predecessor's start
 *   FF — successor finishes no earlier than predecessor's finish
 *   SF — successor finishes no earlier than predecessor's start
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
 * one side is missing: a milestone's finish is its own date, a timeEstimate
 * task finishes after its estimated workdays, and a deadline-only task starts
 * the day before its due date.
 */
export function effectiveConstraintDate(task: GanttTask, which: 'start' | 'end'): Date | null {
	if (which === 'start') {
		if (task.startDate) return task.startDate;
		return task.endDate ? addDays(task.endDate, -1) : null;
	}
	if (task.endDate) return task.endDate;
	if (task.startDate) {
		return task.timeEstimate
			? addDays(task.startDate, Math.ceil(task.timeEstimate / (60 * 8)))
			: task.startDate; // milestone: finishes the moment it happens
	}
	return null;
}

/**
 * Evaluates one dependency. Returns the required date when the constraint is
 * violated, or null when it holds (or can't be evaluated for missing dates).
 * The predecessor side uses effective dates (so e.g. milestones still
 * constrain); the successor is only checked on dates it actually has.
 */
export function checkConstraint(
	type: DependencyType,
	predecessor: GanttTask,
	successor: GanttTask,
): { fixField: 'start' | 'end'; requiredDate: Date } | null {
	if (predecessor === successor) return null;
	const { fixField, boundTo } = CONSTRAINTS[type];
	const requiredDate = effectiveConstraintDate(predecessor, boundTo);
	const actualDate = fixField === 'start' ? successor.startDate : successor.endDate;
	if (!requiredDate || !actualDate) return null;
	return actualDate < requiredDate ? { fixField, requiredDate } : null;
}

export function isViolated(
	dep: TaskDependency,
	predecessor: GanttTask,
	successor: GanttTask,
): boolean {
	return checkConstraint(dep.type, predecessor, successor) !== null;
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
					`${predVerb} (${formatDate(result.requiredDate)})`,
			});
		}
	}

	return violations;
}
