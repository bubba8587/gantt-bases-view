import { describe, it, expect } from 'vitest';
import type { BasesViewConfig } from 'obsidian';
import { extractTask, readSettings, resolveDependencyPaths } from '../src/core/extract.ts';
import { stripWikilink } from '../src/core/model.ts';
import { makeEntry, makeTask } from './helpers.ts';

function makeViewConfig(values: Record<string, unknown> = {}): BasesViewConfig {
	return { get: (key: string) => values[key] } as unknown as BasesViewConfig;
}

const settings = readSettings(makeViewConfig());

describe('readSettings', () => {
	it('defaults to scheduled/due on note-prefixed properties', () => {
		expect(settings.startDateProp).toBe('note.scheduled');
		expect(settings.endDateProp).toBe('note.due');
		expect(settings.zoom).toBe('week');
		expect(settings.showDependencies).toBe(true);
		expect(settings.showToday).toBe(true);
	});

	it('honors configured date properties from plugin settings', () => {
		const s = readSettings(makeViewConfig(), {
			startDateProp: 'begins',
			endDateProp: 'deadline',
			statusOptions: [], priorityOptions: [], statusColors: {}, priorityColors: {},
		});
		expect(s.startDateProp).toBe('note.begins');
		expect(s.endDateProp).toBe('note.deadline');
	});

	it('reads zoom and toggles from the view config', () => {
		const s = readSettings(makeViewConfig({ zoom: 'month', showDependencies: false }));
		expect(s.zoom).toBe('month');
		expect(s.showDependencies).toBe(false);
	});
});

describe('extractTask', () => {
	it('extracts a fully populated task', () => {
		const entry = makeEntry('Tasks/dev.md', {
			'note.scheduled': '2026-04-08',
			'note.due': '2026-04-21',
			'note.status': 'In-Progress',
			'note.priority': 'High',
			'note.title': 'Development',
			'note.blockedBy': ['[[GE-Design]]'],
			'note.syncStart': '[[A]], [[B]]',
		});
		const task = extractTask(entry, settings);

		expect(task.id).toBe('Tasks/dev.md');
		expect(task.title).toBe('Development');
		expect(task.status).toBe('in-progress'); // lowercased
		expect(task.priority).toBe('high');
		expect(task.startDate?.getDate()).toBe(8);
		expect(task.endDate?.getDate()).toBe(21);
		expect(task.isMilestone).toBe(false);
		expect(task.dependencies).toEqual([
			{ targetPath: '', targetName: '[[GE-Design]]', type: 'FS' },
			{ targetPath: '', targetName: '[[A]]', type: 'SS' },
			{ targetPath: '', targetName: '[[B]]', type: 'SS' },
		]);
	});

	it('falls back to the file basename when there is no title', () => {
		const task = extractTask(makeEntry('Tasks/kickoff.md', {}), settings);
		expect(task.title).toBe('kickoff');
	});

	it('marks start-only tasks without a timeEstimate as milestones', () => {
		expect(extractTask(makeEntry('a.md', { 'note.scheduled': '2026-04-01' }), settings).isMilestone).toBe(true);
		expect(extractTask(makeEntry('b.md', {
			'note.scheduled': '2026-04-01', 'note.timeEstimate': 480,
		}), settings).isMilestone).toBe(false);
		// Empty-string timeEstimate is "no value" — still a milestone.
		expect(extractTask(makeEntry('c.md', {
			'note.scheduled': '2026-04-01', 'note.timeEstimate': '',
		}), settings).isMilestone).toBe(true);
	});

	it('treats same-day start/end as a 1-day task, not a milestone', () => {
		const task = extractTask(makeEntry('a.md', {
			'note.scheduled': '2026-04-01', 'note.due': '2026-04-01',
		}), settings);
		expect(task.isMilestone).toBe(false);
	});
});

describe('stripWikilink', () => {
	it('strips brackets and alias', () => {
		expect(stripWikilink('[[Note]]')).toBe('Note');
		expect(stripWikilink('[[Note|Alias]]')).toBe('Note');
		expect(stripWikilink('  [[ Note ]] ')).toBe('Note');
		expect(stripWikilink('Plain')).toBe('Plain');
	});
});

describe('resolveDependencyPaths', () => {
	it('resolves by basename, title, and path last-segment, case-insensitively', () => {
		const design = makeTask('Projects/GE-Design.md', { title: 'Design' });
		const dev = makeTask('Projects/GE-Development.md', {
			dependencies: [
				{ targetPath: '', targetName: '[[ge-design]]', type: 'FS' },           // basename, wrong case
				{ targetPath: '', targetName: '[[Design]]', type: 'SS' },              // title
				{ targetPath: '', targetName: '[[Projects/GE-Design]]', type: 'FF' },  // folder path
				{ targetPath: '', targetName: '[[Nope]]', type: 'SF' },                // unresolvable
			],
		});
		resolveDependencyPaths([design, dev]);

		expect(dev.dependencies[0].targetPath).toBe('Projects/GE-Design.md');
		expect(dev.dependencies[1].targetPath).toBe('Projects/GE-Design.md');
		expect(dev.dependencies[2].targetPath).toBe('Projects/GE-Design.md');
		expect(dev.dependencies[3].targetPath).toBe('');
	});
});
