import clone from 'clone';
import { BroCliError } from './brocli-error';
import { defaultEventHandler, type EventHandler, eventHandlerWrapper } from './event-handler';
import {
	type GenericBuilderInternals,
	type GenericBuilderInternalsFields,
	type OutputType,
	type ProcessedBuilderConfig,
	type ProcessedOptions,
	type TypeOf,
} from './option-builder';
import { executeOrLog, isInt, shellArgs } from './util';

// Type area
export type CommandHandler<
	TOpts extends Record<string, GenericBuilderInternals> | undefined =
		| Record<string, GenericBuilderInternals>
		| undefined,
> = (
	options: TOpts extends Record<string, GenericBuilderInternals> ? TypeOf<TOpts> : undefined,
) => any;

export type CommandInfo = {
	name: string;
	aliases?: [string, ...string[]];
	desc?: string;
	shortDesc?: string;
	hidden?: boolean;
	options?: Record<string, ProcessedBuilderConfig>;
	metadata?: any;
	subcommands?: CommandsInfo;
};

export type CommandsInfo = Record<string, CommandInfo>;

export type EventType = 'before' | 'after';

export type BroCliConfig = {
	cliName?: string;
	argSource?: string[];
	help?: string | Function;
	version?: string | Function;
	omitKeysOfUndefinedOptions?: boolean;
	hook?: (event: EventType, command: Command) => any;
	theme?: EventHandler;
};

export type GenericCommandHandler = (options?: Record<string, OutputType> | undefined) => any;

export type RawCommand<
	TOpts extends Record<string, GenericBuilderInternals> | undefined =
		| Record<string, GenericBuilderInternals>
		| undefined,
	TOptsData = TOpts extends Record<string, GenericBuilderInternals> ? TypeOf<TOpts> : undefined,
	TTransformed = TOptsData extends undefined ? undefined : TOptsData,
> = {
	name?: string;
	aliases?: [string, ...string[]];
	desc?: string;
	shortDesc?: string;
	hidden?: boolean;
	options?: TOpts;
	help?: string | Function;
	transform?: (options: TOptsData) => TTransformed;
	handler?: (options: Awaited<TTransformed>) => any;
	subcommands?: [Command, ...Command[]];
	metadata?: any;
};

export type AnyRawCommand<
	TOpts extends Record<string, GenericBuilderInternals> | undefined =
		| Record<string, GenericBuilderInternals>
		| undefined,
> = {
	name?: string;
	aliases?: [string, ...string[]];
	desc?: string;
	shortDesc?: string;
	hidden?: boolean;
	options?: TOpts;
	help?: string | Function;
	transform?: GenericCommandHandler;
	handler?: GenericCommandHandler;
	subcommands?: [Command, ...Command[]];
	metadata?: any;
};

export type Command<TOptsType = any, TTransformedType = any> = {
	name: string;
	aliases?: [string, ...string[]];
	desc?: string;
	shortDesc?: string;
	hidden?: boolean;
	options?: ProcessedOptions;
	help?: string | Function;
	transform?: GenericCommandHandler;
	handler?: GenericCommandHandler;
	subcommands?: [Command, ...Command[]];
	parent?: Command;
	metadata?: any;
};

export type CommandCandidate = {
	data: string;
	originalIndex: number;
};

export type InnerCommandParseRes = {
	command: Command | undefined;
	args: string[];
};

export type TestResult<THandlerInput> = {
	type: 'handler';
	options: THandlerInput;
} | {
	type: 'help' | 'version';
} | {
	type: 'error';
	error: unknown;
};

const generatePrefix = (name: string) => name.startsWith('-') ? name : name.length > 1 ? `--${name}` : `-${name}`;

