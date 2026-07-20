import type { TFile, BasesEntry, BasesPropertyId } from 'obsidian';

// ─── Task model ──────────────────────────────────────────────────────────────

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface TaskDependency {
	/** Resolved vault path of the predecessor task ('' when unresolved). */
	targetPath: string;
	/** Raw frontmatter value, e.g. "[[GE-Design]]". */
	targetName: string;
	type: DependencyType;
}

/**
 * Which sides of the start/end/duration triangle are pinned. Locked fields
 * are never changed by any operation — drag, resize, popup edits, or
 * violation fixes — and operations that can't satisfy their goal without
 * touching a locked field are refused.
 */
export interface TaskLocks {
	start: boolean;
	end: boolean;
	duration: boolean;
}

export const NO_LOCKS: Readonly<TaskLocks> = Object.freeze({ start: false, end: false, duration: false });

/** Frontmatter property holding the lock list, e.g. `ganttLocks: [start, duration]`. */
export const LOCKS_FIELD = 'ganttLocks';

export function parseLocks(values: string[]): TaskLocks {
	const set = new Set(values.map(v => v.toLowerCase()));
	return {
		start: set.has('start'),
		end: set.has('end'),
		duration: set.has('duration'),
	};
}

export function locksToFrontmatter(locks: TaskLocks): string[] {
	return (['start', 'end', 'duration'] as const).filter(k => locks[k]);
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
	locks: TaskLocks;
	entry: BasesEntry;
}

export interface TaskGroup {
	/** Full group identity (e.g. the complete folder path) — unique per group. */
	key: string;
	/** Short display label (e.g. just the folder name). Falls back to key. */
	label?: string;
	tasks: GanttTask[];
}

// ─── Timeline model ──────────────────────────────────────────────────────────

export type ZoomLevel = 'day' | 'week' | 'month' | '1year' | '2year' | '3year';

export interface TimelineConfig {
	startDate: Date;
	endDate: Date;
	zoom: ZoomLevel;
	pixelsPerDay: number;
}

export interface ColumnHeader {
	/** Top-row band label (month for day zoom, year otherwise). */
	group: string;
	/** Bottom-row cell label (day number, W15, Apr, Q2, …). */
	label: string;
	/** First day covered by the column (inclusive). */
	startDate: Date;
	/** Day after the last day covered by the column (exclusive). */
	endDateExclusive: Date;
	widthPx: number;
}

// ─── Layout constants ────────────────────────────────────────────────────────

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

// ─── Colors ──────────────────────────────────────────────────────────────────

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

// ─── Dependency fields ───────────────────────────────────────────────────────

/** Single source of truth for dependency type ↔ frontmatter field mapping. */
export const DEP_FIELDS: ReadonlyArray<{ bare: string; prop: string; type: DependencyType }> = [
	{ bare: 'blockedBy',        prop: 'note.blockedBy',        type: 'FS' },
	{ bare: 'syncStart',        prop: 'note.syncStart',        type: 'SS' },
	{ bare: 'syncFinish',       prop: 'note.syncFinish',       type: 'FF' },
	{ bare: 'finishAfterStart', prop: 'note.finishAfterStart', type: 'SF' },
];

export const DEP_TYPES: ReadonlyArray<DependencyType> = DEP_FIELDS.map(f => f.type);

export const DEP_TYPE_TO_FIELD: Readonly<Record<DependencyType, string>> = Object.fromEntries(
	DEP_FIELDS.map(f => [f.type, f.bare]),
) as Record<DependencyType, string>;

/**
 * Display label for a group key. Wikilinks are stripped, and path-like keys
 * (folder grouping) collapse to their last segment — "Projects/Clients/Acme"
 * reads as "Acme". The full key stays the group's identity and tooltip.
 */
export function groupDisplayLabel(rawKey: string): string {
	const stripped = stripWikilink(rawKey);
	if (!stripped) return 'Ungrouped';
	if (stripped.includes('/')) {
		const last = stripped.split('/').filter(Boolean).pop();
		if (last) return last;
	}
	return stripped;
}

/** Strip [[…]] wikilink brackets and |alias suffix. */
export function stripWikilink(s: string): string {
	let r = s.trim();
	if (r.startsWith('[[') && r.endsWith(']]')) r = r.slice(2, -2);
	const pipe = r.indexOf('|');
	if (pipe >= 0) r = r.slice(0, pipe);
	return r.trim();
}

// ─── Settings ────────────────────────────────────────────────────────────────

export type ColorByField = 'none' | 'status' | 'priority';

export interface PluginSettings {
	startDateProp: string;
	endDateProp: string;
	statusOptions: string[];
	priorityOptions: string[];
	statusColors: Record<string, string>;
	priorityColors: Record<string, string>;
}

export const DEFAULT_STATUS_OPTIONS = ['to-do', 'in-progress', 'done', 'blocked'];
export const DEFAULT_PRIORITY_OPTIONS = ['low', 'medium', 'high'];

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
	startDateProp: 'scheduled',
	endDateProp: 'due',
	statusOptions: DEFAULT_STATUS_OPTIONS,
	priorityOptions: DEFAULT_PRIORITY_OPTIONS,
	statusColors: {},
	priorityColors: {},
};

/** Per-view settings resolved from the Bases view config + plugin settings. */
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
