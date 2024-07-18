import { run as runCli } from '@/command-core';
import { boolean, type Command, command, handler, string, type TypeOf } from '@/index';
import { beforeEach, describe, expect, expectTypeOf } from 'vitest';

const getArgs = (...args: string[]) => [
	process.argv[0]!, // executing application path
	process.argv[1]!, // executed file path
	...args,
];

const storage = {
	options: {} as Record<string, any>,
	command: undefined as string | undefined,
};

const commands: Command[] = [];

const generateOps = {
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
};

const generateHandler = async (options: TypeOf<typeof generateOps>) => {
	storage.options = options;
	storage.command = 'generate';
};

commands.push(command({
	name: 'generate',
	aliases: ['g', 'gen'],
	desc: 'Generate drizzle migrations',
	hidden: false,
	options: generateOps,
	handler: generateHandler,
}));

const cFirstOps = {
	flag: boolean().alias('f', 'fl').desc('Boolean value'),
	string: string().alias('s', 'str').desc('String value'),
	sFlag: boolean('stealth').alias('j', 'hb').desc('Boolean value').hidden(),
	sString: string('sstring').alias('q', 'hs').desc('String value').hidden(),
};

commands.push(command({
	name: 'c-first',
	options: cFirstOps,
	handler: async (options) => {
		storage.options = options;
		storage.command = 'c-first';
	},
	hidden: false,
}));

const cSecondOps = {
	flag: boolean().alias('f', 'fl').desc('Boolean value'),
	string: string().alias('s', 'str').desc('String value'),
	sFlag: boolean('stealth').alias('j', 'hb').desc('Boolean value').hidden(),
	sString: string('sstring').alias('q', 'hs').desc('String value').hidden(),
};

commands.push(command({
	name: 'c-second',
	options: cSecondOps,
	handler: (options) => {
		storage.options = options;
		storage.command = 'c-second';
	},
	hidden: false,
}));

beforeEach(() => {
	storage.options = {};
	storage.command = undefined;
});

describe('Option parsing tests', (it) => {
	it('Required options & defaults', async () => {
		await runCli(commands, { argSource: getArgs('generate', '--dialect=pg') });

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
			commands,
			{
				argSource: getArgs(
					'generate',
					'--dialect',
					'pg',
					'--schema=./schemapath.ts',
					'--out=./outfile.ts',
					'--name=Example migration',
					'--breakpoints=breakpoints',
					'--custom=custom value',
					'--flag',
					'--defFlag',
					'false',
					'--dbg=true',
				),
			},
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
				defFlag: false,
				defString: 'Defaultvalue',
				debug: true,
			},
		});
	});

	it('All options by alias', async () => {
		await runCli(
			commands,
			{
				argSource: getArgs(
					'generate',
					'-dlc',
					'pg',
					'-s=./schemapath.ts',
					'-o=./outfile.ts',
					'-n=Example migration',
					'--break=breakpoints',
					'--cus=custom value',
					'-f',
					'-def',
					'false',
					'-ds=Not=Default=Value',
					'-g=true',
				),
			},
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
				defFlag: false,
				defString: 'Not=Default=Value',
				debug: true,
			},
		});
	});

	it('Missing required options', async () => {
		await expect(async () => await runCli(commands, { argSource: getArgs('generate') })).rejects.toThrowError(
			new Error(`Command 'generate' is missing following required options: --dialect [-d, -dlc]`),
		);
	});

	it('Unrecognized options', async () => {
		await expect(async () =>
			await runCli(commands, { argSource: getArgs('generate', '--dialect=pg', '--unknown-one', '-m') })
		)
			.rejects
			.toThrowError(
				new Error(`Unrecognized options for command 'generate': --unknown-one`),
			);
	});

	it('Wrong type: string to boolean', async () => {
		await expect(async () =>
			await runCli(commands, { argSource: getArgs('generate', '--dialect=pg', '-def=somevalue') })
		)
			.rejects
			.toThrowError(
				new Error(
					`Invalid syntax: boolean type argument '-def' must have it's value passed in the following formats: -def=<value> | -def <value> | -def.\nAllowed values: true, false, 0, 1`,
				),
			);
	});

	it('Wrong type: boolean to string', async () => {
		await expect(async () => await runCli(commands, { argSource: getArgs('generate', '--dialect=pg', '-ds') })).rejects
			.toThrowError(
				new Error(
					`Invalid syntax: string type argument '-ds' must have it's value passed in the following formats: -ds=<value> | -ds <value>`,
				),
			);
	});
});

describe('Command parsing tests', (it) => {
	it('Get the right command, no args', async () => {
		await runCli(commands, { argSource: getArgs('c-first') });

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
		await runCli(commands, {
			argSource: getArgs('c-second', '--flag', '--string=strval', '--stealth', '--sstring=Hidden string'),
		});

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
		await runCli(commands, {
			argSource: getArgs('--flag', '--string=strval', 'c-second', '--stealth', '--sstring=Hidden string'),
		});

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
		await runCli(commands, {
			argSource: getArgs('--flag', '--string=strval', '--stealth', '--sstring=Hidden string', 'c-second'),
		});

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
		await expect(async () => await runCli(commands, { argSource: getArgs('unknown', '--somearg=somevalue', '-f') }))
			.rejects
			.toThrowError(
				new Error(`Unknown command: 'unknown'.\nType '--help' to get help on the cli.`),
			);
	});
});