const validateOptions = <TOptionConfig extends Record<string, GenericBuilderInternals>>(
	config: TOptionConfig,
): ProcessedOptions<TOptionConfig> => {
	const cloned = clone(config);

	const entries: [string, GenericBuilderInternalsFields][] = [];

	const storedNames: [string, ...string[]][] = [];

	const cfgEntries = Object.entries(cloned);

	for (const [key, value] of cfgEntries) {
		const cfg = value._.config;

		if (cfg.name === undefined) cfg.name = key;

		if (cfg.type === 'positional') continue;

		if (cfg.name!.includes('=')) {
			throw new BroCliError(
				`Can't define option '${generatePrefix(cfg.name)}' - option names and aliases cannot contain '='!`,
			);
		}

		for (const alias of cfg.aliases) {
			if (alias.includes('=')) {
				throw new BroCliError(
					`Can't define option '${generatePrefix(cfg.name)}' - option names and aliases cannot contain '='!`,
				);
			}
		}

		cfg.name = generatePrefix(cfg.name);

		cfg.aliases = cfg.aliases.map((a) => generatePrefix(a));
	}

	for (const [key, value] of cfgEntries) {
		const cfg = value._.config;

		if (cfg.type === 'positional') {
			entries.push([key, { config: cfg, $output: undefined as any }]);

			continue;
		}

		const reservedNames = ['--help', '-h', '--version', '-v'];

		const allNames = [cfg.name, ...cfg.aliases];

		for (const name of allNames) {
			const match = reservedNames.find((n) => n === name);
			if (match) throw new BroCliError(`Can't define option '${cfg.name}' - name '${match}' is reserved!`);
		}

		for (const storage of storedNames) {
			const nameOccupier = storage.find((e) => e === cfg.name);

			if (!nameOccupier) continue;

			throw new BroCliError(
				`Can't define option '${cfg.name}' - name is already in use by option '${storage[0]}'!`,
			);
		}

		for (const alias of cfg.aliases) {
			for (const storage of storedNames) {
				const nameOccupier = storage.find((e) => e === alias);

				if (!nameOccupier) continue;

				throw new BroCliError(
					`Can't define option '${cfg.name}' - alias '${alias}' is already in use by option '${storage[0]}'!`,
				);
			}
		}

		const currentNames = [cfg.name!, ...cfg.aliases] as [string, ...string[]];

		storedNames.push(currentNames);

		currentNames.forEach((name, idx) => {
			if (currentNames.findIndex((e) => e === name) === idx) return;

			throw new BroCliError(
				`Can't define option '${cfg.name}' - duplicate alias '${name}'!`,
			);
		});

		entries.push([key, { config: cfg, $output: undefined as any }]);
	}

	return Object.fromEntries(entries) as ProcessedOptions<any>;
};

const assignParent = (parent: Command, subcommands: Command[]) =>
	subcommands.forEach((e) => {
		e.parent = parent;
		if (e.subcommands) assignParent(e, e.subcommands);
	});

export const command = <
	TOpts extends Record<string, GenericBuilderInternals> | undefined,
	TOptsData = TOpts extends Record<string, GenericBuilderInternals> ? TypeOf<TOpts> : undefined,
	TTransformed = TOptsData,
>(command: RawCommand<TOpts, TOptsData, TTransformed>): Command<TOptsData, Awaited<TTransformed>> => {
	const allNames = command.aliases ? [command.name, ...command.aliases] : [command.name];

	const cmd: Command = clone(command) as any;
	if (
		(<AnyRawCommand> command).subcommands && command.options
		&& Object.values(command.options).find((opt) => opt._.config.type === 'positional')
	) {
		throw new BroCliError(
			`Can't define command '${cmd.name}' - command can't have subcommands and positional args at the same time!`,
		);
	}

	if (!command.handler && !command.subcommands) {
		throw new BroCliError(
			`Can't define command '${cmd.name}' - command without subcommands must have a handler present!`,
		);
	}

	const processedOptions = command.options ? validateOptions(command.options) : undefined;
	cmd.options = processedOptions;

	cmd.name = cmd.name ?? cmd.aliases?.shift();

	if (!cmd.name) throw new BroCliError(`Can't define command without name!`);

	cmd.aliases = cmd.aliases?.length ? cmd.aliases : undefined;

	if (cmd.name.startsWith('-')) {
		throw new BroCliError(`Can't define command '${cmd.name}' - command name can't start with '-'!`);
	}

	cmd.aliases?.forEach((a) => {
		if (a.startsWith('-')) {
			throw new BroCliError(`Can't define command '${cmd.name}' - command aliases can't start with '-'!`);
		}
	});

	allNames.forEach((n, i) => {
		if (n === 'help') {
			throw new BroCliError(
				`Can't define command '${cmd.name}' - 'help' is a reserved name. If you want to redefine help message - do so in runCli's config.`,
			);
		}

		const lCaseName = n?.toLowerCase();
		if (lCaseName === '0' || lCaseName === '1' || lCaseName === 'true' || lCaseName === 'false') {
			throw new BroCliError(
				`Can't define command '${cmd.name}' - '${n}' is a reserved for boolean values name!`,
			);
		}

		const idx = allNames.findIndex((an) => an === n);

		if (idx !== i) throw new BroCliError(`Can't define command '${cmd.name}' - duplicate alias '${n}'!`);
	});

	if (cmd.subcommands) {
		assignParent(cmd, cmd.subcommands);
	}

	return cmd;
};

