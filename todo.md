 # Backlog

 - Test for function calls instead of storage - https://vitest.dev/api/mock.html
 - Update tests
 - New discovery: fix --version \ --help behaviour when passed as arg
 - Explicit type erros (strings for types)
 - exclusive\inclusive comparison for min\max
 - .refine()
 - .length()
 - Make TypeOf work on single element 

 # Urgent
 - Complete help 
 - Make --help work with subcommands
 - Testing API
 - Remake tests

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
    >help <command> - calls command's help
    >help <command> <subcommand> - calls subcommand's help
    >--help (at any position) - calls help
    >--help <command> - calls command's help
    >--help <command> <subcommand> - calls subcommand's help
    ><command> --help - calls command's help
    ><command> --help <subcommand> - calls subcommand's help
    ><command> <subcommand> --help - calls subcommand's help