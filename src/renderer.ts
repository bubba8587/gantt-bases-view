import { HEADER_HEIGHT } from './types.ts';

export function buildGanttScaffold(container: HTMLElement): {
  toolbar: HTMLElement;
  body: HTMLElement;
  sidebar: HTMLElement;
  resizeHandle: HTMLElement;
  scrollArea: HTMLElement;
  headerRow: HTMLElement;
  barsArea: HTMLElement;
  svgLayer: SVGSVGElement;
} {
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

  const svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  svgLayer.classList.add('gbv-svg-layer');
  barsArea.appendChild(svgLayer);

  return { toolbar, body, sidebar, resizeHandle, scrollArea, headerRow, barsArea, svgLayer };
}

export function setTimelineWidth(
  scrollArea: HTMLElement,
  barsArea: HTMLElement,
  svgLayer: SVGSVGElement,
  width: number,
  totalHeight: number,
): void {
  barsArea.style.minWidth = `${width}px`;

  const headerRow = scrollArea.querySelector('.gbv-header-row') as HTMLElement | null;
  if (headerRow) {
    headerRow.style.minWidth = `${width}px`;
  }

  svgLayer.setAttribute('width', String(width));
  svgLayer.setAttribute('height', String(totalHeight));
  svgLayer.style.width = `${width}px`;
  svgLayer.style.height = `${totalHeight}px`;
}
