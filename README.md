# BroCLI

Run CLI commands with fully typed handlers

## Code

### Defining options

Start defining options using `string` and `boolean` functions:  

```Typescript
import { string, boolean } from '@drizzle-team/brocli'

const commandOptions = {
    opt1: string(),
    opt2: boolean('flag').alias('f'),
    // And so on... 
}
```

Keys of the object passed to the object storing options determine to which keys parsed options will be assigned to inside your handler.  

#### Option builder

Initial builder functions:

-   `string(name?: string)` - defines option as a string-type option which requires data to be passed as `--option=value`
    -   `name` - name by which option is passed in cli args  
    If not specified, defaults to key of this option    
    :warning: - must not contain `=` character, not be in `--help`,`-h`,`--version`,`-v` and be unique per each command  
    :speech_balloon: - will be automatically prefixed with `-` if one character long, `--` if longer  
    If you wish to have only single hyphen as a prefix on multi character name - simply specify name with it: `string('-longname')`  


-   `boolean(name?: string)` - defines option as a boolean-type option which requires data to be passed as `--option`  
    -   `name` - name by which option is passed in cli args  
    If not specified, defaults to key of this option    
    :warning: - must not contain `=` character, not be in `--help`,`-h`,`--version`,`-v` and be unique per each command  
    :speech_balloon: - will be automatically prefixed with `-` if one character long, `--` if longer  
    If you wish to have only single hyphen as a prefix on multi character name - simply specify name with it: `boolean('-longname')`  

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

### Defining commands

To define commands, use `command()` function:  

```Typescript
import { command, type Command, string, boolean, type TypeOf } from '@drizzle-team/brocli'

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
```

Parameters:  

-   `name` - name by which command is searched in cli args  
    :warning: - must not start with `-` character and be unique per command collection  

-   `aliases` - aliases by which command is searched in cli args  
    :warning: - must not start with `-` character and be unique per command collection  

-   `description` - description for command to be displayed in `help` command  

-   `hidden` - sets command as hidden - if `true`, command will be omitted from being displayed in `help` command  

-   `options` - object containing command options created using `string()` and `boolean()` functions  

-   `handler` - function, which will be executed in case of successful option parse  

:speech_balloon: - `BroCLI` starts with having `help` command predefined, and despite the requirement for command names to be unique, `help` can actually be redefined so that your app could have it matching your output style instead that of this library's.  

### Running commands

After defining commands, you're going to need to execute `runCli()` function to start command execution

```Typescript
import { command, type Command, runCli, string, boolean, type TypeOf } from '@drizzle-team/brocli'

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

runCli(commands, {
    name: 'my-program',
    version: '1.0.0'
})
```

:speech_balloon: - in case cli arguments are not stored in `process.argv` in your environment, you can pass custom argument source to a second argument of `runCli()`, however note that first two elements of such source will be ignored as they are expected to store executable and executed file paths instead of args.  
:speech_balloon: - custom help and version output handlers can be passed to a second argument to replace default brocli outputs for those operations with your own.  

## CLI

In `BroCLI`, command doesn't have to be the first argument, instead it may be contained in any order.  
To make this possible, hovewer, option that's stated right before command should have an explicit value, even if it is a flag: `--verbose true <command-name>`    
Options are parsed in strict mode, meaning that having any unrecognized options will result in anerror.     