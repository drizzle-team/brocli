import { boolean, defineCommand, defineOptions, runCli, string, type TypeOf } from '@/index';
import { beforeAll, beforeEach, describe, expect, expectTypeOf } from 'vitest';

const getArgs = (...args: string[]) => [
	process.argv[0]!, // executing application path
	process.argv[1]!, // executed file path
	...args,
];

const storage = {
	options: {} as Record<string, any>,
	command: undefined as string | undefined,
};

beforeAll(() => {
	const generateOps = defineOptions({
		dialect: string().alias('-d', '-dlc').desc('Database dialect [pg, mysql, sqlite]').required(),
		schema: string('schema').alias('s').desc('Path to a schema file or folder'),
		out: string().alias('o').desc("Output folder, 'drizzle' by default"),
		name: string().alias('n').desc('Migration file name'),
		breakpoints: string('breakpoints').alias('break').desc(`Prepare SQL statements with breakpoints`),
		custom: string('custom').alias('cus').desc('Prepare empty migration file for custom SQL'),
		config: string().alias('c', 'cfg').desc('Path to a config.json file, drizzle.config.ts by default').default(
			'./drizzle-kit.config.ts',
		),
		flag: boolean().alias('f').desc('Example boolean field'),
		defFlag: boolean().alias('-def').desc('Example boolean field with default').default(true),
		defString: string().alias('-ds').desc('Example string field with default').default('Defaultvalue'),
		debug: boolean('dbg').alias('g').hidden(),
	});

	const generateHandler = (options: TypeOf<typeof generateOps>) => {
		storage.options = options;
		storage.command = 'generate';
	};

	defineCommand({
		name: 'generate',
		aliases: ['g', 'gen'],
		description: 'Generate drizzle migrations',
		hidden: false,
		options: generateOps,
		handler: generateHandler,
	});

	const cFirstOps = defineOptions({
		flag: boolean().alias('f', 'fl').desc('Boolean value'),
		string: string().alias('s', 'str').desc('String value'),
		sFlag: boolean('stealth').alias('h', 'hb').desc('Boolean value'),
		sString: string('sstring').alias('q', 'hs').desc('String value'),
	});

	defineCommand({
		name: 'c-first',
		options: cFirstOps,
		handler: (options) => {
			storage.options = options;
			storage.command = 'c-first';
		},
		hidden: false,
	});

	const cSecondOps = defineOptions({
		flag: boolean().alias('f', 'fl').desc('Boolean value'),
		string: string().alias('s', 'str').desc('String value'),
		sFlag: boolean('stealth').alias('h', 'hb').desc('Boolean value'),
		sString: string('sstring').alias('q', 'hs').desc('String value'),
	});

	defineCommand({
		name: 'c-second',
		options: cSecondOps,
		handler: (options) => {
			storage.options = options;
			storage.command = 'c-second';
		},
		hidden: false,
	});
});

beforeEach(() => {
	storage.options = {};
	storage.command = undefined;
});