const getCommandInner = (
	commands: Command[],
	candidates: CommandCandidate[],
	args: string[],
	cliName?: string,
): InnerCommandParseRes => {
	const { data: arg, originalIndex: index } = candidates.shift()!;

	const command = commands.find((c) => {
		const names = c.aliases ? [c.name, ...c.aliases] : [c.name];
		const res = names.find((name) => name === arg);

		return res;
	});

	if (!command) {
		return {
			command,
			args,
		};
	}

	const newArgs = removeByIndex(args, index);

	if (!candidates.length || !command.subcommands) {
		return {
			command,
			args: newArgs,
		};
	}

	const newCandidates = candidates.map((c) => ({ data: c.data, originalIndex: c.originalIndex - 1 }));

	const subcommand = getCommandInner(command.subcommands!, newCandidates, newArgs, cliName);

	if (!subcommand.command) {
		throw new BroCliError(undefined, {
			type: 'unknownSubcommandEvent',
			cliName,
			command,
			offender: candidates[0]!.data,
		});
	}

	return subcommand;
};

const getCommand = (commands: Command[], args: string[], cliName?: string) => {
	const candidates: CommandCandidate[] = [];

	for (let i = 0; i < args.length; ++i) {
		const arg = args[i]!;
		if (arg === '--help' || arg === '-h' || arg === '--version' || arg === '-v') {
			const lCaseNext = args[i + 1]?.toLowerCase();
			if (lCaseNext === '0' || lCaseNext === '1' || lCaseNext === 'true' || lCaseNext === 'false') ++i;

			continue;
		}

		if (arg?.startsWith('-')) {
			if (!arg.includes('=')) ++i;

			continue;
		}

		candidates.push({
			data: arg,
			originalIndex: i,
		});
	}

	if (!candidates.length) {
		return {
			command: undefined,
			args,
		};
	}

	const firstCandidate = candidates[0]!;

	if (firstCandidate.data === 'help') {
		return {
			command: 'help' as const,
			args: removeByIndex(args, firstCandidate.originalIndex),
		};
	}

	const { command, args: argsRes } = getCommandInner(commands, candidates, args, cliName);

	if (!command) {
		throw new BroCliError(undefined, {
			type: 'unknownCommandEvent',
			cliName,
			offender: firstCandidate.data,
		});
	}

	return {
		command,
		args: argsRes,
	};
};

