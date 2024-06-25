import { BroCliError } from './brocli-error';
import {
	type GenericBuilderInternals,
	type GenericBuilderInternalsFields,
	GenericProcessedOptions,
	type OutputType,
	type ProcessedOptions,
	string,
	type TypeOf,
} from './option-builder';

// Type area
export type CommandHandler<
	TOpts extends Record<string, GenericBuilderInternals> | undefined =
		| Record<string, GenericBuilderInternals>
		| undefined,
> = (
	options: TOpts extends Record<string, GenericBuilderInternals> ? TypeOf<TOpts> : undefined,
) => any;

export type HelpHandler = (commands: Command[]) => any;

export type CommandHelpHandler = (command: Command) => any;

export type VersionHelpHandler = (name: string, version: string) => any;

export type BroCliConfig = {
	name?: string;
	version?: string;
	argSource?: string[];
	help?: HelpHandler;
	commandHelp?: CommandHelpHandler;
	versionHelp?: VersionHelpHandler;
};

export type GenericCommandHandler = (options?: Record<string, OutputType> | undefined) => any;

export type RawCommand<
	TOpts extends Record<string, GenericBuilderInternals> | undefined =
		| Record<string, GenericBuilderInternals>
		| undefined,
> = {
	name: string;
	aliases?: [string, ...string[]];
	description?: string;
	hidden?: boolean;
	options?: TOpts;
	handler: CommandHandler<TOpts>;
};

export type Command = {
	name: string;
	aliases?: [string, ...string[]];
	description?: string;
	hidden?: boolean;
	options?: GenericProcessedOptions;
	handler: GenericCommandHandler;
};

// Message area
const help = (commands: Command[]) => {
	const cmds = commands.filter((cmd) => !cmd.hidden);

	const tableCmds = cmds.map((cmd) => ({
		name: cmd.name,
		aliases: cmd.aliases ? cmd.aliases.join(', ') : '-',
		description: cmd.description ?? '-',
	}));

	console.log(`Here's the list of all available commands:`);
	console.table(tableCmds);
	console.log('To read the details about any particular command type: help --command=<command-name>');
};

const unknownCommand = () => {
	const msg = `Unable to recognize any of the commands.\nUse 'help' command to list all commands.`;

	return new Error(msg);
};

const commandHelp = (command: Command) => {
	const options = command.options
		? Object.values(command.options).filter((opt) => !opt.config?.isHidden).map(
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
		`Command: ${command.name}${command.aliases ? ` [${command.aliases.join(', ')}]` : ''}${
			command.description ? ` - ${command.description}` : ''
		}`,
	);

	if (!options?.length) return;

	console.log('\nOptions:');
	console.table(options);
};

