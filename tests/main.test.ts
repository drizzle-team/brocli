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

const testEventHandler: EventHandler = (event) => {
	eventMocks[event.type](event);

	return true;
};

const handlers = {
	generate: vi.fn(),
	cFirst: vi.fn(),
	cSecond: vi.fn(),
	sub: vi.fn(),
	deep: vi.fn(),
};

const commands: Command[] = [];

const generateOps = {
	dialect: string().alias('-d', '-dlc').enum('pg', 'sqlite', 'mysql').desc('Database dialect [pg, mysql, sqlite]')
		.required(),
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
	num: number().alias('-nb').min(-10).max(10),
	int: number().alias('i').int(),
	pos: positional('Positional'),
	enpos: positional('Enum positional').enum('first', 'second', 'third'),
};

const generate = command({
	name: 'generate',
	aliases: ['g', 'gen'],
	desc: 'Generate drizzle migrations',
	shortDesc: 'Generate migrations',
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

const cSubOps = {
	flag: boolean().alias('f', 'fl').desc('Boolean value'),
	string: string().alias('s', 'str').desc('String value'),
	pos: positional(),
};

const cFirst = command({
	name: 'c-first',
	options: cFirstOps,
	handler: handlers.cFirst,
	hidden: false,
	subcommands: [
		command({
			name: 'sub',
			options: cSubOps,
			handler: handlers.sub,
		}),
		command({
			name: 'nohandler',
			subcommands: [command({
				name: 'deep',
				handler: handlers.deep,
			})],
		}),
	],
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
			num: undefined,
			int: undefined,
			pos: undefined,
			enpos: undefined,
		}]);
	});

	it('All options by name', async () => {
		await run(
			commands,
			{
				argSource: getArgs(
					'generate --dialect pg --schema=./schemapath.ts --out=./outfile.ts --name="Example migration" --breakpoints=breakpoints --custom="custom value" --flag --defFlag false --dbg=true --num 5.5 --int=2 posval second',
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
			num: 5.5,
			int: 2,
			pos: 'posval',
			enpos: 'second',
		}]);
	});

	it('All options by alias', async () => {
		await run(
			commands,
			{
				argSource: getArgs(
					'generate -dlc pg -s=./schemapath.ts -o=./outfile.ts -n="Example migration" --break=breakpoints --cus="custom value" -f -def false -ds=Not=Default=Value -g=true -nb=5.5 -i=2 posval second',
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
			num: 5.5,
			int: 2,
			pos: 'posval',
			enpos: 'second',
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
			option: generate.options!['defFlag']!.config,
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
			option: generate.options!['defString']!.config,
			offender: {
				namePart: '-ds',
				dataPart: undefined,
			},
		}] as BroCliEvent[]);
	});

	it('Wrong type: string to number', async () => {
		await run(commands, { argSource: getArgs('generate --dialect=pg -nb string'), eventHandler: testEventHandler });

		expect(eventMocks.validationError.mock.lastCall).toStrictEqual([{
			type: 'validationError',
			violation: 'Invalid number value',
			command: generate,
			option: generate.options!['num']!.config,
			offender: {
				namePart: '-nb',
				dataPart: 'string',
			},
		}] as BroCliEvent[]);
	});

	it('Enum violation', async () => {
		await run(commands, { argSource: getArgs('generate --dialect=wrong'), eventHandler: testEventHandler });

		expect(eventMocks.validationError.mock.lastCall).toStrictEqual([{
			type: 'validationError',
			violation: 'Enum violation',
			command: generate,
			option: generate.options!['dialect']!.config,
			offender: {
				namePart: '--dialect',
				dataPart: 'wrong',
			},
		}] as BroCliEvent[]);
	});

	it('Positional enum violation', async () => {
		await run(commands, {
			argSource: getArgs('generate --dialect=pg someval wrongval'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.validationError.mock.lastCall).toStrictEqual([{
			type: 'validationError',
			violation: 'Enum violation',
			command: generate,
			option: generate.options!['enpos']!.config,
			offender: {
				dataPart: 'wrongval',
			},
		}] as BroCliEvent[]);
	});

	it('Min value violation', async () => {
		await run(commands, {
			argSource: getArgs('generate --dialect=pg -nb -20'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.validationError.mock.lastCall).toStrictEqual([{
			type: 'validationError',
			violation: 'Below min',
			command: generate,
			option: generate.options!['num']!.config,
			offender: {
				namePart: '-nb',
				dataPart: '-20',
			},
		}] as BroCliEvent[]);
	});

	it('Max value violation', async () => {
		await run(commands, {
			argSource: getArgs('generate --dialect=pg -nb 20'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.validationError.mock.lastCall).toStrictEqual([{
			type: 'validationError',
			violation: 'Above max',
			command: generate,
			option: generate.options!['num']!.config,
			offender: {
				namePart: '-nb',
				dataPart: '20',
			},
		}] as BroCliEvent[]);
	});

	it('Int violation', async () => {
		await run(commands, {
			argSource: getArgs('generate --dialect=pg -i 20.5'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.validationError.mock.lastCall).toStrictEqual([{
			type: 'validationError',
			violation: 'Expected int',
			command: generate,
			option: generate.options!['int']!.config,
			offender: {
				namePart: '-i',
				dataPart: '20.5',
			},
		}] as BroCliEvent[]);
	});

	it('Positional in order', async () => {
		await run(commands, {
			argSource: getArgs('generate posval --dialect=pg'),
			eventHandler: testEventHandler,
		});

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
			num: undefined,
			int: undefined,
			pos: 'posval',
			enpos: undefined,
		}]);
	});

	it('Positional after flag', async () => {
		await run(commands, {
			argSource: getArgs('generate -f true posval --dialect=pg'),
			eventHandler: testEventHandler,
		});

		expect(handlers.generate.mock.lastCall).toStrictEqual([{
			dialect: 'pg',
			schema: undefined,
			out: undefined,
			name: undefined,
			breakpoints: undefined,
			custom: undefined,
			config: './drizzle-kit.config.ts',
			flag: true,
			defFlag: true,
			defString: 'Defaultvalue',
			debug: undefined,
			num: undefined,
			int: undefined,
			pos: 'posval',
			enpos: undefined,
		}]);
	});

	it('Positional after flag set by "="', async () => {
		await run(commands, {
			argSource: getArgs('generate -f=true posval --dialect=pg'),
			eventHandler: testEventHandler,
		});

		expect(handlers.generate.mock.lastCall).toStrictEqual([{
			dialect: 'pg',
			schema: undefined,
			out: undefined,
			name: undefined,
			breakpoints: undefined,
			custom: undefined,
			config: './drizzle-kit.config.ts',
			flag: true,
			defFlag: true,
			defString: 'Defaultvalue',
			debug: undefined,
			num: undefined,
			int: undefined,
			pos: 'posval',
			enpos: undefined,
		}]);
	});

	it('Positional after valueless flag', async () => {
		await run(commands, {
			argSource: getArgs('generate -f posval --dialect=pg'),
			eventHandler: testEventHandler,
		});

		expect(handlers.generate.mock.lastCall).toStrictEqual([{
			dialect: 'pg',
			schema: undefined,
			out: undefined,
			name: undefined,
			breakpoints: undefined,
			custom: undefined,
			config: './drizzle-kit.config.ts',
			flag: true,
			defFlag: true,
			defString: 'Defaultvalue',
			debug: undefined,
			num: undefined,
			int: undefined,
			pos: 'posval',
			enpos: undefined,
		}]);
	});

	it('Positional after string', async () => {
		await run(commands, {
			argSource: getArgs('generate --dialect pg posval'),
			eventHandler: testEventHandler,
		});

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
			num: undefined,
			int: undefined,
			pos: 'posval',
			enpos: undefined,
		}]);
	});

	it('Positional after string set by "="', async () => {
		await run(commands, {
			argSource: getArgs('generate --dialect=pg posval'),
			eventHandler: testEventHandler,
		});

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
			num: undefined,
			int: undefined,
			pos: 'posval',
			enpos: undefined,
		}]);
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
		await run(commands, { argSource: getArgs('c-first sub -f posval -s=str '), eventHandler: testEventHandler });

		expect(handlers.sub.mock.lastCall).toStrictEqual([{
			flag: true,
			string: 'str',
			pos: 'posval',
		}]);
	});

	it('Get the right subcommand, subcommand between args', async () => {
		await run(commands, { argSource: getArgs('c-first -f true sub posval2 -s=str '), eventHandler: testEventHandler });

		expect(handlers.sub.mock.lastCall).toStrictEqual([{
			flag: true,
			string: 'str',
			pos: 'posval2',
		}]);
	});

	it('Get the right subcommand, subcommand after args', async () => {
		await run(commands, { argSource: getArgs('c-first -f posval3 -s=str sub'), eventHandler: testEventHandler });

		expect(handlers.sub.mock.lastCall).toStrictEqual([{
			flag: true,
			string: 'str',
			pos: 'posval3',
		}]);
	});

	it('Get the right deep subcommand', async () => {
		await run(commands, { argSource: getArgs('c-first nohandler deep'), eventHandler: testEventHandler });

		expect(handlers.deep.mock.lastCall).toStrictEqual([undefined]);
	});

	it('Positionals in subcommand', async () => {
		await run(commands, { argSource: getArgs('c-first -f posval3 -s=str sub'), eventHandler: testEventHandler });

		expect(handlers.sub.mock.lastCall).toStrictEqual([{
			flag: true,
			string: 'str',
			pos: 'posval3',
		}]);
	});

	it('Unknown subcommand', async () => {
		await run(commands, { argSource: getArgs('c-first unrecognized'), eventHandler: testEventHandler });

		expect(eventMocks.unknownSubcommandEvent.mock.lastCall).toStrictEqual([{
			type: 'unknownSubcommandEvent',
			offender: 'unrecognized',
			command: cFirst,
		}] as BroCliEvent[]);
	});

	it('Transform', async () => {
		const transformFn = vi.fn();
		const handlerFn = vi.fn();

		const cmd = command({
			name: 'generate',
			options: generateOps,
			transform: async (opts) => {
				transformFn(opts);

				return 'transformed';
			},
			handler: handlerFn,
		});

		await run([cmd], { argSource: getArgs('generate --dialect=pg'), eventHandler: testEventHandler });

		expect(transformFn.mock.lastCall).toStrictEqual([{
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
			num: undefined,
			int: undefined,
			pos: undefined,
			enpos: undefined,
		}]);

		expect(handlerFn.mock.lastCall).toStrictEqual(['transformed']);
	});

	it('Omit undefined keys', async () => {
		await run(commands, {
			argSource: getArgs('generate --dialect=pg'),
			eventHandler: testEventHandler,
			omitKeysOfUndefinedOptions: true,
		});

		expect(handlers.generate.mock.lastCall).toStrictEqual([{
			dialect: 'pg',
			config: './drizzle-kit.config.ts',
			defFlag: true,
			defString: 'Defaultvalue',
		}]);
	});

	it('Global --help', async () => {
		await run(commands, {
			argSource: getArgs('--help'),
			eventHandler: testEventHandler,
			help: 'help1',
		});

		expect(eventMocks.globalHelp.mock.calls.length).toStrictEqual(1);
		expect(eventMocks.globalHelp.mock.lastCall).toStrictEqual([{
			type: 'globalHelp',
			commands: commands,
			help: 'help1',
		}] as BroCliEvent[]);
	});

	it('Global -h', async () => {
		await run(commands, {
			argSource: getArgs('--someothergarbage=there -h --somegarbage here'),
			eventHandler: testEventHandler,
			help: 'help2',
		});

		expect(eventMocks.globalHelp.mock.calls.length).toStrictEqual(2);
		expect(eventMocks.globalHelp.mock.lastCall).toStrictEqual([{
			type: 'globalHelp',
			commands: commands,
			help: 'help2',
		}] as BroCliEvent[]);
	});

	it('Command --help', async () => {
		await run(commands, {
			argSource: getArgs('generate --help'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandHelp.mock.calls.length).toStrictEqual(1);
		expect(eventMocks.commandHelp.mock.lastCall).toStrictEqual([{
			type: 'commandHelp',
			command: generate,
		}] as BroCliEvent[]);
	});

	it('Subcommand --help', async () => {
		await run(commands, {
			argSource: getArgs('c-first sub --help'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandHelp.mock.calls.length).toStrictEqual(2);
		expect(eventMocks.commandHelp.mock.lastCall).toStrictEqual([{
			type: 'commandHelp',
			command: cFirst.subcommands![0],
		}] as BroCliEvent[]);
	});

	it('Command --help, off position', async () => {
		await run(commands, {
			argSource: getArgs('generate sometrash --flag --help sometrash '),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandHelp.mock.calls.length).toStrictEqual(3);
		expect(eventMocks.commandHelp.mock.lastCall).toStrictEqual([{
			type: 'commandHelp',
			command: generate,
		}] as BroCliEvent[]);
	});

	it('Command -h', async () => {
		await run(commands, {
			argSource: getArgs('generate -h'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandHelp.mock.calls.length).toStrictEqual(4);
		expect(eventMocks.commandHelp.mock.lastCall).toStrictEqual([{
			type: 'commandHelp',
			command: generate,
		}] as BroCliEvent[]);
	});

	it('Command -h, off position', async () => {
		await run(commands, {
			argSource: getArgs('generate sometrash --flag -h sometrash '),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandHelp.mock.calls.length).toStrictEqual(5);
		expect(eventMocks.commandHelp.mock.lastCall).toStrictEqual([{
			type: 'commandHelp',
			command: generate,
		}] as BroCliEvent[]);
	});

	it('Global help', async () => {
		await run(commands, {
			argSource: getArgs('help'),
			eventHandler: testEventHandler,
			help: 'dashless1',
		});

		expect(eventMocks.globalHelp.mock.calls.length).toStrictEqual(3);
		expect(eventMocks.globalHelp.mock.lastCall).toStrictEqual([{
			type: 'globalHelp',
			commands: commands,
			help: 'dashless1',
		}] as BroCliEvent[]);
	});

	it('Command help', async () => {
		await run(commands, {
			argSource: getArgs('help generate'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandHelp.mock.calls.length).toStrictEqual(6);
		expect(eventMocks.commandHelp.mock.lastCall).toStrictEqual([{
			type: 'commandHelp',
			command: generate,
		}] as BroCliEvent[]);
	});

	it('Subcommand help', async () => {
		await run(commands, {
			argSource: getArgs('help c-first sub'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandHelp.mock.calls.length).toStrictEqual(7);
		expect(eventMocks.commandHelp.mock.lastCall).toStrictEqual([{
			type: 'commandHelp',
			command: cFirst.subcommands![0]!,
		}] as BroCliEvent[]);
	});

	it('Handlerless subcommand help', async () => {
		await run(commands, {
			argSource: getArgs('help c-first nohandler'),
			eventHandler: testEventHandler,
		});

		expect(eventMocks.commandHelp.mock.calls.length).toStrictEqual(8);
		expect(eventMocks.commandHelp.mock.lastCall).toStrictEqual([{
			type: 'commandHelp',
			command: cFirst.subcommands![1]!,
		}] as BroCliEvent[]);
	});

	it('--version', async () => {
		await run(commands, {
			argSource: getArgs('--version'),
			eventHandler: testEventHandler,
			version: 'test',
		});

		expect(eventMocks.version.mock.calls.length).toStrictEqual(1);
		expect(eventMocks.version.mock.lastCall).toStrictEqual([{
			type: 'version',
			version: 'test',
		}] as BroCliEvent[]);
	});

	it('-v', async () => {
		await run(commands, {
			argSource: getArgs('-v'),
			eventHandler: testEventHandler,
			version: 'test2.0',
		});

		expect(eventMocks.version.mock.calls.length).toStrictEqual(2);
		expect(eventMocks.version.mock.lastCall).toStrictEqual([{
			type: 'version',
			version: 'test2.0',
		}] as BroCliEvent[]);
	});
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
		}).toThrowError(new BroCliError(`Can't define option '--flag' - name is already in use by option '--flag'!`));
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
		).toThrowError(new BroCliError(`Can't define option '--flag2' - alias '-f' is already in use by option '--flag'!`));
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
		).toThrowError(new BroCliError(`Can't define option '--fl' - name is already in use by option '--flag'!`));
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
			new BroCliError(`Can't define option '--flag2' - alias '--flag' is already in use by option '--flag'!`),
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
		).toThrowError(
			new BroCliError(`Can't define option '--flag' - duplicate alias '--flag'!`),
		);
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
		).toThrowError(
			new BroCliError(`Can't define option '--flag' - duplicate alias '--fl'!`),
		);
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
		).toThrowError(new BroCliError(`Can't define option '--fl=ag' - option names and aliases cannot contain '='!`));
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
		).toThrowError(new BroCliError(`Can't define option '--flag' - option names and aliases cannot contain '='!`));
	});

	it('Reserved names: --help', () => {
		expect(() =>
			command({
				name: 'Name',
				handler: (opt) => '',
				options: {
					opFirst: boolean('help').alias('f', 'fl'),
					opSecond: boolean('flag2').alias('-f2', 'fl2'),
				},
			})
		).toThrowError(new BroCliError(`Can't define option '--help' - name '--help' is reserved!`));
	});

	it('Reserved names: -h', () => {
		expect(() =>
			command({
				name: 'Name',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('h', 'fl'),
					opSecond: boolean('flag2').alias('-f2', 'fl2'),
				},
			})
		).toThrowError(new BroCliError(`Can't define option '--flag' - name '-h' is reserved!`));
	});

	it('Reserved names: --version', () => {
		expect(() =>
			command({
				name: 'Name',
				handler: (opt) => '',
				options: {
					opFirst: boolean('flag').alias('version', 'fl'),
					opSecond: boolean('flag2').alias('-f2', 'fl2'),
				},
			})
		).toThrowError(new BroCliError(`Can't define option '--flag' - name '--version' is reserved!`));
	});

	it('Reserved names: -v', () => {
		expect(() =>
			command({
				name: 'Name',
				handler: (opt) => '',
				options: {
					opFirst: boolean('v').alias('h', 'fl'),
					opSecond: boolean('flag2').alias('-f2', 'fl2'),
				},
			})
		).toThrowError(new BroCliError(`Can't define option '-v' - name '-v' is reserved!`));
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
		).toThrowError(new BroCliError(`Can't define command 'c-sixth' - duplicate alias 'c-sixth'!`));
	});

	it('Duplicate aliases in same command', () => {
		expect(() =>
			command({
				name: 'c-seventh',
				aliases: ['c7', 'c7', 'csvn'],
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command 'c-seventh' - duplicate alias 'c7'!`));
	});

	it('Forbidden character in name', () => {
		expect(() =>
			command({
				name: '--c-eigth',
				aliases: ['c8'],
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command '--c-eigth' - command name can't start with '-'!`));
	});

	it('Forbidden character in alias', () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['-c9'],
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command 'c-ninth' - command aliases can't start with '-'!`));
	});

	it('Forbidden name - true', () => {
		expect(() =>
			command({
				name: 'tRue',
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command 'tRue' - 'tRue' is a reserved for boolean values name!`));
	});

	it('Forbidden name - false', () => {
		expect(() =>
			command({
				name: 'FALSE',
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command 'FALSE' - 'FALSE' is a reserved for boolean values name!`));
	});

	it('Forbidden name - 1', () => {
		expect(() =>
			command({
				name: '1',
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command '1' - '1' is a reserved for boolean values name!`));
	});

	it('Forbidden name - 0', () => {
		expect(() =>
			command({
				name: '0',
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command '0' - '0' is a reserved for boolean values name!`));
	});

	it('Forbidden alias - true', () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['trUe'],
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command 'c-ninth' - 'trUe' is a reserved for boolean values name!`));
	});

	it('Forbidden alias - false', () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['FalSe'],
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command 'c-ninth' - 'FalSe' is a reserved for boolean values name!`));
	});

	it('Forbidden alias - 1', () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['1'],
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command 'c-ninth' - '1' is a reserved for boolean values name!`));
	});

	it('Forbidden alias - 0', () => {
		expect(() =>
			command({
				name: 'c-ninth',
				aliases: ['0'],
				handler: () => '',
			})
		).toThrowError(new BroCliError(`Can't define command 'c-ninth' - '0' is a reserved for boolean values name!`));
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
		command({
			name: 'nohandler',
			subcommands: [command({
				name: 'deep',
				handler: handlers.deep,
			})],
		});
	});

	it('Error on no handler without subcommands', async () => {
		expect(() =>
			command({
				name: 'nohandler',
			})
		).toThrowError(
			new BroCliError(`Can't define command 'nohandler' - command without subcommands must have a handler present!`),
		);
	});

	it('Error on positionals with subcommands', async () => {
		expect(() =>
			command({
				name: 'nohandler',
				options: {
					pos: positional(),
				},
				subcommands: [
					command({
						name: 'something',
						handler: () => '',
					}),
				],
			})
		).toThrowError(
			new BroCliError(
				`Can't define command 'nohandler' - command can't have subcommands and positional args at the same time!`,
			),
		);
	});
});