const parseArg = (
	command: Command,
	options: [string, ProcessedBuilderConfig][],
	positionals: [string, ProcessedBuilderConfig][],
	arg: string,
	nextArg: string | undefined,
	cliName?: string,
) => {
	let data: OutputType = undefined;

	const argSplit = arg.split('=');
	const hasEq = arg.includes('=');

	const namePart = argSplit.shift()!;
	const dataPart = hasEq ? argSplit.join('=') : nextArg;
	let skipNext = !hasEq;

	if (namePart === '--help' || namePart === '-h') {
		return {
			isHelp: true,
		};
	}

	if (namePart === '--version' || namePart === '-v') {
		return {
			isVersion: true,
		};
	}

	if (!arg.startsWith('-')) {
		if (!positionals.length) return {};

		const pos = positionals.shift()!;

		if (pos[1].enumVals && !pos[1].enumVals.find((val) => val === arg)) {
			throw new BroCliError(undefined, {
				type: 'validationError',
				cliName,
				violation: 'Enum violation',
				command,
				option: pos[1],
				offender: {
					dataPart: arg,
				},
			});
		}

		data = arg;

		return {
			data,
			skipNext: false,
			name: pos[0],
			option: pos[1],
		};
	}

	const option = options.find(([optKey, opt]) => {
		const names = [opt.name!, ...opt.aliases];

		if (opt.type === 'boolean') {
			const match = names.find((name) => name === namePart);
			if (!match) return false;

			let lcaseData = dataPart?.toLowerCase();

			if (!hasEq && nextArg?.startsWith('-')) {
				data = true;
				skipNext = false;
				return true;
			}

			if (lcaseData === undefined || lcaseData === '' || lcaseData === 'true' || lcaseData === '1') {
				data = true;
				return true;
			}

			if (lcaseData === 'false' || lcaseData === '0') {
				data = false;
				return true;
			}

			if (!hasEq) {
				data = true;
				skipNext = false;
				return true;
			}

			throw new BroCliError(undefined, {
				type: 'validationError',
				cliName,
				violation: 'Invalid boolean syntax',
				option: opt,
				command,
				offender: {
					namePart,
					dataPart,
				},
			});
		} else {
			const match = names.find((name) => name === namePart);

			if (!match) return false;

			if (opt.type === 'string') {
				if (!hasEq && nextArg === undefined) {
					throw new BroCliError(undefined, {
						type: 'validationError',
						cliName,
						violation: 'Invalid string syntax',
						option: opt,
						command,
						offender: {
							namePart,
							dataPart,
						},
					});
				}

				if (opt.enumVals && !opt.enumVals.find((val) => val === dataPart)) {
					throw new BroCliError(undefined, {
						type: 'validationError',
						cliName,
						violation: 'Enum violation',
						option: opt,
						command,
						offender: {
							namePart,
							dataPart,
						},
					});
				}

				data = dataPart;

				return true;
			}

			if (!hasEq && nextArg === undefined) {
				throw new BroCliError(undefined, {
					type: 'validationError',
					cliName,
					violation: 'Invalid number syntax',
					option: opt,
					command,
					offender: {
						namePart,
						dataPart,
					},
				});
			}

			const numData = Number(dataPart);

			if (isNaN(numData)) {
				throw new BroCliError(undefined, {
					type: 'validationError',
					cliName,
					violation: 'Invalid number value',
					option: opt,
					command,
					offender: {
						namePart,
						dataPart,
					},
				});
			}

			if (opt.isInt && !isInt(numData)) {
				throw new BroCliError(undefined, {
					type: 'validationError',
					cliName,
					violation: 'Expected int',
					option: opt,
					command,
					offender: {
						namePart,
						dataPart,
					},
				});
			}

			if (opt.minVal !== undefined && numData < opt.minVal) {
				throw new BroCliError(undefined, {
					type: 'validationError',
					cliName,
					violation: 'Below min',
					option: opt,
					command,
					offender: {
						namePart,
						dataPart,
					},
				});
			}

			if (opt.maxVal !== undefined && numData > opt.maxVal) {
				throw new BroCliError(undefined, {
					type: 'validationError',
					cliName,
					violation: 'Above max',
					option: opt,
					command,
					offender: {
						namePart,
						dataPart,
					},
				});
			}

			data = numData;

			return true;
		}
	});

	return {
		data,
		skipNext,
		name: option?.[0],
		option: option?.[1],
	};
};

