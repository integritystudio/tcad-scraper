const VOWELS = "aeiou";
const CONSONANTS = "bcdfghjklmnpqrstvwxyz";

/**
 * All 4-char consonant-vowel-consonant-vowel bases (lowercase), in
 * alphabetical order: 21 * 5 * 21 * 5 = 11,025 strings.
 */
export function generateCvcvBases(): string[] {
	const bases: string[] = [];
	for (const c1 of CONSONANTS) {
		for (const v1 of VOWELS) {
			for (const c2 of CONSONANTS) {
				for (const v2 of VOWELS) {
					bases.push(c1 + v1 + c2 + v2);
				}
			}
		}
	}
	return bases;
}
