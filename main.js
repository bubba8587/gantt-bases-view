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
var import_obsidian7 = require("obsidian");

// src/ui/gantt-view.ts
var import_obsidian3 = require("obsidian");

// src/core/model.ts
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
var DEP_TYPES = DEP_FIELDS.map((f) => f.type);
var DEP_TYPE_TO_FIELD = Object.fromEntries(
  DEP_FIELDS.map((f) => [f.type, f.bare])
);
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

// src/core/parse.ts
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
  const str = String(value).trim();
  if (!str) return null;
  const n = Number(str);
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
  if (Array.isArray(value)) {
    return value.filter((v) => v != null).map((v) => String(v).trim()).filter((s) => s && s !== "null");
  }
  const str = String(value).trim();
  if (!str || str === "null") return [];
  const matches = str.match(/\[\[[^\]]+\]\]/g);
  if (matches && matches.length > 1) return matches;
  return [str];
}

// src/core/extract.ts
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
    visibleDepTypes: new Set(DEP_FIELDS.map((f) => f.type))
  };
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
      const lastSegment = bare.split("/").pop() ?? bare;
      const resolved = nameToPath.get(bare) ?? nameToPath.get(lastSegment) ?? nameToPath.get(dep.targetName.toLowerCase());
      if (resolved) {
        dep.targetPath = resolved;
      }
    }
  }
}

// src/core/timeline.ts
function snapToDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysBetween(a, b) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 864e5);
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function fractionOfDay(date) {
  return (date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600) / 24;
}
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
    for (const date of [task.startDate, task.endDate, task.completedDate]) {
      if (!date) continue;
      if (date < earliest) earliest = new Date(date);
      if (date > latest) latest = new Date(date);
    }
  }
  earliest = addDays(earliest, -TIMELINE_PADDING_DAYS);
  latest = addDays(latest, TIMELINE_PADDING_DAYS);
  if (zoom === "1year" || zoom === "2year" || zoom === "3year") {
    earliest = new Date(earliest.getFullYear(), 0, 1);
    latest = new Date(latest.getFullYear() + 1, 0, 1);
  } else if (zoom === "month") {
    earliest.setDate(1);
  } else if (zoom === "week") {
    earliest = addDays(earliest, -earliest.getDay());
  }
  return {
    startDate: snapToDay(earliest),
    endDate: snapToDay(latest),
    zoom,
    pixelsPerDay: getPixelsPerDay(zoom)
  };
}
function dateToPixelOffset(date, config) {
  const days = daysBetween(config.startDate, date) + fractionOfDay(date);
  return Math.round(days * config.pixelsPerDay);
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
  let cursor = new Date(config.startDate);
  const ppd = config.pixelsPerDay;
  switch (config.zoom) {
    case "day": {
      while (cursor <= config.endDate) {
        const next = addDays(cursor, 1);
        columns.push({
          group: cursor.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          label: String(cursor.getDate()),
          startDate: new Date(cursor),
          endDateExclusive: next,
          widthPx: ppd
        });
        cursor = next;
      }
      break;
    }
    case "week": {
      while (cursor <= config.endDate) {
        const next = addDays(cursor, 7);
        const { week, year } = isoWeek(addDays(cursor, 1));
        columns.push({
          group: String(year),
          label: `W${week}`,
          startDate: new Date(cursor),
          endDateExclusive: next,
          widthPx: 7 * ppd
        });
        cursor = next;
      }
      break;
    }
    case "month": {
      while (cursor <= config.endDate) {
        const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        const daysInMonth = daysBetween(monthStart, nextMonth);
        columns.push({
          group: String(monthStart.getFullYear()),
          label: monthStart.toLocaleDateString("en-US", { month: "short" }),
          startDate: monthStart,
          endDateExclusive: nextMonth,
          widthPx: daysInMonth * ppd
        });
        cursor = nextMonth;
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
        const nextQ = new Date(year, q * 3 + 3, 1);
        columns.push({
          group: String(year),
          label: `Q${q + 1}`,
          startDate: qStart,
          endDateExclusive: nextQ,
          widthPx: daysBetween(qStart, nextQ) * ppd
        });
        cursor = nextQ;
      }
      break;
    }
  }
  return columns;
}
function getEffectiveBarDates(task) {
  const { startDate, endDate, timeEstimate } = task;
  if (!startDate && !endDate) return null;
  if (startDate && !endDate) {
    const days = timeEstimate ? Math.ceil(timeEstimate / (60 * 8)) : 1;
    return { start: startDate, end: addDays(startDate, days) };
  }
  if (!startDate && endDate) {
    return { start: addDays(endDate, -1), end: endDate };
  }
  return { start: startDate, end: endDate };
}
function getTaskBarBounds(task, config) {
  const dates = getEffectiveBarDates(task);
  if (!dates) return null;
  const left = dateToPixelOffset(dates.start, config);
  const right = dateToPixelOffset(dates.end, config);
  const width = Math.max(right - left, config.pixelsPerDay);
  return { left, width };
}

