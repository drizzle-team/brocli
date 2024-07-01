import { BroCliError } from './brocli-error';

export type OptionType = 'string' | 'boolean' | 'number' | 'positional';

export type OutputType = string | boolean | number | undefined;

export type BuilderConfig<TType extends OptionType = OptionType> = {
	name?: string | undefined;
	aliases: string[];
	type: TType;
	description?: string;
	default?: OutputType;
	isHidden?: boolean;
	isRequired?: boolean;
	isInt?: boolean;
	minVal?: number;
	maxVal?: number;
	enumVals?: [string, ...string[]];
};

export type ProcessedBuilderConfig = {
	name: string;
	aliases: string[];
	type: OptionType;
	description?: string;
	default?: OutputType;
	isHidden?: boolean;
	isRequired?: boolean;
	isInt?: boolean;
	minVal?: number;
	maxVal?: number;
	enumVals?: [string, ...string[]];
};

export type BuilderConfigLimited = BuilderConfig & {
	type: Exclude<OptionType, 'positional'>;
};

export class OptionBuilderBase<
	TBuilderConfig extends BuilderConfig = BuilderConfig,
	TOutput extends OutputType = string,
	TOmit extends string = '',
	TEnums extends string | undefined = undefined,
> {
	public _: {
		config: TBuilderConfig;
		/**
		 * Type-level only field
		 *
		 * Do not attempt to access at a runtime
		 */
		$output: TOutput;
	};

	private config = (): TBuilderConfig => this._.config;

	constructor(config?: TBuilderConfig) {
		this._ = {
			config: config ?? {
				aliases: [],
				type: 'string',
			} as unknown as TBuilderConfig,
			$output: undefined as any as TOutput,
		};
	}

	public string<TName extends string>(name: TName): Omit<
		OptionBuilderBase<
			BuilderConfig<'string'>,
			string | undefined,
			TOmit | OptionType | 'min' | 'max' | 'int'
		>,
		TOmit | OptionType | 'min' | 'max' | 'int'
	>;
	public string(): Omit<
		OptionBuilderBase<
			BuilderConfig<'string'>,
			string | undefined,
			TOmit | OptionType | 'min' | 'max' | 'int'
		>,
		TOmit | OptionType | 'min' | 'max' | 'int'
	>;
	public string(
		name?: string,
	) {
		const config = this.config();

		return new OptionBuilderBase({ ...config, type: 'string', name: name }) as any;
	}

	public number<TName extends string>(name: TName): Omit<
		OptionBuilderBase<
			BuilderConfig<'number'>,
			number | undefined,
			TOmit | OptionType | 'enum'
		>,
		TOmit | OptionType | 'enum'
	>;
	public number(): Omit<
		OptionBuilderBase<
			BuilderConfig<'number'>,
			string | undefined,
			TOmit | OptionType | 'enum'
		>,
		TOmit | OptionType | 'enum'
	>;
	public number(
		name?: string,
	) {
		const config = this.config();

		return new OptionBuilderBase({ ...config, type: 'number', name: name }) as any;
	}

	public boolean<TName extends string>(name: TName): Omit<
		OptionBuilderBase<
			BuilderConfig<'boolean'>,
			boolean | undefined,
			TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'
		>,
		TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'
	>;
	public boolean(): Omit<
		OptionBuilderBase<
			BuilderConfig<'boolean'>,
			boolean | undefined,
			TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'
		>,
		TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'
	>;
	public boolean(
		name?: string,
	) {
		const config = this.config();

		return new OptionBuilderBase({ ...config, type: 'boolean', name: name }) as any;
	}

	public positional<TName extends string>(displayName: TName): Omit<
		OptionBuilderBase<
			BuilderConfig<'positional'>,
			string | undefined,
			TOmit | OptionType | 'min' | 'max' | 'int' | 'alias'
		>,
		TOmit | OptionType | 'min' | 'max' | 'int' | 'alias'
	>;
	public positional(): Omit<
		OptionBuilderBase<
			BuilderConfig<'positional'>,
			string | undefined,
			TOmit | OptionType | 'min' | 'max' | 'int' | 'alias'
		>,
		TOmit | OptionType | 'min' | 'max' | 'int' | 'alias'
	>;
	public positional(displayName?: string) {
		const config = this.config();

		return new OptionBuilderBase({ ...config, type: 'positional', name: displayName }) as any;
	}

	public alias(
		...aliases: string[]
	): Omit<
		OptionBuilderBase<
			TBuilderConfig,
			TOutput,
			TOmit | 'alias'
		>,
		TOmit | 'alias'
	> {
		const config = this.config();

		return new OptionBuilderBase({ ...config, aliases }) as any;
	}

	public desc<TDescription extends string>(description: TDescription): Omit<
		OptionBuilderBase<
			TBuilderConfig,
			TOutput,
			TOmit | 'desc'
		>,
		TOmit | 'desc'
	> {
		const config = this.config();

		return new OptionBuilderBase({ ...config, description }) as any;
	}

	public hidden(): Omit<
		OptionBuilderBase<
			TBuilderConfig,
			TOutput,
			TOmit | 'hidden'
		>,
		TOmit | 'hidden'
	> {
		const config = this.config();

		return new OptionBuilderBase({ ...config, isHidden: true }) as any;
	}

	public required(): Omit<
		OptionBuilderBase<
			TBuilderConfig,
			Exclude<TOutput, undefined>,
			TOmit | 'required' | 'default'
		>,
		TOmit | 'required' | 'default'
	> {
		const config = this.config();

		return new OptionBuilderBase({ ...config, isRequired: true }) as any;
	}

	public default<TDefVal extends TEnums extends undefined ? Exclude<TOutput, undefined> : TEnums>(value: TDefVal): Omit<
		OptionBuilderBase<
			TBuilderConfig,
			Exclude<TOutput, undefined>,
			TOmit | 'enum' | 'required' | 'default',
			TEnums
		>,
		TOmit | 'enum' | 'required' | 'default'
	> {
		const config = this.config();

		const enums = config.enumVals;
		if (enums && !enums.find((v) => value === v)) {
			throw new Error(
				`Option enums [ ${enums.join(', ')} ] are incompatible with default value ${value}`,
			);
		}

		return new OptionBuilderBase({ ...config, default: value }) as any;
	}

	public enum<TValues extends [string, ...string[]]>(...values: TValues): Omit<
		OptionBuilderBase<
			TBuilderConfig,
			TValues[number],
			TOmit | 'enum',
			TValues[number]
		>,
		TOmit | 'enum'
	> {
		const config = this.config();

		const defaultVal = config.default;
		if (defaultVal !== undefined && !values.find((v) => defaultVal === v)) {
			throw new Error(
				`Option enums [ ${values.join(', ')} ] are incompatible with default value ${defaultVal}`,
			);
		}

		return new OptionBuilderBase({ ...config, enumVals: values }) as any;
	}

	public min(value: number): Omit<
		OptionBuilderBase<
			TBuilderConfig,
			TOutput,
			TOmit | 'min'
		>,
		TOmit | 'min'
	> {
		const config = this.config();

		const maxVal = config.maxVal;
		if (maxVal !== undefined && maxVal < value) {
			throw new BroCliError("Unable to define option's min value to be higher than max value!");
		}

		return new OptionBuilderBase({ ...config, minVal: value }) as any;
	}

	public max(value: number): Omit<
		OptionBuilderBase<
			TBuilderConfig,
			TOutput,
			TOmit | 'max'
		>,
		TOmit | 'max'
	> {
		const config = this.config();

		const minVal = config.minVal;
		if (minVal !== undefined && minVal < value) {
			throw new BroCliError("Unable to define option's max value to be lower than min value!");
		}

		return new OptionBuilderBase({ ...config, maxVal: value }) as any;
	}

	public int(): Omit<
		OptionBuilderBase<
			TBuilderConfig,
			TOutput,
			TOmit | 'int'
		>,
		TOmit | 'int'
	> {
		const config = this.config();

		return new OptionBuilderBase({ ...config, isInt: true }) as any;
	}
}

