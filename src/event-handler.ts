import { type Command, command, getCommandNameWithParents } from './command-core';
import type { BuilderConfig, ProcessedBuilderConfig } from './option-builder';

export type CommandHelpEvent = {
	type: 'command_help';
	name: string | undefined;
	description: string | undefined;
	command: Command;
};

export type GlobalHelpEvent = {
	type: 'global_help';
	description: string | undefined;
	name: string | undefined;
	commands: Command[];
};

export type MissingArgsEvent = {
	type: 'error';
	violation: 'missing_args_error';
	name: string | undefined;
	description: string | undefined;
	command: Command;
	missing: [string[], ...string[][]];
};

export type UnrecognizedArgsEvent = {
	type: 'error';
	violation: 'unrecognized_args_error';
	name: string | undefined;
	description: string | undefined;
	command: Command;
	unrecognized: [string, ...string[]];
};

export type UnknownCommandEvent = {
	type: 'error';
	violation: 'unknown_command_error';
	name: string | undefined;
	description: string | undefined;
	commands: Command[];
	offender: string;
};

export type UnknownSubcommandEvent = {
	type: 'error';
	violation: 'unknown_subcommand_error';
	name: string | undefined;
	description: string | undefined;
	command: Command;
	offender: string;
};

export type UnknownErrorEvent = {
	type: 'error';
	violation: 'unknown_error';
	name: string | undefined;
	description: string | undefined;
	error: unknown;
};

export type VersionEvent = {
	type: 'version';
	name: string | undefined;
	description: string | undefined;
};

export type GenericValidationViolation =
	| 'above_max'
	| 'below_min'
	| 'expected_int'
	| 'invalid_boolean_syntax'
	| 'invalid_string_syntax'
	| 'invalid_number_syntax'
	| 'invalid_number_value'
	| 'enum_violation';

export type ValidationViolation = BroCliEvent extends infer Event
	? Event extends { violation: string } ? Event['violation'] : never
	: never;

