import { BasesView, BasesViewConfig, BasesEntryGroup } from 'obsidian';
import type { QueryController } from 'obsidian';
import type GanttBasesViewPlugin from '../main.ts';
import type {
	ColorByField,
	ColumnHeader,
	GanttTask,
	GanttViewSettings,
	TaskGroup,
	TimelineConfig,
	ZoomLevel,
} from '../core/model.ts';
import {
	BAR_HEIGHT,
	DEP_FIELDS,
	GROUP_HEADER_HEIGHT,
	HEADER_HEIGHT,
	MIN_SIDEBAR_WIDTH,
	MAX_SIDEBAR_WIDTH,
	MIN_TIMELINE_WIDTH,
	ROW_HEIGHT,
	SIDEBAR_WIDTH,
	groupDisplayLabel,
	stripWikilink,
} from '../core/model.ts';
import { readSettings, extractTask, resolveDependencyPaths } from '../core/extract.ts';
import {
	addDays,
	columnsWidth,
	computeTimelineRange,
	dateToPixelOffset,
	fitZoomToViewport,
	generateColumns,
	getTaskBarBounds,
	totalTimelineWidth,
} from '../core/timeline.ts';
import { detectViolations, findDependencyCycles } from '../core/schedule.ts';
import { packLanes } from '../core/lanes.ts';
import { exportToTSV } from '../core/export.ts';
import { buildGanttScaffold, setTimelineSize } from './scaffold.ts';
import { renderToolbar } from './toolbar.ts';
import { createTaskBar, createSidebarLabel } from './task-bar.ts';
import { renderDependencies, wireDependencyHover } from './dependency-arrows.ts';
import { makeBarDraggable, consumePostDragClick } from './bar-drag.ts';
import { openPopupEditor, closeActivePopup } from './popup-editor.ts';
import { openViolationPanel, closeViolationPanel } from './violation-panel.ts';

