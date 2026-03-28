import type { BasesViewConfig, BasesAllOptions } from 'obsidian';

export function getViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
	// Note: Bases view options don't currently render UI controls.
	// Zoom is handled by the plugin toolbar, colorBy by the toolbar dropdown,
	// and date properties by plugin settings. These entries are kept for
	// potential future Bases API support.
	return [
		{
			type: 'optionGroup',
			name: 'Display',
			options: [
				{
					type: 'dropdown',
					name: 'Zoom',
					key: 'zoom',
					options: ['day', 'week', 'month', '1year', '2year', '3year'],
					defaultValue: 'week',
				},
				{
					type: 'toggle',
					name: 'Show dependencies',
					key: 'showDependencies',
					defaultValue: true,
				},
				{
					type: 'toggle',
					name: 'Show today marker',
					key: 'showToday',
					defaultValue: true,
				},
			],
		},
	] as unknown as BasesAllOptions[];
}
