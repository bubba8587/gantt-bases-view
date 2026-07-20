import { AbstractInputSuggest, TFile, setIcon } from 'obsidian';
import type { App } from 'obsidian';
import type { DependencyType, GanttTask, PluginSettings } from '../core/model.ts';
import { DEP_TYPES, DEP_TYPE_TO_FIELD, stripWikilink, DEFAULT_PLUGIN_SETTINGS } from '../core/model.ts';
import { formatDate } from '../core/timeline.ts';

/** Row labels that read as a sentence with the chips: "starts after [Task 2]". */
const DEP_TYPE_ROW_LABELS: Record<DependencyType, string> = {
	FS: 'starts after',
	SS: 'starts with',
	FF: 'finishes with',
	SF: 'finishes after start of',
};

const DEP_TYPE_TOOLTIPS: Record<DependencyType, string> = {
	FS: 'FS (blockedBy) — this task starts after the linked task finishes',
	SS: 'SS (syncStart) — this task starts no earlier than the linked task starts',
	FF: 'FF (syncFinish) — this task finishes no earlier than the linked task finishes',
	SF: 'SF (finishAfterStart) — this task finishes no earlier than the linked task starts',
};

/** Native Obsidian file-name autocomplete wired to a chips-style dep input. */
class ChipFileSuggest extends AbstractInputSuggest<TFile> {
	private _onSelect: (file: TFile) => void;
	constructor(app: App, input: HTMLInputElement, onSelect: (file: TFile) => void) {
		super(app, input);
		this._onSelect = onSelect;
	}
	getSuggestions(query: string): TFile[] {
		const lower = query.toLowerCase();
		return this.app.vault.getMarkdownFiles()
			.filter(f => f.basename.toLowerCase().includes(lower))
			.slice(0, 20);
	}
	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.basename);
	}
	selectSuggestion(file: TFile): void {
		this._onSelect(file);
		this.setValue('');
		this.close();
	}
}

/**
 * Builds the dropdown options for a property.
 * 1. Starts with the configured options from plugin settings.
 * 2. Appends any additional values from Obsidian's metadata type manager
 *    (which reflects values actually used in the vault).
 * 3. Ensures currentValue is always present.
 */
