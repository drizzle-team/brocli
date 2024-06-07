import { cmdHelp, commandStorage, defineCommand, help, unknownCmd } from './command-core';
import { defineOptions, string } from './option-builder';

defineCommand({
	name: 'help',
	description: 'List commands or command details',
	options: defineOptions({
		command: string().alias('c', 'cmd').desc('List command details'),
	}),
	hidden: true,
	handler: (options) => {
		try {
			const { command } = options;

			if (command === undefined) return help();
			if (commandStorage[command]) return cmdHelp(commandStorage[command]!);
			return unknownCmd();
		} catch (e) {
			console.error(e instanceof Error ? e.message : e);
		}
	},
});

export type { Command, CommandHandler } from './command-core';
export { commandStorage, defineCommand, runCli } from './command-core';
export type {
	AssignConfigName,
	BuilderConfig,
	GenericBuilderConfig,
	GenericBuilderInternals,
	GenericBuilderInternalsFields,
	GenericProcessedOptions,
	OptionBuilderBase,
	OptionType,
	OutputType,
	ProcessedOptions,
	TypeOf,
} from './option-builder';
export { boolean, defineOptions, string } from './option-builder';
