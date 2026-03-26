import type { BasesEntry, BasesPropertyId, BasesViewConfig } from 'obsidian';
import type { GanttTask, TaskDependency, DependencyType, GanttViewSettings } from './types.ts';
import { DEP_FIELDS, stripWikilink } from './types.ts';

const DEFAULT_START_PROP: BasesPropertyId = 'note.scheduled';
const DEFAULT_END_PROP: BasesPropertyId = 'note.due';

export function readSettings(config: BasesViewConfig): GanttViewSettings {
	return {
		startDateProp: config.getAsPropertyId('startDateProp') ?? DEFAULT_START_PROP as BasesPropertyId,
		endDateProp: config.getAsPropertyId('endDateProp') ?? DEFAULT_END_PROP as BasesPropertyId,
		zoom: (config.get('zoom') as GanttViewSettings['zoom']) ?? 'week',
		colorBy: (config.get('colorBy') as GanttViewSettings['colorBy']) ?? 'priority',
		showDependencies: (config.get('showDependencies') as boolean) ?? true,
		showToday: (config.get('showToday') as boolean) ?? true,
		showPriority: true,
		visibleDepTypes: new Set(['FS', 'SS', 'FF', 'SF'] as DependencyType[]),
	};
}

function parseDate(value: unknown): Date | null {
	if (value == null) return null;
	const str = String(value).trim();
	if (!str) return null;
	// Parse YYYY-MM-DD as local midnight to avoid the UTC-midnight timezone shift
	// that new Date("YYYY-MM-DD") produces (shows as previous day in UTC- zones).
	const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (iso) {
		const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
		return isNaN(d.getTime()) ? null : d;
	}
	const d = new Date(str);
	return isNaN(d.getTime()) ? null : d;
}

function parseNumber(value: unknown): number | null {
	if (value == null) return null;
	const n = Number(value);
	return isNaN(n) ? null : n;
}

function parseString(value: unknown): string {
	if (value == null) return '';
	return String(value).trim();
}

function parseArrayOfStrings(value: unknown): string[] {
	if (value == null) return [];
	if (Array.isArray(value)) return value.filter(v => v != null).map(v => String(v).trim()).filter(s => s && s !== 'null');
	const str = String(value).trim();
	if (!str || str === 'null') return [];
	// A scalar string may contain multiple wikilinks: "[[A]], [[B]]"
	// Extract each [[...]] occurrence individually so they're stripped correctly.
	const matches = str.match(/\[\[[^\]]+\]\]/g);
	if (matches && matches.length > 1) return matches;
	return [str];
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

export function resolveDependencyPaths(tasks: GanttTask[]): void {
	const nameToPath = new Map<string, string>();
	for (const task of tasks) {
		nameToPath.set(task.file.basename.toLowerCase(), task.id);
		// Also map by title
		if (task.title) {
			nameToPath.set(task.title.toLowerCase(), task.id);
		}
	}

	for (const task of tasks) {
		for (const dep of task.dependencies) {
			const bare = stripWikilink(dep.targetName).toLowerCase();
			const resolved = nameToPath.get(bare) ?? nameToPath.get(dep.targetName.toLowerCase());
			if (resolved) {
				dep.targetPath = resolved;
			}
		}
	}
}
