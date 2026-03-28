import { App } from 'obsidian';
import { GanttTask, TaskDependency, PluginSettings, DEFAULT_PLUGIN_SETTINGS } from './types.ts';
import { formatDate } from './timeline.ts';

export interface ScheduleViolation {
  sourceTask: GanttTask;
  targetTask: GanttTask;
  dep: TaskDependency;
  description: string;
  fixField: 'start' | 'end';
  suggestedDate: Date;
}

export function detectViolations(tasks: GanttTask[]): ScheduleViolation[] {
  const violations: ScheduleViolation[] = [];

  const taskById = new Map<string, GanttTask>();
  for (const task of tasks) taskById.set(task.id, task);

  for (const target of tasks) {
    for (const dep of target.dependencies) {
      const source = taskById.get(dep.targetPath);
      if (!source) continue;

      switch (dep.type) {
        case 'FS': {
          if (source.endDate === null || target.startDate === null) break;
          if (target.startDate < source.endDate) {
            violations.push({
              sourceTask: source, targetTask: target, dep,
              description: `${target.title} must start after ${source.title} finishes (${formatDate(source.endDate)})`,
              fixField: 'start', suggestedDate: source.endDate,
            });
          }
          break;
        }
        case 'SS': {
          if (source.startDate === null || target.startDate === null) break;
          if (target.startDate < source.startDate) {
            violations.push({
              sourceTask: source, targetTask: target, dep,
              description: `${target.title} must start no earlier than ${source.title} (${formatDate(source.startDate)})`,
              fixField: 'start', suggestedDate: source.startDate,
            });
          }
          break;
        }
        case 'FF': {
          if (source.endDate === null || target.endDate === null) break;
          if (target.endDate < source.endDate) {
            violations.push({
              sourceTask: source, targetTask: target, dep,
              description: `${target.title} must finish after ${source.title} finishes (${formatDate(source.endDate)})`,
              fixField: 'end', suggestedDate: source.endDate,
            });
          }
          break;
        }
        case 'SF': {
          if (source.startDate === null || target.endDate === null) break;
          if (target.endDate < source.startDate) {
            violations.push({
              sourceTask: source, targetTask: target, dep,
              description: `${target.title} must finish after ${source.title} starts (${formatDate(source.startDate)})`,
              fixField: 'end', suggestedDate: source.startDate,
            });
          }
          break;
        }
      }
    }
  }

  return violations;
}

let activePanel: HTMLElement | null = null;

export function closeViolationPanel(): void {
  if (activePanel) {
    activePanel.remove();
    activePanel = null;
  }
}

const DEP_VERBS: Record<string, [string, string]> = {
  FS: ['must start after', 'finishes'],
  SS: ['must start no earlier than', 'starts'],
  FF: ['must finish after', 'finishes'],
  SF: ['must finish after', 'starts'],
};

async function applyViolationFix(app: App, violation: ScheduleViolation, pluginSettings?: PluginSettings): Promise<void> {
  const { targetTask, fixField, suggestedDate } = violation;
  const dateStr = formatDate(suggestedDate);
  const startKey = pluginSettings?.startDateProp || DEFAULT_PLUGIN_SETTINGS.startDateProp;
  const endKey = pluginSettings?.endDateProp || DEFAULT_PLUGIN_SETTINGS.endDateProp;
  const frontmatterKey = fixField === 'start' ? startKey : endKey;
  await (app.fileManager as any).processFrontMatter(
    targetTask.file,
    (fm: Record<string, unknown>) => { fm[frontmatterKey] = dateStr; }
  );
}

export function openViolationPanel(
  violations: ScheduleViolation[],
  app: App,
  onUpdate: () => void,
  pluginSettings?: PluginSettings,
): void {
  closeViolationPanel();

  const panel = document.createElement('div');
  panel.className = 'gbv-violation-panel';
  activePanel = panel;

  // Header
  const header = document.createElement('div');
  header.className = 'gbv-violation-header';

  const headerTitle = document.createElement('span');
  headerTitle.textContent = `⚠ Schedule Conflicts (${violations.length})`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'gbv-violation-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeViolationPanel);

  header.appendChild(headerTitle);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Rows
  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'gbv-violation-rows';

  const remainingViolations = [...violations];

  const removeViolationRow = (row: HTMLElement, violation: ScheduleViolation) => {
    row.remove();
    const idx = remainingViolations.indexOf(violation);
    if (idx !== -1) remainingViolations.splice(idx, 1);
    headerTitle.textContent = `⚠ Schedule Conflicts (${remainingViolations.length})`;
    if (remainingViolations.length === 0) closeViolationPanel();
  };

  for (const violation of violations) {
    const row = document.createElement('div');
    row.className = 'gbv-violation-row';

    const icon = document.createElement('span');
    icon.className = 'gbv-violation-icon';
    icon.textContent = '⚠';

    const textBlock = document.createElement('div');
    textBlock.className = 'gbv-violation-text';

    const mainText = document.createElement('div');
    mainText.className = 'gbv-violation-main';
    const [verb, sourceVerb] = DEP_VERBS[violation.dep.type] ?? ['must follow', ''];

    const appendChip = (text: string) => {
      const chip = document.createElement('strong');
      chip.className = 'gbv-violation-chip';
      chip.textContent = text;
      mainText.appendChild(chip);
    };
    const appendMuted = (text: string) => {
      const span = document.createElement('span');
      span.className = 'gbv-violation-muted';
      span.textContent = text;
      mainText.appendChild(span);
    };
    appendChip(violation.targetTask.title);
    appendMuted(` ${verb} `);
    appendChip(violation.sourceTask.title);
    if (sourceVerb) appendMuted(` ${sourceVerb}`);

    const subText = document.createElement('div');
    subText.className = 'gbv-violation-fix-hint';
    const fieldLabel = violation.fixField === 'start' ? 'start' : 'end';
    subText.textContent = `Suggested: move ${fieldLabel} to ${formatDate(violation.suggestedDate)}`;

    textBlock.appendChild(mainText);
    textBlock.appendChild(subText);

    const applyBtn = document.createElement('button');
    applyBtn.className = 'gbv-violation-apply';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', async () => {
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

  // Footer
  if (violations.length > 0) {
    const footer = document.createElement('div');
    footer.className = 'gbv-violation-footer';

    const applyAllBtn = document.createElement('button');
    applyAllBtn.className = 'gbv-violation-apply-all';
    applyAllBtn.textContent = 'Apply All';

    applyAllBtn.addEventListener('click', async () => {
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
