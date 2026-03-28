import { BasesView, BasesViewConfig, App, BasesEntryGroup } from 'obsidian';
import type { QueryController } from 'obsidian';
import type GanttBasesViewPlugin from './main.ts';
import type { GanttTask, TaskGroup, GanttViewSettings, TimelineConfig, ColumnHeader, ZoomLevel } from './types.ts';
import { ROW_HEIGHT, GROUP_HEADER_HEIGHT, BAR_HEIGHT, BAR_MARGIN_TOP, SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, MIN_TIMELINE_WIDTH, HEADER_HEIGHT, DEP_FIELDS, stripWikilink } from './types.ts';
import { readSettings, extractTask, resolveDependencyPaths } from './field-mapping.ts';
import { computeTimelineRange, generateColumns, getTaskBarBounds, dateToPixelOffset, totalTimelineWidth, columnsWidth } from './timeline.ts';
import { buildGanttScaffold, setTimelineWidth } from './renderer.ts';
import { createTaskBar, createSidebarLabel } from './task-bar.ts';
import { renderDependencies } from './dependencies.ts';
import { openPopupEditor } from './popup-editor.ts';
import { exportToTSV, copyToClipboard } from './export.ts';
import { detectViolations, openViolationPanel, closeViolationPanel } from './violations.ts';
import { closeActivePopup } from './popup-editor.ts';

import type { ColorByField } from './types.ts';

const ZOOM_LEVELS: ZoomLevel[] = ['day', 'week', 'month', '1year', '2year', '3year'];
const ZOOM_LABELS: Record<ZoomLevel, string> = { day: 'Day', week: 'Week', month: 'Month', '1year': '1Y', '2year': '2Y', '3year': '3Y' };
const COLOR_BY_OPTIONS: ColorByField[] = ['none', 'status', 'priority'];
const COLOR_BY_LABELS: Record<ColorByField, string> = { none: 'No color', status: 'Status', priority: 'Priority' };