const parseOptions = (
	command: Command,
	args: string[],
	cliName?: string,
	omitKeysOfUndefinedOptions?: boolean,
): Record<string, OutputType> | 'help' | 'version' | undefined => {
	const options = command.options;

	const optEntries = Object.entries(options ?? {} as Exclude<typeof options, undefined>).map(
		(opt) => [opt[0], opt[1].config] as [string, ProcessedBuilderConfig],
	);

	const nonPositionalEntries = optEntries.filter(([key, opt]) => opt.type !== 'positional');
	const positionalEntries = optEntries.filter(([key, opt]) => opt.type === 'positional');

	const result: Record<string, OutputType> = {};

	const missingRequiredArr: string[][] = [];
	const unrecognizedArgsArr: string[] = [];

	for (let i = 0; i < args.length; ++i) {
		const arg = args[i]!;
		const nextArg = args[i + 1];

		const {
			data,
			name,
			option,
			skipNext,
			isHelp,
			isVersion,
		} = parseArg(command, nonPositionalEntries, positionalEntries, arg, nextArg, cliName);
		if (!option) unrecognizedArgsArr.push(arg.split('=')[0]!);
		if (skipNext) ++i;

		if (isHelp) return 'help';
		if (isVersion) return 'version';

		result[name!] = data;
	}

	for (const [optKey, option] of optEntries) {
		const data = result[optKey] ?? option.default;

		if (!omitKeysOfUndefinedOptions) {
			result[optKey] = data;
		} else {
			if (data !== undefined) result[optKey] = data;
		}

		if (option.isRequired && result[optKey] === undefined) missingRequiredArr.push([option.name!, ...option.aliases]);
	}

	if (missingRequiredArr.length) {
		throw new BroCliError(undefined, {
			type: 'missingArgsErr',
			cliName,
			command,
			missing: missingRequiredArr as [string[], ...string[][]],
		});
	}
	if (unrecognizedArgsArr.length) {
		throw new BroCliError(undefined, {
			type: 'unrecognizedArgsErr',
			cliName,
			command,
			unrecognized: unrecognizedArgsArr as [string, ...string[]],
		});
	}

	return Object.keys(result).length ? result : undefined;
};

export const getCommandNameWithParents = (command: Command): string =>
	command.parent ? `${getCommandNameWithParents(command.parent)} ${command.name}` : command.name;

const validateCommands = (commands: Command[], parent?: Command) => {
	const storedNames: Record<string, [string, ...string[]]> = {};

	for (const cmd of commands) {
		const storageVals = Object.values(storedNames);

		for (const storage of storageVals) {
			const nameOccupier = storage.find((e) => e === cmd.name);

			if (!nameOccupier) continue;

			throw new BroCliError(
				`Can't define command '${getCommandNameWithParents(cmd)}': name is already in use by command '${
					parent ? `${getCommandNameWithParents(parent)} ` : ''
				}${storage[0]}'!`,
			);
		}

		if (cmd.aliases) {
			for (const alias of cmd.aliases) {
				for (const storage of storageVals) {
					const nameOccupier = storage.find((e) => e === alias);

					if (!nameOccupier) continue;

					throw new BroCliError(
						`Can't define command '${getCommandNameWithParents(cmd)}': alias '${alias}' is already in use by command '${
							parent ? `${getCommandNameWithParents(parent)} ` : ''
						}${storage[0]}'!`,
					);
				}
			}
		}

		storedNames[cmd.name] = cmd.aliases
			? [cmd.name, ...cmd.aliases]
			: [cmd.name];

		if (cmd.subcommands) cmd.subcommands = validateCommands(cmd.subcommands, cmd) as [Command, ...Command[]];
	}

	return commands;
};

const removeByIndex = <T>(arr: T[], idx: number): T[] => [...arr.slice(0, idx), ...arr.slice(idx + 1, arr.length)];

/**
 * Runs CLI commands
 *
 * @param commands - command collection
 *
 * @param config - additional settings
 */
