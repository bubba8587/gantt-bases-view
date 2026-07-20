import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import { DEFAULT_PLUGIN_SETTINGS, DEFAULT_STATUS_OPTIONS, DEFAULT_PRIORITY_OPTIONS } from '../core/model.ts';
import type GanttBasesViewPlugin from '../main.ts';
import { syncFromTaskNotes } from './tasknotes.ts';
import { createExampleNotes } from './examples.ts';

export class GanttSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: GanttBasesViewPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Property mapping').setHeading();

		new Setting(containerEl)
			.setName('Start date property')
			.setDesc('Frontmatter property used for the task start date.')
			.addText(text => {
				text.setPlaceholder(DEFAULT_PLUGIN_SETTINGS.startDateProp)
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
				text.setPlaceholder(DEFAULT_PLUGIN_SETTINGS.endDateProp)
					.setValue(this.plugin.settings.endDateProp)
					.onChange(async (value) => {
						this.plugin.settings.endDateProp = value.trim() || DEFAULT_PLUGIN_SETTINGS.endDateProp;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setName('Status & priority options').setHeading();

		new Setting(containerEl)
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
				text.inputEl.addClass('gbv-settings-wide-input');
			});

		new Setting(containerEl)
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
				text.inputEl.addClass('gbv-settings-wide-input');
			});

		new Setting(containerEl)
			.setName('Sync from TaskNotes')
			.setDesc('Import status and priority options from the TaskNotes plugin.')
			.addButton(btn => {
				btn.setButtonText('Sync')
					.onClick(async () => {
						if (syncFromTaskNotes(this.app, this.plugin.settings)) {
							await this.plugin.saveSettings();
							this.display(); // refresh UI to show new values
						}
					});
			});

		new Setting(containerEl).setName('Examples').setHeading();

		new Setting(containerEl)
			.setName('Create example notes')
			.setDesc('Creates a small set of linked notes in your vault demonstrating all four dependency types (FS, SS, FF, SF). Notes are placed in a "Gantt Examples" folder.')
			.addButton(btn => {
				btn.setButtonText('Create examples')
					.setCta()
					.onClick(() => createExampleNotes(this.app));
			});
	}
}
