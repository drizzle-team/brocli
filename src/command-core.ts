import {
	type GenericBuilderInternals,
	type GenericBuilderInternalsFields,
	GenericProcessedOptions,
	type OutputType,
	type ProcessedOptions,
	string,
	type TypeOf,
} from './option-builder';

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

const unknownCmd = () => {
	const msg = `Unable to recognize any of the commands.\nUse 'help' command to list all commands.`;

	throw new Error(msg);
};

const cmdHelp = (command: Command) => {
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

const missingRequired = (command: RawCommand<any>, missingOpts: [string[], ...string[][]]) => {
	const msg = `Command '${command.name}' is missing following required options: ${
		missingOpts.map((opt) => {
			const name = opt.shift()!;
			const aliases = opt;

			if (aliases.length) return `${name} [${aliases.join(', ')}]`;

			return name;
		}).join(', ')
	}`;

	throw new Error(msg);
};

const unrecognizedOptions = (command: RawCommand<any>, unrecognizedArgs: [string, ...string[]]) => {
	const msg = `Unrecognized options for command '${command.name}': ${unrecognizedArgs.join(', ')}`;

	throw new Error(msg);
};

// Type area
export type CommandHandler<
	TOpts extends Record<string, GenericBuilderInternals> | undefined =
		| Record<string, GenericBuilderInternals>
		| undefined,
> = (
	options: TOpts extends Record<string, GenericBuilderInternals> ? TypeOf<TOpts> : undefined,
) => any;

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
			throw new Error(
				`Brocli error: can't define option ${cfg.name} - option names and aliases cannot contain '='!`,
			);
		}

		for (const alias of cfg.aliases) {
			if (alias.includes('=')) {
				throw new Error(
					`Brocli error: can't define option ${cfg.name} - option names and aliases cannot contain '='!`,
				);
			}
		}

		cfg.name = generatePrefix(cfg.name);

		cfg.aliases = cfg.aliases.map((a) => generatePrefix(a));
	}

	for (const [key, value] of cfgEntries) {
		const cfg = value._.config;

		const storageVals = Object.values(storedNames);

		for (const storage of storageVals) {
			const nameOccupier = storage.find((e) => e === cfg.name);

			if (!nameOccupier) continue;

			throw new Error(
				`Brocli error: can't define option '${cfg.name}': name is already in use by option '${storage[0]}'!`,
			);
		}

		for (const alias of cfg.aliases) {
			for (const storage of storageVals) {
				const nameOccupier = storage.find((e) => e === alias);

				if (!nameOccupier) continue;

				throw new Error(
					`Brocli error: can't define option '${cfg.name}': alias '${alias}' is already in use by option '${
						storage[0]
					}'!`,
				);
			}
		}

		storedNames[cfg.name!] = [cfg.name!, ...cfg.aliases];

		storedNames[cfg.name!]!.forEach((name, idx) => {
			if (storedNames[cfg.name!]!.findIndex((e) => e === name) === idx) return;

			throw new Error(
				`Brocli error: can't define option '${cfg.name}': duplicate aliases '${name}'!`,
			);
		});

		entries.push([key, { config: cfg, $output: undefined as any }]);
	}

	return Object.fromEntries(entries) as ProcessedOptions<any>;
};

export const command = <
	TOpts extends Record<string, GenericBuilderInternals> | undefined,
>(command: RawCommand<TOpts>) => {
	const processedOptions = command.options ? validateOptions(command.options) : undefined;
	const cmd: Command = command as any;

	cmd.options = processedOptions;

	if (cmd.name.startsWith('-')) {
		throw new Error(`Brocli error: can't define command '${cmd.name}' - command name can't start with '-'!`);
	}

	cmd.aliases?.forEach((a) => {
		if (a.startsWith('-')) {
			throw new Error(`Brocli error: can't define command '${cmd.name}' - command aliases can't start with '-'!`);
		}
	});

	const allNames = cmd.aliases ? [cmd.name, ...cmd.aliases] : [cmd.name];

	allNames.forEach((n, i) => {
		const idx = allNames.findIndex((an) => an === n);

		if (idx !== i) throw new Error(`Brocli error: can't define command '${cmd.name}' - duplicate alias '${n}'!`);
	});

	return cmd;
};

