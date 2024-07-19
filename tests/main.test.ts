import {
	boolean,
	type BroCliEventType,
	type Command,
	command,
	type EventHandler,
	EventType,
	handler,
	number,
	positional,
	run,
	string,
	type TypeOf,
} from '@/index';
import { shellArgs } from '@/util';
import { describe, expect, expectTypeOf, Mock, vi } from 'vitest';

const getArgs = (str: string) => [process.argv[0]!, process.argv[1]!, ...shellArgs(str)];

const eventMocks: Record<BroCliEventType, Mock<any, any>> = {
	commandHelp: vi.fn(),
	commandsCompositionErrEvent: vi.fn(),
	globalHelp: vi.fn(),
	missingArgsErr: vi.fn(),
	unknownCommandEvent: vi.fn(),
	unknownError: vi.fn(),
	unknownSubcommandEvent: vi.fn(),
	unrecognizedArgsErr: vi.fn(),
	validationError: vi.fn(),
	version: vi.fn(),
};

const hookMocks: Record<EventType, Mock<any, any>> = {
	before: vi.fn(),
	after: vi.fn(),
};

const hook = async (event: EventType, command: Command) => {
	if (event === 'before') await hookMocks.before(command);
	if (event === 'after') await hookMocks.after(command);
};

const testEventHandler: EventHandler = (event) => {
	eventMocks[event.type](event);

	return true;
};

const handlers = {
	generate: vi.fn(),
	cFirst: vi.fn(),
	cSecond: vi.fn(),
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

commands.push(command({
	name: 'generate',
	aliases: ['g', 'gen'],
	desc: 'Generate drizzle migrations',
	hidden: false,
	options: generateOps,
	handler: handlers.generate,
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
	handler: handlers.cFirst,
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
	handler: handlers.cSecond,
	hidden: false,
}));

describe('Parsing tests', (it) => {
	it('Required options & defaults', async () => {
		await run(commands, { argSource: getArgs('generate --dialect=pg') });

		expect(handlers.generate.mock.lastCall).toStrictEqual([{
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
		}]);
	});

	it('All options by name', async () => {
		await run(
			commands,
			{
				argSource: getArgs(
					'generate --dialect pg --schema=./schemapath.ts --out=./outfile.ts --name="Example migration" --breakpoints=breakpoints --custom="custom value" --flag --defFlag false --dbg=true',
				),
				eventHandler: testEventHandler,
			},
		);

		expect(handlers.generate.mock.lastCall).toStrictEqual([{
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
		}]);
	});

	it('All options by alias', async () => {
		await run(
			commands,
			{
				argSource: getArgs(
					'generate -dlc pg -s=./schemapath.ts -o=./outfile.ts -n="Example migration" --break=breakpoints --cus="custom value" -f -def false -ds=Not=Default=Value -g=true',
				),
				eventHandler: testEventHandler,
			},
		);

		expect(handlers.generate.mock.lastCall).toStrictEqual([{
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
		}]);
	});

	it('Missing required options', async () => {
		await expect(async () => await run(commands, { argSource: getArgs('generate') })).rejects.toThrowError(
			new Error(`Command 'generate' is missing following required options: --dialect [-d, -dlc]`),
		);
	});

	it('Unrecognized options', async () => {
		await expect(async () => await run(commands, { argSource: getArgs('generate --dialect=pg --unknown-one -m') }))
			.rejects
			.toThrowError(
				new Error(`Unrecognized options for command 'generate': --unknown-one`),
			);
	});

	it('Wrong type: string to boolean', async () => {
		await expect(async () => await run(commands, { argSource: getArgs('generate --dialect=pg -def=somevalue') }))
			.rejects
			.toThrowError(
				new Error(
					`Invalid syntax: boolean type argument '-def' must have it's value passed in the following formats: -def=<value> | -def <value> | -def.\nAllowed values: true, false, 0, 1`,
				),
			);
	});

	it('Wrong type: boolean to string', async () => {
		await expect(async () => await run(commands, { argSource: getArgs('generate --dialect=pg -ds') })).rejects
			.toThrowError(
				new Error(
					`Invalid syntax: string type argument '-ds' must have it's value passed in the following formats: -ds=<value> | -ds <value>`,
				),
			);
	});

	it('Positional in order', async () => {});

	it('Positional after flag', async () => {});

	it('Positional after flag set by "="', async () => {});

	it('Positional after valueless flag', async () => {});

	it('Positional after string', async () => {});

	it('Positional after string set by "="', async () => {});

	it('Transform', async () => {});

	it('Omit undefined keys', async () => {});

	it('Global --help', async () => {});

	it('Global -h', async () => {});

	it('Command --help', async () => {});

	it('Command -h', async () => {});

	it('--version', async () => {});

	it('-v', async () => {});

	it('Get the right command, no args', async () => {
		await run(commands, { argSource: getArgs('c-first'), eventHandler: testEventHandler });

		expect(handlers.cFirst.mock.lastCall).toStrictEqual([{
			flag: undefined,
			string: undefined,
			sFlag: undefined,
			sString: undefined,
		}]);
	});

	it('Get the right command, command before args', async () => {
		await run(commands, {
			argSource: getArgs('c-second --flag --string=strval --stealth --sstring="Hidden string"'),
		});

		expect(handlers.cSecond.mock.lastCall).toStrictEqual([{
			flag: true,
			string: 'strval',
			sFlag: true,
			sString: 'Hidden string',
		}]);
	});

	it('Get the right command, command between args', async () => {
		await run(commands, {
			argSource: getArgs('--flag --string=strval c-second --stealth --sstring="Hidden string"'),
		});

		expect(handlers.cSecond.mock.lastCall).toStrictEqual([{
			flag: true,
			string: 'strval',
			sFlag: true,
			sString: 'Hidden string',
		}]);
	});

	it('Get the right command, command after args', async () => {
		await run(commands, {
			argSource: getArgs('--flag --string=strval --stealth --sstring="Hidden string" c-second'),
		});

		expect(handlers.cSecond.mock.lastCall).toStrictEqual([{
			flag: true,
			string: 'strval',
			sFlag: true,
			sString: 'Hidden string',
		}]);
	});

	it('Unknown command', async () => {
		await expect(async () => await run(commands, { argSource: getArgs('unknown --somearg=somevalue -f') }))
			.rejects
			.toThrowError(
				new Error(`Unknown command: 'unknown'.\nType '--help' to get help on the cli.`),
			);
	});

	it('Get the right command, no args', async () => {
		await run(commands, { argSource: getArgs('c-first'), eventHandler: testEventHandler });

		expect(handlers.cFirst.mock.lastCall).toStrictEqual([{
			flag: undefined,
			string: undefined,
			sFlag: undefined,
			sString: undefined,
		}]);
	});

	it('Get the right subcommand, subcommand before args', async () => {
	});

	it('Get the right subcommand, subcommand between args', async () => {
	});

	it('Get the right subcommand, subcommand after args', async () => {
	});

	it('Positionals in subcommand', async () => {});

	it('Unknown subcommand', async () => {
	});

	it('Global help', async () => {});

	it('Command help', async () => {});

	it('Subcommand help', async () => {});

	it('Hooks work in order', async () => {});
});

describe('Option definition tests', (it) => {
	it('Duplicate names', () => {
		expect(() =>
			command({
				name: 'Name',
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
				name: 'Name',
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
				name: 'Name',
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
				name: 'Name',
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
				name: 'Name',
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
				name: 'Name',
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
				name: 'Name',
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
				name: 'Name',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('f', 'f=l'),
					opSecond: boolean('flag2').alias('-f2', 'fl2'),
				},
			})
		).toThrowError();
	});

	it('Positionals ignore old names', async () => {
		command({
			name: 'Name',
			handler: (opt) => '',
			options: {
				opFirst: boolean('flag').alias('f', 'fl'),
				opSecond: boolean('flag2').alias('-f2', 'fl2'),
				pos: positional('--flag'),
			},
		});
	});

	it('Positional names get ignored', async () => {
		command({
			name: 'Name',
			handler: (opt) => '',
			options: {
				pos: positional('--flag'),
				opFirst: boolean('flag').alias('f', 'fl'),
				opSecond: boolean('flag2').alias('-f2', 'fl2'),
			},
		});
	});

	it('Positional ignore name restrictions', async () => {
		command({
			name: 'Name',
			handler: (opt) => '',
			options: {
				pos: positional('--fl=ag--'),
			},
		});
	});
});