// src/core/schedule.ts
var CONSTRAINTS = {
  FS: { fixField: "start", boundTo: "end" },
  SS: { fixField: "start", boundTo: "start" },
  FF: { fixField: "end", boundTo: "end" },
  SF: { fixField: "end", boundTo: "start" }
};
var DEP_VERBS = {
  FS: ["must start after", "finishes"],
  SS: ["must start no earlier than", "starts"],
  FF: ["must finish after", "finishes"],
  SF: ["must finish after", "starts"]
};
function effectiveConstraintDate(task, which) {
  if (which === "start") {
    if (task.startDate) return task.startDate;
    return task.endDate ? addDays(task.endDate, -1) : null;
  }
  if (task.endDate) return task.endDate;
  if (task.startDate) {
    return task.timeEstimate ? addDays(task.startDate, Math.ceil(task.timeEstimate / (60 * 8))) : task.startDate;
  }
  return null;
}
function checkConstraint(type, predecessor, successor) {
  if (predecessor === successor) return null;
  const { fixField, boundTo } = CONSTRAINTS[type];
  const requiredDate = effectiveConstraintDate(predecessor, boundTo);
  const actualDate = fixField === "start" ? successor.startDate : successor.endDate;
  if (!requiredDate || !actualDate) return null;
  return actualDate < requiredDate ? { fixField, requiredDate } : null;
}
function isViolated(dep, predecessor, successor) {
  return checkConstraint(dep.type, predecessor, successor) !== null;
}
function fixDatesFor(task, fixField, requiredDate) {
  if (fixField === "start") {
    let newEnd = task.endDate;
    if (task.startDate && task.endDate) {
      const duration = Math.max(0, daysBetween(task.startDate, task.endDate));
      newEnd = addDays(requiredDate, duration);
    }
    return { newStart: requiredDate, newEnd };
  }
  return { newStart: task.startDate, newEnd: requiredDate };
}
function planCascadingFixes(tasks) {
  const working = tasks.map((t) => ({ ...t }));
  const maxPasses = tasks.length + 1;
  let converged = false;
  for (let pass = 0; pass < maxPasses; pass++) {
    const violations = detectViolations(working);
    if (violations.length === 0) {
      converged = true;
      break;
    }
    for (const v of violations) {
      const target = v.successor;
      const current = v.fixField === "start" ? target.startDate : target.endDate;
      if (current && current >= v.suggestedDate) continue;
      const { newStart, newEnd } = fixDatesFor(target, v.fixField, v.suggestedDate);
      target.startDate = newStart;
      target.endDate = newEnd;
    }
  }
  const fixes = /* @__PURE__ */ new Map();
  for (let i = 0; i < tasks.length; i++) {
    const original = tasks[i];
    const updated = working[i];
    if (updated.startDate?.getTime() !== original.startDate?.getTime() || updated.endDate?.getTime() !== original.endDate?.getTime()) {
      fixes.set(original.id, { task: original, newStart: updated.startDate, newEnd: updated.endDate });
    }
  }
  return { fixes, converged };
}
function detectViolations(tasks) {
  const violations = [];
  const taskById = /* @__PURE__ */ new Map();
  for (const task of tasks) taskById.set(task.id, task);
  for (const successor of tasks) {
    for (const dep of successor.dependencies) {
      const predecessor = taskById.get(dep.targetPath);
      if (!predecessor) continue;
      const result = checkConstraint(dep.type, predecessor, successor);
      if (!result) continue;
      const [verb, predVerb] = DEP_VERBS[dep.type];
      violations.push({
        predecessor,
        successor,
        dep,
        fixField: result.fixField,
        suggestedDate: result.requiredDate,
        description: `${successor.title} ${verb} ${predecessor.title} ${predVerb} (${formatDate(result.requiredDate)})`
      });
    }
  }
  return violations;
}

// src/core/export.ts
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
function columnExportLabel(col, zoom) {
  if (zoom === "day") {
    const month = col.startDate.toLocaleDateString("en-US", { month: "short" });
    return `${month} ${col.label}`;
  }
  return `${col.label} ${col.group}`;
}
function taskOverlapsColumn(task, col) {
  const start = task.startDate;
  const end = task.endDate;
  if (!start || !end) return false;
  return start < col.endDateExclusive && end > col.startDate;
}
function exportToTSV(groups, timelineConfig) {
  const columns = generateColumns(timelineConfig);
  const headerCells = [
    ...DATA_HEADERS,
    ...columns.map((c) => columnExportLabel(c, timelineConfig.zoom))
  ];
  const lines = [headerCells.join("	")];
  for (const group of groups) {
    if (group.key) {
      lines.push(`${group.key}${"	".repeat(DATA_HEADERS.length - 1)}`);
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
      const barCols = columns.map((col) => taskOverlapsColumn(task, col) ? BAR_CHAR : "");
      lines.push([...dataCols, ...barCols].join("	"));
    }
  }
  return lines.join("\n");
}

// src/ui/scaffold.ts
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
function setTimelineSize(scaffold, width, totalHeight) {
  scaffold.barsArea.style.minWidth = `${width}px`;
  scaffold.headerRow.style.minWidth = `${width}px`;
  scaffold.svgLayer.setAttribute("width", String(width));
  scaffold.svgLayer.setAttribute("height", String(totalHeight));
  scaffold.svgLayer.style.width = `${width}px`;
  scaffold.svgLayer.style.height = `${totalHeight}px`;
}

