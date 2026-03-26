import { AbstractInputSuggest, TFile } from 'obsidian';
import type { App } from 'obsidian';
import type { GanttTask } from './types.ts';
import { DEP_FIELDS, stripWikilink } from './types.ts';
import { formatDate } from './timeline.ts';

/** Native Obsidian file-name autocomplete wired to a chips-style dep input. */
class ChipFileSuggest extends AbstractInputSuggest<TFile> {
	constructor(app: App, input: HTMLInputElement, private onSelect: (file: TFile) => void) {
		super(app, input);
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
		this.onSelect(file);
		this.setValue('');
		this.close();
	}
}

/**
 * Reads the user-defined options for a property from Obsidian's metadata type
 * manager (undocumented but stable API used by the wider plugin community).
 * Falls back to `fallback` if the property isn't registered or has no options.
 * Always ensures `currentValue` is present in the returned list.
 */
function getPropertyOptions(app: App, propertyName: string, fallback: string[], currentValue?: string): string[] {
	const opts: string[] | undefined =
		(app as any).metadataTypeManager?.properties?.[propertyName]?.options;
	const base = opts && opts.length > 0 ? opts : fallback;
	if (currentValue && !base.includes(currentValue)) {
		return [...base, currentValue];
	}
	return base;
}

const DEP_TYPE_TO_FIELD: Record<string, string> = Object.fromEntries(
	DEP_FIELDS.map(f => [f.type, f.bare])
);

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
		if (opt === current) o.selected = true;
		sel.appendChild(o);
	}
	return sel;
}

export function openPopupEditor(
	task: GanttTask,
	anchorEl: HTMLElement,
	app: App,
	onUpdate: () => void,
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

	// ── Title row ─────────────────────────────────────────────────────────────
	const titleRow = document.createElement('div');
	titleRow.className = 'gbv-popup-title';

	const titleEl = document.createElement('h4');
	titleEl.textContent = task.title || task.file.basename;

	const linkBtn = document.createElement('button');
	linkBtn.className = 'gbv-popup-link-btn clickable-icon';
	linkBtn.title = 'Open note';
	linkBtn.setAttribute('aria-label', 'Open note');
	// Use a simple external-link SVG icon
	linkBtn.innerHTML =
		'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
		'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
		'<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
		'<polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>' +
		'</svg>';
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
	const statusOptions = getPropertyOptions(app, 'status', ['to-do', 'in-progress', 'done', 'blocked'], task.status);
	const statusSel = createSelect(statusOptions, task.status || statusOptions[0]);

	const priorityOptions = getPropertyOptions(app, 'priority', ['low', 'medium', 'high'], task.priority);
	const prioritySel = createSelect(priorityOptions, task.priority || priorityOptions[0]);

	const spRow = document.createElement('div');
	spRow.className = 'gbv-popup-row2';
	spRow.appendChild(createLabeledField('Status', statusSel));
	spRow.appendChild(createLabeledField('Priority', prioritySel));
	popup.appendChild(spRow);

	// ── Dependencies (editable) ───────────────────────────────────────────────
	const depsSection = document.createElement('div');
	depsSection.className = 'gbv-popup-deps';

	const depsHeaderRow = document.createElement('div');
	depsHeaderRow.className = 'gbv-popup-deps-header-row';

	const depsTitle = document.createElement('span');
	depsTitle.className = 'gbv-popup-deps-header';
	depsTitle.textContent = 'Dependencies';

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

		const typeSel = document.createElement('select');
		typeSel.className = 'gbv-popup-dep-type';
		for (const t of ['FS', 'SS', 'FF', 'SF']) {
			const o = document.createElement('option');
			o.value = t;
			o.textContent = t;
			if (t === type) o.selected = true;
			typeSel.appendChild(o);
		}
		typeSel.dataset.depType = type;
		typeSel.addEventListener('change', () => { typeSel.dataset.depType = typeSel.value; });

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

	// ── Cleanup helpers ───────────────────────────────────────────────────────
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

		await (app.fileManager as any).processFrontMatter(task.file, (fm: Record<string, unknown>) => {
			if (newStart) {
				fm['scheduled'] = newStart;
			} else {
				delete fm['scheduled'];
			}
			if (newEnd) {
				fm['due'] = newEnd;
			} else {
				delete fm['due'];
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

	// ── Cancel handler ────────────────────────────────────────────────────────
	cancelBtn.addEventListener('click', () => {
		closeActivePopup();
	});
}
