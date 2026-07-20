import type { App } from 'obsidian';
import type { GanttTask, PluginSettings, TimelineConfig } from '../core/model.ts';
import { DEFAULT_PLUGIN_SETTINGS } from '../core/model.ts';
import { applyDragToDates, type DragMode, type DragDates } from '../core/drag.ts';
import { formatDate, getEffectiveBarDates } from '../core/timeline.ts';

/** Pixels from a bar edge that count as a resize handle. */
const EDGE_PX = 8;
/** Pointer travel (px) below which a drag is treated as a click. */
const CLICK_THRESHOLD_PX = 3;

const DRAG_FLAG = 'gbvDragJustEnded';

/**
 * True when a click event immediately follows a completed drag on `el`
 * (consumes the flag). Click handlers use this to skip opening the editor.
 */
export function consumePostDragClick(el: HTMLElement): boolean {
	if (el.dataset[DRAG_FLAG]) {
		delete el.dataset[DRAG_FLAG];
		return true;
	}
	return false;
}

function modeForPointer(el: HTMLElement, clientX: number, resizable: boolean): DragMode {
	if (!resizable) return 'move';
	// Offset relative to the bar itself — e.offsetX would be relative to
	// whichever child element (label, dot) the pointer happens to be over.
	const rect = el.getBoundingClientRect();
	const offsetX = clientX - rect.left;
	if (offsetX <= EDGE_PX) return 'resize-start';
	if (offsetX >= rect.width - EDGE_PX) return 'resize-end';
	return 'move';
}

function previewDates(task: GanttTask, mode: DragMode, dayDelta: number): { start: Date; end: Date } | null {
	const effective = getEffectiveBarDates(task);
	if (!effective) return null;
	const result = applyDragToDates(task, mode, dayDelta);
	if (!result) return effective;
	return {
		start: result.newStart ?? effective.start,
		end: result.newEnd ?? effective.end,
	};
}

/**
 * Makes a task bar (or milestone diamond) draggable: drag the body to move
 * the whole task, drag an edge to change its start or end date. Deltas snap
 * to whole days; on drop the new dates are written to frontmatter, and the
 * resulting Bases data update re-renders the view.
 */
export function makeBarDraggable(
	barEl: HTMLElement,
	task: GanttTask,
	config: TimelineConfig,
	app: App,
	pluginSettings: PluginSettings | undefined,
	opts: { resizable: boolean },
): void {
	let dragging = false;

	// Hover cursor: resize at the edges, grab elsewhere.
	barEl.addEventListener('pointermove', (e: PointerEvent) => {
		if (dragging) return;
		const mode = modeForPointer(barEl, e.clientX, opts.resizable);
		barEl.style.cursor = mode === 'move' ? 'grab' : 'ew-resize';
	});

	barEl.addEventListener('pointerdown', (e: PointerEvent) => {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();

		const mode = modeForPointer(barEl, e.clientX, opts.resizable);
		const startClientX = e.clientX;
		const origLeft = parseFloat(barEl.style.left) || 0;
		const origWidth = parseFloat(barEl.style.width) || barEl.offsetWidth;
		let dayDelta = 0;
		let moved = false;
		let tooltip: HTMLElement | null = null;

		dragging = true;
		barEl.setPointerCapture(e.pointerId);
		document.body.classList.add(mode === 'move' ? 'gbv-bar-dragging' : 'gbv-bar-resizing');

		const updateTooltip = (clientX: number, clientY: number) => {
			const dates = previewDates(task, mode, dayDelta);
			if (!dates) return;
			if (!tooltip) {
				tooltip = document.createElement('div');
				tooltip.className = 'gbv-drag-tooltip';
				document.body.appendChild(tooltip);
			}
			tooltip.textContent = `${formatDate(dates.start)} → ${formatDate(dates.end)}`;
			tooltip.style.left = `${clientX + 12}px`;
			tooltip.style.top = `${clientY - 32}px`;
		};

		const applyVisual = () => {
			const dx = dayDelta * config.pixelsPerDay;
			const minWidth = config.pixelsPerDay;
			switch (mode) {
				case 'move':
					barEl.style.left = `${origLeft + dx}px`;
					break;
				case 'resize-start': {
					const clamped = Math.min(dx, origWidth - minWidth);
					barEl.style.left = `${origLeft + clamped}px`;
					barEl.style.width = `${origWidth - clamped}px`;
					break;
				}
				case 'resize-end':
					barEl.style.width = `${Math.max(origWidth + dx, minWidth)}px`;
					break;
			}
		};

		const onMove = (ev: PointerEvent) => {
			const dx = ev.clientX - startClientX;
			if (Math.abs(dx) > CLICK_THRESHOLD_PX) moved = true;
			dayDelta = Math.round(dx / config.pixelsPerDay);
			applyVisual();
			updateTooltip(ev.clientX, ev.clientY);
		};

		const finish = async (commit: boolean) => {
			dragging = false;
			barEl.removeEventListener('pointermove', onMove);
			barEl.removeEventListener('pointerup', onUp);
			barEl.removeEventListener('pointercancel', onCancel);
			document.body.classList.remove('gbv-bar-dragging', 'gbv-bar-resizing');
			tooltip?.remove();

			if (!moved) return;
			barEl.dataset[DRAG_FLAG] = '1'; // suppress the click that follows pointerup

			const result = commit ? applyDragToDates(task, mode, dayDelta) : null;
			if (!result) {
				// Cancelled or snapped back to the original day — restore visuals.
				barEl.style.left = `${origLeft}px`;
				barEl.style.width = `${origWidth}px`;
				return;
			}
			await writeDragDates(app, task, result, pluginSettings);
			// The frontmatter change triggers a Bases data update, which re-renders.
		};

		const onUp = () => void finish(true);
		const onCancel = () => void finish(false);

		barEl.addEventListener('pointermove', onMove);
		barEl.addEventListener('pointerup', onUp);
		barEl.addEventListener('pointercancel', onCancel);
	});
}

async function writeDragDates(
	app: App,
	task: GanttTask,
	result: DragDates,
	pluginSettings: PluginSettings | undefined,
): Promise<void> {
	const startKey = pluginSettings?.startDateProp || DEFAULT_PLUGIN_SETTINGS.startDateProp;
	const endKey = pluginSettings?.endDateProp || DEFAULT_PLUGIN_SETTINGS.endDateProp;
	await app.fileManager.processFrontMatter(task.file, (fm: Record<string, unknown>) => {
		if (result.newStart) fm[startKey] = formatDate(result.newStart);
		if (result.newEnd) fm[endKey] = formatDate(result.newEnd);
	});
}
