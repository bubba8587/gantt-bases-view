import {
	STATUS_COLORS,
	PRIORITY_COLORS,
	DEFAULT_BAR_COLOR,
	type ColorByField,
	type GanttTask,
	type PluginSettings,
} from '../core/model.ts';

/**
 * Own-property, case-insensitive lookup. Guarding with hasOwnProperty matters:
 * status/priority values come from user frontmatter, so a value like
 * "constructor" must not fall through to Object.prototype.
 */
function lookupColor(map: Record<string, string> | undefined, key: string): string | null {
	if (!map || !key) return null;
	if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
	const lower = key.toLowerCase();
	for (const k of Object.keys(map)) {
		if (k.toLowerCase() === lower) return map[k];
	}
	return null;
}

export function getBarColor(task: GanttTask, colorBy: ColorByField, pluginSettings?: PluginSettings): string {
	// Built-in colors take precedence, then colors synced from TaskNotes.
	if (colorBy === 'status') {
		return lookupColor(STATUS_COLORS, task.status)
			?? lookupColor(pluginSettings?.statusColors, task.status)
			?? DEFAULT_BAR_COLOR;
	}
	if (colorBy === 'priority') {
		return lookupColor(PRIORITY_COLORS, task.priority)
			?? lookupColor(pluginSettings?.priorityColors, task.priority)
			?? DEFAULT_BAR_COLOR;
	}
	return DEFAULT_BAR_COLOR;
}
