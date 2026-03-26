import type { BasesViewConfig, BasesAllOptions } from 'obsidian';

export function getViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
	return [
		{
			type: 'optionGroup',
			name: 'Data',
			options: [
				{
					type: 'property',
					name: 'Start date property',
					key: 'startDateProp',
					defaultValue: 'note.scheduled',
				},
				{
					type: 'property',
					name: 'End date property',
					key: 'endDateProp',
					defaultValue: 'note.due',
				},
			],
		},
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
					type: 'dropdown',
					name: 'Color by',
					key: 'colorBy',
					options: ['status', 'priority'],
					defaultValue: 'priority',
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