export class GanttView extends BasesView {
	type = 'gantt';
	private scrollEl: HTMLElement;  // the framework-managed parent (scroll element)
	private rootEl: HTMLElement;    // our own child div — all rendering goes here
	private plugin: GanttBasesViewPlugin;
	private localZoom: ZoomLevel | null = null;   // overrides config zoom when set
	private localColorBy: ColorByField = 'none';  // toolbar-driven bar coloring
	private compactRows = false;                  // pack non-overlapping tasks onto shared rows
	private sidebarWidth: number = SIDEBAR_WIDTH; // persists across re-renders for drag resize
	private dragCleanup: (() => void) | null = null; // cancels any in-progress sidebar drag
	private collapsedGroups: Set<string> = new Set(); // group keys the user has collapsed
	private scrollLeft = 0; // preserved across re-renders
	private scrollTop = 0;
	private resizeObserver: ResizeObserver | null = null;
	private lastRenderedWidth = 0;
	private resizeTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(controller: QueryController, containerEl: HTMLElement, plugin: GanttBasesViewPlugin) {
		super(controller);
		this.scrollEl = containerEl;
		this.rootEl = containerEl.createDiv('gbv-root');
		this.plugin = plugin;

		this.resizeObserver = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			if (width > 0 && Math.abs(width - this.lastRenderedWidth) > 1) {
				if (this.resizeTimer) clearTimeout(this.resizeTimer);
				this.resizeTimer = setTimeout(() => this.render(), 100);
			}
		});
		this.resizeObserver.observe(containerEl);
	}

	onDataUpdated(): void {
		this.render();
	}

	onunload(): void {
		this.dragCleanup?.();
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.resizeTimer) clearTimeout(this.resizeTimer);
		closeViolationPanel();
		closeActivePopup();
	}

	// ─── Core render ───────────────────────────────────────────────────────────

	private render(): void {
		const container = this.rootEl;
		this.lastRenderedWidth = this.scrollEl.clientWidth;

		// Guard: data may not be set yet if ResizeObserver fires before onDataUpdated
		if (!this.data) return;

		const config: BasesViewConfig = this.config;

		// Preserve scroll position across re-renders
		const prevScroll = container.querySelector('.gbv-scroll-area') as HTMLElement | null;
		if (prevScroll) {
			this.scrollLeft = prevScroll.scrollLeft;
			this.scrollTop = prevScroll.scrollTop;
		}

		container.empty();

		const settings: GanttViewSettings = readSettings(config, this.plugin.settings);
		if (this.localZoom) settings.zoom = this.localZoom;
		settings.colorBy = this.localColorBy;

		this.applyPropertyVisibility(config, settings);

		// Use Bases-native groupedData so the Bases group button drives grouping.
		// When no group is configured, Bases returns one group with a null key.
		const groups: TaskGroup[] = this.data.groupedData.map((g: BasesEntryGroup) => {
			const raw = g.hasKey() ? g.key!.toString() : '';
			// key = full identity (collapse state, exports); label = short display.
			const key = raw ? (stripWikilink(raw) || 'Ungrouped') : '';
			return {
				key,
				label: key ? groupDisplayLabel(raw) : '',
				tasks: g.entries.map(entry => extractTask(entry, settings)),
			};
		});

		// Flatten all tasks for dependency resolution (needs the full task graph)
		const tasks: GanttTask[] = groups.flatMap(g => g.tasks);
		resolveDependencyPaths(tasks);
		const violations = detectViolations(tasks);
		const cycles = findDependencyCycles(tasks);
		const violatingTaskIds = new Set([
			...violations.map(v => v.successor.id),
			...cycles.flat().map(t => t.id),
		]);

		let timelineConfig = computeTimelineRange(tasks, settings.zoom);
		timelineConfig = fitZoomToViewport(timelineConfig, this.availableTimelineWidth());
		timelineConfig = this.extendToFillViewport(timelineConfig);

		const columns = generateColumns(timelineConfig);
		const totalWidth = columnsWidth(columns);

		const scaffold = buildGanttScaffold(container);
		const { toolbar, sidebar, resizeHandle, scrollArea, headerRow, barsArea, svgLayer } = scaffold;

		// Restore dragged sidebar width and wire the resize handle
		sidebar.style.width = `${this.sidebarWidth}px`;
		this.wireSidebarResize(sidebar, resizeHandle);

		renderToolbar(toolbar, {
			currentZoom: settings.zoom,
			colorBy: this.localColorBy,
			compact: this.compactRows,
			violationCount: violations.length + cycles.length,
			onZoomChange: (zoom) => {
				if (this.localZoom !== zoom) {
					this.scrollLeft = 0;
					this.scrollTop = 0;
				}
				this.localZoom = zoom;
				this.render();
			},
			onColorByChange: (colorBy) => {
				this.localColorBy = colorBy;
				this.render();
			},
			onToggleCompact: () => {
				this.compactRows = !this.compactRows;
				this.render();
			},
			onToday: () => {
				const offset = dateToPixelOffset(new Date(), timelineConfig);
				scrollArea.scrollLeft = Math.max(0, offset - scrollArea.clientWidth / 2);
			},
			onFixSchedule: () => {
				openViolationPanel(violations, cycles, tasks, this.app, () => this.render(), this.plugin.settings);
			},
			onExport: async () => {
				await navigator.clipboard.writeText(exportToTSV(groups, timelineConfig));
			},
		});

		this.renderColumnHeaders(headerRow, columns, settings.zoom);
		this.applyWeekendShading(barsArea, timelineConfig);

		const { taskRowMap, totalHeightPx } = this.renderTaskRows(
			groups, sidebar, barsArea, timelineConfig, settings, violatingTaskIds, totalWidth,
		);

		setTimelineSize(scaffold, totalWidth, totalHeightPx);

		if (settings.showToday) {
			this.renderTodayLine(barsArea, timelineConfig);
		}

		if (settings.showDependencies) {
			renderDependencies(svgLayer, tasks, taskRowMap, timelineConfig, settings);
			wireDependencyHover(barsArea, svgLayer);
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
			scrollArea.scrollLeft = this.scrollLeft;
			scrollArea.scrollTop = this.scrollTop;
		});

		this.wireScrollSync(sidebar, scrollArea);
	}

	// ─── Private helpers ───────────────────────────────────────────────────────

	/**
	 * Derives property-gated visibility from the user-configured Bases properties.
	 * config.getOrder() reads the 'order:' array from the .base file and works
	 * in both direct view and embed contexts. this.data.properties only reflects
	 * interactive toolbar state and is empty in embed context.
	 * The .base file order: array uses bare names ('priority'), which Bases
	 * maps to 'note.priority' internally — check both forms for robustness.
	 */
	private applyPropertyVisibility(config: BasesViewConfig, settings: GanttViewSettings): void {
		const rawProps: string[] = config.getOrder() ?? [];
		const visibleProps = new Set<string>(rawProps);
		if (visibleProps.size === 0) return;

		settings.showPriority =
			visibleProps.has('note.priority') || visibleProps.has('priority');
		settings.visibleDepTypes = new Set(
			DEP_FIELDS
				.filter(f => visibleProps.has(f.prop) || visibleProps.has(f.bare))
				.map(f => f.type),
		);
	}

	/**
	 * Width available for the timeline: container minus sidebar and its resize
	 * handle border. Uses containerEl so we don't depend on scrollArea layout
	 * (which hasn't happened yet at this point in JS execution).
	 */
	private availableTimelineWidth(): number {
		return Math.max(MIN_TIMELINE_WIDTH,
			(this.scrollEl.clientWidth || 0) - this.sidebarWidth - 2,
		);
	}

	/** Extends the timeline end date so the chart always fills the visible area. */
	private extendToFillViewport(timelineConfig: TimelineConfig): TimelineConfig {
		const availableWidth = this.availableTimelineWidth();
		const contentWidth = totalTimelineWidth(timelineConfig);
		if (contentWidth >= availableWidth) return timelineConfig;

		const extraDays = Math.ceil(
			(availableWidth - contentWidth) / timelineConfig.pixelsPerDay,
		);
		return {
			...timelineConfig,
			endDate: addDays(timelineConfig.endDate, extraDays),
		};
	}

	/**
	 * Shades Saturday+Sunday bands at day and week zoom. One repeating
	 * gradient (7-day period, phase-shifted to the first Saturday) instead of
	 * per-day elements; the custom properties inherit into every bar row.
	 */
	private applyWeekendShading(barsArea: HTMLElement, config: TimelineConfig): void {
		if (config.zoom !== 'day' && config.zoom !== 'week') return;
		const ppd = config.pixelsPerDay;
		const daysToSaturday = (6 - config.startDate.getDay() + 7) % 7;
		barsArea.classList.add('gbv-weekend-shading');
		barsArea.style.setProperty('--gbv-weekend-offset', `${daysToSaturday * ppd}px`);
		barsArea.style.setProperty('--gbv-weekend-width', `${2 * ppd}px`);
		barsArea.style.setProperty('--gbv-weekend-period', `${7 * ppd}px`);
	}

	private renderColumnHeaders(headerRow: HTMLElement, columns: ColumnHeader[], zoom: ZoomLevel): void {
		const topRow = headerRow.createEl('div', { cls: 'gbv-header-top-row' });
		const botRow = headerRow.createEl('div', { cls: 'gbv-header-bot-row' });

		let currentGroup: string | null = null;
		let groupCell: HTMLElement | null = null;
		let groupWidth = 0;

		const finalizeGroupCell = () => {
			if (groupCell) {
				groupCell.style.width = `${groupWidth}px`;
				groupCell.style.minWidth = `${groupWidth}px`;
			}
		};

		for (const col of columns) {
			// Group band (top row) — emit a new cell whenever the group changes
			if (col.group !== currentGroup) {
				finalizeGroupCell();
				groupCell = topRow.createEl('div', { text: col.group, cls: 'gbv-header-cell gbv-header-month' });
				currentGroup = col.group;
				groupWidth = 0;
			}
			groupWidth += col.widthPx;

			// Column label (bottom row)
			const cell = botRow.createEl('div', { text: col.label, cls: 'gbv-header-cell gbv-header-day' });
			const dow = col.startDate.getDay();
			if (zoom === 'day' && (dow === 0 || dow === 6)) cell.classList.add('is-weekend');
			cell.style.width = `${col.widthPx}px`;
			cell.style.minWidth = `${col.widthPx}px`;
			cell.style.flexShrink = '0';
		}

		finalizeGroupCell();
	}

	private renderTaskRows(
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
			const isCollapsed = group.key ? this.collapsedGroups.has(group.key) : false;

			if (group.key) {
				this.renderGroupHeader(group, isCollapsed, sidebarInner, barsArea, timelineConfig, totalWidth);
				currentY += GROUP_HEADER_HEIGHT;
			}

			if (isCollapsed) continue;

			if (this.compactRows) {
				const lanes = this.renderCompactLanes(
					group, sidebarInner, barsArea, timelineConfig, settings, taskRowMap, currentY, rowIndex, totalWidth,
				);
				currentY += lanes * ROW_HEIGHT;
				rowIndex += lanes;
				continue;
			}

			for (const task of group.tasks) {
				// Store row TOP (not center) — dependency-arrows.ts uses this to
				// compute exact bar-corner Y coordinates for arrow anchors.
				taskRowMap.set(task.id, currentY);
				const isAlt = rowIndex % 2 === 1;
				const hasViolation = violatingTaskIds.has(task.id);

				const labelEl = createSidebarLabel(task, hasViolation);
				if (isAlt) labelEl.classList.add('gbv-sidebar-label--alt');
				labelEl.style.cursor = 'pointer';
				labelEl.addEventListener('click', () => {
					openPopupEditor(task, labelEl, this.app, () => this.render(), this.plugin.settings);
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
					this.attachBarInteractions(barEl, task, timelineConfig);
				}

				currentY += ROW_HEIGHT;
			}
		}

		return { taskRowMap, totalHeightPx: currentY };
	}

	/**
	 * Compact mode: tasks that don't overlap in time share a row. The sidebar
	 * shows one summary cell per group (bars carry their own labels); task
	 * rows in the arrow map point at each task's lane so dependency arrows
	 * keep working unchanged. Returns the number of lanes rendered.
	 */
	private renderCompactLanes(
		group: TaskGroup,
		sidebarInner: HTMLElement,
		barsArea: HTMLElement,
		timelineConfig: TimelineConfig,
		settings: GanttViewSettings,
		taskRowMap: Map<string, number>,
		startY: number,
		startRowIndex: number,
		totalWidth: number,
	): number {
		const { laneOf, laneCount } = packLanes(group.tasks, timelineConfig);

		const rowEls: HTMLElement[] = [];
		for (let lane = 0; lane < laneCount; lane++) {
			const rowEl = barsArea.createEl('div', { cls: 'gbv-bar-row' });
			if ((startRowIndex + lane) % 2 === 1) rowEl.classList.add('gbv-bar-row--alt');
			rowEl.style.width = `${totalWidth}px`;
			rowEls.push(rowEl);
		}

		// One sidebar cell spanning all lanes — individual labels live on the bars.
		const cell = document.createElement('div');
		cell.className = 'gbv-sidebar-compact';
		cell.style.height = `${laneCount * ROW_HEIGHT}px`;
		const placed = group.tasks.filter(t => laneOf.has(t.id)).length;
		cell.textContent = `${placed} task${placed === 1 ? '' : 's'}`;
		if (placed < group.tasks.length) {
			cell.textContent += ` (+${group.tasks.length - placed} undated)`;
		}
		sidebarInner.appendChild(cell);

		for (const task of group.tasks) {
			const lane = laneOf.get(task.id);
			if (lane === undefined) continue; // dateless — nothing to draw in compact mode
			taskRowMap.set(task.id, startY + lane * ROW_HEIGHT);

			const bounds = getTaskBarBounds(task, timelineConfig);
			if (!bounds) continue;
			const barEl = createTaskBar(task, bounds, settings.colorBy, settings.showPriority, this.plugin.settings);
			rowEls[lane].appendChild(barEl);
			this.attachBarInteractions(barEl, task, timelineConfig);
		}

		return laneCount;
	}

	private attachBarInteractions(barEl: HTMLElement, task: GanttTask, timelineConfig: TimelineConfig): void {
		makeBarDraggable(barEl, task, timelineConfig, this.app, this.plugin.settings, {
			resizable: !task.isMilestone,
		});
		barEl.addEventListener('click', (e) => {
			e.stopPropagation();
			if (consumePostDragClick(barEl)) return;
			openPopupEditor(task, barEl, this.app, () => this.render(), this.plugin.settings);
		});
	}

	private renderGroupHeader(
		group: TaskGroup,
		isCollapsed: boolean,
		sidebarInner: HTMLElement,
		barsArea: HTMLElement,
		timelineConfig: TimelineConfig,
		totalWidth: number,
	): void {
		const toggle = () => {
			if (this.collapsedGroups.has(group.key)) {
				this.collapsedGroups.delete(group.key);
			} else {
				this.collapsedGroups.add(group.key);
			}
			this.render();
		};

		// Sidebar group header — caret + label, clickable. Shows the short
		// label (folder name); the full path lives in the tooltip.
		const sidebarHdr = document.createElement('div');
		sidebarHdr.className = 'gbv-group-header';
		sidebarHdr.style.height = `${GROUP_HEADER_HEIGHT}px`;
		sidebarHdr.style.cursor = 'pointer';
		const caret = document.createElement('span');
		caret.className = 'gbv-group-caret';
		caret.textContent = isCollapsed ? '▶' : '▼';
		sidebarHdr.appendChild(caret);
		const displayLabel = group.label || group.key;
		sidebarHdr.appendChild(document.createTextNode(displayLabel));
		if (displayLabel !== group.key) sidebarHdr.title = group.key;
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
			const sb = this.getGroupSummaryBounds(group.tasks, timelineConfig);
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
	}

	private getGroupSummaryBounds(
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
		// End dates are inclusive — cover the last day like the task bars do.
		const right = dateToPixelOffset(addDays(maxDate, 1), timelineConfig);
		return { left, width: Math.max(right - left, timelineConfig.pixelsPerDay) };
	}

	private renderTodayLine(barsArea: HTMLElement, timelineConfig: TimelineConfig): void {
		const offset = dateToPixelOffset(new Date(), timelineConfig);
		if (offset < 0) return;

		const line = barsArea.createEl('div', { cls: 'gbv-today-line' });
		line.style.left = `${offset}px`;
	}

	private wireSidebarResize(sidebar: HTMLElement, handle: HTMLElement): void {
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
				this.sidebarWidth = newWidth;
			};

			const cleanup = () => {
				handle.classList.remove('is-dragging');
				document.body.classList.remove('gbv-resizing');
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', cleanup);
				this.dragCleanup = null;
			};

			this.dragCleanup = cleanup;
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', cleanup);
		});
	}

	private wireScrollSync(sidebar: HTMLElement, scrollArea: HTMLElement): void {
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
