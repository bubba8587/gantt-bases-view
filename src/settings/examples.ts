import { Notice } from 'obsidian';
import type { App } from 'obsidian';

export const EXAMPLES_FOLDER = 'Gantt Examples';

interface ExampleNote {
	name: string;
	content: string;
}

/**
 * Sample vault content demonstrating every dependency type (FS, SS, FF, SF)
 * plus the edge cases the view must render gracefully: milestones,
 * deadline-only tasks, reversed dates, broken links, long titles, and each
 * kind of schedule violation the Fix Schedule panel can repair.
 */
const EXAMPLE_NOTES: ExampleNote[] = [
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
			'Should fall back to a 1-day bar occupying the due date.',
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
			'**Edge case** — scheduled is AFTER due (reversed dates).',
			'Bar width must not go negative, and a start-date fix normalizes',
			'the reversed dates instead of leaving them inverted.',
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
			'and Documentation (Apr 14–21). Both are violated, but Testing is',
			'the binding one: the fix should move start to Apr 29 (the day',
			'after Testing finishes), not Apr 22.',
		].join('\n'),
	},
	{
		name: 'GE-VendorWindow',
		content: [
			'---',
			'title: Vendor Window',
			'status: to-do',
			'priority: medium',
			'scheduled: 2026-04-10',
			'due: 2026-04-14',
			'ganttLocks:',
			'  - start',
			'  - end',
			'projects:',
			'  - Website Launch',
			'blockedBy:',
			'  - "[[GE-Development]]"',
			'---',
			'',
			'**Locked task** — start and end are pinned via `ganttLocks`, so its',
			'FS violation against Development (would need to start Apr 22) cannot',
			'be auto-fixed. Fix Schedule shows it as 🔒 Locked, Apply All skips it,',
			'and the bar cannot be dragged or resized.',
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
			'**Cascading FS violation** — depends on Handoff (ends Apr 18), so',
			'this task is fine on its own. But once Handoff is fixed to start',
			'Apr 29, Sign-off will also need updating. Tests cascading fixes.',
		].join('\n'),
	},
];

// Base file — folder-scoped so it shows everything in Gantt Examples/
// regardless of frontmatter, rather than filtering by project name.
// The order: array defines which properties are visible; the Gantt view
// reads this to decide which features to display (priority dot, dep arrows).
const BASE_FILE_CONTENT = [
	'views:',
	'  - type: gantt',
	'    name: Website Launch',
	'    filters:',
	'      and:',
	`        - file.folder == "${EXAMPLES_FOLDER}"`,
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

/** Creates the example notes + .base file, skipping any that already exist. */
export async function createExampleNotes(app: App): Promise<void> {
	const vault = app.vault;

	if (!vault.getAbstractFileByPath(EXAMPLES_FOLDER)) {
		await vault.createFolder(EXAMPLES_FOLDER);
	}

	const allFiles: Array<{ path: string; content: string }> = [
		...EXAMPLE_NOTES.map(n => ({ path: `${EXAMPLES_FOLDER}/${n.name}.md`, content: n.content })),
		{ path: `${EXAMPLES_FOLDER}/gantt-examples.base`, content: BASE_FILE_CONTENT },
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
		new Notice(`Created ${created} file${created > 1 ? 's' : ''} in "${EXAMPLES_FOLDER}/"${skipped > 0 ? ` (${skipped} already existed)` : ''}`);
	} else {
		new Notice(`All example files already exist in "${EXAMPLES_FOLDER}/"`);
	}
}
