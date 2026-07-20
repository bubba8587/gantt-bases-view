import type { BasesEntry, BasesPropertyId, BasesViewConfig } from 'obsidian';
import type { GanttTask, TaskDependency, DependencyType, GanttViewSettings, PluginSettings } from './model.ts';
import { DEP_FIELDS, stripWikilink, DEFAULT_PLUGIN_SETTINGS } from './model.ts';
import { parseDate, parseNumber, parseString, parseArrayOfStrings } from './parse.ts';

export function readSettings(config: BasesViewConfig, pluginSettings?: PluginSettings): GanttViewSettings {
	const startProp = pluginSettings?.startDateProp || DEFAULT_PLUGIN_SETTINGS.startDateProp;
	const endProp = pluginSettings?.endDateProp || DEFAULT_PLUGIN_SETTINGS.endDateProp;
	return {
		startDateProp: (`note.${startProp}`) as BasesPropertyId,
		endDateProp: (`note.${endProp}`) as BasesPropertyId,
		zoom: (config.get('zoom') as GanttViewSettings['zoom']) ?? 'week',
		colorBy: 'none',
		showDependencies: (config.get('showDependencies') as boolean) ?? true,
		showToday: (config.get('showToday') as boolean) ?? true,
		showPriority: true,
		visibleDepTypes: new Set(DEP_FIELDS.map(f => f.type)),
	};
}

function parseDependencies(entry: BasesEntry): TaskDependency[] {
	const deps: TaskDependency[] = [];

	for (const { prop, type } of DEP_FIELDS) {
		const value = entry.getValue(prop as BasesPropertyId);
		if (value == null) continue;
		for (const item of parseArrayOfStrings(value)) {
			if (item) deps.push({ targetPath: '', targetName: item, type });
		}
	}

	return deps;
}

export function extractTask(entry: BasesEntry, settings: GanttViewSettings): GanttTask {
	const startDate = settings.startDateProp
		? parseDate(entry.getValue(settings.startDateProp))
		: null;
	const endDate = settings.endDateProp
		? parseDate(entry.getValue(settings.endDateProp))
		: null;
	const completedDate = parseDate(entry.getValue('note.completedDate' as BasesPropertyId));
	const status = parseString(entry.getValue('note.status' as BasesPropertyId));
	const priority = parseString(entry.getValue('note.priority' as BasesPropertyId));
	const title = parseString(entry.getValue('note.title' as BasesPropertyId)) || entry.file.basename;
	const timeEstimate = parseNumber(entry.getValue('note.timeEstimate' as BasesPropertyId));
	const dependencies = parseDependencies(entry);

	// A milestone is a single point in time: one date with no duration
	const isMilestone =
		(startDate !== null && endDate === null && timeEstimate === null) ||
		(startDate !== null && endDate !== null &&
			startDate.toDateString() === endDate.toDateString());

	return {
		id: entry.file.path,
		file: entry.file,
		title,
		startDate,
		endDate,
		completedDate,
		status: status.toLowerCase(),
		priority: priority.toLowerCase(),
		dependencies,
		timeEstimate,
		isMilestone,
		entry,
	};
}

/**
 * Resolves each dependency's wikilink target to a task id (vault path).
 * Matches by note basename or task title, case-insensitively. Wikilinks that
 * carry a folder path ("[[Projects/Design]]") also match by their last
 * segment, mirroring Obsidian's shortest-link resolution.
 */
export function resolveDependencyPaths(tasks: GanttTask[]): void {
	const nameToPath = new Map<string, string>();
	for (const task of tasks) {
		nameToPath.set(task.file.basename.toLowerCase(), task.id);
		if (task.title) {
			nameToPath.set(task.title.toLowerCase(), task.id);
		}
	}

	for (const task of tasks) {
		for (const dep of task.dependencies) {
			const bare = stripWikilink(dep.targetName).toLowerCase();
			const lastSegment = bare.split('/').pop() ?? bare;
			const resolved =
				nameToPath.get(bare) ??
				nameToPath.get(lastSegment) ??
				nameToPath.get(dep.targetName.toLowerCase());
			if (resolved) {
				dep.targetPath = resolved;
			}
		}
	}
}
