import { type Command, command, getCommandNameWithParents } from './command-core';
import type { BuilderConfig, ProcessedBuilderConfig } from './option-builder';

export type CommandHelpEvent = {
	type: 'commandHelp';
	cliName: string | undefined;
	command: Command;
};

export type GlobalHelpEvent = {
	type: 'globalHelp';
	cliName: string | undefined;
	commands: Command[];
};

export type MissingArgsEvent = {
	type: 'missingArgsErr';
	cliName: string | undefined;
	command: Command;
	missing: [string[], ...string[][]];
};

export type UnrecognizedArgsEvent = {
	type: 'unrecognizedArgsErr';
	cliName: string | undefined;
	command: Command;
	unrecognized: [string, ...string[]];
};

export type UnknownCommandEvent = {
	type: 'unknownCommandEvent';
	commands: Command[];
	cliName: string | undefined;
	offender: string;
};

export type UnknownSubcommandEvent = {
	type: 'unknownSubcommandEvent';
	cliName: string | undefined;
	command: Command;
	offender: string;
};

export type UnknownErrorEvent = {
	type: 'unknownError';
	cliName: string | undefined;
	error: unknown;
};

export type VersionEvent = {
	type: 'version';
	cliName: string | undefined;
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
	cliName: string | undefined;
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
	| UnknownErrorEvent;

export type BroCliEventType = BroCliEvent['type'];

const getOptionTypeText = (option: BuilderConfig) => {
	let result = '';

	switch (option.type) {
		case 'boolean':
			result = '';
			break;
		case 'number': {
			if ((option.minVal ?? option.maxVal) !== undefined) {
				let text = '';

				if (option.isInt) text = text + `integer `;

				if (option.minVal !== undefined) text = text + `[${option.minVal};`;
				else text = text + `(∞;`;

				if (option.maxVal !== undefined) text = text + `${option.maxVal}]`;
				else text = text + `∞)`;

				result = text;
				break;
			}

			if (option.isInt) {
				result = 'integer';
				break;
			}

			result = 'number';
			break;
		}
		case 'string': {
			if (option.enumVals) {
				result = '[ ' + option.enumVals.join(' | ') + ' ]';
				break;
			}

			result = 'string';
			break;
		}
		case 'positional': {
			result = `${option.isRequired ? '<' : '['}${option.enumVals ? option.enumVals.join('|') : option.name}${
				option.isRequired ? '>' : ']'
			}`;
			break;
		}
	}

	if (option.isRequired && option.type !== 'positional') result = '!' + result.length ? ' ' : '' + result;
	return result;
};

/**
 * Return `true` if your handler processes the event
 *
 * Return `false` to process event with a built-in handler
 */
export type EventHandler = (event: BroCliEvent) => boolean | Promise<boolean>;
export const defaultEventHandler: EventHandler = async (event) => {
	switch (event.type) {
		case 'commandHelp': {
			const command = event.command;
			const commandName = getCommandNameWithParents(command);
			const cliName = event.cliName;
			const desc = command.desc ?? command.shortDesc;

			if (desc !== undefined) {
				console.log(`\n${desc}`);
			}

			const opts = Object.values(command.options ?? {} as Exclude<typeof command.options, undefined>).filter((opt) =>
				!opt.config.isHidden
			);
			const positionals = opts.filter((opt) => opt.config.type === 'positional');
			const options = opts.filter((opt) => opt.config.type !== 'positional');

			console.log('\nUsage:');
			if (command.handler) {
				console.log(
					`  ${cliName ? cliName + ' ' : ''}${commandName}${
						positionals.length
							? ' '
								+ positionals.map(({ config: p }) => getOptionTypeText(p)).join(' ')
							: ''
					} [flags]`,
				);
			} else console.log(`  ${cliName ? cliName + ' ' : ''}${commandName} [command]`);

			if (command.aliases) {
				console.log(`\nAliases:`);
				console.log(`  ${command.aliases.join(', ')}`);
			}

			if (command.subcommands) {
				console.log('\nAvailable Commands:');
				const padding = 3;
				const maxLength = command.subcommands.reduce((p, e) => e.name.length > p ? e.name.length : p, 0);
				const paddedLength = maxLength + padding;
				const preDescPad = 2 + paddedLength;

				const data = command.subcommands.map((s) =>
					`  ${s.name.padEnd(paddedLength)}${
						(() => {
							const description = s.shortDesc ?? s.desc;
							if (!description?.length) return '';
							const split = description.split('\n');
							const first = split.shift()!;

							const final = [first, ...split.map((s) => ''.padEnd(preDescPad) + s)].join('\n');

							return final;
						})()
					}`
				)
					.join('\n');
				console.log(data);
			}

			if (options.length) {
				const aliasLength = options.reduce((p, e) => {
					const currentLength = e.config.aliases.reduce((pa, a) => pa + a.length, 0)
						+ ((e.config.aliases.length - 1) * 2) + 1; // Names + coupling symbols ", " + ending coma

					return currentLength > p ? currentLength : p;
				}, 0);
				const paddedAliasLength = aliasLength > 0 ? aliasLength + 1 : 0;
				const nameLength = options.reduce((p, e) => {
					const typeLen = getOptionTypeText(e.config).length;
					const length = typeLen > 0 ? e.config.name.length + 1 + typeLen : e.config.name.length;

					return length > p ? length : p;
				}, 0) + 3;

				const preDescPad = paddedAliasLength + nameLength + 2;

				const data = options.map(({ config: opt }) =>
					`  ${`${opt.aliases.length ? opt.aliases.join(', ') + ',' : ''}`.padEnd(paddedAliasLength)}${
						`${opt.name}${
							(() => {
								const typeText = getOptionTypeText(opt);
								return typeText.length ? ' ' + typeText : '';
							})()
						}`.padEnd(nameLength)
					}${
						(() => {
							if (!opt.description?.length) {
								return opt.default !== undefined
									? `default: ${JSON.stringify(opt.default)}`
									: '';
							}

							const split = opt.description.split('\n');
							const first = split.shift()!;
							const def = opt.default !== undefined ? ` (default: ${JSON.stringify(opt.default)})` : '';

							const final = [first, ...split.map((s) => ''.padEnd(preDescPad) + s)].join('\n') + def;

							return final;
						})()
					}`
				).join('\n');

				console.log('\nFlags:');
				console.log(data);
			}

			console.log('\nGlobal flags:');
			console.log(`  -h, --help      help for ${commandName}`);
			console.log(`  -v, --version   version${cliName ? ` for ${cliName}` : ''}`);

			if (command.subcommands?.length) {
				console.log(
					`\nUse "${
						cliName ? cliName + ' ' : ''
					}${commandName} [command] --help" for more information about a command.\n`,
				);
			}

			return true;
		}

		case 'globalHelp': {
			const cliName = event.cliName;
			console.log('Usage:');
			console.log(`  ${cliName ? cliName + ' ' : ''}[command]`);

			if (event.commands) {
				console.log('\nAvailable Commands:');
				const padding = 3;
				const maxLength = event.commands.reduce((p, e) => e.name.length > p ? e.name.length : p, 0);
				const paddedLength = maxLength + padding;

				const data = event.commands.map((s) =>
					`  ${s.name.padEnd(paddedLength)}${(s.shortDesc ?? s.desc)?.split('\n').shift()!}`
				)
					.join('\n');
				console.log(data);
			}

			console.log('\nFlags:');
			console.log(`  -h, --help      help${cliName ? ` for ${cliName}` : ''}`);
			console.log(`  -v, --version   version${cliName ? ` for ${cliName}` : ''}`);
			console.log('\n');

			return true;
		}

		case 'version': {
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
						? `Invalid value: value for the positional argument '${option.name}' must be either one of the following: ${
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
	}

	// @ts-expect-error
	return false;
};

export const eventHandlerWrapper = (customEventHandler: EventHandler) => async (event: BroCliEvent) =>
	await customEventHandler(event) ? true : await defaultEventHandler(event);
