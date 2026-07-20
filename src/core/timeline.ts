import type { GanttTask, TimelineConfig, ColumnHeader, ZoomLevel } from './model.ts';
import { TIMELINE_PADDING_DAYS } from './model.ts';

// ─── Date arithmetic ─────────────────────────────────────────────────────────
// All day math is calendar-day based (via Date.UTC on the local Y/M/D) so that
// DST transitions — where a local day is 23 or 25 hours — never cause bars to
// drift out of alignment with the column grid.

export function snapToDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

/** Whole calendar days from a to b (positive when b is later). */
export function daysBetween(a: Date, b: Date): number {
	const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
	const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
	return Math.round((utcB - utcA) / 86_400_000);
}

export function addDays(date: Date, days: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
}

export function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Fraction of the local day elapsed at `date` (0 at midnight). */
function fractionOfDay(date: Date): number {
	return (
		(date.getHours() +
			date.getMinutes() / 60 +
			date.getSeconds() / 3600) / 24
	);
}

// ─── Timeline configuration ──────────────────────────────────────────────────

export function getPixelsPerDay(zoom: ZoomLevel): number {
	switch (zoom) {
		case 'day':    return 40;
		case 'week':   return 12;
		case 'month':  return 3;
		// Fallback densities for the year zooms — normally replaced by
		// fitZoomToViewport, which scales them to the actual viewport width.
		case '1year':  return 1;
		case '2year':  return 0.5;
		case '3year':  return 0.34;
	}
}

/** Years the viewport should span for a zoom level, or null for the
 *  fixed-density zooms (day/week/month). */
export function viewportYearSpan(zoom: ZoomLevel): number | null {
	switch (zoom) {
		case '1year': return 1;
		case '2year': return 2;
		case '3year': return 3;
		default: return null;
	}
}

/**
 * The year zooms promise "N years visible at once": scale pixelsPerDay so N
 * years fill the viewport exactly. With a fixed density, any viewport wider
 * than N years × pixelsPerDay would get padded out to fill the width — on a
 * typical monitor that made "2Y" show ~6 years and "3Y" show ~9.
 */
export function fitZoomToViewport(config: TimelineConfig, availableWidth: number): TimelineConfig {
	const years = viewportYearSpan(config.zoom);
	if (!years || availableWidth <= 0) return config;
	return { ...config, pixelsPerDay: availableWidth / (years * 365.25) };
}

export function computeTimelineRange(tasks: GanttTask[], zoom: ZoomLevel): TimelineConfig {
	const now = new Date();
	let earliest = new Date(now);
	let latest = new Date(now);

	for (const task of tasks) {
		for (const date of [task.startDate, task.endDate, task.completedDate]) {
			if (!date) continue;
			if (date < earliest) earliest = new Date(date);
			if (date > latest) latest = new Date(date);
		}
	}

	earliest = addDays(earliest, -TIMELINE_PADDING_DAYS);
	latest = addDays(latest, TIMELINE_PADDING_DAYS);

	// Snap to start of period
	if (zoom === '1year' || zoom === '2year' || zoom === '3year') {
		earliest = new Date(earliest.getFullYear(), 0, 1);
		latest = new Date(latest.getFullYear() + 1, 0, 1);
	} else if (zoom === 'month') {
		earliest.setDate(1);
	} else if (zoom === 'week') {
		earliest = addDays(earliest, -earliest.getDay()); // snap to Sunday
	}

	return {
		startDate: snapToDay(earliest),
		endDate: snapToDay(latest),
		zoom,
		pixelsPerDay: getPixelsPerDay(zoom),
	};
}

/**
 * Pixel offset of `date` from the timeline start. Whole days are counted as
 * calendar days; the intra-day fraction is preserved so e.g. the today line
 * lands at the current hour within its day column.
 */
export function dateToPixelOffset(date: Date, config: TimelineConfig): number {
	const days = daysBetween(config.startDate, date) + fractionOfDay(date);
	return Math.round(days * config.pixelsPerDay);
}