describe('Option definition tests', (it) => {
	it('Duplicate names', async () => {
		expect(() =>
			command({
				name: '',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('f', 'fl'),
					opSecond: boolean('flag').alias('-f2', 'fl2'),
				},
			})
		).toThrowError();
	});

	it('Duplicate aliases', async () => {
		expect(() =>
			command({
				name: '',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('f', 'fl'),
					opSecond: boolean('flag').alias('-f', 'fl'),
				},
			})
		).toThrowError();
	});

	it('Name repeats alias', async () => {
		expect(() =>
			command({
				name: '',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('f', 'fl'),
					opSecond: boolean('fl').alias('-f2', 'fl2'),
				},
			})
		).toThrowError();
	});

	it('Alias repeats name', async () => {
		expect(() =>
			command({
				name: '',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('f', 'fl'),
					opSecond: boolean('flag2').alias('flag', 'fl2'),
				},
			})
		).toThrowError();
	});

	it('Duplicate names in same option', async () => {
		expect(() =>
			command({
				name: '',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('flag', 'fl'),
					opSecond: boolean('flag2').alias('-f2', 'fl2'),
				},
			})
		).toThrowError();
	});

	it('Duplicate aliases in same option', async () => {
		expect(() =>
			command({
				name: '',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('fl', 'fl'),
					opSecond: boolean('flag2').alias('-f2', 'fl2'),
				},
			})
		).toThrowError();
	});

	it('Forbidden character in name', async () => {
		expect(() =>
			command({
				name: '',
				handler: (opt) => '',
				options: {
					opFirst: boolean('fl=ag').alias('f', 'fl'),
					opSecond: boolean('flag2').alias('-f2', 'fl2'),
				},
			})
		).toThrowError();
	});

	it('Forbidden character in alias', async () => {
		expect(() =>
			command({
				name: '',
				handler: (opt) => '',
				options: {
					opFirst: boolean('fl=ag').alias('f', 'f=l'),
					opSecond: boolean('flag2').alias('-f2', 'fl2'),
				},
			})
		).toThrowError();
	});
});

describe('Command definition tests', (it) => {
	it('Duplicate names', async () => {
		await expect(async () => {
			const cmd = command({
				name: 'c-first',
				handler: () => '',
			});

			await runCli([...commands, cmd]);
		}).rejects.toThrowError();
	});

	it('Duplicate aliases', async () => {
		await expect(async () => {
			const cmd = command({
				name: 'c-third',
				aliases: ['g'],
				handler: () => '',
			});

			await runCli([...commands, cmd]);
		}).rejects.toThrowError();
	});

	it('Name repeats alias', async () => {
		await expect(async () => {
			const cmd = command({
				name: 'gen',
				aliases: ['c4'],
				handler: () => '',
			});

			await runCli([...commands, cmd]);
		}).rejects.toThrowError();
	});

	it('Alias repeats name', async () => {
		await expect(async () => {
			const cmd = command({
				name: 'c-fifth',
				aliases: ['generate'],
				handler: () => '',
			});

			await runCli([...commands, cmd]);
		}).rejects.toThrowError();
	});

	it('Duplicate names in same command', async () => {
		expect(() =>
			command({
				name: 'c-sixth',
				aliases: ['c-sixth', 'c6'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Duplicate aliases in same command', async () => {
		expect(() =>
			command({
				name: 'c-seventh',
				aliases: ['c7', 'c7', 'csvn'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden character in name', async () => {
		expect(() =>
			command({
				name: '--c-eigth',
				aliases: ['c8'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden character in alias', async () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['-c9'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Using handler function', async () => {
		const opts = {
			flag: boolean().alias('f', 'fl').desc('Boolean value'),
			string: string().alias('s', 'str').desc('String value'),
			sFlag: boolean('stealth').alias('j', 'hb').desc('Boolean value').hidden(),
			sString: string('sstring').alias('q', 'hs').desc('String value').hidden(),
		};

		const cmd = command({
			name: 'c-tenth',
			aliases: ['c10'],
			options: opts,
			handler: handler(opts, (options) => {
				storage.command = 'c-tenth';
				storage.options = options;
			}),
		});

		await runCli([cmd], {
			argSource: getArgs('c-tenth', '-f', '-j', 'false', '--string=strval'),
		});

		expect(storage).toStrictEqual({
			command: 'c-tenth',
			options: {
				flag: true,
				sFlag: false,
				string: 'strval',
				sString: undefined,
			},
		});
	});
});

// to-do
// describe('Custom handler tests', (it) => {
// 	const customHelp = vi.fn;
// 	const customCmdHelp = vi.fn;
// 	const customVersion = vi.fn;

// 	it('Help', () => {
// 	});

// 	it('Command help', () => {
// 	});

// 	it('Version', () => {
// 		runCli(commands);
// 	});
// });

describe('Type tests', (it) => {
	const generateOps = {
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
	};

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

	it("'handler' function type inferrence test", () => {
		const hdl = handler(generateOps, () => '');

		type HandlerOpts = typeof hdl extends (options: infer Options) => any ? Options : never;

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

		expectTypeOf<HandlerOpts>().toEqualTypeOf<ExpectedType>();
	});
});