describe('Option parsing tests', (it) => {
	it('Required options & defaults', async () => {
		await runCli(getArgs('generate', '--dialect=pg'));

		expect(storage).toStrictEqual({
			command: 'generate',
			options: {
				dialect: 'pg',
				schema: undefined,
				out: undefined,
				name: undefined,
				breakpoints: undefined,
				custom: undefined,
				config: './drizzle-kit.config.ts',
				flag: undefined,
				defFlag: true,
				defString: 'Defaultvalue',
				debug: undefined,
			},
		});
	});

	it('All options by name', async () => {
		await runCli(
			getArgs(
				'generate',
				'--dialect=pg',
				'--schema=./schemapath.ts',
				'--out=./outfile.ts',
				'--name=Example migration',
				'--breakpoints=breakpoints',
				'--custom=custom value',
				'--flag',
				'--defFlag',
				'--dbg',
			),
		);

		expect(storage).toStrictEqual({
			command: 'generate',
			options: {
				dialect: 'pg',
				schema: './schemapath.ts',
				out: './outfile.ts',
				name: 'Example migration',
				breakpoints: 'breakpoints',
				custom: 'custom value',
				config: './drizzle-kit.config.ts',
				flag: true,
				defFlag: true,
				defString: 'Defaultvalue',
				debug: true,
			},
		});
	});

	it('All options by alias', async () => {
		await runCli(
			getArgs(
				'generate',
				'-dlc=pg',
				'-s=./schemapath.ts',
				'-o=./outfile.ts',
				'-n=Example migration',
				'--break=breakpoints',
				'--cus=custom value',
				'-f',
				'-def',
				'-ds=Not=Default=Value',
				'-g',
			),
		);

		expect(storage).toStrictEqual({
			command: 'generate',
			options: {
				dialect: 'pg',
				schema: './schemapath.ts',
				out: './outfile.ts',
				name: 'Example migration',
				breakpoints: 'breakpoints',
				custom: 'custom value',
				config: './drizzle-kit.config.ts',
				flag: true,
				defFlag: true,
				defString: 'Not=Default=Value',
				debug: true,
			},
		});
	});

	it('Missing required options', async () => {
		const error = await runCli(getArgs('generate'));

		expect(error).toStrictEqual(
			new Error(`Command 'generate' is missing following required options: --dialect [-d, -dlc]`),
		);
	});

	it('Unrecognized options', async () => {
		const error = await runCli(getArgs('generate', '--dialect=pg', '--unknown-one', '-m'));

		expect(error).toStrictEqual(
			new Error(`Unrecognized options for command 'generate': --unknown-one, -m`),
		);
	});

	it('Wrong type: string to boolean', async () => {
		const error = await runCli(getArgs('generate', '--dialect=pg', '-def=somevalue'));

		expect(error).toStrictEqual(
			new Error(
				`Invalid syntax: boolean type argument '--defFlag' must not have a value, pass it in the following format: --defFlag`,
			),
		);
	});

	it('Wrong type: boolean to string', async () => {
		const error = await runCli(getArgs('generate', '--dialect=pg', '-ds'));

		expect(error).toStrictEqual(
			new Error(
				`Invalid syntax: string type argument '--defString' must have it's value passed in the following format: --defString=<value>`,
			),
		);
	});
});

describe('Command parsing tests', (it) => {
	it('Get the right command, no args', async () => {
		await runCli(getArgs('c-first'));

		expect(storage).toStrictEqual({
			command: 'c-first',
			options: {
				flag: undefined,
				string: undefined,
				sFlag: undefined,
				sString: undefined,
			},
		});
	});

	it('Get the right command, command before args', async () => {
		await runCli(getArgs('c-second', '--flag', '--string=strval', '--stealth', '--sstring=Hidden string'));

		expect(storage).toStrictEqual({
			command: 'c-second',
			options: {
				flag: true,
				string: 'strval',
				sFlag: true,
				sString: 'Hidden string',
			},
		});
	});

	it('Get the right command, command between args', async () => {
		await runCli(getArgs('--flag', '--string=strval', 'c-second', '--stealth', '--sstring=Hidden string'));

		expect(storage).toStrictEqual({
			command: 'c-second',
			options: {
				flag: true,
				string: 'strval',
				sFlag: true,
				sString: 'Hidden string',
			},
		});
	});

	it('Get the right command, command after args', async () => {
		await runCli(getArgs('--flag', '--string=strval', '--stealth', '--sstring=Hidden string', 'c-second'));

		expect(storage).toStrictEqual({
			command: 'c-second',
			options: {
				flag: true,
				string: 'strval',
				sFlag: true,
				sString: 'Hidden string',
			},
		});
	});

	it('Unknown command', async () => {
		const error = await runCli(getArgs('unknown', '--somearg=somevalue', '-f'));

		expect(error).toStrictEqual(
			new Error(`Unable to recognize any of the commands.\nUse 'help' command to list all commands.`),
		);
	});
});

