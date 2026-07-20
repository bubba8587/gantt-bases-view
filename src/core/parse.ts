/**
 * Frontmatter value parsing. Bases hands us `unknown` values that may be
 * strings, numbers, arrays, or wrapper objects whose toString() yields the
 * raw text — everything here normalizes through String() for that reason.
 */

export function parseDate(value: unknown): Date | null {
	if (value == null) return null;
	const str = String(value).trim();
	if (!str) return null;
	// Parse YYYY-MM-DD as local midnight to avoid the UTC-midnight timezone shift
	// that new Date("YYYY-MM-DD") produces (shows as previous day in UTC- zones).
	const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (iso) {
		const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
		return isNaN(d.getTime()) ? null : d;
	}
	const d = new Date(str);
	return isNaN(d.getTime()) ? null : d;
}

export function parseNumber(value: unknown): number | null {
	if (value == null) return null;
	const str = String(value).trim();
	if (!str) return null; // Number('') is 0 — an empty field is "no value", not zero
	const n = Number(str);
	return isNaN(n) ? null : n;
}

export function parseString(value: unknown): string {
	if (value == null) return '';
	const str = String(value).trim();
	if (str === 'null' || str === 'undefined') return '';
	return str;
}

export function parseArrayOfStrings(value: unknown): string[] {
	if (value == null) return [];
	if (Array.isArray(value)) {
		return value
			.filter(v => v != null)
			.map(v => String(v).trim())
			.filter(s => s && s !== 'null');
	}
	const str = String(value).trim();
	if (!str || str === 'null') return [];
	// A scalar string may contain multiple wikilinks: "[[A]], [[B]]"
	// Extract each [[...]] occurrence individually so they're stripped correctly.
	const matches = str.match(/\[\[[^\]]+\]\]/g);
	if (matches && matches.length > 1) return matches;
	return [str];
}
