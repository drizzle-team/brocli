import type { BroCliEvent } from './event-handler';

export class BroCliValidationError extends Error {
	constructor(public event: BroCliEvent, message?: string) {
		super(message);
	}
}
