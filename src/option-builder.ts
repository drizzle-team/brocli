import { BrocliError } from '.';

export type OptionType = 'string' | 'boolean' | 'number' | 'positional';

export type OutputType = string | boolean | number | undefined;

export type BuilderConfig = {
	name?: string | undefined;
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

export class OptionBuilderBase<
	TBuilderConfig extends BuilderConfig = BuilderConfig,
	TOutput extends OutputType = string,
	TOmit extends string = '',
	TDefault extends OutputType = undefined,
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

	constructor() {
		this._ = {
			config: {
				aliases: [],
				type: 'string',
			} as unknown as TBuilderConfig,
			$output: undefined as any as TOutput,
		};
	}

	public string<TName extends string>(name: TName): Omit<
		OptionBuilderBase<
			BuilderConfig,
			string | undefined,
			TOmit | OptionType | 'min' | 'max' | 'int'
		>,
		TOmit | OptionType | 'min' | 'max' | 'int'
	>;
	public string(): Omit<
		OptionBuilderBase<
			BuilderConfig,
			string | undefined,
			TOmit | OptionType | 'min' | 'max' | 'int'
		>,
		TOmit | OptionType | 'min' | 'max' | 'int'
	>;
	public string(
		name?: string,
	) {
		this.config().type = 'string';
		this.config().name = name;

		return this as any;
	}

	public number<TName extends string>(name: TName): Omit<
		OptionBuilderBase<
			BuilderConfig,
			number | undefined,
			TOmit | OptionType | 'enum'
		>,
		TOmit | OptionType | 'enum'
	>;
	public number(): Omit<
		OptionBuilderBase<
			BuilderConfig,
			string | undefined,
			TOmit | OptionType | 'enum'
		>,
		TOmit | OptionType | 'enum'
	>;
	public number(
		name?: string,
	) {
		this.config().type = 'number';
		this.config().name = name;

		return this as any;
	}

	public boolean<TName extends string>(name: TName): Omit<
		OptionBuilderBase<
			BuilderConfig,
			boolean | undefined,
			TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'
		>,
		TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'
	>;
	public boolean(): Omit<
		OptionBuilderBase<
			BuilderConfig,
			boolean | undefined,
			TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'
		>,
		TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'
	>;
	public boolean(
		name?: string,
	) {
		this.config().type = 'boolean';
		this.config().name = name;

		return this as any;
	}

	public positional(): Omit<
		OptionBuilderBase<
			BuilderConfig,
			string | undefined,
			TOmit | OptionType | 'min' | 'max' | 'int' | 'alias'
		>,
		TOmit | OptionType | 'min' | 'max' | 'int' | 'alias'
	> {
		this.config().type = 'positional';

		return this as any;
	}

	public alias(
		...aliases: string[]
	): Omit<
		OptionBuilderBase<
			BuilderConfig,
			TOutput,
			TOmit | 'alias'
		>,
		TOmit | 'alias'
	> {
		this.config().aliases = aliases;

		return this as any;
	}

	public desc<TDescription extends string>(description: TDescription): Omit<
		OptionBuilderBase<
			BuilderConfig,
			TOutput,
			TOmit | 'desc'
		>,
		TOmit | 'desc'
	> {
		this.config().description = description;

		return this as any;
	}

	public hidden(): Omit<
		OptionBuilderBase<
			BuilderConfig,
			TOutput,
			TOmit | 'hidden'
		>,
		TOmit | 'hidden'
	> {
		this.config().isHidden = true;

		return this as any;
	}

	public required(): Omit<
		OptionBuilderBase<
			BuilderConfig,
			Exclude<TOutput, undefined>,
			TOmit | 'required' | 'default'
		>,
		TOmit | 'required' | 'default'
	> {
		this.config().isRequired = true;

		return this as any;
	}

	public default<TDefVal extends Exclude<TOutput, undefined>>(value: TDefVal): Omit<
		OptionBuilderBase<
			BuilderConfig,
			Exclude<TOutput, undefined>,
			TOmit | 'required' | 'default'
		>,
		TOmit | 'required' | 'default'
	> {
		this.config().default = value;

		return this as any;
	}

	public enum<TValues extends [string, ...string[]]>(...values: TValues): Omit<
		OptionBuilderBase<
			BuilderConfig,
			Exclude<TOutput | TDefault, string> | TValues[number],
			TOmit | 'enum'
		>,
		TOmit | 'enum'
	> {
		this.config().enumVals = values;

		return this as any;
	}

	public min(value: number): Omit<
		OptionBuilderBase<
			BuilderConfig,
			TOutput,
			TOmit | 'min'
		>,
		TOmit | 'min'
	> {
		const maxVal = this.config().maxVal;
		if (maxVal !== undefined && maxVal < value) {
			throw new BrocliError("Unable to define option's min value to be higher than max value!");
		}

		this.config().minVal = value;

		return this as any;
	}

	public max(value: number): Omit<
		OptionBuilderBase<
			BuilderConfig,
			TOutput,
			TOmit | 'max'
		>,
		TOmit | 'max'
	> {
		const minVal = this.config().minVal;
		if (minVal !== undefined && minVal < value) {
			throw new BrocliError("Unable to define option's max value to be lower than min value!");
		}

		this.config().maxVal = value;

		return this as any;
	}

	public int(): Omit<
		OptionBuilderBase<
			BuilderConfig,
			TOutput,
			TOmit | 'int'
		>,
		TOmit | 'int'
	> {
		this.config().isInt = true;

		return this as any;
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

export type AssignConfigName<TConfig extends BuilderConfig, TName extends string> = TConfig['name'] extends undefined
	? Omit<TConfig, 'name'> & { name: TName }
	: TConfig;

export type GenericProcessedOptions = ProcessedOptions<Record<string, GenericBuilderInternals>>;

export type ProcessedOptions<
	TOptionConfig extends Record<string, GenericBuilderInternals> = Record<string, GenericBuilderInternals>,
> = {
	[K in keyof TOptionConfig]: K extends string ? {
			config: AssignConfigName<TOptionConfig[K]['_']['config'], K>;
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
		BuilderConfig,
		string | undefined,
		OptionType | 'min' | 'max' | 'int'
	>,
	OptionType | 'min' | 'max' | 'int'
>;
export function string(): Omit<
	OptionBuilderBase<
		BuilderConfig,
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
		BuilderConfig,
		number | undefined,
		OptionType | 'enum'
	>,
	OptionType | 'enum'
>;
export function number(): Omit<
	OptionBuilderBase<
		BuilderConfig,
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
		BuilderConfig,
		boolean | undefined,
		OptionType | 'min' | 'max' | 'int' | 'enum'
	>,
	OptionType | 'min' | 'max' | 'int' | 'enum'
>;
export function boolean(): Omit<
	OptionBuilderBase<
		BuilderConfig,
		boolean | undefined,
		OptionType | 'min' | 'max' | 'int' | 'enum'
	>,
	OptionType | 'min' | 'max' | 'int' | 'enum'
>;
export function boolean<TName extends string>(name?: TName) {
	return typeof name === 'string' ? new OptionBuilderBase().boolean(name) : new OptionBuilderBase().boolean();
}

export function positional(): Omit<
	OptionBuilderBase<
		BuilderConfig,
		string | undefined,
		OptionType | 'min' | 'max' | 'int' | 'alias'
	>,
	OptionType | 'min' | 'max' | 'int' | 'alias'
> {
	return new OptionBuilderBase().positional();
}