// src/ui/toolbar.ts
var ZOOM_LEVELS = ["day", "week", "month", "1year", "2year", "3year"];
var ZOOM_LABELS = {
  day: "Day",
  week: "Week",
  month: "Month",
  "1year": "1Y",
  "2year": "2Y",
  "3year": "3Y"
};
var COLOR_BY_OPTIONS = ["none", "status", "priority"];
var COLOR_BY_LABELS = {
  none: "No color",
  status: "Status",
  priority: "Priority"
};
function renderToolbar(toolbar, opts) {
  const zoomGroup = toolbar.createEl("div", { cls: "gbv-zoom-group" });
  for (const zoom of ZOOM_LEVELS) {
    const btn = zoomGroup.createEl("button", {
      text: ZOOM_LABELS[zoom],
      cls: zoom === opts.currentZoom ? "gbv-zoom-btn is-active" : "gbv-zoom-btn"
    });
    btn.addEventListener("click", () => opts.onZoomChange(zoom));
  }
  toolbar.createEl("div", { cls: "gbv-toolbar-separator" });
  const todayBtn = toolbar.createEl("button", { text: "Today", cls: "gbv-btn" });
  todayBtn.addEventListener("click", opts.onToday);
  toolbar.createEl("div", { cls: "gbv-toolbar-separator" });
  toolbar.createEl("span", { text: "Color:", cls: "gbv-toolbar-label" });
  const colorBySelect = toolbar.createEl("select", { cls: "gbv-toolbar-select" });
  for (const opt of COLOR_BY_OPTIONS) {
    const o = colorBySelect.createEl("option", { text: COLOR_BY_LABELS[opt] });
    o.value = opt;
    if (opt === opts.colorBy) o.selected = true;
  }
  colorBySelect.addEventListener("change", () => {
    opts.onColorByChange(colorBySelect.value);
  });
  toolbar.createEl("div", { cls: "gbv-toolbar-separator" });
  const hasViolations = opts.violationCount > 0;
  const violationBtn = toolbar.createEl("button", {
    text: hasViolations ? `\u26A0 Fix Schedule (${opts.violationCount})` : "\u2713 Schedule OK",
    cls: hasViolations ? "gbv-btn gbv-btn--warn" : "gbv-btn gbv-btn--ok"
  });
  if (hasViolations) {
    violationBtn.addEventListener("click", opts.onFixSchedule);
  }
  toolbar.createEl("div", { cls: "gbv-toolbar-separator" });
  const exportBtn = toolbar.createEl("button", { text: "Copy TSV", cls: "gbv-btn" });
  exportBtn.addEventListener("click", () => void opts.onExport());
}

// src/ui/colors.ts
function lookupColor(map, key) {
  if (!map || !key) return null;
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(map)) {
    if (k.toLowerCase() === lower) return map[k];
  }
  return null;
}
function getBarColor(task, colorBy, pluginSettings) {
  if (colorBy === "status") {
    return lookupColor(STATUS_COLORS, task.status) ?? lookupColor(pluginSettings?.statusColors, task.status) ?? DEFAULT_BAR_COLOR;
  }
  if (colorBy === "priority") {
    return lookupColor(PRIORITY_COLORS, task.priority) ?? lookupColor(pluginSettings?.priorityColors, task.priority) ?? DEFAULT_BAR_COLOR;
  }
  return DEFAULT_BAR_COLOR;
}

// src/ui/task-bar.ts
function taskTooltip(task) {
  const lines = [task.title || task.file.basename];
  if (task.startDate || task.endDate) {
    const start = task.startDate ? formatDate(task.startDate) : "\u2014";
    const end = task.endDate ? formatDate(task.endDate) : "\u2014";
    lines.push(task.isMilestone && !task.endDate ? start : `${start} \u2192 ${end}`);
  }
  const meta = [task.status, task.priority].filter(Boolean).join(" \xB7 ");
  if (meta) lines.push(meta);
  return lines.join("\n");
}
function createTaskBar(task, bounds, colorBy, showPriority = true, pluginSettings) {
  if (task.isMilestone) {
    return createMilestoneDiamond(task, bounds, colorBy, pluginSettings);
  }
  const bar = document.createElement("div");
  bar.className = "gbv-bar";
  bar.dataset.taskId = task.id;
  bar.title = taskTooltip(task);
  bar.setAttribute("aria-label", bar.title);
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
  el.title = taskTooltip(task);
  el.setAttribute("aria-label", el.title);
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
  const markerSize = 8;
  const marker = document.createElement("div");
  marker.className = "gbv-complete-marker";
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

// src/ui/dependency-arrows.ts
var M_NORM = "gbv-m-nr";
var M_VIOL = "gbv-m-vr";
var COLOR_NORMAL = "var(--text-muted)";
var COLOR_VIOLATED = "var(--color-orange, #e8a427)";
var ELBOW_GAP = 12;
var ARROW_ANCHORS = {
  FS: { fromPredRight: true, toSuccRight: false },
  // pred finish → succ start
  SS: { fromPredRight: false, toSuccRight: false },
  // pred start  → succ start
  FF: { fromPredRight: true, toSuccRight: true },
  // pred finish → succ finish
  SF: { fromPredRight: false, toSuccRight: true }
  // pred start  → succ finish
};
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
function wireDependencyHover(barsArea, svg) {
  const setHighlight = (taskId) => {
    for (const path of Array.from(svg.querySelectorAll("path.gbv-dep-arrow"))) {
      const attached = taskId !== null && (path.getAttribute("data-pred") === taskId || path.getAttribute("data-succ") === taskId);
      path.classList.toggle("is-active", attached);
    }
  };
  barsArea.addEventListener("pointerover", (e) => {
    const bar = e.target.closest?.(".gbv-bar, .gbv-milestone");
    setHighlight(bar?.dataset.taskId ?? null);
  });
  barsArea.addEventListener("pointerleave", () => setHighlight(null));
}
function buildPath(sx, sy, tx, ty, exitRight, enterRight) {
  const preferred = exitRight ? sx + ELBOW_GAP : sx - ELBOW_GAP;
  const pivotX = !enterRight ? Math.min(preferred, tx - ELBOW_GAP) : tx - ELBOW_GAP;
  return `M ${Math.round(sx)},${Math.round(sy)} H ${Math.round(pivotX)} V ${Math.round(ty)} H ${Math.round(tx)}`;
}
function renderDependencies(svg, tasks, taskRowMap, config, settings) {
  while (svg.lastChild) svg.removeChild(svg.lastChild);
  if (!settings.showDependencies) return;
  ensureDefs(svg);
  const taskById = /* @__PURE__ */ new Map();
  for (const task of tasks) taskById.set(task.id, task);
  for (const successor of tasks) {
    if (!successor.dependencies?.length) continue;
    const succRowTop = taskRowMap.get(successor.id);
    if (succRowTop === void 0) continue;
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
      if (predRowTop === void 0) continue;
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
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", buildPath(sx, predBarTop, tx, succBarBot, anchors.fromPredRight, anchors.toSuccRight));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", violated ? "2" : "1.5");
      path.setAttribute("opacity", violated ? "0.9" : "0.55");
      if (violated) path.setAttribute("stroke-dasharray", "5 3");
      path.setAttribute("marker-end", `url(#${marker})`);
      path.classList.add("gbv-dep-arrow");
      path.setAttribute("data-dep-type", dep.type);
      path.setAttribute("data-pred", predecessor.id);
      path.setAttribute("data-succ", successor.id);
      svg.appendChild(path);
    }
  }
}