const getCommand = (commands: Command[], args: string[]) => {
	let index: number = -1;

	const command = commands.find((c) =>
		args.find((arg, i) => {
			const names = c.aliases ? [c.name, ...c.aliases] : [c.name];
			const res = names.find((name) => name === arg);

			if (res) index = i;

			return res;
		})
	);

	return {
		command,
		index,
	};
};

const parseArg = (options: [string, GenericBuilderInternalsFields][], arg: string) => {
	let data: OutputType = undefined;

	const argSplit = arg.split('=');

	const namePart = argSplit.shift();
	const dataPart = argSplit.join('=');

	const option = options.find(([optKey, { config: opt }]) => {
		const names = [opt.name!, ...opt.aliases];

		switch (opt.type) {
			case 'boolean': {
				const match = names.find((name) => name === namePart);
				if (!match) return false;

				if (arg.includes('=')) {
					throw new Error(
						`Invalid syntax: boolean type argument '${opt.name}' must not have a value, pass it in the following format: ${opt.name}`,
					);
				}

				data = true;
				return true;
			}

			case 'string': {
				const match = names.find((name) => name === namePart);

				if (!match) return false;

				if (!arg.includes('=')) {
					throw new Error(
						`Invalid syntax: string type argument '${opt.name}' must have it's value passed in the following format: ${opt.name}=<value>`,
					);
				}

				data = dataPart;

				return true;
			}
		}
	});

	return {
		data,
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

	for (const arg of args) {
		const {
			data,
			name,
			option,
		} = parseArg(optEntries, arg);
		if (!option) unrecognizedArgsArr.push(arg.split('=')[0]!);

		result[name!] = data;
	}

	for (const [optKey, { config: option }] of optEntries) {
		result[optKey] = result[optKey] ?? option.default;

		if (option.isRequired && result[optKey] === undefined) missingRequiredArr.push([option.name!, ...option.aliases]);
	}

	if (missingRequiredArr.length) missingRequired(command, missingRequiredArr as [string[], ...string[][]]);
	if (unrecognizedArgsArr.length) unrecognizedOptions(command, unrecognizedArgsArr as [string, ...string[]]);

	return result;
};

// Default help command
const helpCmd = (commands: Command[]) =>
	command({
		name: 'help',
		description: 'List commands or command details',
		options: {
			command: string().alias('c', 'cmd').desc('List command details'),
		},
		hidden: true,
		handler: (options) => {
			const { command } = options;

			if (command === undefined) return help(commands);

			const cmd = commands.find((e) => e.name === command);
			if (cmd) return cmdHelp(cmd);
			return unknownCmd();
		},
	});

const validateCommands = (commands: Command[]) => {
	const storedNames: Record<string, [string, ...string[]]> = {};

	const cmds = commands.find((c) => c.name === 'help') ? commands : [helpCmd(commands), ...commands];

	for (const cmd of cmds) {
		const storageVals = Object.values(storedNames);

		for (const storage of storageVals) {
			const nameOccupier = storage.find((e) => e === cmd.name);

			if (!nameOccupier) continue;

			throw new Error(
				`Brocli error: can't define command '${cmd.name}': name is already in use by command '${storage[0]}'!`,
			);
		}

		if (cmd.aliases) {
			for (const alias of cmd.aliases) {
				for (const storage of storageVals) {
					const nameOccupier = storage.find((e) => e === alias);

					if (!nameOccupier) continue;

					throw new Error(
						`Brocli error: can't define command '${cmd.name}': alias '${alias}' is already in use by command '${
							storage[0]
						}'!`,
					);
				}
			}
		}

		storedNames[cmd.name] = cmd.aliases
			? [cmd.name, ...cmd.aliases]
			: [cmd.name];
	}

	return cmds;
};

/**
 * Runs CLI commands
 *
 * @param commands - command collection
 *
 * @param argSource - source of cli arguments, optionally passed as a parameter for testing purposes and compatibility with custom environments
 */
export const runCli = (commands: Command[], argSource: string[] = process.argv) => {
	let options: Record<string, OutputType> | undefined;
	let cmd: RawCommand<any>;

	const cmds = validateCommands(commands);

	let args = argSource.slice(2, argSource.length);

	const { command, index } = getCommand(cmds, args);
	if (!command) return unknownCmd();

	args = [...args.slice(0, index), ...args.slice(index + 1, args.length)];
	options = parseOptions(command, args);
	cmd = command;

	cmd.handler(options);
	return undefined;
};
