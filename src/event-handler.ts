import { type Command, command, getCommandNameWithParents } from './command-core';
import type { ProcessedBuilderConfig } from './option-builder';
import { executeOrLog } from './util';

export type CommandHelpEvent = {
	type: 'commandHelp';
	command: Command;
};

export type GlobalHelpEvent = {
	type: 'globalHelp';
	help?: string | Function;
	commands: Command[];
};

export type MissingArgsEvent = {
	type: 'missingArgsErr';
	command: Command;
	missing: [string[], ...string[][]];
};

export type UnrecognizedArgsEvent = {
	type: 'unrecognizedArgsErr';
	command: Command;
	unrecognized: [string, ...string[]];
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

export type CommandsCompositionErrorEvent = {
	type: 'commandsCompositionErrEvent';
	message: string;
};

export type ValidationViolation =
	| 'Above max'
	| 'Below min'
	| 'Expected int'
	| 'Invalid boolean syntax'
	| 'Invalid string syntax'
	| 'Invalid number syntax'
	| 'Invalid number value'
	| 'Enum violation';

export type ValidationErrorEvent = {
	type: 'validationError';
	command: Command;
	option: ProcessedBuilderConfig;
	offender: {
		namePart?: string;
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
	| UnknownErrorEvent
	| CommandsCompositionErrorEvent;

export type BroCliEventType = BroCliEvent['type'];

/**
 * Return `true` if your handler processes the event
 *
 * Return `false` to process event with a built-in handler
 */
export type EventHandler = (event: BroCliEvent) => boolean | Promise<boolean>;
export const defaultEventHandler = (
	globalHelp: Function | string | undefined,
): EventHandler =>
async (event) => {
	switch (event.type) {
		case 'commandHelp': {
			const options = event.command.options
				? Object.values(event.command.options).filter((opt) => !opt.config?.isHidden).map(
					({ config: opt }) => ({
						name: opt.name,
						aliases: opt.aliases.length ? `${opt.aliases.join(', ')}` : '-',
						description: opt.description ?? '-',
						type: opt.type,
						required: opt.isRequired ? '✓' : '✗',
					}),
				)
				: undefined;

			console.log(
				`Command: ${event.command.name}${event.command.aliases ? ` [${event.command.aliases.join(', ')}]` : ''}${
					event.command.desc ? ` - ${event.command.desc}` : ''
				}`,
			);

			if (!options?.length) return true;

			console.log('\nOptions:');
			console.table(options);

			// Return this decision back to invoking code
			// if (event.command.help) await executeOrLog(event.command.help);
			// else await defaultTheme(event.command);

			return true;
		}

		case 'globalHelp': {
			if (globalHelp !== undefined) {
				await executeOrLog(globalHelp);

				return true;
			}

			const cmds = event.commands.filter((cmd) => !cmd.hidden);

			const tableCmds = cmds.map((cmd) => ({
				name: cmd.name,
				aliases: cmd.aliases ? cmd.aliases.join(', ') : '-',
				description: cmd.desc ?? '-',
			}));

			console.log(`Here's the list of all available commands:`);
			console.table(tableCmds);
			console.log(
				'To read the details about any particular command type: [commandName] --help',
			);

			// Return this decision back to invoking code
			// if (event.help !== undefined) await executeOrLog(event.help);
			// else await defaultTheme(event.commands);

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
			const cName = getCommandNameWithParents(event.command);
			const msg = `Unknown command: ${cName} ${event.offender}.\nType '${cName} --help' to get the help on command.`;

			console.error(msg);

			return true;
		}

		case 'missingArgsErr': {
			const missingOpts = event.missing;

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
			let msg: string;

			const matchedName = event.offender.namePart;
			const data = event.offender.dataPart;
			const option = event.option;

			switch (event.violation) {
				case 'Above max': {
					const max = option.maxVal!;
					msg =
						`Invalid value: number type argument '${matchedName}' expects maximal value of ${max} as an input, got: ${data}`;

					break;
				}

				case 'Below min': {
					const min = option.minVal;

					msg =
						`Invalid value: number type argument '${matchedName}' expects minimal value of ${min} as an input, got: ${data}`;

					break;
				}

				case 'Expected int': {
					msg = `Invalid value: number type argument '${matchedName}' expects an integer as an input, got: ${data}`;

					break;
				}

				case 'Invalid boolean syntax': {
					msg =
						`Invalid syntax: boolean type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value> | ${matchedName}.\nAllowed values: true, false, 0, 1`;

					break;
				}

				case 'Invalid string syntax': {
					msg =
						`Invalid syntax: string type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value>`;

					break;
				}

				case 'Invalid number syntax': {
					msg =
						`Invalid syntax: number type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value>`;

					break;
				}

				case 'Invalid number value': {
					msg = `Invalid value: number type argument '${matchedName}' expects a number as an input, got: ${data}`;
					break;
				}

				case 'Enum violation': {
					const values = option.enumVals!;

					msg = option.type === 'positional'
						? `Invalid value: value for the argument '${matchedName}' must be either one of the following: ${
							values.join(', ')
						}; Received: ${data}`
						: `Invalid value: value for the argument '${matchedName}' must be either one of the following: ${
							values.join(', ')
						}; Received: ${data}`;
				}
			}

			console.error(msg);

			return true;
		}

		case 'unknownError': {
			const e = event.error;
			console.error(typeof e === 'object' && e !== null && 'message' in e ? e.message : e);

			return true;
		}

		case 'commandsCompositionErrEvent': {
			console.error(event.message);

			return true;
		}
	}

	// @ts-expect-error
	return false;
};

export const eventHandlerWrapper =
	(customEventHandler: EventHandler, globalHelp: Function | string | undefined) => async (event: BroCliEvent) =>
		await customEventHandler(event) ? true : await defaultEventHandler(globalHelp)(event);