// src/core/drag.ts
function applyDragToDates(task, mode, dayDelta) {
  if (dayDelta === 0) return null;
  const { startDate, endDate } = task;
  const effective = getEffectiveBarDates(task);
  if (!effective) return null;
  switch (mode) {
    case "move":
      return {
        newStart: startDate ? addDays(startDate, dayDelta) : null,
        newEnd: endDate ? addDays(endDate, dayDelta) : null
      };
    case "resize-start": {
      let start = addDays(effective.start, dayDelta);
      const limit = endDate ?? effective.end;
      if (start > limit) start = new Date(limit);
      return { newStart: start, newEnd: null };
    }
    case "resize-end": {
      let end = addDays(effective.end, dayDelta);
      const limit = startDate ?? effective.start;
      if (end < limit) end = new Date(limit);
      return { newStart: null, newEnd: end };
    }
  }
}

// src/ui/bar-drag.ts
var EDGE_PX = 8;
var CLICK_THRESHOLD_PX = 3;
var DRAG_FLAG = "gbvDragJustEnded";
function consumePostDragClick(el) {
  if (el.dataset[DRAG_FLAG]) {
    delete el.dataset[DRAG_FLAG];
    return true;
  }
  return false;
}
function modeForPointer(el, clientX, resizable) {
  if (!resizable) return "move";
  const rect = el.getBoundingClientRect();
  const offsetX = clientX - rect.left;
  if (offsetX <= EDGE_PX) return "resize-start";
  if (offsetX >= rect.width - EDGE_PX) return "resize-end";
  return "move";
}
function previewDates(task, mode, dayDelta) {
  const effective = getEffectiveBarDates(task);
  if (!effective) return null;
  const result = applyDragToDates(task, mode, dayDelta);
  if (!result) return effective;
  return {
    start: result.newStart ?? effective.start,
    end: result.newEnd ?? effective.end
  };
}
function makeBarDraggable(barEl, task, config, app, pluginSettings, opts) {
  let dragging = false;
  barEl.addEventListener("pointermove", (e) => {
    if (dragging) return;
    const mode = modeForPointer(barEl, e.clientX, opts.resizable);
    barEl.style.cursor = mode === "move" ? "grab" : "ew-resize";
  });
  barEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const mode = modeForPointer(barEl, e.clientX, opts.resizable);
    const startClientX = e.clientX;
    const origLeft = parseFloat(barEl.style.left) || 0;
    const origWidth = parseFloat(barEl.style.width) || barEl.offsetWidth;
    let dayDelta = 0;
    let moved = false;
    let tooltip = null;
    dragging = true;
    barEl.setPointerCapture(e.pointerId);
    document.body.classList.add(mode === "move" ? "gbv-bar-dragging" : "gbv-bar-resizing");
    const updateTooltip = (clientX, clientY) => {
      const dates = previewDates(task, mode, dayDelta);
      if (!dates) return;
      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.className = "gbv-drag-tooltip";
        document.body.appendChild(tooltip);
      }
      tooltip.textContent = `${formatDate(dates.start)} \u2192 ${formatDate(dates.end)}`;
      tooltip.style.left = `${clientX + 12}px`;
      tooltip.style.top = `${clientY - 32}px`;
    };
    const applyVisual = () => {
      const dx = dayDelta * config.pixelsPerDay;
      const minWidth = config.pixelsPerDay;
      switch (mode) {
        case "move":
          barEl.style.left = `${origLeft + dx}px`;
          break;
        case "resize-start": {
          const clamped = Math.min(dx, origWidth - minWidth);
          barEl.style.left = `${origLeft + clamped}px`;
          barEl.style.width = `${origWidth - clamped}px`;
          break;
        }
        case "resize-end":
          barEl.style.width = `${Math.max(origWidth + dx, minWidth)}px`;
          break;
      }
    };
    const onMove = (ev) => {
      const dx = ev.clientX - startClientX;
      if (Math.abs(dx) > CLICK_THRESHOLD_PX) moved = true;
      dayDelta = Math.round(dx / config.pixelsPerDay);
      applyVisual();
      updateTooltip(ev.clientX, ev.clientY);
    };
    const finish = async (commit) => {
      dragging = false;
      barEl.removeEventListener("pointermove", onMove);
      barEl.removeEventListener("pointerup", onUp);
      barEl.removeEventListener("pointercancel", onCancel);
      document.body.classList.remove("gbv-bar-dragging", "gbv-bar-resizing");
      tooltip?.remove();
      if (!moved) return;
      barEl.dataset[DRAG_FLAG] = "1";
      const result = commit ? applyDragToDates(task, mode, dayDelta) : null;
      if (!result) {
        barEl.style.left = `${origLeft}px`;
        barEl.style.width = `${origWidth}px`;
        return;
      }
      await writeDragDates(app, task, result, pluginSettings);
    };
    const onUp = () => void finish(true);
    const onCancel = () => void finish(false);
    barEl.addEventListener("pointermove", onMove);
    barEl.addEventListener("pointerup", onUp);
    barEl.addEventListener("pointercancel", onCancel);
  });
}
async function writeDragDates(app, task, result, pluginSettings) {
  const startKey = pluginSettings?.startDateProp || DEFAULT_PLUGIN_SETTINGS.startDateProp;
  const endKey = pluginSettings?.endDateProp || DEFAULT_PLUGIN_SETTINGS.endDateProp;
  await app.fileManager.processFrontMatter(task.file, (fm) => {
    if (result.newStart) fm[startKey] = formatDate(result.newStart);
    if (result.newEnd) fm[endKey] = formatDate(result.newEnd);
  });
}

