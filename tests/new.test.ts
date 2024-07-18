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
import { shellArgs as getArgs } from '@/util';
import { describe, expect, expectTypeOf, Mock, vi } from 'vitest';

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

const commands: Command[] = [];

describe('Malformed option tests', async (it) => {
	it('');
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
});