describe('Option definition tests', (it) => {
	it('Duplicate names', async () => {
		expect(() =>
			defineOptions({
				opFirst: boolean('flag').alias('f', 'fl'),
				opSecond: boolean('flag').alias('-f2', 'fl2'),
			})
		).toThrowError();
	});

	it('Duplicate aliases', async () => {
		expect(() =>
			defineOptions({
				opFirst: boolean('flag').alias('f', 'fl'),
				opSecond: boolean('flag').alias('-f', 'fl'),
			})
		).toThrowError();
	});

	it('Name repeats alias', async () => {
		expect(() =>
			defineOptions({
				opFirst: boolean('flag').alias('f', 'fl'),
				opSecond: boolean('fl').alias('-f2', 'fl2'),
			})
		).toThrowError();
	});

	it('Alias repeats name', async () => {
		expect(() =>
			defineOptions({
				opFirst: boolean('flag').alias('f', 'fl'),
				opSecond: boolean('flag2').alias('flag', 'fl2'),
			})
		).toThrowError();
	});

	it('Duplicate names in same option', async () => {
		expect(() =>
			defineOptions({
				opFirst: boolean('flag').alias('flag', 'fl'),
				opSecond: boolean('flag2').alias('-f2', 'fl2'),
			})
		).toThrowError();
	});

	it('Duplicate aliases in same option', async () => {
		expect(() =>
			defineOptions({
				opFirst: boolean('flag').alias('fl', 'fl'),
				opSecond: boolean('flag2').alias('-f2', 'fl2'),
			})
		).toThrowError();
	});

	it('Forbidden character in name', async () => {
		expect(() =>
			defineOptions({
				opFirst: boolean('fl=ag').alias('f', 'fl'),
				opSecond: boolean('flag2').alias('-f2', 'fl2'),
			})
		).toThrowError();
	});

	it('Forbidden character in alias', async () => {
		expect(() =>
			defineOptions({
				opFirst: boolean('fl=ag').alias('f', 'f=l'),
				opSecond: boolean('flag2').alias('-f2', 'fl2'),
			})
		).toThrowError();
	});
});

describe('Command definition tests', (it) => {
	it('Duplicate names', async () => {
		expect(() =>
			defineCommand({
				name: 'c-first',
				handler: () => '',
			})
		).toThrowError();
	});

	it('Duplicate aliases', async () => {
		expect(() =>
			defineCommand({
				name: 'c-third',
				aliases: ['g'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Name repeats alias', async () => {
		expect(() =>
			defineCommand({
				name: 'gen',
				aliases: ['c4'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Alias repeats name', async () => {
		expect(() =>
			defineCommand({
				name: 'c-fifth',
				aliases: ['generate'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Duplicate names in same option', async () => {
		expect(() =>
			defineCommand({
				name: 'c-sixth',
				aliases: ['c-sixth', 'c6'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Duplicate aliases in same option', async () => {
		expect(() =>
			defineCommand({
				name: 'c-seventh',
				aliases: ['c7', 'c7', 'csvn'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden character in name', async () => {
		expect(() =>
			defineCommand({
				name: '--c-eigth',
				aliases: ['c8'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden character in alias', async () => {
		expect(() =>
			defineCommand({
				name: 'c-ninth',
				aliases: ['-c9'],
				handler: () => '',
			})
		).toThrowError();
	});
});

describe('Type tests', (it) => {
	const generateOps = defineOptions({
		dialect: string().alias('-d', '-dlc').desc('Database dialect [pg, mysql, sqlite]').required(),
		schema: string('schema').alias('s').desc('Path to a schema file or folder'),
		out: string().alias('o').desc("Output folder, 'drizzle' by default"),
		name: string().alias('n').desc('Migration file name'),
		breakpoints: string('breakpoints').alias('break').desc(`Prepare SQL statements with breakpoints`),
		custom: string('custom').alias('cus').desc('Prepare empty migration file for custom SQL'),
		config: string().alias('c', 'cfg').desc('Path to a config.json file, drizzle.config.ts by default').default(
			'./drizzle-kit.config.ts',
		),
		flag: boolean().alias('f').desc('Example boolean field'),
		defFlag: boolean().alias('-def').desc('Example boolean field with default').default(true),
		defString: string().alias('-ds').desc('Example string field with default').default('Defaultvalue'),
		debug: boolean('dbg').alias('g').hidden(),
	});

	it('Param type inferrence test', () => {
		type GenerateOptions = TypeOf<typeof generateOps>;

		type ExpectedType = {
			dialect: string;
			schema: string | undefined;
			out: string | undefined;
			name: string | undefined;
			breakpoints: string | undefined;
			custom: string | undefined;
			config: string;
			flag: boolean | undefined;
			defFlag: boolean;
			defString: string;
			debug: boolean | undefined;
		};

		expectTypeOf<GenerateOptions>().toEqualTypeOf<ExpectedType>();
	});
});
