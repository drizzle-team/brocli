import clone from 'clone';
import { BroCliError } from './brocli-error';
import { defaultTheme } from './help-themes';
import {
	type GenericBuilderInternals,
	type GenericBuilderInternalsFields,
	GenericBuilderInternalsLimited,
	type OutputType,
	positional,
	type ProcessedBuilderConfig,
	type ProcessedOptions,
	string,
	type TypeOf,
} from './option-builder';
import { isInt } from './util';

// Type area
export type HelpHandler = (calledFor: Command | Command[]) => any;

export type CommandHandler<
	TOpts extends Record<string, GenericBuilderInternals> | undefined =
		| Record<string, GenericBuilderInternals>
		| undefined,
> = (
	options: TOpts extends Record<string, GenericBuilderInternals> ? TypeOf<TOpts> : undefined,
) => any;

export type BroCliConfig = {
	argSource?: string[];
	help?: HelpHandler;
	version?: string | Function;
	omitKeysOfUndefinedOptions?: boolean;
};

export type GenericCommandHandler = (options?: Record<string, OutputType> | undefined) => any;

export type RawCommand<
	TOpts extends Record<string, GenericBuilderInternals> | undefined =
		| Record<string, GenericBuilderInternals>
		| undefined,
> =
	& {
		name?: string;
		aliases?: [string, ...string[]];
		description?: string;
		hidden?: boolean;
		options?: TOpts;
		help?: string | Function;
		handler?: CommandHandler<TOpts>;
	}
	& (TOpts extends Record<string, GenericBuilderInternalsLimited> | undefined ? {
			subcommands?: [Command, ...Command[]];
		}
		: {});

export type Command = {
	name: string;
	aliases?: [string, ...string[]];
	description?: string;
	hidden?: boolean;
	options?: ProcessedOptions;
	help?: string | Function;
	handler: GenericCommandHandler;
	subcommands?: [Command, ...Command[]];
};

// Message area
const unknownCommand = () => {
	const msg = `Unable to recognize any of the commands.\nUse 'help' command to list all commands.`;

	return new Error(msg);
};

const missingRequired = (command: RawCommand<any>, missingOpts: [string[], ...string[][]]) => {
	const msg = `Command '${command.name}' is missing following required options: ${
		missingOpts.map((opt) => {
			const name = opt.shift()!;
			const aliases = opt;

			if (aliases.length) return `${name} [${aliases.join(', ')}]`;

			return name;
		}).join(', ')
	}`;

	return new Error(msg);
};

const unrecognizedOptions = (command: RawCommand<any>, unrecognizedArgs: [string, ...string[]]) => {
	const msg = `Unrecognized options for command '${command.name}': ${unrecognizedArgs.join(', ')}`;

	return new Error(msg);
};

const invalidBooleanSyntax = (matchedName: string) => {
	return new Error(
		`Invalid syntax: boolean type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value> | ${matchedName}.\nAllowed values: true, false, 0, 1`,
	);
};

const invalidStringSyntax = (matchedName: string) => {
	return new Error(
		`Invalid syntax: string type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value>`,
	);
};

const enumViolation = (matchedName: string, data: string | undefined, values: [string, ...string[]]) => {
	return new Error(
		`Invalid value: value for the argument '${matchedName}' must be either one of the following: ${
			values.join(', ')
		}; Received: ${data}`,
	);
};

const enumViolationPos = (matchedName: string, data: string | undefined, values: [string, ...string[]]) => {
	return new Error(
		`Invalid value: value for the argument '${matchedName}' must be either one of the following: ${
			values.join(', ')
		}; Received: ${data}`,
	);
};

const invalidNumberSyntax = (matchedName: string) => {
	return new Error(
		`Invalid syntax: number type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value>`,
	);
};

const invalidNumberValue = (matchedName: string, data: string | undefined) => {
	return new Error(
		`Invalid value: number type argument '${matchedName}' expects a number as an input, got: ${data}`,
	);
};

const invalidInteger = (matchedName: string, data: string | undefined) => {
	return new Error(
		`Invalid value: number type argument '${matchedName}' expects an integer as an input, got: ${data}`,
	);
};