export type GenericBuilderInternalsFields = {
	/**
	 * Type-level only field
	 *
	 * Do not attempt to access at a runtime
	 */
	$output: OutputType;
	config: BuilderConfig;
};

export type GenericBuilderInternals = {
	_: GenericBuilderInternalsFields;
};

export type GenericBuilderInternalsFieldsLimited = {
	/**
	 * Type-level only field
	 *
	 * Do not attempt to access at a runtime
	 */
	$output: OutputType;
	config: BuilderConfigLimited;
};

export type GenericBuilderInternalsLimited = {
	_: GenericBuilderInternalsFieldsLimited;
};

export type ProcessedOptions<
	TOptionConfig extends Record<string, GenericBuilderInternals> = Record<string, GenericBuilderInternals>,
> = {
	[K in keyof TOptionConfig]: K extends string ? {
			config: ProcessedBuilderConfig;
			/**
			 * Type-level only field
			 *
			 * Do not attempt to access at a runtime
			 */
			$output: TOptionConfig[K]['_']['$output'];
		}
		: never;
};

export type Simplify<T> =
	& {
		[K in keyof T]: T[K];
	}
	& {};

export type TypeOf<TOptions extends Record<string, GenericBuilderInternals>> = Simplify<
	{
		[K in keyof TOptions]: TOptions[K]['_']['$output'];
	}