// src/ui/popup-editor.ts
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
  const properties = app.metadataTypeManager?.properties;
  const metaOpts = properties && Object.prototype.hasOwnProperty.call(properties, propertyName) ? properties[propertyName]?.options : void 0;
  if (metaOpts) {
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
  (0, import_obsidian.setIcon)(linkBtn, "external-link");
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
    for (const t of DEP_TYPES) {
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

// src/ui/violation-panel.ts
var import_obsidian2 = require("obsidian");
var activePanel = null;
function closeViolationPanel() {
  if (activePanel) {
    activePanel.remove();
    activePanel = null;
  }
}
async function writeTaskDates(app, file, newStart, newEnd, pluginSettings) {
  const startKey = pluginSettings?.startDateProp || DEFAULT_PLUGIN_SETTINGS.startDateProp;
  const endKey = pluginSettings?.endDateProp || DEFAULT_PLUGIN_SETTINGS.endDateProp;
  await app.fileManager.processFrontMatter(file, (fm) => {
    if (newStart) fm[startKey] = formatDate(newStart);
    if (newEnd) fm[endKey] = formatDate(newEnd);
  });
}
async function applyViolationFix(app, violation, pluginSettings) {
  const { successor, fixField, suggestedDate } = violation;
  const { newStart, newEnd } = fixDatesFor(successor, fixField, suggestedDate);
  await writeTaskDates(app, successor.file, newStart, newEnd, pluginSettings);
}
function fixHint(violation) {
  const { successor, fixField, suggestedDate } = violation;
  let hint = `Suggested: move ${fixField} to ${formatDate(suggestedDate)}`;
  if (fixField === "start") {
    const { newEnd } = fixDatesFor(successor, fixField, suggestedDate);
    if (newEnd && successor.endDate && newEnd.getTime() !== successor.endDate.getTime()) {
      hint += ` (end follows to ${formatDate(newEnd)})`;
    }
  }
  return hint;
}
function openViolationPanel(violations, tasks, app, onUpdate, pluginSettings) {
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
    const [verb, predVerb] = DEP_VERBS[violation.dep.type] ?? ["must follow", ""];
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
    appendChip(violation.successor.title);
    appendMuted(` ${verb} `);
    appendChip(violation.predecessor.title);
    if (predVerb) appendMuted(` ${predVerb}`);
    const subText = document.createElement("div");
    subText.className = "gbv-violation-fix-hint";
    subText.textContent = fixHint(violation);
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
    applyAllBtn.title = "Fix every conflict, cascading through dependent tasks";
    applyAllBtn.addEventListener("click", async () => {
      const plan = planCascadingFixes(tasks);
      for (const { task, newStart, newEnd } of plan.fixes.values()) {
        await writeTaskDates(app, task.file, newStart, newEnd, pluginSettings);
      }
      if (!plan.converged) {
        new import_obsidian2.Notice("Some conflicts could not be fully resolved \u2014 check for circular dependencies.");
      } else if (plan.fixes.size > 0) {
        new import_obsidian2.Notice(`Updated ${plan.fixes.size} task${plan.fixes.size > 1 ? "s" : ""}.`);
      }
      onUpdate();
      closeViolationPanel();
    });
    footer.appendChild(applyAllBtn);
    panel.appendChild(footer);
  }
  document.body.appendChild(panel);
}

// src/ui/gantt-view.ts
var GanttView = class extends import_obsidian3.BasesView {
  constructor(controller, containerEl, plugin) {
    super(controller);
    this.type = "gantt";
    this.localZoom = null;
    // overrides config zoom when set
    this.localColorBy = "none";
    // toolbar-driven bar coloring
    this.sidebarWidth = SIDEBAR_WIDTH;
    // persists across re-renders for drag resize
    this.dragCleanup = null;
    // cancels any in-progress sidebar drag
    this.collapsedGroups = /* @__PURE__ */ new Set();
    // group keys the user has collapsed
    this.scrollLeft = 0;
    // preserved across re-renders
    this.scrollTop = 0;
    this.resizeObserver = null;
    this.lastRenderedWidth = 0;
    this.resizeTimer = null;
    this.scrollEl = containerEl;
    this.rootEl = containerEl.createDiv("gbv-root");
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
  onDataUpdated() {
    this.render();
  }
  onunload() {
    this.dragCleanup?.();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    closeViolationPanel();
    closeActivePopup();
  }
  // ─── Core render ───────────────────────────────────────────────────────────
  render() {
    const container = this.rootEl;
    this.lastRenderedWidth = this.scrollEl.clientWidth;
    if (!this.data) return;
    const config = this.config;
    const prevScroll = container.querySelector(".gbv-scroll-area");
    if (prevScroll) {
      this.scrollLeft = prevScroll.scrollLeft;
      this.scrollTop = prevScroll.scrollTop;
    }
    container.empty();
    const settings = readSettings(config, this.plugin.settings);
    if (this.localZoom) settings.zoom = this.localZoom;
    settings.colorBy = this.localColorBy;
    this.applyPropertyVisibility(config, settings);
    const groups = this.data.groupedData.map((g) => ({
      key: g.hasKey() ? this.formatGroupKey(g.key.toString()) : "",
      tasks: g.entries.map((entry) => extractTask(entry, settings))
    }));
    const tasks = groups.flatMap((g) => g.tasks);
    resolveDependencyPaths(tasks);
    const violations = detectViolations(tasks);
    const violatingTaskIds = new Set(violations.map((v) => v.successor.id));
    let timelineConfig = computeTimelineRange(tasks, settings.zoom);
    timelineConfig = this.extendToFillViewport(timelineConfig);
    const columns = generateColumns(timelineConfig);
    const totalWidth = columnsWidth(columns);
    const scaffold = buildGanttScaffold(container);
    const { toolbar, sidebar, resizeHandle, scrollArea, headerRow, barsArea, svgLayer } = scaffold;
    sidebar.style.width = `${this.sidebarWidth}px`;
    this.wireSidebarResize(sidebar, resizeHandle);
    renderToolbar(toolbar, {
      currentZoom: settings.zoom,
      colorBy: this.localColorBy,
      violationCount: violations.length,
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
      onToday: () => {
        const offset = dateToPixelOffset(/* @__PURE__ */ new Date(), timelineConfig);
        scrollArea.scrollLeft = Math.max(0, offset - scrollArea.clientWidth / 2);
      },
      onFixSchedule: () => {
        openViolationPanel(violations, tasks, this.app, () => this.render(), this.plugin.settings);
      },
      onExport: async () => {
        await navigator.clipboard.writeText(exportToTSV(groups, timelineConfig));
      }
    });
    this.renderColumnHeaders(headerRow, columns, settings.zoom);
    this.applyWeekendShading(barsArea, timelineConfig);
    const { taskRowMap, totalHeightPx } = this.renderTaskRows(
      groups,
      sidebar,
      barsArea,
      timelineConfig,
      settings,
      violatingTaskIds,
      totalWidth
    );
    setTimelineSize(scaffold, totalWidth, totalHeightPx);
    if (settings.showToday) {
      this.renderTodayLine(barsArea, timelineConfig);
    }
    if (settings.showDependencies) {
      renderDependencies(svgLayer, tasks, taskRowMap, timelineConfig, settings);
      wireDependencyHover(barsArea, svgLayer);
    }
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
  applyPropertyVisibility(config, settings) {
    const rawProps = config.getOrder() ?? [];
    const visibleProps = new Set(rawProps);
    if (visibleProps.size === 0) return;
    settings.showPriority = visibleProps.has("note.priority") || visibleProps.has("priority");
    settings.visibleDepTypes = new Set(
      DEP_FIELDS.filter((f) => visibleProps.has(f.prop) || visibleProps.has(f.bare)).map((f) => f.type)
    );
  }
  /** Extends the timeline end date so the chart always fills the visible area. */
  extendToFillViewport(timelineConfig) {
    const availableWidth = Math.max(
      MIN_TIMELINE_WIDTH,
      (this.scrollEl.clientWidth || 0) - this.sidebarWidth - 2
      // -2 for sidebar resize handle border
    );
    const contentWidth = totalTimelineWidth(timelineConfig);
    if (contentWidth >= availableWidth) return timelineConfig;
    const extraDays = Math.ceil(
      (availableWidth - contentWidth) / timelineConfig.pixelsPerDay
    );
    return {
      ...timelineConfig,
      endDate: addDays(timelineConfig.endDate, extraDays)
    };
  }
  formatGroupKey(raw) {
    return stripWikilink(raw) || "Ungrouped";
  }
  /**
   * Shades Saturday+Sunday bands at day and week zoom. One repeating
   * gradient (7-day period, phase-shifted to the first Saturday) instead of
   * per-day elements; the custom properties inherit into every bar row.
   */
  applyWeekendShading(barsArea, config) {
    if (config.zoom !== "day" && config.zoom !== "week") return;
    const ppd = config.pixelsPerDay;
    const daysToSaturday = (6 - config.startDate.getDay() + 7) % 7;
    barsArea.classList.add("gbv-weekend-shading");
    barsArea.style.setProperty("--gbv-weekend-offset", `${daysToSaturday * ppd}px`);
    barsArea.style.setProperty("--gbv-weekend-width", `${2 * ppd}px`);
    barsArea.style.setProperty("--gbv-weekend-period", `${7 * ppd}px`);
  }
  renderColumnHeaders(headerRow, columns, zoom) {
    const topRow = headerRow.createEl("div", { cls: "gbv-header-top-row" });
    const botRow = headerRow.createEl("div", { cls: "gbv-header-bot-row" });
    let currentGroup = null;
    let groupCell = null;
    let groupWidth = 0;
    const finalizeGroupCell = () => {
      if (groupCell) {
        groupCell.style.width = `${groupWidth}px`;
        groupCell.style.minWidth = `${groupWidth}px`;
      }
    };
    for (const col of columns) {
      if (col.group !== currentGroup) {
        finalizeGroupCell();
        groupCell = topRow.createEl("div", { text: col.group, cls: "gbv-header-cell gbv-header-month" });
        currentGroup = col.group;
        groupWidth = 0;
      }
      groupWidth += col.widthPx;
      const cell = botRow.createEl("div", { text: col.label, cls: "gbv-header-cell gbv-header-day" });
      const dow = col.startDate.getDay();
      if (zoom === "day" && (dow === 0 || dow === 6)) cell.classList.add("is-weekend");
      cell.style.width = `${col.widthPx}px`;
      cell.style.minWidth = `${col.widthPx}px`;
      cell.style.flexShrink = "0";
    }
    finalizeGroupCell();
  }
  renderTaskRows(groups, sidebar, barsArea, timelineConfig, settings, violatingTaskIds, totalWidth) {
    const taskRowMap = /* @__PURE__ */ new Map();
    let currentY = 0;
    let rowIndex = 0;
    const sidebarInner = sidebar.querySelector(".gbv-sidebar-labels-inner") ?? sidebar;
    for (const group of groups) {
      const isCollapsed = group.key ? this.collapsedGroups.has(group.key) : false;
      if (group.key) {
        this.renderGroupHeader(group, isCollapsed, sidebarInner, barsArea, timelineConfig, totalWidth);
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
          openPopupEditor(task, labelEl, this.app, () => this.render(), this.plugin.settings);
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
          makeBarDraggable(barEl, task, timelineConfig, this.app, this.plugin.settings, {
            resizable: !task.isMilestone
          });
          barEl.addEventListener("click", (e) => {
            e.stopPropagation();
            if (consumePostDragClick(barEl)) return;
            openPopupEditor(task, barEl, this.app, () => this.render(), this.plugin.settings);
          });
        }
        currentY += ROW_HEIGHT;
      }
    }
    return { taskRowMap, totalHeightPx: currentY };
  }
  renderGroupHeader(group, isCollapsed, sidebarInner, barsArea, timelineConfig, totalWidth) {
    const toggle = () => {
      if (this.collapsedGroups.has(group.key)) {
        this.collapsedGroups.delete(group.key);
      } else {
        this.collapsedGroups.add(group.key);
      }
      this.render();
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
      const sb = this.getGroupSummaryBounds(group.tasks, timelineConfig);
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
  }
  getGroupSummaryBounds(tasks, timelineConfig) {
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
  renderTodayLine(barsArea, timelineConfig) {
    const offset = dateToPixelOffset(/* @__PURE__ */ new Date(), timelineConfig);
    if (offset < 0) return;
    const line = barsArea.createEl("div", { cls: "gbv-today-line" });
    line.style.left = `${offset}px`;
  }
  wireSidebarResize(sidebar, handle) {
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
        this.sidebarWidth = newWidth;
      };
      const cleanup = () => {
        handle.classList.remove("is-dragging");
        document.body.classList.remove("gbv-resizing");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", cleanup);
        this.dragCleanup = null;
      };
      this.dragCleanup = cleanup;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", cleanup);
    });
  }
  wireScrollSync(sidebar, scrollArea) {
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

// src/ui/options.ts
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

// src/settings/settings-tab.ts
var import_obsidian6 = require("obsidian");

// src/settings/tasknotes.ts
var import_obsidian4 = require("obsidian");
function toOptionsAndColors(items) {
  const options = [];
  const colors = {};
  for (const item of items) {
    if (!item.value) continue;
    options.push(item.value);
    if (item.color) colors[item.value.toLowerCase()] = item.color;
  }
  return { options, colors };
}
function syncFromTaskNotes(app, settings) {
  const tasknotes = app.plugins?.plugins?.["tasknotes"];
  if (!tasknotes) {
    new import_obsidian4.Notice("TaskNotes plugin not found. Is it installed and enabled?");
    return false;
  }
  const data = tasknotes.settings ?? tasknotes.data;
  if (!data) {
    new import_obsidian4.Notice("Could not read TaskNotes settings.");
    return false;
  }
  let synced = false;
  if (Array.isArray(data.customStatuses) && data.customStatuses.length > 0) {
    const { options, colors } = toOptionsAndColors(data.customStatuses);
    settings.statusOptions = options;
    settings.statusColors = colors;
    synced = true;
  }
  if (Array.isArray(data.customPriorities) && data.customPriorities.length > 0) {
    const { options, colors } = toOptionsAndColors(data.customPriorities);
    settings.priorityOptions = options;
    settings.priorityColors = colors;
    synced = true;
  }
  if (synced) {
    new import_obsidian4.Notice("Synced status, priority, and colors from TaskNotes.");
  } else {
    new import_obsidian4.Notice("No custom statuses or priorities found in TaskNotes.");
  }
  return synced;
}

// src/settings/examples.ts
var import_obsidian5 = require("obsidian");
var EXAMPLES_FOLDER = "Gantt Examples";
var EXAMPLE_NOTES = [
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
      "**Cascading FS violation** \u2014 depends on Handoff (ends Apr 18), so",
      "this task is fine on its own. But once Handoff is fixed to start",
      "Apr 28, Sign-off will also need updating. Tests cascading fixes."
    ].join("\n")
  }
];
var BASE_FILE_CONTENT = [
  "views:",
  "  - type: gantt",
  "    name: Website Launch",
  "    filters:",
  "      and:",
  `        - file.folder == "${EXAMPLES_FOLDER}"`,
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
async function createExampleNotes(app) {
  const vault = app.vault;
  if (!vault.getAbstractFileByPath(EXAMPLES_FOLDER)) {
    await vault.createFolder(EXAMPLES_FOLDER);
  }
  const allFiles = [
    ...EXAMPLE_NOTES.map((n) => ({ path: `${EXAMPLES_FOLDER}/${n.name}.md`, content: n.content })),
    { path: `${EXAMPLES_FOLDER}/gantt-examples.base`, content: BASE_FILE_CONTENT }
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
    new import_obsidian5.Notice(`Created ${created} file${created > 1 ? "s" : ""} in "${EXAMPLES_FOLDER}/"${skipped > 0 ? ` (${skipped} already existed)` : ""}`);
  } else {
    new import_obsidian5.Notice(`All example files already exist in "${EXAMPLES_FOLDER}/"`);
  }
}

// src/settings/settings-tab.ts
var GanttSettingsTab = class extends import_obsidian6.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian6.Setting(containerEl).setName("Property mapping").setHeading();
    new import_obsidian6.Setting(containerEl).setName("Start date property").setDesc("Frontmatter property used for the task start date.").addText((text) => {
      text.setPlaceholder(DEFAULT_PLUGIN_SETTINGS.startDateProp).setValue(this.plugin.settings.startDateProp).onChange(async (value) => {
        this.plugin.settings.startDateProp = value.trim() || DEFAULT_PLUGIN_SETTINGS.startDateProp;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("End date property").setDesc("Frontmatter property used for the task end date.").addText((text) => {
      text.setPlaceholder(DEFAULT_PLUGIN_SETTINGS.endDateProp).setValue(this.plugin.settings.endDateProp).onChange(async (value) => {
        this.plugin.settings.endDateProp = value.trim() || DEFAULT_PLUGIN_SETTINGS.endDateProp;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Status & priority options").setHeading();
    new import_obsidian6.Setting(containerEl).setName("Status options").setDesc("Comma-separated list of status values for the dropdown.").addText((text) => {
      text.setPlaceholder(DEFAULT_STATUS_OPTIONS.join(", ")).setValue(this.plugin.settings.statusOptions.join(", ")).onChange(async (value) => {
        const parsed = value.split(",").map((s) => s.trim()).filter(Boolean);
        this.plugin.settings.statusOptions = parsed.length > 0 ? parsed : DEFAULT_STATUS_OPTIONS;
        await this.plugin.saveSettings();
      });
      text.inputEl.addClass("gbv-settings-wide-input");
    });
    new import_obsidian6.Setting(containerEl).setName("Priority options").setDesc("Comma-separated list of priority values for the dropdown.").addText((text) => {
      text.setPlaceholder(DEFAULT_PRIORITY_OPTIONS.join(", ")).setValue(this.plugin.settings.priorityOptions.join(", ")).onChange(async (value) => {
        const parsed = value.split(",").map((s) => s.trim()).filter(Boolean);
        this.plugin.settings.priorityOptions = parsed.length > 0 ? parsed : DEFAULT_PRIORITY_OPTIONS;
        await this.plugin.saveSettings();
      });
      text.inputEl.addClass("gbv-settings-wide-input");
    });
    new import_obsidian6.Setting(containerEl).setName("Sync from TaskNotes").setDesc("Import status and priority options from the TaskNotes plugin.").addButton((btn) => {
      btn.setButtonText("Sync").onClick(async () => {
        if (syncFromTaskNotes(this.app, this.plugin.settings)) {
          await this.plugin.saveSettings();
          this.display();
        }
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Examples").setHeading();
    new import_obsidian6.Setting(containerEl).setName("Create example notes").setDesc('Creates a small set of linked notes in your vault demonstrating all four dependency types (FS, SS, FF, SF). Notes are placed in a "Gantt Examples" folder.').addButton((btn) => {
      btn.setButtonText("Create examples").setCta().onClick(() => createExampleNotes(this.app));
    });
  }
};

// src/main.ts
var GanttBasesViewPlugin = class extends import_obsidian7.Plugin {
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
