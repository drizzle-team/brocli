export function isInt(value: number) {
	return value === Math.floor(value);
}

/**
 * Warning: do not use on classes - breaks instanceof, this
 */
export const clone = <T>(data: T): T => {
	switch (typeof data) {
		case 'object': {
			if (data === null) return data;
			if (Array.isArray(data)) {
				return data.map((d) => clone(d)) as T;
			}

			const origData = Object.entries(data);
			const cloneData: typeof origData = [];

			for (const [key, value] of origData) {
				cloneData.push([key, clone(value)]);
			}

			return Object.fromEntries(cloneData) as T;
		}

		case 'function': {
			return data;
		}

		case 'undefined': {
			return data;
		}

		default:
			return JSON.parse(JSON.stringify(data));
	}
};
