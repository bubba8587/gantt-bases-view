"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GanttBasesViewPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/gantt-view.ts
var import_obsidian2 = require("obsidian");

// src/types.ts
var ROW_HEIGHT = 36;
var BAR_HEIGHT = 24;
var BAR_MARGIN_TOP = 6;
var SIDEBAR_WIDTH = 200;
var HEADER_HEIGHT = 48;
var GROUP_HEADER_HEIGHT = 24;
var TIMELINE_PADDING_DAYS = 7;
var MIN_TIMELINE_WIDTH = 400;
var MIN_BAR_LABEL_WIDTH = 50;
var MIN_SIDEBAR_WIDTH = 120;
var MAX_SIDEBAR_WIDTH = 520;
var STATUS_COLORS = {
  "to-do": "var(--gbv-status-todo, #868e96)",
  "in-progress": "var(--gbv-status-inprogress, #339af0)",
  "done": "var(--gbv-status-done, #51cf66)",
  "blocked": "var(--gbv-status-blocked, #ff6b6b)"
};
var PRIORITY_COLORS = {
  "high": "var(--gbv-priority-high, #ff6b6b)",
  "medium": "var(--gbv-priority-medium, #ffd43b)",
  "low": "var(--gbv-priority-low, #868e96)"
};
var DEFAULT_BAR_COLOR = "var(--gbv-bar-default, #339af0)";
var DEP_FIELDS = [
  { bare: "blockedBy", prop: "note.blockedBy", type: "FS" },
  { bare: "syncStart", prop: "note.syncStart", type: "SS" },
  { bare: "syncFinish", prop: "note.syncFinish", type: "FF" },
  { bare: "finishAfterStart", prop: "note.finishAfterStart", type: "SF" }
];
function stripWikilink(s) {
  let r = s.trim();
  if (r.startsWith("[[") && r.endsWith("]]")) r = r.slice(2, -2);
  const pipe = r.indexOf("|");
  if (pipe >= 0) r = r.slice(0, pipe);
  return r.trim();
}

// src/field-mapping.ts
var DEFAULT_START_PROP = "note.scheduled";
var DEFAULT_END_PROP = "note.due";
function readSettings(config) {
  return {
    startDateProp: config.getAsPropertyId("startDateProp") ?? DEFAULT_START_PROP,
    endDateProp: config.getAsPropertyId("endDateProp") ?? DEFAULT_END_PROP,
    zoom: config.get("zoom") ?? "week",
    colorBy: config.get("colorBy") ?? "priority",
    showDependencies: config.get("showDependencies") ?? true,
    showToday: config.get("showToday") ?? true,
    showPriority: true,
    visibleDepTypes: /* @__PURE__ */ new Set(["FS", "SS", "FF", "SF"])
  };
}
function parseDate(value) {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d2 = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d2.getTime()) ? null : d2;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
function parseNumber(value) {
  if (value == null) return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}
function parseString(value) {
  if (value == null) return "";
  return String(value).trim();
}
function parseArrayOfStrings(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((v) => v != null).map((v) => String(v).trim()).filter((s) => s && s !== "null");
  const str = String(value).trim();
  if (!str || str === "null") return [];
  const matches = str.match(/\[\[[^\]]+\]\]/g);
  if (matches && matches.length > 1) return matches;
  return [str];
}
function parseDependencies(entry) {
  const deps = [];
  for (const { prop, type } of DEP_FIELDS) {
    const value = entry.getValue(prop);
    if (value == null) continue;
    for (const item of parseArrayOfStrings(value)) {
      if (item) deps.push({ targetPath: "", targetName: item, type });
    }
  }
  return deps;
}
function extractTask(entry, settings) {
  const startDate = settings.startDateProp ? parseDate(entry.getValue(settings.startDateProp)) : null;
  const endDate = settings.endDateProp ? parseDate(entry.getValue(settings.endDateProp)) : null;
  const completedDate = parseDate(entry.getValue("note.completedDate"));
  const status = parseString(entry.getValue("note.status"));
  const priority = parseString(entry.getValue("note.priority"));
  const title = parseString(entry.getValue("note.title")) || entry.file.basename;
  const timeEstimate = parseNumber(entry.getValue("note.timeEstimate"));
  const dependencies = parseDependencies(entry);
  const isMilestone = startDate !== null && endDate === null && timeEstimate === null || startDate !== null && endDate !== null && startDate.toDateString() === endDate.toDateString();
  return {
    id: entry.file.path,
    file: entry.file,
    title,
    startDate,
    endDate,
    completedDate,
    status: status.toLowerCase(),
    priority: priority.toLowerCase(),
    dependencies,
    timeEstimate,
    isMilestone,
    entry
  };
}
function resolveDependencyPaths(tasks) {
  const nameToPath = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    nameToPath.set(task.file.basename.toLowerCase(), task.id);
    if (task.title) {
      nameToPath.set(task.title.toLowerCase(), task.id);
    }
  }
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      const bare = stripWikilink(dep.targetName).toLowerCase();
      const resolved = nameToPath.get(bare) ?? nameToPath.get(dep.targetName.toLowerCase());
      if (resolved) {
        dep.targetPath = resolved;
      }
    }
  }
}

