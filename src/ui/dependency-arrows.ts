import type { GanttTask, TimelineConfig, GanttViewSettings, DependencyType } from '../core/model.ts';
import { BAR_MARGIN_TOP, BAR_HEIGHT } from '../core/model.ts';
import { getTaskBarBounds } from '../core/timeline.ts';
import { isViolated } from '../core/schedule.ts';

const M_NORM = 'gbv-m-nr';
const M_VIOL = 'gbv-m-vr';

const COLOR_NORMAL   = 'var(--text-muted)';
const COLOR_VIOLATED = 'var(--color-orange, #e8a427)';

// Gap (px) the path extends past the bar edge before turning the corner.
const ELBOW_GAP = 12;

/**
 * Which bar edges an arrow connects, per dependency type. Arrows run from the
 * PREDECESSOR to the SUCCESSOR (standard Gantt convention), joining the two
 * dates the constraint relates — e.g. FS links the predecessor's finish
 * (right edge) to the successor's start (left edge).
 */
export const ARROW_ANCHORS: Record<DependencyType, {
	fromPredRight: boolean; // predecessor edge: right (finish) or left (start)
	toSuccRight: boolean;   // successor edge
}> = {
	FS: { fromPredRight: true,  toSuccRight: false }, // pred finish → succ start
	SS: { fromPredRight: false, toSuccRight: false }, // pred start  → succ start
	FF: { fromPredRight: true,  toSuccRight: true  }, // pred finish → succ finish
	SF: { fromPredRight: false, toSuccRight: true  }, // pred start  → succ finish
};

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

/**
 * Highlights the full dependency chain of whichever bar the pointer is over:
 * every arrow and task reachable upstream (transitive predecessors) and
 * downstream (transitive successors), not just direct links. The graph is
 * read from the rendered arrows' data attributes, so this is delegated on
 * the bars area and survives re-renders. Cycles are safe (visited sets).
 */
export function wireDependencyHover(barsArea: HTMLElement, svg: SVGSVGElement): void {
	const setHighlight = (taskId: string | null) => {
		const paths = Array.from(svg.querySelectorAll('path.gbv-dep-arrow'));

		const chainPaths = new Set<Element>();
		const chainTasks = new Set<string>();

		if (taskId !== null) {
			chainTasks.add(taskId);
			// BFS one direction at a time: upstream follows succ→pred edges,
			// downstream follows pred→succ edges.
			for (const dir of ['up', 'down'] as const) {
				const queue = [taskId];
				const visited = new Set(queue);
				while (queue.length) {
					const id = queue.shift()!;
					for (const path of paths) {
						const pred = path.getAttribute('data-pred');
						const succ = path.getAttribute('data-succ');
						const next = dir === 'up'
							? (succ === id ? pred : null)
							: (pred === id ? succ : null);
						if (!next) continue;
						chainPaths.add(path);
						chainTasks.add(next);
						if (!visited.has(next)) {
							visited.add(next);
							queue.push(next);
						}
					}
				}
			}
		}

		for (const path of paths) {
			path.classList.toggle('is-active', chainPaths.has(path));
		}
		for (const el of Array.from(barsArea.querySelectorAll('.gbv-bar, .gbv-milestone'))) {
			const id = (el as HTMLElement).dataset.taskId;
			el.classList.toggle('gbv-bar--chain', taskId !== null && id !== undefined && chainTasks.has(id));
		}
	};

	barsArea.addEventListener('pointerover', (e) => {
		const bar = (e.target as HTMLElement).closest?.('.gbv-bar, .gbv-milestone') as HTMLElement | null;
		setHighlight(bar?.dataset.taskId ?? null);
	});
	barsArea.addEventListener('pointerleave', () => setHighlight(null));
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

	for (const successor of tasks) {
		if (!successor.dependencies?.length) continue;

		const succRowTop = taskRowMap.get(successor.id);
		if (succRowTop === undefined) continue;
		const succBarBot = succRowTop + BAR_MARGIN_TOP + BAR_HEIGHT - 3;

		const succBounds = getTaskBarBounds(successor, config);
		if (!succBounds) continue;
		const succL = succBounds.left + 1;
		const succR = succBounds.left + succBounds.width - 1;

		for (const dep of successor.dependencies) {
			if (!dep.targetPath) continue;
			if (!settings.visibleDepTypes.has(dep.type)) continue;

			const predecessor = taskById.get(dep.targetPath);
			if (!predecessor || predecessor === successor) continue;

			const predRowTop = taskRowMap.get(predecessor.id);
			if (predRowTop === undefined) continue;
			const predBarTop = predRowTop + BAR_MARGIN_TOP + 2;

			const predBounds = getTaskBarBounds(predecessor, config);
			if (!predBounds) continue;
			const predL = predBounds.left + 1;
			const predR = predBounds.left + predBounds.width - 1;

			const anchors = ARROW_ANCHORS[dep.type];
			const sx = anchors.fromPredRight ? predR : predL;
			const tx = anchors.toSuccRight ? succR : succL;

			const violated = isViolated(dep, predecessor, successor);
			const color = violated ? COLOR_VIOLATED : COLOR_NORMAL;
			const marker = violated ? M_VIOL : M_NORM;

			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', buildPath(sx, predBarTop, tx, succBarBot, anchors.fromPredRight, anchors.toSuccRight));
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', color);
			path.setAttribute('stroke-width', violated ? '2' : '1.5');
			path.setAttribute('opacity',      violated ? '0.9' : '0.55');
			if (violated) path.setAttribute('stroke-dasharray', '5 3');
			path.setAttribute('marker-end', `url(#${marker})`);
			path.classList.add('gbv-dep-arrow');
			path.setAttribute('data-dep-type', dep.type);
			path.setAttribute('data-pred', predecessor.id);
			path.setAttribute('data-succ', successor.id);
			svg.appendChild(path);
		}
	}
}
