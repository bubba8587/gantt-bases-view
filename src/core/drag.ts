import type { GanttTask } from './model.ts';
import { addDays, getEffectiveBarDates } from './timeline.ts';

export type DragMode = 'move' | 'resize-start' | 'resize-end';

/**
 * The dates a drag produces. A null field means "leave that frontmatter
 * property untouched" — dragging never deletes or invents dates the task
 * didn't need: moving shifts only the dates that exist, while resizing an
 * edge writes that edge's date (creating it if the bar only rendered it as
 * a fallback).
 */
export interface DragDates {
	newStart: Date | null;
	newEnd: Date | null;
}

/** Which drag gestures a task's locks permit. */
export function allowedDragModes(task: GanttTask): Record<DragMode, boolean> {
	const { locks, startDate, endDate } = task;
	return {
		// Moving shifts every date the task has — blocked if any of them is locked.
		'move': !(locks.start && startDate !== null) && !(locks.end && endDate !== null),
		// Resizing changes that edge's date AND the duration.
		'resize-start': !locks.start && !locks.duration,
		'resize-end': !locks.end && !locks.duration,
	};
}

/** Applies a day-snapped drag to a task's dates. Null when nothing changes
 *  or the task's locks forbid the gesture. */
export function applyDragToDates(
	task: GanttTask,
	mode: DragMode,
	dayDelta: number,
): DragDates | null {
	if (dayDelta === 0) return null;
	if (!allowedDragModes(task)[mode]) return null;
	const { startDate, endDate } = task;
	const effective = getEffectiveBarDates(task);
	if (!effective) return null;

	switch (mode) {
		case 'move':
			return {
				newStart: startDate ? addDays(startDate, dayDelta) : null,
				newEnd: endDate ? addDays(endDate, dayDelta) : null,
			};

		case 'resize-start': {
			let start = addDays(effective.start, dayDelta);
			// Never drag the start past the finish; landing on it makes a milestone.
			const limit = endDate ?? effective.end;
			if (start > limit) start = new Date(limit);
			return { newStart: start, newEnd: null };
		}

		case 'resize-end': {
			let end = addDays(effective.end, dayDelta);
			const limit = startDate ?? effective.start;
			if (end < limit) end = new Date(limit);
			return { newStart: null, newEnd: end };
		}
	}
}
