import {
	boolean,
	type BroCliEventType,
	type Command,
	command,
	type EventHandler,
	EventType,
	number,
	positional,
	run,
	string,
} from '@/index';
import { shellArgs as getArgs } from '@/util';
import { describe, Mock, vi } from 'vitest';

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
