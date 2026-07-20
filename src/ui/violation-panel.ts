import { Notice } from 'obsidian';
import type { App, TFile } from 'obsidian';
import type { GanttTask, PluginSettings } from '../core/model.ts';
import { DEFAULT_PLUGIN_SETTINGS } from '../core/model.ts';
import type { ScheduleViolation } from '../core/schedule.ts';
import { DEP_VERBS, fixDatesFor, planCascadingFixes } from '../core/schedule.ts';
import { formatDate } from '../core/timeline.ts';

let activePanel: HTMLElement | null = null;

export function closeViolationPanel(): void {
	if (activePanel) {
		activePanel.remove();
		activePanel = null;
	}
}

async function writeTaskDates(
	app: App,
	file: TFile,
	newStart: Date | null,
	newEnd: Date | null,
	pluginSettings?: PluginSettings,
): Promise<void> {
	const startKey = pluginSettings?.startDateProp || DEFAULT_PLUGIN_SETTINGS.startDateProp;
	const endKey = pluginSettings?.endDateProp || DEFAULT_PLUGIN_SETTINGS.endDateProp;
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		if (newStart) fm[startKey] = formatDate(newStart);
		if (newEnd) fm[endKey] = formatDate(newEnd);
	});
}

/** Applies one violation's fix, preserving the task's duration on start moves. */
async function applyViolationFix(app: App, violation: ScheduleViolation, pluginSettings?: PluginSettings): Promise<void> {
	const { successor, fixField, suggestedDate } = violation;
	const { newStart, newEnd } = fixDatesFor(successor, fixField, suggestedDate);
	await writeTaskDates(app, successor.file, newStart, newEnd, pluginSettings);
}

function fixHint(violation: ScheduleViolation): string {
	const { successor, fixField, suggestedDate } = violation;
	let hint = `Suggested: move ${fixField} to ${formatDate(suggestedDate)}`;
	if (fixField === 'start') {
		const { newEnd } = fixDatesFor(successor, fixField, suggestedDate);
		if (newEnd && successor.endDate && newEnd.getTime() !== successor.endDate.getTime()) {
			hint += ` (end follows to ${formatDate(newEnd)})`;
		}
	}
	return hint;
}

export function openViolationPanel(
	violations: ScheduleViolation[],
	cycles: GanttTask[][],
	tasks: GanttTask[],
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
	headerTitle.textContent = `⚠ Schedule Conflicts (${violations.length + cycles.length})`;

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

	// Circular dependencies first — they're structural problems no date fix
	// can satisfy, and they explain any confusing violations below them.
	for (const cycle of cycles) {
		const row = document.createElement('div');
		row.className = 'gbv-violation-row gbv-violation-row--cycle';

		const icon = document.createElement('span');
		icon.className = 'gbv-violation-icon';
		icon.textContent = '⟳';

		const textBlock = document.createElement('div');
		textBlock.className = 'gbv-violation-text';

		const mainText = document.createElement('div');
		mainText.className = 'gbv-violation-main';
		const chain = [...cycle, cycle[0]]; // close the loop for display
		chain.forEach((task, i) => {
			if (i > 0) {
				const arrow = document.createElement('span');
				arrow.className = 'gbv-violation-muted';
				arrow.textContent = ' ← ';
				mainText.appendChild(arrow);
			}
			const chip = document.createElement('strong');
			chip.className = 'gbv-violation-chip';
			chip.textContent = task.title;
			mainText.appendChild(chip);
		});

		const subText = document.createElement('div');
		subText.className = 'gbv-violation-fix-hint';
		subText.textContent =
			'Circular dependency — these tasks wait on each other. Remove one link to make the schedule solvable.';

		textBlock.appendChild(mainText);
		textBlock.appendChild(subText);
		row.appendChild(icon);
		row.appendChild(textBlock);
		rowsContainer.appendChild(row);
	}

	const remainingViolations = [...violations];

	const removeViolationRow = (row: HTMLElement, violation: ScheduleViolation) => {
		row.remove();
		const idx = remainingViolations.indexOf(violation);
		if (idx !== -1) remainingViolations.splice(idx, 1);
		headerTitle.textContent = `⚠ Schedule Conflicts (${remainingViolations.length + cycles.length})`;
		if (remainingViolations.length === 0 && cycles.length === 0) closeViolationPanel();
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
		const [verb, predVerb] = DEP_VERBS[violation.dep.type] ?? ['must follow', ''];

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
		appendChip(violation.successor.title);
		appendMuted(` ${verb} `);
		appendChip(violation.predecessor.title);
		if (predVerb) appendMuted(` ${predVerb}`);

		const subText = document.createElement('div');
		subText.className = 'gbv-violation-fix-hint';
		subText.textContent = fixHint(violation);

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
		applyAllBtn.title = 'Fix every conflict, cascading through dependent tasks';

		applyAllBtn.addEventListener('click', async () => {
			// Cascade: fixing one task can push tasks that depend on it, so plan
			// the whole graph to a stable state and write each file once.
			const plan = planCascadingFixes(tasks);
			for (const { task, newStart, newEnd } of plan.fixes.values()) {
				await writeTaskDates(app, task.file, newStart, newEnd, pluginSettings);
			}
			if (!plan.converged) {
				new Notice('Some conflicts could not be fully resolved — check for circular dependencies.');
			} else if (plan.fixes.size > 0) {
				new Notice(`Updated ${plan.fixes.size} task${plan.fixes.size > 1 ? 's' : ''}.`);
			}
			onUpdate();
			closeViolationPanel();
		});

		footer.appendChild(applyAllBtn);
		panel.appendChild(footer);
	}

	document.body.appendChild(panel);
}
