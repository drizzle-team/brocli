import { beforeAll, describe, expect } from 'vitest';

const getArgs = (...args: string[]) => [
	process.argv[0]!, // executing application path
	process.argv[1]!, // executed file path
	...args,
];
