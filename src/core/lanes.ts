import type { GanttTask, TimelineConfig } from './model.ts';
import { getTaskBarBounds } from './timeline.ts';

/** Horizontal overhang of the milestone diamond past its anchor point (px). */
const MILESTONE_HALF_PX = 7;

export interface LanePacking {
	/** Lane index (0-based) per task id. Dateless tasks have no lane. */
	laneOf: Map<string, number>;
	/** Number of lanes needed; at least 1 so a group always has a row. */
	laneCount: number;
}

/**
 * Packs tasks into shared rows ("lanes") for the compact view: sort bars by
 * their left edge, then greedily drop each into the first lane whose last bar
 * it doesn't overlap. Adjacent bars (an FS chain) share a lane — that's the
 * point of compacting. Milestone diamonds reserve their painted overhang so
 * they never sit on top of a neighboring bar.
 */
export function packLanes(
	tasks: GanttTask[],
	config: TimelineConfig,
	gapPx = 0,
): LanePacking {
	const items: Array<{ id: string; left: number; right: number }> = [];
	for (const task of tasks) {
		const bounds = getTaskBarBounds(task, config);
		if (!bounds) continue; // dateless: nothing to place
		if (task.isMilestone) {
			items.push({
				id: task.id,
				left: bounds.left - MILESTONE_HALF_PX,
				right: bounds.left + MILESTONE_HALF_PX,
			});
		} else {
			items.push({ id: task.id, left: bounds.left, right: bounds.left + bounds.width });
		}
	}

	// Left-to-right; wider first on ties for stable, denser packing.
	items.sort((a, b) => a.left - b.left || b.right - a.right || a.id.localeCompare(b.id));

	const laneRight: number[] = [];
	const laneOf = new Map<string, number>();
	for (const item of items) {
		let lane = laneRight.findIndex(right => item.left >= right + gapPx);
		if (lane === -1) {
			lane = laneRight.length;
			laneRight.push(item.right);
		} else {
			laneRight[lane] = item.right;
		}
		laneOf.set(item.id, lane);
	}

	return { laneOf, laneCount: Math.max(laneRight.length, 1) };
}