describe('Hook tests', (it) => {
	let [before, handler, after] = [new Date(), new Date(), new Date()];

	const test = command({
		name: 'test',
		handler: () => handler = new Date(),
	});

	const cmdsLocal = [
		test,
	];

	it('Execution in order', async () => {
		await run(cmdsLocal, {
			argSource: getArgs('test'),
			eventHandler: testEventHandler,
			hook: async (event, command) => {
				const stamp = new Date();
				if (event === 'before') {
					before = stamp;
					hookMocks.before(stamp, command);
				}
				if (event === 'after') {
					after = stamp;
					hookMocks.after(stamp, command);
				}
			},
		});

		expect(before.getTime() <= handler.getTime() && handler.getTime() <= after.getTime()).toStrictEqual(true);
		expect(hookMocks.before.mock.lastCall).toStrictEqual([
			before,
			test,
		]);
		expect(hookMocks.after.mock.lastCall).toStrictEqual([
			after,
			test,
		]);
	});
});

describe('Default event handler correct behaviour tests', (it) => {
	const ghelp = vi.fn();
	const chelp = vi.fn();
	const ver = vi.fn();

	const cmd = command({
		name: 'test',
		handler: () => '',
		help: chelp,
	});

	const cmds = [cmd];

	it('Global --help', async () => {
		await run(cmds, { argSource: getArgs('--help'), help: ghelp });

		expect(ghelp.mock.calls.length).toStrictEqual(1);
	});

	it('Global -h', async () => {
		await run(cmds, { argSource: getArgs('-h'), help: ghelp });

		expect(ghelp.mock.calls.length).toStrictEqual(2);
	});

	it('Command --help', async () => {
		await run(cmds, { argSource: getArgs('test --help') });

		expect(chelp.mock.calls.length).toStrictEqual(1);
	});

	it('Command -h', async () => {
		await run(cmds, { argSource: getArgs('test -h') });

		expect(chelp.mock.calls.length).toStrictEqual(2);
	});

	it('Global help', async () => {
		await run(cmds, { argSource: getArgs('help'), help: ghelp });

		expect(ghelp.mock.calls.length).toStrictEqual(3);
	});

	it('Command help', async () => {
		await run(cmds, { argSource: getArgs('help test'), help: ghelp });

		expect(chelp.mock.calls.length).toStrictEqual(3);
	});

	it('--version', async () => {
		await run(cmds, { argSource: getArgs('--version'), version: ver });

		expect(ver.mock.calls.length).toStrictEqual(1);
	});

	it('-v', async () => {
		await run(cmds, { argSource: getArgs('-v'), version: ver });

		expect(ver.mock.calls.length).toStrictEqual(2);
	});
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
