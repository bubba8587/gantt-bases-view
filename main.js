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
var DEFAULT_STATUS_OPTIONS = ["to-do", "in-progress", "done", "blocked"];
var DEFAULT_PRIORITY_OPTIONS = ["low", "medium", "high"];
var DEFAULT_PLUGIN_SETTINGS = {
  startDateProp: "scheduled",
  endDateProp: "due",
  statusOptions: DEFAULT_STATUS_OPTIONS,
  priorityOptions: DEFAULT_PRIORITY_OPTIONS,
  statusColors: {},
  priorityColors: {}
};

// src/field-mapping.ts
function readSettings(config, pluginSettings) {
  const startProp = pluginSettings?.startDateProp || DEFAULT_PLUGIN_SETTINGS.startDateProp;
  const endProp = pluginSettings?.endDateProp || DEFAULT_PLUGIN_SETTINGS.endDateProp;
  return {
    startDateProp: `note.${startProp}`,
    endDateProp: `note.${endProp}`,
    zoom: config.get("zoom") ?? "week",
    colorBy: "none",
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
  const str = String(value).trim();
  if (str === "null" || str === "undefined") return "";
  return str;
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
function getBarColor(task, colorBy, pluginSettings) {
  if (colorBy === "status") {
    return STATUS_COLORS[task.status] ?? pluginSettings?.statusColors?.[task.status] ?? pluginSettings?.statusColors?.[Object.keys(pluginSettings.statusColors).find((k) => k.toLowerCase() === task.status.toLowerCase()) ?? ""] ?? DEFAULT_BAR_COLOR;
  }
  if (colorBy === "priority") {
    return PRIORITY_COLORS[task.priority] ?? pluginSettings?.priorityColors?.[task.priority] ?? pluginSettings?.priorityColors?.[Object.keys(pluginSettings.priorityColors).find((k) => k.toLowerCase() === task.priority.toLowerCase()) ?? ""] ?? DEFAULT_BAR_COLOR;
  }
  return DEFAULT_BAR_COLOR;
}

// src/task-bar.ts
function createTaskBar(task, bounds, colorBy, showPriority = true, pluginSettings) {
  if (task.isMilestone) {
    return createMilestoneDiamond(task, bounds, colorBy, pluginSettings);
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
  if (colorBy !== "none") {
    const color = getBarColor(task, colorBy, pluginSettings);
    bar.style.background = `color-mix(in srgb, ${color} 25%, var(--background-secondary))`;
    bar.style.borderColor = `color-mix(in srgb, ${color} 40%, var(--background-modifier-border))`;
  }
  if (bounds.width >= MIN_BAR_LABEL_WIDTH) {
    if (showPriority) {
      const dot = document.createElement("div");
      dot.className = "gbv-priority-dot";
      if (task.priority) dot.dataset.priority = task.priority;
      bar.appendChild(dot);
    }
    const label = document.createElement("span");
    label.className = "gbv-bar-label";
    label.textContent = task.title || task.file.basename;
    bar.appendChild(label);
  }
  if (task.completedDate && task.startDate) {
    const marker = createCompletedMarker(task, bounds);
    if (marker) bar.appendChild(marker);
  }
  return bar;
}
function createMilestoneDiamond(task, bounds, colorBy, pluginSettings) {
  const size = 14;
  const el = document.createElement("div");
  el.className = "gbv-milestone";
  el.dataset.taskId = task.id;
  if (task.status === "done") el.classList.add("gbv-bar--done");
  el.style.left = `${bounds.left - size / 2}px`;
  el.style.top = `${Math.round((ROW_HEIGHT - size) / 2)}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.backgroundColor = getBarColor(task, colorBy, pluginSettings);
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
  text.textContent = task.title || task.file.basename;
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
    this._onSelect = onSelect;
  }
  getSuggestions(query) {
    const lower = query.toLowerCase();
    return this.app.vault.getMarkdownFiles().filter((f) => f.basename.toLowerCase().includes(lower)).slice(0, 20);
  }
  renderSuggestion(file, el) {
    el.setText(file.basename);
  }
  selectSuggestion(file) {
    this._onSelect(file);
    this.setValue("");
    this.close();
  }
};
function getPropertyOptions(app, propertyName, settingsOptions, currentValue) {
  const base = [...settingsOptions];
  const baseLower = new Set(base.map((s) => s.toLowerCase()));
  const metaOpts = app.metadataTypeManager?.properties?.[propertyName]?.options;
  if (metaOpts && metaOpts.length > 0) {
    for (const opt of metaOpts) {
      if (!baseLower.has(opt.toLowerCase())) {
        base.push(opt);
        baseLower.add(opt.toLowerCase());
      }
    }
  }
  if (currentValue && !baseLower.has(currentValue.toLowerCase())) {
    base.push(currentValue);
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
    if (opt.toLowerCase() === current.toLowerCase()) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}
function openPopupEditor(task, anchorEl, app, onUpdate, pluginSettings) {
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
  const statusFallback = pluginSettings?.statusOptions ?? DEFAULT_PLUGIN_SETTINGS.statusOptions;
  const statusOptions = getPropertyOptions(app, "status", statusFallback, task.status);
  const statusSel = createSelect(statusOptions, task.status || statusOptions[0]);
  const priorityFallback = pluginSettings?.priorityOptions ?? DEFAULT_PLUGIN_SETTINGS.priorityOptions;
  const priorityOptions = getPropertyOptions(app, "priority", priorityFallback, task.priority);
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
    const startKey = pluginSettings?.startDateProp || DEFAULT_PLUGIN_SETTINGS.startDateProp;
    const endKey = pluginSettings?.endDateProp || DEFAULT_PLUGIN_SETTINGS.endDateProp;
    await app.fileManager.processFrontMatter(task.file, (fm) => {
      if (newStart) {
        fm[startKey] = newStart;
      } else {
        delete fm[startKey];
      }
      if (newEnd) {
        fm[endKey] = newEnd;
      } else {
        delete fm[endKey];
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
async function applyViolationFix(app, violation, pluginSettings) {
  const { targetTask, fixField, suggestedDate } = violation;
  const dateStr = formatDate(suggestedDate);
  const startKey = pluginSettings?.startDateProp || DEFAULT_PLUGIN_SETTINGS.startDateProp;
  const endKey = pluginSettings?.endDateProp || DEFAULT_PLUGIN_SETTINGS.endDateProp;
  const frontmatterKey = fixField === "start" ? startKey : endKey;
  await app.fileManager.processFrontMatter(
    targetTask.file,
    (fm) => {
      fm[frontmatterKey] = dateStr;
    }
  );
}
function openViolationPanel(violations, app, onUpdate, pluginSettings) {
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
      await applyViolationFix(app, violation, pluginSettings);
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
        await applyViolationFix(app, v, pluginSettings);
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
var COLOR_BY_OPTIONS = ["none", "status", "priority"];
var COLOR_BY_LABELS = { none: "No color", status: "Status", priority: "Priority" };
var GanttView = class extends import_obsidian2.BasesView {
  constructor(controller, containerEl, plugin) {
    super(controller);
    this.type = "gantt";
    this._localZoom = null;
    // overrides config zoom when set
    this._localColorBy = "none";
    // toolbar-driven bar coloring
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
    const settings = readSettings(config, this.plugin.settings);
    if (this._localZoom) settings.zoom = this._localZoom;
    settings.colorBy = this._localColorBy;
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
    const colorByLabel = toolbar.createEl("span", { text: "Color:", cls: "gbv-toolbar-label" });
    const colorBySelect = toolbar.createEl("select", { cls: "gbv-toolbar-select" });
    for (const opt of COLOR_BY_OPTIONS) {
      const o = colorBySelect.createEl("option", { text: COLOR_BY_LABELS[opt] });
      o.value = opt;
      if (opt === this._localColorBy) o.selected = true;
    }
    colorBySelect.addEventListener("change", () => {
      this._localColorBy = colorBySelect.value;
      this._render();
    });
    toolbar.createEl("div", { cls: "gbv-toolbar-separator" });
    const violationBtn = toolbar.createEl("button", {
      text: violations.length > 0 ? `\u26A0 Fix Schedule (${violations.length})` : "\u2713 Schedule OK",
      cls: violations.length > 0 ? "gbv-btn gbv-btn--warn" : "gbv-btn gbv-btn--ok"
    });
    if (violations.length > 0) {
      violationBtn.addEventListener("click", () => {
        openViolationPanel(violations, this.app, () => this._render(), this.plugin.settings);
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
          openPopupEditor(task, labelEl, this.app, () => this._render(), this.plugin.settings);
        });
        sidebarInner.appendChild(labelEl);
        const barRowEl = barsArea.createEl("div", { cls: "gbv-bar-row" });
        if (isAlt) barRowEl.classList.add("gbv-bar-row--alt");
        barRowEl.style.width = `${totalWidth}px`;
        rowIndex++;
        const bounds = getTaskBarBounds(task, timelineConfig);
        if (bounds) {
          const barEl = createTaskBar(task, bounds, settings.colorBy, settings.showPriority, this.plugin.settings);
          barRowEl.appendChild(barEl);
          barEl.addEventListener("click", (e) => {
            e.stopPropagation();
            openPopupEditor(task, barEl, this.app, () => this._render(), this.plugin.settings);
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
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_PLUGIN_SETTINGS };
  }
  async onload() {
    await this.loadSettings();
    this.registerBasesView("gantt", {
      name: "Gantt",
      icon: "bar-chart-horizontal",
      factory: (controller, containerEl) => new GanttView(controller, containerEl, this),
      options: (config) => getViewOptions(config)
    });
    this.addSettingTab(new GanttSettingsTab(this.app, this));
  }
  onunload() {
  }
  async loadSettings() {
    const data = await this.loadData();
    if (data) {
      this.settings = { ...DEFAULT_PLUGIN_SETTINGS, ...data };
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
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
    containerEl.createEl("h3", { text: "Property mapping" });
    new import_obsidian3.Setting(containerEl).setName("Start date property").setDesc("Frontmatter property used for the task start date.").addText((text) => {
      text.setPlaceholder("scheduled").setValue(this.plugin.settings.startDateProp).onChange(async (value) => {
        this.plugin.settings.startDateProp = value.trim() || DEFAULT_PLUGIN_SETTINGS.startDateProp;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian3.Setting(containerEl).setName("End date property").setDesc("Frontmatter property used for the task end date.").addText((text) => {
      text.setPlaceholder("due").setValue(this.plugin.settings.endDateProp).onChange(async (value) => {
        this.plugin.settings.endDateProp = value.trim() || DEFAULT_PLUGIN_SETTINGS.endDateProp;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Status & priority options" });
    const statusSetting = new import_obsidian3.Setting(containerEl).setName("Status options").setDesc("Comma-separated list of status values for the dropdown.").addText((text) => {
      text.setPlaceholder(DEFAULT_STATUS_OPTIONS.join(", ")).setValue(this.plugin.settings.statusOptions.join(", ")).onChange(async (value) => {
        const parsed = value.split(",").map((s) => s.trim()).filter(Boolean);
        this.plugin.settings.statusOptions = parsed.length > 0 ? parsed : DEFAULT_STATUS_OPTIONS;
        await this.plugin.saveSettings();
      });
      text.inputEl.style.width = "100%";
    });
    const prioritySetting = new import_obsidian3.Setting(containerEl).setName("Priority options").setDesc("Comma-separated list of priority values for the dropdown.").addText((text) => {
      text.setPlaceholder(DEFAULT_PRIORITY_OPTIONS.join(", ")).setValue(this.plugin.settings.priorityOptions.join(", ")).onChange(async (value) => {
        const parsed = value.split(",").map((s) => s.trim()).filter(Boolean);
        this.plugin.settings.priorityOptions = parsed.length > 0 ? parsed : DEFAULT_PRIORITY_OPTIONS;
        await this.plugin.saveSettings();
      });
      text.inputEl.style.width = "100%";
    });
    new import_obsidian3.Setting(containerEl).setName("Sync from TaskNotes").setDesc("Import status and priority options from the TaskNotes plugin.").addButton((btn) => {
      btn.setButtonText("Sync").onClick(async () => {
        const synced = this.syncFromTasknotes();
        if (synced) {
          await this.plugin.saveSettings();
          this.display();
        }
      });
    });
    containerEl.createEl("h3", { text: "Examples" });
    new import_obsidian3.Setting(containerEl).setName("Create example notes").setDesc('Creates a small set of linked notes in your vault demonstrating all four dependency types (FS, SS, FF, SF). Notes are placed in a "Gantt Examples" folder.').addButton((btn) => {
      btn.setButtonText("Create examples").setCta().onClick(() => this.createExampleNotes());
    });
  }
  syncFromTasknotes() {
    const tasknotes = this.app.plugins?.plugins?.["tasknotes"];
    if (!tasknotes) {
      new import_obsidian3.Notice("TaskNotes plugin not found. Is it installed and enabled?");
      return false;
    }
    const data = tasknotes.settings ?? tasknotes.data;
    if (!data) {
      new import_obsidian3.Notice("Could not read TaskNotes settings.");
      return false;
    }
    let synced = false;
    if (Array.isArray(data.customStatuses) && data.customStatuses.length > 0) {
      this.plugin.settings.statusOptions = data.customStatuses.map(
        (s) => s.value
      );
      const colors = {};
      for (const s of data.customStatuses) {
        if (s.value && s.color) colors[s.value.toLowerCase()] = s.color;
      }
      this.plugin.settings.statusColors = colors;
      synced = true;
    }
    if (Array.isArray(data.customPriorities) && data.customPriorities.length > 0) {
      this.plugin.settings.priorityOptions = data.customPriorities.map(
        (p) => p.value
      );
      const colors = {};
      for (const p of data.customPriorities) {
        if (p.value && p.color) colors[p.value.toLowerCase()] = p.color;
      }
      this.plugin.settings.priorityColors = colors;
      synced = true;
    }
    if (synced) {
      new import_obsidian3.Notice("Synced status, priority, and colors from TaskNotes.");
    } else {
      new import_obsidian3.Notice("No custom statuses or priorities found in TaskNotes.");
    }
    return synced;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2dhbnR0LXZpZXcudHMiLCAic3JjL3R5cGVzLnRzIiwgInNyYy9maWVsZC1tYXBwaW5nLnRzIiwgInNyYy90aW1lbGluZS50cyIsICJzcmMvcmVuZGVyZXIudHMiLCAic3JjL2NvbG9ycy50cyIsICJzcmMvdGFzay1iYXIudHMiLCAic3JjL2RlcGVuZGVuY2llcy50cyIsICJzcmMvcG9wdXAtZWRpdG9yLnRzIiwgInNyYy9leHBvcnQudHMiLCAic3JjL3Zpb2xhdGlvbnMudHMiLCAic3JjL29wdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgQXBwLCBTZXR0aW5nLCBOb3RpY2UsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XHJcbmltcG9ydCB7IEdhbnR0VmlldyB9IGZyb20gJy4vZ2FudHQtdmlldy50cyc7XHJcbmltcG9ydCB7IGdldFZpZXdPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zLnRzJztcclxuaW1wb3J0IHR5cGUgeyBQbHVnaW5TZXR0aW5ncyB9IGZyb20gJy4vdHlwZXMudHMnO1xyXG5pbXBvcnQgeyBERUZBVUxUX1BMVUdJTl9TRVRUSU5HUywgREVGQVVMVF9TVEFUVVNfT1BUSU9OUywgREVGQVVMVF9QUklPUklUWV9PUFRJT05TIH0gZnJvbSAnLi90eXBlcy50cyc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBHYW50dEJhc2VzVmlld1BsdWdpbiBleHRlbmRzIFBsdWdpbiB7XHJcblx0c2V0dGluZ3M6IFBsdWdpblNldHRpbmdzID0geyAuLi5ERUZBVUxUX1BMVUdJTl9TRVRUSU5HUyB9O1xyXG5cclxuXHRhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XHJcblx0XHRhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG5cclxuXHRcdHRoaXMucmVnaXN0ZXJCYXNlc1ZpZXcoJ2dhbnR0Jywge1xyXG5cdFx0XHRuYW1lOiAnR2FudHQnLFxyXG5cdFx0XHRpY29uOiAnYmFyLWNoYXJ0LWhvcml6b250YWwnLFxyXG5cdFx0XHRmYWN0b3J5OiAoY29udHJvbGxlciwgY29udGFpbmVyRWwpID0+IG5ldyBHYW50dFZpZXcoY29udHJvbGxlciwgY29udGFpbmVyRWwsIHRoaXMpLFxyXG5cdFx0XHRvcHRpb25zOiAoY29uZmlnKSA9PiBnZXRWaWV3T3B0aW9ucyhjb25maWcpLFxyXG5cdFx0fSk7XHJcblx0XHR0aGlzLmFkZFNldHRpbmdUYWIobmV3IEdhbnR0U2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHR9XHJcblxyXG5cdG9udW5sb2FkKCk6IHZvaWQge31cclxuXHJcblx0YXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xyXG5cdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcclxuXHRcdGlmIChkYXRhKSB7XHJcblx0XHRcdHRoaXMuc2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfUExVR0lOX1NFVFRJTkdTLCAuLi5kYXRhIH07XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XHJcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgR2FudHRTZXR0aW5nc1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogR2FudHRCYXNlc1ZpZXdQbHVnaW4pIHtcclxuXHRcdHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuXHR9XHJcblxyXG5cdGRpc3BsYXkoKTogdm9pZCB7XHJcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG5cdFx0Y29udGFpbmVyRWwuZW1wdHkoKTtcclxuXHJcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdQcm9wZXJ0eSBtYXBwaW5nJyB9KTtcclxuXHJcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuXHRcdFx0LnNldE5hbWUoJ1N0YXJ0IGRhdGUgcHJvcGVydHknKVxyXG5cdFx0XHQuc2V0RGVzYygnRnJvbnRtYXR0ZXIgcHJvcGVydHkgdXNlZCBmb3IgdGhlIHRhc2sgc3RhcnQgZGF0ZS4nKVxyXG5cdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHtcclxuXHRcdFx0XHR0ZXh0LnNldFBsYWNlaG9sZGVyKCdzY2hlZHVsZWQnKVxyXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnN0YXJ0RGF0ZVByb3ApXHJcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnN0YXJ0RGF0ZVByb3AgPSB2YWx1ZS50cmltKCkgfHwgREVGQVVMVF9QTFVHSU5fU0VUVElOR1Muc3RhcnREYXRlUHJvcDtcclxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcblx0XHRcdC5zZXROYW1lKCdFbmQgZGF0ZSBwcm9wZXJ0eScpXHJcblx0XHRcdC5zZXREZXNjKCdGcm9udG1hdHRlciBwcm9wZXJ0eSB1c2VkIGZvciB0aGUgdGFzayBlbmQgZGF0ZS4nKVxyXG5cdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHtcclxuXHRcdFx0XHR0ZXh0LnNldFBsYWNlaG9sZGVyKCdkdWUnKVxyXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuZERhdGVQcm9wKVxyXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmREYXRlUHJvcCA9IHZhbHVlLnRyaW0oKSB8fCBERUZBVUxUX1BMVUdJTl9TRVRUSU5HUy5lbmREYXRlUHJvcDtcclxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnU3RhdHVzICYgcHJpb3JpdHkgb3B0aW9ucycgfSk7XHJcblxyXG5cdFx0Y29uc3Qgc3RhdHVzU2V0dGluZyA9IG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnU3RhdHVzIG9wdGlvbnMnKVxyXG5cdFx0XHQuc2V0RGVzYygnQ29tbWEtc2VwYXJhdGVkIGxpc3Qgb2Ygc3RhdHVzIHZhbHVlcyBmb3IgdGhlIGRyb3Bkb3duLicpXHJcblx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xyXG5cdFx0XHRcdHRleHQuc2V0UGxhY2Vob2xkZXIoREVGQVVMVF9TVEFUVVNfT1BUSU9OUy5qb2luKCcsICcpKVxyXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnN0YXR1c09wdGlvbnMuam9pbignLCAnKSlcclxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgcGFyc2VkID0gdmFsdWUuc3BsaXQoJywnKS5tYXAocyA9PiBzLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5zdGF0dXNPcHRpb25zID0gcGFyc2VkLmxlbmd0aCA+IDAgPyBwYXJzZWQgOiBERUZBVUxUX1NUQVRVU19PUFRJT05TO1xyXG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdHRleHQuaW5wdXRFbC5zdHlsZS53aWR0aCA9ICcxMDAlJztcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0Y29uc3QgcHJpb3JpdHlTZXR0aW5nID0gbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcblx0XHRcdC5zZXROYW1lKCdQcmlvcml0eSBvcHRpb25zJylcclxuXHRcdFx0LnNldERlc2MoJ0NvbW1hLXNlcGFyYXRlZCBsaXN0IG9mIHByaW9yaXR5IHZhbHVlcyBmb3IgdGhlIGRyb3Bkb3duLicpXHJcblx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xyXG5cdFx0XHRcdHRleHQuc2V0UGxhY2Vob2xkZXIoREVGQVVMVF9QUklPUklUWV9PUFRJT05TLmpvaW4oJywgJykpXHJcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucHJpb3JpdHlPcHRpb25zLmpvaW4oJywgJykpXHJcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHBhcnNlZCA9IHZhbHVlLnNwbGl0KCcsJykubWFwKHMgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MucHJpb3JpdHlPcHRpb25zID0gcGFyc2VkLmxlbmd0aCA+IDAgPyBwYXJzZWQgOiBERUZBVUxUX1BSSU9SSVRZX09QVElPTlM7XHJcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0dGV4dC5pbnB1dEVsLnN0eWxlLndpZHRoID0gJzEwMCUnO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuXHRcdFx0LnNldE5hbWUoJ1N5bmMgZnJvbSBUYXNrTm90ZXMnKVxyXG5cdFx0XHQuc2V0RGVzYygnSW1wb3J0IHN0YXR1cyBhbmQgcHJpb3JpdHkgb3B0aW9ucyBmcm9tIHRoZSBUYXNrTm90ZXMgcGx1Z2luLicpXHJcblx0XHRcdC5hZGRCdXR0b24oYnRuID0+IHtcclxuXHRcdFx0XHRidG4uc2V0QnV0dG9uVGV4dCgnU3luYycpXHJcblx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHN5bmNlZCA9IHRoaXMuc3luY0Zyb21UYXNrbm90ZXMoKTtcclxuXHRcdFx0XHRcdFx0aWYgKHN5bmNlZCkge1xyXG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpOyAvLyByZWZyZXNoIFVJIHRvIHNob3cgbmV3IHZhbHVlc1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnRXhhbXBsZXMnIH0pO1xyXG5cclxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnQ3JlYXRlIGV4YW1wbGUgbm90ZXMnKVxyXG5cdFx0XHQuc2V0RGVzYygnQ3JlYXRlcyBhIHNtYWxsIHNldCBvZiBsaW5rZWQgbm90ZXMgaW4geW91ciB2YXVsdCBkZW1vbnN0cmF0aW5nIGFsbCBmb3VyIGRlcGVuZGVuY3kgdHlwZXMgKEZTLCBTUywgRkYsIFNGKS4gTm90ZXMgYXJlIHBsYWNlZCBpbiBhIFwiR2FudHQgRXhhbXBsZXNcIiBmb2xkZXIuJylcclxuXHRcdFx0LmFkZEJ1dHRvbihidG4gPT4ge1xyXG5cdFx0XHRcdGJ0bi5zZXRCdXR0b25UZXh0KCdDcmVhdGUgZXhhbXBsZXMnKVxyXG5cdFx0XHRcdFx0LnNldEN0YSgpXHJcblx0XHRcdFx0XHQub25DbGljaygoKSA9PiB0aGlzLmNyZWF0ZUV4YW1wbGVOb3RlcygpKTtcclxuXHRcdFx0fSk7XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIHN5bmNGcm9tVGFza25vdGVzKCk6IGJvb2xlYW4ge1xyXG5cdFx0Y29uc3QgdGFza25vdGVzID0gKHRoaXMuYXBwIGFzIGFueSkucGx1Z2lucz8ucGx1Z2lucz8uWyd0YXNrbm90ZXMnXTtcclxuXHRcdGlmICghdGFza25vdGVzKSB7XHJcblx0XHRcdG5ldyBOb3RpY2UoJ1Rhc2tOb3RlcyBwbHVnaW4gbm90IGZvdW5kLiBJcyBpdCBpbnN0YWxsZWQgYW5kIGVuYWJsZWQ/Jyk7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBkYXRhID0gdGFza25vdGVzLnNldHRpbmdzID8/IHRhc2tub3Rlcy5kYXRhO1xyXG5cdFx0aWYgKCFkYXRhKSB7XHJcblx0XHRcdG5ldyBOb3RpY2UoJ0NvdWxkIG5vdCByZWFkIFRhc2tOb3RlcyBzZXR0aW5ncy4nKTtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCBzeW5jZWQgPSBmYWxzZTtcclxuXHJcblx0XHRpZiAoQXJyYXkuaXNBcnJheShkYXRhLmN1c3RvbVN0YXR1c2VzKSAmJiBkYXRhLmN1c3RvbVN0YXR1c2VzLmxlbmd0aCA+IDApIHtcclxuXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Muc3RhdHVzT3B0aW9ucyA9IGRhdGEuY3VzdG9tU3RhdHVzZXMubWFwKFxyXG5cdFx0XHRcdChzOiB7IHZhbHVlOiBzdHJpbmcgfSkgPT4gcy52YWx1ZSxcclxuXHRcdFx0KTtcclxuXHRcdFx0Y29uc3QgY29sb3JzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XHJcblx0XHRcdGZvciAoY29uc3QgcyBvZiBkYXRhLmN1c3RvbVN0YXR1c2VzKSB7XHJcblx0XHRcdFx0aWYgKHMudmFsdWUgJiYgcy5jb2xvcikgY29sb3JzW3MudmFsdWUudG9Mb3dlckNhc2UoKV0gPSBzLmNvbG9yO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnN0YXR1c0NvbG9ycyA9IGNvbG9ycztcclxuXHRcdFx0c3luY2VkID0gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoQXJyYXkuaXNBcnJheShkYXRhLmN1c3RvbVByaW9yaXRpZXMpICYmIGRhdGEuY3VzdG9tUHJpb3JpdGllcy5sZW5ndGggPiAwKSB7XHJcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnByaW9yaXR5T3B0aW9ucyA9IGRhdGEuY3VzdG9tUHJpb3JpdGllcy5tYXAoXHJcblx0XHRcdFx0KHA6IHsgdmFsdWU6IHN0cmluZyB9KSA9PiBwLnZhbHVlLFxyXG5cdFx0XHQpO1xyXG5cdFx0XHRjb25zdCBjb2xvcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcclxuXHRcdFx0Zm9yIChjb25zdCBwIG9mIGRhdGEuY3VzdG9tUHJpb3JpdGllcykge1xyXG5cdFx0XHRcdGlmIChwLnZhbHVlICYmIHAuY29sb3IpIGNvbG9yc1twLnZhbHVlLnRvTG93ZXJDYXNlKCldID0gcC5jb2xvcjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcmlvcml0eUNvbG9ycyA9IGNvbG9ycztcclxuXHRcdFx0c3luY2VkID0gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoc3luY2VkKSB7XHJcblx0XHRcdG5ldyBOb3RpY2UoJ1N5bmNlZCBzdGF0dXMsIHByaW9yaXR5LCBhbmQgY29sb3JzIGZyb20gVGFza05vdGVzLicpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bmV3IE5vdGljZSgnTm8gY3VzdG9tIHN0YXR1c2VzIG9yIHByaW9yaXRpZXMgZm91bmQgaW4gVGFza05vdGVzLicpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBzeW5jZWQ7XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIGFzeW5jIGNyZWF0ZUV4YW1wbGVOb3RlcygpOiBQcm9taXNlPHZvaWQ+IHtcclxuXHRcdGNvbnN0IHZhdWx0ID0gdGhpcy5hcHAudmF1bHQ7XHJcblx0XHRjb25zdCBmb2xkZXJQYXRoID0gJ0dhbnR0IEV4YW1wbGVzJztcclxuXHJcblx0XHQvLyBDcmVhdGUgZm9sZGVyIGlmIGl0IGRvZXNuJ3QgZXhpc3RcclxuXHRcdGlmICghdmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlclBhdGgpKSB7XHJcblx0XHRcdGF3YWl0IHZhdWx0LmNyZWF0ZUZvbGRlcihmb2xkZXJQYXRoKTtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBub3RlczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGNvbnRlbnQ6IHN0cmluZyB9PiA9IFtcclxuXHRcdFx0e1xyXG5cdFx0XHRcdG5hbWU6ICdHRS1EZXNpZ24nLFxyXG5cdFx0XHRcdGNvbnRlbnQ6IFtcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0J3RpdGxlOiBEZXNpZ24nLFxyXG5cdFx0XHRcdFx0J3N0YXR1czogZG9uZScsXHJcblx0XHRcdFx0XHQncHJpb3JpdHk6IGhpZ2gnLFxyXG5cdFx0XHRcdFx0J3NjaGVkdWxlZDogMjAyNi0wNC0wMScsXHJcblx0XHRcdFx0XHQnZHVlOiAyMDI2LTA0LTA3JyxcclxuXHRcdFx0XHRcdCdwcm9qZWN0czonLFxyXG5cdFx0XHRcdFx0JyAgLSBXZWJzaXRlIExhdW5jaCcsXHJcblx0XHRcdFx0XHQnLS0tJyxcclxuXHRcdFx0XHRcdCcnLFxyXG5cdFx0XHRcdFx0J1VJL1VYIGRlc2lnbiBhbmQgd2lyZWZyYW1lcy4nLFxyXG5cdFx0XHRcdFx0J05vIGRlcGVuZGVuY2llcyBcdTIwMTQgdGhpcyBpcyB0aGUgZmlyc3QgdGFzay4nLFxyXG5cdFx0XHRcdF0uam9pbignXFxuJyksXHJcblx0XHRcdH0sXHJcblx0XHRcdHtcclxuXHRcdFx0XHRuYW1lOiAnR0UtRGV2ZWxvcG1lbnQnLFxyXG5cdFx0XHRcdGNvbnRlbnQ6IFtcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0J3RpdGxlOiBEZXZlbG9wbWVudCcsXHJcblx0XHRcdFx0XHQnc3RhdHVzOiBpbi1wcm9ncmVzcycsXHJcblx0XHRcdFx0XHQncHJpb3JpdHk6IGhpZ2gnLFxyXG5cdFx0XHRcdFx0J3NjaGVkdWxlZDogMjAyNi0wNC0wOCcsXHJcblx0XHRcdFx0XHQnZHVlOiAyMDI2LTA0LTIxJyxcclxuXHRcdFx0XHRcdCdwcm9qZWN0czonLFxyXG5cdFx0XHRcdFx0JyAgLSBXZWJzaXRlIExhdW5jaCcsXHJcblx0XHRcdFx0XHQnYmxvY2tlZEJ5OicsXHJcblx0XHRcdFx0XHQnICAtIFwiW1tHRS1EZXNpZ25dXVwiJyxcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0JycsXHJcblx0XHRcdFx0XHQnQnVpbGQgdGhlIHNpdGUuJyxcclxuXHRcdFx0XHRcdCcnLFxyXG5cdFx0XHRcdFx0JyoqRlMqKiB2aWEgYGJsb2NrZWRCeWA6IHN0YXJ0cyBhZnRlciBEZXNpZ24gZmluaXNoZXMuJyxcclxuXHRcdFx0XHRdLmpvaW4oJ1xcbicpLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bmFtZTogJ0dFLVRlc3RpbmcnLFxyXG5cdFx0XHRcdGNvbnRlbnQ6IFtcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0J3RpdGxlOiBUZXN0aW5nJyxcclxuXHRcdFx0XHRcdCdzdGF0dXM6IHRvLWRvJyxcclxuXHRcdFx0XHRcdCdwcmlvcml0eTogbWVkaXVtJyxcclxuXHRcdFx0XHRcdCdzY2hlZHVsZWQ6IDIwMjYtMDQtMDgnLFxyXG5cdFx0XHRcdFx0J2R1ZTogMjAyNi0wNC0yOCcsXHJcblx0XHRcdFx0XHQncHJvamVjdHM6JyxcclxuXHRcdFx0XHRcdCcgIC0gV2Vic2l0ZSBMYXVuY2gnLFxyXG5cdFx0XHRcdFx0J3N5bmNTdGFydDonLFxyXG5cdFx0XHRcdFx0JyAgLSBcIltbR0UtRGV2ZWxvcG1lbnRdXVwiJyxcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0JycsXHJcblx0XHRcdFx0XHQnUUEgYW5kIHVzZXIgdGVzdGluZy4nLFxyXG5cdFx0XHRcdFx0JycsXHJcblx0XHRcdFx0XHQnKipTUyoqIHZpYSBgc3luY1N0YXJ0YDogc3RhcnRzIHdoZW4gRGV2ZWxvcG1lbnQgc3RhcnRzLicsXHJcblx0XHRcdFx0XS5qb2luKCdcXG4nKSxcclxuXHRcdFx0fSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdG5hbWU6ICdHRS1Eb2N1bWVudGF0aW9uJyxcclxuXHRcdFx0XHRjb250ZW50OiBbXHJcblx0XHRcdFx0XHQnLS0tJyxcclxuXHRcdFx0XHRcdCd0aXRsZTogRG9jdW1lbnRhdGlvbicsXHJcblx0XHRcdFx0XHQnc3RhdHVzOiB0by1kbycsXHJcblx0XHRcdFx0XHQncHJpb3JpdHk6IGxvdycsXHJcblx0XHRcdFx0XHQnc2NoZWR1bGVkOiAyMDI2LTA0LTE0JyxcclxuXHRcdFx0XHRcdCdkdWU6IDIwMjYtMDQtMjEnLFxyXG5cdFx0XHRcdFx0J3Byb2plY3RzOicsXHJcblx0XHRcdFx0XHQnICAtIFdlYnNpdGUgTGF1bmNoJyxcclxuXHRcdFx0XHRcdCdzeW5jRmluaXNoOicsXHJcblx0XHRcdFx0XHQnICAtIFwiW1tHRS1EZXZlbG9wbWVudF1dXCInLFxyXG5cdFx0XHRcdFx0Jy0tLScsXHJcblx0XHRcdFx0XHQnJyxcclxuXHRcdFx0XHRcdCdXcml0ZSB1c2VyIGFuZCBkZXZlbG9wZXIgZG9jcy4nLFxyXG5cdFx0XHRcdFx0JycsXHJcblx0XHRcdFx0XHQnKipGRioqIHZpYSBgc3luY0ZpbmlzaGA6IG11c3QgZmluaXNoIHdoZW4gRGV2ZWxvcG1lbnQgZmluaXNoZXMuJyxcclxuXHRcdFx0XHRdLmpvaW4oJ1xcbicpLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bmFtZTogJ0dFLUxhdW5jaCcsXHJcblx0XHRcdFx0Y29udGVudDogW1xyXG5cdFx0XHRcdFx0Jy0tLScsXHJcblx0XHRcdFx0XHQndGl0bGU6IExhdW5jaCcsXHJcblx0XHRcdFx0XHQnc3RhdHVzOiB0by1kbycsXHJcblx0XHRcdFx0XHQncHJpb3JpdHk6IGhpZ2gnLFxyXG5cdFx0XHRcdFx0J3NjaGVkdWxlZDogMjAyNi0wNC0yMicsXHJcblx0XHRcdFx0XHQnZHVlOiAyMDI2LTA0LTI4JyxcclxuXHRcdFx0XHRcdCdwcm9qZWN0czonLFxyXG5cdFx0XHRcdFx0JyAgLSBXZWJzaXRlIExhdW5jaCcsXHJcblx0XHRcdFx0XHQnZmluaXNoQWZ0ZXJTdGFydDonLFxyXG5cdFx0XHRcdFx0JyAgLSBcIltbR0UtVGVzdGluZ11dXCInLFxyXG5cdFx0XHRcdFx0Jy0tLScsXHJcblx0XHRcdFx0XHQnJyxcclxuXHRcdFx0XHRcdCdEZXBsb3kgdG8gcHJvZHVjdGlvbi4nLFxyXG5cdFx0XHRcdFx0JycsXHJcblx0XHRcdFx0XHQnKipTRioqIHZpYSBgZmluaXNoQWZ0ZXJTdGFydGA6IG11c3QgZmluaXNoIGFmdGVyIFRlc3Rpbmcgc3RhcnRzLicsXHJcblx0XHRcdFx0XS5qb2luKCdcXG4nKSxcclxuXHRcdFx0fSxcclxuXHRcdFx0Ly8gXHUyNTAwXHUyNTAwIEVkZ2UgLyBzdHJlc3MgY2FzZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcblx0XHRcdHtcclxuXHRcdFx0XHRuYW1lOiAnR0UtS2lja29mZicsXHJcblx0XHRcdFx0Y29udGVudDogW1xyXG5cdFx0XHRcdFx0Jy0tLScsXHJcblx0XHRcdFx0XHQndGl0bGU6IEtpY2tvZmYgTWVldGluZycsXHJcblx0XHRcdFx0XHQnc3RhdHVzOiBkb25lJyxcclxuXHRcdFx0XHRcdCdwcmlvcml0eTogaGlnaCcsXHJcblx0XHRcdFx0XHQnc2NoZWR1bGVkOiAyMDI2LTA0LTAxJyxcclxuXHRcdFx0XHRcdCdwcm9qZWN0czonLFxyXG5cdFx0XHRcdFx0JyAgLSBXZWJzaXRlIExhdW5jaCcsXHJcblx0XHRcdFx0XHQnLS0tJyxcclxuXHRcdFx0XHRcdCcnLFxyXG5cdFx0XHRcdFx0JyoqTWlsZXN0b25lKiogXHUyMDE0IG9ubHkgYSBzdGFydCBkYXRlLCBubyBlbmQgZGF0ZSwgbm8gdGltZUVzdGltYXRlLicsXHJcblx0XHRcdFx0XHQnU2hvdWxkIHJlbmRlciBhcyBhIGRpYW1vbmQgcmF0aGVyIHRoYW4gYSBiYXIuJyxcclxuXHRcdFx0XHRdLmpvaW4oJ1xcbicpLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bmFtZTogJ0dFLURlYWRsaW5lT25seScsXHJcblx0XHRcdFx0Y29udGVudDogW1xyXG5cdFx0XHRcdFx0Jy0tLScsXHJcblx0XHRcdFx0XHQndGl0bGU6IFN0YWtlaG9sZGVyIFJldmlldycsXHJcblx0XHRcdFx0XHQnc3RhdHVzOiB0by1kbycsXHJcblx0XHRcdFx0XHQncHJpb3JpdHk6IG1lZGl1bScsXHJcblx0XHRcdFx0XHQnZHVlOiAyMDI2LTA0LTE1JyxcclxuXHRcdFx0XHRcdCdwcm9qZWN0czonLFxyXG5cdFx0XHRcdFx0JyAgLSBXZWJzaXRlIExhdW5jaCcsXHJcblx0XHRcdFx0XHQnYmxvY2tlZEJ5OicsXHJcblx0XHRcdFx0XHQnICAtIFwiW1tHRS1EZXNpZ25dXVwiJyxcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0JycsXHJcblx0XHRcdFx0XHQnKipFZGdlIGNhc2UqKiBcdTIwMTQgb25seSBhIGR1ZSBkYXRlLCBubyBzY2hlZHVsZWQuJyxcclxuXHRcdFx0XHRcdCdTaG91bGQgZmFsbCBiYWNrIHRvIGEgMS1kYXkgYmFyIGVuZGluZyBvbiB0aGUgZHVlIGRhdGUuJyxcclxuXHRcdFx0XHRcdCdBbHNvIHNoYXJlcyBhIGRlcGVuZGVuY3kgd2l0aCBEZXZlbG9wbWVudCAoYm90aCBibG9ja2VkIGJ5IERlc2lnbikuJyxcclxuXHRcdFx0XHRdLmpvaW4oJ1xcbicpLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bmFtZTogJ0dFLVJldmVyc2VkRGF0ZXMnLFxyXG5cdFx0XHRcdGNvbnRlbnQ6IFtcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0J3RpdGxlOiBSZXZlcnNlZCBEYXRlcyBUYXNrJyxcclxuXHRcdFx0XHRcdCdzdGF0dXM6IHRvLWRvJyxcclxuXHRcdFx0XHRcdCdwcmlvcml0eTogbG93JyxcclxuXHRcdFx0XHRcdCdzY2hlZHVsZWQ6IDIwMjYtMDQtMjgnLFxyXG5cdFx0XHRcdFx0J2R1ZTogMjAyNi0wNC0wMScsXHJcblx0XHRcdFx0XHQncHJvamVjdHM6JyxcclxuXHRcdFx0XHRcdCcgIC0gV2Vic2l0ZSBMYXVuY2gnLFxyXG5cdFx0XHRcdFx0J2Jsb2NrZWRCeTonLFxyXG5cdFx0XHRcdFx0JyAgLSBcIltbR0UtRGV2ZWxvcG1lbnRdXVwiJyxcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0JycsXHJcblx0XHRcdFx0XHQnKipFZGdlIGNhc2UgKyB2aW9sYXRpb24qKiBcdTIwMTQgc2NoZWR1bGVkIGlzIEFGVEVSIGR1ZSAocmV2ZXJzZWQgZGF0ZXMpLCcsXHJcblx0XHRcdFx0XHQnQU5EIHN0YXJ0IGlzIGJlZm9yZSBEZXZlbG9wbWVudCBmaW5pc2hlcyBcdTIwMTQgdHJpZ2dlcnMgYSBzY2hlZHVsZSB2aW9sYXRpb24uJyxcclxuXHRcdFx0XHRcdCdCYXIgd2lkdGggbXVzdCBub3QgZ28gbmVnYXRpdmUuJyxcclxuXHRcdFx0XHRdLmpvaW4oJ1xcbicpLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bmFtZTogJ0dFLUJyb2tlbkRlcCcsXHJcblx0XHRcdFx0Y29udGVudDogW1xyXG5cdFx0XHRcdFx0Jy0tLScsXHJcblx0XHRcdFx0XHQndGl0bGU6IEJyb2tlbiBEZXBlbmRlbmN5JyxcclxuXHRcdFx0XHRcdCdzdGF0dXM6IHRvLWRvJyxcclxuXHRcdFx0XHRcdCdwcmlvcml0eTogbG93JyxcclxuXHRcdFx0XHRcdCdzY2hlZHVsZWQ6IDIwMjYtMDQtMTAnLFxyXG5cdFx0XHRcdFx0J2R1ZTogMjAyNi0wNC0xNCcsXHJcblx0XHRcdFx0XHQncHJvamVjdHM6JyxcclxuXHRcdFx0XHRcdCcgIC0gV2Vic2l0ZSBMYXVuY2gnLFxyXG5cdFx0XHRcdFx0J2Jsb2NrZWRCeTonLFxyXG5cdFx0XHRcdFx0JyAgLSBcIltbR0UtRGV2ZWxvcG1lbnRdXVwiJyxcclxuXHRcdFx0XHRcdCcgIC0gXCJbW0dFLURvZXNOb3RFeGlzdF1dXCInLFxyXG5cdFx0XHRcdFx0Jy0tLScsXHJcblx0XHRcdFx0XHQnJyxcclxuXHRcdFx0XHRcdCcqKkVkZ2UgY2FzZSoqIFx1MjAxNCBvbmUgdmFsaWQgZGVwIChEZXZlbG9wbWVudCkgYW5kIG9uZSByZWZlcmVuY2luZyBhIG5vdGUnLFxyXG5cdFx0XHRcdFx0J25vdCBpbiB0aGUgZGF0YXNldC4gVmFsaWQgYXJyb3cgc2hvdWxkIGRyYXc7IGJyb2tlbiBvbmUgc2hvdWxkIG5vdCBjcmFzaC4nLFxyXG5cdFx0XHRcdFx0J0Fsc28gc2hhcmVzIERldmVsb3BtZW50IGFzIGEgZGVwZW5kZW5jeSB3aXRoIFJldmVyc2VkRGF0ZXMgXHUyMDE0IHRlc3RzJyxcclxuXHRcdFx0XHRcdCdtdWx0aXBsZSB0YXNrcyBmYW5uaW5nIG91dCBmcm9tIHRoZSBzYW1lIHByZWRlY2Vzc29yLicsXHJcblx0XHRcdFx0XS5qb2luKCdcXG4nKSxcclxuXHRcdFx0fSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdG5hbWU6ICdHRS1Mb25nVGl0bGUnLFxyXG5cdFx0XHRcdGNvbnRlbnQ6IFtcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0J3RpdGxlOiBUaGlzIFRhc2sgSGFzIEFuIEV4dHJlbWVseSBMb25nIFRpdGxlIFRoYXQgU2hvdWxkIFRydW5jYXRlIEdyYWNlZnVsbHkgSW4gVGhlIFNpZGViYXIgQW5kIE9uIFRoZSBCYXIgV2l0aG91dCBCcmVha2luZyBMYXlvdXQnLFxyXG5cdFx0XHRcdFx0J3N0YXR1czogaW4tcHJvZ3Jlc3MnLFxyXG5cdFx0XHRcdFx0J3ByaW9yaXR5OiBtZWRpdW0nLFxyXG5cdFx0XHRcdFx0J3NjaGVkdWxlZDogMjAyNi0wNC0wNScsXHJcblx0XHRcdFx0XHQnZHVlOiAyMDI2LTA0LTIwJyxcclxuXHRcdFx0XHRcdCdwcm9qZWN0czonLFxyXG5cdFx0XHRcdFx0JyAgLSBXZWJzaXRlIExhdW5jaCcsXHJcblx0XHRcdFx0XHQnc3luY1N0YXJ0OicsXHJcblx0XHRcdFx0XHQnICAtIFwiW1tHRS1EZXZlbG9wbWVudF1dXCInLFxyXG5cdFx0XHRcdFx0Jy0tLScsXHJcblx0XHRcdFx0XHQnJyxcclxuXHRcdFx0XHRcdCcqKkVkZ2UgY2FzZSoqIFx1MjAxNCB2ZXJ5IGxvbmcgdGl0bGUsIHBsdXMgU1MgZGVwIG9uIERldmVsb3BtZW50LicsXHJcblx0XHRcdFx0XHQnU3RhcnRzIGJlZm9yZSBEZXZlbG9wbWVudCBzdGFydHMgXHUyMDE0IHRyaWdnZXJzIGFuIFNTIHNjaGVkdWxlIHZpb2xhdGlvbi4nLFxyXG5cdFx0XHRcdFx0J1Nob3VsZCB0cnVuY2F0ZSB3aXRoIGVsbGlwc2lzIGluIHNpZGViYXIgYW5kIGJhciBsYWJlbC4nLFxyXG5cdFx0XHRcdF0uam9pbignXFxuJyksXHJcblx0XHRcdH0sXHJcblx0XHRcdC8vIFx1MjUwMFx1MjUwMCBBZGRpdGlvbmFsIHZpb2xhdGlvbiBjYXNlcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcclxuXHRcdFx0e1xyXG5cdFx0XHRcdG5hbWU6ICdHRS1SZXBvcnRpbmcnLFxyXG5cdFx0XHRcdGNvbnRlbnQ6IFtcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0J3RpdGxlOiBSZXBvcnRpbmcnLFxyXG5cdFx0XHRcdFx0J3N0YXR1czogdG8tZG8nLFxyXG5cdFx0XHRcdFx0J3ByaW9yaXR5OiBtZWRpdW0nLFxyXG5cdFx0XHRcdFx0J3NjaGVkdWxlZDogMjAyNi0wNC0xNCcsXHJcblx0XHRcdFx0XHQnZHVlOiAyMDI2LTA0LTE3JyxcclxuXHRcdFx0XHRcdCdwcm9qZWN0czonLFxyXG5cdFx0XHRcdFx0JyAgLSBXZWJzaXRlIExhdW5jaCcsXHJcblx0XHRcdFx0XHQnc3luY0ZpbmlzaDonLFxyXG5cdFx0XHRcdFx0JyAgLSBcIltbR0UtRGV2ZWxvcG1lbnRdXVwiJyxcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0JycsXHJcblx0XHRcdFx0XHQnKipGRiB2aW9sYXRpb24qKiBcdTIwMTQgbXVzdCBmaW5pc2ggd2hlbiBEZXZlbG9wbWVudCBmaW5pc2hlcyAoQXByIDIxKSwnLFxyXG5cdFx0XHRcdFx0J2J1dCBkdWUgQXByIDE3LiBGaXggc2hvdWxkIG1vdmUgZHVlIHRvIEFwciAyMS4nLFxyXG5cdFx0XHRcdF0uam9pbignXFxuJyksXHJcblx0XHRcdH0sXHJcblx0XHRcdHtcclxuXHRcdFx0XHRuYW1lOiAnR0UtVHJhaW5pbmcnLFxyXG5cdFx0XHRcdGNvbnRlbnQ6IFtcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0J3RpdGxlOiBUcmFpbmluZycsXHJcblx0XHRcdFx0XHQnc3RhdHVzOiB0by1kbycsXHJcblx0XHRcdFx0XHQncHJpb3JpdHk6IGxvdycsXHJcblx0XHRcdFx0XHQnc2NoZWR1bGVkOiAyMDI2LTA0LTAxJyxcclxuXHRcdFx0XHRcdCdkdWU6IDIwMjYtMDQtMDUnLFxyXG5cdFx0XHRcdFx0J3Byb2plY3RzOicsXHJcblx0XHRcdFx0XHQnICAtIFdlYnNpdGUgTGF1bmNoJyxcclxuXHRcdFx0XHRcdCdmaW5pc2hBZnRlclN0YXJ0OicsXHJcblx0XHRcdFx0XHQnICAtIFwiW1tHRS1UZXN0aW5nXV1cIicsXHJcblx0XHRcdFx0XHQnLS0tJyxcclxuXHRcdFx0XHRcdCcnLFxyXG5cdFx0XHRcdFx0JyoqU0YgdmlvbGF0aW9uKiogXHUyMDE0IG11c3QgZmluaXNoIGFmdGVyIFRlc3Rpbmcgc3RhcnRzIChBcHIgOCksJyxcclxuXHRcdFx0XHRcdCdidXQgZHVlIEFwciA1LiBGaXggc2hvdWxkIG1vdmUgZHVlIHRvIEFwciA4LicsXHJcblx0XHRcdFx0XS5qb2luKCdcXG4nKSxcclxuXHRcdFx0fSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdG5hbWU6ICdHRS1IYW5kb2ZmJyxcclxuXHRcdFx0XHRjb250ZW50OiBbXHJcblx0XHRcdFx0XHQnLS0tJyxcclxuXHRcdFx0XHRcdCd0aXRsZTogQ2xpZW50IEhhbmRvZmYnLFxyXG5cdFx0XHRcdFx0J3N0YXR1czogdG8tZG8nLFxyXG5cdFx0XHRcdFx0J3ByaW9yaXR5OiBoaWdoJyxcclxuXHRcdFx0XHRcdCdzY2hlZHVsZWQ6IDIwMjYtMDQtMTUnLFxyXG5cdFx0XHRcdFx0J2R1ZTogMjAyNi0wNC0xOCcsXHJcblx0XHRcdFx0XHQncHJvamVjdHM6JyxcclxuXHRcdFx0XHRcdCcgIC0gV2Vic2l0ZSBMYXVuY2gnLFxyXG5cdFx0XHRcdFx0J2Jsb2NrZWRCeTonLFxyXG5cdFx0XHRcdFx0JyAgLSBcIltbR0UtVGVzdGluZ11dXCInLFxyXG5cdFx0XHRcdFx0JyAgLSBcIltbR0UtRG9jdW1lbnRhdGlvbl1dXCInLFxyXG5cdFx0XHRcdFx0Jy0tLScsXHJcblx0XHRcdFx0XHQnJyxcclxuXHRcdFx0XHRcdCcqKk11bHRpLWRlcCBGUyB2aW9sYXRpb24qKiBcdTIwMTQgYmxvY2tlZCBieSBib3RoIFRlc3RpbmcgKEFwciA4XHUyMDEzMjgpJyxcclxuXHRcdFx0XHRcdCdhbmQgRG9jdW1lbnRhdGlvbiAoQXByIDE0XHUyMDEzMjEpLiBTdGFydCBBcHIgMTUgaXMgYWZ0ZXIgRG9jdW1lbnRhdGlvbicsXHJcblx0XHRcdFx0XHQnZmluaXNoZXMgKEFwciAyMSkgYnV0IGJlZm9yZSBUZXN0aW5nIGZpbmlzaGVzIChBcHIgMjgpIFx1MjAxNCBvbmUnLFxyXG5cdFx0XHRcdFx0J3Zpb2xhdGVkLCBvbmUgT0suIEZpeCBzaG91bGQgbW92ZSBzdGFydCB0byBBcHIgMjguJyxcclxuXHRcdFx0XHRdLmpvaW4oJ1xcbicpLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bmFtZTogJ0dFLVNpZ25PZmYnLFxyXG5cdFx0XHRcdGNvbnRlbnQ6IFtcclxuXHRcdFx0XHRcdCctLS0nLFxyXG5cdFx0XHRcdFx0J3RpdGxlOiBTaWduLW9mZicsXHJcblx0XHRcdFx0XHQnc3RhdHVzOiB0by1kbycsXHJcblx0XHRcdFx0XHQncHJpb3JpdHk6IGhpZ2gnLFxyXG5cdFx0XHRcdFx0J3NjaGVkdWxlZDogMjAyNi0wNC0yMCcsXHJcblx0XHRcdFx0XHQnZHVlOiAyMDI2LTA0LTIyJyxcclxuXHRcdFx0XHRcdCdwcm9qZWN0czonLFxyXG5cdFx0XHRcdFx0JyAgLSBXZWJzaXRlIExhdW5jaCcsXHJcblx0XHRcdFx0XHQnYmxvY2tlZEJ5OicsXHJcblx0XHRcdFx0XHQnICAtIFwiW1tHRS1IYW5kb2ZmXV1cIicsXHJcblx0XHRcdFx0XHQnLS0tJyxcclxuXHRcdFx0XHRcdCcnLFxyXG5cdFx0XHRcdFx0JyoqQ2FzY2FkaW5nIEZTIHZpb2xhdGlvbioqIFx1MjAxNCBkZXBlbmRzIG9uIEhhbmRvZmYsIHdoaWNoIGl0c2VsZicsXHJcblx0XHRcdFx0XHQnaGFzIGEgdmlvbGF0aW9uLiBTdGFydCBBcHIgMjAgaXMgYmVmb3JlIEhhbmRvZmYgZmluaXNoZXMgQXByIDE4XHUyMDE0JyxcclxuXHRcdFx0XHRcdCd3YWl0LCBIYW5kb2ZmIGVuZHMgQXByIDE4IHNvIHRoaXMgb25lIGlzIGFjdHVhbGx5IGZpbmUgb24gaXRzIG93bi4nLFxyXG5cdFx0XHRcdFx0J0J1dCBvbmNlIEhhbmRvZmYgaXMgZml4ZWQgdG8gc3RhcnQgQXByIDI4LCBTaWduLW9mZiB3aWxsIGFsc28nLFxyXG5cdFx0XHRcdFx0J25lZWQgdXBkYXRpbmcuIFRlc3RzIGNhc2NhZGluZyBmaXggYmVoYXZpb3IuJyxcclxuXHRcdFx0XHRdLmpvaW4oJ1xcbicpLFxyXG5cdFx0XHR9LFxyXG5cdFx0XTtcclxuXHJcblx0XHQvLyBCYXNlIGZpbGUgXHUyMDE0IGZvbGRlci1zY29wZWQgc28gaXQgc2hvd3MgZXZlcnl0aGluZyBpbiBHYW50dCBFeGFtcGxlcy9cclxuXHRcdC8vIHJlZ2FyZGxlc3Mgb2YgZnJvbnRtYXR0ZXIsIHJhdGhlciB0aGFuIGZpbHRlcmluZyBieSBwcm9qZWN0IG5hbWUuXHJcblx0XHQvLyBUaGUgb3JkZXI6IGFycmF5IGRlZmluZXMgd2hpY2ggcHJvcGVydGllcyBhcmUgdmlzaWJsZTsgdGhlIEdhbnR0IHZpZXdcclxuXHRcdC8vIHJlYWRzIHRoaXMgdG8gZGVjaWRlIHdoaWNoIGZlYXR1cmVzIHRvIGRpc3BsYXkgKHByaW9yaXR5IGRvdCwgZGVwIGFycm93cykuXHJcblx0XHRjb25zdCBiYXNlQ29udGVudCA9IFtcclxuXHRcdFx0J3ZpZXdzOicsXHJcblx0XHRcdCcgIC0gdHlwZTogZ2FudHQnLFxyXG5cdFx0XHQnICAgIG5hbWU6IFdlYnNpdGUgTGF1bmNoJyxcclxuXHRcdFx0JyAgICBmaWx0ZXJzOicsXHJcblx0XHRcdCcgICAgICBhbmQ6JyxcclxuXHRcdFx0YCAgICAgICAgLSBmaWxlLmZvbGRlciA9PSBcIiR7Zm9sZGVyUGF0aH1cImAsXHJcblx0XHRcdCcgICAgb3JkZXI6JyxcclxuXHRcdFx0JyAgICAgIC0gdGl0bGUnLFxyXG5cdFx0XHQnICAgICAgLSBzdGF0dXMnLFxyXG5cdFx0XHQnICAgICAgLSBwcmlvcml0eScsXHJcblx0XHRcdCcgICAgICAtIHNjaGVkdWxlZCcsXHJcblx0XHRcdCcgICAgICAtIGR1ZScsXHJcblx0XHRcdCcgICAgICAtIGJsb2NrZWRCeScsXHJcblx0XHRcdCcgICAgICAtIHN5bmNTdGFydCcsXHJcblx0XHRcdCcgICAgICAtIHN5bmNGaW5pc2gnLFxyXG5cdFx0XHQnICAgICAgLSBmaW5pc2hBZnRlclN0YXJ0JyxcclxuXHRcdFx0JycsXHJcblx0XHRdLmpvaW4oJ1xcbicpO1xyXG5cclxuXHRcdGNvbnN0IGFsbEZpbGVzOiBBcnJheTx7IHBhdGg6IHN0cmluZzsgY29udGVudDogc3RyaW5nIH0+ID0gW1xyXG5cdFx0XHQuLi5ub3Rlcy5tYXAobiA9PiAoeyBwYXRoOiBgJHtmb2xkZXJQYXRofS8ke24ubmFtZX0ubWRgLCBjb250ZW50OiBuLmNvbnRlbnQgfSkpLFxyXG5cdFx0XHR7IHBhdGg6IGAke2ZvbGRlclBhdGh9L2dhbnR0LWV4YW1wbGVzLmJhc2VgLCBjb250ZW50OiBiYXNlQ29udGVudCB9LFxyXG5cdFx0XTtcclxuXHJcblx0XHRsZXQgY3JlYXRlZCA9IDA7XHJcblx0XHRsZXQgc2tpcHBlZCA9IDA7XHJcblxyXG5cdFx0Zm9yIChjb25zdCBmaWxlIG9mIGFsbEZpbGVzKSB7XHJcblx0XHRcdGlmICh2YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZS5wYXRoKSkge1xyXG5cdFx0XHRcdHNraXBwZWQrKztcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRhd2FpdCB2YXVsdC5jcmVhdGUoZmlsZS5wYXRoLCBmaWxlLmNvbnRlbnQpO1xyXG5cdFx0XHRcdGNyZWF0ZWQrKztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChjcmVhdGVkID4gMCkge1xyXG5cdFx0XHRuZXcgTm90aWNlKGBDcmVhdGVkICR7Y3JlYXRlZH0gZmlsZSR7Y3JlYXRlZCA+IDEgPyAncycgOiAnJ30gaW4gXCIke2ZvbGRlclBhdGh9L1wiJHtza2lwcGVkID4gMCA/IGAgKCR7c2tpcHBlZH0gYWxyZWFkeSBleGlzdGVkKWAgOiAnJ31gKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG5ldyBOb3RpY2UoYEFsbCBleGFtcGxlIGZpbGVzIGFscmVhZHkgZXhpc3QgaW4gXCIke2ZvbGRlclBhdGh9L1wiYCk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcbiIsICJpbXBvcnQgeyBCYXNlc1ZpZXcsIEJhc2VzVmlld0NvbmZpZywgQXBwLCBCYXNlc0VudHJ5R3JvdXAgfSBmcm9tICdvYnNpZGlhbic7XHJcbmltcG9ydCB0eXBlIHsgUXVlcnlDb250cm9sbGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xyXG5pbXBvcnQgdHlwZSBHYW50dEJhc2VzVmlld1BsdWdpbiBmcm9tICcuL21haW4udHMnO1xyXG5pbXBvcnQgdHlwZSB7IEdhbnR0VGFzaywgVGFza0dyb3VwLCBHYW50dFZpZXdTZXR0aW5ncywgVGltZWxpbmVDb25maWcsIENvbHVtbkhlYWRlciwgWm9vbUxldmVsIH0gZnJvbSAnLi90eXBlcy50cyc7XHJcbmltcG9ydCB7IFJPV19IRUlHSFQsIEdST1VQX0hFQURFUl9IRUlHSFQsIEJBUl9IRUlHSFQsIEJBUl9NQVJHSU5fVE9QLCBTSURFQkFSX1dJRFRILCBNSU5fU0lERUJBUl9XSURUSCwgTUFYX1NJREVCQVJfV0lEVEgsIE1JTl9USU1FTElORV9XSURUSCwgSEVBREVSX0hFSUdIVCwgREVQX0ZJRUxEUywgc3RyaXBXaWtpbGluayB9IGZyb20gJy4vdHlwZXMudHMnO1xyXG5pbXBvcnQgeyByZWFkU2V0dGluZ3MsIGV4dHJhY3RUYXNrLCByZXNvbHZlRGVwZW5kZW5jeVBhdGhzIH0gZnJvbSAnLi9maWVsZC1tYXBwaW5nLnRzJztcclxuaW1wb3J0IHsgY29tcHV0ZVRpbWVsaW5lUmFuZ2UsIGdlbmVyYXRlQ29sdW1ucywgZ2V0VGFza0JhckJvdW5kcywgZGF0ZVRvUGl4ZWxPZmZzZXQsIHRvdGFsVGltZWxpbmVXaWR0aCwgY29sdW1uc1dpZHRoIH0gZnJvbSAnLi90aW1lbGluZS50cyc7XHJcbmltcG9ydCB7IGJ1aWxkR2FudHRTY2FmZm9sZCwgc2V0VGltZWxpbmVXaWR0aCB9IGZyb20gJy4vcmVuZGVyZXIudHMnO1xyXG5pbXBvcnQgeyBjcmVhdGVUYXNrQmFyLCBjcmVhdGVTaWRlYmFyTGFiZWwgfSBmcm9tICcuL3Rhc2stYmFyLnRzJztcclxuaW1wb3J0IHsgcmVuZGVyRGVwZW5kZW5jaWVzIH0gZnJvbSAnLi9kZXBlbmRlbmNpZXMudHMnO1xyXG5pbXBvcnQgeyBvcGVuUG9wdXBFZGl0b3IgfSBmcm9tICcuL3BvcHVwLWVkaXRvci50cyc7XHJcbmltcG9ydCB7IGV4cG9ydFRvVFNWLCBjb3B5VG9DbGlwYm9hcmQgfSBmcm9tICcuL2V4cG9ydC50cyc7XHJcbmltcG9ydCB7IGRldGVjdFZpb2xhdGlvbnMsIG9wZW5WaW9sYXRpb25QYW5lbCwgY2xvc2VWaW9sYXRpb25QYW5lbCB9IGZyb20gJy4vdmlvbGF0aW9ucy50cyc7XHJcbmltcG9ydCB7IGNsb3NlQWN0aXZlUG9wdXAgfSBmcm9tICcuL3BvcHVwLWVkaXRvci50cyc7XHJcblxyXG5pbXBvcnQgdHlwZSB7IENvbG9yQnlGaWVsZCB9IGZyb20gJy4vdHlwZXMudHMnO1xyXG5cclxuY29uc3QgWk9PTV9MRVZFTFM6IFpvb21MZXZlbFtdID0gWydkYXknLCAnd2VlaycsICdtb250aCcsICcxeWVhcicsICcyeWVhcicsICczeWVhciddO1xyXG5jb25zdCBaT09NX0xBQkVMUzogUmVjb3JkPFpvb21MZXZlbCwgc3RyaW5nPiA9IHsgZGF5OiAnRGF5Jywgd2VlazogJ1dlZWsnLCBtb250aDogJ01vbnRoJywgJzF5ZWFyJzogJzFZJywgJzJ5ZWFyJzogJzJZJywgJzN5ZWFyJzogJzNZJyB9O1xyXG5jb25zdCBDT0xPUl9CWV9PUFRJT05TOiBDb2xvckJ5RmllbGRbXSA9IFsnbm9uZScsICdzdGF0dXMnLCAncHJpb3JpdHknXTtcclxuY29uc3QgQ09MT1JfQllfTEFCRUxTOiBSZWNvcmQ8Q29sb3JCeUZpZWxkLCBzdHJpbmc+ID0geyBub25lOiAnTm8gY29sb3InLCBzdGF0dXM6ICdTdGF0dXMnLCBwcmlvcml0eTogJ1ByaW9yaXR5JyB9O1xyXG5cclxuZXhwb3J0IGNsYXNzIEdhbnR0VmlldyBleHRlbmRzIEJhc2VzVmlldyB7XHJcblx0dHlwZSA9ICdnYW50dCc7XHJcblx0cHJpdmF0ZSBzY3JvbGxFbDogSFRNTEVsZW1lbnQ7ICAvLyB0aGUgZnJhbWV3b3JrLW1hbmFnZWQgcGFyZW50IChzY3JvbGwgZWxlbWVudClcclxuXHRwcml2YXRlIHJvb3RFbDogSFRNTEVsZW1lbnQ7ICAgIC8vIG91ciBvd24gY2hpbGQgZGl2IFx1MjAxNCBhbGwgcmVuZGVyaW5nIGdvZXMgaGVyZVxyXG5cdHByaXZhdGUgcGx1Z2luOiBHYW50dEJhc2VzVmlld1BsdWdpbjtcclxuXHRwcml2YXRlIF9sb2NhbFpvb206IFpvb21MZXZlbCB8IG51bGwgPSBudWxsOyAgLy8gb3ZlcnJpZGVzIGNvbmZpZyB6b29tIHdoZW4gc2V0XHJcblx0cHJpdmF0ZSBfbG9jYWxDb2xvckJ5OiBDb2xvckJ5RmllbGQgPSAnbm9uZSc7IC8vIHRvb2xiYXItZHJpdmVuIGJhciBjb2xvcmluZ1xyXG5cdHByaXZhdGUgX3NpZGViYXJXaWR0aDogbnVtYmVyID0gU0lERUJBUl9XSURUSDsgLy8gcGVyc2lzdHMgYWNyb3NzIHJlLXJlbmRlcnMgZm9yIGRyYWcgcmVzaXplXHJcblx0cHJpdmF0ZSBfZHJhZ0NsZWFudXA6ICgoKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsOyAvLyBjYW5jZWxzIGFueSBpbi1wcm9ncmVzcyBzaWRlYmFyIGRyYWdcclxuXHRwcml2YXRlIF9jb2xsYXBzZWRHcm91cHM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpOyAvLyBncm91cCBrZXlzIHRoZSB1c2VyIGhhcyBjb2xsYXBzZWRcclxuXHRwcml2YXRlIF9zY3JvbGxMZWZ0OiBudW1iZXIgPSAwOyAvLyBwcmVzZXJ2ZWQgYWNyb3NzIHJlLXJlbmRlcnNcclxuXHRwcml2YXRlIF9zY3JvbGxUb3A6IG51bWJlciA9IDA7XHJcblx0cHJpdmF0ZSBfcmVzaXplT2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyIHwgbnVsbCA9IG51bGw7XHJcblx0cHJpdmF0ZSBfbGFzdFJlbmRlcmVkV2lkdGg6IG51bWJlciA9IDA7XHJcblx0cHJpdmF0ZSBfcmVzaXplVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGw7XHJcblxyXG5cdGNvbnN0cnVjdG9yKGNvbnRyb2xsZXI6IFF1ZXJ5Q29udHJvbGxlciwgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LCBwbHVnaW46IEdhbnR0QmFzZXNWaWV3UGx1Z2luKSB7XHJcblx0XHRzdXBlcihjb250cm9sbGVyKTtcclxuXHRcdHRoaXMuc2Nyb2xsRWwgPSBjb250YWluZXJFbDtcclxuXHRcdHRoaXMucm9vdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KCdnYnYtcm9vdCcpO1xyXG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XHJcblxyXG5cdFx0dGhpcy5fcmVzaXplT2JzZXJ2ZXIgPSBuZXcgUmVzaXplT2JzZXJ2ZXIoKGVudHJpZXMpID0+IHtcclxuXHRcdFx0Y29uc3Qgd2lkdGggPSBlbnRyaWVzWzBdPy5jb250ZW50UmVjdC53aWR0aCA/PyAwO1xyXG5cdFx0XHRpZiAod2lkdGggPiAwICYmIE1hdGguYWJzKHdpZHRoIC0gdGhpcy5fbGFzdFJlbmRlcmVkV2lkdGgpID4gMSkge1xyXG5cdFx0XHRcdGlmICh0aGlzLl9yZXNpemVUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMuX3Jlc2l6ZVRpbWVyKTtcclxuXHRcdFx0XHR0aGlzLl9yZXNpemVUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fcmVuZGVyKCksIDEwMCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdFx0dGhpcy5fcmVzaXplT2JzZXJ2ZXIub2JzZXJ2ZShjb250YWluZXJFbCk7XHJcblx0fVxyXG5cclxuXHRvbkRhdGFVcGRhdGVkKCk6IHZvaWQge1xyXG5cdFx0dGhpcy5fcmVuZGVyKCk7XHJcblx0fVxyXG5cclxuXHRvbnVubG9hZCgpOiB2b2lkIHtcclxuXHRcdHRoaXMuX2RyYWdDbGVhbnVwPy4oKTtcclxuXHRcdHRoaXMuX3Jlc2l6ZU9ic2VydmVyPy5kaXNjb25uZWN0KCk7XHJcblx0XHR0aGlzLl9yZXNpemVPYnNlcnZlciA9IG51bGw7XHJcblx0XHRpZiAodGhpcy5fcmVzaXplVGltZXIpIGNsZWFyVGltZW91dCh0aGlzLl9yZXNpemVUaW1lcik7XHJcblx0XHRjbG9zZVZpb2xhdGlvblBhbmVsKCk7XHJcblx0XHRjbG9zZUFjdGl2ZVBvcHVwKCk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBDb3JlIHJlbmRlclxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRwcml2YXRlIF9yZW5kZXIoKTogdm9pZCB7XHJcblx0XHRjb25zdCBjb250YWluZXIgPSB0aGlzLnJvb3RFbDtcclxuXHRcdHRoaXMuX2xhc3RSZW5kZXJlZFdpZHRoID0gdGhpcy5zY3JvbGxFbC5jbGllbnRXaWR0aDtcclxuXHJcblx0XHQvLyBHdWFyZDogZGF0YSBtYXkgbm90IGJlIHNldCB5ZXQgaWYgUmVzaXplT2JzZXJ2ZXIgZmlyZXMgYmVmb3JlIG9uRGF0YVVwZGF0ZWRcclxuXHRcdGlmICghdGhpcy5kYXRhKSByZXR1cm47XHJcblxyXG5cdFx0Y29uc3QgY29uZmlnOiBCYXNlc1ZpZXdDb25maWcgPSB0aGlzLmNvbmZpZztcclxuXHJcblx0XHQvLyBQcmVzZXJ2ZSBzY3JvbGwgcG9zaXRpb24gYWNyb3NzIHJlLXJlbmRlcnNcclxuXHRcdGNvbnN0IHByZXZTY3JvbGwgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLmdidi1zY3JvbGwtYXJlYScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcclxuXHRcdGlmIChwcmV2U2Nyb2xsKSB7XHJcblx0XHRcdHRoaXMuX3Njcm9sbExlZnQgPSBwcmV2U2Nyb2xsLnNjcm9sbExlZnQ7XHJcblx0XHRcdHRoaXMuX3Njcm9sbFRvcCA9IHByZXZTY3JvbGwuc2Nyb2xsVG9wO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnRhaW5lci5lbXB0eSgpO1xyXG5cclxuXHRcdGNvbnN0IHNldHRpbmdzOiBHYW50dFZpZXdTZXR0aW5ncyA9IHJlYWRTZXR0aW5ncyhjb25maWcsIHRoaXMucGx1Z2luLnNldHRpbmdzKTtcclxuXHRcdGlmICh0aGlzLl9sb2NhbFpvb20pIHNldHRpbmdzLnpvb20gPSB0aGlzLl9sb2NhbFpvb207XHJcblx0XHRzZXR0aW5ncy5jb2xvckJ5ID0gdGhpcy5fbG9jYWxDb2xvckJ5O1xyXG5cclxuXHRcdC8vIERlcml2ZSBwcm9wZXJ0eS1nYXRlZCB2aXNpYmlsaXR5IGZyb20gdGhlIHVzZXItY29uZmlndXJlZCBCYXNlcyBwcm9wZXJ0aWVzLlxyXG5cdFx0Ly8gY29uZmlnLmdldE9yZGVyKCkgcmVhZHMgdGhlICdvcmRlcjonIGFycmF5IGZyb20gdGhlIC5iYXNlIGZpbGUgYW5kIHdvcmtzXHJcblx0XHQvLyBpbiBib3RoIGRpcmVjdCB2aWV3IGFuZCBlbWJlZCBjb250ZXh0cy4gdGhpcy5kYXRhLnByb3BlcnRpZXMgb25seSByZWZsZWN0c1xyXG5cdFx0Ly8gaW50ZXJhY3RpdmUgdG9vbGJhciBzdGF0ZSBhbmQgaXMgZW1wdHkgaW4gZW1iZWQgY29udGV4dC5cclxuXHRcdC8vIFRoZSAuYmFzZSBmaWxlIG9yZGVyOiBhcnJheSB1c2VzIGJhcmUgbmFtZXMgKCdwcmlvcml0eScpLCB3aGljaCBCYXNlc1xyXG5cdFx0Ly8gbWFwcyB0byAnbm90ZS5wcmlvcml0eScgaW50ZXJuYWxseSBcdTIwMTQgY2hlY2sgYm90aCBmb3JtcyBmb3Igcm9idXN0bmVzcy5cclxuXHRcdGNvbnN0IHJhd1Byb3BzOiBzdHJpbmdbXSA9IGNvbmZpZy5nZXRPcmRlcigpID8/IFtdO1xyXG5cdFx0Y29uc3QgdmlzaWJsZVByb3BzID0gbmV3IFNldDxzdHJpbmc+KHJhd1Byb3BzKTtcclxuXHRcdGlmICh2aXNpYmxlUHJvcHMuc2l6ZSA+IDApIHtcclxuXHRcdFx0c2V0dGluZ3Muc2hvd1ByaW9yaXR5ID1cclxuXHRcdFx0XHR2aXNpYmxlUHJvcHMuaGFzKCdub3RlLnByaW9yaXR5JykgfHwgdmlzaWJsZVByb3BzLmhhcygncHJpb3JpdHknKTtcclxuXHRcdFx0c2V0dGluZ3MudmlzaWJsZURlcFR5cGVzID0gbmV3IFNldChcclxuXHRcdFx0XHRERVBfRklFTERTXHJcblx0XHRcdFx0XHQuZmlsdGVyKGYgPT4gdmlzaWJsZVByb3BzLmhhcyhmLnByb3ApIHx8IHZpc2libGVQcm9wcy5oYXMoZi5iYXJlKSlcclxuXHRcdFx0XHRcdC5tYXAoZiA9PiBmLnR5cGUpLFxyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFVzZSBCYXNlcy1uYXRpdmUgZ3JvdXBlZERhdGEgc28gdGhlIEJhc2VzIGdyb3VwIGJ1dHRvbiBkcml2ZXMgZ3JvdXBpbmcuXHJcblx0XHQvLyBXaGVuIG5vIGdyb3VwIGlzIGNvbmZpZ3VyZWQsIEJhc2VzIHJldHVybnMgb25lIGdyb3VwIHdpdGggYSBudWxsIGtleS5cclxuXHRcdGNvbnN0IGdyb3VwczogVGFza0dyb3VwW10gPSB0aGlzLmRhdGEuZ3JvdXBlZERhdGEubWFwKChnOiBCYXNlc0VudHJ5R3JvdXApID0+ICh7XHJcblx0XHRcdGtleTogZy5oYXNLZXkoKSA/IHRoaXMuX2Zvcm1hdEdyb3VwS2V5KGcua2V5IS50b1N0cmluZygpKSA6ICcnLFxyXG5cdFx0XHR0YXNrczogZy5lbnRyaWVzLm1hcChlbnRyeSA9PiBleHRyYWN0VGFzayhlbnRyeSwgc2V0dGluZ3MpKSxcclxuXHRcdH0pKTtcclxuXHJcblx0XHQvLyBGbGF0dGVuIGFsbCB0YXNrcyBmb3IgZGVwZW5kZW5jeSByZXNvbHV0aW9uIChuZWVkcyB0aGUgZnVsbCB0YXNrIGdyYXBoKVxyXG5cdFx0Y29uc3QgdGFza3M6IEdhbnR0VGFza1tdID0gZ3JvdXBzLmZsYXRNYXAoZyA9PiBnLnRhc2tzKTtcclxuXHRcdHJlc29sdmVEZXBlbmRlbmN5UGF0aHModGFza3MpO1xyXG5cdFx0Y29uc3QgdmlvbGF0aW9ucyA9IGRldGVjdFZpb2xhdGlvbnModGFza3MpO1xyXG5cdFx0Y29uc3QgdmlvbGF0aW5nVGFza0lkcyA9IG5ldyBTZXQodmlvbGF0aW9ucy5tYXAodiA9PiB2LnRhcmdldFRhc2suaWQpKTtcclxuXHRcdGxldCB0aW1lbGluZUNvbmZpZzogVGltZWxpbmVDb25maWcgPSBjb21wdXRlVGltZWxpbmVSYW5nZSh0YXNrcywgc2V0dGluZ3Muem9vbSk7XHJcblxyXG5cdFx0Y29uc3QgeyB0b29sYmFyLCBib2R5LCBzaWRlYmFyLCByZXNpemVIYW5kbGUsIHNjcm9sbEFyZWEsIGhlYWRlclJvdywgYmFyc0FyZWEsIHN2Z0xheWVyIH0gPVxyXG5cdFx0XHRidWlsZEdhbnR0U2NhZmZvbGQoY29udGFpbmVyKTtcclxuXHJcblx0XHQvLyBSZXN0b3JlIGRyYWdnZWQgc2lkZWJhciB3aWR0aCBhbmQgd2lyZSB0aGUgcmVzaXplIGhhbmRsZVxyXG5cdFx0c2lkZWJhci5zdHlsZS53aWR0aCA9IGAke3RoaXMuX3NpZGViYXJXaWR0aH1weGA7XHJcblx0XHR0aGlzLl93aXJlU2lkZWJhclJlc2l6ZShzaWRlYmFyLCByZXNpemVIYW5kbGUpO1xyXG5cclxuXHRcdC8vIEV4dGVuZCB0aGUgdGltZWxpbmUgZW5kIGRhdGUgc28gdGhlIGNoYXJ0IGFsd2F5cyBmaWxscyB0aGUgdmlzaWJsZSBhcmVhLlxyXG5cdFx0Ly8gVXNpbmcgY29udGFpbmVyRWwgd2lkdGggbWludXMgc2lkZWJhciBzbyB3ZSBkb24ndCBkZXBlbmQgb24gc2Nyb2xsQXJlYVxyXG5cdFx0Ly8gbGF5b3V0ICh3aGljaCBoYXNuJ3QgaGFwcGVuZWQgeWV0IGF0IHRoaXMgcG9pbnQgaW4gSlMgZXhlY3V0aW9uKS5cclxuXHRcdGNvbnN0IGF2YWlsYWJsZVdpZHRoID0gTWF0aC5tYXgoTUlOX1RJTUVMSU5FX1dJRFRILFxyXG5cdFx0XHQodGhpcy5zY3JvbGxFbC5jbGllbnRXaWR0aCB8fCAwKSAtIHRoaXMuX3NpZGViYXJXaWR0aCAtIDIsIC8vIC0yIGZvciBzaWRlYmFyIHJlc2l6ZSBoYW5kbGUgYm9yZGVyXHJcblx0XHQpO1xyXG5cdFx0Y29uc3QgY29udGVudFdpZHRoID0gdG90YWxUaW1lbGluZVdpZHRoKHRpbWVsaW5lQ29uZmlnKTtcclxuXHRcdGlmIChjb250ZW50V2lkdGggPCBhdmFpbGFibGVXaWR0aCkge1xyXG5cdFx0XHRjb25zdCBleHRyYURheXMgPSBNYXRoLmNlaWwoXHJcblx0XHRcdFx0KGF2YWlsYWJsZVdpZHRoIC0gY29udGVudFdpZHRoKSAvIHRpbWVsaW5lQ29uZmlnLnBpeGVsc1BlckRheSxcclxuXHRcdFx0KTtcclxuXHRcdFx0dGltZWxpbmVDb25maWcgPSB7XHJcblx0XHRcdFx0Li4udGltZWxpbmVDb25maWcsXHJcblx0XHRcdFx0ZW5kRGF0ZTogbmV3IERhdGUoXHJcblx0XHRcdFx0XHR0aW1lbGluZUNvbmZpZy5lbmREYXRlLmdldFRpbWUoKSArIGV4dHJhRGF5cyAqIDg2XzQwMF8wMDAsXHJcblx0XHRcdFx0KSxcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBjb2x1bW5zID0gZ2VuZXJhdGVDb2x1bW5zKHRpbWVsaW5lQ29uZmlnKTtcclxuXHRcdGNvbnN0IHRvdGFsV2lkdGggPSBjb2x1bW5zV2lkdGgoY29sdW1ucyk7XHJcblxyXG5cdFx0dGhpcy5fcmVuZGVyVG9vbGJhcih0b29sYmFyLCB0YXNrcywgZ3JvdXBzLCBzY3JvbGxBcmVhLCB0aW1lbGluZUNvbmZpZywgc2V0dGluZ3Muem9vbSwgdmlvbGF0aW9ucyk7XHJcblx0XHR0aGlzLl9yZW5kZXJDb2x1bW5IZWFkZXJzKGhlYWRlclJvdywgY29sdW1ucyk7XHJcblxyXG5cdFx0Y29uc3QgeyB0YXNrUm93TWFwLCB0b3RhbEhlaWdodFB4IH0gPSB0aGlzLl9yZW5kZXJUYXNrUm93cyhcclxuXHRcdFx0Z3JvdXBzLCBzaWRlYmFyLCBiYXJzQXJlYSwgdGltZWxpbmVDb25maWcsIHNldHRpbmdzLCB2aW9sYXRpbmdUYXNrSWRzLCB0b3RhbFdpZHRoLFxyXG5cdFx0KTtcclxuXHJcblx0XHQvLyBTaXplIHRoZSBTVkcgbGF5ZXIgdG8gZXhhY3RseSBjb3ZlciB0aGUgYmFyc0FyZWEgc28gZGVwZW5kZW5jeSBhcnJvd3NcclxuXHRcdC8vIGFyZSBuZXZlciBjbGlwcGVkIChhdm9pZHMgcmVseWluZyBvbiBvdmVyZmxvdzp2aXNpYmxlIGFsb25lKS5cclxuXHRcdHNldFRpbWVsaW5lV2lkdGgoc2Nyb2xsQXJlYSwgYmFyc0FyZWEsIHN2Z0xheWVyLCB0b3RhbFdpZHRoLCB0b3RhbEhlaWdodFB4KTtcclxuXHJcblx0XHRpZiAoc2V0dGluZ3Muc2hvd1RvZGF5KSB7XHJcblx0XHRcdHRoaXMuX3JlbmRlclRvZGF5TGluZShiYXJzQXJlYSwgdGltZWxpbmVDb25maWcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChzZXR0aW5ncy5zaG93RGVwZW5kZW5jaWVzKSB7XHJcblx0XHRcdHJlbmRlckRlcGVuZGVuY2llcyhzdmdMYXllciwgdGFza3MsIHRhc2tSb3dNYXAsIHRpbWVsaW5lQ29uZmlnLCBzZXR0aW5ncyk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gUmVzdG9yZSBzY3JvbGwgcG9zaXRpb24gKHVzZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgc28gbGF5b3V0IGlzIHNldHRsZWQpLlxyXG5cdFx0Ly8gQWxzbyBkZXRlY3QgZW1iZWQgY29udGV4dDogaWYgdGhlIGNvbnRhaW5lciBoYXMgbm8gaGVpZ2h0IGFmdGVyIGxheW91dFxyXG5cdFx0Ly8gKGhlaWdodDoxMDAlIGNvbGxhcHNlZCBiZWNhdXNlIHBhcmVudCBoYXMgbm8gZGVmaW5lZCBoZWlnaHQpLCBzZXQgYW5cclxuXHRcdC8vIGV4cGxpY2l0IHBpeGVsIGhlaWdodCBvbiB0aGUgY29udGFpbmVyIHNvIHRoZSBjb250ZW50IGlzIHZpc2libGUuXHJcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xyXG5cdFx0XHRpZiAoIWNvbnRhaW5lci5jbGllbnRIZWlnaHQpIHtcclxuXHRcdFx0XHRjb25zdCB0b29sYmFySCA9IHRvb2xiYXIuY2xpZW50SGVpZ2h0IHx8IDQwO1xyXG5cdFx0XHRcdGNvbnN0IHRhcmdldEggPSBNYXRoLm1pbih0b3RhbEhlaWdodFB4ICsgSEVBREVSX0hFSUdIVCArIHRvb2xiYXJIICsgNCwgNTIwKTtcclxuXHRcdFx0XHRjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7TWF0aC5tYXgodGFyZ2V0SCwgMjAwKX1weGA7XHJcblx0XHRcdH1cclxuXHRcdFx0c2Nyb2xsQXJlYS5zY3JvbGxMZWZ0ID0gdGhpcy5fc2Nyb2xsTGVmdDtcclxuXHRcdFx0c2Nyb2xsQXJlYS5zY3JvbGxUb3AgPSB0aGlzLl9zY3JvbGxUb3A7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLl93aXJlU2Nyb2xsU3luYyhzaWRlYmFyLCBzY3JvbGxBcmVhKTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFByaXZhdGUgaGVscGVyc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRwcml2YXRlIF9mb3JtYXRHcm91cEtleShyYXc6IHN0cmluZyk6IHN0cmluZyB7XHJcblx0XHRyZXR1cm4gc3RyaXBXaWtpbGluayhyYXcpIHx8ICdVbmdyb3VwZWQnO1xyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBfcmVuZGVyVG9vbGJhcihcclxuXHRcdHRvb2xiYXI6IEhUTUxFbGVtZW50LFxyXG5cdFx0dGFza3M6IEdhbnR0VGFza1tdLFxyXG5cdFx0Z3JvdXBzOiBUYXNrR3JvdXBbXSxcclxuXHRcdHNjcm9sbEFyZWE6IEhUTUxFbGVtZW50LFxyXG5cdFx0dGltZWxpbmVDb25maWc6IFRpbWVsaW5lQ29uZmlnLFxyXG5cdFx0Y3VycmVudFpvb206IFpvb21MZXZlbCxcclxuXHRcdHZpb2xhdGlvbnM6IGltcG9ydCgnLi92aW9sYXRpb25zLnRzJykuU2NoZWR1bGVWaW9sYXRpb25bXSxcclxuXHQpOiB2b2lkIHtcclxuXHRcdC8vIFpvb20gYnV0dG9uIGdyb3VwXHJcblx0XHRjb25zdCB6b29tR3JvdXAgPSB0b29sYmFyLmNyZWF0ZUVsKCdkaXYnLCB7IGNsczogJ2didi16b29tLWdyb3VwJyB9KTtcclxuXHRcdGZvciAoY29uc3Qgem9vbSBvZiBaT09NX0xFVkVMUykge1xyXG5cdFx0XHRjb25zdCBidG4gPSB6b29tR3JvdXAuY3JlYXRlRWwoJ2J1dHRvbicsIHtcclxuXHRcdFx0XHR0ZXh0OiBaT09NX0xBQkVMU1t6b29tXSxcclxuXHRcdFx0XHRjbHM6IHpvb20gPT09IGN1cnJlbnRab29tID8gJ2didi16b29tLWJ0biBpcy1hY3RpdmUnIDogJ2didi16b29tLWJ0bicsXHJcblx0XHRcdH0pO1xyXG5cdFx0XHRidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcblx0XHRcdFx0aWYgKHRoaXMuX2xvY2FsWm9vbSAhPT0gem9vbSkge1xyXG5cdFx0XHRcdFx0dGhpcy5fc2Nyb2xsTGVmdCA9IDA7XHJcblx0XHRcdFx0XHR0aGlzLl9zY3JvbGxUb3AgPSAwO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0aGlzLl9sb2NhbFpvb20gPSB6b29tO1xyXG5cdFx0XHRcdHRoaXMuX3JlbmRlcigpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHR0b29sYmFyLmNyZWF0ZUVsKCdkaXYnLCB7IGNsczogJ2didi10b29sYmFyLXNlcGFyYXRvcicgfSk7XHJcblxyXG5cdFx0Ly8gVG9kYXkgYnV0dG9uXHJcblx0XHRjb25zdCB0b2RheUJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgdGV4dDogJ1RvZGF5JywgY2xzOiAnZ2J2LWJ0bicgfSk7XHJcblx0XHR0b2RheUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuXHRcdFx0Y29uc3Qgb2Zmc2V0ID0gZGF0ZVRvUGl4ZWxPZmZzZXQobmV3IERhdGUoKSwgdGltZWxpbmVDb25maWcpO1xyXG5cdFx0XHRzY3JvbGxBcmVhLnNjcm9sbExlZnQgPSBNYXRoLm1heCgwLCBvZmZzZXQgLSBzY3JvbGxBcmVhLmNsaWVudFdpZHRoIC8gMik7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0b29sYmFyLmNyZWF0ZUVsKCdkaXYnLCB7IGNsczogJ2didi10b29sYmFyLXNlcGFyYXRvcicgfSk7XHJcblxyXG5cdFx0Ly8gQ29sb3IgYnkgZHJvcGRvd25cclxuXHRcdGNvbnN0IGNvbG9yQnlMYWJlbCA9IHRvb2xiYXIuY3JlYXRlRWwoJ3NwYW4nLCB7IHRleHQ6ICdDb2xvcjonLCBjbHM6ICdnYnYtdG9vbGJhci1sYWJlbCcgfSk7XHJcblx0XHRjb25zdCBjb2xvckJ5U2VsZWN0ID0gdG9vbGJhci5jcmVhdGVFbCgnc2VsZWN0JywgeyBjbHM6ICdnYnYtdG9vbGJhci1zZWxlY3QnIH0pO1xyXG5cdFx0Zm9yIChjb25zdCBvcHQgb2YgQ09MT1JfQllfT1BUSU9OUykge1xyXG5cdFx0XHRjb25zdCBvID0gY29sb3JCeVNlbGVjdC5jcmVhdGVFbCgnb3B0aW9uJywgeyB0ZXh0OiBDT0xPUl9CWV9MQUJFTFNbb3B0XSB9KTtcclxuXHRcdFx0by52YWx1ZSA9IG9wdDtcclxuXHRcdFx0aWYgKG9wdCA9PT0gdGhpcy5fbG9jYWxDb2xvckJ5KSBvLnNlbGVjdGVkID0gdHJ1ZTtcclxuXHRcdH1cclxuXHRcdGNvbG9yQnlTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xyXG5cdFx0XHR0aGlzLl9sb2NhbENvbG9yQnkgPSBjb2xvckJ5U2VsZWN0LnZhbHVlIGFzIENvbG9yQnlGaWVsZDtcclxuXHRcdFx0dGhpcy5fcmVuZGVyKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0b29sYmFyLmNyZWF0ZUVsKCdkaXYnLCB7IGNsczogJ2didi10b29sYmFyLXNlcGFyYXRvcicgfSk7XHJcblxyXG5cdFx0Ly8gVmlvbGF0aW9uIGNoZWNrIGJ1dHRvblxyXG5cdFx0Y29uc3QgdmlvbGF0aW9uQnRuID0gdG9vbGJhci5jcmVhdGVFbCgnYnV0dG9uJywge1xyXG5cdFx0XHR0ZXh0OiB2aW9sYXRpb25zLmxlbmd0aCA+IDAgPyBgXHUyNkEwIEZpeCBTY2hlZHVsZSAoJHt2aW9sYXRpb25zLmxlbmd0aH0pYCA6ICdcdTI3MTMgU2NoZWR1bGUgT0snLFxyXG5cdFx0XHRjbHM6IHZpb2xhdGlvbnMubGVuZ3RoID4gMCA/ICdnYnYtYnRuIGdidi1idG4tLXdhcm4nIDogJ2didi1idG4gZ2J2LWJ0bi0tb2snLFxyXG5cdFx0fSk7XHJcblx0XHRpZiAodmlvbGF0aW9ucy5sZW5ndGggPiAwKSB7XHJcblx0XHRcdHZpb2xhdGlvbkJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuXHRcdFx0XHRvcGVuVmlvbGF0aW9uUGFuZWwodmlvbGF0aW9ucywgdGhpcy5hcHAsICgpID0+IHRoaXMuX3JlbmRlcigpLCB0aGlzLnBsdWdpbi5zZXR0aW5ncyk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRvb2xiYXIuY3JlYXRlRWwoJ2RpdicsIHsgY2xzOiAnZ2J2LXRvb2xiYXItc2VwYXJhdG9yJyB9KTtcclxuXHJcblx0XHQvLyBFeHBvcnQgYnV0dG9uXHJcblx0XHRjb25zdCBleHBvcnRCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7IHRleHQ6ICdDb3B5IFRTVicsIGNsczogJ2didi1idG4nIH0pO1xyXG5cdFx0ZXhwb3J0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCB0c3YgPSBleHBvcnRUb1RTVihncm91cHMsIHRpbWVsaW5lQ29uZmlnKTtcclxuXHRcdFx0YXdhaXQgY29weVRvQ2xpcGJvYXJkKHRzdik7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgX3JlbmRlckNvbHVtbkhlYWRlcnMoaGVhZGVyUm93OiBIVE1MRWxlbWVudCwgY29sdW1uczogQ29sdW1uSGVhZGVyW10pOiB2b2lkIHtcclxuXHRcdGNvbnN0IHRvcFJvdyA9IGhlYWRlclJvdy5jcmVhdGVFbCgnZGl2JywgeyBjbHM6ICdnYnYtaGVhZGVyLXRvcC1yb3cnIH0pO1xyXG5cdFx0Y29uc3QgYm90Um93ID0gaGVhZGVyUm93LmNyZWF0ZUVsKCdkaXYnLCB7IGNsczogJ2didi1oZWFkZXItYm90LXJvdycgfSk7XHJcblxyXG5cdFx0bGV0IGN1cnJlbnRHcm91cCA9ICcnO1xyXG5cdFx0bGV0IGdyb3VwQ2VsbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuXHRcdGxldCBncm91cFdpZHRoID0gMDtcclxuXHJcblx0XHRmb3IgKGNvbnN0IGNvbCBvZiBjb2x1bW5zKSB7XHJcblx0XHRcdGNvbnN0IHBpcGVJZHggPSBjb2wubGFiZWwuaW5kZXhPZignfCcpO1xyXG5cdFx0XHRjb25zdCBncm91cCA9IHBpcGVJZHggPj0gMCA/IGNvbC5sYWJlbC5zbGljZSgwLCBwaXBlSWR4KSA6ICcnO1xyXG5cdFx0XHRjb25zdCBsYWJlbCA9IHBpcGVJZHggPj0gMCA/IGNvbC5sYWJlbC5zbGljZShwaXBlSWR4ICsgMSkgOiBjb2wubGFiZWw7XHJcblxyXG5cdFx0XHQvLyBHcm91cCBiYW5kICh0b3Agcm93KSBcdTIwMTQgZW1pdCBhIG5ldyBjZWxsIHdoZW5ldmVyIHRoZSBncm91cCBjaGFuZ2VzXHJcblx0XHRcdGlmIChncm91cCAhPT0gY3VycmVudEdyb3VwKSB7XHJcblx0XHRcdFx0aWYgKGdyb3VwQ2VsbCkge1xyXG5cdFx0XHRcdFx0Z3JvdXBDZWxsLnN0eWxlLndpZHRoID0gYCR7Z3JvdXBXaWR0aH1weGA7XHJcblx0XHRcdFx0XHRncm91cENlbGwuc3R5bGUubWluV2lkdGggPSBgJHtncm91cFdpZHRofXB4YDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Z3JvdXBDZWxsID0gdG9wUm93LmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGdyb3VwLCBjbHM6ICdnYnYtaGVhZGVyLWNlbGwgZ2J2LWhlYWRlci1tb250aCcgfSk7XHJcblx0XHRcdFx0Y3VycmVudEdyb3VwID0gZ3JvdXA7XHJcblx0XHRcdFx0Z3JvdXBXaWR0aCA9IDA7XHJcblx0XHRcdH1cclxuXHRcdFx0Z3JvdXBXaWR0aCArPSBjb2wud2lkdGhQeDtcclxuXHJcblx0XHRcdC8vIENvbHVtbiBsYWJlbCAoYm90dG9tIHJvdylcclxuXHRcdFx0Y29uc3QgY2VsbCA9IGJvdFJvdy5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBsYWJlbCwgY2xzOiAnZ2J2LWhlYWRlci1jZWxsIGdidi1oZWFkZXItZGF5JyB9KTtcclxuXHRcdFx0Y2VsbC5zdHlsZS53aWR0aCA9IGAke2NvbC53aWR0aFB4fXB4YDtcclxuXHRcdFx0Y2VsbC5zdHlsZS5taW5XaWR0aCA9IGAke2NvbC53aWR0aFB4fXB4YDtcclxuXHRcdFx0Y2VsbC5zdHlsZS5mbGV4U2hyaW5rID0gJzAnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEZpbmFsaXplIHRoZSBsYXN0IGdyb3VwIGNlbGxcclxuXHRcdGlmIChncm91cENlbGwpIHtcclxuXHRcdFx0Z3JvdXBDZWxsLnN0eWxlLndpZHRoID0gYCR7Z3JvdXBXaWR0aH1weGA7XHJcblx0XHRcdGdyb3VwQ2VsbC5zdHlsZS5taW5XaWR0aCA9IGAke2dyb3VwV2lkdGh9cHhgO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cHJpdmF0ZSBfcmVuZGVyVGFza1Jvd3MoXHJcblx0XHRncm91cHM6IFRhc2tHcm91cFtdLFxyXG5cdFx0c2lkZWJhcjogSFRNTEVsZW1lbnQsXHJcblx0XHRiYXJzQXJlYTogSFRNTEVsZW1lbnQsXHJcblx0XHR0aW1lbGluZUNvbmZpZzogVGltZWxpbmVDb25maWcsXHJcblx0XHRzZXR0aW5nczogR2FudHRWaWV3U2V0dGluZ3MsXHJcblx0XHR2aW9sYXRpbmdUYXNrSWRzOiBTZXQ8c3RyaW5nPixcclxuXHRcdHRvdGFsV2lkdGg6IG51bWJlcixcclxuXHQpOiB7IHRhc2tSb3dNYXA6IE1hcDxzdHJpbmcsIG51bWJlcj47IHRvdGFsSGVpZ2h0UHg6IG51bWJlciB9IHtcclxuXHRcdGNvbnN0IHRhc2tSb3dNYXAgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xyXG5cdFx0bGV0IGN1cnJlbnRZID0gMDtcclxuXHRcdGxldCByb3dJbmRleCA9IDA7IC8vIGZvciBhbHRlcm5hdGluZyByb3cgc2hhZGluZ1xyXG5cclxuXHRcdC8vIElubmVyIGRpdiBpcyB0aGUgdHJhbnNsYXRlWSB0YXJnZXQ7IG91dGVyIC5nYnYtc2lkZWJhci1sYWJlbHMgY2xpcHMgaXQuXHJcblx0XHRjb25zdCBzaWRlYmFySW5uZXIgPSBzaWRlYmFyLnF1ZXJ5U2VsZWN0b3IoJy5nYnYtc2lkZWJhci1sYWJlbHMtaW5uZXInKSBhcyBIVE1MRWxlbWVudCA/PyBzaWRlYmFyO1xyXG5cclxuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgZ3JvdXBzKSB7XHJcblx0XHRcdGNvbnN0IGlzQ29sbGFwc2VkID0gZ3JvdXAua2V5ID8gdGhpcy5fY29sbGFwc2VkR3JvdXBzLmhhcyhncm91cC5rZXkpIDogZmFsc2U7XHJcblxyXG5cdFx0XHRpZiAoZ3JvdXAua2V5KSB7XHJcblx0XHRcdFx0Y29uc3QgdG9nZ2xlID0gKCkgPT4ge1xyXG5cdFx0XHRcdFx0aWYgKHRoaXMuX2NvbGxhcHNlZEdyb3Vwcy5oYXMoZ3JvdXAua2V5KSkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLl9jb2xsYXBzZWRHcm91cHMuZGVsZXRlKGdyb3VwLmtleSk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHR0aGlzLl9jb2xsYXBzZWRHcm91cHMuYWRkKGdyb3VwLmtleSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR0aGlzLl9yZW5kZXIoKTtcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHQvLyBTaWRlYmFyIGdyb3VwIGhlYWRlciBcdTIwMTQgY2FyZXQgKyBsYWJlbCwgY2xpY2thYmxlXHJcblx0XHRcdFx0Y29uc3Qgc2lkZWJhckhkciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0XHRcdHNpZGViYXJIZHIuY2xhc3NOYW1lID0gJ2didi1ncm91cC1oZWFkZXInO1xyXG5cdFx0XHRcdHNpZGViYXJIZHIuc3R5bGUuaGVpZ2h0ID0gYCR7R1JPVVBfSEVBREVSX0hFSUdIVH1weGA7XHJcblx0XHRcdFx0c2lkZWJhckhkci5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XHJcblx0XHRcdFx0Y29uc3QgY2FyZXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcblx0XHRcdFx0Y2FyZXQuY2xhc3NOYW1lID0gJ2didi1ncm91cC1jYXJldCc7XHJcblx0XHRcdFx0Y2FyZXQudGV4dENvbnRlbnQgPSBpc0NvbGxhcHNlZCA/ICdcdTI1QjYnIDogJ1x1MjVCQyc7XHJcblx0XHRcdFx0c2lkZWJhckhkci5hcHBlbmRDaGlsZChjYXJldCk7XHJcblx0XHRcdFx0c2lkZWJhckhkci5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShncm91cC5rZXkpKTtcclxuXHRcdFx0XHRzaWRlYmFySGRyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdG9nZ2xlKTtcclxuXHRcdFx0XHRzaWRlYmFySW5uZXIuYXBwZW5kQ2hpbGQoc2lkZWJhckhkcik7XHJcblxyXG5cdFx0XHRcdC8vIEJhcnMgZ3JvdXAgaGVhZGVyIFx1MjAxNCBubyBsYWJlbCAobGFiZWwgbGl2ZXMgaW4gc2lkZWJhciBvbmx5KTtcclxuXHRcdFx0XHQvLyBob2xkcyB0aGUgc3VtbWFyeSBiYXIgd2hlbiBjb2xsYXBzZWQsIG90aGVyd2lzZSBqdXN0IGEgZGl2aWRlciByb3cuXHJcblx0XHRcdFx0Y29uc3QgYmFyc0hkciA9IGJhcnNBcmVhLmNyZWF0ZUVsKCdkaXYnLCB7IGNsczogJ2didi1ncm91cC1oZWFkZXInIH0pO1xyXG5cdFx0XHRcdGJhcnNIZHIuc3R5bGUud2lkdGggPSBgJHt0b3RhbFdpZHRofXB4YDtcclxuXHRcdFx0XHRiYXJzSGRyLnN0eWxlLmhlaWdodCA9IGAke0dST1VQX0hFQURFUl9IRUlHSFR9cHhgO1xyXG5cdFx0XHRcdGJhcnNIZHIuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xyXG5cdFx0XHRcdGJhcnNIZHIuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xyXG5cdFx0XHRcdGJhcnNIZHIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0b2dnbGUpO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNDb2xsYXBzZWQpIHtcclxuXHRcdFx0XHRcdGNvbnN0IHNiID0gdGhpcy5fZ2V0R3JvdXBTdW1tYXJ5Qm91bmRzKGdyb3VwLnRhc2tzLCB0aW1lbGluZUNvbmZpZyk7XHJcblx0XHRcdFx0XHRpZiAoc2IpIHtcclxuXHRcdFx0XHRcdFx0Y29uc3Qgc3VtbWFyeUJhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0XHRcdFx0XHRzdW1tYXJ5QmFyLmNsYXNzTmFtZSA9ICdnYnYtc3VtbWFyeS1iYXInO1xyXG5cdFx0XHRcdFx0XHRzdW1tYXJ5QmFyLnN0eWxlLmxlZnQgPSBgJHtzYi5sZWZ0fXB4YDtcclxuXHRcdFx0XHRcdFx0c3VtbWFyeUJhci5zdHlsZS53aWR0aCA9IGAke3NiLndpZHRofXB4YDtcclxuXHRcdFx0XHRcdFx0c3VtbWFyeUJhci5zdHlsZS50b3AgPSBgJHtNYXRoLnJvdW5kKChHUk9VUF9IRUFERVJfSEVJR0hUIC0gQkFSX0hFSUdIVCkgLyAyKX1weGA7XHJcblx0XHRcdFx0XHRcdHN1bW1hcnlCYXIuc3R5bGUuaGVpZ2h0ID0gYCR7QkFSX0hFSUdIVH1weGA7XHJcblx0XHRcdFx0XHRcdGJhcnNIZHIuYXBwZW5kQ2hpbGQoc3VtbWFyeUJhcik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjdXJyZW50WSArPSBHUk9VUF9IRUFERVJfSEVJR0hUO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoaXNDb2xsYXBzZWQpIGNvbnRpbnVlO1xyXG5cclxuXHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIGdyb3VwLnRhc2tzKSB7XHJcblx0XHRcdFx0Ly8gU3RvcmUgcm93IFRPUCAobm90IGNlbnRlcikgXHUyMDE0IGRlcGVuZGVuY2llcy50cyB1c2VzIHRoaXMgdG9cclxuXHRcdFx0XHQvLyBjb21wdXRlIGV4YWN0IGJhci1jb3JuZXIgWSBjb29yZGluYXRlcyBmb3IgYXJyb3cgYW5jaG9ycy5cclxuXHRcdFx0XHR0YXNrUm93TWFwLnNldCh0YXNrLmlkLCBjdXJyZW50WSk7XHJcblx0XHRcdFx0Y29uc3QgaXNBbHQgPSByb3dJbmRleCAlIDIgPT09IDE7XHJcblx0XHRcdFx0Y29uc3QgaGFzVmlvbGF0aW9uID0gdmlvbGF0aW5nVGFza0lkcy5oYXModGFzay5pZCk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGxhYmVsRWwgPSBjcmVhdGVTaWRlYmFyTGFiZWwodGFzaywgaGFzVmlvbGF0aW9uKTtcclxuXHRcdFx0XHRpZiAoaXNBbHQpIGxhYmVsRWwuY2xhc3NMaXN0LmFkZCgnZ2J2LXNpZGViYXItbGFiZWwtLWFsdCcpO1xyXG5cdFx0XHRcdGxhYmVsRWwuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xyXG5cdFx0XHRcdGxhYmVsRWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcblx0XHRcdFx0XHRvcGVuUG9wdXBFZGl0b3IodGFzaywgbGFiZWxFbCwgdGhpcy5hcHAsICgpID0+IHRoaXMuX3JlbmRlcigpLCB0aGlzLnBsdWdpbi5zZXR0aW5ncyk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0c2lkZWJhcklubmVyLmFwcGVuZENoaWxkKGxhYmVsRWwpO1xyXG5cclxuXHRcdFx0XHRjb25zdCBiYXJSb3dFbCA9IGJhcnNBcmVhLmNyZWF0ZUVsKCdkaXYnLCB7IGNsczogJ2didi1iYXItcm93JyB9KTtcclxuXHRcdFx0XHRpZiAoaXNBbHQpIGJhclJvd0VsLmNsYXNzTGlzdC5hZGQoJ2didi1iYXItcm93LS1hbHQnKTtcclxuXHRcdFx0XHRiYXJSb3dFbC5zdHlsZS53aWR0aCA9IGAke3RvdGFsV2lkdGh9cHhgO1xyXG5cdFx0XHRcdHJvd0luZGV4Kys7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGJvdW5kcyA9IGdldFRhc2tCYXJCb3VuZHModGFzaywgdGltZWxpbmVDb25maWcpO1xyXG5cdFx0XHRcdGlmIChib3VuZHMpIHtcclxuXHRcdFx0XHRcdGNvbnN0IGJhckVsID0gY3JlYXRlVGFza0Jhcih0YXNrLCBib3VuZHMsIHNldHRpbmdzLmNvbG9yQnksIHNldHRpbmdzLnNob3dQcmlvcml0eSwgdGhpcy5wbHVnaW4uc2V0dGluZ3MpO1xyXG5cdFx0XHRcdFx0YmFyUm93RWwuYXBwZW5kQ2hpbGQoYmFyRWwpO1xyXG5cdFx0XHRcdFx0YmFyRWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRcdFx0XHRvcGVuUG9wdXBFZGl0b3IodGFzaywgYmFyRWwsIHRoaXMuYXBwLCAoKSA9PiB0aGlzLl9yZW5kZXIoKSwgdGhpcy5wbHVnaW4uc2V0dGluZ3MpO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjdXJyZW50WSArPSBST1dfSEVJR0hUO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHsgdGFza1Jvd01hcCwgdG90YWxIZWlnaHRQeDogY3VycmVudFkgfTtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgX2dldEdyb3VwU3VtbWFyeUJvdW5kcyhcclxuXHRcdHRhc2tzOiBHYW50dFRhc2tbXSxcclxuXHRcdHRpbWVsaW5lQ29uZmlnOiBUaW1lbGluZUNvbmZpZyxcclxuXHQpOiB7IGxlZnQ6IG51bWJlcjsgd2lkdGg6IG51bWJlciB9IHwgbnVsbCB7XHJcblx0XHRsZXQgbWluRGF0ZTogRGF0ZSB8IG51bGwgPSBudWxsO1xyXG5cdFx0bGV0IG1heERhdGU6IERhdGUgfCBudWxsID0gbnVsbDtcclxuXHJcblx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgdGFza3MpIHtcclxuXHRcdFx0Y29uc3Qgc3RhcnQgPSB0YXNrLnN0YXJ0RGF0ZSA/PyB0YXNrLmVuZERhdGU7XHJcblx0XHRcdGNvbnN0IGVuZCA9IHRhc2suZW5kRGF0ZSA/PyB0YXNrLnN0YXJ0RGF0ZTtcclxuXHRcdFx0aWYgKHN0YXJ0ICYmICghbWluRGF0ZSB8fCBzdGFydCA8IG1pbkRhdGUpKSBtaW5EYXRlID0gc3RhcnQ7XHJcblx0XHRcdGlmIChlbmQgJiYgKCFtYXhEYXRlIHx8IGVuZCA+IG1heERhdGUpKSBtYXhEYXRlID0gZW5kO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghbWluRGF0ZSkgcmV0dXJuIG51bGw7XHJcblx0XHRpZiAoIW1heERhdGUpIG1heERhdGUgPSBtaW5EYXRlO1xyXG5cclxuXHRcdGNvbnN0IGxlZnQgPSBkYXRlVG9QaXhlbE9mZnNldChtaW5EYXRlLCB0aW1lbGluZUNvbmZpZyk7XHJcblx0XHRjb25zdCByaWdodCA9IGRhdGVUb1BpeGVsT2Zmc2V0KG1heERhdGUsIHRpbWVsaW5lQ29uZmlnKTtcclxuXHRcdHJldHVybiB7IGxlZnQsIHdpZHRoOiBNYXRoLm1heChyaWdodCAtIGxlZnQsIHRpbWVsaW5lQ29uZmlnLnBpeGVsc1BlckRheSkgfTtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgX3JlbmRlclRvZGF5TGluZShiYXJzQXJlYTogSFRNTEVsZW1lbnQsIHRpbWVsaW5lQ29uZmlnOiBUaW1lbGluZUNvbmZpZyk6IHZvaWQge1xyXG5cdFx0Y29uc3Qgb2Zmc2V0ID0gZGF0ZVRvUGl4ZWxPZmZzZXQobmV3IERhdGUoKSwgdGltZWxpbmVDb25maWcpO1xyXG5cdFx0aWYgKG9mZnNldCA8IDApIHJldHVybjtcclxuXHJcblx0XHRjb25zdCBsaW5lID0gYmFyc0FyZWEuY3JlYXRlRWwoJ2RpdicsIHsgY2xzOiAnZ2J2LXRvZGF5LWxpbmUnIH0pO1xyXG5cdFx0bGluZS5zdHlsZS5sZWZ0ID0gYCR7b2Zmc2V0fXB4YDtcclxuXHR9XHJcblxyXG5cdHByaXZhdGUgX3dpcmVTaWRlYmFyUmVzaXplKHNpZGViYXI6IEhUTUxFbGVtZW50LCBoYW5kbGU6IEhUTUxFbGVtZW50KTogdm9pZCB7XHJcblx0XHRsZXQgc3RhcnRYID0gMDtcclxuXHRcdGxldCBzdGFydFdpZHRoID0gMDtcclxuXHJcblx0XHRoYW5kbGUuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRzdGFydFggPSBlLmNsaWVudFg7XHJcblx0XHRcdHN0YXJ0V2lkdGggPSBzaWRlYmFyLm9mZnNldFdpZHRoO1xyXG5cdFx0XHRoYW5kbGUuY2xhc3NMaXN0LmFkZCgnaXMtZHJhZ2dpbmcnKTtcclxuXHRcdFx0ZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKCdnYnYtcmVzaXppbmcnKTtcclxuXHJcblx0XHRcdGNvbnN0IG9uTW92ZSA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgbmV3V2lkdGggPSBNYXRoLm1heChNSU5fU0lERUJBUl9XSURUSCwgTWF0aC5taW4oTUFYX1NJREVCQVJfV0lEVEgsIHN0YXJ0V2lkdGggKyBlLmNsaWVudFggLSBzdGFydFgpKTtcclxuXHRcdFx0XHRzaWRlYmFyLnN0eWxlLndpZHRoID0gYCR7bmV3V2lkdGh9cHhgO1xyXG5cdFx0XHRcdHRoaXMuX3NpZGViYXJXaWR0aCA9IG5ld1dpZHRoO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Y29uc3QgY2xlYW51cCA9ICgpID0+IHtcclxuXHRcdFx0XHRoYW5kbGUuY2xhc3NMaXN0LnJlbW92ZSgnaXMtZHJhZ2dpbmcnKTtcclxuXHRcdFx0XHRkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoJ2didi1yZXNpemluZycpO1xyXG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW92ZSk7XHJcblx0XHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIGNsZWFudXApO1xyXG5cdFx0XHRcdHRoaXMuX2RyYWdDbGVhbnVwID0gbnVsbDtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdHRoaXMuX2RyYWdDbGVhbnVwID0gY2xlYW51cDtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3ZlKTtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIGNsZWFudXApO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRwcml2YXRlIF93aXJlU2Nyb2xsU3luYyhcclxuXHRcdHNpZGViYXI6IEhUTUxFbGVtZW50LFxyXG5cdFx0c2Nyb2xsQXJlYTogSFRNTEVsZW1lbnQsXHJcblx0KTogdm9pZCB7XHJcblx0XHRjb25zdCBzaWRlYmFyTGFiZWxzSW5uZXIgPSBzaWRlYmFyLnF1ZXJ5U2VsZWN0b3IoJy5nYnYtc2lkZWJhci1sYWJlbHMtaW5uZXInKSBhcyBIVE1MRWxlbWVudCA/PyBzaWRlYmFyO1xyXG5cclxuXHRcdC8vIFRyYW5zbGF0ZSBzaWRlYmFyIGxhYmVscyB2ZXJ0aWNhbGx5IHRvIG1hdGNoIHRoZSBzY3JvbGwgYXJlYSBcdTIwMTQgc2luZ2xlXHJcblx0XHQvLyBzb3VyY2Ugb2YgdHJ1dGgsIG5vIHNlcGFyYXRlIHNjcm9sbCBjb250YWluZXIgb24gdGhlIHNpZGViYXIuXHJcblx0XHQvLyBUaGUgb3V0ZXIgLmdidi1zaWRlYmFyLWxhYmVscyBoYXMgb3ZlcmZsb3c6aGlkZGVuIGFuZCBhY3RzIGFzIHRoZSBjbGlwIGJvdW5kYXJ5LlxyXG5cdFx0c2Nyb2xsQXJlYS5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCAoKSA9PiB7XHJcblx0XHRcdHNpZGViYXJMYWJlbHNJbm5lci5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWSgtJHtzY3JvbGxBcmVhLnNjcm9sbFRvcH1weClgO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gRm9yd2FyZCB3aGVlbCBldmVudHMgb24gdGhlIHNpZGViYXIgdG8gdGhlIHNjcm9sbCBhcmVhIHNvIGhvdmVyaW5nXHJcblx0XHQvLyB0aGUgc2lkZWJhciBzY3JvbGxzIGlkZW50aWNhbGx5IHRvIGhvdmVyaW5nIHRoZSBiYXJzIGFyZWEuXHJcblx0XHRzaWRlYmFyLmFkZEV2ZW50TGlzdGVuZXIoJ3doZWVsJywgKGU6IFdoZWVsRXZlbnQpID0+IHtcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRzY3JvbGxBcmVhLnNjcm9sbEJ5KHsgbGVmdDogZS5kZWx0YVgsIHRvcDogZS5kZWx0YVkgfSk7XHJcblx0XHR9LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xyXG5cdH1cclxufVxyXG4iLCAiaW1wb3J0IHR5cGUgeyBURmlsZSwgQmFzZXNFbnRyeSwgQmFzZXNQcm9wZXJ0eUlkIH0gZnJvbSAnb2JzaWRpYW4nO1xyXG5cclxuZXhwb3J0IHR5cGUgRGVwZW5kZW5jeVR5cGUgPSAnRlMnIHwgJ1NTJyB8ICdGRicgfCAnU0YnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBUYXNrRGVwZW5kZW5jeSB7XHJcblx0dGFyZ2V0UGF0aDogc3RyaW5nO1xyXG5cdHRhcmdldE5hbWU6IHN0cmluZztcclxuXHR0eXBlOiBEZXBlbmRlbmN5VHlwZTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBHYW50dFRhc2sge1xyXG5cdGlkOiBzdHJpbmc7XHJcblx0ZmlsZTogVEZpbGU7XHJcblx0dGl0bGU6IHN0cmluZztcclxuXHRzdGFydERhdGU6IERhdGUgfCBudWxsO1xyXG5cdGVuZERhdGU6IERhdGUgfCBudWxsO1xyXG5cdGNvbXBsZXRlZERhdGU6IERhdGUgfCBudWxsO1xyXG5cdHN0YXR1czogc3RyaW5nO1xyXG5cdHByaW9yaXR5OiBzdHJpbmc7XHJcblx0ZGVwZW5kZW5jaWVzOiBUYXNrRGVwZW5kZW5jeVtdO1xyXG5cdHRpbWVFc3RpbWF0ZTogbnVtYmVyIHwgbnVsbDtcclxuXHRpc01pbGVzdG9uZTogYm9vbGVhbjtcclxuXHRlbnRyeTogQmFzZXNFbnRyeTtcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgWm9vbUxldmVsID0gJ2RheScgfCAnd2VlaycgfCAnbW9udGgnIHwgJzF5ZWFyJyB8ICcyeWVhcicgfCAnM3llYXInO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBUaW1lbGluZUNvbmZpZyB7XHJcblx0c3RhcnREYXRlOiBEYXRlO1xyXG5cdGVuZERhdGU6IERhdGU7XHJcblx0em9vbTogWm9vbUxldmVsO1xyXG5cdHBpeGVsc1BlckRheTogbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIENvbHVtbkhlYWRlciB7XHJcblx0bGFiZWw6IHN0cmluZztcclxuXHRzdGFydERhdGU6IERhdGU7XHJcblx0d2lkdGhQeDogbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFRhc2tHcm91cCB7XHJcblx0a2V5OiBzdHJpbmc7XHJcblx0dGFza3M6IEdhbnR0VGFza1tdO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgUk9XX0hFSUdIVCA9IDM2O1xyXG5leHBvcnQgY29uc3QgQkFSX0hFSUdIVCA9IDI0O1xyXG5leHBvcnQgY29uc3QgQkFSX01BUkdJTl9UT1AgPSA2O1xyXG5leHBvcnQgY29uc3QgU0lERUJBUl9XSURUSCA9IDIwMDtcclxuZXhwb3J0IGNvbnN0IEhFQURFUl9IRUlHSFQgPSA0ODtcclxuZXhwb3J0IGNvbnN0IEdST1VQX0hFQURFUl9IRUlHSFQgPSAyNDtcclxuZXhwb3J0IGNvbnN0IFRJTUVMSU5FX1BBRERJTkdfREFZUyA9IDc7XHJcbmV4cG9ydCBjb25zdCBNSU5fVElNRUxJTkVfV0lEVEggPSA0MDA7XHJcbmV4cG9ydCBjb25zdCBNSU5fQkFSX0xBQkVMX1dJRFRIID0gNTA7XHJcbmV4cG9ydCBjb25zdCBNSU5fU0lERUJBUl9XSURUSCA9IDEyMDtcclxuZXhwb3J0IGNvbnN0IE1BWF9TSURFQkFSX1dJRFRIID0gNTIwO1xyXG5cclxuZXhwb3J0IGNvbnN0IFNUQVRVU19DT0xPUlM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XHJcblx0J3RvLWRvJzogJ3ZhcigtLWdidi1zdGF0dXMtdG9kbywgIzg2OGU5NiknLFxyXG5cdCdpbi1wcm9ncmVzcyc6ICd2YXIoLS1nYnYtc3RhdHVzLWlucHJvZ3Jlc3MsICMzMzlhZjApJyxcclxuXHQnZG9uZSc6ICd2YXIoLS1nYnYtc3RhdHVzLWRvbmUsICM1MWNmNjYpJyxcclxuXHQnYmxvY2tlZCc6ICd2YXIoLS1nYnYtc3RhdHVzLWJsb2NrZWQsICNmZjZiNmIpJyxcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBQUklPUklUWV9DT0xPUlM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XHJcblx0J2hpZ2gnOiAndmFyKC0tZ2J2LXByaW9yaXR5LWhpZ2gsICNmZjZiNmIpJyxcclxuXHQnbWVkaXVtJzogJ3ZhcigtLWdidi1wcmlvcml0eS1tZWRpdW0sICNmZmQ0M2IpJyxcclxuXHQnbG93JzogJ3ZhcigtLWdidi1wcmlvcml0eS1sb3csICM4NjhlOTYpJyxcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBERUZBVUxUX0JBUl9DT0xPUiA9ICd2YXIoLS1nYnYtYmFyLWRlZmF1bHQsICMzMzlhZjApJztcclxuXHJcbi8qKiBTaW5nbGUgc291cmNlIG9mIHRydXRoIGZvciBkZXBlbmRlbmN5IHR5cGUgXHUyMTk0IGZyb250bWF0dGVyIGZpZWxkIG1hcHBpbmcuICovXHJcbmV4cG9ydCBjb25zdCBERVBfRklFTERTOiBSZWFkb25seUFycmF5PHsgYmFyZTogc3RyaW5nOyBwcm9wOiBzdHJpbmc7IHR5cGU6IERlcGVuZGVuY3lUeXBlIH0+ID0gW1xyXG5cdHsgYmFyZTogJ2Jsb2NrZWRCeScsICAgICAgICBwcm9wOiAnbm90ZS5ibG9ja2VkQnknLCAgICAgICAgdHlwZTogJ0ZTJyB9LFxyXG5cdHsgYmFyZTogJ3N5bmNTdGFydCcsICAgICAgICBwcm9wOiAnbm90ZS5zeW5jU3RhcnQnLCAgICAgICAgdHlwZTogJ1NTJyB9LFxyXG5cdHsgYmFyZTogJ3N5bmNGaW5pc2gnLCAgICAgICBwcm9wOiAnbm90ZS5zeW5jRmluaXNoJywgICAgICAgdHlwZTogJ0ZGJyB9LFxyXG5cdHsgYmFyZTogJ2ZpbmlzaEFmdGVyU3RhcnQnLCBwcm9wOiAnbm90ZS5maW5pc2hBZnRlclN0YXJ0JywgdHlwZTogJ1NGJyB9LFxyXG5dO1xyXG5cclxuLyoqIFN0cmlwIFtbXHUyMDI2XV0gd2lraWxpbmsgYnJhY2tldHMgYW5kIHxhbGlhcyBzdWZmaXguICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzdHJpcFdpa2lsaW5rKHM6IHN0cmluZyk6IHN0cmluZyB7XHJcblx0bGV0IHIgPSBzLnRyaW0oKTtcclxuXHRpZiAoci5zdGFydHNXaXRoKCdbWycpICYmIHIuZW5kc1dpdGgoJ11dJykpIHIgPSByLnNsaWNlKDIsIC0yKTtcclxuXHRjb25zdCBwaXBlID0gci5pbmRleE9mKCd8Jyk7XHJcblx0aWYgKHBpcGUgPj0gMCkgciA9IHIuc2xpY2UoMCwgcGlwZSk7XHJcblx0cmV0dXJuIHIudHJpbSgpO1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBDb2xvckJ5RmllbGQgPSAnbm9uZScgfCAnc3RhdHVzJyB8ICdwcmlvcml0eSc7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFBsdWdpblNldHRpbmdzIHtcclxuXHRzdGFydERhdGVQcm9wOiBzdHJpbmc7XHJcblx0ZW5kRGF0ZVByb3A6IHN0cmluZztcclxuXHRzdGF0dXNPcHRpb25zOiBzdHJpbmdbXTtcclxuXHRwcmlvcml0eU9wdGlvbnM6IHN0cmluZ1tdO1xyXG5cdHN0YXR1c0NvbG9yczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcclxuXHRwcmlvcml0eUNvbG9yczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU1RBVFVTX09QVElPTlMgPSBbJ3RvLWRvJywgJ2luLXByb2dyZXNzJywgJ2RvbmUnLCAnYmxvY2tlZCddO1xyXG5leHBvcnQgY29uc3QgREVGQVVMVF9QUklPUklUWV9PUFRJT05TID0gWydsb3cnLCAnbWVkaXVtJywgJ2hpZ2gnXTtcclxuXHJcbmV4cG9ydCBjb25zdCBERUZBVUxUX1BMVUdJTl9TRVRUSU5HUzogUGx1Z2luU2V0dGluZ3MgPSB7XHJcblx0c3RhcnREYXRlUHJvcDogJ3NjaGVkdWxlZCcsXHJcblx0ZW5kRGF0ZVByb3A6ICdkdWUnLFxyXG5cdHN0YXR1c09wdGlvbnM6IERFRkFVTFRfU1RBVFVTX09QVElPTlMsXHJcblx0cHJpb3JpdHlPcHRpb25zOiBERUZBVUxUX1BSSU9SSVRZX09QVElPTlMsXHJcblx0c3RhdHVzQ29sb3JzOiB7fSxcclxuXHRwcmlvcml0eUNvbG9yczoge30sXHJcbn07XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEdhbnR0Vmlld1NldHRpbmdzIHtcclxuXHRzdGFydERhdGVQcm9wOiBCYXNlc1Byb3BlcnR5SWQgfCBudWxsO1xyXG5cdGVuZERhdGVQcm9wOiBCYXNlc1Byb3BlcnR5SWQgfCBudWxsO1xyXG5cdHpvb206IFpvb21MZXZlbDtcclxuXHRjb2xvckJ5OiBDb2xvckJ5RmllbGQ7XHJcblx0c2hvd0RlcGVuZGVuY2llczogYm9vbGVhbjtcclxuXHRzaG93VG9kYXk6IGJvb2xlYW47XHJcblx0c2hvd1ByaW9yaXR5OiBib29sZWFuO1xyXG5cdHZpc2libGVEZXBUeXBlczogU2V0PERlcGVuZGVuY3lUeXBlPjtcclxufVxyXG4iLCAiaW1wb3J0IHR5cGUgeyBCYXNlc0VudHJ5LCBCYXNlc1Byb3BlcnR5SWQsIEJhc2VzVmlld0NvbmZpZyB9IGZyb20gJ29ic2lkaWFuJztcclxuaW1wb3J0IHR5cGUgeyBHYW50dFRhc2ssIFRhc2tEZXBlbmRlbmN5LCBEZXBlbmRlbmN5VHlwZSwgR2FudHRWaWV3U2V0dGluZ3MsIFBsdWdpblNldHRpbmdzIH0gZnJvbSAnLi90eXBlcy50cyc7XHJcbmltcG9ydCB7IERFUF9GSUVMRFMsIHN0cmlwV2lraWxpbmssIERFRkFVTFRfUExVR0lOX1NFVFRJTkdTIH0gZnJvbSAnLi90eXBlcy50cyc7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFNldHRpbmdzKGNvbmZpZzogQmFzZXNWaWV3Q29uZmlnLCBwbHVnaW5TZXR0aW5ncz86IFBsdWdpblNldHRpbmdzKTogR2FudHRWaWV3U2V0dGluZ3Mge1xyXG5cdGNvbnN0IHN0YXJ0UHJvcCA9IHBsdWdpblNldHRpbmdzPy5zdGFydERhdGVQcm9wIHx8IERFRkFVTFRfUExVR0lOX1NFVFRJTkdTLnN0YXJ0RGF0ZVByb3A7XHJcblx0Y29uc3QgZW5kUHJvcCA9IHBsdWdpblNldHRpbmdzPy5lbmREYXRlUHJvcCB8fCBERUZBVUxUX1BMVUdJTl9TRVRUSU5HUy5lbmREYXRlUHJvcDtcclxuXHRyZXR1cm4ge1xyXG5cdFx0c3RhcnREYXRlUHJvcDogKGBub3RlLiR7c3RhcnRQcm9wfWApIGFzIEJhc2VzUHJvcGVydHlJZCxcclxuXHRcdGVuZERhdGVQcm9wOiAoYG5vdGUuJHtlbmRQcm9wfWApIGFzIEJhc2VzUHJvcGVydHlJZCxcclxuXHRcdHpvb206IChjb25maWcuZ2V0KCd6b29tJykgYXMgR2FudHRWaWV3U2V0dGluZ3NbJ3pvb20nXSkgPz8gJ3dlZWsnLFxyXG5cdFx0Y29sb3JCeTogJ25vbmUnIGFzIEdhbnR0Vmlld1NldHRpbmdzWydjb2xvckJ5J10sXHJcblx0XHRzaG93RGVwZW5kZW5jaWVzOiAoY29uZmlnLmdldCgnc2hvd0RlcGVuZGVuY2llcycpIGFzIGJvb2xlYW4pID8/IHRydWUsXHJcblx0XHRzaG93VG9kYXk6IChjb25maWcuZ2V0KCdzaG93VG9kYXknKSBhcyBib29sZWFuKSA/PyB0cnVlLFxyXG5cdFx0c2hvd1ByaW9yaXR5OiB0cnVlLFxyXG5cdFx0dmlzaWJsZURlcFR5cGVzOiBuZXcgU2V0KFsnRlMnLCAnU1MnLCAnRkYnLCAnU0YnXSBhcyBEZXBlbmRlbmN5VHlwZVtdKSxcclxuXHR9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZURhdGUodmFsdWU6IHVua25vd24pOiBEYXRlIHwgbnVsbCB7XHJcblx0aWYgKHZhbHVlID09IG51bGwpIHJldHVybiBudWxsO1xyXG5cdGNvbnN0IHN0ciA9IFN0cmluZyh2YWx1ZSkudHJpbSgpO1xyXG5cdGlmICghc3RyKSByZXR1cm4gbnVsbDtcclxuXHQvLyBQYXJzZSBZWVlZLU1NLUREIGFzIGxvY2FsIG1pZG5pZ2h0IHRvIGF2b2lkIHRoZSBVVEMtbWlkbmlnaHQgdGltZXpvbmUgc2hpZnRcclxuXHQvLyB0aGF0IG5ldyBEYXRlKFwiWVlZWS1NTS1ERFwiKSBwcm9kdWNlcyAoc2hvd3MgYXMgcHJldmlvdXMgZGF5IGluIFVUQy0gem9uZXMpLlxyXG5cdGNvbnN0IGlzbyA9IHN0ci5tYXRjaCgvXihcXGR7NH0pLShcXGR7Mn0pLShcXGR7Mn0pJC8pO1xyXG5cdGlmIChpc28pIHtcclxuXHRcdGNvbnN0IGQgPSBuZXcgRGF0ZShOdW1iZXIoaXNvWzFdKSwgTnVtYmVyKGlzb1syXSkgLSAxLCBOdW1iZXIoaXNvWzNdKSk7XHJcblx0XHRyZXR1cm4gaXNOYU4oZC5nZXRUaW1lKCkpID8gbnVsbCA6IGQ7XHJcblx0fVxyXG5cdGNvbnN0IGQgPSBuZXcgRGF0ZShzdHIpO1xyXG5cdHJldHVybiBpc05hTihkLmdldFRpbWUoKSkgPyBudWxsIDogZDtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFyc2VOdW1iZXIodmFsdWU6IHVua25vd24pOiBudW1iZXIgfCBudWxsIHtcclxuXHRpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIG51bGw7XHJcblx0Y29uc3QgbiA9IE51bWJlcih2YWx1ZSk7XHJcblx0cmV0dXJuIGlzTmFOKG4pID8gbnVsbCA6IG47XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlU3RyaW5nKHZhbHVlOiB1bmtub3duKTogc3RyaW5nIHtcclxuXHRpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuICcnO1xyXG5cdGNvbnN0IHN0ciA9IFN0cmluZyh2YWx1ZSkudHJpbSgpO1xyXG5cdGlmIChzdHIgPT09ICdudWxsJyB8fCBzdHIgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gJyc7XHJcblx0cmV0dXJuIHN0cjtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFyc2VBcnJheU9mU3RyaW5ncyh2YWx1ZTogdW5rbm93bik6IHN0cmluZ1tdIHtcclxuXHRpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIFtdO1xyXG5cdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlLmZpbHRlcih2ID0+IHYgIT0gbnVsbCkubWFwKHYgPT4gU3RyaW5nKHYpLnRyaW0oKSkuZmlsdGVyKHMgPT4gcyAmJiBzICE9PSAnbnVsbCcpO1xyXG5cdGNvbnN0IHN0ciA9IFN0cmluZyh2YWx1ZSkudHJpbSgpO1xyXG5cdGlmICghc3RyIHx8IHN0ciA9PT0gJ251bGwnKSByZXR1cm4gW107XHJcblx0Ly8gQSBzY2FsYXIgc3RyaW5nIG1heSBjb250YWluIG11bHRpcGxlIHdpa2lsaW5rczogXCJbW0FdXSwgW1tCXV1cIlxyXG5cdC8vIEV4dHJhY3QgZWFjaCBbWy4uLl1dIG9jY3VycmVuY2UgaW5kaXZpZHVhbGx5IHNvIHRoZXkncmUgc3RyaXBwZWQgY29ycmVjdGx5LlxyXG5cdGNvbnN0IG1hdGNoZXMgPSBzdHIubWF0Y2goL1xcW1xcW1teXFxdXStcXF1cXF0vZyk7XHJcblx0aWYgKG1hdGNoZXMgJiYgbWF0Y2hlcy5sZW5ndGggPiAxKSByZXR1cm4gbWF0Y2hlcztcclxuXHRyZXR1cm4gW3N0cl07XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBwYXJzZURlcGVuZGVuY2llcyhlbnRyeTogQmFzZXNFbnRyeSk6IFRhc2tEZXBlbmRlbmN5W10ge1xyXG5cdGNvbnN0IGRlcHM6IFRhc2tEZXBlbmRlbmN5W10gPSBbXTtcclxuXHJcblx0Zm9yIChjb25zdCB7IHByb3AsIHR5cGUgfSBvZiBERVBfRklFTERTKSB7XHJcblx0XHRjb25zdCB2YWx1ZSA9IGVudHJ5LmdldFZhbHVlKHByb3AgYXMgQmFzZXNQcm9wZXJ0eUlkKTtcclxuXHRcdGlmICh2YWx1ZSA9PSBudWxsKSBjb250aW51ZTtcclxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBwYXJzZUFycmF5T2ZTdHJpbmdzKHZhbHVlKSkge1xyXG5cdFx0XHRpZiAoaXRlbSkgZGVwcy5wdXNoKHsgdGFyZ2V0UGF0aDogJycsIHRhcmdldE5hbWU6IGl0ZW0sIHR5cGUgfSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gZGVwcztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RUYXNrKGVudHJ5OiBCYXNlc0VudHJ5LCBzZXR0aW5nczogR2FudHRWaWV3U2V0dGluZ3MpOiBHYW50dFRhc2sge1xyXG5cdGNvbnN0IHN0YXJ0RGF0ZSA9IHNldHRpbmdzLnN0YXJ0RGF0ZVByb3BcclxuXHRcdD8gcGFyc2VEYXRlKGVudHJ5LmdldFZhbHVlKHNldHRpbmdzLnN0YXJ0RGF0ZVByb3ApKVxyXG5cdFx0OiBudWxsO1xyXG5cdGNvbnN0IGVuZERhdGUgPSBzZXR0aW5ncy5lbmREYXRlUHJvcFxyXG5cdFx0PyBwYXJzZURhdGUoZW50cnkuZ2V0VmFsdWUoc2V0dGluZ3MuZW5kRGF0ZVByb3ApKVxyXG5cdFx0OiBudWxsO1xyXG5cdGNvbnN0IGNvbXBsZXRlZERhdGUgPSBwYXJzZURhdGUoZW50cnkuZ2V0VmFsdWUoJ25vdGUuY29tcGxldGVkRGF0ZScgYXMgQmFzZXNQcm9wZXJ0eUlkKSk7XHJcblx0Y29uc3Qgc3RhdHVzID0gcGFyc2VTdHJpbmcoZW50cnkuZ2V0VmFsdWUoJ25vdGUuc3RhdHVzJyBhcyBCYXNlc1Byb3BlcnR5SWQpKTtcclxuXHRjb25zdCBwcmlvcml0eSA9IHBhcnNlU3RyaW5nKGVudHJ5LmdldFZhbHVlKCdub3RlLnByaW9yaXR5JyBhcyBCYXNlc1Byb3BlcnR5SWQpKTtcclxuXHRjb25zdCB0aXRsZSA9IHBhcnNlU3RyaW5nKGVudHJ5LmdldFZhbHVlKCdub3RlLnRpdGxlJyBhcyBCYXNlc1Byb3BlcnR5SWQpKSB8fCBlbnRyeS5maWxlLmJhc2VuYW1lO1xyXG5cdGNvbnN0IHRpbWVFc3RpbWF0ZSA9IHBhcnNlTnVtYmVyKGVudHJ5LmdldFZhbHVlKCdub3RlLnRpbWVFc3RpbWF0ZScgYXMgQmFzZXNQcm9wZXJ0eUlkKSk7XHJcblx0Y29uc3QgZGVwZW5kZW5jaWVzID0gcGFyc2VEZXBlbmRlbmNpZXMoZW50cnkpO1xyXG5cclxuXHQvLyBBIG1pbGVzdG9uZSBpcyBhIHNpbmdsZSBwb2ludCBpbiB0aW1lOiBvbmUgZGF0ZSB3aXRoIG5vIGR1cmF0aW9uXHJcblx0Y29uc3QgaXNNaWxlc3RvbmUgPVxyXG5cdFx0KHN0YXJ0RGF0ZSAhPT0gbnVsbCAmJiBlbmREYXRlID09PSBudWxsICYmIHRpbWVFc3RpbWF0ZSA9PT0gbnVsbCkgfHxcclxuXHRcdChzdGFydERhdGUgIT09IG51bGwgJiYgZW5kRGF0ZSAhPT0gbnVsbCAmJlxyXG5cdFx0XHRzdGFydERhdGUudG9EYXRlU3RyaW5nKCkgPT09IGVuZERhdGUudG9EYXRlU3RyaW5nKCkpO1xyXG5cclxuXHRyZXR1cm4ge1xyXG5cdFx0aWQ6IGVudHJ5LmZpbGUucGF0aCxcclxuXHRcdGZpbGU6IGVudHJ5LmZpbGUsXHJcblx0XHR0aXRsZSxcclxuXHRcdHN0YXJ0RGF0ZSxcclxuXHRcdGVuZERhdGUsXHJcblx0XHRjb21wbGV0ZWREYXRlLFxyXG5cdFx0c3RhdHVzOiBzdGF0dXMudG9Mb3dlckNhc2UoKSxcclxuXHRcdHByaW9yaXR5OiBwcmlvcml0eS50b0xvd2VyQ2FzZSgpLFxyXG5cdFx0ZGVwZW5kZW5jaWVzLFxyXG5cdFx0dGltZUVzdGltYXRlLFxyXG5cdFx0aXNNaWxlc3RvbmUsXHJcblx0XHRlbnRyeSxcclxuXHR9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZURlcGVuZGVuY3lQYXRocyh0YXNrczogR2FudHRUYXNrW10pOiB2b2lkIHtcclxuXHRjb25zdCBuYW1lVG9QYXRoID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcclxuXHRmb3IgKGNvbnN0IHRhc2sgb2YgdGFza3MpIHtcclxuXHRcdG5hbWVUb1BhdGguc2V0KHRhc2suZmlsZS5iYXNlbmFtZS50b0xvd2VyQ2FzZSgpLCB0YXNrLmlkKTtcclxuXHRcdC8vIEFsc28gbWFwIGJ5IHRpdGxlXHJcblx0XHRpZiAodGFzay50aXRsZSkge1xyXG5cdFx0XHRuYW1lVG9QYXRoLnNldCh0YXNrLnRpdGxlLnRvTG93ZXJDYXNlKCksIHRhc2suaWQpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Zm9yIChjb25zdCB0YXNrIG9mIHRhc2tzKSB7XHJcblx0XHRmb3IgKGNvbnN0IGRlcCBvZiB0YXNrLmRlcGVuZGVuY2llcykge1xyXG5cdFx0XHRjb25zdCBiYXJlID0gc3RyaXBXaWtpbGluayhkZXAudGFyZ2V0TmFtZSkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0Y29uc3QgcmVzb2x2ZWQgPSBuYW1lVG9QYXRoLmdldChiYXJlKSA/PyBuYW1lVG9QYXRoLmdldChkZXAudGFyZ2V0TmFtZS50b0xvd2VyQ2FzZSgpKTtcclxuXHRcdFx0aWYgKHJlc29sdmVkKSB7XHJcblx0XHRcdFx0ZGVwLnRhcmdldFBhdGggPSByZXNvbHZlZDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufVxyXG4iLCAiaW1wb3J0IHR5cGUgeyBHYW50dFRhc2ssIFRpbWVsaW5lQ29uZmlnLCBDb2x1bW5IZWFkZXIsIFpvb21MZXZlbCB9IGZyb20gJy4vdHlwZXMudHMnO1xyXG5pbXBvcnQgeyBUSU1FTElORV9QQURESU5HX0RBWVMgfSBmcm9tICcuL3R5cGVzLnRzJztcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRQaXhlbHNQZXJEYXkoem9vbTogWm9vbUxldmVsKTogbnVtYmVyIHtcclxuXHRzd2l0Y2ggKHpvb20pIHtcclxuXHRcdGNhc2UgJ2RheSc6ICAgIHJldHVybiA0MDtcclxuXHRcdGNhc2UgJ3dlZWsnOiAgIHJldHVybiAxMjtcclxuXHRcdGNhc2UgJ21vbnRoJzogIHJldHVybiAzO1xyXG5cdFx0Y2FzZSAnMXllYXInOiAgcmV0dXJuIDE7XHJcblx0XHRjYXNlICcyeWVhcic6ICByZXR1cm4gMC41O1xyXG5cdFx0Y2FzZSAnM3llYXInOiAgcmV0dXJuIDAuMzQ7XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY29tcHV0ZVRpbWVsaW5lUmFuZ2UodGFza3M6IEdhbnR0VGFza1tdLCB6b29tOiBab29tTGV2ZWwpOiBUaW1lbGluZUNvbmZpZyB7XHJcblx0Y29uc3Qgbm93ID0gbmV3IERhdGUoKTtcclxuXHRsZXQgZWFybGllc3QgPSBuZXcgRGF0ZShub3cpO1xyXG5cdGxldCBsYXRlc3QgPSBuZXcgRGF0ZShub3cpO1xyXG5cclxuXHRmb3IgKGNvbnN0IHRhc2sgb2YgdGFza3MpIHtcclxuXHRcdGlmICh0YXNrLnN0YXJ0RGF0ZSAmJiB0YXNrLnN0YXJ0RGF0ZSA8IGVhcmxpZXN0KSBlYXJsaWVzdCA9IG5ldyBEYXRlKHRhc2suc3RhcnREYXRlKTtcclxuXHRcdGlmICh0YXNrLmVuZERhdGUgJiYgdGFzay5lbmREYXRlID4gbGF0ZXN0KSBsYXRlc3QgPSBuZXcgRGF0ZSh0YXNrLmVuZERhdGUpO1xyXG5cdFx0aWYgKHRhc2suc3RhcnREYXRlICYmIHRhc2suc3RhcnREYXRlID4gbGF0ZXN0KSBsYXRlc3QgPSBuZXcgRGF0ZSh0YXNrLnN0YXJ0RGF0ZSk7XHJcblx0XHRpZiAodGFzay5lbmREYXRlICYmIHRhc2suZW5kRGF0ZSA8IGVhcmxpZXN0KSBlYXJsaWVzdCA9IG5ldyBEYXRlKHRhc2suZW5kRGF0ZSk7XHJcblx0XHRpZiAodGFzay5jb21wbGV0ZWREYXRlICYmIHRhc2suY29tcGxldGVkRGF0ZSA8IGVhcmxpZXN0KSBlYXJsaWVzdCA9IG5ldyBEYXRlKHRhc2suY29tcGxldGVkRGF0ZSk7XHJcblx0XHRpZiAodGFzay5jb21wbGV0ZWREYXRlICYmIHRhc2suY29tcGxldGVkRGF0ZSA+IGxhdGVzdCkgbGF0ZXN0ID0gbmV3IERhdGUodGFzay5jb21wbGV0ZWREYXRlKTtcclxuXHR9XHJcblxyXG5cdC8vIEFkZCBwYWRkaW5nXHJcblx0ZWFybGllc3Quc2V0RGF0ZShlYXJsaWVzdC5nZXREYXRlKCkgLSBUSU1FTElORV9QQURESU5HX0RBWVMpO1xyXG5cdGxhdGVzdC5zZXREYXRlKGxhdGVzdC5nZXREYXRlKCkgKyBUSU1FTElORV9QQURESU5HX0RBWVMpO1xyXG5cclxuXHQvLyBTbmFwIHRvIHN0YXJ0IG9mIHBlcmlvZFxyXG5cdGlmICh6b29tID09PSAnMXllYXInIHx8IHpvb20gPT09ICcyeWVhcicgfHwgem9vbSA9PT0gJzN5ZWFyJykge1xyXG5cdFx0ZWFybGllc3QgPSBuZXcgRGF0ZShlYXJsaWVzdC5nZXRGdWxsWWVhcigpLCAwLCAxKTtcclxuXHRcdGxhdGVzdCA9IG5ldyBEYXRlKGxhdGVzdC5nZXRGdWxsWWVhcigpICsgMSwgMCwgMSk7XHJcblx0fSBlbHNlIGlmICh6b29tID09PSAnbW9udGgnKSB7XHJcblx0XHRlYXJsaWVzdC5zZXREYXRlKDEpO1xyXG5cdH0gZWxzZSBpZiAoem9vbSA9PT0gJ3dlZWsnKSB7XHJcblx0XHRjb25zdCBkYXkgPSBlYXJsaWVzdC5nZXREYXkoKTtcclxuXHRcdGVhcmxpZXN0LnNldERhdGUoZWFybGllc3QuZ2V0RGF0ZSgpIC0gZGF5KTtcclxuXHR9XHJcblxyXG5cdGVhcmxpZXN0ID0gc25hcFRvRGF5KGVhcmxpZXN0KTtcclxuXHRsYXRlc3QgPSBzbmFwVG9EYXkobGF0ZXN0KTtcclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdHN0YXJ0RGF0ZTogZWFybGllc3QsXHJcblx0XHRlbmREYXRlOiBsYXRlc3QsXHJcblx0XHR6b29tLFxyXG5cdFx0cGl4ZWxzUGVyRGF5OiBnZXRQaXhlbHNQZXJEYXkoem9vbSksXHJcblx0fTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGRhdGVUb1BpeGVsT2Zmc2V0KGRhdGU6IERhdGUsIGNvbmZpZzogVGltZWxpbmVDb25maWcpOiBudW1iZXIge1xyXG5cdGNvbnN0IGRpZmZNcyA9IGRhdGUuZ2V0VGltZSgpIC0gY29uZmlnLnN0YXJ0RGF0ZS5nZXRUaW1lKCk7XHJcblx0Y29uc3QgZGlmZkRheXMgPSBkaWZmTXMgLyAoMTAwMCAqIDYwICogNjAgKiAyNCk7XHJcblx0cmV0dXJuIE1hdGgucm91bmQoZGlmZkRheXMgKiBjb25maWcucGl4ZWxzUGVyRGF5KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNuYXBUb0RheShkYXRlOiBEYXRlKTogRGF0ZSB7XHJcblx0Y29uc3QgZCA9IG5ldyBEYXRlKGRhdGUpO1xyXG5cdGQuc2V0SG91cnMoMCwgMCwgMCwgMCk7XHJcblx0cmV0dXJuIGQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBkYXlzQmV0d2VlbihhOiBEYXRlLCBiOiBEYXRlKTogbnVtYmVyIHtcclxuXHRjb25zdCBkaWZmTXMgPSBiLmdldFRpbWUoKSAtIGEuZ2V0VGltZSgpO1xyXG5cdHJldHVybiBNYXRoLnJvdW5kKGRpZmZNcyAvICgxMDAwICogNjAgKiA2MCAqIDI0KSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXREYXRlKGRhdGU6IERhdGUpOiBzdHJpbmcge1xyXG5cdGNvbnN0IHkgPSBkYXRlLmdldEZ1bGxZZWFyKCk7XHJcblx0Y29uc3QgbSA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xyXG5cdGNvbnN0IGQgPSBTdHJpbmcoZGF0ZS5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsICcwJyk7XHJcblx0cmV0dXJuIGAke3l9LSR7bX0tJHtkfWA7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB0b3RhbFRpbWVsaW5lV2lkdGgoY29uZmlnOiBUaW1lbGluZUNvbmZpZyk6IG51bWJlciB7XHJcblx0cmV0dXJuIGRhdGVUb1BpeGVsT2Zmc2V0KGNvbmZpZy5lbmREYXRlLCBjb25maWcpO1xyXG59XHJcblxyXG4vKiogU3VtIG9mIGFsbCByZW5kZXJlZCBjb2x1bW4gd2lkdGhzIFx1MjAxNCB1c2UgdGhpcyBmb3Igc2l6aW5nIHRoZSBiYXJzL2hlYWRlciBhcmVhXHJcbiAqICBzbyB0aGUgbGFzdCBjb2x1bW4gaGVhZGVyIGlzIG5ldmVyIGNsaXBwZWQgb3Igb3JwaGFuZWQuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjb2x1bW5zV2lkdGgoY29sdW1uczogQ29sdW1uSGVhZGVyW10pOiBudW1iZXIge1xyXG5cdHJldHVybiBjb2x1bW5zLnJlZHVjZSgoc3VtLCBjb2wpID0+IHN1bSArIGNvbC53aWR0aFB4LCAwKTtcclxufVxyXG5cclxuLyoqIFJldHVybnMgSVNPIDg2MDEgd2VlayBudW1iZXIgYW5kIHRoZSBJU08gd2Vlay15ZWFyIGZvciBhIGRhdGUuICovXHJcbmZ1bmN0aW9uIGlzb1dlZWsoZGF0ZTogRGF0ZSk6IHsgd2VlazogbnVtYmVyOyB5ZWFyOiBudW1iZXIgfSB7XHJcblx0Ly8gV29yayBpbiBVVEMgdG8gYXZvaWQgRFNUIGlzc3Vlc1xyXG5cdGNvbnN0IGQgPSBuZXcgRGF0ZShEYXRlLlVUQyhkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkpKTtcclxuXHRjb25zdCBkYXkgPSBkLmdldFVUQ0RheSgpIHx8IDc7IC8vIDE9TW9uIFx1MjAyNiA3PVN1blxyXG5cdGQuc2V0VVRDRGF0ZShkLmdldFVUQ0RhdGUoKSArIDQgLSBkYXkpOyAvLyBzaGlmdCB0byBuZWFyZXN0IFRodXJzZGF5XHJcblx0Y29uc3QgeWVhclN0YXJ0ID0gbmV3IERhdGUoRGF0ZS5VVEMoZC5nZXRVVENGdWxsWWVhcigpLCAwLCAxKSk7XHJcblx0Y29uc3Qgd2VlayA9IE1hdGguY2VpbCgoKGQuZ2V0VGltZSgpIC0geWVhclN0YXJ0LmdldFRpbWUoKSkgLyA4Nl80MDBfMDAwICsgMSkgLyA3KTtcclxuXHRyZXR1cm4geyB3ZWVrLCB5ZWFyOiBkLmdldFVUQ0Z1bGxZZWFyKCkgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ29sdW1ucyhjb25maWc6IFRpbWVsaW5lQ29uZmlnKTogQ29sdW1uSGVhZGVyW10ge1xyXG5cdGNvbnN0IGNvbHVtbnM6IENvbHVtbkhlYWRlcltdID0gW107XHJcblx0Y29uc3QgY3Vyc29yID0gbmV3IERhdGUoY29uZmlnLnN0YXJ0RGF0ZSk7XHJcblxyXG5cdHN3aXRjaCAoY29uZmlnLnpvb20pIHtcclxuXHRcdGNhc2UgJ2RheSc6IHtcclxuXHRcdFx0Ly8gR3JvdXAgYnkgbW9udGggXHUyMDE0IGVtaXQgYSBtb250aC1zcGFuIGhlYWRlciBmaXJzdCwgdGhlbiBwZXItZGF5IGNvbHVtbnNcclxuXHRcdFx0Ly8gV2UgZW5jb2RlIG1vbnRoIGJyZWFrcyBhcyBhIHNwZWNpYWwgbGFiZWwgcHJlZml4IHNvIHRoZSByZW5kZXJlciBjYW5cclxuXHRcdFx0Ly8gc3BsaXQgaW50byB0d28gcm93czogbW9udGggc3RyaXAgb24gdG9wLCBkYXkgbnVtYmVycyBiZWxvdy5cclxuXHRcdFx0d2hpbGUgKGN1cnNvciA8PSBjb25maWcuZW5kRGF0ZSkge1xyXG5cdFx0XHRcdGNvbnN0IGRheU51bSA9IGN1cnNvci5nZXREYXRlKCk7XHJcblx0XHRcdFx0Y29uc3QgbW9udGggPSBjdXJzb3IudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1VUycsIHsgbW9udGg6ICdzaG9ydCcsIHllYXI6ICdudW1lcmljJyB9KTtcclxuXHRcdFx0XHQvLyBMYWJlbCBmb3JtYXQ6IFwibW9udGh8ZGF5XCIgXHUyMDE0IHJlbmRlcmVyIHNwbGl0cyBvbiAnfCdcclxuXHRcdFx0XHRjb2x1bW5zLnB1c2goe1xyXG5cdFx0XHRcdFx0bGFiZWw6IGAke21vbnRofXwke2RheU51bX1gLFxyXG5cdFx0XHRcdFx0c3RhcnREYXRlOiBuZXcgRGF0ZShjdXJzb3IpLFxyXG5cdFx0XHRcdFx0d2lkdGhQeDogY29uZmlnLnBpeGVsc1BlckRheSxcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0XHRjdXJzb3Iuc2V0RGF0ZShjdXJzb3IuZ2V0RGF0ZSgpICsgMSk7XHJcblx0XHRcdH1cclxuXHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblxyXG5cdFx0Y2FzZSAnd2Vlayc6IHtcclxuXHRcdFx0d2hpbGUgKGN1cnNvciA8PSBjb25maWcuZW5kRGF0ZSkge1xyXG5cdFx0XHRcdGNvbnN0IHdlZWtTdGFydCA9IG5ldyBEYXRlKGN1cnNvcik7XHJcblx0XHRcdFx0Ly8gVXNlIHRoZSBNb25kYXkgb2YgdGhpcyB3ZWVrIGZvciBJU08gd2VlayBjYWxjdWxhdGlvblxyXG5cdFx0XHRcdC8vIChjb2x1bW5zIHNuYXAgdG8gU3VuZGF5LCBzbyArMSBnaXZlcyB0aGUgSVNPIHdlZWsgTW9uZGF5KVxyXG5cdFx0XHRcdGNvbnN0IG1vbmRheSA9IG5ldyBEYXRlKHdlZWtTdGFydCk7XHJcblx0XHRcdFx0bW9uZGF5LnNldERhdGUobW9uZGF5LmdldERhdGUoKSArIDEpO1xyXG5cdFx0XHRcdGNvbnN0IHsgd2VlaywgeWVhciB9ID0gaXNvV2Vlayhtb25kYXkpO1xyXG5cdFx0XHRcdGNvbHVtbnMucHVzaCh7XHJcblx0XHRcdFx0XHRsYWJlbDogYCR7eWVhcn18VyR7d2Vla31gLFxyXG5cdFx0XHRcdFx0c3RhcnREYXRlOiBuZXcgRGF0ZSh3ZWVrU3RhcnQpLFxyXG5cdFx0XHRcdFx0d2lkdGhQeDogNyAqIGNvbmZpZy5waXhlbHNQZXJEYXksXHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0Y3Vyc29yLnNldERhdGUoY3Vyc29yLmdldERhdGUoKSArIDcpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNhc2UgJ21vbnRoJzoge1xyXG5cdFx0XHR3aGlsZSAoY3Vyc29yIDw9IGNvbmZpZy5lbmREYXRlKSB7XHJcblx0XHRcdFx0Y29uc3QgbW9udGhTdGFydCA9IG5ldyBEYXRlKGN1cnNvci5nZXRGdWxsWWVhcigpLCBjdXJzb3IuZ2V0TW9udGgoKSwgMSk7XHJcblx0XHRcdFx0Y29uc3QgbW9udGhFbmQgPSBuZXcgRGF0ZShjdXJzb3IuZ2V0RnVsbFllYXIoKSwgY3Vyc29yLmdldE1vbnRoKCkgKyAxLCAwKTtcclxuXHRcdFx0XHRjb25zdCBkYXlzSW5Nb250aCA9IG1vbnRoRW5kLmdldERhdGUoKTtcclxuXHRcdFx0XHRjb25zdCB5ZWFyID0gU3RyaW5nKG1vbnRoU3RhcnQuZ2V0RnVsbFllYXIoKSk7XHJcblx0XHRcdFx0Y29uc3QgbW9udGhOYW1lID0gbW9udGhTdGFydC50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLVVTJywgeyBtb250aDogJ3Nob3J0JyB9KTtcclxuXHRcdFx0XHRjb2x1bW5zLnB1c2goe1xyXG5cdFx0XHRcdFx0bGFiZWw6IGAke3llYXJ9fCR7bW9udGhOYW1lfWAsXHJcblx0XHRcdFx0XHRzdGFydERhdGU6IG5ldyBEYXRlKG1vbnRoU3RhcnQpLFxyXG5cdFx0XHRcdFx0d2lkdGhQeDogZGF5c0luTW9udGggKiBjb25maWcucGl4ZWxzUGVyRGF5LFxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHRcdGN1cnNvci5zZXRNb250aChjdXJzb3IuZ2V0TW9udGgoKSArIDEpO1xyXG5cdFx0XHRcdGN1cnNvci5zZXREYXRlKDEpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNhc2UgJzF5ZWFyJzpcclxuXHRcdGNhc2UgJzJ5ZWFyJzpcclxuXHRcdGNhc2UgJzN5ZWFyJzoge1xyXG5cdFx0XHQvLyBRdWFydGVyIGNvbHVtbnMgd2l0aGluIGVhY2ggeWVhciwgZ3JvdXBlZCBieSB5ZWFyXHJcblx0XHRcdHdoaWxlIChjdXJzb3IgPD0gY29uZmlnLmVuZERhdGUpIHtcclxuXHRcdFx0XHRjb25zdCB5ZWFyID0gY3Vyc29yLmdldEZ1bGxZZWFyKCk7XHJcblx0XHRcdFx0Y29uc3QgcSA9IE1hdGguZmxvb3IoY3Vyc29yLmdldE1vbnRoKCkgLyAzKTsgLy8gMFx1MjAxMzNcclxuXHRcdFx0XHRjb25zdCBxU3RhcnQgPSBuZXcgRGF0ZSh5ZWFyLCBxICogMywgMSk7XHJcblx0XHRcdFx0Y29uc3QgcUVuZCA9IG5ldyBEYXRlKHllYXIsIHEgKiAzICsgMywgMCk7XHJcblx0XHRcdFx0Y29uc3QgZGF5c0luUSA9IE1hdGgucm91bmQoKHFFbmQuZ2V0VGltZSgpIC0gcVN0YXJ0LmdldFRpbWUoKSkgLyA4NjQwMDAwMCkgKyAxO1xyXG5cdFx0XHRcdGNvbHVtbnMucHVzaCh7XHJcblx0XHRcdFx0XHRsYWJlbDogYCR7eWVhcn18USR7cSArIDF9YCxcclxuXHRcdFx0XHRcdHN0YXJ0RGF0ZTogbmV3IERhdGUocVN0YXJ0KSxcclxuXHRcdFx0XHRcdHdpZHRoUHg6IGRheXNJblEgKiBjb25maWcucGl4ZWxzUGVyRGF5LFxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHRcdGN1cnNvci5zZXRNb250aChxICogMyArIDMpO1xyXG5cdFx0XHRcdGN1cnNvci5zZXREYXRlKDEpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGNvbHVtbnM7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRUYXNrQmFyQm91bmRzKFxyXG5cdHRhc2s6IEdhbnR0VGFzayxcclxuXHRjb25maWc6IFRpbWVsaW5lQ29uZmlnLFxyXG4pOiB7IGxlZnQ6IG51bWJlcjsgd2lkdGg6IG51bWJlciB9IHwgbnVsbCB7XHJcblx0bGV0IHN0YXJ0ID0gdGFzay5zdGFydERhdGU7XHJcblx0bGV0IGVuZCA9IHRhc2suZW5kRGF0ZTtcclxuXHJcblx0aWYgKCFzdGFydCAmJiAhZW5kKSByZXR1cm4gbnVsbDtcclxuXHJcblx0aWYgKHN0YXJ0ICYmICFlbmQpIHtcclxuXHRcdGlmICh0YXNrLnRpbWVFc3RpbWF0ZSkge1xyXG5cdFx0XHRlbmQgPSBuZXcgRGF0ZShzdGFydCk7XHJcblx0XHRcdGVuZC5zZXREYXRlKGVuZC5nZXREYXRlKCkgKyBNYXRoLmNlaWwodGFzay50aW1lRXN0aW1hdGUgLyAoNjAgKiA4KSkpOyAvLyA4aHIgZGF5c1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZW5kID0gbmV3IERhdGUoc3RhcnQpO1xyXG5cdFx0XHRlbmQuc2V0RGF0ZShlbmQuZ2V0RGF0ZSgpICsgMSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpZiAoIXN0YXJ0ICYmIGVuZCkge1xyXG5cdFx0c3RhcnQgPSBuZXcgRGF0ZShlbmQpO1xyXG5cdFx0c3RhcnQuc2V0RGF0ZShzdGFydC5nZXREYXRlKCkgLSAxKTtcclxuXHR9XHJcblxyXG5cdGNvbnN0IGxlZnQgPSBkYXRlVG9QaXhlbE9mZnNldChzdGFydCEsIGNvbmZpZyk7XHJcblx0Y29uc3QgcmlnaHQgPSBkYXRlVG9QaXhlbE9mZnNldChlbmQhLCBjb25maWcpO1xyXG5cdGNvbnN0IHdpZHRoID0gTWF0aC5tYXgocmlnaHQgLSBsZWZ0LCBjb25maWcucGl4ZWxzUGVyRGF5KTtcclxuXHJcblx0cmV0dXJuIHsgbGVmdCwgd2lkdGggfTtcclxufVxyXG4iLCAiaW1wb3J0IHsgSEVBREVSX0hFSUdIVCB9IGZyb20gJy4vdHlwZXMudHMnO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRHYW50dFNjYWZmb2xkKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB7XG4gIHRvb2xiYXI6IEhUTUxFbGVtZW50O1xuICBib2R5OiBIVE1MRWxlbWVudDtcbiAgc2lkZWJhcjogSFRNTEVsZW1lbnQ7XG4gIHJlc2l6ZUhhbmRsZTogSFRNTEVsZW1lbnQ7XG4gIHNjcm9sbEFyZWE6IEhUTUxFbGVtZW50O1xuICBoZWFkZXJSb3c6IEhUTUxFbGVtZW50O1xuICBiYXJzQXJlYTogSFRNTEVsZW1lbnQ7XG4gIHN2Z0xheWVyOiBTVkdTVkdFbGVtZW50O1xufSB7XG4gIGNvbnN0IHRvb2xiYXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiAnZ2J2LXRvb2xiYXInIH0pO1xuICBjb25zdCBib2R5ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2didi1ib2R5JyB9KTtcbiAgY29uc3Qgc2lkZWJhciA9IGJvZHkuY3JlYXRlRGl2KHsgY2xzOiAnZ2J2LXNpZGViYXInIH0pO1xuXG4gIGNvbnN0IHNpZGViYXJIZWFkZXIgPSBzaWRlYmFyLmNyZWF0ZURpdih7IGNsczogJ2didi1zaWRlYmFyLWhlYWRlcicgfSk7XG4gIHNpZGViYXJIZWFkZXIuc3R5bGUuaGVpZ2h0ID0gYCR7SEVBREVSX0hFSUdIVH1weGA7XG5cbiAgc2lkZWJhci5jcmVhdGVEaXYoeyBjbHM6ICdnYnYtc2lkZWJhci1sYWJlbHMnIH0pXG4gICAgLmNyZWF0ZURpdih7IGNsczogJ2didi1zaWRlYmFyLWxhYmVscy1pbm5lcicgfSk7XG5cbiAgY29uc3QgcmVzaXplSGFuZGxlID0gYm9keS5jcmVhdGVEaXYoeyBjbHM6ICdnYnYtc2lkZWJhci1yZXNpemUnIH0pO1xuICBjb25zdCBzY3JvbGxBcmVhID0gYm9keS5jcmVhdGVEaXYoeyBjbHM6ICdnYnYtc2Nyb2xsLWFyZWEnIH0pO1xuXG4gIGNvbnN0IGhlYWRlclJvdyA9IHNjcm9sbEFyZWEuY3JlYXRlRGl2KHsgY2xzOiAnZ2J2LWhlYWRlci1yb3cnIH0pO1xuICBoZWFkZXJSb3cuc3R5bGUuaGVpZ2h0ID0gYCR7SEVBREVSX0hFSUdIVH1weGA7XG5cbiAgY29uc3QgYmFyc0FyZWEgPSBzY3JvbGxBcmVhLmNyZWF0ZURpdih7IGNsczogJ2didi1iYXJzLWFyZWEnIH0pO1xuXG4gIGNvbnN0IHN2Z0xheWVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKCdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZycsICdzdmcnKSBhcyBTVkdTVkdFbGVtZW50O1xuICBzdmdMYXllci5jbGFzc0xpc3QuYWRkKCdnYnYtc3ZnLWxheWVyJyk7XG4gIGJhcnNBcmVhLmFwcGVuZENoaWxkKHN2Z0xheWVyKTtcblxuICByZXR1cm4geyB0b29sYmFyLCBib2R5LCBzaWRlYmFyLCByZXNpemVIYW5kbGUsIHNjcm9sbEFyZWEsIGhlYWRlclJvdywgYmFyc0FyZWEsIHN2Z0xheWVyIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRUaW1lbGluZVdpZHRoKFxuICBzY3JvbGxBcmVhOiBIVE1MRWxlbWVudCxcbiAgYmFyc0FyZWE6IEhUTUxFbGVtZW50LFxuICBzdmdMYXllcjogU1ZHU1ZHRWxlbWVudCxcbiAgd2lkdGg6IG51bWJlcixcbiAgdG90YWxIZWlnaHQ6IG51bWJlcixcbik6IHZvaWQge1xuICBiYXJzQXJlYS5zdHlsZS5taW5XaWR0aCA9IGAke3dpZHRofXB4YDtcblxuICBjb25zdCBoZWFkZXJSb3cgPSBzY3JvbGxBcmVhLnF1ZXJ5U2VsZWN0b3IoJy5nYnYtaGVhZGVyLXJvdycpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKGhlYWRlclJvdykge1xuICAgIGhlYWRlclJvdy5zdHlsZS5taW5XaWR0aCA9IGAke3dpZHRofXB4YDtcbiAgfVxuXG4gIHN2Z0xheWVyLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCBTdHJpbmcod2lkdGgpKTtcbiAgc3ZnTGF5ZXIuc2V0QXR0cmlidXRlKCdoZWlnaHQnLCBTdHJpbmcodG90YWxIZWlnaHQpKTtcbiAgc3ZnTGF5ZXIuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGA7XG4gIHN2Z0xheWVyLnN0eWxlLmhlaWdodCA9IGAke3RvdGFsSGVpZ2h0fXB4YDtcbn1cbiIsICJpbXBvcnQge1xyXG5cdFNUQVRVU19DT0xPUlMsXHJcblx0UFJJT1JJVFlfQ09MT1JTLFxyXG5cdERFRkFVTFRfQkFSX0NPTE9SLFxyXG5cdHR5cGUgQ29sb3JCeUZpZWxkLFxyXG5cdHR5cGUgR2FudHRUYXNrLFxyXG5cdHR5cGUgUGx1Z2luU2V0dGluZ3MsXHJcbn0gZnJvbSAnLi90eXBlcy50cyc7XHJcblxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldEJhckNvbG9yKHRhc2s6IEdhbnR0VGFzaywgY29sb3JCeTogQ29sb3JCeUZpZWxkLCBwbHVnaW5TZXR0aW5ncz86IFBsdWdpblNldHRpbmdzKTogc3RyaW5nIHtcclxuXHRpZiAoY29sb3JCeSA9PT0gJ3N0YXR1cycpIHtcclxuXHRcdC8vIENoZWNrIGJ1aWx0LWluIGNvbG9ycyBmaXJzdCwgdGhlbiBzeW5jZWQgcGx1Z2luIGNvbG9ycyAoY2FzZS1pbnNlbnNpdGl2ZSlcclxuXHRcdHJldHVybiBTVEFUVVNfQ09MT1JTW3Rhc2suc3RhdHVzXVxyXG5cdFx0XHQ/PyBwbHVnaW5TZXR0aW5ncz8uc3RhdHVzQ29sb3JzPy5bdGFzay5zdGF0dXNdXHJcblx0XHRcdD8/IHBsdWdpblNldHRpbmdzPy5zdGF0dXNDb2xvcnM/LltPYmplY3Qua2V5cyhwbHVnaW5TZXR0aW5ncy5zdGF0dXNDb2xvcnMpLmZpbmQoayA9PiBrLnRvTG93ZXJDYXNlKCkgPT09IHRhc2suc3RhdHVzLnRvTG93ZXJDYXNlKCkpID8/ICcnXVxyXG5cdFx0XHQ/PyBERUZBVUxUX0JBUl9DT0xPUjtcclxuXHR9XHJcblx0aWYgKGNvbG9yQnkgPT09ICdwcmlvcml0eScpIHtcclxuXHRcdHJldHVybiBQUklPUklUWV9DT0xPUlNbdGFzay5wcmlvcml0eV1cclxuXHRcdFx0Pz8gcGx1Z2luU2V0dGluZ3M/LnByaW9yaXR5Q29sb3JzPy5bdGFzay5wcmlvcml0eV1cclxuXHRcdFx0Pz8gcGx1Z2luU2V0dGluZ3M/LnByaW9yaXR5Q29sb3JzPy5bT2JqZWN0LmtleXMocGx1Z2luU2V0dGluZ3MucHJpb3JpdHlDb2xvcnMpLmZpbmQoayA9PiBrLnRvTG93ZXJDYXNlKCkgPT09IHRhc2sucHJpb3JpdHkudG9Mb3dlckNhc2UoKSkgPz8gJyddXHJcblx0XHRcdD8/IERFRkFVTFRfQkFSX0NPTE9SO1xyXG5cdH1cclxuXHRyZXR1cm4gREVGQVVMVF9CQVJfQ09MT1I7XHJcbn1cclxuXHJcbiIsICJpbXBvcnQge1xuICBST1dfSEVJR0hULFxuICBCQVJfSEVJR0hULFxuICBCQVJfTUFSR0lOX1RPUCxcbiAgTUlOX0JBUl9MQUJFTF9XSURUSCxcbiAgQ29sb3JCeUZpZWxkLFxuICBHYW50dFRhc2ssXG4gIHR5cGUgUGx1Z2luU2V0dGluZ3MsXG59IGZyb20gJy4vdHlwZXMudHMnO1xuaW1wb3J0IHsgZ2V0QmFyQ29sb3IgfSBmcm9tICcuL2NvbG9ycy50cyc7XG5cbi8qKlxuICogUmV0dXJucyB0aGUgYmFyIGVsZW1lbnQgKGAuZ2J2LWJhcmApIHRvIGJlIHBsYWNlZCBpbnNpZGUgYSBwcmUtZXhpc3RpbmdcbiAqIGAuZ2J2LWJhci1yb3dgLiBUaGUgY2FsbGVyIG93bnMgdGhlIHJvdzsgdGhpcyBmdW5jdGlvbiBvd25zIG9ubHkgdGhlIGJhci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRhc2tCYXIoXG4gIHRhc2s6IEdhbnR0VGFzayxcbiAgYm91bmRzOiB7IGxlZnQ6IG51bWJlcjsgd2lkdGg6IG51bWJlciB9LFxuICBjb2xvckJ5OiBDb2xvckJ5RmllbGQsXG4gIHNob3dQcmlvcml0eSA9IHRydWUsXG4gIHBsdWdpblNldHRpbmdzPzogUGx1Z2luU2V0dGluZ3MsXG4pOiBIVE1MRWxlbWVudCB7XG4gIGlmICh0YXNrLmlzTWlsZXN0b25lKSB7XG4gICAgcmV0dXJuIGNyZWF0ZU1pbGVzdG9uZURpYW1vbmQodGFzaywgYm91bmRzLCBjb2xvckJ5LCBwbHVnaW5TZXR0aW5ncyk7XG4gIH1cblxuICBjb25zdCBiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgYmFyLmNsYXNzTmFtZSA9ICdnYnYtYmFyJztcbiAgYmFyLmRhdGFzZXQudGFza0lkID0gdGFzay5pZDtcblxuICBpZiAodGFzay5zdGF0dXMgPT09ICdkb25lJykge1xuICAgIGJhci5jbGFzc0xpc3QuYWRkKCdnYnYtYmFyLS1kb25lJyk7XG4gIH1cblxuICBiYXIuc3R5bGUubGVmdCA9IGAke2JvdW5kcy5sZWZ0fXB4YDtcbiAgYmFyLnN0eWxlLndpZHRoID0gYCR7Ym91bmRzLndpZHRofXB4YDtcbiAgYmFyLnN0eWxlLnRvcCA9IGAke0JBUl9NQVJHSU5fVE9QfXB4YDtcbiAgYmFyLnN0eWxlLmhlaWdodCA9IGAke0JBUl9IRUlHSFR9cHhgO1xuXG4gIC8vIEFwcGx5IGNvbG9yIHdoZW4gY29sb3JCeSBpcyBzZXQgdG8gc3RhdHVzIG9yIHByaW9yaXR5XG4gIGlmIChjb2xvckJ5ICE9PSAnbm9uZScpIHtcbiAgICBjb25zdCBjb2xvciA9IGdldEJhckNvbG9yKHRhc2ssIGNvbG9yQnksIHBsdWdpblNldHRpbmdzKTtcbiAgICBiYXIuc3R5bGUuYmFja2dyb3VuZCA9IGBjb2xvci1taXgoaW4gc3JnYiwgJHtjb2xvcn0gMjUlLCB2YXIoLS1iYWNrZ3JvdW5kLXNlY29uZGFyeSkpYDtcbiAgICBiYXIuc3R5bGUuYm9yZGVyQ29sb3IgPSBgY29sb3ItbWl4KGluIHNyZ2IsICR7Y29sb3J9IDQwJSwgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpKWA7XG4gIH1cblxuICAvLyBQcmlvcml0eSBkb3QgKyBsYWJlbCBcdTIwMTQgb25seSBzaG93biB3aGVuIGJhciBpcyB3aWRlIGVub3VnaCB0byBiZSByZWFkYWJsZVxuICBpZiAoYm91bmRzLndpZHRoID49IE1JTl9CQVJfTEFCRUxfV0lEVEgpIHtcbiAgICBpZiAoc2hvd1ByaW9yaXR5KSB7XG4gICAgICBjb25zdCBkb3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGRvdC5jbGFzc05hbWUgPSAnZ2J2LXByaW9yaXR5LWRvdCc7XG4gICAgICBpZiAodGFzay5wcmlvcml0eSkgZG90LmRhdGFzZXQucHJpb3JpdHkgPSB0YXNrLnByaW9yaXR5O1xuICAgICAgYmFyLmFwcGVuZENoaWxkKGRvdCk7XG4gICAgfVxuXG4gICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgbGFiZWwuY2xhc3NOYW1lID0gJ2didi1iYXItbGFiZWwnO1xuICAgIGxhYmVsLnRleHRDb250ZW50ID0gdGFzay50aXRsZSB8fCB0YXNrLmZpbGUuYmFzZW5hbWU7XG4gICAgYmFyLmFwcGVuZENoaWxkKGxhYmVsKTtcbiAgfVxuXG4gIGlmICh0YXNrLmNvbXBsZXRlZERhdGUgJiYgdGFzay5zdGFydERhdGUpIHtcbiAgICBjb25zdCBtYXJrZXIgPSBjcmVhdGVDb21wbGV0ZWRNYXJrZXIodGFzaywgYm91bmRzKTtcbiAgICBpZiAobWFya2VyKSBiYXIuYXBwZW5kQ2hpbGQobWFya2VyKTtcbiAgfVxuXG4gIHJldHVybiBiYXI7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU1pbGVzdG9uZURpYW1vbmQoXG4gIHRhc2s6IEdhbnR0VGFzayxcbiAgYm91bmRzOiB7IGxlZnQ6IG51bWJlcjsgd2lkdGg6IG51bWJlciB9LFxuICBjb2xvckJ5OiBDb2xvckJ5RmllbGQsXG4gIHBsdWdpblNldHRpbmdzPzogUGx1Z2luU2V0dGluZ3MsXG4pOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHNpemUgPSAxNDsgLy8gdmlzdWFsIGRpYW1vbmQgc2l6ZSAocHgsIGJlZm9yZSByb3RhdGlvbilcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgZWwuY2xhc3NOYW1lID0gJ2didi1taWxlc3RvbmUnO1xuICBlbC5kYXRhc2V0LnRhc2tJZCA9IHRhc2suaWQ7XG4gIGlmICh0YXNrLnN0YXR1cyA9PT0gJ2RvbmUnKSBlbC5jbGFzc0xpc3QuYWRkKCdnYnYtYmFyLS1kb25lJyk7XG4gIGVsLnN0eWxlLmxlZnQgPSBgJHtib3VuZHMubGVmdCAtIHNpemUgLyAyfXB4YDtcbiAgZWwuc3R5bGUudG9wID0gYCR7TWF0aC5yb3VuZCgoUk9XX0hFSUdIVCAtIHNpemUpIC8gMil9cHhgO1xuICBlbC5zdHlsZS53aWR0aCA9IGAke3NpemV9cHhgO1xuICBlbC5zdHlsZS5oZWlnaHQgPSBgJHtzaXplfXB4YDtcbiAgZWwuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gZ2V0QmFyQ29sb3IodGFzaywgY29sb3JCeSwgcGx1Z2luU2V0dGluZ3MpO1xuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbXBsZXRlZE1hcmtlcihcbiAgdGFzazogR2FudHRUYXNrLFxuICBib3VuZHM6IHsgbGVmdDogbnVtYmVyOyB3aWR0aDogbnVtYmVyIH0sXG4pOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBpZiAoIXRhc2suY29tcGxldGVkRGF0ZSB8fCAhdGFzay5zdGFydERhdGUgfHwgIXRhc2suZW5kRGF0ZSkgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgdG90YWxEdXJhdGlvbk1zID0gdGFzay5lbmREYXRlLmdldFRpbWUoKSAtIHRhc2suc3RhcnREYXRlLmdldFRpbWUoKTtcbiAgaWYgKHRvdGFsRHVyYXRpb25NcyA8PSAwKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBjb21wbGV0ZWRPZmZzZXRNcyA9IHRhc2suY29tcGxldGVkRGF0ZS5nZXRUaW1lKCkgLSB0YXNrLnN0YXJ0RGF0ZS5nZXRUaW1lKCk7XG4gIC8vIEZyYWN0aW9uIGFsb25nIHRoZSBiYXIgKDBcdTIwMTMxKSwgY2xhbXBlZFxuICBjb25zdCBmcmFjdGlvbiA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIGNvbXBsZXRlZE9mZnNldE1zIC8gdG90YWxEdXJhdGlvbk1zKSk7XG4gIGNvbnN0IG9mZnNldFB4ID0gTWF0aC5yb3VuZChmcmFjdGlvbiAqIGJvdW5kcy53aWR0aCk7XG5cbiAgY29uc3QgbWFya2VyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIG1hcmtlci5jbGFzc05hbWUgPSAnZ2J2LWNvbXBsZXRlLW1hcmtlcic7XG5cbiAgLy8gUG9zaXRpb24gcmVsYXRpdmUgdG8gdGhlIGJhciAod2hpY2ggaXMgYWxyZWFkeSBwb3NpdGlvbmVkIGluIHRoZSByb3cpXG4gIC8vIFdlIHBsYWNlIHRoZSBtYXJrZXIgcmVsYXRpdmUgdG8gdGhlIGJhcidzIG93biBjb29yZGluYXRlIHNwYWNlXG4gIG1hcmtlci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gIC8vIENlbnRlciB0aGUgOHB4IGRpYW1vbmQgb24gdGhlIG9mZnNldCBwb2ludFxuICBjb25zdCBtYXJrZXJTaXplID0gODtcbiAgbWFya2VyLnN0eWxlLmxlZnQgPSBgJHtvZmZzZXRQeCAtIG1hcmtlclNpemUgLyAyfXB4YDtcbiAgbWFya2VyLnN0eWxlLnRvcCA9IGAke01hdGgucm91bmQoKEJBUl9IRUlHSFQgLSBtYXJrZXJTaXplKSAvIDIpfXB4YDtcbiAgbWFya2VyLnN0eWxlLndpZHRoID0gYCR7bWFya2VyU2l6ZX1weGA7XG4gIG1hcmtlci5zdHlsZS5oZWlnaHQgPSBgJHttYXJrZXJTaXplfXB4YDtcblxuICByZXR1cm4gbWFya2VyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2lkZWJhckxhYmVsKHRhc2s6IEdhbnR0VGFzaywgaGFzVmlvbGF0aW9uID0gZmFsc2UpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdnYnYtc2lkZWJhci1sYWJlbCc7XG4gIGxhYmVsLnN0eWxlLmhlaWdodCA9IGAke1JPV19IRUlHSFR9cHhgO1xuICBsYWJlbC5kYXRhc2V0LnRhc2tJZCA9IHRhc2suaWQ7XG5cbiAgaWYgKGhhc1Zpb2xhdGlvbikge1xuICAgIGNvbnN0IGJhZGdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgIGJhZGdlLmNsYXNzTmFtZSA9ICdnYnYtdmlvbGF0aW9uLWJhZGdlJztcbiAgICBiYWRnZS50ZXh0Q29udGVudCA9ICdcdTI2QTAnO1xuICAgIGJhZGdlLnRpdGxlID0gJ1NjaGVkdWxlIGNvbmZsaWN0JztcbiAgICBsYWJlbC5hcHBlbmRDaGlsZChiYWRnZSk7XG4gIH1cblxuICBjb25zdCB0ZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICB0ZXh0LnRleHRDb250ZW50ID0gdGFzay50aXRsZSB8fCB0YXNrLmZpbGUuYmFzZW5hbWU7XG5cbiAgbGFiZWwuYXBwZW5kQ2hpbGQodGV4dCk7XG4gIHJldHVybiBsYWJlbDtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IEdhbnR0VGFzaywgVGFza0RlcGVuZGVuY3ksIFRpbWVsaW5lQ29uZmlnLCBHYW50dFZpZXdTZXR0aW5ncyB9IGZyb20gJy4vdHlwZXMudHMnO1xuaW1wb3J0IHsgQkFSX01BUkdJTl9UT1AsIEJBUl9IRUlHSFQgfSBmcm9tICcuL3R5cGVzLnRzJztcbmltcG9ydCB7IGdldFRhc2tCYXJCb3VuZHMgfSBmcm9tICcuL3RpbWVsaW5lLnRzJztcblxuY29uc3QgTV9OT1JNID0gJ2didi1tLW5yJztcbmNvbnN0IE1fVklPTCA9ICdnYnYtbS12cic7XG5cbmNvbnN0IENPTE9SX05PUk1BTCAgID0gJ3ZhcigtLXRleHQtbXV0ZWQpJztcbmNvbnN0IENPTE9SX1ZJT0xBVEVEID0gJ3ZhcigtLWNvbG9yLW9yYW5nZSwgI2U4YTQyNyknO1xuXG4vLyBHYXAgKHB4KSB0aGUgcGF0aCBleHRlbmRzIHBhc3QgdGhlIGJhciBlZGdlIGJlZm9yZSB0dXJuaW5nIHRoZSBjb3JuZXIuXG5jb25zdCBFTEJPV19HQVAgPSAxMjtcblxuZnVuY3Rpb24gbWFrZU1hcmtlcihpZDogc3RyaW5nLCBjb2xvcjogc3RyaW5nKTogU1ZHTWFya2VyRWxlbWVudCB7XG5cdGNvbnN0IG0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgJ21hcmtlcicpO1xuXHRtLnNldEF0dHJpYnV0ZSgnaWQnLCBpZCk7XG5cdG0uc2V0QXR0cmlidXRlKCdtYXJrZXJXaWR0aCcsICc3Jyk7XG5cdG0uc2V0QXR0cmlidXRlKCdtYXJrZXJIZWlnaHQnLCAnNycpO1xuXHRtLnNldEF0dHJpYnV0ZSgncmVmWCcsICc2Jyk7XG5cdG0uc2V0QXR0cmlidXRlKCdyZWZZJywgJzMuNScpO1xuXHRtLnNldEF0dHJpYnV0ZSgnb3JpZW50JywgJ2F1dG8nKTtcblx0bS5zZXRBdHRyaWJ1dGUoJ21hcmtlclVuaXRzJywgJ3VzZXJTcGFjZU9uVXNlJyk7XG5cdGNvbnN0IHBvbHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgJ3BvbHlnb24nKTtcblx0cG9seS5zZXRBdHRyaWJ1dGUoJ3BvaW50cycsICcwLDAgNywzLjUgMCw3Jyk7XG5cdHBvbHkuc2V0QXR0cmlidXRlKCdmaWxsJywgY29sb3IpO1xuXHRtLmFwcGVuZENoaWxkKHBvbHkpO1xuXHRyZXR1cm4gbTtcbn1cblxuZnVuY3Rpb24gZW5zdXJlRGVmcyhzdmc6IFNWR1NWR0VsZW1lbnQpOiB2b2lkIHtcblx0bGV0IGRlZnMgPSBzdmcucXVlcnlTZWxlY3RvcignZGVmcycpO1xuXHRpZiAoIWRlZnMpIHtcblx0XHRkZWZzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKCdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZycsICdkZWZzJyk7XG5cdFx0c3ZnLnByZXBlbmQoZGVmcyk7XG5cdH1cblx0Zm9yIChjb25zdCBpZCBvZiBbTV9OT1JNLCBNX1ZJT0xdKSB7XG5cdFx0ZGVmcy5xdWVyeVNlbGVjdG9yKGAjJHtpZH1gKT8ucmVtb3ZlKCk7XG5cdH1cblx0ZGVmcy5hcHBlbmRDaGlsZChtYWtlTWFya2VyKE1fTk9STSwgQ09MT1JfTk9STUFMKSk7XG5cdGRlZnMuYXBwZW5kQ2hpbGQobWFrZU1hcmtlcihNX1ZJT0wsIENPTE9SX1ZJT0xBVEVEKSk7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkUGF0aChcblx0c3g6IG51bWJlciwgc3k6IG51bWJlcixcblx0dHg6IG51bWJlciwgdHk6IG51bWJlcixcblx0ZXhpdFJpZ2h0OiBib29sZWFuLFxuXHRlbnRlclJpZ2h0OiBib29sZWFuLFxuKTogc3RyaW5nIHtcblx0Y29uc3QgcHJlZmVycmVkID0gZXhpdFJpZ2h0ID8gc3ggKyBFTEJPV19HQVAgOiBzeCAtIEVMQk9XX0dBUDtcblx0Y29uc3QgcGl2b3RYID0gIWVudGVyUmlnaHRcblx0XHQ/IE1hdGgubWluKHByZWZlcnJlZCwgdHggLSBFTEJPV19HQVApXG5cdFx0OiB0eCAtIEVMQk9XX0dBUDtcblxuXHRyZXR1cm4gYE0gJHtNYXRoLnJvdW5kKHN4KX0sJHtNYXRoLnJvdW5kKHN5KX0gSCAke01hdGgucm91bmQocGl2b3RYKX0gViAke01hdGgucm91bmQodHkpfSBIICR7TWF0aC5yb3VuZCh0eCl9YDtcbn1cblxuZnVuY3Rpb24gaXNWaW9sYXRlZChkZXA6IFRhc2tEZXBlbmRlbmN5LCBzb3VyY2VUYXNrOiBHYW50dFRhc2ssIHRhcmdldFRhc2s6IEdhbnR0VGFzayk6IGJvb2xlYW4ge1xuXHRzd2l0Y2ggKGRlcC50eXBlKSB7XG5cdFx0Y2FzZSAnRlMnOiByZXR1cm4gISEodGFyZ2V0VGFzay5lbmREYXRlICAgJiYgc291cmNlVGFzay5zdGFydERhdGUgJiYgc291cmNlVGFzay5zdGFydERhdGUgPCB0YXJnZXRUYXNrLmVuZERhdGUpO1xuXHRcdGNhc2UgJ1NTJzogcmV0dXJuICEhKHRhcmdldFRhc2suc3RhcnREYXRlICYmIHNvdXJjZVRhc2suc3RhcnREYXRlICYmIHNvdXJjZVRhc2suc3RhcnREYXRlIDwgdGFyZ2V0VGFzay5zdGFydERhdGUpO1xuXHRcdGNhc2UgJ0ZGJzogcmV0dXJuICEhKHRhcmdldFRhc2suZW5kRGF0ZSAgICYmIHNvdXJjZVRhc2suZW5kRGF0ZSAgICYmIHNvdXJjZVRhc2suZW5kRGF0ZSAgIDwgdGFyZ2V0VGFzay5lbmREYXRlKTtcblx0XHRjYXNlICdTRic6IHJldHVybiAhISh0YXJnZXRUYXNrLnN0YXJ0RGF0ZSAmJiBzb3VyY2VUYXNrLmVuZERhdGUgICAmJiBzb3VyY2VUYXNrLmVuZERhdGUgICA8IHRhcmdldFRhc2suc3RhcnREYXRlKTtcblx0XHRkZWZhdWx0OiAgIHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyRGVwZW5kZW5jaWVzKFxuXHRzdmc6IFNWR1NWR0VsZW1lbnQsXG5cdHRhc2tzOiBHYW50dFRhc2tbXSxcblx0dGFza1Jvd01hcDogTWFwPHN0cmluZywgbnVtYmVyPixcblx0Y29uZmlnOiBUaW1lbGluZUNvbmZpZyxcblx0c2V0dGluZ3M6IEdhbnR0Vmlld1NldHRpbmdzLFxuKTogdm9pZCB7XG5cdHdoaWxlIChzdmcubGFzdENoaWxkKSBzdmcucmVtb3ZlQ2hpbGQoc3ZnLmxhc3RDaGlsZCk7XG5cdGlmICghc2V0dGluZ3Muc2hvd0RlcGVuZGVuY2llcykgcmV0dXJuO1xuXG5cdGVuc3VyZURlZnMoc3ZnKTtcblxuXHRjb25zdCB0YXNrQnlJZCA9IG5ldyBNYXA8c3RyaW5nLCBHYW50dFRhc2s+KCk7XG5cdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykgdGFza0J5SWQuc2V0KHRhc2suaWQsIHRhc2spO1xuXG5cdGZvciAoY29uc3Qgc291cmNlVGFzayBvZiB0YXNrcykge1xuXHRcdGlmICghc291cmNlVGFzay5kZXBlbmRlbmNpZXM/Lmxlbmd0aCkgY29udGludWU7XG5cblx0XHRjb25zdCBzcmNSb3dUb3AgPSB0YXNrUm93TWFwLmdldChzb3VyY2VUYXNrLmlkKTtcblx0XHRpZiAoc3JjUm93VG9wID09PSB1bmRlZmluZWQpIGNvbnRpbnVlO1xuXHRcdGNvbnN0IHNyY0JhclRvcCA9IHNyY1Jvd1RvcCArIEJBUl9NQVJHSU5fVE9QICsgMjtcblxuXHRcdGNvbnN0IHNyY0JvdW5kcyA9IGdldFRhc2tCYXJCb3VuZHMoc291cmNlVGFzaywgY29uZmlnKTtcblx0XHRpZiAoIXNyY0JvdW5kcykgY29udGludWU7XG5cdFx0Y29uc3Qgc3JjTCA9IHNyY0JvdW5kcy5sZWZ0ICsgMTtcblx0XHRjb25zdCBzcmNSID0gc3JjQm91bmRzLmxlZnQgKyBzcmNCb3VuZHMud2lkdGggLSAxO1xuXG5cdFx0Zm9yIChjb25zdCBkZXAgb2Ygc291cmNlVGFzay5kZXBlbmRlbmNpZXMpIHtcblx0XHRcdGlmICghZGVwLnRhcmdldFBhdGgpIGNvbnRpbnVlO1xuXHRcdFx0aWYgKCFzZXR0aW5ncy52aXNpYmxlRGVwVHlwZXMuaGFzKGRlcC50eXBlKSkgY29udGludWU7XG5cblx0XHRcdGNvbnN0IHRhcmdldFRhc2sgPSB0YXNrQnlJZC5nZXQoZGVwLnRhcmdldFBhdGgpO1xuXHRcdFx0aWYgKCF0YXJnZXRUYXNrKSBjb250aW51ZTtcblxuXHRcdFx0Y29uc3QgdGd0Um93VG9wID0gdGFza1Jvd01hcC5nZXQodGFyZ2V0VGFzay5pZCk7XG5cdFx0XHRpZiAodGd0Um93VG9wID09PSB1bmRlZmluZWQpIGNvbnRpbnVlO1xuXHRcdFx0Y29uc3QgdGd0QmFyQm90ID0gdGd0Um93VG9wICsgQkFSX01BUkdJTl9UT1AgKyBCQVJfSEVJR0hUIC0gMztcblxuXHRcdFx0Y29uc3QgdGd0Qm91bmRzID0gZ2V0VGFza0JhckJvdW5kcyh0YXJnZXRUYXNrLCBjb25maWcpO1xuXHRcdFx0aWYgKCF0Z3RCb3VuZHMpIGNvbnRpbnVlO1xuXHRcdFx0Y29uc3QgdGd0TCA9IHRndEJvdW5kcy5sZWZ0ICsgMTtcblx0XHRcdGNvbnN0IHRndFIgPSB0Z3RCb3VuZHMubGVmdCArIHRndEJvdW5kcy53aWR0aCAtIDE7XG5cblx0XHRcdGxldCBzeDogbnVtYmVyLCBzeTogbnVtYmVyLCB0eDogbnVtYmVyLCB0eTogbnVtYmVyO1xuXHRcdFx0bGV0IGV4aXRSaWdodDogYm9vbGVhbiwgZW50ZXJSaWdodDogYm9vbGVhbjtcblxuXHRcdFx0c3dpdGNoIChkZXAudHlwZSkge1xuXHRcdFx0XHRjYXNlICdGUyc6XG5cdFx0XHRcdFx0c3ggPSBzcmNSOyBzeSA9IHNyY0JhclRvcDsgdHggPSB0Z3RMOyB0eSA9IHRndEJhckJvdDtcblx0XHRcdFx0XHRleGl0UmlnaHQgPSB0cnVlOyBlbnRlclJpZ2h0ID0gZmFsc2U7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ1NTJzpcblx0XHRcdFx0XHRzeCA9IHNyY0w7IHN5ID0gc3JjQmFyVG9wOyB0eCA9IHRndEw7IHR5ID0gdGd0QmFyQm90O1xuXHRcdFx0XHRcdGV4aXRSaWdodCA9IGZhbHNlOyBlbnRlclJpZ2h0ID0gZmFsc2U7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ0ZGJzpcblx0XHRcdFx0XHRzeCA9IHNyY1I7IHN5ID0gc3JjQmFyVG9wOyB0eCA9IHRndFI7IHR5ID0gdGd0QmFyQm90O1xuXHRcdFx0XHRcdGV4aXRSaWdodCA9IHRydWU7IGVudGVyUmlnaHQgPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdTRic6XG5cdFx0XHRcdFx0c3ggPSBzcmNMOyBzeSA9IHNyY0JhclRvcDsgdHggPSB0Z3RSOyB0eSA9IHRndEJhckJvdDtcblx0XHRcdFx0XHRleGl0UmlnaHQgPSBmYWxzZTsgZW50ZXJSaWdodCA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHZpb2xhdGVkID0gaXNWaW9sYXRlZChkZXAsIHNvdXJjZVRhc2ssIHRhcmdldFRhc2spO1xuXHRcdFx0Y29uc3QgY29sb3IgPSB2aW9sYXRlZCA/IENPTE9SX1ZJT0xBVEVEIDogQ09MT1JfTk9STUFMO1xuXHRcdFx0Y29uc3QgbWFya2VyID0gdmlvbGF0ZWQgPyBNX1ZJT0wgOiBNX05PUk07XG5cblx0XHRcdGNvbnN0IHBhdGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgJ3BhdGgnKTtcblx0XHRcdHBhdGguc2V0QXR0cmlidXRlKCdkJywgYnVpbGRQYXRoKHN4LCBzeSwgdHgsIHR5LCBleGl0UmlnaHQsIGVudGVyUmlnaHQpKTtcblx0XHRcdHBhdGguc2V0QXR0cmlidXRlKCdmaWxsJywgJ25vbmUnKTtcblx0XHRcdHBhdGguc2V0QXR0cmlidXRlKCdzdHJva2UnLCBjb2xvcik7XG5cdFx0XHRwYXRoLnNldEF0dHJpYnV0ZSgnc3Ryb2tlLXdpZHRoJywgdmlvbGF0ZWQgPyAnMicgOiAnMS41Jyk7XG5cdFx0XHRwYXRoLnNldEF0dHJpYnV0ZSgnb3BhY2l0eScsICAgICAgdmlvbGF0ZWQgPyAnMC45JyA6ICcwLjU1Jyk7XG5cdFx0XHRpZiAodmlvbGF0ZWQpIHBhdGguc2V0QXR0cmlidXRlKCdzdHJva2UtZGFzaGFycmF5JywgJzUgMycpO1xuXHRcdFx0cGF0aC5zZXRBdHRyaWJ1dGUoJ21hcmtlci1lbmQnLCBgdXJsKCMke21hcmtlcn0pYCk7XG5cdFx0XHRwYXRoLmNsYXNzTGlzdC5hZGQoJ2didi1kZXAtYXJyb3cnKTtcblx0XHRcdHBhdGguc2V0QXR0cmlidXRlKCdkYXRhLWRlcC10eXBlJywgZGVwLnR5cGUpO1xuXHRcdFx0c3ZnLmFwcGVuZENoaWxkKHBhdGgpO1xuXHRcdH1cblx0fVxufVxuIiwgImltcG9ydCB7IEFic3RyYWN0SW5wdXRTdWdnZXN0LCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcclxuaW1wb3J0IHR5cGUgeyBBcHAgfSBmcm9tICdvYnNpZGlhbic7XHJcbmltcG9ydCB0eXBlIHsgR2FudHRUYXNrLCBQbHVnaW5TZXR0aW5ncyB9IGZyb20gJy4vdHlwZXMudHMnO1xyXG5pbXBvcnQgeyBERVBfRklFTERTLCBzdHJpcFdpa2lsaW5rLCBERUZBVUxUX1BMVUdJTl9TRVRUSU5HUyB9IGZyb20gJy4vdHlwZXMudHMnO1xyXG5pbXBvcnQgeyBmb3JtYXREYXRlIH0gZnJvbSAnLi90aW1lbGluZS50cyc7XHJcblxyXG4vKiogTmF0aXZlIE9ic2lkaWFuIGZpbGUtbmFtZSBhdXRvY29tcGxldGUgd2lyZWQgdG8gYSBjaGlwcy1zdHlsZSBkZXAgaW5wdXQuICovXHJcbmNsYXNzIENoaXBGaWxlU3VnZ2VzdCBleHRlbmRzIEFic3RyYWN0SW5wdXRTdWdnZXN0PFRGaWxlPiB7XHJcblx0cHJpdmF0ZSBfb25TZWxlY3Q6IChmaWxlOiBURmlsZSkgPT4gdm9pZDtcclxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgaW5wdXQ6IEhUTUxJbnB1dEVsZW1lbnQsIG9uU2VsZWN0OiAoZmlsZTogVEZpbGUpID0+IHZvaWQpIHtcclxuXHRcdHN1cGVyKGFwcCwgaW5wdXQpO1xyXG5cdFx0dGhpcy5fb25TZWxlY3QgPSBvblNlbGVjdDtcclxuXHR9XHJcblx0Z2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFRGaWxlW10ge1xyXG5cdFx0Y29uc3QgbG93ZXIgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0cmV0dXJuIHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKVxyXG5cdFx0XHQuZmlsdGVyKGYgPT4gZi5iYXNlbmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGxvd2VyKSlcclxuXHRcdFx0LnNsaWNlKDAsIDIwKTtcclxuXHR9XHJcblx0cmVuZGVyU3VnZ2VzdGlvbihmaWxlOiBURmlsZSwgZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XHJcblx0XHRlbC5zZXRUZXh0KGZpbGUuYmFzZW5hbWUpO1xyXG5cdH1cclxuXHRzZWxlY3RTdWdnZXN0aW9uKGZpbGU6IFRGaWxlKTogdm9pZCB7XHJcblx0XHR0aGlzLl9vblNlbGVjdChmaWxlKTtcclxuXHRcdHRoaXMuc2V0VmFsdWUoJycpO1xyXG5cdFx0dGhpcy5jbG9zZSgpO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEJ1aWxkcyB0aGUgZHJvcGRvd24gb3B0aW9ucyBmb3IgYSBwcm9wZXJ0eS5cclxuICogMS4gU3RhcnRzIHdpdGggdGhlIGNvbmZpZ3VyZWQgb3B0aW9ucyBmcm9tIHBsdWdpbiBzZXR0aW5ncy5cclxuICogMi4gQXBwZW5kcyBhbnkgYWRkaXRpb25hbCB2YWx1ZXMgZnJvbSBPYnNpZGlhbidzIG1ldGFkYXRhIHR5cGUgbWFuYWdlclxyXG4gKiAgICAod2hpY2ggcmVmbGVjdHMgdmFsdWVzIGFjdHVhbGx5IHVzZWQgaW4gdGhlIHZhdWx0KS5cclxuICogMy4gRW5zdXJlcyBjdXJyZW50VmFsdWUgaXMgYWx3YXlzIHByZXNlbnQuXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eU9wdGlvbnMoYXBwOiBBcHAsIHByb3BlcnR5TmFtZTogc3RyaW5nLCBzZXR0aW5nc09wdGlvbnM6IHN0cmluZ1tdLCBjdXJyZW50VmFsdWU/OiBzdHJpbmcpOiBzdHJpbmdbXSB7XHJcblx0Y29uc3QgYmFzZSA9IFsuLi5zZXR0aW5nc09wdGlvbnNdO1xyXG5cclxuXHQvLyBBcHBlbmQgdmFsdWVzIGZyb20gdGhlIG1ldGFkYXRhIHR5cGUgbWFuYWdlciB0aGF0IGFyZW4ndCBhbHJlYWR5IGluIHRoZSBsaXN0LlxyXG5cdC8vIENvbXBhcmlzb24gaXMgY2FzZS1pbnNlbnNpdGl2ZSBzaW5jZSBPYnNpZGlhbiBwcm9wZXJ0aWVzIGFyZSBjYXNlLWluc2Vuc2l0aXZlLlxyXG5cdGNvbnN0IGJhc2VMb3dlciA9IG5ldyBTZXQoYmFzZS5tYXAocyA9PiBzLnRvTG93ZXJDYXNlKCkpKTtcclxuXHJcblx0Y29uc3QgbWV0YU9wdHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkID1cclxuXHRcdChhcHAgYXMgYW55KS5tZXRhZGF0YVR5cGVNYW5hZ2VyPy5wcm9wZXJ0aWVzPy5bcHJvcGVydHlOYW1lXT8ub3B0aW9ucztcclxuXHRpZiAobWV0YU9wdHMgJiYgbWV0YU9wdHMubGVuZ3RoID4gMCkge1xyXG5cdFx0Zm9yIChjb25zdCBvcHQgb2YgbWV0YU9wdHMpIHtcclxuXHRcdFx0aWYgKCFiYXNlTG93ZXIuaGFzKG9wdC50b0xvd2VyQ2FzZSgpKSkge1xyXG5cdFx0XHRcdGJhc2UucHVzaChvcHQpO1xyXG5cdFx0XHRcdGJhc2VMb3dlci5hZGQob3B0LnRvTG93ZXJDYXNlKCkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpZiAoY3VycmVudFZhbHVlICYmICFiYXNlTG93ZXIuaGFzKGN1cnJlbnRWYWx1ZS50b0xvd2VyQ2FzZSgpKSkge1xyXG5cdFx0YmFzZS5wdXNoKGN1cnJlbnRWYWx1ZSk7XHJcblx0fVxyXG5cdHJldHVybiBiYXNlO1xyXG59XHJcblxyXG5jb25zdCBERVBfVFlQRV9UT19GSUVMRDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IE9iamVjdC5mcm9tRW50cmllcyhcclxuXHRERVBfRklFTERTLm1hcChmID0+IFtmLnR5cGUsIGYuYmFyZV0pXHJcbik7XHJcblxyXG4vLyBNb2R1bGUtbGV2ZWwgcmVmZXJlbmNlIHRvIGFueSBjdXJyZW50bHkgb3BlbiBwb3B1cCBzbyB3ZSBjYW4gY2xvc2UgaXQgZmlyc3QuXHJcbmxldCBhY3RpdmVQb3B1cDogUG9wdXBIYW5kbGUgfCBudWxsID0gbnVsbDtcclxuXHJcbmludGVyZmFjZSBQb3B1cEhhbmRsZSB7XHJcblx0ZWw6IEhUTUxFbGVtZW50O1xyXG5cdGRlc3Ryb3k6ICgpID0+IHZvaWQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNsYW1wVG9WaWV3cG9ydChyZWN0OiBET01SZWN0LCBwb3B1cFdpZHRoOiBudW1iZXIsIHBvcHVwSGVpZ2h0OiBudW1iZXIsIG9mZnNldFg6IG51bWJlciwgb2Zmc2V0WTogbnVtYmVyKTogeyBsZWZ0OiBudW1iZXI7IHRvcDogbnVtYmVyIH0ge1xyXG5cdGNvbnN0IHZ3ID0gd2luZG93LmlubmVyV2lkdGg7XHJcblx0Y29uc3QgdmggPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcblxyXG5cdGxldCBsZWZ0ID0gcmVjdC5sZWZ0ICsgb2Zmc2V0WDtcclxuXHRsZXQgdG9wID0gcmVjdC5ib3R0b20gKyBvZmZzZXRZO1xyXG5cclxuXHQvLyBGbGlwIGFib3ZlIGFuY2hvciBpZiBpdCB3b3VsZCBvdmVyZmxvdyBib3R0b21cclxuXHRpZiAodG9wICsgcG9wdXBIZWlnaHQgPiB2aCAtIDgpIHtcclxuXHRcdHRvcCA9IHJlY3QudG9wIC0gcG9wdXBIZWlnaHQgLSBvZmZzZXRZO1xyXG5cdH1cclxuXHQvLyBDbGFtcCBob3Jpem9udGFsXHJcblx0aWYgKGxlZnQgKyBwb3B1cFdpZHRoID4gdncgLSA4KSB7XHJcblx0XHRsZWZ0ID0gdncgLSBwb3B1cFdpZHRoIC0gODtcclxuXHR9XHJcblx0aWYgKGxlZnQgPCA4KSBsZWZ0ID0gODtcclxuXHRpZiAodG9wIDwgOCkgdG9wID0gODtcclxuXHJcblx0cmV0dXJuIHsgbGVmdCwgdG9wIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUFjdGl2ZVBvcHVwKCk6IHZvaWQge1xyXG5cdGlmIChhY3RpdmVQb3B1cCkge1xyXG5cdFx0YWN0aXZlUG9wdXAuZGVzdHJveSgpO1xyXG5cdFx0YWN0aXZlUG9wdXAgPSBudWxsO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlTGFiZWxlZEZpZWxkKGxhYmVsOiBzdHJpbmcsIGNvbnRyb2w6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xyXG5cdGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdHJvdy5jbGFzc05hbWUgPSAnZ2J2LXBvcHVwLWZpZWxkJztcclxuXHJcblx0Y29uc3QgbGJsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGFiZWwnKTtcclxuXHRsYmwudGV4dENvbnRlbnQgPSBsYWJlbDtcclxuXHJcblx0cm93LmFwcGVuZENoaWxkKGxibCk7XHJcblx0cm93LmFwcGVuZENoaWxkKGNvbnRyb2wpO1xyXG5cdHJldHVybiByb3c7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZVNlbGVjdChvcHRpb25zOiBzdHJpbmdbXSwgY3VycmVudDogc3RyaW5nKTogSFRNTFNlbGVjdEVsZW1lbnQge1xyXG5cdGNvbnN0IHNlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xyXG5cdGZvciAoY29uc3Qgb3B0IG9mIG9wdGlvbnMpIHtcclxuXHRcdGNvbnN0IG8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcclxuXHRcdG8udmFsdWUgPSBvcHQ7XHJcblx0XHRvLnRleHRDb250ZW50ID0gb3B0O1xyXG5cdFx0aWYgKG9wdC50b0xvd2VyQ2FzZSgpID09PSBjdXJyZW50LnRvTG93ZXJDYXNlKCkpIG8uc2VsZWN0ZWQgPSB0cnVlO1xyXG5cdFx0c2VsLmFwcGVuZENoaWxkKG8pO1xyXG5cdH1cclxuXHRyZXR1cm4gc2VsO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb3BlblBvcHVwRWRpdG9yKFxyXG5cdHRhc2s6IEdhbnR0VGFzayxcclxuXHRhbmNob3JFbDogSFRNTEVsZW1lbnQsXHJcblx0YXBwOiBBcHAsXHJcblx0b25VcGRhdGU6ICgpID0+IHZvaWQsXHJcblx0cGx1Z2luU2V0dGluZ3M/OiBQbHVnaW5TZXR0aW5ncyxcclxuKTogdm9pZCB7XHJcblx0Ly8gQ2xvc2UgYW55IGV4aXN0aW5nIHBvcHVwIGJlZm9yZSBvcGVuaW5nIGEgbmV3IG9uZVxyXG5cdGNsb3NlQWN0aXZlUG9wdXAoKTtcclxuXHJcblx0Ly8gXHUyNTAwXHUyNTAwIEJ1aWxkIHBvcHVwIGVsZW1lbnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcblx0Y29uc3QgcG9wdXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuXHRwb3B1cC5jbGFzc05hbWUgPSAnZ2J2LXBvcHVwJztcclxuXHQvLyBUZW1wb3JhcmlseSBvZmYtc2NyZWVuIHRvIG1lYXN1cmUgaGVpZ2h0IGZvciBjbGFtcGluZ1xyXG5cdHBvcHVwLnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcclxuXHRwb3B1cC5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XHJcblx0cG9wdXAuc3R5bGUubGVmdCA9ICctOTk5OXB4JztcclxuXHRwb3B1cC5zdHlsZS50b3AgPSAnLTk5OTlweCc7XHJcblx0cG9wdXAuc3R5bGUuekluZGV4ID0gJzEwMDAwJztcclxuXHJcblx0Ly8gXHUyNTAwXHUyNTAwIFRpdGxlIHJvdyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcclxuXHRjb25zdCB0aXRsZVJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdHRpdGxlUm93LmNsYXNzTmFtZSA9ICdnYnYtcG9wdXAtdGl0bGUnO1xyXG5cclxuXHRjb25zdCB0aXRsZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaDQnKTtcclxuXHR0aXRsZUVsLnRleHRDb250ZW50ID0gdGFzay50aXRsZSB8fCB0YXNrLmZpbGUuYmFzZW5hbWU7XHJcblxyXG5cdGNvbnN0IGxpbmtCdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuXHRsaW5rQnRuLmNsYXNzTmFtZSA9ICdnYnYtcG9wdXAtbGluay1idG4gY2xpY2thYmxlLWljb24nO1xyXG5cdGxpbmtCdG4udGl0bGUgPSAnT3BlbiBub3RlJztcclxuXHRsaW5rQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdPcGVuIG5vdGUnKTtcclxuXHQvLyBVc2UgYSBzaW1wbGUgZXh0ZXJuYWwtbGluayBTVkcgaWNvblxyXG5cdGxpbmtCdG4uaW5uZXJIVE1MID1cclxuXHRcdCc8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjE0XCIgaGVpZ2h0PVwiMTRcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiAnICtcclxuXHRcdCdzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+JyArXHJcblx0XHQnPHBhdGggZD1cIk0xOCAxM3Y2YTIgMiAwIDAgMS0yIDJINWEyIDIgMCAwIDEtMi0yVjhhMiAyIDAgMCAxIDItMmg2XCIvPicgK1xyXG5cdFx0Jzxwb2x5bGluZSBwb2ludHM9XCIxNSAzIDIxIDMgMjEgOVwiLz48bGluZSB4MT1cIjEwXCIgeTE9XCIxNFwiIHgyPVwiMjFcIiB5Mj1cIjNcIi8+JyArXHJcblx0XHQnPC9zdmc+JztcclxuXHRsaW5rQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcclxuXHRcdC8vIEN0cmwvQ21kK2NsaWNrIG9wZW5zIGluIG5ldyB0YWIgXHUyMDE0IG1hdGNoZXMgT2JzaWRpYW4gYXBwLXdpZGUgYmVoYXZpb3VyXHJcblx0XHRjb25zdCBuZXdUYWIgPSBlLmN0cmxLZXkgfHwgZS5tZXRhS2V5O1xyXG5cdFx0YXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQodGFzay5maWxlLmJhc2VuYW1lLCB0YXNrLmZpbGUucGF0aCwgbmV3VGFiKTtcclxuXHRcdGNsb3NlQWN0aXZlUG9wdXAoKTtcclxuXHR9KTtcclxuXHJcblx0dGl0bGVSb3cuYXBwZW5kQ2hpbGQodGl0bGVFbCk7XHJcblx0dGl0bGVSb3cuYXBwZW5kQ2hpbGQobGlua0J0bik7XHJcblx0cG9wdXAuYXBwZW5kQ2hpbGQodGl0bGVSb3cpO1xyXG5cclxuXHQvLyBcdTI1MDBcdTI1MDAgRGF0ZXMgcm93ICh0d28gY29sdW1ucykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcblx0Y29uc3Qgc3RhcnRJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcblx0c3RhcnRJbnB1dC50eXBlID0gJ2RhdGUnO1xyXG5cdHN0YXJ0SW5wdXQudmFsdWUgPSB0YXNrLnN0YXJ0RGF0ZSA/IGZvcm1hdERhdGUodGFzay5zdGFydERhdGUpIDogJyc7XHJcblxyXG5cdGNvbnN0IGVuZElucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuXHRlbmRJbnB1dC50eXBlID0gJ2RhdGUnO1xyXG5cdGVuZElucHV0LnZhbHVlID0gdGFzay5lbmREYXRlID8gZm9ybWF0RGF0ZSh0YXNrLmVuZERhdGUpIDogJyc7XHJcblxyXG5cdGNvbnN0IGRhdGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuXHRkYXRlUm93LmNsYXNzTmFtZSA9ICdnYnYtcG9wdXAtcm93Mic7XHJcblx0ZGF0ZVJvdy5hcHBlbmRDaGlsZChjcmVhdGVMYWJlbGVkRmllbGQoJ1N0YXJ0IGRhdGUnLCBzdGFydElucHV0KSk7XHJcblx0ZGF0ZVJvdy5hcHBlbmRDaGlsZChjcmVhdGVMYWJlbGVkRmllbGQoJ0VuZCBkYXRlJywgZW5kSW5wdXQpKTtcclxuXHRwb3B1cC5hcHBlbmRDaGlsZChkYXRlUm93KTtcclxuXHJcblx0Ly8gXHUyNTAwXHUyNTAwIFN0YXR1cyAvIFByaW9yaXR5IHJvdyAodHdvIGNvbHVtbnMpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG5cdGNvbnN0IHN0YXR1c0ZhbGxiYWNrID0gcGx1Z2luU2V0dGluZ3M/LnN0YXR1c09wdGlvbnMgPz8gREVGQVVMVF9QTFVHSU5fU0VUVElOR1Muc3RhdHVzT3B0aW9ucztcclxuXHRjb25zdCBzdGF0dXNPcHRpb25zID0gZ2V0UHJvcGVydHlPcHRpb25zKGFwcCwgJ3N0YXR1cycsIHN0YXR1c0ZhbGxiYWNrLCB0YXNrLnN0YXR1cyk7XHJcblx0Y29uc3Qgc3RhdHVzU2VsID0gY3JlYXRlU2VsZWN0KHN0YXR1c09wdGlvbnMsIHRhc2suc3RhdHVzIHx8IHN0YXR1c09wdGlvbnNbMF0pO1xyXG5cclxuXHRjb25zdCBwcmlvcml0eUZhbGxiYWNrID0gcGx1Z2luU2V0dGluZ3M/LnByaW9yaXR5T3B0aW9ucyA/PyBERUZBVUxUX1BMVUdJTl9TRVRUSU5HUy5wcmlvcml0eU9wdGlvbnM7XHJcblx0Y29uc3QgcHJpb3JpdHlPcHRpb25zID0gZ2V0UHJvcGVydHlPcHRpb25zKGFwcCwgJ3ByaW9yaXR5JywgcHJpb3JpdHlGYWxsYmFjaywgdGFzay5wcmlvcml0eSk7XHJcblx0Y29uc3QgcHJpb3JpdHlTZWwgPSBjcmVhdGVTZWxlY3QocHJpb3JpdHlPcHRpb25zLCB0YXNrLnByaW9yaXR5IHx8IHByaW9yaXR5T3B0aW9uc1swXSk7XHJcblxyXG5cdGNvbnN0IHNwUm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcblx0c3BSb3cuY2xhc3NOYW1lID0gJ2didi1wb3B1cC1yb3cyJztcclxuXHRzcFJvdy5hcHBlbmRDaGlsZChjcmVhdGVMYWJlbGVkRmllbGQoJ1N0YXR1cycsIHN0YXR1c1NlbCkpO1xyXG5cdHNwUm93LmFwcGVuZENoaWxkKGNyZWF0ZUxhYmVsZWRGaWVsZCgnUHJpb3JpdHknLCBwcmlvcml0eVNlbCkpO1xyXG5cdHBvcHVwLmFwcGVuZENoaWxkKHNwUm93KTtcclxuXHJcblx0Ly8gXHUyNTAwXHUyNTAwIERlcGVuZGVuY2llcyAoZWRpdGFibGUpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG5cdGNvbnN0IGRlcHNTZWN0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcblx0ZGVwc1NlY3Rpb24uY2xhc3NOYW1lID0gJ2didi1wb3B1cC1kZXBzJztcclxuXHJcblx0Y29uc3QgZGVwc0hlYWRlclJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdGRlcHNIZWFkZXJSb3cuY2xhc3NOYW1lID0gJ2didi1wb3B1cC1kZXBzLWhlYWRlci1yb3cnO1xyXG5cclxuXHRjb25zdCBkZXBzVGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcblx0ZGVwc1RpdGxlLmNsYXNzTmFtZSA9ICdnYnYtcG9wdXAtZGVwcy1oZWFkZXInO1xyXG5cdGRlcHNUaXRsZS50ZXh0Q29udGVudCA9ICdEZXBlbmRlbmNpZXMnO1xyXG5cclxuXHRjb25zdCBhZGREZXBCdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuXHRhZGREZXBCdG4uY2xhc3NOYW1lID0gJ2didi1wb3B1cC1kZXBzLWFkZCc7XHJcblx0YWRkRGVwQnRuLnRleHRDb250ZW50ID0gJysgQWRkJztcclxuXHRhZGREZXBCdG4udHlwZSA9ICdidXR0b24nO1xyXG5cclxuXHRkZXBzSGVhZGVyUm93LmFwcGVuZENoaWxkKGRlcHNUaXRsZSk7XHJcblx0ZGVwc0hlYWRlclJvdy5hcHBlbmRDaGlsZChhZGREZXBCdG4pO1xyXG5cdGRlcHNTZWN0aW9uLmFwcGVuZENoaWxkKGRlcHNIZWFkZXJSb3cpO1xyXG5cclxuXHRjb25zdCBkZXBSb3dzQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcblx0ZGVwc1NlY3Rpb24uYXBwZW5kQ2hpbGQoZGVwUm93c0NvbnRhaW5lcik7XHJcblx0cG9wdXAuYXBwZW5kQ2hpbGQoZGVwc1NlY3Rpb24pO1xyXG5cclxuXHQvLyBUcmFjayBDaGlwRmlsZVN1Z2dlc3QgaW5zdGFuY2VzIGZvciBjbGVhbnVwIG9uIGRlc3Ryb3kuXHJcblx0Y29uc3QgYWxsU3VnZ2VzdHM6IENoaXBGaWxlU3VnZ2VzdFtdID0gW107XHJcblxyXG5cdGZ1bmN0aW9uIGFkZERlcFJvdyh0eXBlOiBzdHJpbmcsIGluaXRpYWxOYW1lczogc3RyaW5nW10pOiB2b2lkIHtcclxuXHRcdGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0cm93LmNsYXNzTmFtZSA9ICdnYnYtcG9wdXAtZGVwLWVkaXQtcm93JztcclxuXHJcblx0XHRjb25zdCB0eXBlU2VsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2VsZWN0Jyk7XHJcblx0XHR0eXBlU2VsLmNsYXNzTmFtZSA9ICdnYnYtcG9wdXAtZGVwLXR5cGUnO1xyXG5cdFx0Zm9yIChjb25zdCB0IG9mIFsnRlMnLCAnU1MnLCAnRkYnLCAnU0YnXSkge1xyXG5cdFx0XHRjb25zdCBvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb3B0aW9uJyk7XHJcblx0XHRcdG8udmFsdWUgPSB0O1xyXG5cdFx0XHRvLnRleHRDb250ZW50ID0gdDtcclxuXHRcdFx0aWYgKHQgPT09IHR5cGUpIG8uc2VsZWN0ZWQgPSB0cnVlO1xyXG5cdFx0XHR0eXBlU2VsLmFwcGVuZENoaWxkKG8pO1xyXG5cdFx0fVxyXG5cdFx0dHlwZVNlbC5kYXRhc2V0LmRlcFR5cGUgPSB0eXBlO1xyXG5cdFx0dHlwZVNlbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7IHR5cGVTZWwuZGF0YXNldC5kZXBUeXBlID0gdHlwZVNlbC52YWx1ZTsgfSk7XHJcblxyXG5cdFx0Ly8gQ2hpcHMgYXJlYTogZXhpc3RpbmcgaXRlbXMgcmVuZGVyZWQgYXMgZGVsZXRhYmxlIHRhZ3MgKyBibGFuayBpbnB1dCBhdCBlbmRcclxuXHRcdGNvbnN0IGNoaXBzQXJlYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0Y2hpcHNBcmVhLmNsYXNzTmFtZSA9ICdnYnYtZGVwLWNoaXBzLWFyZWEnO1xyXG5cclxuXHRcdGNvbnN0IG5ld0l0ZW1JbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcblx0XHRuZXdJdGVtSW5wdXQudHlwZSA9ICd0ZXh0JztcclxuXHRcdG5ld0l0ZW1JbnB1dC5jbGFzc05hbWUgPSAnZ2J2LWRlcC1uZXctaXRlbSc7XHJcblx0XHRuZXdJdGVtSW5wdXQucGxhY2Vob2xkZXIgPSAnQWRkIG5vdGVcdTIwMjYnO1xyXG5cdFx0Y2hpcHNBcmVhLmFwcGVuZENoaWxkKG5ld0l0ZW1JbnB1dCk7XHJcblx0XHQvLyBDbGlja2luZyBhbnl3aGVyZSBpbiB0aGUgY2hpcHMgYXJlYSBmb2N1c2VzIHRoZSBpbnB1dFxyXG5cdFx0Y2hpcHNBcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcclxuXHRcdFx0aWYgKGUudGFyZ2V0ID09PSBjaGlwc0FyZWEpIG5ld0l0ZW1JbnB1dC5mb2N1cygpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0ZnVuY3Rpb24gYWRkQ2hpcChuYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuXHRcdFx0Y29uc3QgY2hpcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuXHRcdFx0Y2hpcC5jbGFzc05hbWUgPSAnZ2J2LWRlcC1jaGlwJztcclxuXHRcdFx0Y2hpcC5kYXRhc2V0LmRlcFZhbHVlID0gbmFtZTtcclxuXHJcblx0XHRcdGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG5cdFx0XHRsYWJlbC50ZXh0Q29udGVudCA9IHN0cmlwV2lraWxpbmsobmFtZSk7XHJcblxyXG5cdFx0XHRjb25zdCB4QnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcblx0XHRcdHhCdG4udHlwZSA9ICdidXR0b24nO1xyXG5cdFx0XHR4QnRuLmNsYXNzTmFtZSA9ICdnYnYtZGVwLWNoaXAtcmVtb3ZlJztcclxuXHRcdFx0eEJ0bi50ZXh0Q29udGVudCA9ICdcdTAwRDcnO1xyXG5cdFx0XHR4QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2hpcC5yZW1vdmUoKSk7XHJcblxyXG5cdFx0XHRjaGlwLmFwcGVuZENoaWxkKGxhYmVsKTtcclxuXHRcdFx0Y2hpcC5hcHBlbmRDaGlsZCh4QnRuKTtcclxuXHRcdFx0Y2hpcHNBcmVhLmluc2VydEJlZm9yZShjaGlwLCBuZXdJdGVtSW5wdXQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoY29uc3QgbiBvZiBpbml0aWFsTmFtZXMpIGFkZENoaXAobik7XHJcblxyXG5cdFx0Ly8gTmF0aXZlIE9ic2lkaWFuIGF1dG9jb21wbGV0ZSBcdTIwMTQgb24gc2VsZWN0aW9uOiBjcmVhdGUgY2hpcCwgY2xlYXIgaW5wdXRcclxuXHRcdGNvbnN0IHN1Z2dlc3QgPSBuZXcgQ2hpcEZpbGVTdWdnZXN0KGFwcCwgbmV3SXRlbUlucHV0LCAoZmlsZSkgPT4ge1xyXG5cdFx0XHRhZGRDaGlwKGBbWyR7ZmlsZS5iYXNlbmFtZX1dXWApO1xyXG5cdFx0XHRuZXdJdGVtSW5wdXQuZm9jdXMoKTtcclxuXHRcdH0pO1xyXG5cdFx0YWxsU3VnZ2VzdHMucHVzaChzdWdnZXN0KTtcclxuXHJcblx0XHRjb25zdCByZW1vdmVCdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuXHRcdHJlbW92ZUJ0bi5jbGFzc05hbWUgPSAnZ2J2LXBvcHVwLWRlcC1yZW1vdmUnO1xyXG5cdFx0cmVtb3ZlQnRuLnRleHRDb250ZW50ID0gJ1x1MDBENyc7XHJcblx0XHRyZW1vdmVCdG4udHlwZSA9ICdidXR0b24nO1xyXG5cdFx0cmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG5cdFx0XHRzdWdnZXN0LmNsb3NlKCk7XHJcblx0XHRcdHJvdy5yZW1vdmUoKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHJvdy5hcHBlbmRDaGlsZCh0eXBlU2VsKTtcclxuXHRcdHJvdy5hcHBlbmRDaGlsZChjaGlwc0FyZWEpO1xyXG5cdFx0cm93LmFwcGVuZENoaWxkKHJlbW92ZUJ0bik7XHJcblx0XHRkZXBSb3dzQ29udGFpbmVyLmFwcGVuZENoaWxkKHJvdyk7XHJcblx0fVxyXG5cclxuXHQvLyBHcm91cCBleGlzdGluZyBkZXBzIGJ5IHR5cGUgc28gZWFjaCB0eXBlIGdldHMgb25lIHJvdyB3aXRoIG11bHRpcGxlIGNoaXBzXHJcblx0Y29uc3QgaW5pdEJ5VHlwZTogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge307XHJcblx0Zm9yIChjb25zdCBkZXAgb2YgdGFzay5kZXBlbmRlbmNpZXMpIHtcclxuXHRcdGlmIChkZXAudGFyZ2V0TmFtZSkge1xyXG5cdFx0XHQoaW5pdEJ5VHlwZVtkZXAudHlwZV0gPz89IFtdKS5wdXNoKGRlcC50YXJnZXROYW1lKTtcclxuXHRcdH1cclxuXHR9XHJcblx0Zm9yIChjb25zdCBbdHlwZSwgbmFtZXNdIG9mIE9iamVjdC5lbnRyaWVzKGluaXRCeVR5cGUpKSBhZGREZXBSb3codHlwZSwgbmFtZXMpO1xyXG5cclxuXHRhZGREZXBCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBhZGREZXBSb3coJ0ZTJywgW10pKTtcclxuXHJcblx0Ly8gXHUyNTAwXHUyNTAwIEFjdGlvbnMgcm93IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG5cdGNvbnN0IGFjdGlvbnNSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuXHRhY3Rpb25zUm93LmNsYXNzTmFtZSA9ICdnYnYtcG9wdXAtYWN0aW9ucyc7XHJcblxyXG5cdGNvbnN0IHNhdmVCdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuXHRzYXZlQnRuLmNsYXNzTmFtZSA9ICdnYnYtcG9wdXAtc2F2ZSBtb2QtY3RhJztcclxuXHRzYXZlQnRuLnRleHRDb250ZW50ID0gJ1NhdmUnO1xyXG5cclxuXHRjb25zdCBjYW5jZWxCdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuXHRjYW5jZWxCdG4uY2xhc3NOYW1lID0gJ2didi1wb3B1cC1jYW5jZWwnO1xyXG5cdGNhbmNlbEJ0bi50ZXh0Q29udGVudCA9ICdDYW5jZWwnO1xyXG5cclxuXHRhY3Rpb25zUm93LmFwcGVuZENoaWxkKHNhdmVCdG4pO1xyXG5cdGFjdGlvbnNSb3cuYXBwZW5kQ2hpbGQoY2FuY2VsQnRuKTtcclxuXHRwb3B1cC5hcHBlbmRDaGlsZChhY3Rpb25zUm93KTtcclxuXHJcblx0Ly8gXHUyNTAwXHUyNTAwIEFwcGVuZCwgcG9zaXRpb24sIHNob3cgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwb3B1cCk7XHJcblxyXG5cdGNvbnN0IGFuY2hvclJlY3QgPSBhbmNob3JFbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRjb25zdCBwb3B1cFJlY3QgPSBwb3B1cC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRjb25zdCB7IGxlZnQsIHRvcCB9ID0gY2xhbXBUb1ZpZXdwb3J0KGFuY2hvclJlY3QsIHBvcHVwUmVjdC53aWR0aCB8fCAyODAsIHBvcHVwUmVjdC5oZWlnaHQgfHwgMjQwLCAwLCA4KTtcclxuXHJcblx0cG9wdXAuc3R5bGUubGVmdCA9IGAke2xlZnR9cHhgO1xyXG5cdHBvcHVwLnN0eWxlLnRvcCA9IGAke3RvcH1weGA7XHJcblx0cG9wdXAuc3R5bGUudmlzaWJpbGl0eSA9ICcnO1xyXG5cclxuXHQvLyBcdTI1MDBcdTI1MDAgQ2xlYW51cCBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG5cdGZ1bmN0aW9uIGRlc3Ryb3koKTogdm9pZCB7XHJcblx0XHRmb3IgKGNvbnN0IHMgb2YgYWxsU3VnZ2VzdHMpIHMuY2xvc2UoKTtcclxuXHRcdHBvcHVwLnJlbW92ZSgpO1xyXG5cdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uS2V5RG93bik7XHJcblx0XHQvLyBVc2Ugc2V0VGltZW91dCB0byBhdm9pZCBpbW1lZGlhdGUgcmUtdHJpZ2dlciBmcm9tIHRoZSBjbGljayB0aGF0IG9wZW5lZCB0aGUgcG9wdXBcclxuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIG9uRG9jQ2xpY2ssIHRydWUpO1xyXG5cdFx0fSwgMCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBvbktleURvd24oZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xyXG5cdFx0aWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xyXG5cdFx0XHRjbG9zZUFjdGl2ZVBvcHVwKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBvbkRvY0NsaWNrKGU6IE1vdXNlRXZlbnQpOiB2b2lkIHtcclxuXHRcdGNvbnN0IHRhcmdldCA9IGUudGFyZ2V0IGFzIEVsZW1lbnQ7XHJcblx0XHRpZiAoIXBvcHVwLmNvbnRhaW5zKHRhcmdldCkgJiYgIXRhcmdldC5jbG9zZXN0Py4oJy5zdWdnZXN0aW9uLWNvbnRhaW5lcicpKSB7XHJcblx0XHRcdGNsb3NlQWN0aXZlUG9wdXAoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbktleURvd24pO1xyXG5cdC8vIERlZmVyIG91dHNpZGUtY2xpY2sgbGlzdGVuZXIgYnkgb25lIHRpY2sgc28gdGhlIG9wZW5pbmcgY2xpY2sgZG9lc24ndCBpbW1lZGlhdGVseSBjbG9zZSB0aGUgcG9wdXBcclxuXHRzZXRUaW1lb3V0KCgpID0+IHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb25Eb2NDbGljaywgdHJ1ZSk7XHJcblx0fSwgMCk7XHJcblxyXG5cdGFjdGl2ZVBvcHVwID0geyBlbDogcG9wdXAsIGRlc3Ryb3kgfTtcclxuXHJcblx0Ly8gXHUyNTAwXHUyNTAwIFNhdmUgaGFuZGxlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcclxuXHRzYXZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xyXG5cdFx0Y29uc3QgbmV3U3RhcnQgPSBzdGFydElucHV0LnZhbHVlOyAvLyBZWVlZLU1NLUREIG9yICcnXHJcblx0XHRjb25zdCBuZXdFbmQgPSBlbmRJbnB1dC52YWx1ZTtcclxuXHRcdGNvbnN0IG5ld1N0YXR1cyA9IHN0YXR1c1NlbC52YWx1ZTtcclxuXHRcdGNvbnN0IG5ld1ByaW9yaXR5ID0gcHJpb3JpdHlTZWwudmFsdWU7XHJcblxyXG5cdFx0Ly8gQ29sbGVjdCBkZXAgcm93cyBmcm9tIHRoZSBET00gKGNoaXBzIHBlciByb3cgKyBhbnkgcGVuZGluZyBpbnB1dCB0ZXh0KVxyXG5cdFx0Y29uc3QgZGVwc0J5VHlwZTogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0geyBGUzogW10sIFNTOiBbXSwgRkY6IFtdLCBTRjogW10gfTtcclxuXHRcdGZvciAoY29uc3Qgcm93IG9mIEFycmF5LmZyb20oZGVwUm93c0NvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcuZ2J2LXBvcHVwLWRlcC1lZGl0LXJvdycpKSkge1xyXG5cdFx0XHRjb25zdCB0eXBlID0gKHJvdy5xdWVyeVNlbGVjdG9yKCcuZ2J2LXBvcHVwLWRlcC10eXBlJykgYXMgSFRNTFNlbGVjdEVsZW1lbnQpLnZhbHVlO1xyXG5cdFx0XHRpZiAoISh0eXBlIGluIGRlcHNCeVR5cGUpKSBjb250aW51ZTtcclxuXHRcdFx0Zm9yIChjb25zdCBjaGlwIG9mIEFycmF5LmZyb20ocm93LnF1ZXJ5U2VsZWN0b3JBbGwoJy5nYnYtZGVwLWNoaXAnKSkpIHtcclxuXHRcdFx0XHRjb25zdCB2YWwgPSAoY2hpcCBhcyBIVE1MRWxlbWVudCkuZGF0YXNldC5kZXBWYWx1ZTtcclxuXHRcdFx0XHRpZiAodmFsKSBkZXBzQnlUeXBlW3R5cGVdLnB1c2godmFsKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBBbHNvIHNhdmUgYW55IHRleHQgdHlwZWQgYnV0IG5vdCB5ZXQgY29uZmlybWVkIGFzIGEgY2hpcFxyXG5cdFx0XHRjb25zdCBwZW5kaW5nID0gKChyb3cucXVlcnlTZWxlY3RvcignLmdidi1kZXAtbmV3LWl0ZW0nKSBhcyBIVE1MSW5wdXRFbGVtZW50KT8udmFsdWUgPz8gJycpLnRyaW0oKTtcclxuXHRcdFx0aWYgKHBlbmRpbmcpIGRlcHNCeVR5cGVbdHlwZV0ucHVzaChwZW5kaW5nLnN0YXJ0c1dpdGgoJ1tbJykgPyBwZW5kaW5nIDogYFtbJHtwZW5kaW5nfV1dYCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3Qgc3RhcnRLZXkgPSBwbHVnaW5TZXR0aW5ncz8uc3RhcnREYXRlUHJvcCB8fCBERUZBVUxUX1BMVUdJTl9TRVRUSU5HUy5zdGFydERhdGVQcm9wO1xyXG5cdFx0Y29uc3QgZW5kS2V5ID0gcGx1Z2luU2V0dGluZ3M/LmVuZERhdGVQcm9wIHx8IERFRkFVTFRfUExVR0lOX1NFVFRJTkdTLmVuZERhdGVQcm9wO1xyXG5cclxuXHRcdGF3YWl0IChhcHAuZmlsZU1hbmFnZXIgYXMgYW55KS5wcm9jZXNzRnJvbnRNYXR0ZXIodGFzay5maWxlLCAoZm06IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB7XHJcblx0XHRcdGlmIChuZXdTdGFydCkge1xyXG5cdFx0XHRcdGZtW3N0YXJ0S2V5XSA9IG5ld1N0YXJ0O1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGRlbGV0ZSBmbVtzdGFydEtleV07XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKG5ld0VuZCkge1xyXG5cdFx0XHRcdGZtW2VuZEtleV0gPSBuZXdFbmQ7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZGVsZXRlIGZtW2VuZEtleV07XHJcblx0XHRcdH1cclxuXHRcdFx0Zm1bJ3N0YXR1cyddID0gbmV3U3RhdHVzO1xyXG5cdFx0XHRmbVsncHJpb3JpdHknXSA9IG5ld1ByaW9yaXR5O1xyXG5cclxuXHRcdFx0Ly8gV3JpdGUgZGVwIGZpZWxkczsgZGVsZXRlIGlmIGVtcHR5LlxyXG5cdFx0XHQvLyBOYW1lcyBhcmUgc3RvcmVkIGFzLWlzIChhbHJlYWR5IGluY2x1ZGUgW1suLi5dXSBmcm9tIHRoZSBpbnB1dCkuXHJcblx0XHRcdGZvciAoY29uc3QgW3R5cGUsIGZpZWxkXSBvZiBPYmplY3QuZW50cmllcyhERVBfVFlQRV9UT19GSUVMRCkpIHtcclxuXHRcdFx0XHRjb25zdCBuYW1lcyA9IGRlcHNCeVR5cGVbdHlwZV07XHJcblx0XHRcdFx0aWYgKG5hbWVzLmxlbmd0aCA+IDApIHtcclxuXHRcdFx0XHRcdGZtW2ZpZWxkXSA9IG5hbWVzO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRkZWxldGUgZm1bZmllbGRdO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0Y2xvc2VBY3RpdmVQb3B1cCgpO1xyXG5cdFx0b25VcGRhdGUoKTtcclxuXHR9KTtcclxuXHJcblx0Ly8gXHUyNTAwXHUyNTAwIENhbmNlbCBoYW5kbGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG5cdGNhbmNlbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuXHRcdGNsb3NlQWN0aXZlUG9wdXAoKTtcclxuXHR9KTtcclxufVxyXG4iLCAiaW1wb3J0IHR5cGUgeyBHYW50dFRhc2ssIFRhc2tHcm91cCwgVGltZWxpbmVDb25maWcgfSBmcm9tICcuL3R5cGVzLnRzJztcbmltcG9ydCB7IGRheXNCZXR3ZWVuLCBmb3JtYXREYXRlLCBnZW5lcmF0ZUNvbHVtbnMgfSBmcm9tICcuL3RpbWVsaW5lLnRzJztcblxuLy8gXHUyNTAwXHUyNTAwIEludGVybmFsIGhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGRlcHNMYWJlbCh0YXNrOiBHYW50dFRhc2spOiBzdHJpbmcge1xuXHRpZiAoIXRhc2suZGVwZW5kZW5jaWVzIHx8IHRhc2suZGVwZW5kZW5jaWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICcnO1xuXHRyZXR1cm4gdGFzay5kZXBlbmRlbmNpZXNcblx0XHQuZmlsdGVyKGQgPT4gZC50YXJnZXROYW1lKVxuXHRcdC5tYXAoZCA9PiBgJHtkLnRhcmdldE5hbWV9ICgke2QudHlwZX0pYClcblx0XHQuam9pbignLCAnKTtcbn1cblxuZnVuY3Rpb24gZHVyYXRpb25EYXlzKHRhc2s6IEdhbnR0VGFzayk6IHN0cmluZyB7XG5cdGlmICghdGFzay5zdGFydERhdGUgfHwgIXRhc2suZW5kRGF0ZSkgcmV0dXJuICcnO1xuXHRyZXR1cm4gU3RyaW5nKGRheXNCZXR3ZWVuKHRhc2suc3RhcnREYXRlLCB0YXNrLmVuZERhdGUpKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFRTViBleHBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IERBVEFfSEVBREVSUyA9IFsnVGFzaycsICdTdGF0dXMnLCAnUHJpb3JpdHknLCAnU3RhcnQnLCAnRW5kJywgJ0R1cmF0aW9uIChkYXlzKScsICdEZXBlbmRlbmNpZXMnXTtcbmNvbnN0IEJBUl9DSEFSID0gJ1x1MjU4OCc7XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSB0YXNrIGJhciBvdmVybGFwcyB0aGUgY29sdW1uJ3MgdGltZSByYW5nZS5cbiAqIGNvbFN0YXJ0IGlzIGluY2x1c2l2ZSwgY29sRW5kIGlzIHRoZSBkYXkgYWZ0ZXIgdGhlIGxhc3QgZGF5IGluIHRoZSBjb2x1bW4uXG4gKi9cbmZ1bmN0aW9uIHRhc2tPdmVybGFwc0NvbHVtbih0YXNrOiBHYW50dFRhc2ssIGNvbFN0YXJ0OiBEYXRlLCBjb2xFbmQ6IERhdGUpOiBib29sZWFuIHtcblx0Y29uc3Qgc3RhcnQgPSB0YXNrLnN0YXJ0RGF0ZTtcblx0Y29uc3QgZW5kID0gdGFzay5lbmREYXRlO1xuXHRpZiAoIXN0YXJ0IHx8ICFlbmQpIHJldHVybiBmYWxzZTtcblx0cmV0dXJuIHN0YXJ0IDwgY29sRW5kICYmIGVuZCA+IGNvbFN0YXJ0O1xufVxuXG4vKipcbiAqIEV4cG9ydCB0YXNrIGdyb3VwcyB0byBUU1YgaW5jbHVkaW5nIGEgdmlzdWFsIEdhbnR0IGJhciBhcHByb3hpbWF0aW9uLlxuICpcbiAqIEZvcm1hdDpcbiAqICAgQ29sdW1ucyAxXHUyMDEzNzogVGFzayB8IFN0YXR1cyB8IFByaW9yaXR5IHwgU3RhcnQgfCBFbmQgfCBEdXJhdGlvbiB8IERlcGVuZGVuY2llc1xuICogICBDb2x1bW5zIDgrOiAgT25lIGNvbHVtbiBwZXIgdGltZSB1bml0ICh3ZWVrL21vbnRoL3F1YXJ0ZXIpIFx1MjAxNCAnXHUyNTg4JyBpZiB0aGVcbiAqICAgICAgICAgICAgICAgdGFzayBiYXIgY292ZXJzIHRoYXQgcGVyaW9kLCBlbXB0eSBvdGhlcndpc2UuXG4gKlxuICogVGhlIGRhdGUgY29sdW1uIGhlYWRlcnMgdXNlIHRoZSBzYW1lIGxhYmVscyBhcyB0aGUgb24tc2NyZWVuIHRpbWVsaW5lLlxuICogU3VpdGFibGUgZm9yIHBhc3RpbmcgZGlyZWN0bHkgaW50byBFeGNlbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4cG9ydFRvVFNWKGdyb3VwczogVGFza0dyb3VwW10sIHRpbWVsaW5lQ29uZmlnOiBUaW1lbGluZUNvbmZpZyk6IHN0cmluZyB7XG5cdGNvbnN0IGNvbHVtbnMgPSBnZW5lcmF0ZUNvbHVtbnModGltZWxpbmVDb25maWcpO1xuXG5cdC8vIENvbHVtbiBkYXRlIHJhbmdlcyBcdTIwMTQgZWFjaCBjb2x1bW4gc3BhbnMgZnJvbSBzdGFydERhdGUgdG8gdGhlIG5leHQgY29sdW1uJ3Mgc3RhcnREYXRlXG5cdGNvbnN0IGNvbFJhbmdlcyA9IGNvbHVtbnMubWFwKChjb2wsIGkpID0+IHtcblx0XHRjb25zdCBjb2xTdGFydCA9IGNvbC5zdGFydERhdGU7XG5cdFx0Y29uc3QgY29sRW5kID0gaSArIDEgPCBjb2x1bW5zLmxlbmd0aFxuXHRcdFx0PyBjb2x1bW5zW2kgKyAxXS5zdGFydERhdGVcblx0XHRcdDogbmV3IERhdGUoY29sLnN0YXJ0RGF0ZS5nZXRUaW1lKCkgKyBjb2wud2lkdGhQeCAvIHRpbWVsaW5lQ29uZmlnLnBpeGVsc1BlckRheSAqIDg2NDAwMDAwKTtcblx0XHRyZXR1cm4geyBsYWJlbDogZGlzcGxheUxhYmVsKGNvbC5sYWJlbCksIGNvbFN0YXJ0LCBjb2xFbmQgfTtcblx0fSk7XG5cblx0Ly8gSGVhZGVyIHJvd1xuXHRjb25zdCBoZWFkZXJDZWxscyA9IFsuLi5EQVRBX0hFQURFUlMsIC4uLmNvbFJhbmdlcy5tYXAoYyA9PiBjLmxhYmVsKV07XG5cdGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtoZWFkZXJDZWxscy5qb2luKCdcXHQnKV07XG5cblx0Zm9yIChjb25zdCBncm91cCBvZiBncm91cHMpIHtcblx0XHRpZiAoZ3JvdXAua2V5KSB7XG5cdFx0XHQvLyBHcm91cCBoZWFkZXIgcm93IFx1MjAxNCBwYWQgZGF0YSBjb2xzICsgb25lIGxhYmVsIGluIGZpcnN0IGRhdGUgY29sXG5cdFx0XHRjb25zdCBwYWQgPSAnXFx0Jy5yZXBlYXQoREFUQV9IRUFERVJTLmxlbmd0aCAtIDEpO1xuXHRcdFx0bGluZXMucHVzaChgJHtncm91cC5rZXl9JHtwYWR9YCk7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgdGFzayBvZiBncm91cC50YXNrcykge1xuXHRcdFx0Y29uc3QgZGF0YUNvbHMgPSBbXG5cdFx0XHRcdHRhc2sudGl0bGUgfHwgdGFzay5maWxlLmJhc2VuYW1lLFxuXHRcdFx0XHR0YXNrLnN0YXR1cyB8fCAnJyxcblx0XHRcdFx0dGFzay5wcmlvcml0eSB8fCAnJyxcblx0XHRcdFx0dGFzay5zdGFydERhdGUgPyBmb3JtYXREYXRlKHRhc2suc3RhcnREYXRlKSA6ICcnLFxuXHRcdFx0XHR0YXNrLmVuZERhdGUgPyBmb3JtYXREYXRlKHRhc2suZW5kRGF0ZSkgOiAnJyxcblx0XHRcdFx0ZHVyYXRpb25EYXlzKHRhc2spLFxuXHRcdFx0XHRkZXBzTGFiZWwodGFzayksXG5cdFx0XHRdLm1hcChjID0+IGMucmVwbGFjZSgvXFx0L2csICcgJykpO1xuXG5cdFx0XHRjb25zdCBiYXJDb2xzID0gY29sUmFuZ2VzLm1hcCgoeyBjb2xTdGFydCwgY29sRW5kIH0pID0+XG5cdFx0XHRcdHRhc2tPdmVybGFwc0NvbHVtbih0YXNrLCBjb2xTdGFydCwgY29sRW5kKSA/IEJBUl9DSEFSIDogJydcblx0XHRcdCk7XG5cblx0XHRcdGxpbmVzLnB1c2goWy4uLmRhdGFDb2xzLCAuLi5iYXJDb2xzXS5qb2luKCdcXHQnKSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgdGhlIGludGVybmFsIGNvbHVtbiBsYWJlbCB0byBhIFRTVi1mcmllbmRseSBoZWFkZXIuXG4gKiBEYXktem9vbSBsYWJlbHMgdXNlIFwiTU1NIFlZWVl8RERcIiBmb3JtYXQgXHUyMDE0IHdlIGNvbGxhcHNlIHRvIFwiTU1NIEREXCIgc28gdGhlXG4gKiBtb250aCBjb250ZXh0IGlzIHByZXNlcnZlZCB3aXRob3V0IHRoZSBwaXBlIGNoYXJhY3RlciBpbiB0aGUgc3ByZWFkc2hlZXQgY29sdW1uIGhlYWRlci5cbiAqIE90aGVyIHpvb20gbGV2ZWxzIHVzZSB0aGUgbGFiZWwgYXMtaXMuXG4gKi9cbmZ1bmN0aW9uIGRpc3BsYXlMYWJlbChsYWJlbDogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3QgcGlwZUlkeCA9IGxhYmVsLmluZGV4T2YoJ3wnKTtcblx0aWYgKHBpcGVJZHggPCAwKSByZXR1cm4gbGFiZWw7XG5cdC8vIFwiQXByIDIwMjZ8MTRcIiAgXHUyMTkyIFwiQXByIDE0XCIgIChkcm9wIHllYXIgdG8ga2VlcCBoZWFkZXIgY29tcGFjdClcblx0Y29uc3QgbW9udGggPSBsYWJlbC5zbGljZSgwLCBsYWJlbC5pbmRleE9mKCcgJykpOyAgLy8gXCJBcHJcIlxuXHRjb25zdCBkYXkgPSBsYWJlbC5zbGljZShwaXBlSWR4ICsgMSk7ICAgICAgICAgICAgICAvLyBcIjE0XCJcblx0cmV0dXJuIGAke21vbnRofSAke2RheX1gO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgQ2xpcGJvYXJkIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29weVRvQ2xpcGJvYXJkKHRleHQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0KTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIE1hcmtkb3duIHRhYmxlIGV4cG9ydCAoa2VwdCBmb3IgT2JzaWRpYW4gbm90ZSBwYXN0ZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGVzY2FwZUNlbGwoczogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHMucmVwbGFjZSgvXFx8L2csICdcXFxcfCcpO1xufVxuXG5mdW5jdGlvbiB0YXNrVG9NYXJrZG93blJvdyh0YXNrOiBHYW50dFRhc2spOiBzdHJpbmcge1xuXHRjb25zdCBsaW5rID0gYFtbJHtlc2NhcGVDZWxsKHRhc2suZmlsZS5iYXNlbmFtZSl9XV1gO1xuXHRjb25zdCBzdGF0dXMgPSBlc2NhcGVDZWxsKHRhc2suc3RhdHVzIHx8ICctJyk7XG5cdGNvbnN0IHByaW9yaXR5ID0gZXNjYXBlQ2VsbCh0YXNrLnByaW9yaXR5IHx8ICctJyk7XG5cdGNvbnN0IHN0YXJ0ID0gdGFzay5zdGFydERhdGUgPyBmb3JtYXREYXRlKHRhc2suc3RhcnREYXRlKSA6ICctJztcblx0Y29uc3QgZW5kID0gdGFzay5lbmREYXRlID8gZm9ybWF0RGF0ZSh0YXNrLmVuZERhdGUpIDogJy0nO1xuXHRjb25zdCBkdXJhdGlvbiA9IGR1cmF0aW9uRGF5cyh0YXNrKSB8fCAnLSc7XG5cdGNvbnN0IGRlcHMgPSBlc2NhcGVDZWxsKGRlcHNMYWJlbCh0YXNrKSB8fCAnLScpO1xuXHRyZXR1cm4gYHwgJHtsaW5rfSB8ICR7c3RhdHVzfSB8ICR7cHJpb3JpdHl9IHwgJHtzdGFydH0gfCAke2VuZH0gfCAke2R1cmF0aW9ufSB8ICR7ZGVwc30gfGA7XG59XG5cbmNvbnN0IE1BUktET1dOX0hFQURFUiA9XG5cdCd8IFRhc2sgfCBTdGF0dXMgfCBQcmlvcml0eSB8IFN0YXJ0IHwgRW5kIHwgRHVyYXRpb24gKGRheXMpIHwgRGVwZW5kZW5jaWVzIHxcXG4nICtcblx0J3wtLS0tLS18LS0tLS0tLS18LS0tLS0tLS0tLXwtLS0tLS0tfC0tLS0tfC0tLS0tLS0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tfCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBleHBvcnRUb01hcmtkb3duVGFibGUoZ3JvdXBzOiBUYXNrR3JvdXBbXSk6IHN0cmluZyB7XG5cdGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtNQVJLRE9XTl9IRUFERVJdO1xuXHRmb3IgKGNvbnN0IGdyb3VwIG9mIGdyb3Vwcykge1xuXHRcdGlmIChncm91cC5rZXkpIGxpbmVzLnB1c2goYHwgKioke2VzY2FwZUNlbGwoZ3JvdXAua2V5KX0qKiB8IHwgfCB8IHwgfCB8YCk7XG5cdFx0Zm9yIChjb25zdCB0YXNrIG9mIGdyb3VwLnRhc2tzKSBsaW5lcy5wdXNoKHRhc2tUb01hcmtkb3duUm93KHRhc2spKTtcblx0fVxuXHRyZXR1cm4gbGluZXMuam9pbignXFxuJyk7XG59XG4iLCAiaW1wb3J0IHsgQXBwIH0gZnJvbSAnb2JzaWRpYW4nO1xyXG5pbXBvcnQgeyBHYW50dFRhc2ssIFRhc2tEZXBlbmRlbmN5LCBQbHVnaW5TZXR0aW5ncywgREVGQVVMVF9QTFVHSU5fU0VUVElOR1MgfSBmcm9tICcuL3R5cGVzLnRzJztcclxuaW1wb3J0IHsgZm9ybWF0RGF0ZSB9IGZyb20gJy4vdGltZWxpbmUudHMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBTY2hlZHVsZVZpb2xhdGlvbiB7XHJcbiAgc291cmNlVGFzazogR2FudHRUYXNrO1xyXG4gIHRhcmdldFRhc2s6IEdhbnR0VGFzaztcclxuICBkZXA6IFRhc2tEZXBlbmRlbmN5O1xyXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XHJcbiAgZml4RmllbGQ6ICdzdGFydCcgfCAnZW5kJztcclxuICBzdWdnZXN0ZWREYXRlOiBEYXRlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0VmlvbGF0aW9ucyh0YXNrczogR2FudHRUYXNrW10pOiBTY2hlZHVsZVZpb2xhdGlvbltdIHtcclxuICBjb25zdCB2aW9sYXRpb25zOiBTY2hlZHVsZVZpb2xhdGlvbltdID0gW107XHJcblxyXG4gIGNvbnN0IHRhc2tCeUlkID0gbmV3IE1hcDxzdHJpbmcsIEdhbnR0VGFzaz4oKTtcclxuICBmb3IgKGNvbnN0IHRhc2sgb2YgdGFza3MpIHRhc2tCeUlkLnNldCh0YXNrLmlkLCB0YXNrKTtcclxuXHJcbiAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFza3MpIHtcclxuICAgIGZvciAoY29uc3QgZGVwIG9mIHRhcmdldC5kZXBlbmRlbmNpZXMpIHtcclxuICAgICAgY29uc3Qgc291cmNlID0gdGFza0J5SWQuZ2V0KGRlcC50YXJnZXRQYXRoKTtcclxuICAgICAgaWYgKCFzb3VyY2UpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgc3dpdGNoIChkZXAudHlwZSkge1xyXG4gICAgICAgIGNhc2UgJ0ZTJzoge1xyXG4gICAgICAgICAgaWYgKHNvdXJjZS5lbmREYXRlID09PSBudWxsIHx8IHRhcmdldC5zdGFydERhdGUgPT09IG51bGwpIGJyZWFrO1xyXG4gICAgICAgICAgaWYgKHRhcmdldC5zdGFydERhdGUgPCBzb3VyY2UuZW5kRGF0ZSkge1xyXG4gICAgICAgICAgICB2aW9sYXRpb25zLnB1c2goe1xyXG4gICAgICAgICAgICAgIHNvdXJjZVRhc2s6IHNvdXJjZSwgdGFyZ2V0VGFzazogdGFyZ2V0LCBkZXAsXHJcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3RhcmdldC50aXRsZX0gbXVzdCBzdGFydCBhZnRlciAke3NvdXJjZS50aXRsZX0gZmluaXNoZXMgKCR7Zm9ybWF0RGF0ZShzb3VyY2UuZW5kRGF0ZSl9KWAsXHJcbiAgICAgICAgICAgICAgZml4RmllbGQ6ICdzdGFydCcsIHN1Z2dlc3RlZERhdGU6IHNvdXJjZS5lbmREYXRlLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYXNlICdTUyc6IHtcclxuICAgICAgICAgIGlmIChzb3VyY2Uuc3RhcnREYXRlID09PSBudWxsIHx8IHRhcmdldC5zdGFydERhdGUgPT09IG51bGwpIGJyZWFrO1xyXG4gICAgICAgICAgaWYgKHRhcmdldC5zdGFydERhdGUgPCBzb3VyY2Uuc3RhcnREYXRlKSB7XHJcbiAgICAgICAgICAgIHZpb2xhdGlvbnMucHVzaCh7XHJcbiAgICAgICAgICAgICAgc291cmNlVGFzazogc291cmNlLCB0YXJnZXRUYXNrOiB0YXJnZXQsIGRlcCxcclxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7dGFyZ2V0LnRpdGxlfSBtdXN0IHN0YXJ0IG5vIGVhcmxpZXIgdGhhbiAke3NvdXJjZS50aXRsZX0gKCR7Zm9ybWF0RGF0ZShzb3VyY2Uuc3RhcnREYXRlKX0pYCxcclxuICAgICAgICAgICAgICBmaXhGaWVsZDogJ3N0YXJ0Jywgc3VnZ2VzdGVkRGF0ZTogc291cmNlLnN0YXJ0RGF0ZSxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICAgICAgY2FzZSAnRkYnOiB7XHJcbiAgICAgICAgICBpZiAoc291cmNlLmVuZERhdGUgPT09IG51bGwgfHwgdGFyZ2V0LmVuZERhdGUgPT09IG51bGwpIGJyZWFrO1xyXG4gICAgICAgICAgaWYgKHRhcmdldC5lbmREYXRlIDwgc291cmNlLmVuZERhdGUpIHtcclxuICAgICAgICAgICAgdmlvbGF0aW9ucy5wdXNoKHtcclxuICAgICAgICAgICAgICBzb3VyY2VUYXNrOiBzb3VyY2UsIHRhcmdldFRhc2s6IHRhcmdldCwgZGVwLFxyXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHt0YXJnZXQudGl0bGV9IG11c3QgZmluaXNoIGFmdGVyICR7c291cmNlLnRpdGxlfSBmaW5pc2hlcyAoJHtmb3JtYXREYXRlKHNvdXJjZS5lbmREYXRlKX0pYCxcclxuICAgICAgICAgICAgICBmaXhGaWVsZDogJ2VuZCcsIHN1Z2dlc3RlZERhdGU6IHNvdXJjZS5lbmREYXRlLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYXNlICdTRic6IHtcclxuICAgICAgICAgIGlmIChzb3VyY2Uuc3RhcnREYXRlID09PSBudWxsIHx8IHRhcmdldC5lbmREYXRlID09PSBudWxsKSBicmVhaztcclxuICAgICAgICAgIGlmICh0YXJnZXQuZW5kRGF0ZSA8IHNvdXJjZS5zdGFydERhdGUpIHtcclxuICAgICAgICAgICAgdmlvbGF0aW9ucy5wdXNoKHtcclxuICAgICAgICAgICAgICBzb3VyY2VUYXNrOiBzb3VyY2UsIHRhcmdldFRhc2s6IHRhcmdldCwgZGVwLFxyXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHt0YXJnZXQudGl0bGV9IG11c3QgZmluaXNoIGFmdGVyICR7c291cmNlLnRpdGxlfSBzdGFydHMgKCR7Zm9ybWF0RGF0ZShzb3VyY2Uuc3RhcnREYXRlKX0pYCxcclxuICAgICAgICAgICAgICBmaXhGaWVsZDogJ2VuZCcsIHN1Z2dlc3RlZERhdGU6IHNvdXJjZS5zdGFydERhdGUsXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gdmlvbGF0aW9ucztcclxufVxyXG5cclxubGV0IGFjdGl2ZVBhbmVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlVmlvbGF0aW9uUGFuZWwoKTogdm9pZCB7XHJcbiAgaWYgKGFjdGl2ZVBhbmVsKSB7XHJcbiAgICBhY3RpdmVQYW5lbC5yZW1vdmUoKTtcclxuICAgIGFjdGl2ZVBhbmVsID0gbnVsbDtcclxuICB9XHJcbn1cclxuXHJcbmNvbnN0IERFUF9WRVJCUzogUmVjb3JkPHN0cmluZywgW3N0cmluZywgc3RyaW5nXT4gPSB7XHJcbiAgRlM6IFsnbXVzdCBzdGFydCBhZnRlcicsICdmaW5pc2hlcyddLFxyXG4gIFNTOiBbJ211c3Qgc3RhcnQgbm8gZWFybGllciB0aGFuJywgJ3N0YXJ0cyddLFxyXG4gIEZGOiBbJ211c3QgZmluaXNoIGFmdGVyJywgJ2ZpbmlzaGVzJ10sXHJcbiAgU0Y6IFsnbXVzdCBmaW5pc2ggYWZ0ZXInLCAnc3RhcnRzJ10sXHJcbn07XHJcblxyXG5hc3luYyBmdW5jdGlvbiBhcHBseVZpb2xhdGlvbkZpeChhcHA6IEFwcCwgdmlvbGF0aW9uOiBTY2hlZHVsZVZpb2xhdGlvbiwgcGx1Z2luU2V0dGluZ3M/OiBQbHVnaW5TZXR0aW5ncyk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGNvbnN0IHsgdGFyZ2V0VGFzaywgZml4RmllbGQsIHN1Z2dlc3RlZERhdGUgfSA9IHZpb2xhdGlvbjtcclxuICBjb25zdCBkYXRlU3RyID0gZm9ybWF0RGF0ZShzdWdnZXN0ZWREYXRlKTtcclxuICBjb25zdCBzdGFydEtleSA9IHBsdWdpblNldHRpbmdzPy5zdGFydERhdGVQcm9wIHx8IERFRkFVTFRfUExVR0lOX1NFVFRJTkdTLnN0YXJ0RGF0ZVByb3A7XHJcbiAgY29uc3QgZW5kS2V5ID0gcGx1Z2luU2V0dGluZ3M/LmVuZERhdGVQcm9wIHx8IERFRkFVTFRfUExVR0lOX1NFVFRJTkdTLmVuZERhdGVQcm9wO1xyXG4gIGNvbnN0IGZyb250bWF0dGVyS2V5ID0gZml4RmllbGQgPT09ICdzdGFydCcgPyBzdGFydEtleSA6IGVuZEtleTtcclxuICBhd2FpdCAoYXBwLmZpbGVNYW5hZ2VyIGFzIGFueSkucHJvY2Vzc0Zyb250TWF0dGVyKFxyXG4gICAgdGFyZ2V0VGFzay5maWxlLFxyXG4gICAgKGZtOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4geyBmbVtmcm9udG1hdHRlcktleV0gPSBkYXRlU3RyOyB9XHJcbiAgKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5WaW9sYXRpb25QYW5lbChcclxuICB2aW9sYXRpb25zOiBTY2hlZHVsZVZpb2xhdGlvbltdLFxyXG4gIGFwcDogQXBwLFxyXG4gIG9uVXBkYXRlOiAoKSA9PiB2b2lkLFxyXG4gIHBsdWdpblNldHRpbmdzPzogUGx1Z2luU2V0dGluZ3MsXHJcbik6IHZvaWQge1xyXG4gIGNsb3NlVmlvbGF0aW9uUGFuZWwoKTtcclxuXHJcbiAgY29uc3QgcGFuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBwYW5lbC5jbGFzc05hbWUgPSAnZ2J2LXZpb2xhdGlvbi1wYW5lbCc7XHJcbiAgYWN0aXZlUGFuZWwgPSBwYW5lbDtcclxuXHJcbiAgLy8gSGVhZGVyXHJcbiAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgaGVhZGVyLmNsYXNzTmFtZSA9ICdnYnYtdmlvbGF0aW9uLWhlYWRlcic7XHJcblxyXG4gIGNvbnN0IGhlYWRlclRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIGhlYWRlclRpdGxlLnRleHRDb250ZW50ID0gYFx1MjZBMCBTY2hlZHVsZSBDb25mbGljdHMgKCR7dmlvbGF0aW9ucy5sZW5ndGh9KWA7XHJcblxyXG4gIGNvbnN0IGNsb3NlQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgY2xvc2VCdG4uY2xhc3NOYW1lID0gJ2didi12aW9sYXRpb24tY2xvc2UnO1xyXG4gIGNsb3NlQnRuLnRleHRDb250ZW50ID0gJ1x1MjcxNSc7XHJcbiAgY2xvc2VCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjbG9zZVZpb2xhdGlvblBhbmVsKTtcclxuXHJcbiAgaGVhZGVyLmFwcGVuZENoaWxkKGhlYWRlclRpdGxlKTtcclxuICBoZWFkZXIuYXBwZW5kQ2hpbGQoY2xvc2VCdG4pO1xyXG4gIHBhbmVsLmFwcGVuZENoaWxkKGhlYWRlcik7XHJcblxyXG4gIC8vIFJvd3NcclxuICBjb25zdCByb3dzQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcm93c0NvbnRhaW5lci5jbGFzc05hbWUgPSAnZ2J2LXZpb2xhdGlvbi1yb3dzJztcclxuXHJcbiAgY29uc3QgcmVtYWluaW5nVmlvbGF0aW9ucyA9IFsuLi52aW9sYXRpb25zXTtcclxuXHJcbiAgY29uc3QgcmVtb3ZlVmlvbGF0aW9uUm93ID0gKHJvdzogSFRNTEVsZW1lbnQsIHZpb2xhdGlvbjogU2NoZWR1bGVWaW9sYXRpb24pID0+IHtcclxuICAgIHJvdy5yZW1vdmUoKTtcclxuICAgIGNvbnN0IGlkeCA9IHJlbWFpbmluZ1Zpb2xhdGlvbnMuaW5kZXhPZih2aW9sYXRpb24pO1xyXG4gICAgaWYgKGlkeCAhPT0gLTEpIHJlbWFpbmluZ1Zpb2xhdGlvbnMuc3BsaWNlKGlkeCwgMSk7XHJcbiAgICBoZWFkZXJUaXRsZS50ZXh0Q29udGVudCA9IGBcdTI2QTAgU2NoZWR1bGUgQ29uZmxpY3RzICgke3JlbWFpbmluZ1Zpb2xhdGlvbnMubGVuZ3RofSlgO1xyXG4gICAgaWYgKHJlbWFpbmluZ1Zpb2xhdGlvbnMubGVuZ3RoID09PSAwKSBjbG9zZVZpb2xhdGlvblBhbmVsKCk7XHJcbiAgfTtcclxuXHJcbiAgZm9yIChjb25zdCB2aW9sYXRpb24gb2YgdmlvbGF0aW9ucykge1xyXG4gICAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICByb3cuY2xhc3NOYW1lID0gJ2didi12aW9sYXRpb24tcm93JztcclxuXHJcbiAgICBjb25zdCBpY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgaWNvbi5jbGFzc05hbWUgPSAnZ2J2LXZpb2xhdGlvbi1pY29uJztcclxuICAgIGljb24udGV4dENvbnRlbnQgPSAnXHUyNkEwJztcclxuXHJcbiAgICBjb25zdCB0ZXh0QmxvY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgIHRleHRCbG9jay5jbGFzc05hbWUgPSAnZ2J2LXZpb2xhdGlvbi10ZXh0JztcclxuXHJcbiAgICBjb25zdCBtYWluVGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgbWFpblRleHQuY2xhc3NOYW1lID0gJ2didi12aW9sYXRpb24tbWFpbic7XHJcbiAgICBjb25zdCBbdmVyYiwgc291cmNlVmVyYl0gPSBERVBfVkVSQlNbdmlvbGF0aW9uLmRlcC50eXBlXSA/PyBbJ211c3QgZm9sbG93JywgJyddO1xyXG5cclxuICAgIGNvbnN0IGFwcGVuZENoaXAgPSAodGV4dDogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IGNoaXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHJvbmcnKTtcclxuICAgICAgY2hpcC5jbGFzc05hbWUgPSAnZ2J2LXZpb2xhdGlvbi1jaGlwJztcclxuICAgICAgY2hpcC50ZXh0Q29udGVudCA9IHRleHQ7XHJcbiAgICAgIG1haW5UZXh0LmFwcGVuZENoaWxkKGNoaXApO1xyXG4gICAgfTtcclxuICAgIGNvbnN0IGFwcGVuZE11dGVkID0gKHRleHQ6IHN0cmluZykgPT4ge1xyXG4gICAgICBjb25zdCBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgICBzcGFuLmNsYXNzTmFtZSA9ICdnYnYtdmlvbGF0aW9uLW11dGVkJztcclxuICAgICAgc3Bhbi50ZXh0Q29udGVudCA9IHRleHQ7XHJcbiAgICAgIG1haW5UZXh0LmFwcGVuZENoaWxkKHNwYW4pO1xyXG4gICAgfTtcclxuICAgIGFwcGVuZENoaXAodmlvbGF0aW9uLnRhcmdldFRhc2sudGl0bGUpO1xyXG4gICAgYXBwZW5kTXV0ZWQoYCAke3ZlcmJ9IGApO1xyXG4gICAgYXBwZW5kQ2hpcCh2aW9sYXRpb24uc291cmNlVGFzay50aXRsZSk7XHJcbiAgICBpZiAoc291cmNlVmVyYikgYXBwZW5kTXV0ZWQoYCAke3NvdXJjZVZlcmJ9YCk7XHJcblxyXG4gICAgY29uc3Qgc3ViVGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgc3ViVGV4dC5jbGFzc05hbWUgPSAnZ2J2LXZpb2xhdGlvbi1maXgtaGludCc7XHJcbiAgICBjb25zdCBmaWVsZExhYmVsID0gdmlvbGF0aW9uLmZpeEZpZWxkID09PSAnc3RhcnQnID8gJ3N0YXJ0JyA6ICdlbmQnO1xyXG4gICAgc3ViVGV4dC50ZXh0Q29udGVudCA9IGBTdWdnZXN0ZWQ6IG1vdmUgJHtmaWVsZExhYmVsfSB0byAke2Zvcm1hdERhdGUodmlvbGF0aW9uLnN1Z2dlc3RlZERhdGUpfWA7XHJcblxyXG4gICAgdGV4dEJsb2NrLmFwcGVuZENoaWxkKG1haW5UZXh0KTtcclxuICAgIHRleHRCbG9jay5hcHBlbmRDaGlsZChzdWJUZXh0KTtcclxuXHJcbiAgICBjb25zdCBhcHBseUJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gICAgYXBwbHlCdG4uY2xhc3NOYW1lID0gJ2didi12aW9sYXRpb24tYXBwbHknO1xyXG4gICAgYXBwbHlCdG4udGV4dENvbnRlbnQgPSAnQXBwbHknO1xyXG4gICAgYXBwbHlCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgIGF3YWl0IGFwcGx5VmlvbGF0aW9uRml4KGFwcCwgdmlvbGF0aW9uLCBwbHVnaW5TZXR0aW5ncyk7XHJcbiAgICAgIHJlbW92ZVZpb2xhdGlvblJvdyhyb3csIHZpb2xhdGlvbik7XHJcbiAgICAgIG9uVXBkYXRlKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICByb3cuYXBwZW5kQ2hpbGQoaWNvbik7XHJcbiAgICByb3cuYXBwZW5kQ2hpbGQodGV4dEJsb2NrKTtcclxuICAgIHJvdy5hcHBlbmRDaGlsZChhcHBseUJ0bik7XHJcbiAgICByb3dzQ29udGFpbmVyLmFwcGVuZENoaWxkKHJvdyk7XHJcbiAgfVxyXG5cclxuICBwYW5lbC5hcHBlbmRDaGlsZChyb3dzQ29udGFpbmVyKTtcclxuXHJcbiAgLy8gRm9vdGVyXHJcbiAgaWYgKHZpb2xhdGlvbnMubGVuZ3RoID4gMCkge1xyXG4gICAgY29uc3QgZm9vdGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICBmb290ZXIuY2xhc3NOYW1lID0gJ2didi12aW9sYXRpb24tZm9vdGVyJztcclxuXHJcbiAgICBjb25zdCBhcHBseUFsbEJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gICAgYXBwbHlBbGxCdG4uY2xhc3NOYW1lID0gJ2didi12aW9sYXRpb24tYXBwbHktYWxsJztcclxuICAgIGFwcGx5QWxsQnRuLnRleHRDb250ZW50ID0gJ0FwcGx5IEFsbCc7XHJcblxyXG4gICAgYXBwbHlBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgIGZvciAoY29uc3QgdiBvZiBbLi4ucmVtYWluaW5nVmlvbGF0aW9uc10pIHtcclxuICAgICAgICBhd2FpdCBhcHBseVZpb2xhdGlvbkZpeChhcHAsIHYsIHBsdWdpblNldHRpbmdzKTtcclxuICAgICAgfVxyXG4gICAgICBvblVwZGF0ZSgpO1xyXG4gICAgICBjbG9zZVZpb2xhdGlvblBhbmVsKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBmb290ZXIuYXBwZW5kQ2hpbGQoYXBwbHlBbGxCdG4pO1xyXG4gICAgcGFuZWwuYXBwZW5kQ2hpbGQoZm9vdGVyKTtcclxuICB9XHJcblxyXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFuZWwpO1xyXG59XHJcbiIsICJpbXBvcnQgdHlwZSB7IEJhc2VzVmlld0NvbmZpZywgQmFzZXNBbGxPcHRpb25zIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Vmlld09wdGlvbnMoX2NvbmZpZzogQmFzZXNWaWV3Q29uZmlnKTogQmFzZXNBbGxPcHRpb25zW10ge1xuXHQvLyBOb3RlOiBCYXNlcyB2aWV3IG9wdGlvbnMgZG9uJ3QgY3VycmVudGx5IHJlbmRlciBVSSBjb250cm9scy5cblx0Ly8gWm9vbSBpcyBoYW5kbGVkIGJ5IHRoZSBwbHVnaW4gdG9vbGJhciwgY29sb3JCeSBieSB0aGUgdG9vbGJhciBkcm9wZG93bixcblx0Ly8gYW5kIGRhdGUgcHJvcGVydGllcyBieSBwbHVnaW4gc2V0dGluZ3MuIFRoZXNlIGVudHJpZXMgYXJlIGtlcHQgZm9yXG5cdC8vIHBvdGVudGlhbCBmdXR1cmUgQmFzZXMgQVBJIHN1cHBvcnQuXG5cdHJldHVybiBbXG5cdFx0e1xuXHRcdFx0dHlwZTogJ29wdGlvbkdyb3VwJyxcblx0XHRcdG5hbWU6ICdEaXNwbGF5Jyxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdkcm9wZG93bicsXG5cdFx0XHRcdFx0bmFtZTogJ1pvb20nLFxuXHRcdFx0XHRcdGtleTogJ3pvb20nLFxuXHRcdFx0XHRcdG9wdGlvbnM6IFsnZGF5JywgJ3dlZWsnLCAnbW9udGgnLCAnMXllYXInLCAnMnllYXInLCAnM3llYXInXSxcblx0XHRcdFx0XHRkZWZhdWx0VmFsdWU6ICd3ZWVrJyxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICd0b2dnbGUnLFxuXHRcdFx0XHRcdG5hbWU6ICdTaG93IGRlcGVuZGVuY2llcycsXG5cdFx0XHRcdFx0a2V5OiAnc2hvd0RlcGVuZGVuY2llcycsXG5cdFx0XHRcdFx0ZGVmYXVsdFZhbHVlOiB0cnVlLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ3RvZ2dsZScsXG5cdFx0XHRcdFx0bmFtZTogJ1Nob3cgdG9kYXkgbWFya2VyJyxcblx0XHRcdFx0XHRrZXk6ICdzaG93VG9kYXknLFxuXHRcdFx0XHRcdGRlZmF1bHRWYWx1ZTogdHJ1ZSxcblx0XHRcdFx0fSxcblx0XHRcdF0sXG5cdFx0fSxcblx0XSBhcyB1bmtub3duIGFzIEJhc2VzQWxsT3B0aW9uc1tdO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBQXdFOzs7QUNBeEUsSUFBQUMsbUJBQWlFOzs7QUM2QzFELElBQU0sYUFBYTtBQUNuQixJQUFNLGFBQWE7QUFDbkIsSUFBTSxpQkFBaUI7QUFDdkIsSUFBTSxnQkFBZ0I7QUFDdEIsSUFBTSxnQkFBZ0I7QUFDdEIsSUFBTSxzQkFBc0I7QUFDNUIsSUFBTSx3QkFBd0I7QUFDOUIsSUFBTSxxQkFBcUI7QUFD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QSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxRQUNDLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxRQUNDLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxRQUNDLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxRQUNDLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDWjtBQUFBO0FBQUEsTUFFQTtBQUFBLFFBQ0MsTUFBTTtBQUFBLFFBQ04sU0FBUztBQUFBLFVBQ1I7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRCxFQUFFLEtBQUssSUFBSTtBQUFBLE1BQ1o7QUFBQSxNQUNBO0FBQUEsUUFDQyxNQUFNO0FBQUEsUUFDTixTQUFTO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxRQUNDLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxRQUNDLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0QsRUFBRSxLQUFLLElBQUk7QUFBQSxNQUNaO0FBQUEsTUFDQTtBQUFBLFFBQ0MsTUFBTTtBQUFBLFFBQ04sU0FBUztBQUFBLFVBQ1I7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0QsRUFBRSxLQUFLLElBQUk7QUFBQSxNQUNaO0FBQUE7QUFBQSxNQUVBO0FBQUEsUUFDQyxNQUFNO0FBQUEsUUFDTixTQUFTO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxRQUNDLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0QsRUFBRSxLQUFLLElBQUk7QUFBQSxNQUNaO0FBQUEsTUFDQTtBQUFBLFFBQ0MsTUFBTTtBQUFBLFFBQ04sU0FBUztBQUFBLFVBQ1I7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRCxFQUFFLEtBQUssSUFBSTtBQUFBLE1BQ1o7QUFBQSxNQUNBO0FBQUEsUUFDQyxNQUFNO0FBQUEsUUFDTixTQUFTO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDWjtBQUFBLElBQ0Q7QUFNQSxVQUFNLGNBQWM7QUFBQSxNQUNuQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLDZCQUE2QixVQUFVO0FBQUEsTUFDdkM7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSTtBQUVYLFVBQU0sV0FBcUQ7QUFBQSxNQUMxRCxHQUFHLE1BQU0sSUFBSSxRQUFNLEVBQUUsTUFBTSxHQUFHLFVBQVUsSUFBSSxFQUFFLElBQUksT0FBTyxTQUFTLEVBQUUsUUFBUSxFQUFFO0FBQUEsTUFDOUUsRUFBRSxNQUFNLEdBQUcsVUFBVSx3QkFBd0IsU0FBUyxZQUFZO0FBQUEsSUFDbkU7QUFFQSxRQUFJLFVBQVU7QUFDZCxRQUFJLFVBQVU7QUFFZCxlQUFXLFFBQVEsVUFBVTtBQUM1QixVQUFJLE1BQU0sc0JBQXNCLEtBQUssSUFBSSxHQUFHO0FBQzNDO0FBQUEsTUFDRCxPQUFPO0FBQ04sY0FBTSxNQUFNLE9BQU8sS0FBSyxNQUFNLEtBQUssT0FBTztBQUMxQztBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsUUFBSSxVQUFVLEdBQUc7QUFDaEIsVUFBSSx3QkFBTyxXQUFXLE9BQU8sUUFBUSxVQUFVLElBQUksTUFBTSxFQUFFLFFBQVEsVUFBVSxLQUFLLFVBQVUsSUFBSSxLQUFLLE9BQU8sc0JBQXNCLEVBQUUsRUFBRTtBQUFBLElBQ3ZJLE9BQU87QUFDTixVQUFJLHdCQUFPLHVDQUF1QyxVQUFVLElBQUk7QUFBQSxJQUNqRTtBQUFBLEVBQ0Q7QUFDRDsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJkIiwgImUiXQp9Cg==
