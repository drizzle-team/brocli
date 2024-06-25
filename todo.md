# Immediate
 - Make lib commander's superset (only in arg parsing capabilities)
 - Make string args default syntax work if possible \ write reasons why it's impossible otherwise
 - Find Node API to generate args from string - v
 - Remove commander from deps before pushing
 - Test for function calls instead of storage - https://vitest.dev/api/mock.html
 - Add values to boolean - v
 - Update tests
 - CLI app research

 # Backlog
 - Add automatically typing handler creator function
 - `--help`- type help - v
 - `--help=commandname`- type help
 - New discovery: fix --version \ --help behaviour when passed as arg
 - list valid \ invalid commands for further discussion


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