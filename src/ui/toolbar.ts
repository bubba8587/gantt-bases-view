import type { ColorByField, ZoomLevel } from '../core/model.ts';

const ZOOM_LEVELS: ZoomLevel[] = ['day', 'week', 'month', '1year', '2year', '3year'];
const ZOOM_LABELS: Record<ZoomLevel, string> = {
	day: 'Day', week: 'Week', month: 'Month', '1year': '1Y', '2year': '2Y', '3year': '3Y',
};

const COLOR_BY_OPTIONS: ColorByField[] = ['none', 'status', 'priority'];
const COLOR_BY_LABELS: Record<ColorByField, string> = {
	none: 'No color', status: 'Status', priority: 'Priority',
};

export interface ToolbarOptions {
	currentZoom: ZoomLevel;
	colorBy: ColorByField;
	violationCount: number;
	onZoomChange: (zoom: ZoomLevel) => void;
	onColorByChange: (colorBy: ColorByField) => void;
	onToday: () => void;
	onFixSchedule: () => void;
	onExport: () => void | Promise<void>;
}

/** Renders the view toolbar: zoom, today, color-by, schedule check, TSV export. */
export function renderToolbar(toolbar: HTMLElement, opts: ToolbarOptions): void {
	// Zoom button group
	const zoomGroup = toolbar.createEl('div', { cls: 'gbv-zoom-group' });
	for (const zoom of ZOOM_LEVELS) {
		const btn = zoomGroup.createEl('button', {
			text: ZOOM_LABELS[zoom],
			cls: zoom === opts.currentZoom ? 'gbv-zoom-btn is-active' : 'gbv-zoom-btn',
		});
		btn.addEventListener('click', () => opts.onZoomChange(zoom));
	}

	toolbar.createEl('div', { cls: 'gbv-toolbar-separator' });

	const todayBtn = toolbar.createEl('button', { text: 'Today', cls: 'gbv-btn' });
	todayBtn.addEventListener('click', opts.onToday);

	toolbar.createEl('div', { cls: 'gbv-toolbar-separator' });

	toolbar.createEl('span', { text: 'Color:', cls: 'gbv-toolbar-label' });
	const colorBySelect = toolbar.createEl('select', { cls: 'gbv-toolbar-select' });
	for (const opt of COLOR_BY_OPTIONS) {
		const o = colorBySelect.createEl('option', { text: COLOR_BY_LABELS[opt] });
		o.value = opt;
		if (opt === opts.colorBy) o.selected = true;
	}
	colorBySelect.addEventListener('change', () => {
		opts.onColorByChange(colorBySelect.value as ColorByField);
	});

	toolbar.createEl('div', { cls: 'gbv-toolbar-separator' });

	const hasViolations = opts.violationCount > 0;
	const violationBtn = toolbar.createEl('button', {
		text: hasViolations ? `⚠ Fix Schedule (${opts.violationCount})` : '✓ Schedule OK',
		cls: hasViolations ? 'gbv-btn gbv-btn--warn' : 'gbv-btn gbv-btn--ok',
	});
	if (hasViolations) {
		violationBtn.addEventListener('click', opts.onFixSchedule);
	}

	toolbar.createEl('div', { cls: 'gbv-toolbar-separator' });

	const exportBtn = toolbar.createEl('button', { text: 'Copy TSV', cls: 'gbv-btn' });
	exportBtn.addEventListener('click', () => void opts.onExport());
}
