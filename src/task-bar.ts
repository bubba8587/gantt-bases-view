import {
  ROW_HEIGHT,
  BAR_HEIGHT,
  BAR_MARGIN_TOP,
  MIN_BAR_LABEL_WIDTH,
  ColorByField,
  GanttTask,
} from './types.ts';
import { getBarColor } from './colors.ts';

/**
 * Returns the bar element (`.gbv-bar`) to be placed inside a pre-existing
 * `.gbv-bar-row`. The caller owns the row; this function owns only the bar.
 */
export function createTaskBar(
  task: GanttTask,
  bounds: { left: number; width: number },
  colorBy: ColorByField,
  showPriority = true,
): HTMLElement {
  if (task.isMilestone) {
    return createMilestoneDiamond(task, bounds, colorBy);
  }

  const bar = document.createElement('div');
  bar.className = 'gbv-bar';
  bar.dataset.taskId = task.id;

  if (task.status === 'done') {
    bar.classList.add('gbv-bar--done');
  }

  bar.style.left = `${bounds.left}px`;
  bar.style.width = `${bounds.width}px`;
  bar.style.top = `${BAR_MARGIN_TOP}px`;
  bar.style.height = `${BAR_HEIGHT}px`;

  // Priority dot + label — only shown when bar is wide enough to be readable
  if (bounds.width >= MIN_BAR_LABEL_WIDTH) {
    if (showPriority) {
      const dot = document.createElement('div');
      dot.className = 'gbv-priority-dot';
      if (task.priority) dot.dataset.priority = task.priority;
      bar.appendChild(dot);
    }

    const label = document.createElement('span');
    label.className = 'gbv-bar-label';
    label.textContent = task.title;
    bar.appendChild(label);
  }

  if (task.completedDate && task.startDate) {
    const marker = createCompletedMarker(task, bounds);
    if (marker) bar.appendChild(marker);
  }

  return bar;
}

function createMilestoneDiamond(
  task: GanttTask,
  bounds: { left: number; width: number },
  colorBy: ColorByField,
): HTMLElement {
  const size = 14; // visual diamond size (px, before rotation)
  const el = document.createElement('div');
  el.className = 'gbv-milestone';
  el.dataset.taskId = task.id;
  if (task.status === 'done') el.classList.add('gbv-bar--done');
  el.style.left = `${bounds.left - size / 2}px`;
  el.style.top = `${Math.round((ROW_HEIGHT - size) / 2)}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.backgroundColor = getBarColor(task, colorBy);
  return el;
}

function createCompletedMarker(
  task: GanttTask,
  bounds: { left: number; width: number },
): HTMLElement | null {
  if (!task.completedDate || !task.startDate || !task.endDate) return null;

  const totalDurationMs = task.endDate.getTime() - task.startDate.getTime();
  if (totalDurationMs <= 0) return null;

  const completedOffsetMs = task.completedDate.getTime() - task.startDate.getTime();
  // Fraction along the bar (0–1), clamped
  const fraction = Math.max(0, Math.min(1, completedOffsetMs / totalDurationMs));
  const offsetPx = Math.round(fraction * bounds.width);

  const marker = document.createElement('div');
  marker.className = 'gbv-complete-marker';

  // Position relative to the bar (which is already positioned in the row)
  // We place the marker relative to the bar's own coordinate space
  marker.style.position = 'absolute';
  // Center the 8px diamond on the offset point
  const markerSize = 8;
  marker.style.left = `${offsetPx - markerSize / 2}px`;
  marker.style.top = `${Math.round((BAR_HEIGHT - markerSize) / 2)}px`;
  marker.style.width = `${markerSize}px`;
  marker.style.height = `${markerSize}px`;

  return marker;
}

export function createSidebarLabel(task: GanttTask, hasViolation = false): HTMLElement {
  const label = document.createElement('div');
  label.className = 'gbv-sidebar-label';
  label.style.height = `${ROW_HEIGHT}px`;
  label.dataset.taskId = task.id;

  if (hasViolation) {
    const badge = document.createElement('span');
    badge.className = 'gbv-violation-badge';
    badge.textContent = '⚠';
    badge.title = 'Schedule conflict';
    label.appendChild(badge);
  }

  const text = document.createElement('span');
  text.textContent = task.title;

  label.appendChild(text);
  return label;
}

