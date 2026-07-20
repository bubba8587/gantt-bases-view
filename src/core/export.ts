import type { GanttTask, TaskGroup, TimelineConfig, ColumnHeader } from './model.ts';
import { daysBetween, formatDate, generateColumns } from './timeline.ts';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function depsLabel(task: GanttTask): string {
	if (!task.dependencies || task.dependencies.length === 0) return '';
	return task.dependencies
		.filter(d => d.targetName)
		.map(d => `${d.targetName} (${d.type})`)
		.join(', ');
}

function durationDays(task: GanttTask): string {
	if (!task.startDate || !task.endDate) return '';
	// Inclusive dates: Aug 1 → Aug 14 is a 14-day task.
	return String(daysBetween(task.startDate, task.endDate) + 1);
}

// ─── TSV export ──────────────────────────────────────────────────────────────

const DATA_HEADERS = ['Task', 'Status', 'Priority', 'Start', 'End', 'Duration (days)', 'Dependencies'];
const BAR_CHAR = '█';

/** Spreadsheet-friendly header for a timeline column, e.g. "Apr 14", "W15 2026", "Q2 2026". */
export function columnExportLabel(col: ColumnHeader, zoom: TimelineConfig['zoom']): string {
	if (zoom === 'day') {
		const month = col.startDate.toLocaleDateString('en-US', { month: 'short' });
		return `${month} ${col.label}`;
	}
	// Week/month/quarter columns are banded by year: "W15 2026", "Apr 2026", "Q2 2026".
	return `${col.label} ${col.group}`;
}

/**
 * Returns true if the task bar overlaps the column's day range
 * [startDate, endDateExclusive). Task end dates are inclusive.
 */
function taskOverlapsColumn(task: GanttTask, col: ColumnHeader): boolean {
	const start = task.startDate;
	const end = task.endDate;
	if (!start || !end) return false;
	return start < col.endDateExclusive && end >= col.startDate;
}

/**
 * Export task groups to TSV including a visual Gantt bar approximation.
 *
 * Format:
 *   Columns 1–7: Task | Status | Priority | Start | End | Duration | Dependencies
 *   Columns 8+:  One column per time unit (day/week/month/quarter) — '█' if
 *                the task bar covers that period, empty otherwise.
 *
 * Suitable for pasting directly into a spreadsheet.
 */
export function exportToTSV(groups: TaskGroup[], timelineConfig: TimelineConfig): string {
	const columns = generateColumns(timelineConfig);

	const headerCells = [
		...DATA_HEADERS,
		...columns.map(c => columnExportLabel(c, timelineConfig.zoom)),
	];
	const lines: string[] = [headerCells.join('\t')];

	for (const group of groups) {
		if (group.key) {
			// Group header row — display label in the first cell, remaining data cells empty
			lines.push(`${group.label || group.key}${'\t'.repeat(DATA_HEADERS.length - 1)}`);
		}
		for (const task of group.tasks) {
			const dataCols = [
				task.title || task.file.basename,
				task.status || '',
				task.priority || '',
				task.startDate ? formatDate(task.startDate) : '',
				task.endDate ? formatDate(task.endDate) : '',
				durationDays(task),
				depsLabel(task),
			].map(c => c.replace(/\t/g, ' '));

			const barCols = columns.map(col => (taskOverlapsColumn(task, col) ? BAR_CHAR : ''));

			lines.push([...dataCols, ...barCols].join('\t'));
		}
	}

	return lines.join('\n');
}

// ─── Markdown table export (kept for Obsidian note paste) ────────────────────

function escapeCell(s: string): string {
	return s.replace(/\|/g, '\\|');
}

function taskToMarkdownRow(task: GanttTask): string {
	const link = `[[${escapeCell(task.file.basename)}]]`;
	const status = escapeCell(task.status || '-');
	const priority = escapeCell(task.priority || '-');
	const start = task.startDate ? formatDate(task.startDate) : '-';
	const end = task.endDate ? formatDate(task.endDate) : '-';
	const duration = durationDays(task) || '-';
	const deps = escapeCell(depsLabel(task) || '-');
	return `| ${link} | ${status} | ${priority} | ${start} | ${end} | ${duration} | ${deps} |`;
}

const MARKDOWN_HEADER =
	'| Task | Status | Priority | Start | End | Duration (days) | Dependencies |\n' +
	'|------|--------|----------|-------|-----|-----------------|--------------|';

export function exportToMarkdownTable(groups: TaskGroup[]): string {
	const lines: string[] = [MARKDOWN_HEADER];
	for (const group of groups) {
		if (group.key) lines.push(`| **${escapeCell(group.label || group.key)}** | | | | | | |`);
		for (const task of group.tasks) lines.push(taskToMarkdownRow(task));
	}
	return lines.join('\n');
}