// src/timeline.ts
function getPixelsPerDay(zoom) {
  switch (zoom) {
    case "day":
      return 40;
    case "week":
      return 12;
    case "month":
      return 3;
    case "1year":
      return 1;
    case "2year":
      return 0.5;
    case "3year":
      return 0.34;
  }
}
function computeTimelineRange(tasks, zoom) {
  const now = /* @__PURE__ */ new Date();
  let earliest = new Date(now);
  let latest = new Date(now);
  for (const task of tasks) {
    if (task.startDate && task.startDate < earliest) earliest = new Date(task.startDate);
    if (task.endDate && task.endDate > latest) latest = new Date(task.endDate);
    if (task.startDate && task.startDate > latest) latest = new Date(task.startDate);
    if (task.endDate && task.endDate < earliest) earliest = new Date(task.endDate);
    if (task.completedDate && task.completedDate < earliest) earliest = new Date(task.completedDate);
    if (task.completedDate && task.completedDate > latest) latest = new Date(task.completedDate);
  }
  earliest.setDate(earliest.getDate() - TIMELINE_PADDING_DAYS);
  latest.setDate(latest.getDate() + TIMELINE_PADDING_DAYS);
  if (zoom === "1year" || zoom === "2year" || zoom === "3year") {
    earliest = new Date(earliest.getFullYear(), 0, 1);
    latest = new Date(latest.getFullYear() + 1, 0, 1);
  } else if (zoom === "month") {
    earliest.setDate(1);
  } else if (zoom === "week") {
    const day = earliest.getDay();
    earliest.setDate(earliest.getDate() - day);
  }
  earliest = snapToDay(earliest);
  latest = snapToDay(latest);
  return {
    startDate: earliest,
    endDate: latest,
    zoom,
    pixelsPerDay: getPixelsPerDay(zoom)
  };
}
function dateToPixelOffset(date, config) {
  const diffMs = date.getTime() - config.startDate.getTime();
  const diffDays = diffMs / (1e3 * 60 * 60 * 24);
  return Math.round(diffDays * config.pixelsPerDay);
}
function snapToDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysBetween(a, b) {
  const diffMs = b.getTime() - a.getTime();
  return Math.round(diffMs / (1e3 * 60 * 60 * 24));
}
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function totalTimelineWidth(config) {
  return dateToPixelOffset(config.endDate, config);
}
function columnsWidth(columns) {
  return columns.reduce((sum, col) => sum + col.widthPx, 0);
}
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}
function generateColumns(config) {
  const columns = [];
  const cursor = new Date(config.startDate);
  switch (config.zoom) {
    case "day": {
      while (cursor <= config.endDate) {
        const dayNum = cursor.getDate();
        const month = cursor.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        columns.push({
          label: `${month}|${dayNum}`,
          startDate: new Date(cursor),
          widthPx: config.pixelsPerDay
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      break;
    }
    case "week": {
      while (cursor <= config.endDate) {
        const weekStart = new Date(cursor);
        const monday = new Date(weekStart);
        monday.setDate(monday.getDate() + 1);
        const { week, year } = isoWeek(monday);
        columns.push({
          label: `${year}|W${week}`,
          startDate: new Date(weekStart),
          widthPx: 7 * config.pixelsPerDay
        });
        cursor.setDate(cursor.getDate() + 7);
      }
      break;
    }
    case "month": {
      while (cursor <= config.endDate) {
        const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const daysInMonth = monthEnd.getDate();
        const year = String(monthStart.getFullYear());
        const monthName = monthStart.toLocaleDateString("en-US", { month: "short" });
        columns.push({
          label: `${year}|${monthName}`,
          startDate: new Date(monthStart),
          widthPx: daysInMonth * config.pixelsPerDay
        });
        cursor.setMonth(cursor.getMonth() + 1);
        cursor.setDate(1);
      }
      break;
    }
    case "1year":
    case "2year":
    case "3year": {
      while (cursor <= config.endDate) {
        const year = cursor.getFullYear();
        const q = Math.floor(cursor.getMonth() / 3);
        const qStart = new Date(year, q * 3, 1);
        const qEnd = new Date(year, q * 3 + 3, 0);
        const daysInQ = Math.round((qEnd.getTime() - qStart.getTime()) / 864e5) + 1;
        columns.push({
          label: `${year}|Q${q + 1}`,
          startDate: new Date(qStart),
          widthPx: daysInQ * config.pixelsPerDay
        });
        cursor.setMonth(q * 3 + 3);
        cursor.setDate(1);
      }
      break;
    }
  }
  return columns;
}
function getTaskBarBounds(task, config) {
  let start = task.startDate;
  let end = task.endDate;
  if (!start && !end) return null;
  if (start && !end) {
    if (task.timeEstimate) {
      end = new Date(start);
      end.setDate(end.getDate() + Math.ceil(task.timeEstimate / (60 * 8)));
    } else {
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    }
  }
  if (!start && end) {
    start = new Date(end);
    start.setDate(start.getDate() - 1);
  }
  const left = dateToPixelOffset(start, config);
  const right = dateToPixelOffset(end, config);
  const width = Math.max(right - left, config.pixelsPerDay);
  return { left, width };
}

// src/renderer.ts
function buildGanttScaffold(container) {
  const toolbar = container.createDiv({ cls: "gbv-toolbar" });
  const body = container.createDiv({ cls: "gbv-body" });
  const sidebar = body.createDiv({ cls: "gbv-sidebar" });
  const sidebarHeader = sidebar.createDiv({ cls: "gbv-sidebar-header" });
  sidebarHeader.style.height = `${HEADER_HEIGHT}px`;
  sidebar.createDiv({ cls: "gbv-sidebar-labels" }).createDiv({ cls: "gbv-sidebar-labels-inner" });
  const resizeHandle = body.createDiv({ cls: "gbv-sidebar-resize" });
  const scrollArea = body.createDiv({ cls: "gbv-scroll-area" });
  const headerRow = scrollArea.createDiv({ cls: "gbv-header-row" });
  headerRow.style.height = `${HEADER_HEIGHT}px`;
  const barsArea = scrollArea.createDiv({ cls: "gbv-bars-area" });
  const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgLayer.classList.add("gbv-svg-layer");
  barsArea.appendChild(svgLayer);
  return { toolbar, body, sidebar, resizeHandle, scrollArea, headerRow, barsArea, svgLayer };
}
function setTimelineWidth(scrollArea, barsArea, svgLayer, width, totalHeight) {
  barsArea.style.minWidth = `${width}px`;
  const headerRow = scrollArea.querySelector(".gbv-header-row");
  if (headerRow) {
    headerRow.style.minWidth = `${width}px`;
  }
  svgLayer.setAttribute("width", String(width));
  svgLayer.setAttribute("height", String(totalHeight));
  svgLayer.style.width = `${width}px`;
  svgLayer.style.height = `${totalHeight}px`;
}

// src/colors.ts
function getBarColor(task, colorBy) {
  if (colorBy === "status") {
    return STATUS_COLORS[task.status] ?? DEFAULT_BAR_COLOR;
  }
  if (colorBy === "priority") {
    return PRIORITY_COLORS[task.priority] ?? DEFAULT_BAR_COLOR;
  }
  return DEFAULT_BAR_COLOR;
}

// src/task-bar.ts
function createTaskBar(task, bounds, colorBy, showPriority = true) {
  if (task.isMilestone) {
    return createMilestoneDiamond(task, bounds, colorBy);
  }
  const bar = document.createElement("div");
  bar.className = "gbv-bar";
  bar.dataset.taskId = task.id;
  if (task.status === "done") {
    bar.classList.add("gbv-bar--done");
  }
  bar.style.left = `${bounds.left}px`;
  bar.style.width = `${bounds.width}px`;
  bar.style.top = `${BAR_MARGIN_TOP}px`;
  bar.style.height = `${BAR_HEIGHT}px`;
  if (bounds.width >= MIN_BAR_LABEL_WIDTH) {
    if (showPriority) {
      const dot = document.createElement("div");
      dot.className = "gbv-priority-dot";
      if (task.priority) dot.dataset.priority = task.priority;
      bar.appendChild(dot);
    }
    const label = document.createElement("span");
    label.className = "gbv-bar-label";
    label.textContent = task.title;
    bar.appendChild(label);
  }
  if (task.completedDate && task.startDate) {
    const marker = createCompletedMarker(task, bounds);
    if (marker) bar.appendChild(marker);
  }
  return bar;
}
function createMilestoneDiamond(task, bounds, colorBy) {
  const size = 14;
  const el = document.createElement("div");
  el.className = "gbv-milestone";
  el.dataset.taskId = task.id;
  if (task.status === "done") el.classList.add("gbv-bar--done");
  el.style.left = `${bounds.left - size / 2}px`;
  el.style.top = `${Math.round((ROW_HEIGHT - size) / 2)}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.backgroundColor = getBarColor(task, colorBy);
  return el;
}
function createCompletedMarker(task, bounds) {
  if (!task.completedDate || !task.startDate || !task.endDate) return null;
  const totalDurationMs = task.endDate.getTime() - task.startDate.getTime();
  if (totalDurationMs <= 0) return null;
  const completedOffsetMs = task.completedDate.getTime() - task.startDate.getTime();
  const fraction = Math.max(0, Math.min(1, completedOffsetMs / totalDurationMs));
  const offsetPx = Math.round(fraction * bounds.width);
  const marker = document.createElement("div");
  marker.className = "gbv-complete-marker";
  marker.style.position = "absolute";
  const markerSize = 8;
  marker.style.left = `${offsetPx - markerSize / 2}px`;
  marker.style.top = `${Math.round((BAR_HEIGHT - markerSize) / 2)}px`;
  marker.style.width = `${markerSize}px`;
  marker.style.height = `${markerSize}px`;
  return marker;
}
function createSidebarLabel(task, hasViolation = false) {
  const label = document.createElement("div");
  label.className = "gbv-sidebar-label";
  label.style.height = `${ROW_HEIGHT}px`;
  label.dataset.taskId = task.id;
  if (hasViolation) {
    const badge = document.createElement("span");
    badge.className = "gbv-violation-badge";
    badge.textContent = "\u26A0";
    badge.title = "Schedule conflict";
    label.appendChild(badge);
  }
  const text = document.createElement("span");
  text.textContent = task.title;
  label.appendChild(text);
  return label;
}

// src/dependencies.ts
var M_NORM = "gbv-m-nr";
var M_VIOL = "gbv-m-vr";
var COLOR_NORMAL = "var(--text-muted)";
var COLOR_VIOLATED = "var(--color-orange, #e8a427)";
var ELBOW_GAP = 12;
function makeMarker(id, color) {
  const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  m.setAttribute("id", id);
  m.setAttribute("markerWidth", "7");
  m.setAttribute("markerHeight", "7");
  m.setAttribute("refX", "6");
  m.setAttribute("refY", "3.5");
  m.setAttribute("orient", "auto");
  m.setAttribute("markerUnits", "userSpaceOnUse");
  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  poly.setAttribute("points", "0,0 7,3.5 0,7");
  poly.setAttribute("fill", color);
  m.appendChild(poly);
  return m;
}
function ensureDefs(svg) {
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.prepend(defs);
  }
  for (const id of [M_NORM, M_VIOL]) {
    defs.querySelector(`#${id}`)?.remove();
  }
  defs.appendChild(makeMarker(M_NORM, COLOR_NORMAL));
  defs.appendChild(makeMarker(M_VIOL, COLOR_VIOLATED));
}
function buildPath(sx, sy, tx, ty, exitRight, enterRight) {
  const preferred = exitRight ? sx + ELBOW_GAP : sx - ELBOW_GAP;
  const pivotX = !enterRight ? Math.min(preferred, tx - ELBOW_GAP) : tx - ELBOW_GAP;
  return `M ${Math.round(sx)},${Math.round(sy)} H ${Math.round(pivotX)} V ${Math.round(ty)} H ${Math.round(tx)}`;
}
function isViolated(dep, sourceTask, targetTask) {
  switch (dep.type) {
    case "FS":
      return !!(targetTask.endDate && sourceTask.startDate && sourceTask.startDate < targetTask.endDate);
    case "SS":
      return !!(targetTask.startDate && sourceTask.startDate && sourceTask.startDate < targetTask.startDate);
    case "FF":
      return !!(targetTask.endDate && sourceTask.endDate && sourceTask.endDate < targetTask.endDate);
    case "SF":
      return !!(targetTask.startDate && sourceTask.endDate && sourceTask.endDate < targetTask.startDate);
    default:
      return false;
  }
}
function renderDependencies(svg, tasks, taskRowMap, config, settings) {
  while (svg.lastChild) svg.removeChild(svg.lastChild);
  if (!settings.showDependencies) return;
  ensureDefs(svg);
  const taskById = /* @__PURE__ */ new Map();
  for (const task of tasks) taskById.set(task.id, task);
  for (const sourceTask of tasks) {
    if (!sourceTask.dependencies?.length) continue;
    const srcRowTop = taskRowMap.get(sourceTask.id);
    if (srcRowTop === void 0) continue;
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
      if (tgtRowTop === void 0) continue;
      const tgtBarBot = tgtRowTop + BAR_MARGIN_TOP + BAR_HEIGHT - 3;
      const tgtBounds = getTaskBarBounds(targetTask, config);
      if (!tgtBounds) continue;
      const tgtL = tgtBounds.left + 1;
      const tgtR = tgtBounds.left + tgtBounds.width - 1;
      let sx, sy, tx, ty;
      let exitRight, enterRight;
      switch (dep.type) {
        case "FS":
          sx = srcR;
          sy = srcBarTop;
          tx = tgtL;
          ty = tgtBarBot;
          exitRight = true;
          enterRight = false;
          break;
        case "SS":
          sx = srcL;
          sy = srcBarTop;
          tx = tgtL;
          ty = tgtBarBot;
          exitRight = false;
          enterRight = false;
          break;
        case "FF":
          sx = srcR;
          sy = srcBarTop;
          tx = tgtR;
          ty = tgtBarBot;
          exitRight = true;
          enterRight = true;
          break;
        case "SF":
          sx = srcL;
          sy = srcBarTop;
          tx = tgtR;
          ty = tgtBarBot;
          exitRight = false;
          enterRight = true;
          break;
        default:
          continue;
      }
      const violated = isViolated(dep, sourceTask, targetTask);
      const color = violated ? COLOR_VIOLATED : COLOR_NORMAL;
      const marker = violated ? M_VIOL : M_NORM;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", buildPath(sx, sy, tx, ty, exitRight, enterRight));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", violated ? "2" : "1.5");
      path.setAttribute("opacity", violated ? "0.9" : "0.55");
      if (violated) path.setAttribute("stroke-dasharray", "5 3");
      path.setAttribute("marker-end", `url(#${marker})`);
      path.classList.add("gbv-dep-arrow");
      path.setAttribute("data-dep-type", dep.type);
      svg.appendChild(path);
    }
  }
}

