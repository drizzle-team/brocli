 # Backlog

 - Test for function calls instead of storage - https://vitest.dev/api/mock.html
 - Update tests
 - Add automatically typing handler creator function
 - New discovery: fix --version \ --help behaviour when passed as arg
 - Explicit type erros (strings for types)

 # Urgent
 - replace commandHelp with on command helps +
 - version & help to be string | callback | async callback +
 - remove name +
 - default version to undefined with no errors +

 # next version
 - subcommands (ref.: Turso CLI)
 - positional args (disregard - and -- beginnings in args when parsing positionals)

 # Scenarios

 ## Valid

    >command -f false --flag2=true -s="string value" --string stringvalue --flag3
    >-f false command --flag2=true -s="string value" --string stringvalue --flag3
    >-f false --flag2=true command -s="string value" --string stringvalue --flag3
    >-f false --flag4 --flag2=true command -s="string value" --string stringvalue --flag3
    >-f false --flag4 --flag2=true -s="string value" command --string stringvalue --flag3
    >-f false --flag4 --flag2=true -s="string value" --string stringvalue command --flag3
    >-f false --flag4 --flag2=true -s="string value" --string stringvalue --flag3 true command
    ><empty prompt> - calls help
    >help - calls help
    >help -c <command> - calls command's help
    >help --command=<command> - calls command's help
    >--help (at any position) - calls help
    >--help <command> - calls command's help
    ><command> --help - calls command's help