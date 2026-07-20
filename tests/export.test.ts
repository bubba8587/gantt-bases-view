import { describe, it, expect } from 'vitest';
import { exportToTSV, exportToMarkdownTable, columnExportLabel } from '../src/core/export.ts';
import { generateColumns } from '../src/core/timeline.ts';
import { makeConfig, makeTask } from './helpers.ts';
import type { TaskGroup } from '../src/core/model.ts';

const apr = (day: number) => new Date(2026, 3, day);

describe('columnExportLabel', () => {
	it('day zoom: "MMM D"', () => {
		const config = makeConfig(apr(14), apr(15), 'day');
		const [col] = generateColumns(config);
		expect(columnExportLabel(col, 'day')).toBe('Apr 14');
	});

	it('month zoom: "MMM YYYY" — regression for mangled "2026|Ap Apr" headers', () => {
		const config = makeConfig(apr(1), new Date(2026, 4, 31), 'month');
		const cols = generateColumns(config);
		expect(cols.map(c => columnExportLabel(c, 'month'))).toEqual(['Apr 2026', 'May 2026']);
	});

	it('week zoom: "Wnn YYYY"', () => {
		const config = makeConfig(new Date(2026, 3, 5), new Date(2026, 3, 11), 'week');
		const [col] = generateColumns(config);
		expect(columnExportLabel(col, 'week')).toBe('W15 2026');
	});

	it('year zoom: "Qn YYYY"', () => {
		const config = makeConfig(new Date(2026, 0, 1), new Date(2026, 2, 31), '1year');
		const [col] = generateColumns(config);
		expect(columnExportLabel(col, '1year')).toBe('Q1 2026');
	});
});

describe('exportToTSV', () => {
	const config = makeConfig(new Date(2026, 3, 1), new Date(2026, 5, 30), 'month');

	const groups: TaskGroup[] = [
		{
			key: 'Website Launch',
			tasks: [
				makeTask('design.md', {
					title: 'Design',
					status: 'done',
					priority: 'high',
					startDate: apr(1),
					endDate: apr(7),
				}),
				makeTask('launch.md', {
					title: 'Launch',
					status: 'to-do',
					priority: 'high',
					startDate: new Date(2026, 4, 22),
					endDate: new Date(2026, 4, 28),
					dependencies: [{ targetPath: 'design.md', targetName: '[[design]]', type: 'FS' }],
				}),
			],
		},
	];

	it('emits data headers followed by timeline column headers', () => {
		const [header] = exportToTSV(groups, config).split('\n');
		expect(header.split('\t')).toEqual([
			'Task', 'Status', 'Priority', 'Start', 'End', 'Duration (days)', 'Dependencies',
			'Apr 2026', 'May 2026', 'Jun 2026',
		]);
	});

	it('emits a group header row and one row per task with bar cells', () => {
		const lines = exportToTSV(groups, config).split('\n');
		expect(lines[1].split('\t')[0]).toBe('Website Launch');

		const design = lines[2].split('\t');
		expect(design.slice(0, 7)).toEqual(
			['Design', 'done', 'high', '2026-04-01', '2026-04-07', '6', ''],
		);
		expect(design.slice(7)).toEqual(['█', '', '']); // April only

		const launch = lines[3].split('\t');
		expect(launch.slice(0, 7)).toEqual(
			['Launch', 'to-do', 'high', '2026-05-22', '2026-05-28', '6', '[[design]] (FS)'],
		);
		expect(launch.slice(7)).toEqual(['', '█', '']); // May only
	});

	it('replaces tabs inside cell values', () => {
		const g: TaskGroup[] = [{
			key: '',
			tasks: [makeTask('t.md', { title: 'has\ttab', startDate: apr(1), endDate: apr(2) })],
		}];
		const row = exportToTSV(g, config).split('\n')[1];
		expect(row.startsWith('has tab\t')).toBe(true);
	});
});

describe('exportToMarkdownTable', () => {
	it('escapes pipes and renders group + task rows', () => {
		const groups: TaskGroup[] = [{
			key: 'A|B',
			tasks: [makeTask('t.md', { title: 'Task', status: 'to|do', startDate: apr(1), endDate: apr(3) })],
		}];
		const md = exportToMarkdownTable(groups);
		const lines = md.split('\n');
		expect(lines[0]).toContain('| Task |');
		expect(lines[2]).toBe('| **A\\|B** | | | | | | |');
		expect(lines[3]).toContain('to\\|do');
		expect(lines[3]).toContain('2026-04-01');
	});
});