>;

export function string<TName extends string>(
	name: TName,
): Omit<
	OptionBuilderBase<
		BuilderConfig<'string'>,
		string | undefined,
		OptionType | 'min' | 'max' | 'int'
	>,
	OptionType | 'min' | 'max' | 'int'
>;
export function string(): Omit<
	OptionBuilderBase<
		BuilderConfig<'string'>,
		string | undefined,
		OptionType | 'min' | 'max' | 'int'
	>,
	OptionType | 'min' | 'max' | 'int'
>;
export function string<TName extends string>(name?: TName) {
	return typeof name === 'string' ? new OptionBuilderBase().string(name) : new OptionBuilderBase().string();
}

export function number<TName extends string>(
	name: TName,
): Omit<
	OptionBuilderBase<
		BuilderConfig<'number'>,
		number | undefined,
		OptionType | 'enum'
	>,
	OptionType | 'enum'
>;
export function number(): Omit<
	OptionBuilderBase<
		BuilderConfig<'number'>,
		number | undefined,
		OptionType | 'enum'
	>,
	OptionType | 'enum'
>;
export function number<TName extends string>(name?: TName) {
	return typeof name === 'number' ? new OptionBuilderBase().number(name) : new OptionBuilderBase().number();
}

export function boolean<TName extends string>(
	name: TName,
): Omit<
	OptionBuilderBase<
		BuilderConfig<'boolean'>,
		boolean | undefined,
		OptionType | 'min' | 'max' | 'int' | 'enum'
	>,
	OptionType | 'min' | 'max' | 'int' | 'enum'
>;
export function boolean(): Omit<
	OptionBuilderBase<
		BuilderConfig<'boolean'>,
		boolean | undefined,
		OptionType | 'min' | 'max' | 'int' | 'enum'
	>,
	OptionType | 'min' | 'max' | 'int' | 'enum'
>;
export function boolean<TName extends string>(name?: TName) {
	return typeof name === 'string' ? new OptionBuilderBase().boolean(name) : new OptionBuilderBase().boolean();
}

export function positional<TName extends string>(displayName: TName): Omit<
	OptionBuilderBase<
		BuilderConfig<'positional'>,
		string | undefined,
		OptionType | 'min' | 'max' | 'int' | 'alias'
	>,
	OptionType | 'min' | 'max' | 'int' | 'alias'
>;
export function positional(): Omit<
	OptionBuilderBase<
		BuilderConfig<'positional'>,
		string | undefined,
		OptionType | 'min' | 'max' | 'int' | 'alias'
	>,
	OptionType | 'min' | 'max' | 'int' | 'alias'
>;
export function positional(displayName?: string) {
	return typeof displayName === 'number'
		? new OptionBuilderBase().positional(displayName)
		: new OptionBuilderBase().positional();
}