export class GanttView extends BasesView {
	type = 'gantt';
	private scrollEl: HTMLElement;  // the framework-managed parent (scroll element)
	private rootEl: HTMLElement;    // our own child div — all rendering goes here
	private plugin: GanttBasesViewPlugin;
	private _localZoom: ZoomLevel | null = null;  // overrides config zoom when set
	private _localColorBy: ColorByField = 'none'; // toolbar-driven bar coloring
	private _sidebarWidth: number = SIDEBAR_WIDTH; // persists across re-renders for drag resize
	private _dragCleanup: (() => void) | null = null; // cancels any in-progress sidebar drag
	private _collapsedGroups: Set<string> = new Set(); // group keys the user has collapsed
	private _scrollLeft: number = 0; // preserved across re-renders
	private _scrollTop: number = 0;
	private _resizeObserver: ResizeObserver | null = null;
	private _lastRenderedWidth: number = 0;
	private _resizeTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(controller: QueryController, containerEl: HTMLElement, plugin: GanttBasesViewPlugin) {
		super(controller);
		this.scrollEl = containerEl;
		this.rootEl = containerEl.createDiv('gbv-root');
		this.plugin = plugin;

		this._resizeObserver = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			if (width > 0 && Math.abs(width - this._lastRenderedWidth) > 1) {
				if (this._resizeTimer) clearTimeout(this._resizeTimer);
				this._resizeTimer = setTimeout(() => this._render(), 100);
			}
		});
		this._resizeObserver.observe(containerEl);
	}

	onDataUpdated(): void {
		this._render();
	}

	onunload(): void {
		this._dragCleanup?.();
		this._resizeObserver?.disconnect();
		this._resizeObserver = null;
		if (this._resizeTimer) clearTimeout(this._resizeTimer);
		closeViolationPanel();
		closeActivePopup();
	}

	// ---------------------------------------------------------------------------
	// Core render
	// ---------------------------------------------------------------------------

	private _render(): void {
		const container = this.rootEl;
		this._lastRenderedWidth = this.scrollEl.clientWidth;

		// Guard: data may not be set yet if ResizeObserver fires before onDataUpdated
		if (!this.data) return;

		const config: BasesViewConfig = this.config;

		// Preserve scroll position across re-renders
		const prevScroll = container.querySelector('.gbv-scroll-area') as HTMLElement | null;
		if (prevScroll) {
			this._scrollLeft = prevScroll.scrollLeft;
			this._scrollTop = prevScroll.scrollTop;
		}

		container.empty();

		const settings: GanttViewSettings = readSettings(config, this.plugin.settings);
		if (this._localZoom) settings.zoom = this._localZoom;
		settings.colorBy = this._localColorBy;

		// Derive property-gated visibility from the user-configured Bases properties.
		// config.getOrder() reads the 'order:' array from the .base file and works
		// in both direct view and embed contexts. this.data.properties only reflects
		// interactive toolbar state and is empty in embed context.
		// The .base file order: array uses bare names ('priority'), which Bases
		// maps to 'note.priority' internally — check both forms for robustness.
		const rawProps: string[] = config.getOrder() ?? [];
		const visibleProps = new Set<string>(rawProps);
		if (visibleProps.size > 0) {
			settings.showPriority =
				visibleProps.has('note.priority') || visibleProps.has('priority');
			settings.visibleDepTypes = new Set(
				DEP_FIELDS
					.filter(f => visibleProps.has(f.prop) || visibleProps.has(f.bare))
					.map(f => f.type),
			);
		}

		// Use Bases-native groupedData so the Bases group button drives grouping.
		// When no group is configured, Bases returns one group with a null key.
		const groups: TaskGroup[] = this.data.groupedData.map((g: BasesEntryGroup) => ({
			key: g.hasKey() ? this._formatGroupKey(g.key!.toString()) : '',
			tasks: g.entries.map(entry => extractTask(entry, settings)),
		}));

		// Flatten all tasks for dependency resolution (needs the full task graph)
		const tasks: GanttTask[] = groups.flatMap(g => g.tasks);
		resolveDependencyPaths(tasks);
		const violations = detectViolations(tasks);
		const violatingTaskIds = new Set(violations.map(v => v.targetTask.id));
		let timelineConfig: TimelineConfig = computeTimelineRange(tasks, settings.zoom);

		const { toolbar, body, sidebar, resizeHandle, scrollArea, headerRow, barsArea, svgLayer } =
			buildGanttScaffold(container);

		// Restore dragged sidebar width and wire the resize handle
		sidebar.style.width = `${this._sidebarWidth}px`;
		this._wireSidebarResize(sidebar, resizeHandle);

		// Extend the timeline end date so the chart always fills the visible area.
		// Using containerEl width minus sidebar so we don't depend on scrollArea
		// layout (which hasn't happened yet at this point in JS execution).
		const availableWidth = Math.max(MIN_TIMELINE_WIDTH,
			(this.scrollEl.clientWidth || 0) - this._sidebarWidth - 2, // -2 for sidebar resize handle border
		);
		const contentWidth = totalTimelineWidth(timelineConfig);
		if (contentWidth < availableWidth) {
			const extraDays = Math.ceil(
				(availableWidth - contentWidth) / timelineConfig.pixelsPerDay,
			);
			timelineConfig = {
				...timelineConfig,
				endDate: new Date(
					timelineConfig.endDate.getTime() + extraDays * 86_400_000,
				),
			};
		}

		const columns = generateColumns(timelineConfig);
		const totalWidth = columnsWidth(columns);

		this._renderToolbar(toolbar, tasks, groups, scrollArea, timelineConfig, settings.zoom, violations);
		this._renderColumnHeaders(headerRow, columns);

		const { taskRowMap, totalHeightPx } = this._renderTaskRows(
			groups, sidebar, barsArea, timelineConfig, settings, violatingTaskIds, totalWidth,
		);

		// Size the SVG layer to exactly cover the barsArea so dependency arrows
		// are never clipped (avoids relying on overflow:visible alone).
		setTimelineWidth(scrollArea, barsArea, svgLayer, totalWidth, totalHeightPx);

		if (settings.showToday) {
			this._renderTodayLine(barsArea, timelineConfig);
		}

		if (settings.showDependencies) {
			renderDependencies(svgLayer, tasks, taskRowMap, timelineConfig, settings);
		}

		// Restore scroll position (use requestAnimationFrame so layout is settled).
		// Also detect embed context: if the container has no height after layout
		// (height:100% collapsed because parent has no defined height), set an
		// explicit pixel height on the container so the content is visible.
		requestAnimationFrame(() => {
			if (!container.clientHeight) {
				const toolbarH = toolbar.clientHeight || 40;
				const targetH = Math.min(totalHeightPx + HEADER_HEIGHT + toolbarH + 4, 520);
				container.style.height = `${Math.max(targetH, 200)}px`;
			}
			scrollArea.scrollLeft = this._scrollLeft;
			scrollArea.scrollTop = this._scrollTop;
		});

		this._wireScrollSync(sidebar, scrollArea);
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private _formatGroupKey(raw: string): string {
		return stripWikilink(raw) || 'Ungrouped';
	}

	private _renderToolbar(
		toolbar: HTMLElement,
		tasks: GanttTask[],
		groups: TaskGroup[],
		scrollArea: HTMLElement,
		timelineConfig: TimelineConfig,
		currentZoom: ZoomLevel,
		violations: import('./violations.ts').ScheduleViolation[],
	): void {
		// Zoom button group
		const zoomGroup = toolbar.createEl('div', { cls: 'gbv-zoom-group' });
		for (const zoom of ZOOM_LEVELS) {
			const btn = zoomGroup.createEl('button', {
				text: ZOOM_LABELS[zoom],
				cls: zoom === currentZoom ? 'gbv-zoom-btn is-active' : 'gbv-zoom-btn',
			});
			btn.addEventListener('click', () => {
				if (this._localZoom !== zoom) {
					this._scrollLeft = 0;
					this._scrollTop = 0;
				}
				this._localZoom = zoom;
				this._render();
			});
		}

		toolbar.createEl('div', { cls: 'gbv-toolbar-separator' });

		// Today button
		const todayBtn = toolbar.createEl('button', { text: 'Today', cls: 'gbv-btn' });
		todayBtn.addEventListener('click', () => {
			const offset = dateToPixelOffset(new Date(), timelineConfig);
			scrollArea.scrollLeft = Math.max(0, offset - scrollArea.clientWidth / 2);
		});

		toolbar.createEl('div', { cls: 'gbv-toolbar-separator' });

		// Color by dropdown
		const colorByLabel = toolbar.createEl('span', { text: 'Color:', cls: 'gbv-toolbar-label' });
		const colorBySelect = toolbar.createEl('select', { cls: 'gbv-toolbar-select' });
		for (const opt of COLOR_BY_OPTIONS) {
			const o = colorBySelect.createEl('option', { text: COLOR_BY_LABELS[opt] });
			o.value = opt;
			if (opt === this._localColorBy) o.selected = true;
		}
		colorBySelect.addEventListener('change', () => {
			this._localColorBy = colorBySelect.value as ColorByField;
			this._render();
		});

		toolbar.createEl('div', { cls: 'gbv-toolbar-separator' });

		// Violation check button
		const violationBtn = toolbar.createEl('button', {
			text: violations.length > 0 ? `⚠ Fix Schedule (${violations.length})` : '✓ Schedule OK',
			cls: violations.length > 0 ? 'gbv-btn gbv-btn--warn' : 'gbv-btn gbv-btn--ok',
		});
		if (violations.length > 0) {
			violationBtn.addEventListener('click', () => {
				openViolationPanel(violations, this.app, () => this._render(), this.plugin.settings);
			});
		}

		toolbar.createEl('div', { cls: 'gbv-toolbar-separator' });

		// Export button
		const exportBtn = toolbar.createEl('button', { text: 'Copy TSV', cls: 'gbv-btn' });
		exportBtn.addEventListener('click', async () => {
			const tsv = exportToTSV(groups, timelineConfig);
			await copyToClipboard(tsv);
		});
	}

	private _renderColumnHeaders(headerRow: HTMLElement, columns: ColumnHeader[]): void {
		const topRow = headerRow.createEl('div', { cls: 'gbv-header-top-row' });
		const botRow = headerRow.createEl('div', { cls: 'gbv-header-bot-row' });

		let currentGroup = '';
		let groupCell: HTMLElement | null = null;
		let groupWidth = 0;

		for (const col of columns) {
			const pipeIdx = col.label.indexOf('|');
			const group = pipeIdx >= 0 ? col.label.slice(0, pipeIdx) : '';
			const label = pipeIdx >= 0 ? col.label.slice(pipeIdx + 1) : col.label;

			// Group band (top row) — emit a new cell whenever the group changes
			if (group !== currentGroup) {
				if (groupCell) {
					groupCell.style.width = `${groupWidth}px`;
					groupCell.style.minWidth = `${groupWidth}px`;
				}
				groupCell = topRow.createEl('div', { text: group, cls: 'gbv-header-cell gbv-header-month' });
				currentGroup = group;
				groupWidth = 0;
			}
			groupWidth += col.widthPx;

			// Column label (bottom row)
			const cell = botRow.createEl('div', { text: label, cls: 'gbv-header-cell gbv-header-day' });
			cell.style.width = `${col.widthPx}px`;
			cell.style.minWidth = `${col.widthPx}px`;
			cell.style.flexShrink = '0';
		}

		// Finalize the last group cell
		if (groupCell) {
			groupCell.style.width = `${groupWidth}px`;
			groupCell.style.minWidth = `${groupWidth}px`;
		}
	}

	private _renderTaskRows(
		groups: TaskGroup[],
		sidebar: HTMLElement,
		barsArea: HTMLElement,
		timelineConfig: TimelineConfig,
		settings: GanttViewSettings,
		violatingTaskIds: Set<string>,
		totalWidth: number,
	): { taskRowMap: Map<string, number>; totalHeightPx: number } {
		const taskRowMap = new Map<string, number>();
		let currentY = 0;
		let rowIndex = 0; // for alternating row shading

		// Inner div is the translateY target; outer .gbv-sidebar-labels clips it.
		const sidebarInner = sidebar.querySelector('.gbv-sidebar-labels-inner') as HTMLElement ?? sidebar;

		for (const group of groups) {
			const isCollapsed = group.key ? this._collapsedGroups.has(group.key) : false;

			if (group.key) {
				const toggle = () => {
					if (this._collapsedGroups.has(group.key)) {
						this._collapsedGroups.delete(group.key);
					} else {
						this._collapsedGroups.add(group.key);
					}
					this._render();
				};

				// Sidebar group header — caret + label, clickable
				const sidebarHdr = document.createElement('div');
				sidebarHdr.className = 'gbv-group-header';
				sidebarHdr.style.height = `${GROUP_HEADER_HEIGHT}px`;
				sidebarHdr.style.cursor = 'pointer';
				const caret = document.createElement('span');
				caret.className = 'gbv-group-caret';
				caret.textContent = isCollapsed ? '▶' : '▼';
				sidebarHdr.appendChild(caret);
				sidebarHdr.appendChild(document.createTextNode(group.key));
				sidebarHdr.addEventListener('click', toggle);
				sidebarInner.appendChild(sidebarHdr);

				// Bars group header — no label (label lives in sidebar only);
				// holds the summary bar when collapsed, otherwise just a divider row.
				const barsHdr = barsArea.createEl('div', { cls: 'gbv-group-header' });
				barsHdr.style.width = `${totalWidth}px`;
				barsHdr.style.height = `${GROUP_HEADER_HEIGHT}px`;
				barsHdr.style.cursor = 'pointer';
				barsHdr.style.position = 'relative';
				barsHdr.addEventListener('click', toggle);

				if (isCollapsed) {
					const sb = this._getGroupSummaryBounds(group.tasks, timelineConfig);
					if (sb) {
						const summaryBar = document.createElement('div');
						summaryBar.className = 'gbv-summary-bar';
						summaryBar.style.left = `${sb.left}px`;
						summaryBar.style.width = `${sb.width}px`;
						summaryBar.style.top = `${Math.round((GROUP_HEADER_HEIGHT - BAR_HEIGHT) / 2)}px`;
						summaryBar.style.height = `${BAR_HEIGHT}px`;
						barsHdr.appendChild(summaryBar);
					}
				}

				currentY += GROUP_HEADER_HEIGHT;
			}

			if (isCollapsed) continue;

			for (const task of group.tasks) {
				// Store row TOP (not center) — dependencies.ts uses this to
				// compute exact bar-corner Y coordinates for arrow anchors.
				taskRowMap.set(task.id, currentY);
				const isAlt = rowIndex % 2 === 1;
				const hasViolation = violatingTaskIds.has(task.id);

				const labelEl = createSidebarLabel(task, hasViolation);
				if (isAlt) labelEl.classList.add('gbv-sidebar-label--alt');
				labelEl.style.cursor = 'pointer';
				labelEl.addEventListener('click', () => {
					openPopupEditor(task, labelEl, this.app, () => this._render(), this.plugin.settings);
				});
				sidebarInner.appendChild(labelEl);

				const barRowEl = barsArea.createEl('div', { cls: 'gbv-bar-row' });
				if (isAlt) barRowEl.classList.add('gbv-bar-row--alt');
				barRowEl.style.width = `${totalWidth}px`;
				rowIndex++;

				const bounds = getTaskBarBounds(task, timelineConfig);
				if (bounds) {
					const barEl = createTaskBar(task, bounds, settings.colorBy, settings.showPriority, this.plugin.settings);
					barRowEl.appendChild(barEl);
					barEl.addEventListener('click', (e) => {
						e.stopPropagation();
						openPopupEditor(task, barEl, this.app, () => this._render(), this.plugin.settings);
					});
				}

				currentY += ROW_HEIGHT;
			}
		}

		return { taskRowMap, totalHeightPx: currentY };
	}

	private _getGroupSummaryBounds(
		tasks: GanttTask[],
		timelineConfig: TimelineConfig,
	): { left: number; width: number } | null {
		let minDate: Date | null = null;
		let maxDate: Date | null = null;

		for (const task of tasks) {
			const start = task.startDate ?? task.endDate;
			const end = task.endDate ?? task.startDate;
			if (start && (!minDate || start < minDate)) minDate = start;
			if (end && (!maxDate || end > maxDate)) maxDate = end;
		}

		if (!minDate) return null;
		if (!maxDate) maxDate = minDate;

		const left = dateToPixelOffset(minDate, timelineConfig);
		const right = dateToPixelOffset(maxDate, timelineConfig);
		return { left, width: Math.max(right - left, timelineConfig.pixelsPerDay) };
	}

	private _renderTodayLine(barsArea: HTMLElement, timelineConfig: TimelineConfig): void {
		const offset = dateToPixelOffset(new Date(), timelineConfig);
		if (offset < 0) return;

		const line = barsArea.createEl('div', { cls: 'gbv-today-line' });
		line.style.left = `${offset}px`;
	}

	private _wireSidebarResize(sidebar: HTMLElement, handle: HTMLElement): void {
		let startX = 0;
		let startWidth = 0;

		handle.addEventListener('mousedown', (e: MouseEvent) => {
			e.preventDefault();
			startX = e.clientX;
			startWidth = sidebar.offsetWidth;
			handle.classList.add('is-dragging');
			document.body.classList.add('gbv-resizing');

			const onMove = (e: MouseEvent) => {
				const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + e.clientX - startX));
				sidebar.style.width = `${newWidth}px`;
				this._sidebarWidth = newWidth;
			};

			const cleanup = () => {
				handle.classList.remove('is-dragging');
				document.body.classList.remove('gbv-resizing');
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', cleanup);
				this._dragCleanup = null;
			};

			this._dragCleanup = cleanup;
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', cleanup);
		});
	}

	private _wireScrollSync(
		sidebar: HTMLElement,
		scrollArea: HTMLElement,
	): void {
		const sidebarLabelsInner = sidebar.querySelector('.gbv-sidebar-labels-inner') as HTMLElement ?? sidebar;

		// Translate sidebar labels vertically to match the scroll area — single
		// source of truth, no separate scroll container on the sidebar.
		// The outer .gbv-sidebar-labels has overflow:hidden and acts as the clip boundary.
		scrollArea.addEventListener('scroll', () => {
			sidebarLabelsInner.style.transform = `translateY(-${scrollArea.scrollTop}px)`;
		});

		// Forward wheel events on the sidebar to the scroll area so hovering
		// the sidebar scrolls identically to hovering the bars area.
		sidebar.addEventListener('wheel', (e: WheelEvent) => {
			e.preventDefault();
			scrollArea.scrollBy({ left: e.deltaX, top: e.deltaY });
		}, { passive: false });
	}
}