describe('Command definition tests', (it) => {
	it('Duplicate names', async () => {
		await expect(async () => {
			const cmd = command({
				name: 'c-first',
				handler: () => '',
			});

			await run([...commands, cmd], {
				eventHandler: testEventHandler,
			});
		}).rejects.toThrowError();
	});

	it('Duplicate aliases', async () => {
		await expect(async () => {
			const cmd = command({
				name: 'c-third',
				aliases: ['g'],
				handler: () => '',
			});

			await run([...commands, cmd]);
		}).rejects.toThrowError();
	});

	it('Name repeats alias', async () => {
		await expect(async () => {
			const cmd = command({
				name: 'gen',
				aliases: ['c4'],
				handler: () => '',
			});

			await run([...commands, cmd]);
		}).rejects.toThrowError();
	});

	it('Alias repeats name', async () => {
		await expect(async () => {
			const cmd = command({
				name: 'c-fifth',
				aliases: ['generate'],
				handler: () => '',
			});

			await run([...commands, cmd]);
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

		const localFn = vi.fn();

		const cmd = command({
			name: 'c-tenth',
			aliases: ['c10'],
			options: opts,
			handler: handler(opts, (options) => {
				localFn(options);
			}),
		});

		await run([cmd], {
			argSource: getArgs('c-tenth -f -j false --string=strval'),
			eventHandler: testEventHandler,
		});

		expect(localFn.mock.lastCall).toStrictEqual([{
			flag: true,
			string: 'strval',
			sFlag: false,
			sString: undefined,
		}]);
	});

	it('Optional handler with subcommands', async () => {
	});

	it('Error on no handler without subcommands', async () => {
	});

	it('Positionals with subcommands', async () => {
	});
});

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
		num: number('num'),
		pos: positional(),
		int: number('num').int(),
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
			num: number | undefined;
			pos: string | undefined;
			int: number | undefined;
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
			num: number | undefined;
			pos: string | undefined;
			int: number | undefined;
		};

		expectTypeOf<HandlerOpts>().toEqualTypeOf<ExpectedType>();
	});

	it('Transorm type mutation test', () => {});
	it('Async transorm type mutation test', () => {});
});
