import type { GanttTask, TaskGroup, TimelineConfig } from './types.ts';
import { daysBetween, formatDate, generateColumns } from './timeline.ts';

// ── Internal helpers ──────────────────────────────────────────────────────────

function depsLabel(task: GanttTask): string {
	if (!task.dependencies || task.dependencies.length === 0) return '';
	return task.dependencies
		.filter(d => d.targetName)
		.map(d => `${d.targetName} (${d.type})`)
		.join(', ');
}

function durationDays(task: GanttTask): string {
	if (!task.startDate || !task.endDate) return '';
	return String(daysBetween(task.startDate, task.endDate));
}

// ── TSV export ────────────────────────────────────────────────────────────────

const DATA_HEADERS = ['Task', 'Status', 'Priority', 'Start', 'End', 'Duration (days)', 'Dependencies'];
const BAR_CHAR = '█';

/**
 * Returns true if the task bar overlaps the column's time range.
 * colStart is inclusive, colEnd is the day after the last day in the column.
 */
function taskOverlapsColumn(task: GanttTask, colStart: Date, colEnd: Date): boolean {
	const start = task.startDate;
	const end = task.endDate;
	if (!start || !end) return false;
	return start < colEnd && end > colStart;
}

/**
 * Export task groups to TSV including a visual Gantt bar approximation.
 *
 * Format:
 *   Columns 1–7: Task | Status | Priority | Start | End | Duration | Dependencies
 *   Columns 8+:  One column per time unit (week/month/quarter) — '█' if the
 *               task bar covers that period, empty otherwise.
 *
 * The date column headers use the same labels as the on-screen timeline.
 * Suitable for pasting directly into Excel.
 */
export function exportToTSV(groups: TaskGroup[], timelineConfig: TimelineConfig): string {
	const columns = generateColumns(timelineConfig);

	// Column date ranges — each column spans from startDate to the next column's startDate
	const colRanges = columns.map((col, i) => {
		const colStart = col.startDate;
		const colEnd = i + 1 < columns.length
			? columns[i + 1].startDate
			: new Date(col.startDate.getTime() + col.widthPx / timelineConfig.pixelsPerDay * 86400000);
		return { label: displayLabel(col.label), colStart, colEnd };
	});

	// Header row
	const headerCells = [...DATA_HEADERS, ...colRanges.map(c => c.label)];
	const lines: string[] = [headerCells.join('\t')];

	for (const group of groups) {
		if (group.key) {
			// Group header row — pad data cols + one label in first date col
			const pad = '\t'.repeat(DATA_HEADERS.length - 1);
			lines.push(`${group.key}${pad}`);
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

			const barCols = colRanges.map(({ colStart, colEnd }) =>
				taskOverlapsColumn(task, colStart, colEnd) ? BAR_CHAR : ''
			);

			lines.push([...dataCols, ...barCols].join('\t'));
		}
	}

	return lines.join('\n');
}

/**
 * Convert the internal column label to a TSV-friendly header.
 * Day-zoom labels use "MMM YYYY|DD" format — we collapse to "MMM DD" so the
 * month context is preserved without the pipe character in the spreadsheet column header.
 * Other zoom levels use the label as-is.
 */
function displayLabel(label: string): string {
	const pipeIdx = label.indexOf('|');
	if (pipeIdx < 0) return label;
	// "Apr 2026|14"  → "Apr 14"  (drop year to keep header compact)
	const month = label.slice(0, label.indexOf(' '));  // "Apr"
	const day = label.slice(pipeIdx + 1);              // "14"
	return `${month} ${day}`;
}

// ── Clipboard ─────────────────────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<void> {
	await navigator.clipboard.writeText(text);
}

// ── Markdown table export (kept for Obsidian note paste) ──────────────────────

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
		if (group.key) lines.push(`| **${escapeCell(group.key)}** | | | | | | |`);
		for (const task of group.tasks) lines.push(taskToMarkdownRow(task));
	}
	return lines.join('\n');
}