// src/popup-editor.ts
var import_obsidian = require("obsidian");
var ChipFileSuggest = class extends import_obsidian.AbstractInputSuggest {
  constructor(app, input, onSelect) {
    super(app, input);
    this.onSelect = onSelect;
  }
  getSuggestions(query) {
    const lower = query.toLowerCase();
    return this.app.vault.getMarkdownFiles().filter((f) => f.basename.toLowerCase().includes(lower)).slice(0, 20);
  }
  renderSuggestion(file, el) {
    el.setText(file.basename);
  }
  selectSuggestion(file) {
    this.onSelect(file);
    this.setValue("");
    this.close();
  }
};
function getPropertyOptions(app, propertyName, fallback, currentValue) {
  const opts = app.metadataTypeManager?.properties?.[propertyName]?.options;
  const base = opts && opts.length > 0 ? opts : fallback;
  if (currentValue && !base.includes(currentValue)) {
    return [...base, currentValue];
  }
  return base;
}
var DEP_TYPE_TO_FIELD = Object.fromEntries(
  DEP_FIELDS.map((f) => [f.type, f.bare])
);
var activePopup = null;
function clampToViewport(rect, popupWidth, popupHeight, offsetX, offsetY) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.left + offsetX;
  let top = rect.bottom + offsetY;
  if (top + popupHeight > vh - 8) {
    top = rect.top - popupHeight - offsetY;
  }
  if (left + popupWidth > vw - 8) {
    left = vw - popupWidth - 8;
  }
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  return { left, top };
}
function closeActivePopup() {
  if (activePopup) {
    activePopup.destroy();
    activePopup = null;
  }
}
function createLabeledField(label, control) {
  const row = document.createElement("div");
  row.className = "gbv-popup-field";
  const lbl = document.createElement("label");
  lbl.textContent = label;
  row.appendChild(lbl);
  row.appendChild(control);
  return row;
}
function createSelect(options, current) {
  const sel = document.createElement("select");
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    if (opt === current) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}
function openPopupEditor(task, anchorEl, app, onUpdate) {
  var _a;
  closeActivePopup();
  const popup = document.createElement("div");
  popup.className = "gbv-popup";
  popup.style.position = "fixed";
  popup.style.visibility = "hidden";
  popup.style.left = "-9999px";
  popup.style.top = "-9999px";
  popup.style.zIndex = "10000";
  const titleRow = document.createElement("div");
  titleRow.className = "gbv-popup-title";
  const titleEl = document.createElement("h4");
  titleEl.textContent = task.title || task.file.basename;
  const linkBtn = document.createElement("button");
  linkBtn.className = "gbv-popup-link-btn clickable-icon";
  linkBtn.title = "Open note";
  linkBtn.setAttribute("aria-label", "Open note");
  linkBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  linkBtn.addEventListener("click", (e) => {
    const newTab = e.ctrlKey || e.metaKey;
    app.workspace.openLinkText(task.file.basename, task.file.path, newTab);
    closeActivePopup();
  });
  titleRow.appendChild(titleEl);
  titleRow.appendChild(linkBtn);
  popup.appendChild(titleRow);
  const startInput = document.createElement("input");
  startInput.type = "date";
  startInput.value = task.startDate ? formatDate(task.startDate) : "";
  const endInput = document.createElement("input");
  endInput.type = "date";
  endInput.value = task.endDate ? formatDate(task.endDate) : "";
  const dateRow = document.createElement("div");
  dateRow.className = "gbv-popup-row2";
  dateRow.appendChild(createLabeledField("Start date", startInput));
  dateRow.appendChild(createLabeledField("End date", endInput));
  popup.appendChild(dateRow);
  const statusOptions = getPropertyOptions(app, "status", ["to-do", "in-progress", "done", "blocked"], task.status);
  const statusSel = createSelect(statusOptions, task.status || statusOptions[0]);
  const priorityOptions = getPropertyOptions(app, "priority", ["low", "medium", "high"], task.priority);
  const prioritySel = createSelect(priorityOptions, task.priority || priorityOptions[0]);
  const spRow = document.createElement("div");
  spRow.className = "gbv-popup-row2";
  spRow.appendChild(createLabeledField("Status", statusSel));
  spRow.appendChild(createLabeledField("Priority", prioritySel));
  popup.appendChild(spRow);
  const depsSection = document.createElement("div");
  depsSection.className = "gbv-popup-deps";
  const depsHeaderRow = document.createElement("div");
  depsHeaderRow.className = "gbv-popup-deps-header-row";
  const depsTitle = document.createElement("span");
  depsTitle.className = "gbv-popup-deps-header";
  depsTitle.textContent = "Dependencies";
  const addDepBtn = document.createElement("button");
  addDepBtn.className = "gbv-popup-deps-add";
  addDepBtn.textContent = "+ Add";
  addDepBtn.type = "button";
  depsHeaderRow.appendChild(depsTitle);
  depsHeaderRow.appendChild(addDepBtn);
  depsSection.appendChild(depsHeaderRow);
  const depRowsContainer = document.createElement("div");
  depsSection.appendChild(depRowsContainer);
  popup.appendChild(depsSection);
  const allSuggests = [];
  function addDepRow(type, initialNames) {
    const row = document.createElement("div");
    row.className = "gbv-popup-dep-edit-row";
    const typeSel = document.createElement("select");
    typeSel.className = "gbv-popup-dep-type";
    for (const t of ["FS", "SS", "FF", "SF"]) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      if (t === type) o.selected = true;
      typeSel.appendChild(o);
    }
    typeSel.dataset.depType = type;
    typeSel.addEventListener("change", () => {
      typeSel.dataset.depType = typeSel.value;
    });
    const chipsArea = document.createElement("div");
    chipsArea.className = "gbv-dep-chips-area";
    const newItemInput = document.createElement("input");
    newItemInput.type = "text";
    newItemInput.className = "gbv-dep-new-item";
    newItemInput.placeholder = "Add note\u2026";
    chipsArea.appendChild(newItemInput);
    chipsArea.addEventListener("click", (e) => {
      if (e.target === chipsArea) newItemInput.focus();
    });
    function addChip(name) {
      const chip = document.createElement("span");
      chip.className = "gbv-dep-chip";
      chip.dataset.depValue = name;
      const label = document.createElement("span");
      label.textContent = stripWikilink(name);
      const xBtn = document.createElement("button");
      xBtn.type = "button";
      xBtn.className = "gbv-dep-chip-remove";
      xBtn.textContent = "\xD7";
      xBtn.addEventListener("click", () => chip.remove());
      chip.appendChild(label);
      chip.appendChild(xBtn);
      chipsArea.insertBefore(chip, newItemInput);
    }
    for (const n of initialNames) addChip(n);
    const suggest = new ChipFileSuggest(app, newItemInput, (file) => {
      addChip(`[[${file.basename}]]`);
      newItemInput.focus();
    });
    allSuggests.push(suggest);
    const removeBtn = document.createElement("button");
    removeBtn.className = "gbv-popup-dep-remove";
    removeBtn.textContent = "\xD7";
    removeBtn.type = "button";
    removeBtn.addEventListener("click", () => {
      suggest.close();
      row.remove();
    });
    row.appendChild(typeSel);
    row.appendChild(chipsArea);
    row.appendChild(removeBtn);
    depRowsContainer.appendChild(row);
  }
  const initByType = {};
  for (const dep of task.dependencies) {
    if (dep.targetName) {
      (initByType[_a = dep.type] ?? (initByType[_a] = [])).push(dep.targetName);
    }
  }
  for (const [type, names] of Object.entries(initByType)) addDepRow(type, names);
  addDepBtn.addEventListener("click", () => addDepRow("FS", []));
  const actionsRow = document.createElement("div");
  actionsRow.className = "gbv-popup-actions";
  const saveBtn = document.createElement("button");
  saveBtn.className = "gbv-popup-save mod-cta";
  saveBtn.textContent = "Save";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "gbv-popup-cancel";
  cancelBtn.textContent = "Cancel";
  actionsRow.appendChild(saveBtn);
  actionsRow.appendChild(cancelBtn);
  popup.appendChild(actionsRow);
  document.body.appendChild(popup);
  const anchorRect = anchorEl.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  const { left, top } = clampToViewport(anchorRect, popupRect.width || 280, popupRect.height || 240, 0, 8);
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.style.visibility = "";
  function destroy() {
    for (const s of allSuggests) s.close();
    popup.remove();
    document.removeEventListener("keydown", onKeyDown);
    setTimeout(() => {
      document.removeEventListener("click", onDocClick, true);
    }, 0);
  }
  function onKeyDown(e) {
    if (e.key === "Escape") {
      closeActivePopup();
    }
  }
  function onDocClick(e) {
    const target = e.target;
    if (!popup.contains(target) && !target.closest?.(".suggestion-container")) {
      closeActivePopup();
    }
  }
  document.addEventListener("keydown", onKeyDown);
  setTimeout(() => {
    document.addEventListener("click", onDocClick, true);
  }, 0);
  activePopup = { el: popup, destroy };
  saveBtn.addEventListener("click", async () => {
    const newStart = startInput.value;
    const newEnd = endInput.value;
    const newStatus = statusSel.value;
    const newPriority = prioritySel.value;
    const depsByType = { FS: [], SS: [], FF: [], SF: [] };
    for (const row of Array.from(depRowsContainer.querySelectorAll(".gbv-popup-dep-edit-row"))) {
      const type = row.querySelector(".gbv-popup-dep-type").value;
      if (!(type in depsByType)) continue;
      for (const chip of Array.from(row.querySelectorAll(".gbv-dep-chip"))) {
        const val = chip.dataset.depValue;
        if (val) depsByType[type].push(val);
      }
      const pending = (row.querySelector(".gbv-dep-new-item")?.value ?? "").trim();
      if (pending) depsByType[type].push(pending.startsWith("[[") ? pending : `[[${pending}]]`);
    }
    await app.fileManager.processFrontMatter(task.file, (fm) => {
      if (newStart) {
        fm["scheduled"] = newStart;
      } else {
        delete fm["scheduled"];
      }
      if (newEnd) {
        fm["due"] = newEnd;
      } else {
        delete fm["due"];
      }
      fm["status"] = newStatus;
      fm["priority"] = newPriority;
      for (const [type, field] of Object.entries(DEP_TYPE_TO_FIELD)) {
        const names = depsByType[type];
        if (names.length > 0) {
          fm[field] = names;
        } else {
          delete fm[field];
        }
      }
    });
    closeActivePopup();
    onUpdate();
  });
  cancelBtn.addEventListener("click", () => {
    closeActivePopup();
  });
}