const belowMin = (matchedName: string, data: string | undefined, min: number) => {
	return new Error(
		`Invalid value: number type argument '${matchedName}' expects minimal value of ${min} as an input, got: ${data}`,
	);
};

const aboveMax = (matchedName: string, data: string | undefined, max: number) => {
	return new Error(
		`Invalid value: number type argument '${matchedName}' expects maximal value of ${max} as an input, got: ${data}`,
	);
};

// Main area
const generatePrefix = (name: string) => name.startsWith('-') ? name : name.length > 1 ? `--${name}` : `-${name}`;

const validateOptions = <TOptionConfig extends Record<string, GenericBuilderInternals>>(
	config: TOptionConfig,
): ProcessedOptions<TOptionConfig> => {
	const cloned = clone(config);

	const entries: [string, GenericBuilderInternalsFields][] = [];

	const storedNames: Record<string, [string, ...string[]]> = {};

	const cfgEntries = Object.entries(cloned);

	for (const [key, value] of cfgEntries) {
		const cfg = value._.config;

		if (cfg.name === undefined) cfg.name = key;

		if (cfg.type === 'positional') continue;

		if (cfg.name!.includes('=')) {
			throw new BroCliError(
				`Can't define option ${cfg.name} - option names and aliases cannot contain '='!`,
			);
		}

		for (const alias of cfg.aliases) {
			if (alias.includes('=')) {
				throw new BroCliError(
					`Can't define option ${cfg.name} - option names and aliases cannot contain '='!`,
				);
			}
		}

		cfg.name = generatePrefix(cfg.name);

		cfg.aliases = cfg.aliases.map((a) => generatePrefix(a));
	}

	for (const [key, value] of cfgEntries) {
		const cfg = value._.config;

		if (cfg.type === 'positional') continue;

		const reservedNames = ['--help', '-h', '--version', '-v'];

		const allNames = [cfg.name, ...cfg.aliases];

		for (const name of allNames) {
			const match = reservedNames.find((n) => n === name);
			if (match) throw new BroCliError(`Can't define option ${cfg.name} - name '${match}' is reserved!`);
		}

		const storageVals = Object.values(storedNames);

		for (const storage of storageVals) {
			const nameOccupier = storage.find((e) => e === cfg.name);

			if (!nameOccupier) continue;

			throw new BroCliError(
				`Can't define option '${cfg.name}': name is already in use by option '${storage[0]}'!`,
			);
		}

		for (const alias of cfg.aliases) {
			for (const storage of storageVals) {
				const nameOccupier = storage.find((e) => e === alias);

				if (!nameOccupier) continue;

				throw new BroCliError(
					`Can't define option '${cfg.name}': alias '${alias}' is already in use by option '${storage[0]}'!`,
				);
			}
		}

		storedNames[cfg.name!] = [cfg.name!, ...cfg.aliases];

		storedNames[cfg.name!]!.forEach((name, idx) => {
			if (storedNames[cfg.name!]!.findIndex((e) => e === name) === idx) return;

			throw new BroCliError(
				`Can't define option '${cfg.name}': duplicate aliases '${name}'!`,
			);
		});

		entries.push([key, { config: cfg, $output: undefined as any }]);
	}

	return Object.fromEntries(entries) as ProcessedOptions<any>;
};

export const command = <
	TOpts extends Record<string, GenericBuilderInternals> | undefined,
>(command: RawCommand<TOpts>) => {
	const allNames = command.aliases ? [command.name, ...command.aliases] : [command.name];

	const processedOptions = command.options ? validateOptions(command.options) : undefined;
	const cmd: Command = command as any;

	cmd.options = processedOptions;

	cmd.name = cmd.name ?? cmd.aliases?.shift();

	if (!cmd.name) throw new BroCliError(`Can't define command without name!`);

	cmd.aliases = cmd.aliases?.length ? cmd.aliases : undefined;

	if (!cmd.handler) throw new BroCliError(`Can't define command '${cmd.name}' - command must have a handler!`);

	if (cmd.name.startsWith('-')) {
		throw new BroCliError(`Can't define command '${cmd.name}' - command name can't start with '-'!`);
	}

	cmd.aliases?.forEach((a) => {
		if (a.startsWith('-')) {
			throw new BroCliError(`Can't define command '${cmd.name}' - command aliases can't start with '-'!`);
		}
	});

	allNames.forEach((n, i) => {
		const idx = allNames.findIndex((an) => an === n);

		if (idx !== i) throw new BroCliError(`Can't define command '${cmd.name}' - duplicate alias '${n}'!`);
	});

	return cmd;
};

