export function isInt(value: number) {
	return value === Math.floor(value);
}

/**
 * Warning: do not use on classes - breaks instanceof, this
 */
export const clone = <T>(data: T, parent?: any): T => {
	switch (typeof data) {
		case 'object': {
			if (data === null) return data;
			if (Array.isArray(data)) {
				return data.map((d) => clone(d)) as T;
			}

			const origData = Object.entries(data);
	
			let hasParent = false
			const res: Record<string, any> = {}
			for (const [key, value] of origData) {
				if(key === 'parent') {
					hasParent = true
					continue
				} 

				res[key] = clone(value, res);
			}

			if(hasParent) res['parent'] = parent

			return res as T
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
