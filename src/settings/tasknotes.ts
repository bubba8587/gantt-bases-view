import { Notice } from 'obsidian';
import type { App } from 'obsidian';
import type { PluginSettings } from '../core/model.ts';

interface TaskNotesOption {
	value?: string;
	color?: string;
}

interface TaskNotesData {
	customStatuses?: TaskNotesOption[];
	customPriorities?: TaskNotesOption[];
}

function toOptionsAndColors(items: TaskNotesOption[]): { options: string[]; colors: Record<string, string> } {
	const options: string[] = [];
	const colors: Record<string, string> = {};
	for (const item of items) {
		if (!item.value) continue;
		options.push(item.value);
		if (item.color) colors[item.value.toLowerCase()] = item.color;
	}
	return { options, colors };
}

/**
 * Imports status/priority options and their colors from the TaskNotes plugin.
 * Mutates `settings` and returns true when anything was imported. Shows a
 * Notice describing the outcome either way.
 */
export function syncFromTaskNotes(app: App, settings: PluginSettings): boolean {
	const tasknotes = (app as unknown as {
		plugins?: { plugins?: Record<string, { settings?: TaskNotesData; data?: TaskNotesData }> };
	}).plugins?.plugins?.['tasknotes'];
	if (!tasknotes) {
		new Notice('TaskNotes plugin not found. Is it installed and enabled?');
		return false;
	}

	const data = tasknotes.settings ?? tasknotes.data;
	if (!data) {
		new Notice('Could not read TaskNotes settings.');
		return false;
	}

	let synced = false;

	if (Array.isArray(data.customStatuses) && data.customStatuses.length > 0) {
		const { options, colors } = toOptionsAndColors(data.customStatuses);
		settings.statusOptions = options;
		settings.statusColors = colors;
		synced = true;
	}

	if (Array.isArray(data.customPriorities) && data.customPriorities.length > 0) {
		const { options, colors } = toOptionsAndColors(data.customPriorities);
		settings.priorityOptions = options;
		settings.priorityColors = colors;
		synced = true;
	}

	if (synced) {
		new Notice('Synced status, priority, and colors from TaskNotes.');
	} else {
		new Notice('No custom statuses or priorities found in TaskNotes.');
	}

	return synced;
}
