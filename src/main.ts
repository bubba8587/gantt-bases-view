import { Plugin } from 'obsidian';
import { GanttView } from './ui/gantt-view.ts';
import { getViewOptions } from './ui/options.ts';
import type { PluginSettings } from './core/model.ts';
import { DEFAULT_PLUGIN_SETTINGS } from './core/model.ts';
import { GanttSettingsTab } from './settings/settings-tab.ts';

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