function getPropertyOptions(app: App, propertyName: string, settingsOptions: string[], currentValue?: string): string[] {
	const base = [...settingsOptions];

	// Comparison is case-insensitive since Obsidian properties are case-insensitive.
	const baseLower = new Set(base.map(s => s.toLowerCase()));

	const properties = (app as unknown as {
		metadataTypeManager?: { properties?: Record<string, { options?: string[] }> };
	}).metadataTypeManager?.properties;
	const metaOpts = properties && Object.prototype.hasOwnProperty.call(properties, propertyName)
		? properties[propertyName]?.options
		: undefined;
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

// Module-level reference to any currently open popup so we can close it first.
let activePopup: PopupHandle | null = null;

interface PopupHandle {
	el: HTMLElement;
	destroy: () => void;
}

function clampToViewport(rect: DOMRect, popupWidth: number, popupHeight: number, offsetX: number, offsetY: number): { left: number; top: number } {
	const vw = window.innerWidth;
	const vh = window.innerHeight;

	let left = rect.left + offsetX;
	let top = rect.bottom + offsetY;

	// Flip above anchor if it would overflow bottom
	if (top + popupHeight > vh - 8) {
		top = rect.top - popupHeight - offsetY;
	}
	// Clamp horizontal
	if (left + popupWidth > vw - 8) {
		left = vw - popupWidth - 8;
	}
	if (left < 8) left = 8;
	if (top < 8) top = 8;

	return { left, top };
}

export function closeActivePopup(): void {
	if (activePopup) {
		activePopup.destroy();
		activePopup = null;
	}
}

function createLabeledField(label: string, control: HTMLElement): HTMLElement {
	const row = document.createElement('div');
	row.className = 'gbv-popup-field';

	const lbl = document.createElement('label');
	lbl.textContent = label;

	row.appendChild(lbl);
	row.appendChild(control);
	return row;
}

function createSelect(options: string[], current: string): HTMLSelectElement {
	const sel = document.createElement('select');
	for (const opt of options) {
		const o = document.createElement('option');
		o.value = opt;
		o.textContent = opt;
		if (opt.toLowerCase() === current.toLowerCase()) o.selected = true;
		sel.appendChild(o);
	}
	return sel;
}

export function openPopupEditor(
	task: GanttTask,
	anchorEl: HTMLElement,
	app: App,
	onUpdate: () => void,
	pluginSettings?: PluginSettings,
): void {
	// Close any existing popup before opening a new one
	closeActivePopup();

	// ── Build popup element ──────────────────────────────────────────────────
	const popup = document.createElement('div');
	popup.className = 'gbv-popup';
	// Temporarily off-screen to measure height for clamping
	popup.style.position = 'fixed';
	popup.style.visibility = 'hidden';
	popup.style.left = '-9999px';
	popup.style.top = '-9999px';
	popup.style.zIndex = '10000';

	// ── Title row ────────────────────────────────────────────────────────────
	const titleRow = document.createElement('div');
	titleRow.className = 'gbv-popup-title';

	const titleEl = document.createElement('h4');
	titleEl.textContent = task.title || task.file.basename;

	const linkBtn = document.createElement('button');
	linkBtn.className = 'gbv-popup-link-btn clickable-icon';
	linkBtn.title = 'Open note';
	linkBtn.setAttribute('aria-label', 'Open note');
	setIcon(linkBtn, 'external-link');
	linkBtn.addEventListener('click', (e: MouseEvent) => {
		// Ctrl/Cmd+click opens in new tab — matches Obsidian app-wide behaviour
		const newTab = e.ctrlKey || e.metaKey;
		app.workspace.openLinkText(task.file.basename, task.file.path, newTab);
		closeActivePopup();
	});

	titleRow.appendChild(titleEl);
	titleRow.appendChild(linkBtn);
	popup.appendChild(titleRow);

	// ── Dates row (two columns) ──────────────────────────────────────────────
	const startInput = document.createElement('input');
	startInput.type = 'date';
	startInput.value = task.startDate ? formatDate(task.startDate) : '';

	const endInput = document.createElement('input');
	endInput.type = 'date';
	endInput.value = task.endDate ? formatDate(task.endDate) : '';

	const dateRow = document.createElement('div');
	dateRow.className = 'gbv-popup-row2';
	dateRow.appendChild(createLabeledField('Start date', startInput));
	dateRow.appendChild(createLabeledField('End date', endInput));
	popup.appendChild(dateRow);

	// ── Status / Priority row (two columns) ──────────────────────────────────
	const statusFallback = pluginSettings?.statusOptions ?? DEFAULT_PLUGIN_SETTINGS.statusOptions;
	const statusOptions = getPropertyOptions(app, 'status', statusFallback, task.status);
	const statusSel = createSelect(statusOptions, task.status || statusOptions[0]);

	const priorityFallback = pluginSettings?.priorityOptions ?? DEFAULT_PLUGIN_SETTINGS.priorityOptions;
	const priorityOptions = getPropertyOptions(app, 'priority', priorityFallback, task.priority);
	const prioritySel = createSelect(priorityOptions, task.priority || priorityOptions[0]);

	const spRow = document.createElement('div');
	spRow.className = 'gbv-popup-row2';
	spRow.appendChild(createLabeledField('Status', statusSel));
	spRow.appendChild(createLabeledField('Priority', prioritySel));
	popup.appendChild(spRow);

	// ── Dependencies (editable) ──────────────────────────────────────────────
	const depsSection = document.createElement('div');
	depsSection.className = 'gbv-popup-deps';

	const depsHeaderRow = document.createElement('div');
	depsHeaderRow.className = 'gbv-popup-deps-header-row';

	const depsTitle = document.createElement('span');
	depsTitle.className = 'gbv-popup-deps-header';
	depsTitle.textContent = 'This task…';
	depsTitle.title = 'Linked notes are predecessors — this task schedules around them.';

	const addDepBtn = document.createElement('button');
	addDepBtn.className = 'gbv-popup-deps-add';
	addDepBtn.textContent = '+ Add';
	addDepBtn.type = 'button';

	depsHeaderRow.appendChild(depsTitle);
	depsHeaderRow.appendChild(addDepBtn);
	depsSection.appendChild(depsHeaderRow);

	const depRowsContainer = document.createElement('div');
	depsSection.appendChild(depRowsContainer);
	popup.appendChild(depsSection);

	// Track ChipFileSuggest instances for cleanup on destroy.
	const allSuggests: ChipFileSuggest[] = [];

	function addDepRow(type: string, initialNames: string[]): void {
		const row = document.createElement('div');
		row.className = 'gbv-popup-dep-edit-row';

		// Options read as a sentence with the chips that follow, so the
		// dependency direction is unambiguous: "[starts after] [Task 2]" means
		// Task 2 is the predecessor and this task waits for it.
		const typeSel = document.createElement('select');
		typeSel.className = 'gbv-popup-dep-type';
		for (const t of DEP_TYPES) {
			const o = document.createElement('option');
			o.value = t;
			o.textContent = DEP_TYPE_ROW_LABELS[t];
			o.title = DEP_TYPE_TOOLTIPS[t];
			if (t === type) o.selected = true;
			typeSel.appendChild(o);
		}
		typeSel.dataset.depType = type;
		typeSel.title = DEP_TYPE_TOOLTIPS[type as DependencyType] ?? '';
		typeSel.addEventListener('change', () => {
			typeSel.dataset.depType = typeSel.value;
			typeSel.title = DEP_TYPE_TOOLTIPS[typeSel.value as DependencyType] ?? '';
		});

		// Chips area: existing items rendered as deletable tags + blank input at end
		const chipsArea = document.createElement('div');
		chipsArea.className = 'gbv-dep-chips-area';

		const newItemInput = document.createElement('input');
		newItemInput.type = 'text';
		newItemInput.className = 'gbv-dep-new-item';
		newItemInput.placeholder = 'Add note…';
		chipsArea.appendChild(newItemInput);
		// Clicking anywhere in the chips area focuses the input
		chipsArea.addEventListener('click', (e) => {
			if (e.target === chipsArea) newItemInput.focus();
		});

		function addChip(name: string): void {
			const chip = document.createElement('span');
			chip.className = 'gbv-dep-chip';
			chip.dataset.depValue = name;

			const label = document.createElement('span');
			label.textContent = stripWikilink(name);

			const xBtn = document.createElement('button');
			xBtn.type = 'button';
			xBtn.className = 'gbv-dep-chip-remove';
			xBtn.textContent = '×';
			xBtn.addEventListener('click', () => chip.remove());

			chip.appendChild(label);
			chip.appendChild(xBtn);
			chipsArea.insertBefore(chip, newItemInput);
		}

		for (const n of initialNames) addChip(n);

		// Native Obsidian autocomplete — on selection: create chip, clear input
		const suggest = new ChipFileSuggest(app, newItemInput, (file) => {
			addChip(`[[${file.basename}]]`);
			newItemInput.focus();
		});
		allSuggests.push(suggest);

		const removeBtn = document.createElement('button');
		removeBtn.className = 'gbv-popup-dep-remove';
		removeBtn.textContent = '×';
		removeBtn.type = 'button';
		removeBtn.addEventListener('click', () => {
			suggest.close();
			row.remove();
		});

		row.appendChild(typeSel);
		row.appendChild(chipsArea);
		row.appendChild(removeBtn);
		depRowsContainer.appendChild(row);
	}

	// Group existing deps by type so each type gets one row with multiple chips
	const initByType: Record<string, string[]> = {};
	for (const dep of task.dependencies) {
		if (dep.targetName) {
			(initByType[dep.type] ??= []).push(dep.targetName);
		}
	}
	for (const [type, names] of Object.entries(initByType)) addDepRow(type, names);

	addDepBtn.addEventListener('click', () => addDepRow('FS', []));

	// ── Actions row ──────────────────────────────────────────────────────────
	const actionsRow = document.createElement('div');
	actionsRow.className = 'gbv-popup-actions';

	const saveBtn = document.createElement('button');
	saveBtn.className = 'gbv-popup-save mod-cta';
	saveBtn.textContent = 'Save';

	const cancelBtn = document.createElement('button');
	cancelBtn.className = 'gbv-popup-cancel';
	cancelBtn.textContent = 'Cancel';

	actionsRow.appendChild(saveBtn);
	actionsRow.appendChild(cancelBtn);
	popup.appendChild(actionsRow);

	// ── Append, position, show ───────────────────────────────────────────────
	document.body.appendChild(popup);

	const anchorRect = anchorEl.getBoundingClientRect();
	const popupRect = popup.getBoundingClientRect();
	const { left, top } = clampToViewport(anchorRect, popupRect.width || 280, popupRect.height || 240, 0, 8);

	popup.style.left = `${left}px`;
	popup.style.top = `${top}px`;
	popup.style.visibility = '';

	// ── Cleanup helpers ──────────────────────────────────────────────────────
	function destroy(): void {
		for (const s of allSuggests) s.close();
		popup.remove();
		document.removeEventListener('keydown', onKeyDown);
		// Use setTimeout to avoid immediate re-trigger from the click that opened the popup
		setTimeout(() => {
			document.removeEventListener('click', onDocClick, true);
		}, 0);
	}

	function onKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			closeActivePopup();
		}
	}

	function onDocClick(e: MouseEvent): void {
		const target = e.target as Element;
		if (!popup.contains(target) && !target.closest?.('.suggestion-container')) {
			closeActivePopup();
		}
	}

	document.addEventListener('keydown', onKeyDown);
	// Defer outside-click listener by one tick so the opening click doesn't immediately close the popup
	setTimeout(() => {
		document.addEventListener('click', onDocClick, true);
	}, 0);

	activePopup = { el: popup, destroy };

	// ── Save handler ─────────────────────────────────────────────────────────
	saveBtn.addEventListener('click', async () => {
		const newStart = startInput.value; // YYYY-MM-DD or ''
		const newEnd = endInput.value;
		const newStatus = statusSel.value;
		const newPriority = prioritySel.value;

		// Collect dep rows from the DOM (chips per row + any pending input text)
		const depsByType: Record<string, string[]> = { FS: [], SS: [], FF: [], SF: [] };
		for (const row of Array.from(depRowsContainer.querySelectorAll('.gbv-popup-dep-edit-row'))) {
			const type = (row.querySelector('.gbv-popup-dep-type') as HTMLSelectElement).value;
			if (!(type in depsByType)) continue;
			for (const chip of Array.from(row.querySelectorAll('.gbv-dep-chip'))) {
				const val = (chip as HTMLElement).dataset.depValue;
				if (val) depsByType[type].push(val);
			}
			// Also save any text typed but not yet confirmed as a chip
			const pending = ((row.querySelector('.gbv-dep-new-item') as HTMLInputElement)?.value ?? '').trim();
			if (pending) depsByType[type].push(pending.startsWith('[[') ? pending : `[[${pending}]]`);
		}

		const startKey = pluginSettings?.startDateProp || DEFAULT_PLUGIN_SETTINGS.startDateProp;
		const endKey = pluginSettings?.endDateProp || DEFAULT_PLUGIN_SETTINGS.endDateProp;

		await app.fileManager.processFrontMatter(task.file, (fm: Record<string, unknown>) => {
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
			fm['status'] = newStatus;
			fm['priority'] = newPriority;

			// Write dep fields; delete if empty.
			// Names are stored as-is (already include [[...]] from the input).
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

	// ── Cancel handler ───────────────────────────────────────────────────────
	cancelBtn.addEventListener('click', () => {
		closeActivePopup();
	});
}
