import type { Command, HelpHandler } from './command-core';
import type { ProcessedOptions } from './option-builder';

export const defaultTheme: HelpHandler = (calledFor) => {
	if (Array.isArray(calledFor)) {
		const cmds = calledFor.filter((cmd) => !cmd.hidden);

		const tableCmds = cmds.map((cmd) => ({
			name: cmd.name,
			aliases: cmd.aliases ? cmd.aliases.join(', ') : '-',
			description: cmd.description ?? '-',
		}));

		console.log(`Here's the list of all available commands:`);
		console.table(tableCmds);
		console.log(
			'To read the details about any particular command type: [commandName] --help',
		);
	} else {
		const options = calledFor.options
			? Object.values(calledFor.options).filter((opt) => !opt.config?.isHidden).map(
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
			`Command: ${calledFor.name}${calledFor.aliases ? ` [${calledFor.aliases.join(', ')}]` : ''}${
				calledFor.description ? ` - ${calledFor.description}` : ''
			}`,
		);

		if (!options?.length) return;

		console.log('\nOptions:');
		console.table(options);
	}
};

// Root help
const rootHelp = (commands: Command[]) => {
};

// Command help
const prepareCommandString = (command: Command) => {
	const nameString = command.aliases ? `[${[command.name, ...command.aliases].join(' | ')}]` : command.name;

	const optEntries = Object.entries(command.options ?? {} as Exclude<typeof command.options, undefined>);

	const positionals = optEntries.filter(
		(opt) => !opt[1].config.isHidden && opt[1].config.type === 'positional',
	).map((p) => p[1].config.isRequired ? `[${p[1].config.name}]` : `<${p[1].config.name}>`);

	const hasOpts = (optEntries.length - positionals.length) > 0;

	const posString = positionals.join(' ');

	const optionsString = hasOpts ? `[options]` : '';

	return ['Usage:', [nameString, posString, optionsString].filter((s) => s.length).join(' ')].filter((e) => e !== '')
		.join('\n');
};

const padToLength = (input: string, length: number) => {
	const output = input.length < length ? (input + ' '.repeat(length - input.length)) : input;

	return output;
};

const lineBreak = /(\r)?\n/g;

const splitByMaxLen = (input: string, length: number) => {
	if (input.length <= length) return input.split(lineBreak).map((i) => padToLength(i, length));

	let output: string[] = [];

	for (let line of input.split(lineBreak)) {
		do {
			if (line.length <= length) {
				output.push(padToLength(line, length));

				break;
			}

			let nearSpace = -1;

			let i = line.length - 1;
			do {
				if (line[i] != ' ') continue;

				nearSpace = i;
				break;
			} while (i-- > 0);

			const splitMark = nearSpace == -1 ? length - 1 : ++nearSpace;
			const cLine = line.slice(0, splitMark + 1);
			const rem = line.slice(splitMark + 1, line.length);

			line = rem;

			output.push(padToLength(cLine, length));
		} while (line.length);
	}

	return output;
};

const prepareOptionStrings = (options: ProcessedOptions) => {
	const opts = Object.entries(options)
		.filter((opt) => !opt[1].config.isHidden && opt[1].config.type !== 'positional').map((opt) => opt[1].config);

	if (!opts.length) return '';

	const lengths = [2, 38, 30, 50];
	const maxLen = lengths.reduce((p, e) => p + e, 0);

	const strData = opts.map((opt) => {
		const reqPrefix = opt.isRequired ? ' !' : '  ';

		const rawAliases = opt.aliases.join(', ');

		const aliases = rawAliases.length ? `${rawAliases},` : '';

		const enumPart = opt.enumVals
			? `[ ${opt.enumVals.join(' | ')} ]`
			: opt.minVal !== undefined || opt.maxVal !== undefined
			? `${opt.minVal !== undefined ? `[ ${opt.minVal}` : '( ∞'} ; ${opt.maxVal !== undefined ? opt.maxVal : '∞ )'} ]`
			: '';

		const namePart = enumPart ? `${opt.name} ${enumPart}` : opt.name;

		const description = `${opt.description ? `${opt.description}` : ''}${
			opt.description !== undefined && opt.default !== undefined ? ' ' : ''
		}${opt.default !== undefined ? `(default: ${opt.default})` : ''}`;

		const data = [reqPrefix, aliases, namePart, description];
		return data.map((str, i) => splitByMaxLen(str, lengths[i]!));
	});

	for (let outerIdx = 0; outerIdx < strData.length; ++outerIdx) {
		const cData = strData[outerIdx]!;
		const rowMax = cData.reduce((p, e) => e.length > p ? e.length : p, 0);

		cData.forEach((d, i) => {
			if (d.length >= rowMax) return;

			do {
				d.push(padToLength('', lengths[i]!));
			} while (d.length < maxLen);
		});
	}

	const lines: string[] = [];

	const lineCnt = (strData[0]?.length ?? -1) + 1;
	const iterations = lineCnt * strData.length;

	let dataIdx = 0;
	let lineIdx = 0;
	let iterCount = 0;

	let line = '';

	while (iterCount++ < iterations) {
		if (lineIdx != 0 || lineIdx !== lineCnt) {
			line = line + ' ';
		}

		line = line + strData[dataIdx]![dataIdx]!;

		if (lineIdx == lineCnt) {
			++dataIdx;
			lineIdx = 0;
			lines.push(line);
		} else {
			++lineIdx;
		}
	}

	return `Options:\n${lines.join('\n')}`;
};

const commandHelp = (command: Command) => {
	const cmd = prepareCommandString(command);
	const options = command.options ? prepareOptionStrings(command.options) : '';

	const toLog = [command.description, cmd, options].filter((e) => e !== '').join('\n\n');

	console.log(toLog);
};

// Theme core
export const defaultThemeWIP: HelpHandler = (calledFor) => {
	if (Array.isArray(calledFor)) {
		rootHelp(calledFor);
	} else {
		commandHelp(calledFor);
	}
};