// src/export.ts
function depsLabel(task) {
  if (!task.dependencies || task.dependencies.length === 0) return "";
  return task.dependencies.filter((d) => d.targetName).map((d) => `${d.targetName} (${d.type})`).join(", ");
}
function durationDays(task) {
  if (!task.startDate || !task.endDate) return "";
  return String(daysBetween(task.startDate, task.endDate));
}
var DATA_HEADERS = ["Task", "Status", "Priority", "Start", "End", "Duration (days)", "Dependencies"];
var BAR_CHAR = "\u2588";
function taskOverlapsColumn(task, colStart, colEnd) {
  const start = task.startDate;
  const end = task.endDate;
  if (!start || !end) return false;
  return start < colEnd && end > colStart;
}
function exportToTSV(groups, timelineConfig) {
  const columns = generateColumns(timelineConfig);
  const colRanges = columns.map((col, i) => {
    const colStart = col.startDate;
    const colEnd = i + 1 < columns.length ? columns[i + 1].startDate : new Date(col.startDate.getTime() + col.widthPx / timelineConfig.pixelsPerDay * 864e5);
    return { label: displayLabel(col.label), colStart, colEnd };
  });
  const headerCells = [...DATA_HEADERS, ...colRanges.map((c) => c.label)];
  const lines = [headerCells.join("	")];
  for (const group of groups) {
    if (group.key) {
      const pad = "	".repeat(DATA_HEADERS.length - 1);
      lines.push(`${group.key}${pad}`);
    }
    for (const task of group.tasks) {
      const dataCols = [
        task.title || task.file.basename,
        task.status || "",
        task.priority || "",
        task.startDate ? formatDate(task.startDate) : "",
        task.endDate ? formatDate(task.endDate) : "",
        durationDays(task),
        depsLabel(task)
      ].map((c) => c.replace(/\t/g, " "));
      const barCols = colRanges.map(
        ({ colStart, colEnd }) => taskOverlapsColumn(task, colStart, colEnd) ? BAR_CHAR : ""
      );
      lines.push([...dataCols, ...barCols].join("	"));
    }
  }
  return lines.join("\n");
}
function displayLabel(label) {
  const pipeIdx = label.indexOf("|");
  if (pipeIdx < 0) return label;
  const month = label.slice(0, label.indexOf(" "));
  const day = label.slice(pipeIdx + 1);
  return `${month} ${day}`;
}
async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

