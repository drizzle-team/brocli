import { boolean, defineCommand, defineOptions, runCli, string, type TypeOf } from '@/index.ts';

const generateOpts = defineOptions({
	dialect: string().desc('Database dialect [pg, mysql, sqlite]').required(),
	schema: string('schema').alias('s').desc('Path to a schema file or folder'),
	out: string().alias('out', 'o').desc("Output folder, 'drizzle' by default"),
	name: string().desc('Migration file name'),
	breakpoints: string('breakpoints').desc(`Prepare SQL statements with breakpoints`),
	custom: string('custom').desc('Prepare empty migration file for custom SQL'),
	config: string().alias('c', 'cfg').desc('Path to a config.json file, drizzle.config.ts by default'),
	flag: boolean().alias('f').desc('Example boolean field'),
	debug: boolean('dbg').hidden(),
});

const generateHandler = (options: TypeOf<typeof generateOpts>) => {
	console.log('Generate has received following options:');
	console.log(options);

	options.breakpoints;
	options.config;
	options.custom;
	options.debug;
	options.dialect;
	options.flag;
	options.name;
	options.out;
	options.schema;
};

defineCommand({
	name: 'generate',
	aliases: ['g', 'gen'],
	description: 'Generate drizzle migrations',
	hidden: false,
	options: generateOpts,
	handler: generateHandler,
});

const testOpts = defineOptions({
	flag: boolean().alias('f', 'fl').desc('Boolean value'),
	string: string().alias('s', 'str').desc('String value'),
	sFlag: boolean('stealth').alias('h', 'hb').desc('Boolean value'),
	sString: string().alias('q', 'hs').desc('String value'),
});

defineCommand({
	name: 'test',
	options: testOpts,
	handler: (options) => {
		console.log("Command 'test' has received following options:");
		console.log(options);
	},
	hidden: false,
});

defineCommand({
	name: 'test two',
	options: testOpts,
	handler: (options) => {
		console.log("Command 'test two' has received following options:");
		console.log(options);
	},
	hidden: false,
});

runCli();
