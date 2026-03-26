import {
	STATUS_COLORS,
	PRIORITY_COLORS,
	DEFAULT_BAR_COLOR,
	type ColorByField,
	type GanttTask,
} from './types.ts';


export function getBarColor(task: GanttTask, colorBy: ColorByField): string {
	if (colorBy === 'status') {
		return STATUS_COLORS[task.status] ?? DEFAULT_BAR_COLOR;
	}
	if (colorBy === 'priority') {
		return PRIORITY_COLORS[task.priority] ?? DEFAULT_BAR_COLOR;
	}
	return DEFAULT_BAR_COLOR;
}