// src/violations.ts
function detectViolations(tasks) {
  const violations = [];
  const taskById = /* @__PURE__ */ new Map();
  for (const task of tasks) taskById.set(task.id, task);
  for (const target of tasks) {
    for (const dep of target.dependencies) {
      const source = taskById.get(dep.targetPath);
      if (!source) continue;
      switch (dep.type) {
        case "FS": {
          if (source.endDate === null || target.startDate === null) break;
          if (target.startDate < source.endDate) {
            violations.push({
              sourceTask: source,
              targetTask: target,
              dep,
              description: `${target.title} must start after ${source.title} finishes (${formatDate(source.endDate)})`,
              fixField: "start",
              suggestedDate: source.endDate
            });
          }
          break;
        }
        case "SS": {
          if (source.startDate === null || target.startDate === null) break;
          if (target.startDate < source.startDate) {
            violations.push({
              sourceTask: source,
              targetTask: target,
              dep,
              description: `${target.title} must start no earlier than ${source.title} (${formatDate(source.startDate)})`,
              fixField: "start",
              suggestedDate: source.startDate
            });
          }
          break;
        }
        case "FF": {
          if (source.endDate === null || target.endDate === null) break;
          if (target.endDate < source.endDate) {
            violations.push({
              sourceTask: source,
              targetTask: target,
              dep,
              description: `${target.title} must finish after ${source.title} finishes (${formatDate(source.endDate)})`,
              fixField: "end",
              suggestedDate: source.endDate
            });
          }
          break;
        }
        case "SF": {
          if (source.startDate === null || target.endDate === null) break;
          if (target.endDate < source.startDate) {
            violations.push({
              sourceTask: source,
              targetTask: target,
              dep,
              description: `${target.title} must finish after ${source.title} starts (${formatDate(source.startDate)})`,
              fixField: "end",
              suggestedDate: source.startDate
            });
          }
          break;
        }
      }
    }
  }
  return violations;
}
var activePanel = null;
function closeViolationPanel() {
  if (activePanel) {
    activePanel.remove();
    activePanel = null;
  }
}
var DEP_VERBS = {
  FS: ["must start after", "finishes"],
  SS: ["must start no earlier than", "starts"],
  FF: ["must finish after", "finishes"],
  SF: ["must finish after", "starts"]
};
async function applyViolationFix(app, violation) {
  const { targetTask, fixField, suggestedDate } = violation;
  const dateStr = formatDate(suggestedDate);
  const frontmatterKey = fixField === "start" ? "scheduled" : "due";
  await app.fileManager.processFrontMatter(
    targetTask.file,
    (fm) => {
      fm[frontmatterKey] = dateStr;
    }
  );
}
function openViolationPanel(violations, app, onUpdate) {
  closeViolationPanel();
  const panel = document.createElement("div");
  panel.className = "gbv-violation-panel";
  activePanel = panel;
  const header = document.createElement("div");
  header.className = "gbv-violation-header";
  const headerTitle = document.createElement("span");
  headerTitle.textContent = `\u26A0 Schedule Conflicts (${violations.length})`;
  const closeBtn = document.createElement("button");
  closeBtn.className = "gbv-violation-close";
  closeBtn.textContent = "\u2715";
  closeBtn.addEventListener("click", closeViolationPanel);
  header.appendChild(headerTitle);
  header.appendChild(closeBtn);
  panel.appendChild(header);
  const rowsContainer = document.createElement("div");
  rowsContainer.className = "gbv-violation-rows";
  const remainingViolations = [...violations];
  const removeViolationRow = (row, violation) => {
    row.remove();
    const idx = remainingViolations.indexOf(violation);
    if (idx !== -1) remainingViolations.splice(idx, 1);
    headerTitle.textContent = `\u26A0 Schedule Conflicts (${remainingViolations.length})`;
    if (remainingViolations.length === 0) closeViolationPanel();
  };
  for (const violation of violations) {
    const row = document.createElement("div");
    row.className = "gbv-violation-row";
    const icon = document.createElement("span");
    icon.className = "gbv-violation-icon";
    icon.textContent = "\u26A0";
    const textBlock = document.createElement("div");
    textBlock.className = "gbv-violation-text";
    const mainText = document.createElement("div");
    mainText.className = "gbv-violation-main";
    const [verb, sourceVerb] = DEP_VERBS[violation.dep.type] ?? ["must follow", ""];
    const appendChip = (text) => {
      const chip = document.createElement("strong");
      chip.className = "gbv-violation-chip";
      chip.textContent = text;
      mainText.appendChild(chip);
    };
    const appendMuted = (text) => {
      const span = document.createElement("span");
      span.className = "gbv-violation-muted";
      span.textContent = text;
      mainText.appendChild(span);
    };
    appendChip(violation.targetTask.title);
    appendMuted(` ${verb} `);
    appendChip(violation.sourceTask.title);
    if (sourceVerb) appendMuted(` ${sourceVerb}`);
    const subText = document.createElement("div");
    subText.className = "gbv-violation-fix-hint";
    const fieldLabel = violation.fixField === "start" ? "start" : "end";
    subText.textContent = `Suggested: move ${fieldLabel} to ${formatDate(violation.suggestedDate)}`;
    textBlock.appendChild(mainText);
    textBlock.appendChild(subText);
    const applyBtn = document.createElement("button");
    applyBtn.className = "gbv-violation-apply";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", async () => {
      await applyViolationFix(app, violation);
      removeViolationRow(row, violation);
      onUpdate();
    });
    row.appendChild(icon);
    row.appendChild(textBlock);
    row.appendChild(applyBtn);
    rowsContainer.appendChild(row);
  }
  panel.appendChild(rowsContainer);
  if (violations.length > 0) {
    const footer = document.createElement("div");
    footer.className = "gbv-violation-footer";
    const applyAllBtn = document.createElement("button");
    applyAllBtn.className = "gbv-violation-apply-all";
    applyAllBtn.textContent = "Apply All";
    applyAllBtn.addEventListener("click", async () => {
      for (const v of [...remainingViolations]) {
        await applyViolationFix(app, v);
      }
      onUpdate();
      closeViolationPanel();
    });
    footer.appendChild(applyAllBtn);
    panel.appendChild(footer);
  }
  document.body.appendChild(panel);
}

