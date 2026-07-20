import { describe, it, expect } from 'vitest';
import { ARROW_ANCHORS } from '../src/ui/dependency-arrows.ts';

/**
 * Arrows run predecessor → successor and must join the two dates each
 * constraint relates. A bar's right edge is its finish, left edge its start.
 * Regression: FS/SF arrows used to connect the opposite edges because the
 * renderer swapped predecessor/successor roles.
 */
describe('ARROW_ANCHORS', () => {
	it('FS joins predecessor finish to successor start', () => {
		expect(ARROW_ANCHORS.FS).toEqual({ fromPredRight: true, toSuccRight: false });
	});

	it('SS joins predecessor start to successor start', () => {
		expect(ARROW_ANCHORS.SS).toEqual({ fromPredRight: false, toSuccRight: false });
	});

	it('FF joins predecessor finish to successor finish', () => {
		expect(ARROW_ANCHORS.FF).toEqual({ fromPredRight: true, toSuccRight: true });
	});

	it('SF joins predecessor start to successor finish', () => {
		expect(ARROW_ANCHORS.SF).toEqual({ fromPredRight: false, toSuccRight: true });
	});
});
