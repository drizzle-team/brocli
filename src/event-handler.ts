import { type Command, command, getCommandNameRecursive } from './command-core';
import { defaultTheme } from './help-themes';
import type { GenericBuilderInternals, OutputType } from './option-builder';

export type CommandHelpEvent = {
	type: 'commandHelp';
	command: Command;
	args: string[];
};

export type GlobalHelpEvent = {
	type: 'globalHelp';
	help?: string | Function;
	commands: Command[];
	args: string[];
};

export type MissingArgsEvent = {
	type: 'missingArgsErr';
	command: Command;
	received: Record<string, OutputType>;
	missing: GenericBuilderInternals[];
};

export type UnrecognizedArgsEvent = {
	type: 'unrecognizedArgsErr';
	command: Command;
	received: Record<string, OutputType>;
	unrecognized: string[];
};

export type UnknownCommandEvent = {
	type: 'unknownCommandEvent';
	offender: string;
};

export type UnknownSubcommandEvent = {
	type: 'unknownSubcommandEvent';
	command: Command;
	offender: string;
};

export type UnknownErrorEvent = {
	type: 'unknownError';
	error: unknown;
};

export type VersionEvent = {
	type: 'version';
	version?: string | Function;
};

export type ValidationViolation =
	| 'Above max'
	| 'Below min'
	| 'Expected int'
	| 'Invalid boolean syntax'
	| 'Invalid string syntax'
	| 'Invalid number syntax';

export type ValidationErrorEvent = {
	type: 'validationError';
	command: Command;
	option: GenericBuilderInternals;
	offender: {
		namePart: string;
		dataPart?: string;
	};
	violation: ValidationViolation;
};

export type BroCliEvent =
	| CommandHelpEvent
	| GlobalHelpEvent
	| MissingArgsEvent
	| UnrecognizedArgsEvent
	| UnknownCommandEvent
	| UnknownSubcommandEvent
	| ValidationErrorEvent
	| VersionEvent
	| UnknownErrorEvent;

const executeOrLog = async (target?: string | Function) =>
	typeof target === 'string' ? console.log(target) : target ? await target() : undefined;

/**
 * Return `true` if your handler processes the event
 *
 * Return `false` to process event with a built-in handler
 */
export type EventHandler = (event: BroCliEvent) => boolean | Promise<boolean>;
export const defaultEventHandler: EventHandler = async (event) => {
	switch (event.type) {
		case 'commandHelp': {
			if (event.command.help) await executeOrLog(event.command.help);
			else await defaultTheme(event.command);

			return true;
		}

		case 'globalHelp': {
			if (event.help !== undefined) await executeOrLog(event.help);
			else await defaultTheme(event.commands);

			return true;
		}

		case 'version': {
			if (event.version !== undefined) await executeOrLog(event.version);
			try {
				const jason = await import('package.json');
				if (typeof jason === 'object' && jason !== null && (<any> jason)['version']) console.log((<any> jason).version);
			} catch (error) {
				// Do nothing
			}

			return true;
		}

		case 'unknownCommandEvent': {
			const msg = `Unknown command: '${event.offender}'.\nType '--help' to get help on the cli.`;

			console.error(msg);
			return true;
		}

		case 'unknownSubcommandEvent': {
			const cName = getCommandNameRecursive(event.command);
			const msg = `Unknown command: ${cName} ${event.offender}.\nType '${cName} --help' to get the help on command.`;

			console.error(msg);
			return true;
		}

		case 'missingArgsErr': {
			const missingOpts = event.missing.map((e) => [e._.config.name, ...e._.config.aliases]);

			const msg = `Command '${command.name}' is missing following required options: ${
				missingOpts.map((opt) => {
					const name = opt.shift()!;
					const aliases = opt;

					if (aliases.length) return `${name} [${aliases.join(', ')}]`;

					return name;
				}).join(', ')
			}`;

			console.error(msg);
			return true;
		}

		case 'unrecognizedArgsErr': {
			const { command, unrecognized } = event;
			const msg = `Unrecognized options for command '${command.name}': ${unrecognized.join(', ')}`;

			console.error(msg);
			return true;
		}

		case 'validationError': {
			return true;
		}

		case 'unknownError': {
			const e = event.error;
			console.error(typeof e === 'object' && e !== null && 'message' in e ? e.message : e);
			return true;
		}
	}

	// @ts-expect-error
	return false;
};

export const eventHandlerWrapper = (customEventHandler: EventHandler) => async (event: BroCliEvent) =>
	await customEventHandler(event) ? true : await defaultEventHandler(event);