// src/gantt-view.ts
var ZOOM_LEVELS = ["day", "week", "month", "1year", "2year", "3year"];
var ZOOM_LABELS = { day: "Day", week: "Week", month: "Month", "1year": "1Y", "2year": "2Y", "3year": "3Y" };
var GanttView = class extends import_obsidian2.BasesView {
  constructor(controller, containerEl) {
    super(controller);
    this.type = "gantt";
    // our own child div — all rendering goes here
    this._localZoom = null;
    // overrides config zoom when set
    this._sidebarWidth = SIDEBAR_WIDTH;
    // persists across re-renders for drag resize
    this._dragCleanup = null;
    // cancels any in-progress sidebar drag
    this._collapsedGroups = /* @__PURE__ */ new Set();
    // group keys the user has collapsed
    this._scrollLeft = 0;
    // preserved across re-renders
    this._scrollTop = 0;
    this._resizeObserver = null;
    this._lastRenderedWidth = 0;
    this._resizeTimer = null;
    this.scrollEl = containerEl;
    this.rootEl = containerEl.createDiv("gbv-root");
    this._resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0 && Math.abs(width - this._lastRenderedWidth) > 1) {
        if (this._resizeTimer) clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this._render(), 100);
      }
    });
    this._resizeObserver.observe(containerEl);
  }
  onDataUpdated() {
    this._render();
  }
  onunload() {
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
  _render() {
    const container = this.rootEl;
    this._lastRenderedWidth = this.scrollEl.clientWidth;
    if (!this.data) return;
    const config = this.config;
    const prevScroll = container.querySelector(".gbv-scroll-area");
    if (prevScroll) {
      this._scrollLeft = prevScroll.scrollLeft;
      this._scrollTop = prevScroll.scrollTop;
    }
    container.empty();
    const settings = readSettings(config);
    if (this._localZoom) settings.zoom = this._localZoom;
    const rawProps = config.getOrder() ?? [];
    const visibleProps = new Set(rawProps);
    if (visibleProps.size > 0) {
      settings.showPriority = visibleProps.has("note.priority") || visibleProps.has("priority");
      settings.visibleDepTypes = new Set(
        DEP_FIELDS.filter((f) => visibleProps.has(f.prop) || visibleProps.has(f.bare)).map((f) => f.type)
      );
    }
    const groups = this.data.groupedData.map((g) => ({
      key: g.hasKey() ? this._formatGroupKey(g.key.toString()) : "",
      tasks: g.entries.map((entry) => extractTask(entry, settings))
    }));
    const tasks = groups.flatMap((g) => g.tasks);
    resolveDependencyPaths(tasks);
    const violations = detectViolations(tasks);
    const violatingTaskIds = new Set(violations.map((v) => v.targetTask.id));
    let timelineConfig = computeTimelineRange(tasks, settings.zoom);
    const { toolbar, body, sidebar, resizeHandle, scrollArea, headerRow, barsArea, svgLayer } = buildGanttScaffold(container);
    sidebar.style.width = `${this._sidebarWidth}px`;
    this._wireSidebarResize(sidebar, resizeHandle);
    const availableWidth = Math.max(
      MIN_TIMELINE_WIDTH,
      (this.scrollEl.clientWidth || 0) - this._sidebarWidth - 2
      // -2 for sidebar resize handle border
    );
    const contentWidth = totalTimelineWidth(timelineConfig);
    if (contentWidth < availableWidth) {
      const extraDays = Math.ceil(
        (availableWidth - contentWidth) / timelineConfig.pixelsPerDay
      );
      timelineConfig = {
        ...timelineConfig,
        endDate: new Date(
          timelineConfig.endDate.getTime() + extraDays * 864e5
        )
      };
    }
    const columns = generateColumns(timelineConfig);
    const totalWidth = columnsWidth(columns);
    this._renderToolbar(toolbar, tasks, groups, scrollArea, timelineConfig, settings.zoom, violations);
    this._renderColumnHeaders(headerRow, columns);
    const { taskRowMap, totalHeightPx } = this._renderTaskRows(
      groups,
      sidebar,
      barsArea,
      timelineConfig,
      settings,
      violatingTaskIds,
      totalWidth
    );
    setTimelineWidth(scrollArea, barsArea, svgLayer, totalWidth, totalHeightPx);
    if (settings.showToday) {
      this._renderTodayLine(barsArea, timelineConfig);
    }
    if (settings.showDependencies) {
      renderDependencies(svgLayer, tasks, taskRowMap, timelineConfig, settings);
    }
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
  _formatGroupKey(raw) {
    return stripWikilink(raw) || "Ungrouped";
  }
  _renderToolbar(toolbar, tasks, groups, scrollArea, timelineConfig, currentZoom, violations) {
    const zoomGroup = toolbar.createEl("div", { cls: "gbv-zoom-group" });
    for (const zoom of ZOOM_LEVELS) {
      const btn = zoomGroup.createEl("button", {
        text: ZOOM_LABELS[zoom],
        cls: zoom === currentZoom ? "gbv-zoom-btn is-active" : "gbv-zoom-btn"
      });
      btn.addEventListener("click", () => {
        if (this._localZoom !== zoom) {
          this._scrollLeft = 0;
          this._scrollTop = 0;
        }
        this._localZoom = zoom;
        this._render();
      });
    }
    toolbar.createEl("div", { cls: "gbv-toolbar-separator" });
    const todayBtn = toolbar.createEl("button", { text: "Today", cls: "gbv-btn" });
    todayBtn.addEventListener("click", () => {
      const offset = dateToPixelOffset(/* @__PURE__ */ new Date(), timelineConfig);
      scrollArea.scrollLeft = Math.max(0, offset - scrollArea.clientWidth / 2);
    });
    toolbar.createEl("div", { cls: "gbv-toolbar-separator" });
    const violationBtn = toolbar.createEl("button", {
      text: violations.length > 0 ? `\u26A0 Fix Schedule (${violations.length})` : "\u2713 Schedule OK",
      cls: violations.length > 0 ? "gbv-btn gbv-btn--warn" : "gbv-btn gbv-btn--ok"
    });
    if (violations.length > 0) {
      violationBtn.addEventListener("click", () => {
        openViolationPanel(violations, this.app, () => this._render());
      });
    }
    toolbar.createEl("div", { cls: "gbv-toolbar-separator" });
    const exportBtn = toolbar.createEl("button", { text: "Copy TSV", cls: "gbv-btn" });
    exportBtn.addEventListener("click", async () => {
      const tsv = exportToTSV(groups, timelineConfig);
      await copyToClipboard(tsv);
    });
  }
  _renderColumnHeaders(headerRow, columns) {
    const topRow = headerRow.createEl("div", { cls: "gbv-header-top-row" });
    const botRow = headerRow.createEl("div", { cls: "gbv-header-bot-row" });
    let currentGroup = "";
    let groupCell = null;
    let groupWidth = 0;
    for (const col of columns) {
      const pipeIdx = col.label.indexOf("|");
      const group = pipeIdx >= 0 ? col.label.slice(0, pipeIdx) : "";
      const label = pipeIdx >= 0 ? col.label.slice(pipeIdx + 1) : col.label;
      if (group !== currentGroup) {
        if (groupCell) {
          groupCell.style.width = `${groupWidth}px`;
          groupCell.style.minWidth = `${groupWidth}px`;
        }
        groupCell = topRow.createEl("div", { text: group, cls: "gbv-header-cell gbv-header-month" });
        currentGroup = group;
        groupWidth = 0;
      }
      groupWidth += col.widthPx;
      const cell = botRow.createEl("div", { text: label, cls: "gbv-header-cell gbv-header-day" });
      cell.style.width = `${col.widthPx}px`;
      cell.style.minWidth = `${col.widthPx}px`;
      cell.style.flexShrink = "0";
    }
    if (groupCell) {
      groupCell.style.width = `${groupWidth}px`;
      groupCell.style.minWidth = `${groupWidth}px`;
    }
  }
  _renderTaskRows(groups, sidebar, barsArea, timelineConfig, settings, violatingTaskIds, totalWidth) {
    const taskRowMap = /* @__PURE__ */ new Map();
    let currentY = 0;
    let rowIndex = 0;
    const sidebarInner = sidebar.querySelector(".gbv-sidebar-labels-inner") ?? sidebar;
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
        const sidebarHdr = document.createElement("div");
        sidebarHdr.className = "gbv-group-header";
        sidebarHdr.style.height = `${GROUP_HEADER_HEIGHT}px`;
        sidebarHdr.style.cursor = "pointer";
        const caret = document.createElement("span");
        caret.className = "gbv-group-caret";
        caret.textContent = isCollapsed ? "\u25B6" : "\u25BC";
        sidebarHdr.appendChild(caret);
        sidebarHdr.appendChild(document.createTextNode(group.key));
        sidebarHdr.addEventListener("click", toggle);
        sidebarInner.appendChild(sidebarHdr);
        const barsHdr = barsArea.createEl("div", { cls: "gbv-group-header" });
        barsHdr.style.width = `${totalWidth}px`;
        barsHdr.style.height = `${GROUP_HEADER_HEIGHT}px`;
        barsHdr.style.cursor = "pointer";
        barsHdr.style.position = "relative";
        barsHdr.addEventListener("click", toggle);
        if (isCollapsed) {
          const sb = this._getGroupSummaryBounds(group.tasks, timelineConfig);
          if (sb) {
            const summaryBar = document.createElement("div");
            summaryBar.className = "gbv-summary-bar";
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
        taskRowMap.set(task.id, currentY);
        const isAlt = rowIndex % 2 === 1;
        const hasViolation = violatingTaskIds.has(task.id);
        const labelEl = createSidebarLabel(task, hasViolation);
        if (isAlt) labelEl.classList.add("gbv-sidebar-label--alt");
        labelEl.style.cursor = "pointer";
        labelEl.addEventListener("click", () => {
          openPopupEditor(task, labelEl, this.app, () => this._render());
        });
        sidebarInner.appendChild(labelEl);
        const barRowEl = barsArea.createEl("div", { cls: "gbv-bar-row" });
        if (isAlt) barRowEl.classList.add("gbv-bar-row--alt");
        barRowEl.style.width = `${totalWidth}px`;
        rowIndex++;
        const bounds = getTaskBarBounds(task, timelineConfig);
        if (bounds) {
          const barEl = createTaskBar(task, bounds, settings.colorBy, settings.showPriority);
          barRowEl.appendChild(barEl);
          barEl.addEventListener("click", (e) => {
            e.stopPropagation();
            openPopupEditor(task, barEl, this.app, () => this._render());
          });
        }
        currentY += ROW_HEIGHT;
      }
    }
    return { taskRowMap, totalHeightPx: currentY };
  }
  _getGroupSummaryBounds(tasks, timelineConfig) {
    let minDate = null;
    let maxDate = null;
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
  _renderTodayLine(barsArea, timelineConfig) {
    const offset = dateToPixelOffset(/* @__PURE__ */ new Date(), timelineConfig);
    if (offset < 0) return;
    const line = barsArea.createEl("div", { cls: "gbv-today-line" });
    line.style.left = `${offset}px`;
  }
  _wireSidebarResize(sidebar, handle) {
    let startX = 0;
    let startWidth = 0;
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = sidebar.offsetWidth;
      handle.classList.add("is-dragging");
      document.body.classList.add("gbv-resizing");
      const onMove = (e2) => {
        const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + e2.clientX - startX));
        sidebar.style.width = `${newWidth}px`;
        this._sidebarWidth = newWidth;
      };
      const cleanup = () => {
        handle.classList.remove("is-dragging");
        document.body.classList.remove("gbv-resizing");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", cleanup);
        this._dragCleanup = null;
      };
      this._dragCleanup = cleanup;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", cleanup);
    });
  }
  _wireScrollSync(sidebar, scrollArea) {
    const sidebarLabelsInner = sidebar.querySelector(".gbv-sidebar-labels-inner") ?? sidebar;
    scrollArea.addEventListener("scroll", () => {
      sidebarLabelsInner.style.transform = `translateY(-${scrollArea.scrollTop}px)`;
    });
    sidebar.addEventListener("wheel", (e) => {
      e.preventDefault();
      scrollArea.scrollBy({ left: e.deltaX, top: e.deltaY });
    }, { passive: false });
  }
};

