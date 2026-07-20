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

/** Applies a day-snapped drag to a task's dates. Null when nothing changes. */
export function applyDragToDates(
	task: GanttTask,
	mode: DragMode,
	dayDelta: number,
): DragDates | null {
	if (dayDelta === 0) return null;
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
