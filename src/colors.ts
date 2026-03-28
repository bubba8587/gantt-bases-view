import {
	STATUS_COLORS,
	PRIORITY_COLORS,
	DEFAULT_BAR_COLOR,
	type ColorByField,
	type GanttTask,
	type PluginSettings,
} from './types.ts';


export function getBarColor(task: GanttTask, colorBy: ColorByField, pluginSettings?: PluginSettings): string {
	if (colorBy === 'status') {
		// Check built-in colors first, then synced plugin colors (case-insensitive)
		return STATUS_COLORS[task.status]
			?? pluginSettings?.statusColors?.[task.status]
			?? pluginSettings?.statusColors?.[Object.keys(pluginSettings.statusColors).find(k => k.toLowerCase() === task.status.toLowerCase()) ?? '']
			?? DEFAULT_BAR_COLOR;
	}
	if (colorBy === 'priority') {
		return PRIORITY_COLORS[task.priority]
			?? pluginSettings?.priorityColors?.[task.priority]
			?? pluginSettings?.priorityColors?.[Object.keys(pluginSettings.priorityColors).find(k => k.toLowerCase() === task.priority.toLowerCase()) ?? '']
			?? DEFAULT_BAR_COLOR;
	}
	return DEFAULT_BAR_COLOR;
}