export const run = async (commands: Command[], config?: BroCliConfig): Promise<void> => {
	const eventHandler = config?.theme
		? eventHandlerWrapper(config.theme)
		: defaultEventHandler;
	const argSource = config?.argSource ?? process.argv;
	const version = config?.version;
	const help = config?.help;
	const omitKeysOfUndefinedOptions = config?.omitKeysOfUndefinedOptions ?? false;
	const cliName = config?.cliName;

	try {
		const processedCmds = validateCommands(commands);

		let args = argSource.slice(2, argSource.length);
		if (!args.length) {
			return help !== undefined ? await executeOrLog(help) : await eventHandler({
				type: 'globalHelp',
				cliName,
				commands: processedCmds,
			});
		}

		const helpIndex = args.findIndex((arg) => arg === '--help' || arg === '-h');
		if (
			helpIndex !== -1 && (helpIndex > 0
				? args[helpIndex - 1]?.startsWith('-') && !args[helpIndex - 1]!.includes('=') ? false : true
				: true)
		) {
			const command = getCommand(processedCmds, args).command;

			if (typeof command === 'object') {
				return command.help !== undefined ? await executeOrLog(command.help) : await eventHandler({
					type: 'commandHelp',
					cliName,
					command: command,
				});
			} else {
				return help !== undefined ? await executeOrLog(help) : await eventHandler({
					type: 'globalHelp',
					cliName,
					commands: processedCmds,
				});
			}
		}

		const versionIndex = args.findIndex((arg) => arg === '--version' || arg === '-v');
		if (versionIndex !== -1 && (versionIndex > 0 ? args[versionIndex - 1]?.startsWith('-') ? false : true : true)) {
			return version !== undefined ? await executeOrLog(version) : await eventHandler({
				type: 'version',
				cliName,
			});
		}

		const { command, args: newArgs } = getCommand(processedCmds, args);

		if (!command) {
			return help !== undefined ? await executeOrLog(help) : await eventHandler({
				type: 'globalHelp',
				cliName,
				commands: processedCmds,
			});
		}

		if (command === 'help') {
			let helpCommand: Command | 'help' | undefined;
			let newestArgs: string[] = newArgs;

			do {
				const res = getCommand(processedCmds, newestArgs);
				helpCommand = res.command;
				newestArgs = res.args;
			} while (helpCommand === 'help');

			return helpCommand
				? helpCommand.help !== undefined ? await executeOrLog(helpCommand.help) : await eventHandler({
					type: 'commandHelp',
					cliName,
					command: helpCommand,
				})
				: help !== undefined
				? await executeOrLog(help)
				: await eventHandler({
					type: 'globalHelp',
					cliName,
					commands: processedCmds,
				});
		}

		const optionResult = parseOptions(command, newArgs, cliName, omitKeysOfUndefinedOptions);

		if (optionResult === 'help') {
			return command.help !== undefined ? await executeOrLog(command.help) : await eventHandler({
				type: 'commandHelp',
				cliName,
				command: command,
			});
		}
		if (optionResult === 'version') {
			return version !== undefined ? await executeOrLog(version) : await eventHandler({
				type: 'version',
				cliName,
			});
		}

		if (command.handler) {
			if (config?.hook) await config.hook('before', command);
			await command.handler(command.transform ? await command.transform(optionResult) : optionResult);
			if (config?.hook) await config.hook('after', command);
			return;
		} else {
			return command.help !== undefined ? await executeOrLog(command.help) : await eventHandler({
				type: 'commandHelp',
				cliName,
				command: command,
			});
		}
	} catch (e) {
		if (e instanceof BroCliError) {
			if (e.event) await eventHandler(e.event);
			else {
				// @ts-expect-error - option meant only for tests
				if (!config?.noExit) console.error(e.message);
				// @ts-expect-error - return path meant only for tests
				else return e.message;
			}
		} else {
			await eventHandler({
				type: 'unknownError',
				cliName,
				error: e,
			});
		}

		// @ts-expect-error - option meant only for tests
		if (!config?.noExit) process.exit(1);

		return;
	}
};

export const handler = <TOpts extends Record<string, GenericBuilderInternals>>(
	options: TOpts,
	handler: CommandHandler<TOpts>,
) => handler;

export const test = async <TOpts, THandlerInput>(
	command: Command<TOpts, THandlerInput>,
	args: string,
): Promise<TestResult<THandlerInput>> => {
	try {
		const cliParsedArgs: string[] = shellArgs(args);
		const options = parseOptions(command, cliParsedArgs);

		if (options === 'help' || options === 'version') {
			return {
				type: options,
			};
		}

		return {
			options: command.transform ? await command.transform(options) : options,
			type: 'handler',
		};
	} catch (e) {
		return {
			type: 'error',
			error: e,
		};
	}
};

export const commandsInfo = (
	commands: Command[],
): CommandsInfo => {
	const validated = validateCommands(commands);

	return Object.fromEntries(validated.map((c) => [c.name, {
		name: c.name,
		aliases: clone(c.aliases),
		desc: c.desc,
		shortDesc: c.shortDesc,
		isHidden: c.hidden,
		options: c.options
			? Object.fromEntries(Object.entries(c.options).map(([key, opt]) => [key, clone(opt.config)]))
			: undefined,
		metadata: clone(c.metadata),
		subcommands: c.subcommands ? commandsInfo(c.subcommands) : undefined,
	}]));
};
