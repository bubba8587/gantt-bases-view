import type { GanttTask, TimelineConfig, ColumnHeader, ZoomLevel } from './types.ts';
import { TIMELINE_PADDING_DAYS } from './types.ts';

export function getPixelsPerDay(zoom: ZoomLevel): number {
	switch (zoom) {
		case 'day':    return 40;
		case 'week':   return 12;
		case 'month':  return 3;
		case '1year':  return 1;
		case '2year':  return 0.5;
		case '3year':  return 0.34;
	}
}

export function computeTimelineRange(tasks: GanttTask[], zoom: ZoomLevel): TimelineConfig {
	const now = new Date();
	let earliest = new Date(now);
	let latest = new Date(now);

	for (const task of tasks) {
		if (task.startDate && task.startDate < earliest) earliest = new Date(task.startDate);
		if (task.endDate && task.endDate > latest) latest = new Date(task.endDate);
		if (task.startDate && task.startDate > latest) latest = new Date(task.startDate);
		if (task.endDate && task.endDate < earliest) earliest = new Date(task.endDate);
		if (task.completedDate && task.completedDate < earliest) earliest = new Date(task.completedDate);
		if (task.completedDate && task.completedDate > latest) latest = new Date(task.completedDate);
	}

	// Add padding
	earliest.setDate(earliest.getDate() - TIMELINE_PADDING_DAYS);
	latest.setDate(latest.getDate() + TIMELINE_PADDING_DAYS);

	// Snap to start of period
	if (zoom === '1year' || zoom === '2year' || zoom === '3year') {
		earliest = new Date(earliest.getFullYear(), 0, 1);
		latest = new Date(latest.getFullYear() + 1, 0, 1);
	} else if (zoom === 'month') {
		earliest.setDate(1);
	} else if (zoom === 'week') {
		const day = earliest.getDay();
		earliest.setDate(earliest.getDate() - day);
	}

	earliest = snapToDay(earliest);
	latest = snapToDay(latest);

	return {
		startDate: earliest,
		endDate: latest,
		zoom,
		pixelsPerDay: getPixelsPerDay(zoom),
	};
}

export function dateToPixelOffset(date: Date, config: TimelineConfig): number {
	const diffMs = date.getTime() - config.startDate.getTime();
	const diffDays = diffMs / (1000 * 60 * 60 * 24);
	return Math.round(diffDays * config.pixelsPerDay);
}

export function snapToDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function daysBetween(a: Date, b: Date): number {
	const diffMs = b.getTime() - a.getTime();
	return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function totalTimelineWidth(config: TimelineConfig): number {
	return dateToPixelOffset(config.endDate, config);
}

/** Sum of all rendered column widths — use this for sizing the bars/header area
 *  so the last column header is never clipped or orphaned. */
export function columnsWidth(columns: ColumnHeader[]): number {
	return columns.reduce((sum, col) => sum + col.widthPx, 0);
}

/** Returns ISO 8601 week number and the ISO week-year for a date. */
function isoWeek(date: Date): { week: number; year: number } {
	// Work in UTC to avoid DST issues
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const day = d.getUTCDay() || 7; // 1=Mon … 7=Sun
	d.setUTCDate(d.getUTCDate() + 4 - day); // shift to nearest Thursday
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
	return { week, year: d.getUTCFullYear() };
}

export function generateColumns(config: TimelineConfig): ColumnHeader[] {
	const columns: ColumnHeader[] = [];
	const cursor = new Date(config.startDate);

	switch (config.zoom) {
		case 'day': {
			// Group by month — emit a month-span header first, then per-day columns
			// We encode month breaks as a special label prefix so the renderer can
			// split into two rows: month strip on top, day numbers below.
			while (cursor <= config.endDate) {
				const dayNum = cursor.getDate();
				const month = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
				// Label format: "month|day" — renderer splits on '|'
				columns.push({
					label: `${month}|${dayNum}`,
					startDate: new Date(cursor),
					widthPx: config.pixelsPerDay,
				});
				cursor.setDate(cursor.getDate() + 1);
			}
			break;
		}

		case 'week': {
			while (cursor <= config.endDate) {
				const weekStart = new Date(cursor);
				// Use the Monday of this week for ISO week calculation
				// (columns snap to Sunday, so +1 gives the ISO week Monday)
				const monday = new Date(weekStart);
				monday.setDate(monday.getDate() + 1);
				const { week, year } = isoWeek(monday);
				columns.push({
					label: `${year}|W${week}`,
					startDate: new Date(weekStart),
					widthPx: 7 * config.pixelsPerDay,
				});
				cursor.setDate(cursor.getDate() + 7);
			}
			break;
		}

		case 'month': {
			while (cursor <= config.endDate) {
				const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
				const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
				const daysInMonth = monthEnd.getDate();
				const year = String(monthStart.getFullYear());
				const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
				columns.push({
					label: `${year}|${monthName}`,
					startDate: new Date(monthStart),
					widthPx: daysInMonth * config.pixelsPerDay,
				});
				cursor.setMonth(cursor.getMonth() + 1);
				cursor.setDate(1);
			}
			break;
		}

		case '1year':
		case '2year':
		case '3year': {
			// Quarter columns within each year, grouped by year
			while (cursor <= config.endDate) {
				const year = cursor.getFullYear();
				const q = Math.floor(cursor.getMonth() / 3); // 0–3
				const qStart = new Date(year, q * 3, 1);
				const qEnd = new Date(year, q * 3 + 3, 0);
				const daysInQ = Math.round((qEnd.getTime() - qStart.getTime()) / 86400000) + 1;
				columns.push({
					label: `${year}|Q${q + 1}`,
					startDate: new Date(qStart),
					widthPx: daysInQ * config.pixelsPerDay,
				});
				cursor.setMonth(q * 3 + 3);
				cursor.setDate(1);
			}
			break;
		}
	}

	return columns;
}

export function getTaskBarBounds(
	task: GanttTask,
	config: TimelineConfig,
): { left: number; width: number } | null {
	let start = task.startDate;
	let end = task.endDate;

	if (!start && !end) return null;

	if (start && !end) {
		if (task.timeEstimate) {
			end = new Date(start);
			end.setDate(end.getDate() + Math.ceil(task.timeEstimate / (60 * 8))); // 8hr days
		} else {
			end = new Date(start);
			end.setDate(end.getDate() + 1);
		}
	}

	if (!start && end) {
		start = new Date(end);
		start.setDate(start.getDate() - 1);
	}

	const left = dateToPixelOffset(start!, config);
	const right = dateToPixelOffset(end!, config);
	const width = Math.max(right - left, config.pixelsPerDay);

	return { left, width };
}
