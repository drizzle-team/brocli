import type { Command } from './command-core';
import type { GenericBuilderInternals, OutputType } from './option-builder';

export type CommandHelpEvent = {
	type: 'commandHelp';
	command: Command;
	args: string[];
};

export type GlobalHelpEvent = {
	type: 'globalHelp';
	commands: Command[];
	args: string[];
};

export type MissingArgsEvent = {
	type: 'missingArgsErr';
	command: Command;
	received: Record<string, OutputType>;
	missing: GenericBuilderInternals[];
};

export type UnrecognizeArgsEvent = {
	type: 'unrecognizedArgsErr';
	command: Command;
	received: Record<string, OutputType>;
	unrecognized: string[];
};

export type BeforeHandlerEvent = {
	type: 'beforeHandler';
	command: Command;
	args: string[];
};

export type AfterHandlerEvent = {
	type: 'afterHandler';
	command: Command;
	args: string[];
};

export type VersionEvent = {
	type: 'version';
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
	| UnrecognizeArgsEvent
	| ValidationErrorEvent;

/**
 * Return `true` if your handler processes the event
 *
 * Return `false` to process event with a built-in handler
 */
export type EventHandler = (event: BroCliEvent) => boolean | Promise<boolean>;
export const defaultEventHandler: EventHandler = async (event) => {
	switch (event.type) {
		case 'commandHelp': {
			return true;
		}
		case 'globalHelp': {
			return true;
		}
		case 'missingArgsErr': {
			return true;
		}
		case 'unrecognizedArgsErr': {
			return true;
		}
		case 'validationError': {
			return true;
		}
	}

	// @ts-expect-error
	return false;
};

export const eventHandlerWrapper = (customEventHandler: EventHandler) => async (event: BroCliEvent) =>
	await customEventHandler(event) ? true : await defaultEventHandler(event);
