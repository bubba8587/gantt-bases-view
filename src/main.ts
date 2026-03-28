import { Plugin, PluginSettingTab, App, Setting, Notice, TFolder } from 'obsidian';
import { GanttView } from './gantt-view.ts';
import { getViewOptions } from './options.ts';
import type { PluginSettings } from './types.ts';
import { DEFAULT_PLUGIN_SETTINGS, DEFAULT_STATUS_OPTIONS, DEFAULT_PRIORITY_OPTIONS } from './types.ts';

export default class GanttBasesViewPlugin extends Plugin {
	settings: PluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerBasesView('gantt', {
			name: 'Gantt',
			icon: 'bar-chart-horizontal',
			factory: (controller, containerEl) => new GanttView(controller, containerEl, this),
			options: (config) => getViewOptions(config),
		});
		this.addSettingTab(new GanttSettingsTab(this.app, this));
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		if (data) {
			this.settings = { ...DEFAULT_PLUGIN_SETTINGS, ...data };
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

class GanttSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: GanttBasesViewPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h3', { text: 'Property mapping' });

		new Setting(containerEl)
			.setName('Start date property')
			.setDesc('Frontmatter property used for the task start date.')
			.addText(text => {
				text.setPlaceholder('scheduled')
					.setValue(this.plugin.settings.startDateProp)
					.onChange(async (value) => {
						this.plugin.settings.startDateProp = value.trim() || DEFAULT_PLUGIN_SETTINGS.startDateProp;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('End date property')
			.setDesc('Frontmatter property used for the task end date.')
			.addText(text => {
				text.setPlaceholder('due')
					.setValue(this.plugin.settings.endDateProp)
					.onChange(async (value) => {
						this.plugin.settings.endDateProp = value.trim() || DEFAULT_PLUGIN_SETTINGS.endDateProp;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl('h3', { text: 'Status & priority options' });

		const statusSetting = new Setting(containerEl)
			.setName('Status options')
			.setDesc('Comma-separated list of status values for the dropdown.')
			.addText(text => {
				text.setPlaceholder(DEFAULT_STATUS_OPTIONS.join(', '))
					.setValue(this.plugin.settings.statusOptions.join(', '))
					.onChange(async (value) => {
						const parsed = value.split(',').map(s => s.trim()).filter(Boolean);
						this.plugin.settings.statusOptions = parsed.length > 0 ? parsed : DEFAULT_STATUS_OPTIONS;
						await this.plugin.saveSettings();
					});
				text.inputEl.style.width = '100%';
			});

		const prioritySetting = new Setting(containerEl)
			.setName('Priority options')
			.setDesc('Comma-separated list of priority values for the dropdown.')
			.addText(text => {
				text.setPlaceholder(DEFAULT_PRIORITY_OPTIONS.join(', '))
					.setValue(this.plugin.settings.priorityOptions.join(', '))
					.onChange(async (value) => {
						const parsed = value.split(',').map(s => s.trim()).filter(Boolean);
						this.plugin.settings.priorityOptions = parsed.length > 0 ? parsed : DEFAULT_PRIORITY_OPTIONS;
						await this.plugin.saveSettings();
					});
				text.inputEl.style.width = '100%';
			});

		new Setting(containerEl)
			.setName('Sync from TaskNotes')
			.setDesc('Import status and priority options from the TaskNotes plugin.')
			.addButton(btn => {
				btn.setButtonText('Sync')
					.onClick(async () => {
						const synced = this.syncFromTasknotes();
						if (synced) {
							await this.plugin.saveSettings();
							this.display(); // refresh UI to show new values
						}
					});
			});

		containerEl.createEl('h3', { text: 'Examples' });

		new Setting(containerEl)
			.setName('Create example notes')
			.setDesc('Creates a small set of linked notes in your vault demonstrating all four dependency types (FS, SS, FF, SF). Notes are placed in a "Gantt Examples" folder.')
			.addButton(btn => {
				btn.setButtonText('Create examples')
					.setCta()
					.onClick(() => this.createExampleNotes());
			});
	}

	private syncFromTasknotes(): boolean {
		const tasknotes = (this.app as any).plugins?.plugins?.['tasknotes'];
		if (!tasknotes) {
			new Notice('TaskNotes plugin not found. Is it installed and enabled?');
			return false;
		}

		const data = tasknotes.settings ?? tasknotes.data;
		if (!data) {
			new Notice('Could not read TaskNotes settings.');
			return false;
		}

		let synced = false;

		if (Array.isArray(data.customStatuses) && data.customStatuses.length > 0) {
			this.plugin.settings.statusOptions = data.customStatuses.map(
				(s: { value: string }) => s.value,
			);
			const colors: Record<string, string> = {};
			for (const s of data.customStatuses) {
				if (s.value && s.color) colors[s.value.toLowerCase()] = s.color;
			}
			this.plugin.settings.statusColors = colors;
			synced = true;
		}

		if (Array.isArray(data.customPriorities) && data.customPriorities.length > 0) {
			this.plugin.settings.priorityOptions = data.customPriorities.map(
				(p: { value: string }) => p.value,
			);
			const colors: Record<string, string> = {};
			for (const p of data.customPriorities) {
				if (p.value && p.color) colors[p.value.toLowerCase()] = p.color;
			}
			this.plugin.settings.priorityColors = colors;
			synced = true;
		}

		if (synced) {
			new Notice('Synced status, priority, and colors from TaskNotes.');
		} else {
			new Notice('No custom statuses or priorities found in TaskNotes.');
		}

		return synced;
	}

	private async createExampleNotes(): Promise<void> {
		const vault = this.app.vault;
		const folderPath = 'Gantt Examples';

		// Create folder if it doesn't exist
		if (!vault.getAbstractFileByPath(folderPath)) {
			await vault.createFolder(folderPath);
		}

		const notes: Array<{ name: string; content: string }> = [
			{
				name: 'GE-Design',
				content: [
					'---',
					'title: Design',
					'status: done',
					'priority: high',
					'scheduled: 2026-04-01',
					'due: 2026-04-07',
					'projects:',
					'  - Website Launch',
					'---',
					'',
					'UI/UX design and wireframes.',
					'No dependencies — this is the first task.',
				].join('\n'),
			},
			{
				name: 'GE-Development',
				content: [
					'---',
					'title: Development',
					'status: in-progress',
					'priority: high',
					'scheduled: 2026-04-08',
					'due: 2026-04-21',
					'projects:',
					'  - Website Launch',
					'blockedBy:',
					'  - "[[GE-Design]]"',
					'---',
					'',
					'Build the site.',
					'',
					'**FS** via `blockedBy`: starts after Design finishes.',
				].join('\n'),
			},
			{
				name: 'GE-Testing',
				content: [
					'---',
					'title: Testing',
					'status: to-do',
					'priority: medium',
					'scheduled: 2026-04-08',
					'due: 2026-04-28',
					'projects:',
					'  - Website Launch',
					'syncStart:',
					'  - "[[GE-Development]]"',
					'---',
					'',
					'QA and user testing.',
					'',
					'**SS** via `syncStart`: starts when Development starts.',
				].join('\n'),
			},
			{
				name: 'GE-Documentation',
				content: [
					'---',
					'title: Documentation',
					'status: to-do',
					'priority: low',
					'scheduled: 2026-04-14',
					'due: 2026-04-21',
					'projects:',
					'  - Website Launch',
					'syncFinish:',
					'  - "[[GE-Development]]"',
					'---',
					'',
					'Write user and developer docs.',
					'',
					'**FF** via `syncFinish`: must finish when Development finishes.',
				].join('\n'),
			},
			{
				name: 'GE-Launch',
				content: [
					'---',
					'title: Launch',
					'status: to-do',
					'priority: high',
					'scheduled: 2026-04-22',
					'due: 2026-04-28',
					'projects:',
					'  - Website Launch',
					'finishAfterStart:',
					'  - "[[GE-Testing]]"',
					'---',
					'',
					'Deploy to production.',
					'',
					'**SF** via `finishAfterStart`: must finish after Testing starts.',
				].join('\n'),
			},
			// ── Edge / stress cases ──────────────────────────────────────
			{
				name: 'GE-Kickoff',
				content: [
					'---',
					'title: Kickoff Meeting',
					'status: done',
					'priority: high',
					'scheduled: 2026-04-01',
					'projects:',
					'  - Website Launch',
					'---',
					'',
					'**Milestone** — only a start date, no end date, no timeEstimate.',
					'Should render as a diamond rather than a bar.',
				].join('\n'),
			},
			{
				name: 'GE-DeadlineOnly',
				content: [
					'---',
					'title: Stakeholder Review',
					'status: to-do',
					'priority: medium',
					'due: 2026-04-15',
					'projects:',
					'  - Website Launch',
					'blockedBy:',
					'  - "[[GE-Design]]"',
					'---',
					'',
					'**Edge case** — only a due date, no scheduled.',
					'Should fall back to a 1-day bar ending on the due date.',
					'Also shares a dependency with Development (both blocked by Design).',
				].join('\n'),
			},
			{
				name: 'GE-ReversedDates',
				content: [
					'---',
					'title: Reversed Dates Task',
					'status: to-do',
					'priority: low',
					'scheduled: 2026-04-28',
					'due: 2026-04-01',
					'projects:',
					'  - Website Launch',
					'blockedBy:',
					'  - "[[GE-Development]]"',
					'---',
					'',
					'**Edge case + violation** — scheduled is AFTER due (reversed dates),',
					'AND start is before Development finishes — triggers a schedule violation.',
					'Bar width must not go negative.',
				].join('\n'),
			},
			{
				name: 'GE-BrokenDep',
				content: [
					'---',
					'title: Broken Dependency',
					'status: to-do',
					'priority: low',
					'scheduled: 2026-04-10',
					'due: 2026-04-14',
					'projects:',
					'  - Website Launch',
					'blockedBy:',
					'  - "[[GE-Development]]"',
					'  - "[[GE-DoesNotExist]]"',
					'---',
					'',
					'**Edge case** — one valid dep (Development) and one referencing a note',
					'not in the dataset. Valid arrow should draw; broken one should not crash.',
					'Also shares Development as a dependency with ReversedDates — tests',
					'multiple tasks fanning out from the same predecessor.',
				].join('\n'),
			},
			{
				name: 'GE-LongTitle',
				content: [
					'---',
					'title: This Task Has An Extremely Long Title That Should Truncate Gracefully In The Sidebar And On The Bar Without Breaking Layout',
					'status: in-progress',
					'priority: medium',
					'scheduled: 2026-04-05',
					'due: 2026-04-20',
					'projects:',
					'  - Website Launch',
					'syncStart:',
					'  - "[[GE-Development]]"',
					'---',
					'',
					'**Edge case** — very long title, plus SS dep on Development.',
					'Starts before Development starts — triggers an SS schedule violation.',
					'Should truncate with ellipsis in sidebar and bar label.',
				].join('\n'),
			},
			// ── Additional violation cases ───────────────────────────────────────
			{
				name: 'GE-Reporting',
				content: [
					'---',
					'title: Reporting',
					'status: to-do',
					'priority: medium',
					'scheduled: 2026-04-14',
					'due: 2026-04-17',
					'projects:',
					'  - Website Launch',
					'syncFinish:',
					'  - "[[GE-Development]]"',
					'---',
					'',
					'**FF violation** — must finish when Development finishes (Apr 21),',
					'but due Apr 17. Fix should move due to Apr 21.',
				].join('\n'),
			},
			{
				name: 'GE-Training',
				content: [
					'---',
					'title: Training',
					'status: to-do',
					'priority: low',
					'scheduled: 2026-04-01',
					'due: 2026-04-05',
					'projects:',
					'  - Website Launch',
					'finishAfterStart:',
					'  - "[[GE-Testing]]"',
					'---',
					'',
					'**SF violation** — must finish after Testing starts (Apr 8),',
					'but due Apr 5. Fix should move due to Apr 8.',
				].join('\n'),
			},
			{
				name: 'GE-Handoff',
				content: [
					'---',
					'title: Client Handoff',
					'status: to-do',
					'priority: high',
					'scheduled: 2026-04-15',
					'due: 2026-04-18',
					'projects:',
					'  - Website Launch',
					'blockedBy:',
					'  - "[[GE-Testing]]"',
					'  - "[[GE-Documentation]]"',
					'---',
					'',
					'**Multi-dep FS violation** — blocked by both Testing (Apr 8–28)',
					'and Documentation (Apr 14–21). Start Apr 15 is after Documentation',
					'finishes (Apr 21) but before Testing finishes (Apr 28) — one',
					'violated, one OK. Fix should move start to Apr 28.',
				].join('\n'),
			},
			{
				name: 'GE-SignOff',
				content: [
					'---',
					'title: Sign-off',
					'status: to-do',
					'priority: high',
					'scheduled: 2026-04-20',
					'due: 2026-04-22',
					'projects:',
					'  - Website Launch',
					'blockedBy:',
					'  - "[[GE-Handoff]]"',
					'---',
					'',
					'**Cascading FS violation** — depends on Handoff, which itself',
					'has a violation. Start Apr 20 is before Handoff finishes Apr 18—',
					'wait, Handoff ends Apr 18 so this one is actually fine on its own.',
					'But once Handoff is fixed to start Apr 28, Sign-off will also',
					'need updating. Tests cascading fix behavior.',
				].join('\n'),
			},
		];

		// Base file — folder-scoped so it shows everything in Gantt Examples/
		// regardless of frontmatter, rather than filtering by project name.
		// The order: array defines which properties are visible; the Gantt view
		// reads this to decide which features to display (priority dot, dep arrows).
		const baseContent = [
			'views:',
			'  - type: gantt',
			'    name: Website Launch',
			'    filters:',
			'      and:',
			`        - file.folder == "${folderPath}"`,
			'    order:',
			'      - title',
			'      - status',
			'      - priority',
			'      - scheduled',
			'      - due',
			'      - blockedBy',
			'      - syncStart',
			'      - syncFinish',
			'      - finishAfterStart',
			'',
		].join('\n');

		const allFiles: Array<{ path: string; content: string }> = [
			...notes.map(n => ({ path: `${folderPath}/${n.name}.md`, content: n.content })),
			{ path: `${folderPath}/gantt-examples.base`, content: baseContent },
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
			new Notice(`Created ${created} file${created > 1 ? 's' : ''} in "${folderPath}/"${skipped > 0 ? ` (${skipped} already existed)` : ''}`);
		} else {
			new Notice(`All example files already exist in "${folderPath}/"`);
		}
	}
}