// src/options.ts
function getViewOptions(_config) {
  return [
    {
      type: "optionGroup",
      name: "Data",
      options: [
        {
          type: "property",
          name: "Start date property",
          key: "startDateProp",
          defaultValue: "note.scheduled"
        },
        {
          type: "property",
          name: "End date property",
          key: "endDateProp",
          defaultValue: "note.due"
        }
      ]
    },
    {
      type: "optionGroup",
      name: "Display",
      options: [
        {
          type: "dropdown",
          name: "Zoom",
          key: "zoom",
          options: ["day", "week", "month", "1year", "2year", "3year"],
          defaultValue: "week"
        },
        {
          type: "dropdown",
          name: "Color by",
          key: "colorBy",
          options: ["status", "priority"],
          defaultValue: "priority"
        },
        {
          type: "toggle",
          name: "Show dependencies",
          key: "showDependencies",
          defaultValue: true
        },
        {
          type: "toggle",
          name: "Show today marker",
          key: "showToday",
          defaultValue: true
        }
      ]
    }
  ];
}

// src/main.ts
var GanttBasesViewPlugin = class extends import_obsidian3.Plugin {
  onload() {
    this.registerBasesView("gantt", {
      name: "Gantt",
      icon: "bar-chart-horizontal",
      factory: (controller, containerEl) => new GanttView(controller, containerEl),
      options: (config) => getViewOptions(config)
    });
    this.addSettingTab(new GanttSettingsTab(this.app, this));
  }
  onunload() {
  }
};
var GanttSettingsTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian3.Setting(containerEl).setName("Create example notes").setDesc('Creates a small set of linked notes in your vault demonstrating all four dependency types (FS, SS, FF, SF). Notes are placed in a "Gantt Examples" folder.').addButton((btn) => {
      btn.setButtonText("Create examples").setCta().onClick(() => this.createExampleNotes());
    });
  }
  async createExampleNotes() {
    const vault = this.app.vault;
    const folderPath = "Gantt Examples";
    if (!vault.getAbstractFileByPath(folderPath)) {
      await vault.createFolder(folderPath);
    }
    const notes = [
      {
        name: "GE-Design",
        content: [
          "---",
          "title: Design",
          "status: done",
          "priority: high",
          "scheduled: 2026-04-01",
          "due: 2026-04-07",
          "projects:",
          "  - Website Launch",
          "---",
          "",
          "UI/UX design and wireframes.",
          "No dependencies \u2014 this is the first task."
        ].join("\n")
      },
      {
        name: "GE-Development",
        content: [
          "---",
          "title: Development",
          "status: in-progress",
          "priority: high",
          "scheduled: 2026-04-08",
          "due: 2026-04-21",
          "projects:",
          "  - Website Launch",
          "blockedBy:",
          '  - "[[GE-Design]]"',
          "---",
          "",
          "Build the site.",
          "",
          "**FS** via `blockedBy`: starts after Design finishes."
        ].join("\n")
      },
      {
        name: "GE-Testing",
        content: [
          "---",
          "title: Testing",
          "status: to-do",
          "priority: medium",
          "scheduled: 2026-04-08",
          "due: 2026-04-28",
          "projects:",
          "  - Website Launch",
          "syncStart:",
          '  - "[[GE-Development]]"',
          "---",
          "",
          "QA and user testing.",
          "",
          "**SS** via `syncStart`: starts when Development starts."
        ].join("\n")
      },
      {
        name: "GE-Documentation",
        content: [
          "---",
          "title: Documentation",
          "status: to-do",
          "priority: low",
          "scheduled: 2026-04-14",
          "due: 2026-04-21",
          "projects:",
          "  - Website Launch",
          "syncFinish:",
          '  - "[[GE-Development]]"',
          "---",
          "",
          "Write user and developer docs.",
          "",
          "**FF** via `syncFinish`: must finish when Development finishes."
        ].join("\n")
      },
      {
        name: "GE-Launch",
        content: [
          "---",
          "title: Launch",
          "status: to-do",
          "priority: high",
          "scheduled: 2026-04-22",
          "due: 2026-04-28",
          "projects:",
          "  - Website Launch",
          "finishAfterStart:",
          '  - "[[GE-Testing]]"',
          "---",
          "",
          "Deploy to production.",
          "",
          "**SF** via `finishAfterStart`: must finish after Testing starts."
        ].join("\n")
      },
      // ── Edge / stress cases ──────────────────────────────────────
      {
        name: "GE-Kickoff",
        content: [
          "---",
          "title: Kickoff Meeting",
          "status: done",
          "priority: high",
          "scheduled: 2026-04-01",
          "projects:",
          "  - Website Launch",
          "---",
          "",
          "**Milestone** \u2014 only a start date, no end date, no timeEstimate.",
          "Should render as a diamond rather than a bar."
        ].join("\n")
      },
      {
        name: "GE-DeadlineOnly",
        content: [
          "---",
          "title: Stakeholder Review",
          "status: to-do",
          "priority: medium",
          "due: 2026-04-15",
          "projects:",
          "  - Website Launch",
          "blockedBy:",
          '  - "[[GE-Design]]"',
          "---",
          "",
          "**Edge case** \u2014 only a due date, no scheduled.",
          "Should fall back to a 1-day bar ending on the due date.",
          "Also shares a dependency with Development (both blocked by Design)."
        ].join("\n")
      },
      {
        name: "GE-ReversedDates",
        content: [
          "---",
          "title: Reversed Dates Task",
          "status: to-do",
          "priority: low",
          "scheduled: 2026-04-28",
          "due: 2026-04-01",
          "projects:",
          "  - Website Launch",
          "blockedBy:",
          '  - "[[GE-Development]]"',
          "---",
          "",
          "**Edge case + violation** \u2014 scheduled is AFTER due (reversed dates),",
          "AND start is before Development finishes \u2014 triggers a schedule violation.",
          "Bar width must not go negative."
        ].join("\n")
      },
      {
        name: "GE-BrokenDep",
        content: [
          "---",
          "title: Broken Dependency",
          "status: to-do",
          "priority: low",
          "scheduled: 2026-04-10",
          "due: 2026-04-14",
          "projects:",
          "  - Website Launch",
          "blockedBy:",
          '  - "[[GE-Development]]"',
          '  - "[[GE-DoesNotExist]]"',
          "---",
          "",
          "**Edge case** \u2014 one valid dep (Development) and one referencing a note",
          "not in the dataset. Valid arrow should draw; broken one should not crash.",
          "Also shares Development as a dependency with ReversedDates \u2014 tests",
          "multiple tasks fanning out from the same predecessor."
        ].join("\n")
      },
      {
        name: "GE-LongTitle",
        content: [
          "---",
          "title: This Task Has An Extremely Long Title That Should Truncate Gracefully In The Sidebar And On The Bar Without Breaking Layout",
          "status: in-progress",
          "priority: medium",
          "scheduled: 2026-04-05",
          "due: 2026-04-20",
          "projects:",
          "  - Website Launch",
          "syncStart:",
          '  - "[[GE-Development]]"',
          "---",
          "",
          "**Edge case** \u2014 very long title, plus SS dep on Development.",
          "Starts before Development starts \u2014 triggers an SS schedule violation.",
          "Should truncate with ellipsis in sidebar and bar label."
        ].join("\n")
      },
      // ── Additional violation cases ───────────────────────────────────────
      {
        name: "GE-Reporting",
        content: [
          "---",
          "title: Reporting",
          "status: to-do",
          "priority: medium",
          "scheduled: 2026-04-14",
          "due: 2026-04-17",
          "projects:",
          "  - Website Launch",
          "syncFinish:",
          '  - "[[GE-Development]]"',
          "---",
          "",
          "**FF violation** \u2014 must finish when Development finishes (Apr 21),",
          "but due Apr 17. Fix should move due to Apr 21."
        ].join("\n")
      },
      {
        name: "GE-Training",
        content: [
          "---",
          "title: Training",
          "status: to-do",
          "priority: low",
          "scheduled: 2026-04-01",
          "due: 2026-04-05",
          "projects:",
          "  - Website Launch",
          "finishAfterStart:",
          '  - "[[GE-Testing]]"',
          "---",
          "",
          "**SF violation** \u2014 must finish after Testing starts (Apr 8),",
          "but due Apr 5. Fix should move due to Apr 8."
        ].join("\n")
      },
      {
        name: "GE-Handoff",
        content: [
          "---",
          "title: Client Handoff",
          "status: to-do",
          "priority: high",
          "scheduled: 2026-04-15",
          "due: 2026-04-18",
          "projects:",
          "  - Website Launch",
          "blockedBy:",
          '  - "[[GE-Testing]]"',
          '  - "[[GE-Documentation]]"',
          "---",
          "",
          "**Multi-dep FS violation** \u2014 blocked by both Testing (Apr 8\u201328)",
          "and Documentation (Apr 14\u201321). Start Apr 15 is after Documentation",
          "finishes (Apr 21) but before Testing finishes (Apr 28) \u2014 one",
          "violated, one OK. Fix should move start to Apr 28."
        ].join("\n")
      },
      {
        name: "GE-SignOff",
        content: [
          "---",
          "title: Sign-off",
          "status: to-do",
          "priority: high",
          "scheduled: 2026-04-20",
          "due: 2026-04-22",
          "projects:",
          "  - Website Launch",
          "blockedBy:",
          '  - "[[GE-Handoff]]"',
          "---",
          "",
          "**Cascading FS violation** \u2014 depends on Handoff, which itself",
          "has a violation. Start Apr 20 is before Handoff finishes Apr 18\u2014",
          "wait, Handoff ends Apr 18 so this one is actually fine on its own.",
          "But once Handoff is fixed to start Apr 28, Sign-off will also",
          "need updating. Tests cascading fix behavior."
        ].join("\n")
      }
    ];
    const baseContent = [
      "views:",
      "  - type: gantt",
      "    name: Website Launch",
      "    filters:",
      "      and:",
      `        - file.folder == "${folderPath}"`,
      "    order:",
      "      - title",
      "      - status",
      "      - priority",
      "      - scheduled",
      "      - due",
      "      - blockedBy",
      "      - syncStart",
      "      - syncFinish",
      "      - finishAfterStart",
      ""
    ].join("\n");
    const allFiles = [
      ...notes.map((n) => ({ path: `${folderPath}/${n.name}.md`, content: n.content })),
      { path: `${folderPath}/gantt-examples.base`, content: baseContent }
    ];
    let created = 0;
    let skipped = 0;
    for (const file of allFiles) {
      if (vault.getAbstractFileByPath(file.path)) {
        skipped++;
      } else {
        await vault.create(file.path, file.content);
        created++;
      }
    }
    if (created > 0) {
      new import_obsidian3.Notice(`Created ${created} file${created > 1 ? "s" : ""} in "${folderPath}/"${skipped > 0 ? ` (${skipped} already existed)` : ""}`);
    } else {
      new import_obsidian3.Notice(`All example files already exist in "${folderPath}/"`);
    }
  }
};