const getCommand = (commands: Command[], args: string[]) => {
	let index: number = -1;
	let command: Command | undefined;

	for (let i = 0; i < args.length; ++i) {
		const arg = args[i];
		if (arg?.startsWith('-')) {
			if (!arg.includes('=')) ++i;

			continue;
		}

		command = commands.find((c) => {
			const names = c.aliases ? [c.name, ...c.aliases] : [c.name];
			const res = names.find((name) => name === arg);

			if (res) index = i;

			return res;
		});

		if (command) break;
	}

	return {
		command,
		index,
	};
};

const parseArg = (
	options: [string, ProcessedBuilderConfig][],
	positionals: [string, ProcessedBuilderConfig][],
	arg: string,
	nextArg: string | undefined,
) => {
	let data: OutputType = undefined;

	const argSplit = arg.split('=');
	const hasEq = arg.includes('=');

	const namePart = argSplit.shift();
	const dataPart = hasEq ? argSplit.join('=') : nextArg;
	let skipNext = !hasEq;

	if (!arg.startsWith('-')) {
		if (!positionals.length) return {};

		const pos = positionals.shift()!;

		if (pos[1].enumVals && !pos[1].enumVals.find((val) => val === dataPart)) {
			throw enumViolationPos(pos[1].name!, arg, pos[1].enumVals);
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

			throw invalidBooleanSyntax(match);
		} else {
			const match = names.find((name) => name === namePart);

			if (!match) return false;

			if (opt.type === 'string') {
				if (!hasEq && nextArg === undefined) throw invalidStringSyntax(match);

				if (opt.enumVals && !opt.enumVals.find((val) => val === dataPart)) {
					throw enumViolation(match, dataPart, opt.enumVals);
				}

				data = dataPart;

				return true;
			}

			if (!hasEq && nextArg === undefined) throw invalidNumberSyntax(match);

			const numData = Number(dataPart);

			if (isNaN(numData)) throw invalidNumberValue(match, dataPart);

			if (opt.isInt && !isInt(numData)) throw invalidInteger(match, dataPart);

			if (opt.minVal !== undefined && numData < opt.minVal) throw belowMin(match, dataPart, opt.minVal);

			if (opt.maxVal !== undefined && numData > opt.maxVal) throw aboveMax(match, dataPart, opt.maxVal);

			data = dataPart;

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
	omitKeysOfUndefinedOptions?: boolean,
): Record<string, OutputType> | undefined => {
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
		} = parseArg(nonPositionalEntries, positionalEntries, arg, nextArg);
		if (!option) unrecognizedArgsArr.push(arg.split('=')[0]!);
		if (skipNext) ++i;

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

	if (missingRequiredArr.length) throw missingRequired(command, missingRequiredArr as [string[], ...string[][]]);
	if (unrecognizedArgsArr.length) throw unrecognizedOptions(command, unrecognizedArgsArr as [string, ...string[]]);

	return result;
};

const executeOrLog = async (target: string | Function | undefined) => {
	if (!target || typeof target === 'string') console.log(target);
	else await target();
};

const helpCommand = (commands: Command[], helpHandler: HelpHandler) =>
	command({
		name: 'help',
		description: 'List commands or command details',
		options: {
			command: string().alias('c', 'cmd').desc('Target command'),
			pos: positional().desc('Target command'),
		},
		hidden: true,
		handler: async (options) => {
			const { command, pos } = options;

			if (command === undefined && pos === undefined) {
				return await helpHandler(commands);
			}

			const cmd = commands.find((e) => e.name === pos || e.aliases?.find((a) => a === pos))
				?? commands.find((e) => e.name === command || e.aliases?.find((a) => a === command));
			if (cmd) {
				return cmd.help ? await executeOrLog(cmd.help) : await helpHandler(cmd);
			}

			return await helpHandler(commands);
		},
	});

const validateCommands = (commands: Command[]) => {
	const cloned = clone(commands);
	const storedNames: Record<string, [string, ...string[]]> = {};

	for (const cmd of cloned) {
		const storageVals = Object.values(storedNames);

		for (const storage of storageVals) {
			const nameOccupier = storage.find((e) => e === cmd.name);

			if (!nameOccupier) continue;

			throw new Error(
				`Can't define command '${cmd.name}': name is already in use by command '${storage[0]}'!`,
			);
		}

		if (cmd.aliases) {
			for (const alias of cmd.aliases) {
				for (const storage of storageVals) {
					const nameOccupier = storage.find((e) => e === alias);

					if (!nameOccupier) continue;

					throw new Error(
						`Can't define command '${cmd.name}': alias '${alias}' is already in use by command '${storage[0]}'!`,
					);
				}
			}
		}

		storedNames[cmd.name] = cmd.aliases
			? [cmd.name, ...cmd.aliases]
			: [cmd.name];
	}

	return cloned;
};

/**
 * Separated for testing purposes
 */
export const rawCli = async (commands: Command[], config?: BroCliConfig) => {
	let options: Record<string, OutputType> | undefined;
	let cmd: Command;

	const processedCmds = validateCommands(commands);

	const argSource = config?.argSource ?? process.argv;
	const version = config?.version;
	const helpHandler = config?.help ?? defaultTheme;
	const omitKeysOfUndefinedOptions = config?.omitKeysOfUndefinedOptions ?? false;
	const cmds = [...processedCmds, helpCommand(processedCmds, helpHandler)];

	let args = argSource.slice(2, argSource.length);
	if (!args.length) return await helpHandler(processedCmds);

	const helpIndex = args.findIndex((arg) => arg === '--help' || arg === '-h');
	if (helpIndex !== -1 && (helpIndex > 0 ? args[helpIndex - 1]?.startsWith('-') ? false : true : true)) {
		let command: Command | undefined;
		if (args[helpIndex + 1]?.startsWith('-')) {
			command = getCommand(cmds, args).command;
		} else {
			const targetName = args[helpIndex + 1]!;

			command = cmds.find((cmd) => {
				const names = cmd.aliases ? [cmd.name, ...cmd.aliases] : [cmd.name];

				return names.find((n) => n === targetName);
			});

			command = command ?? getCommand(cmds, args).command;
		}

		return command
			? command.help ? await executeOrLog(command.help) : await helpHandler(command)
			: await helpHandler(processedCmds);
	}

	const versionIndex = args.findIndex((arg) => arg === '--version' || arg === '-v');
	if (versionIndex !== -1 && (versionIndex > 0 ? args[versionIndex - 1]?.startsWith('-') ? false : true : true)) {
		return await executeOrLog(version);
	}

	const { command, index } = getCommand(cmds, args);
	if (!command) throw unknownCommand();

	args = [...args.slice(0, index), ...args.slice(index + 1, args.length)];
	options = parseOptions(command, args, omitKeysOfUndefinedOptions);
	cmd = command;

	await cmd.handler(options);
	return undefined;
};

/**
 * Runs CLI commands
 *
 * @param commands - command collection
 *
 * @param argSource - source of cli arguments, optionally passed as a parameter for testing purposes and compatibility with custom environments
 */
export const runCli = async (commands: Command[], config?: BroCliConfig) => {
	try {
		await rawCli(commands, config);
	} catch (e) {
		if (e instanceof BroCliError) throw e;

		console.log(typeof e === 'object' && e !== null && 'message' in e ? e.message : e);

		process.exit(1);
	}
};

export const handler = <TOpts extends Record<string, GenericBuilderInternals>>(
	options: TOpts,
	handler: CommandHandler<TOpts>,
) => handler;
