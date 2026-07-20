import type { TFile, BasesEntry } from 'obsidian';
import type { GanttTask, TimelineConfig, ZoomLevel } from '../src/core/model.ts';
import { NO_LOCKS } from '../src/core/model.ts';
import { getPixelsPerDay } from '../src/core/timeline.ts';

/** Builds a GanttTask with sensible defaults for tests. */
export function makeTask(id: string, overrides: Partial<GanttTask> = {}): GanttTask {
	return {
		id,
		file: { path: id, basename: id.replace(/\.md$/, '').split('/').pop() } as unknown as TFile,
		title: overrides.title ?? id.replace(/\.md$/, '').split('/').pop() ?? id,
		startDate: null,
		endDate: null,
		completedDate: null,
		status: '',
		priority: '',
		dependencies: [],
		timeEstimate: null,
		isMilestone: false,
		locks: { ...NO_LOCKS },
		entry: {} as BasesEntry,
		...overrides,
	};
}

export function makeConfig(startDate: Date, endDate: Date, zoom: ZoomLevel): TimelineConfig {
	return { startDate, endDate, zoom, pixelsPerDay: getPixelsPerDay(zoom) };
}

/** Fake BasesEntry backed by a plain property map. */
export function makeEntry(path: string, values: Record<string, unknown>): BasesEntry {
	return {
		file: { path, basename: path.replace(/\.md$/, '').split('/').pop() },
		getValue: (prop: string) => values[prop],
	} as unknown as BasesEntry;
}
