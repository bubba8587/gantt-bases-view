import type { TFile, BasesEntry, BasesPropertyId } from 'obsidian';

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface TaskDependency {
	targetPath: string;
	targetName: string;
	type: DependencyType;
}

export interface GanttTask {
	id: string;
	file: TFile;
	title: string;
	startDate: Date | null;
	endDate: Date | null;
	completedDate: Date | null;
	status: string;
	priority: string;
	dependencies: TaskDependency[];
	timeEstimate: number | null;
	isMilestone: boolean;
	entry: BasesEntry;
}

export type ZoomLevel = 'day' | 'week' | 'month' | '1year' | '2year' | '3year';

export interface TimelineConfig {
	startDate: Date;
	endDate: Date;
	zoom: ZoomLevel;
	pixelsPerDay: number;
}

export interface ColumnHeader {
	label: string;
	startDate: Date;
	widthPx: number;
}

export interface TaskGroup {
	key: string;
	tasks: GanttTask[];
}

export const ROW_HEIGHT = 36;
export const BAR_HEIGHT = 24;
export const BAR_MARGIN_TOP = 6;
export const SIDEBAR_WIDTH = 200;
export const HEADER_HEIGHT = 48;
export const GROUP_HEADER_HEIGHT = 24;
export const TIMELINE_PADDING_DAYS = 7;
export const MIN_TIMELINE_WIDTH = 400;
export const MIN_BAR_LABEL_WIDTH = 50;
export const MIN_SIDEBAR_WIDTH = 120;
export const MAX_SIDEBAR_WIDTH = 520;

export const STATUS_COLORS: Record<string, string> = {
	'to-do': 'var(--gbv-status-todo, #868e96)',
	'in-progress': 'var(--gbv-status-inprogress, #339af0)',
	'done': 'var(--gbv-status-done, #51cf66)',
	'blocked': 'var(--gbv-status-blocked, #ff6b6b)',
};

export const PRIORITY_COLORS: Record<string, string> = {
	'high': 'var(--gbv-priority-high, #ff6b6b)',
	'medium': 'var(--gbv-priority-medium, #ffd43b)',
	'low': 'var(--gbv-priority-low, #868e96)',
};

export const DEFAULT_BAR_COLOR = 'var(--gbv-bar-default, #339af0)';

/** Single source of truth for dependency type ↔ frontmatter field mapping. */
export const DEP_FIELDS: ReadonlyArray<{ bare: string; prop: string; type: DependencyType }> = [
	{ bare: 'blockedBy',        prop: 'note.blockedBy',        type: 'FS' },
	{ bare: 'syncStart',        prop: 'note.syncStart',        type: 'SS' },
	{ bare: 'syncFinish',       prop: 'note.syncFinish',       type: 'FF' },
	{ bare: 'finishAfterStart', prop: 'note.finishAfterStart', type: 'SF' },
];

/** Strip [[…]] wikilink brackets and |alias suffix. */
export function stripWikilink(s: string): string {
	let r = s.trim();
	if (r.startsWith('[[') && r.endsWith(']]')) r = r.slice(2, -2);
	const pipe = r.indexOf('|');
	if (pipe >= 0) r = r.slice(0, pipe);
	return r.trim();
}

export type ColorByField = 'status' | 'priority';

export interface GanttViewSettings {
	startDateProp: BasesPropertyId | null;
	endDateProp: BasesPropertyId | null;
	zoom: ZoomLevel;
	colorBy: ColorByField;
	showDependencies: boolean;
	showToday: boolean;
	showPriority: boolean;
	visibleDepTypes: Set<DependencyType>;
}