export type ValidationErrorEvent = {
	type: 'error';
	violation: GenericValidationViolation;
	name: string | undefined;
	description: string | undefined;
	command: Command;
	option: ProcessedBuilderConfig;
	offender: {
		namePart?: string;
		dataPart?: string;
	};
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
		case 'command_help': {
			const command = event.command;
			const commandName = getCommandNameWithParents(command);
			const cliName = event.name;
			const desc = command.desc ?? command.shortDesc;
			const subs = command.subcommands?.filter((s) => !s.hidden);
			const subcommands = subs && subs.length ? subs : undefined;

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
				console.log(`  ${[command.name, ...command.aliases].join(', ')}`);
			}

			if (subcommands) {
				console.log('\nAvailable Commands:');
				const padding = 3;
				const maxLength = subcommands.reduce((p, e) => e.name.length > p ? e.name.length : p, 0);
				const paddedLength = maxLength + padding;
				const preDescPad = 2 + paddedLength;

				const data = subcommands.map((s) =>
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

			if (subcommands) {
				console.log(
					`\nUse "${
						cliName ? cliName + ' ' : ''
					}${commandName} [command] --help" for more information about a command.\n`,
				);
			}

			return true;
		}

		case 'global_help': {
			const cliName = event.name;
			const desc = event.description;
			const commands = event.commands.filter((c) => !c.hidden);

			if (desc !== undefined) {
				console.log(`${desc}\n`);
			}

			console.log('Usage:');
			console.log(`  ${cliName ? cliName + ' ' : ''}[command]`);

			if (commands.length) {
				console.log('\nAvailable Commands:');
				const padding = 3;
				const maxLength = commands.reduce((p, e) => e.name.length > p ? e.name.length : p, 0);
				const paddedLength = maxLength + padding;

				const data = commands.map((c) =>
					`  ${c.name.padEnd(paddedLength)}${
						(() => {
							const desc = c.shortDesc ?? c.desc;

							if (!desc?.length) return '';

							const split = desc.split('\n');
							const first = split.shift()!;

							const final = [first, ...split.map((s) => ''.padEnd(paddedLength + 2) + s)].join('\n');

							return final;
						})()
					}`
				)
					.join('\n');
				console.log(data);
			} else {
				console.log('\nNo available commands.');
			}

			console.log('\nFlags:');
			console.log(`  -h, --help      help${cliName ? ` for ${cliName}` : ''}`);
			console.log(`  -v, --version   version${cliName ? ` for ${cliName}` : ''}`);
			console.log('\n');

			return true;
		}

		case 'version': {
			return true;
		}

		case 'error': {
			let msg: string;

			switch (event.violation) {
				case 'above_max': {
					const matchedName = event.offender.namePart;
					const data = event.offender.dataPart;
					const option = event.option;

					const max = option.maxVal!;
					msg =
						`Invalid value: number type argument '${matchedName}' expects maximal value of ${max} as an input, got: ${data}`;

					break;
				}

				case 'below_min': {
					const matchedName = event.offender.namePart;
					const data = event.offender.dataPart;
					const option = event.option;

					const min = option.minVal;

					msg =
						`Invalid value: number type argument '${matchedName}' expects minimal value of ${min} as an input, got: ${data}`;

					break;
				}

				case 'expected_int': {
					const matchedName = event.offender.namePart;
					const data = event.offender.dataPart;

					msg = `Invalid value: number type argument '${matchedName}' expects an integer as an input, got: ${data}`;

					break;
				}

				case 'invalid_boolean_syntax': {
					const matchedName = event.offender.namePart;
					const data = event.offender.dataPart;

					msg =
						`Invalid syntax: boolean type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value> | ${matchedName}.\nAllowed values: true, false, 0, 1`;

					break;
				}

				case 'invalid_string_syntax': {
					const matchedName = event.offender.namePart;

					msg =
						`Invalid syntax: string type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value>`;

					break;
				}

				case 'invalid_number_syntax': {
					const matchedName = event.offender.namePart;

					msg =
						`Invalid syntax: number type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value>`;

					break;
				}

				case 'invalid_number_value': {
					const matchedName = event.offender.namePart;
					const data = event.offender.dataPart;

					msg = `Invalid value: number type argument '${matchedName}' expects a number as an input, got: ${data}`;
					break;
				}

				case 'enum_violation': {
					const matchedName = event.offender.namePart;
					const data = event.offender.dataPart;
					const option = event.option;

					const values = option.enumVals!;

					msg = option.type === 'positional'
						? `Invalid value: value for the positional argument '${option.name}' must be either one of the following: ${
							values.join(', ')
						}; Received: ${data}`
						: `Invalid value: value for the argument '${matchedName}' must be either one of the following: ${
							values.join(', ')
						}; Received: ${data}`;

					break;
				}

				case 'unknown_command_error': {
					const msg = `Unknown command: '${event.offender}'.\nType '--help' to get help on the cli.`;

					console.error(msg);

					return true;
				}

				case 'unknown_subcommand_error': {
					const cName = getCommandNameWithParents(event.command);
					const msg =
						`Unknown command: ${cName} ${event.offender}.\nType '${cName} --help' to get the help on command.`;

					console.error(msg);

					return true;
				}

				case 'missing_args_error': {
					const { missing: missingOpts, command } = event;

					msg = `Command '${command.name}' is missing following required options: ${
						missingOpts.map((opt) => {
							const name = opt.shift()!;
							const aliases = opt;

							if (aliases.length) return `${name} [${aliases.join(', ')}]`;

							return name;
						}).join(', ')
					}`;

					break;
				}

				case 'unrecognized_args_error': {
					const { command, unrecognized } = event;
					msg = `Unrecognized options for command '${command.name}': ${unrecognized.join(', ')}`;

					break;
				}

				case 'unknown_error': {
					const e = event.error;
					console.error(typeof e === 'object' && e !== null && 'message' in e ? e.message : e);

					return true;
				}
			}

			console.error(msg);

			return true;
		}
	}

	// @ts-expect-error
	return false;
};

export const eventHandlerWrapper = (customEventHandler: EventHandler) => async (event: BroCliEvent) =>
	await customEventHandler(event) ? true : await defaultEventHandler(event);
