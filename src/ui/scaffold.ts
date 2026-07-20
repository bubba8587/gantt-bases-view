import { HEADER_HEIGHT } from '../core/model.ts';

export interface GanttScaffold {
	toolbar: HTMLElement;
	body: HTMLElement;
	sidebar: HTMLElement;
	resizeHandle: HTMLElement;
	scrollArea: HTMLElement;
	headerRow: HTMLElement;
	barsArea: HTMLElement;
	svgLayer: SVGSVGElement;
}

/** Builds the static DOM skeleton of the Gantt view inside `container`. */
export function buildGanttScaffold(container: HTMLElement): GanttScaffold {
	const toolbar = container.createDiv({ cls: 'gbv-toolbar' });
	const body = container.createDiv({ cls: 'gbv-body' });
	const sidebar = body.createDiv({ cls: 'gbv-sidebar' });

	const sidebarHeader = sidebar.createDiv({ cls: 'gbv-sidebar-header' });
	sidebarHeader.style.height = `${HEADER_HEIGHT}px`;

	sidebar.createDiv({ cls: 'gbv-sidebar-labels' })
		.createDiv({ cls: 'gbv-sidebar-labels-inner' });

	const resizeHandle = body.createDiv({ cls: 'gbv-sidebar-resize' });
	const scrollArea = body.createDiv({ cls: 'gbv-scroll-area' });

	const headerRow = scrollArea.createDiv({ cls: 'gbv-header-row' });
	headerRow.style.height = `${HEADER_HEIGHT}px`;

	const barsArea = scrollArea.createDiv({ cls: 'gbv-bars-area' });

	const svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svgLayer.classList.add('gbv-svg-layer');
	barsArea.appendChild(svgLayer);

	return { toolbar, body, sidebar, resizeHandle, scrollArea, headerRow, barsArea, svgLayer };
}

/** Sizes the scrollable timeline surfaces (header, bars, SVG arrow layer). */
export function setTimelineSize(
	scaffold: GanttScaffold,
	width: number,
	totalHeight: number,
): void {
	scaffold.barsArea.style.minWidth = `${width}px`;
	scaffold.headerRow.style.minWidth = `${width}px`;

	// Size the SVG layer to exactly cover the bars area so dependency arrows
	// are never clipped (avoids relying on overflow:visible alone).
	scaffold.svgLayer.setAttribute('width', String(width));
	scaffold.svgLayer.setAttribute('height', String(totalHeight));
	scaffold.svgLayer.style.width = `${width}px`;
	scaffold.svgLayer.style.height = `${totalHeight}px`;
}
