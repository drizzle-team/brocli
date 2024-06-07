import { GenericBuilderInternalsFields, OutputType, ProcessedOptions, TypeOf } from './option-builder';

// Message area
export const help = () => {
	const cmds = Object.values(commandStorage).filter((cmd) => !cmd.hidden);

	const tableCmds = cmds.map((cmd) => ({
		name: cmd.name,
		aliases: cmd.aliases ? cmd.aliases.join(', ') : '-',
		description: cmd.description ?? '-',
	}));

	console.log(`Here's the list of all available commands:`);
	console.table(tableCmds);
	console.log('To read the details about any particular command type: help --command=<command-name>');
};

export const unknownCmd = () => {
	const msg = `Unable to recognize any of the commands.\nUse 'help' command to list all commands.`;

	throw new Error(msg);
};

export const unrecognizedCmd = (cmdName: string) => {
	const msg = `Unrecognized command: ${cmdName}`;

	throw new Error(msg);
};

export const cmdHelp = (command: Command) => {
	const options = command.options
		? Object.values(command.options).filter((opt) => !opt.config.isHidden).map(
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

export const missingRequired = (command: Command<any>, missingOpts: [string[], ...string[][]]) => {
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

// Type area
export type CommandHandler<TOpts extends ProcessedOptions | undefined = ProcessedOptions | undefined> = (
	options: TOpts extends ProcessedOptions ? TypeOf<TOpts> : undefined,
) => any;

export type Command<TOpts extends ProcessedOptions | undefined = ProcessedOptions | undefined> = {
	name: string;
	aliases?: [string, ...string[]];
	description?: string;
	hidden?: boolean;
	options?: TOpts;
	handler: CommandHandler<TOpts>;
};

// Main area
export const commandStorage: Record<string, Command<any>> = {};

const storedNames: Record<string, [string, ...string[]]> = {};

export const unrecognizedOptions = (command: Command<any>, unrecognizedArgs: [string, ...string[]]) => {
	const msg = `Unrecognized options for command '${command.name}': ${unrecognizedArgs.join(', ')}`;

	throw new Error(msg);
};

export const defineCommand = <
	TOpts extends ProcessedOptions | undefined,
>(command: Command<TOpts>) => {
	if (command.name.startsWith('-')) {
		throw new Error(`Brocli error: can't define command '${command.name}' - command name can't start with '-'!`);
	}
	command.aliases?.forEach((a) => {
		if (a.startsWith('-')) {
			throw new Error(`Brocli error: can't define command '${command.name}' - command aliases can't start with '-'!`);
		}
	});

	const allNames = command.aliases ? [command.name, ...command.aliases] : [command.name];

	allNames.forEach((n, i) => {
		const idx = allNames.findIndex((an) => an === n);

		if (idx !== i) throw new Error(`Brocli error: can't define command '${command.name}' - duplicate alias '${n}'!`);
	});

	const storageVals = Object.values(storedNames);

	// Special case to allow users to redefine 'help'
	if (command.name !== 'help') {
		for (const storage of storageVals) {
			const nameOccupier = storage.find((e) => e === command.name);

			if (!nameOccupier) continue;

			throw new Error(
				`Brocli error: can't define command '${command.name}': name is already in use by command '${storage[0]}'!`,
			);
		}
	}

	if (command.aliases) {
		for (const alias of command.aliases) {
			for (const storage of storageVals) {
				const nameOccupier = storage.find((e) => e === alias);

				if (!nameOccupier) continue;

				throw new Error(
					`Brocli error: can't define command '${command.name}': alias '${alias}' is already in use by command '${
						storage[0]
					}'!`,
				);
			}
		}
	}

	storedNames[command.name] = command.aliases
		? [command.name, ...command.aliases]
		: [command.name];
	commandStorage[command.name] = command;
};

const getCommand = (args: string[]) => {
	let index: number = -1;

	const command = Object.values(commandStorage).find((c) =>
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

	const option = options.find(([optKey, { config: opt }]) => {
		const names = [opt.name!, ...opt.aliases];

		switch (opt.type) {
			case 'boolean': {
				const match = names.find((name) => name === arg);
				if (!match) return false;

				data = true;
				return true;
			}

			case 'string': {
				const argSplit = arg.split('=');

				const namePart = argSplit.shift();
				const dataPart = argSplit.join('=');

				const match = names.find((name) => {
					if (namePart !== name) return false;

					return true;
				});

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

const parseOptions = <
	TCommandOpts extends ProcessedOptions | undefined,
>(command: Command<TCommandOpts>, args: string[]): Record<string, OutputType> | undefined => {
	const options = command.options;
	if (!options) return undefined;

	const optEntries = Object.entries(options);

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

/**
 * Runs CLI commands
 *
 * Returns undefined on success, error on failure
 *
 * Does not catch command handler's errors
 *
 * @param argSource - source of cli arguments
 *
 * passed as parameter for testing and custom environments
 */
export const runCli = async (argSource: string[] = process.argv) => {
	let options: Record<string, OutputType> | undefined;
	let cmd: Command<any>;

	try {
		let args = argSource.slice(2, argSource.length);

		const { command, index } = getCommand(args);
		if (!command) return unknownCmd();

		args = [...args.slice(0, index), ...args.slice(index + 1, args.length)];
		options = parseOptions(command, args);
		cmd = command;
	} catch (e) {
		console.error(e instanceof Error ? e.message : e);
		return e;
	}

	await cmd.handler(options);
	return undefined;
};
