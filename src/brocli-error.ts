/**
 * Internal error class used to bypass runCli's logging without stack trace
 *
 * Used only for malformed commands and options
 */
export class BroCliError extends Error {
	constructor(message: string | undefined) {
		const errPrefix = 'Brocli error: ';
		super(message === undefined ? message : `${errPrefix}${message}`);
	}
}
