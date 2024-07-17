import { parse as parseQuotes } from 'shell-quote';

export function isInt(value: number) {
	return value === Math.floor(value);
}

export const shellArgs = (str: string) => {
	const spaces: string[] = str.match(/"[^"]+"|'[^']+'|\S+/g) ?? [];

	return spaces.flatMap((s) => parseQuotes(s)).map((s) => s.toString());
};
