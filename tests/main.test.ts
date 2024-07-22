import {
	boolean,
	BroCliError,
	BroCliEvent,
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
	console.warn(event);
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

const generate = command({
	name: 'generate',
	aliases: ['g', 'gen'],
	desc: 'Generate drizzle migrations',
	hidden: false,
	options: generateOps,
	handler: handlers.generate,
});

commands.push(generate);

const cFirstOps = {
	flag: boolean().alias('f', 'fl').desc('Boolean value'),
	string: string().alias('s', 'str').desc('String value'),
	sFlag: boolean('stealth').alias('j', 'hb').desc('Boolean value').hidden(),
	sString: string('sstring').alias('q', 'hs').desc('String value').hidden(),
};

const cFirst = command({
	name: 'c-first',
	options: cFirstOps,
	handler: handlers.cFirst,
	hidden: false,
});

commands.push(cFirst);

const cSecondOps = {
	flag: boolean().alias('f', 'fl').desc('Boolean value'),
	string: string().alias('s', 'str').desc('String value'),
	sFlag: boolean('stealth').alias('j', 'hb').desc('Boolean value').hidden(),
	sString: string('sstring').alias('q', 'hs').desc('String value').hidden(),
};

const cSecond = command({
	name: 'c-second',
	options: cSecondOps,
	handler: handlers.cSecond,
	hidden: false,
});

commands.push(cSecond);

describe('Parsing tests', (it) => {
	it('Required options & defaults', async () => {
		await run(commands, { argSource: getArgs('generate --dialect=pg'), eventHandler: testEventHandler });

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
		await run(commands, { argSource: getArgs('generate'), eventHandler: testEventHandler });

		expect(eventMocks.missingArgsErr.mock.lastCall).toStrictEqual([{
			type: 'missingArgsErr',
			command: generate,
			missing: [['--dialect', '-d', '-dlc']],
		}] as BroCliEvent[]);
	});

	it('Unrecognized options', async () => {
		await run(commands, {
			argSource: getArgs('generate --dialect=pg --unknown-one -m'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.unrecognizedArgsErr.mock.lastCall).toStrictEqual([{
			type: 'unrecognizedArgsErr',
			command: generate,
			unrecognized: ['--unknown-one'],
		}] as BroCliEvent[]);
	});

	it('Wrong type: string to boolean', async () => {
		await run(commands, {
			argSource: getArgs('generate --dialect=pg -def=somevalue'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.validationError.mock.lastCall).toStrictEqual([{
			type: 'validationError',
			violation: 'Invalid boolean syntax',
			command: generate,
			option: generate.options!['defFlag' as keyof typeof generate.options]!.config,
			offender: {
				namePart: '-def',
				dataPart: 'somevalue',
			},
		}] as BroCliEvent[]);
	});

	it('Wrong type: boolean to string', async () => {
		await run(commands, { argSource: getArgs('generate --dialect=pg -ds'), eventHandler: testEventHandler });

		expect(eventMocks.validationError.mock.lastCall).toStrictEqual([{
			type: 'validationError',
			violation: 'Invalid string syntax',
			command: generate,
			option: generate.options!['defString' as keyof typeof generate.options]!.config,
			offender: {
				namePart: '-ds',
				dataPart: undefined,
			},
		}] as BroCliEvent[]);
	});

	it('Wrong type: string to number', async () => {});

	it('Enum violation', async () => {});

	it('Positional enum violation', async () => {});

	it('Min value violation', async () => {});

	it('Max value violation', async () => {});

	it('Int violation', async () => {});

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

	it('Command --help, off position', async () => {});

	it('Command -h', async () => {});

	it('Command -h, off position', async () => {});

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
			eventHandler: testEventHandler,
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
			eventHandler: testEventHandler,
		});

		expect(handlers.cSecond.mock.lastCall).toStrictEqual([{
			flag: true,
			string: 'strval',
			sFlag: true,
			sString: 'Hidden string',
		}]);
	});

	it('Unknown command', async () => {
		await run(commands, { argSource: getArgs('unknown --somearg=somevalue -f'), eventHandler: testEventHandler });

		expect(eventMocks.unknownCommandEvent.mock.lastCall).toStrictEqual([{
			type: 'unknownCommandEvent',
			offender: 'unknown',
		}] as BroCliEvent[]);
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

	it('Unknown subcommand', async () => {});

	it('Global help', async () => {});

	it('Command help', async () => {});

	it('Subcommand help', async () => {});
});

describe('Option definition tests', (it) => {
	it('Duplicate names', () => {
		expect(() => {
			command({
				name: 'Name',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('f', 'fl'),
					opSecond: boolean('flag').alias('-f2', 'fl2'),
				},
			});
		}).toThrowError(new BroCliError(`Can't define option '--flag': name is already in use by option '--flag'!`));
	});

	it('Duplicate aliases', () => {
		expect(() =>
			command({
				name: 'Name',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('f', 'fl'),
					opSecond: boolean('flag2').alias('-f', 'fl'),
				},
			})
		).toThrowError(new BroCliError(`Can't define option '--flag2': alias '-f' is already in use by option '--flag'!`));
	});

	it('Name repeats alias', () => {
		expect(() =>
			command({
				name: 'Name',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('f', 'fl'),
					opSecond: boolean('fl').alias('-f2', 'fl2'),
				},
			})
		).toThrowError(new BroCliError(`Can't define option '--fl': name is already in use by option '--flag'!`));
	});

	it('Alias repeats name', () => {
		expect(() =>
			command({
				name: 'Name',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('f', 'fl'),
					opSecond: boolean('flag2').alias('flag', 'fl2'),
				},
			})
		).toThrowError(
			new BroCliError(`Can't define option '--flag2': alias '--flag' is already in use by option '--flag'!`),
		);
	});

	it('Duplicate names in same option', () => {
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

	it('Duplicate aliases in same option', () => {
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

	it('Forbidden character in name', () => {
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

	it('Forbidden character in alias', () => {
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

	it('Positionals ignore old names', () => {
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

	it('Positional names get ignored', () => {
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

	it('Positional ignore name restrictions', () => {
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
		const cmd = command({
			name: 'c-first',
			handler: () => '',
		});

		await run([...commands, cmd], {
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandsCompositionErrEvent.mock.lastCall).toStrictEqual([{
			type: 'commandsCompositionErrEvent',
			message: "BroCli error: Can't define command 'c-first': name is already in use by command 'c-first'!",
		}] as BroCliEvent[]);
	});

	it('Duplicate aliases', async () => {
		const cmd = command({
			name: 'c-third',
			aliases: ['g'],
			handler: () => '',
		});

		await run([...commands, cmd], {
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandsCompositionErrEvent.mock.lastCall).toStrictEqual([{
			type: 'commandsCompositionErrEvent',
			message: "BroCli error: Can't define command 'c-third': alias 'g' is already in use by command 'generate'!",
		}] as BroCliEvent[]);
	});

	it('Name repeats alias', async () => {
		const cmd = command({
			name: 'gen',
			aliases: ['c4'],
			handler: () => '',
		});

		await run([...commands, cmd], {
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandsCompositionErrEvent.mock.lastCall).toStrictEqual([{
			type: 'commandsCompositionErrEvent',
			message: "BroCli error: Can't define command 'gen': name is already in use by command 'generate'!",
		}] as BroCliEvent[]);
	});

	it('Alias repeats name', async () => {
		const cmd = command({
			name: 'c-fifth',
			aliases: ['generate'],
			handler: () => '',
		});

		await run([...commands, cmd], {
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandsCompositionErrEvent.mock.lastCall).toStrictEqual([{
			type: 'commandsCompositionErrEvent',
			message:
				"BroCli error: Can't define command 'c-fifth': alias 'generate' is already in use by command 'generate'!",
		}] as BroCliEvent[]);
	});

	it('Duplicate names in same command', () => {
		expect(() =>
			command({
				name: 'c-sixth',
				aliases: ['c-sixth', 'c6'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Duplicate aliases in same command', () => {
		expect(() =>
			command({
				name: 'c-seventh',
				aliases: ['c7', 'c7', 'csvn'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden character in name', () => {
		expect(() =>
			command({
				name: '--c-eigth',
				aliases: ['c8'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden character in alias', () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['-c9'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden name - true', () => {
		expect(() =>
			command({
				name: 'tRue',
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden name - false', () => {
		expect(() =>
			command({
				name: 'FALSE',
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden name - 1', () => {
		expect(() =>
			command({
				name: '1',
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden name - 0', () => {
		expect(() =>
			command({
				name: '0',
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden alias - true', () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['trUe'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden alias - false', () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['FalSe'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden alias - 1', () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['1'],
				handler: () => '',
			})
		).toThrowError();
	});

	it('Forbidden alias - 0', () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['0'],
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

describe('Config options tests', (it) => {
	it('Omit undefined keys: true', async () => {});

	it('Omit undefined keys: false', async () => {});

	it('Custom gloabl help is called', async () => {});

	it('Custom version is called', async () => {});
});

describe('Hook tests', (it) => {
	it('Before', async () => {});

	it('After', async () => {});

	it('Before & after', async () => {});
});

describe('Default event handler correct behaviour tests', (it) => {
	it('Global --help', async () => {});

	it('Global -h', async () => {});

	it('Command --help', async () => {});

	it('Command -h', async () => {});

	it('Global help', async () => {});

	it('Command help', async () => {});

	it('--version', async () => {});

	it('-v', async () => {});
});

describe('Test function string to args convertion tests', (it) => {
	it('Empty string', async () => {});

	it('Regular format', async () => {});

	it('With quotes', async () => {});

	it('With quotes and spaces', async () => {});

	it('With quotes and spaces, multiline', async () => {});

	it('Empty multiline', async () => {});

	it('Multiline', async () => {});
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
