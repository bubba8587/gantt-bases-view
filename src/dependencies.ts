import type { GanttTask, TaskDependency, TimelineConfig, GanttViewSettings } from './types.ts';
import { BAR_MARGIN_TOP, BAR_HEIGHT } from './types.ts';
import { getTaskBarBounds } from './timeline.ts';

const M_NORM = 'gbv-m-nr';
const M_VIOL = 'gbv-m-vr';

const COLOR_NORMAL   = 'var(--text-muted)';
const COLOR_VIOLATED = 'var(--color-orange, #e8a427)';

// Gap (px) the path extends past the bar edge before turning the corner.
const ELBOW_GAP = 12;

function makeMarker(id: string, color: string): SVGMarkerElement {
	const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
	m.setAttribute('id', id);
	m.setAttribute('markerWidth', '7');
	m.setAttribute('markerHeight', '7');
	m.setAttribute('refX', '6');
	m.setAttribute('refY', '3.5');
	m.setAttribute('orient', 'auto');
	m.setAttribute('markerUnits', 'userSpaceOnUse');
	const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
	poly.setAttribute('points', '0,0 7,3.5 0,7');
	poly.setAttribute('fill', color);
	m.appendChild(poly);
	return m;
}

function ensureDefs(svg: SVGSVGElement): void {
	let defs = svg.querySelector('defs');
	if (!defs) {
		defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		svg.prepend(defs);
	}
	for (const id of [M_NORM, M_VIOL]) {
		defs.querySelector(`#${id}`)?.remove();
	}
	defs.appendChild(makeMarker(M_NORM, COLOR_NORMAL));
	defs.appendChild(makeMarker(M_VIOL, COLOR_VIOLATED));
}

function buildPath(
	sx: number, sy: number,
	tx: number, ty: number,
	exitRight: boolean,
	enterRight: boolean,
): string {
	const preferred = exitRight ? sx + ELBOW_GAP : sx - ELBOW_GAP;
	const pivotX = !enterRight
		? Math.min(preferred, tx - ELBOW_GAP)
		: tx - ELBOW_GAP;

	return `M ${Math.round(sx)},${Math.round(sy)} H ${Math.round(pivotX)} V ${Math.round(ty)} H ${Math.round(tx)}`;
}

function isViolated(dep: TaskDependency, sourceTask: GanttTask, targetTask: GanttTask): boolean {
	switch (dep.type) {
		case 'FS': return !!(targetTask.endDate   && sourceTask.startDate && sourceTask.startDate < targetTask.endDate);
		case 'SS': return !!(targetTask.startDate && sourceTask.startDate && sourceTask.startDate < targetTask.startDate);
		case 'FF': return !!(targetTask.endDate   && sourceTask.endDate   && sourceTask.endDate   < targetTask.endDate);
		case 'SF': return !!(targetTask.startDate && sourceTask.endDate   && sourceTask.endDate   < targetTask.startDate);
		default:   return false;
	}
}

export function renderDependencies(
	svg: SVGSVGElement,
	tasks: GanttTask[],
	taskRowMap: Map<string, number>,
	config: TimelineConfig,
	settings: GanttViewSettings,
): void {
	while (svg.lastChild) svg.removeChild(svg.lastChild);
	if (!settings.showDependencies) return;

	ensureDefs(svg);

	const taskById = new Map<string, GanttTask>();
	for (const task of tasks) taskById.set(task.id, task);

	for (const sourceTask of tasks) {
		if (!sourceTask.dependencies?.length) continue;

		const srcRowTop = taskRowMap.get(sourceTask.id);
		if (srcRowTop === undefined) continue;
		const srcBarTop = srcRowTop + BAR_MARGIN_TOP + 2;

		const srcBounds = getTaskBarBounds(sourceTask, config);
		if (!srcBounds) continue;
		const srcL = srcBounds.left + 1;
		const srcR = srcBounds.left + srcBounds.width - 1;

		for (const dep of sourceTask.dependencies) {
			if (!dep.targetPath) continue;
			if (!settings.visibleDepTypes.has(dep.type)) continue;

			const targetTask = taskById.get(dep.targetPath);
			if (!targetTask) continue;

			const tgtRowTop = taskRowMap.get(targetTask.id);
			if (tgtRowTop === undefined) continue;
			const tgtBarBot = tgtRowTop + BAR_MARGIN_TOP + BAR_HEIGHT - 3;

			const tgtBounds = getTaskBarBounds(targetTask, config);
			if (!tgtBounds) continue;
			const tgtL = tgtBounds.left + 1;
			const tgtR = tgtBounds.left + tgtBounds.width - 1;

			let sx: number, sy: number, tx: number, ty: number;
			let exitRight: boolean, enterRight: boolean;

			switch (dep.type) {
				case 'FS':
					sx = srcR; sy = srcBarTop; tx = tgtL; ty = tgtBarBot;
					exitRight = true; enterRight = false;
					break;
				case 'SS':
					sx = srcL; sy = srcBarTop; tx = tgtL; ty = tgtBarBot;
					exitRight = false; enterRight = false;
					break;
				case 'FF':
					sx = srcR; sy = srcBarTop; tx = tgtR; ty = tgtBarBot;
					exitRight = true; enterRight = true;
					break;
				case 'SF':
					sx = srcL; sy = srcBarTop; tx = tgtR; ty = tgtBarBot;
					exitRight = false; enterRight = true;
					break;
				default:
					continue;
			}

			const violated = isViolated(dep, sourceTask, targetTask);
			const color = violated ? COLOR_VIOLATED : COLOR_NORMAL;
			const marker = violated ? M_VIOL : M_NORM;

			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', buildPath(sx, sy, tx, ty, exitRight, enterRight));
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', color);
			path.setAttribute('stroke-width', violated ? '2' : '1.5');
			path.setAttribute('opacity',      violated ? '0.9' : '0.55');
			if (violated) path.setAttribute('stroke-dasharray', '5 3');
			path.setAttribute('marker-end', `url(#${marker})`);
			path.classList.add('gbv-dep-arrow');
			path.setAttribute('data-dep-type', dep.type);
			svg.appendChild(path);
		}
	}
}