const versionHelp = (name: string, version: string) => {
	console.log(`${name} - ${version}`);
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

// Main area
const generatePrefix = (name: string) => name.startsWith('-') ? name : name.length > 1 ? `--${name}` : `-${name}`;

const validateOptions = <TOptionConfig extends Record<string, GenericBuilderInternals>>(
	config: TOptionConfig,
): ProcessedOptions<TOptionConfig> => {
	const entries: [string, GenericBuilderInternalsFields][] = [];

	const storedNames: Record<string, [string, ...string[]]> = {};

	const cfgEntries = Object.entries(config);

	for (const [key, value] of cfgEntries) {
		const cfg = value._.config;

		if (cfg.name === undefined) cfg.name = key;

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

const parseArg = (options: [string, GenericBuilderInternalsFields][], arg: string, nextArg: string | undefined) => {
	let data: OutputType = undefined;

	const argSplit = arg.split('=');
	const hasEq = arg.includes('=');

	const namePart = argSplit.shift();
	const dataPart = hasEq ? argSplit.join('=') : nextArg;
	let skipNext = !hasEq;

	const option = options.find(([optKey, { config: opt }]) => {
		const names = [opt.name!, ...opt.aliases];

		switch (opt.type) {
			case 'boolean': {
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
			}

			case 'string': {
				const match = names.find((name) => name === namePart);

				if (!match) return false;

				if (!hasEq && nextArg === undefined) throw invalidStringSyntax(match);

				data = dataPart;

				return true;
			}
		}
	});

	return {
		data,
		skipNext,
		name: option?.[0],
		option: option?.[1],
	};
};

const parseOptions = (command: Command, args: string[]): Record<string, OutputType> | undefined => {
	const options = command.options;

	const optEntries = Object.entries(options ?? {} as Exclude<typeof options, undefined>);

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
		} = parseArg(optEntries, arg, nextArg);
		if (!option) unrecognizedArgsArr.push(arg.split('=')[0]!);
		if (skipNext) ++i;

		result[name!] = data;
	}

	for (const [optKey, { config: option }] of optEntries) {
		result[optKey] = result[optKey] ?? option.default;

		if (option.isRequired && result[optKey] === undefined) missingRequiredArr.push([option.name!, ...option.aliases]);
	}

	if (missingRequiredArr.length) throw missingRequired(command, missingRequiredArr as [string[], ...string[][]]);
	if (unrecognizedArgsArr.length) throw unrecognizedOptions(command, unrecognizedArgsArr as [string, ...string[]]);

	return result;
};

const helpCommand = (commands: Command[], helpHandler: HelpHandler, commandHelpHandler: CommandHelpHandler) =>
	command({
		name: 'help',
		description: 'List commands or command details',
		options: {
			command: string().alias('c', 'cmd').desc('List command details'),
		},
		hidden: true,
		handler: (options) => {
			const { command } = options;

			if (command === undefined) return helpHandler(commands);

			const cmd = commands.find((e) => e.name === command);
			if (cmd) return commandHelpHandler(cmd);
			helpHandler(commands);
		},
	});

const validateCommands = (commands: Command[]) => {
	const storedNames: Record<string, [string, ...string[]]> = {};

	for (const cmd of commands) {
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

	return commands;
};

/**
 * Separated for testing purposes
 */
export const rawCli = (commands: Command[], config?: BroCliConfig) => {
	let options: Record<string, OutputType> | undefined;
	let cmd: RawCommand<any>;

	const argSource = config?.argSource ?? process.argv;
	const version = config?.version ?? '0.1.0';
	const name = config?.name ?? 'brocli';
	const versionHelpHandler = config?.versionHelp ?? versionHelp;
	const helpHandler = config?.help ?? help;
	const commandHelpHandler = config?.commandHelp ?? commandHelp;

	const rawCmds = validateCommands(commands);
	const cmds = [...rawCmds, helpCommand(rawCmds, helpHandler, commandHelpHandler)];

	let args = argSource.slice(2, argSource.length);
	if (!args.length) return help(cmds);

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

		return command ? commandHelpHandler(command) : helpHandler(cmds);
	}

	const versionIndex = args.findIndex((arg) => arg === '--version' || arg === '-v');
	if (versionIndex !== -1 && (versionIndex > 0 ? args[versionIndex - 1]?.startsWith('-') ? false : true : true)) {
		return versionHelpHandler(name, version);
	}

	const { command, index } = getCommand(cmds, args);
	if (!command) throw unknownCommand();

	args = [...args.slice(0, index), ...args.slice(index + 1, args.length)];
	options = parseOptions(command, args);
	cmd = command;

	cmd.handler(options);
	return undefined;
};

/**
 * Runs CLI commands
 *
 * @param commands - command collection
 *
 * @param argSource - source of cli arguments, optionally passed as a parameter for testing purposes and compatibility with custom environments
 */
export const runCli = (commands: Command[], config?: BroCliConfig) => {
	try {
		rawCli(commands, config);
	} catch (e) {
		if (e instanceof BroCliError) throw e;

		console.log(typeof e === 'object' && e !== null && 'message' in e ? e.message : e);

		process.exit(1);
	}
};