export function totalTimelineWidth(config: TimelineConfig): number {
	return dateToPixelOffset(config.endDate, config);
}

/** Sum of all rendered column widths — use this for sizing the bars/header area
 *  so the last column header is never clipped or orphaned. */
export function columnsWidth(columns: ColumnHeader[]): number {
	return columns.reduce((sum, col) => sum + col.widthPx, 0);
}

// ─── Column generation ───────────────────────────────────────────────────────

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
	let cursor = new Date(config.startDate);
	const ppd = config.pixelsPerDay;

	switch (config.zoom) {
		case 'day': {
			// One column per day, banded by month in the top header row.
			while (cursor <= config.endDate) {
				const next = addDays(cursor, 1);
				columns.push({
					group: cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
					label: String(cursor.getDate()),
					startDate: new Date(cursor),
					endDateExclusive: next,
					widthPx: ppd,
				});
				cursor = next;
			}
			break;
		}

		case 'week': {
			// Columns snap to Sunday; ISO weeks are Monday-based, so the week
			// number is taken from the Monday inside each column.
			while (cursor <= config.endDate) {
				const next = addDays(cursor, 7);
				const { week, year } = isoWeek(addDays(cursor, 1));
				columns.push({
					group: String(year),
					label: `W${week}`,
					startDate: new Date(cursor),
					endDateExclusive: next,
					widthPx: 7 * ppd,
				});
				cursor = next;
			}
			break;
		}

		case 'month': {
			while (cursor <= config.endDate) {
				const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
				const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
				const daysInMonth = daysBetween(monthStart, nextMonth);
				columns.push({
					group: String(monthStart.getFullYear()),
					label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
					startDate: monthStart,
					endDateExclusive: nextMonth,
					widthPx: daysInMonth * ppd,
				});
				cursor = nextMonth;
			}
			break;
		}

		case '1year':
		case '2year':
		case '3year': {
			// Quarter columns within each year, banded by year.
			while (cursor <= config.endDate) {
				const year = cursor.getFullYear();
				const q = Math.floor(cursor.getMonth() / 3); // 0–3
				const qStart = new Date(year, q * 3, 1);
				const nextQ = new Date(year, q * 3 + 3, 1);
				columns.push({
					group: String(year),
					label: `Q${q + 1}`,
					startDate: qStart,
					endDateExclusive: nextQ,
					widthPx: daysBetween(qStart, nextQ) * ppd,
				});
				cursor = nextQ;
			}
			break;
		}
	}

	return columns;
}

// ─── Bar geometry ────────────────────────────────────────────────────────────

/**
 * The dates a task's bar actually renders with, filling in the missing side:
 * start-only tasks run 1 day (or their timeEstimate at 8h/day), deadline-only
 * tasks get a 1-day bar ending on the due date. Null when the task has no
 * dates at all.
 */
export function getEffectiveBarDates(
	task: Pick<GanttTask, 'startDate' | 'endDate' | 'timeEstimate'>,
): { start: Date; end: Date } | null {
	const { startDate, endDate, timeEstimate } = task;
	if (!startDate && !endDate) return null;

	if (startDate && !endDate) {
		// 8-hour workdays when a timeEstimate (minutes) is present; 1 day otherwise.
		const days = timeEstimate ? Math.ceil(timeEstimate / (60 * 8)) : 1;
		return { start: startDate, end: addDays(startDate, days) };
	}
	if (!startDate && endDate) {
		return { start: addDays(endDate, -1), end: endDate };
	}
	return { start: startDate!, end: endDate! };
}

export function getTaskBarBounds(
	task: GanttTask,
	config: TimelineConfig,
): { left: number; width: number } | null {
	const dates = getEffectiveBarDates(task);
	if (!dates) return null;

	const left = dateToPixelOffset(dates.start, config);
	const right = dateToPixelOffset(dates.end, config);
	// Reversed dates (start after end) still get a minimum-width bar, never negative.
	const width = Math.max(right - left, config.pixelsPerDay);

	return { left, width };
}
