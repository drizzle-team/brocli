export type OptionType = 'string' | 'boolean';

export type OutputType = string | boolean | undefined;

export type BuilderConfig<
	TName extends string | undefined,
	TAliases extends string[],
	TType extends OptionType,
	TDescription extends string | undefined,
	TDefault extends OutputType,
	TIsHidden extends boolean = false,
	TIsRequired extends boolean = false,
> = {
	name: TName;
	aliases: TAliases;
	type: TType;
	description: TDescription;
	default: TDefault;
	isHidden: TIsHidden;
	isRequired: TIsRequired;
};

export type GenericBuilderConfig = BuilderConfig<
	string | undefined,
	string[],
	OptionType,
	string | undefined,
	OutputType,
	boolean,
	boolean
>;

export class OptionBuilderBase<
	TBuilderConfig extends GenericBuilderConfig = BuilderConfig<
		undefined,
		[],
		'string',
		undefined,
		undefined,
		false,
		false
	>,
	TOutput extends OutputType = string,
	TOmit extends string = '',
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
				name: undefined,
				aliases: [],
				type: 'string',
				description: undefined,
				default: undefined,
				isHidden: false,
				isRequired: false,
			} as unknown as TBuilderConfig,
			$output: undefined as any as TOutput,
		};
	}

	public string<TName extends string>(name: TName): Omit<
		OptionBuilderBase<
			BuilderConfig<
				TName,
				TBuilderConfig['aliases'],
				'string',
				TBuilderConfig['description'],
				TBuilderConfig['default'],
				TBuilderConfig['isHidden'],
				TBuilderConfig['isRequired']
			>,
			string | undefined,
			TOmit | OptionType
		>,
		TOmit | OptionType
	>;
	public string(): Omit<
		OptionBuilderBase<
			BuilderConfig<
				undefined,
				TBuilderConfig['aliases'],
				'string',
				TBuilderConfig['description'],
				TBuilderConfig['default'],
				TBuilderConfig['isHidden'],
				TBuilderConfig['isRequired']
			>,
			string | undefined,
			TOmit | OptionType
		>,
		TOmit | OptionType
	>;
	public string(
		name?: string,
	) {
		this.config().type = 'string';
		this.config().name = name;

		return this as any;
	}

	public boolean<TName extends string>(name: TName): Omit<
		OptionBuilderBase<
			BuilderConfig<
				TName,
				TBuilderConfig['aliases'],
				'boolean',
				TBuilderConfig['description'],
				TBuilderConfig['default'],
				TBuilderConfig['isHidden'],
				TBuilderConfig['isRequired']
			>,
			boolean | undefined,
			TOmit | OptionType
		>,
		TOmit | OptionType
	>;
	public boolean(): Omit<
		OptionBuilderBase<
			BuilderConfig<
				undefined,
				TBuilderConfig['aliases'],
				'boolean',
				TBuilderConfig['description'],
				TBuilderConfig['default'],
				TBuilderConfig['isHidden'],
				TBuilderConfig['isRequired']
			>,
			boolean | undefined,
			TOmit | OptionType
		>,
		TOmit | OptionType
	>;
	public boolean(
		name?: string,
	) {
		this.config().type = 'boolean';
		this.config().name = name;

		return this as any;
	}

	public alias<TAliases extends string[]>(
		...aliases: string[]
	): Omit<
		OptionBuilderBase<
			BuilderConfig<
				TBuilderConfig['name'],
				TAliases,
				TBuilderConfig['type'],
				TBuilderConfig['description'],
				TBuilderConfig['default'],
				TBuilderConfig['isHidden'],
				TBuilderConfig['isRequired']
			>,
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
			BuilderConfig<
				TBuilderConfig['name'],
				TBuilderConfig['aliases'],
				TBuilderConfig['type'],
				TDescription,
				TBuilderConfig['isHidden'],
				TBuilderConfig['isRequired']
			>,
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
			BuilderConfig<
				TBuilderConfig['name'],
				TBuilderConfig['aliases'],
				TBuilderConfig['type'],
				TBuilderConfig['description'],
				TBuilderConfig['default'],
				true,
				TBuilderConfig['isRequired']
			>,
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
			BuilderConfig<
				TBuilderConfig['name'],
				TBuilderConfig['aliases'],
				TBuilderConfig['type'],
				TBuilderConfig['description'],
				TBuilderConfig['default'],
				TBuilderConfig['isHidden'],
				true
			>,
			Exclude<TOutput, undefined>,
			TOmit | 'required' | 'default'
		>,
		TOmit | 'required' | 'default'
	> {
		this.config().isRequired = true;

		return this as any;
	}

	public default(value: TOutput): Omit<
		OptionBuilderBase<
			BuilderConfig<
				TBuilderConfig['name'],
				TBuilderConfig['aliases'],
				TBuilderConfig['type'],
				TBuilderConfig['description'],
				TOutput,
				TBuilderConfig['isHidden'],
				true
			>,
			Exclude<TOutput, undefined>,
			TOmit | 'required' | 'default'
		>,
		TOmit | 'required' | 'default'
	> {
		this.config().default = value;

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
	config: GenericBuilderConfig;
};

export type GenericBuilderInternals = {
	_: GenericBuilderInternalsFields;
};

export type AssignConfigName<TConfig extends GenericBuilderConfig, TName extends string> = TConfig['name'] extends
	undefined ? Omit<TConfig, 'name'> & { name: TName }
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
		BuilderConfig<TName, [], 'string', undefined, undefined, false, false>,
		string | undefined,
		'' | OptionType
	>,
	'' | OptionType
>;
export function string(): Omit<
	OptionBuilderBase<
		BuilderConfig<undefined, [], 'string', undefined, undefined, false, false>,
		string | undefined,
		'' | OptionType
	>,
	'' | OptionType
>;
export function string<TName extends string>(name?: TName) {
	return typeof name === 'string' ? new OptionBuilderBase().string(name) : new OptionBuilderBase().string();
}

export function boolean<TName extends string>(
	name: TName,
): Omit<
	OptionBuilderBase<
		BuilderConfig<TName, [], 'boolean', undefined, undefined, false, false>,
		boolean | undefined,
		'' | OptionType
	>,
	'' | OptionType
>;
export function boolean(): Omit<
	OptionBuilderBase<
		BuilderConfig<undefined, [], 'boolean', undefined, undefined, false, false>,
		boolean | undefined,
		'' | OptionType
	>,
	'' | OptionType
>;
export function boolean<TName extends string>(name?: TName) {
	return typeof name === 'string' ? new OptionBuilderBase().boolean(name) : new OptionBuilderBase().boolean();
}
