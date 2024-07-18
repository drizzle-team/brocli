# Brocli 🥦
Modern type-safe way of building CLIs  
by [Drizzle Team](https://drizzle.team)

```ts
import { command, string, boolean, run } from "@drizzle-team/brocli";

const push = command({
  name: "push",
  options: {
    dialect: string().enum("postgresql", "mysql", "sqlite"),
    databaseSchema: string().required(),
    databaseUrl: string().required(),
    strict: boolean().default(false),
  },
  handler: (opts) => {
    ...
  },
});

run([push]); // parse shell arguments and run command
```
 
### Why?
Brocli is meant to solve a list of challenges we've face while building 
[Drizzle ORM](https://orm.drizzle.team) CLI companion for generating and running SQL schema migrations:
- [x] Explicit, straightforward and discoverable API
- [x] Typed options(arguments) with built in validation
- [x] Ability to reuse options(or option sets) across commands
- [x] Transformer hook to decouple runtime config consumption from command business logic
- [x] `--version`, `-v` as either string or callback
- [x] Command hooks to run common stuff before/after command
- [x] Explicit global params passthrough
- [x] Testability, the most important part for us to iterate without breaking
- [x] Themes, simple API to style global/command helps
- [x] Docs generation API to eliminate docs drifting

### API
Brocli `command` declaration has:  
`name` - command name, will be listed in `help`  
`desc` - optional description, will be listed in the command `help`  
`shortDesc` - optional short description, will be listed in the all commands/all subcommands `help`   
`aliases` - command name aliases  
`hidden` - flag to hide command from `help`  
`help` - command help text or a callback to print help text with dynamically provided config  
`options` - typed list of shell arguments to be parsed and provided to `transform` or `handler`    
`transform` - optional hook, will be called before handler to modify CLI params  
`handler` - called with either typed `options` or `transform` params, place to run your command business logic  
`metadata` - optional meta information for docs generation flow

`name`, `desc`, `shortDesc` and `metadata` are provided to docs generation step  
  
  
```ts
import { command, string, boolean } from "@drizzle-team/brocli";



const push = command({
  name: "push",
  options: {
    dialect: string().enum("postgresql", "mysql", "sqlite"),
    databaseSchema: string().required(),
    databaseUrl: string().required(),
    strict: boolean().default(false),
  },
  transform: (opts) => {
  },
  handler: (opts) => {
    ...
  },
});
```



```ts
import { command } from "@drizzle-team/brocli";

const cmd = command({
  name: "cmd",
  options: {
    dialect: string().enum("postgresql", "mysql", "sqlite"),
    schema: string().required(),
    url: string().required(),
  },
  handler: (opts) => {
    ...
  },
});

```
Initial builder functions:

-   `string(name?: string)` - defines option as a string-type option which requires data to be passed as `--option=value` or `--option value`    
    -   `name` - name by which option is passed in cli args  
    If not specified, defaults to key of this option    
    :warning: - must not contain `=` character, not be in `--help`,`-h`,`--version`,`-v` and be unique per each command  
    :speech_balloon: - will be automatically prefixed with `-` if one character long, `--` if longer  
    If you wish to have only single hyphen as a prefix on multi character name - simply specify name with it: `string('-longname')`  

-   `number(name?: string)` - defines option as a number-type option which requires data to be passed as `--option=value` or `--option value`    
    -   `name` - name by which option is passed in cli args  
    If not specified, defaults to key of this option    
    :warning: - must not contain `=` character, not be in `--help`,`-h`,`--version`,`-v` and be unique per each command  
    :speech_balloon: - will be automatically prefixed with `-` if one character long, `--` if longer  
    If you wish to have only single hyphen as a prefix on multi character name - simply specify name with it: `number('-longname')`  

-   `boolean(name?: string)` - defines option as a boolean-type option which requires data to be passed as `--option`  
    -   `name` - name by which option is passed in cli args  
    If not specified, defaults to key of this option    
    :warning: - must not contain `=` character, not be in `--help`,`-h`,`--version`,`-v` and be unique per each command  
    :speech_balloon: - will be automatically prefixed with `-` if one character long, `--` if longer  
    If you wish to have only single hyphen as a prefix on multi character name - simply specify name with it: `boolean('-longname')`  

-   `positional(displayName?: string)` - defines option as a positional-type option which requires data to be passed after a command as `command value`    
    -   `displayName` - name by which option is passed in cli args  
    If not specified, defaults to key of this option  
    :warning: - does not consume options and data that starts with  
    
Extensions: 

-   `.alias(...aliases: string[])` - defines aliases for option  
     -   `aliases` - aliases by which option is passed in cli args  
    :warning: - must not contain `=` character, not be in `--help`,`-h`,`--version`,`-v` and be unique per each command  
    :speech_balloon: - will be automatically prefixed with `-` if one character long, `--` if longer  
    If you wish to have only single hyphen as a prefix on multi character alias - simply specify alias with it: `.alias('-longname')`  

-   `.desc(description: string)` - defines description for option to be displayed in `help` command  

-   `.required()` - sets option as required, which means that application will print an error if it is not present in cli args  

-   `.default(value: string | boolean)` - sets default value for option which will be assigned to it in case it is not present in cli args

-   `.hidden()` - sets option as hidden - option will be omitted from being displayed in `help` command

-   `.enum(values: [string, ...string[]])` - limits values of string to one of specified here  
    -   `values` - allowed enum values  

-   `.int()` - ensures that number is an integer  

-   `.min(value: number)` - specified minimal allowed value for numbers  
    -   `value` - minimal allowed value  
    :warning: - does not limit defaults

-   `.max(value: number)` - specified maximal allowed value for numbers  
    -   `value` - maximal allowed value  
    :warning: - does not limit defaults

### Creating handlers

Normally, you can write handlers right in the `command()` function, however there might be cases where you'd want to define your handlers separately.  
For such cases, you'd want to infer type of `options` that will be passes inside your handler.  
You can do it using `TypeOf` type:  

```Typescript
import { string, boolean, type TypeOf } from '@drizzle-team/brocli'

const commandOptions = {
    opt1: string(),
    opt2: boolean('flag').alias('f'),
    // And so on... 
}

export const commandHandler = (options: TypeOf<typeof commandOptions>) => {
    // Your logic goes here...
}
```

Or by using `handler(options, myHandler () => {...})`

```Typescript
import { string, boolean, handler } from '@drizzle-team/brocli'

const commandOptions = {
    opt1: string(),
    opt2: boolean('flag').alias('f'),
    // And so on... 
}

export const commandHandler = handler(commandOptions, (options) => {
    // Your logic goes here...
});
```

### Defining commands

To define commands, use `command()` function:  

```Typescript
import { command, type Command, string, boolean, type TypeOf } from '@drizzle-team/brocli'

const commandOptions = {
    opt1: string(),
    opt2: boolean('flag').alias('f'),
    // And so on... 
}

const commands: Command[] = []

commands.push(command({
    name: 'command', 
    aliases: ['c', 'cmd'],
    description: 'Description goes here',
    hidden: false,
    options: commandOptions,
    transform: (options) => {
        // Preprocess options here...
        return processedOptions
    },
    handler: (processedOptions) => {
        // Your logic goes here...
    },
    help: () => 'This command works like this: ...',
    subcommands: [
        command(
            // You can define subcommands like this
        )
    ]
}));
```

Parameters:  

-   `name` - name by which command is searched in cli args  
    :warning: - must not start with `-` character, be equal to [`true`, `false`, `0`, `1`] (case-insensitive) and be unique per command collection  

-   `aliases` - aliases by which command is searched in cli args  
    :warning: - must not start with `-` character, be equal to [`true`, `false`, `0`, `1`] (case-insensitive) and be unique per command collection  

-   `description` - description for command to be displayed in `help` command  

-   `hidden` - sets command as hidden - if `true`, command will be omitted from being displayed in `help` command  

-   `options` - object containing command options created using `string()` and `boolean()` functions  

-   `transform` - optional function to preprocess options before they are passed to handler    
    :warning: - type of return mutates type of handler's input  

-   `handler` - function, which will be executed in case of successful option parse  

-   `help` - function or string, which will be executed or printed when help is called for this command

-   `subcommands` - subcommands for command    
    :warning: - command can't have subcommands and `positional` options at the same time  

### Running commands

After defining commands, you're going to need to execute `run()` function to start command execution

```Typescript
import { command, type Command, run, string, boolean, type TypeOf } from '@drizzle-team/brocli'

const commandOptions = {
    opt1: string(),
    opt2: boolean('flag').alias('f'),
    // And so on... 
}

const commandHandler = (options: TypeOf<typeof commandOptions>) => {
    // Your logic goes here...
}

const commands: Command[] = []

commands.push(command({
    name: 'command', 
    aliases: ['c', 'cmd'],
    description: 'Description goes here',
    hidden: false,
    options: commandOptions,
    handler: commandHandler,
}));

// And so on...

run(commands, {
    name: 'my-program',
    version: '1.0.0',
    help: () => {
        console.log('Command list:');
        commands.forEach(c => console.log('This command does ... and has options ...'));
    }
})
```

:speech_balloon: - in case cli arguments are not stored in `process.argv` in your environment, you can pass custom argument source to a second argument of `run()`, however note that first two elements of such source will be ignored as they are expected to store executable and executed file paths instead of args.  
:speech_balloon: - custom help and version output handlers or strings can be passed to a second argument to replace default brocli outputs for those operations with your own.  

## CLI

In `BroCLI`, command doesn't have to be the first argument, instead it may be contained in any order.  
To make this possible, hovewer, option that's stated right before command should have an explicit value, even if it is a flag: `--verbose true <command-name>` (does not apply to reserved flags: [ `--help` | `-h` | `--version` | `-v`])    
Options are parsed in strict mode, meaning that having any unrecognized options will result in an error.     
