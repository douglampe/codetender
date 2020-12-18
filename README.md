# CodeTender
Ever try to create your own template for a scaffolding engine (&lt;cough&gt; Yeoman &lt;/cough&gt;) and been frustrated
with the seemingly endless cycle of edit template/deploy template/test template? Well frustrate no more! Now, thanks 
to CodeTender, literally any collection of files can be a template. Get your project working **first**, then turn it 
into a template. CodeTender serves up new projects as easy as a bartender serves up drinks. Any git repository or 
local folder can be a template. Just replace any text token in all file names and contents and voila! New project!

## Installation

CLI:

    npm install -g codetender

Node.js:

    npm install -s 

## Basic Usage

```
const CodeTender = require("codetender");

const ct = new CodeTender();

// Copy a template to a new folder and replace tokens
ct.new({
  template: 'path/to/template', // Path to local folder or git repo
  folder: 'path/to/new/folder', // Destination folder (must not exist)
  file: 'codetender-config.json', // Optional configuration file (see below)
  logger: line => { console.log(line); }, // Optional logger to override default console
  verbose: true, // Set to true for verbose output
  quiet: false // Set to true to disable all output (overrides verbose: true)
});

// Replace tokens in an existing folder
ct.replace({
  folder: 'path/to/folder', // Path containing files with tokens to replace
  file: 'codetender-config.json', // Optional configuration file (see below)
  logger: line => { console.log(line); }, // Optional logger to override default console
  verbose: true, // Set to true for verbose output
  quiet: false // Set to true to disable all output (overrides verbose: true)
});
```

Both `CodeTender.new()` and `CodeTender.replace()` accept a `config` object as a parameter and return a promise that is
resolved when the process completes. This object may contain any of the configurations defined below. However, this 
config is overwritten by any external configuration.

Regardless of whether the default logger or custom logger is used,
all log entries are appended to an array of strings which can be accessed using `CodeTender.logOutput`.

Note that CodeTender is interactive by default and the standard input will be read for any token replacement values
unless tokens are provided in the configuration object or specified file.

## CLI Usage

```
Usage: codetender [options] [command]

Options:
  -V, --version            output the version number
  -v, --verbose            Display verbose output
  -q, --quiet              Do not output to console (overrides --verbose)
  -f --file <file>         Replace tokens as specified in a file
  -h, --help               display help for command

Commands:
  new <template> <folder>  Copies contents of template to new folder then prompts for token replacement
  replace <folder>         Prompts for token replacement and replaces tokens
  help [command]           display help for command
```

## Create New Project From Template

### CLI

    codetender new user/repository new_folder_name

OR

    codetender new https://repository.url.git new_folder_name

OR

    codetender new ../relative/path/to/folder new_folder_name

### API

    ct.new({ template: 'user/repository', folder: 'new_folder_name' });

OR

    ct.new({ template: 'https://repository.url.git', folder: 'new_folder_name' });

OR

    ct.new({ template: '../relative/path/to/folder', folder: 'new_folder_name' });

If the template includes a `.codetender` configuration file, you will be prompted to enter specific text which will 
replace placeholders in the template. If no configuration file exists, you will be prompted for each token to replace 
and the replacement text. CodeTender will then create a folder and copy the files into the folder. If the files come 
from a git repository, the `.git` folder will be deleted to disconnect it from the original remote branch. Finally, 
CodeTender will replace all of the tokens as specified in file names, folder names, and file content.

## Rename Tokens in Existing Folder

### CLI

    codetender replace path/to/folder -f codetender-config.json

### API

    ct.replace({ folder: 'path/to/folder', file: 'codetender-config.json' });

You will be prompted for each token to replace and the replacement text. CodeTender will replace all of the tokens as 
specified in file names, folder names, and file content. You can specify a JSON configuration file using the `--file`
or `-f` option.

## JSON Configuration

CodeTender supports configuration via JSON file. When using `coedetender new`, if a `.codetender` file is found in the
root folder of the template, the configuration is first read from this file. For either `codetender new` or
`codetender replace`, the location of a configuration file can be specified with the `--file` or `-f` option. If a
`.codetender` file is found and a file is specified with the `--file` option, the token and scripts configuration from
the file override any matching settings found in the `.codetender` file and all other entries are appended.

Note that for `codetender new` this works the same whether that template is a local folder or git repository. This 
makes developing and testing templates super easy since you can just use 
`codetender new source-folder destination-folder` to test your template including the `.codetender` configuration. 

The format of the JSON configuration is shown below:

```
{
  "tokens": [
    {
      "pattern": "pattern to find",
      "prompt": "prompt to display (optional)"
    },
    {
      "pattern": "pattern to find",
      "replacement": "value to replace pattern with"
    }
  ],
  "ignore": [
    "string"
  ],
  "noReplace": [
      "do_not_replace_tokens_in_this_folder/",
      "do_not_replace_tokens_in_this_file.txt"
  ],
  "scripts": {
    "before": "codetender-before.js",
    "after": "codetender-after.js"
  },
  "delete" [
    "codetender-*.js"
  ],
  "banner": [
    "This is a banner.",
    "You can use it to display instructions, etc. after your template is processed.",
    "Make sure to escape backslashes with double backslashes like this:",
    "  _____        __    __              __       "
    " / ___/__  ___/ /__ / /____ ___  ___/ /__ ____"
    "/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/"
    "\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   "
  ]
}
```

### Tokens

The `tokens` config allows the template developer to specify (and therefore limit) the tokens to be replaced within the
template contents. Each token consists of a `pattern` and an optional `prompt`. The pattern is a string which 
CodeTender will find any **case-sensitive** matches for that string and replace it with the value provided by the user
when prompted. The default prompt is `Replace all instances of '{pattern}' with:`. However, a more descriptive prompt 
is recommended such as `Enter the first part of the application namespace (ex: MyCompany):`.

In addition, you can force replacements by specifying the val "replacement" key for a given pattern as shown. Tokens
with a replacement value specified will not prompt the user and will always replace matches with the specified value.

If a conflict exists when attempting to rename a file, the rename operation will be skipped by default. To force an
existing file to be overwritten by the rename process, add `"overwrite": true` to the token configuration.  **Note:**
All matching tokens must have the `overwrite` flag set to true in order for a conflicting file to be overwritten. For
example if you have patterns `foo` and `bar` and a file named `foobar.txt` that would conflict with another file after
renaming, you must add the `overwrite` flag to both `foo` and `bar` tokens to replace the existing file with 
`foobar.txt`.

In the example below, the user would first be prompted: `Enter the name of you project (ex: MyProject):`. Then they 
would be prompted: `Replace all instances of 'MyFunction' with:`. All instances of `text to always replace` will be
replaced with `replacement value`. `README.codetender.md` will be renamed `README.md` after deleting the original
`README.md`.


```
  "tokens": [
    {
      "pattern": "MyApplication",
      "prompt": "Enter the name of you project (ex: MyProject):"
    },
    {
      "pattern": "MyFunction",
    },
    {
      "pattern": "text to always replace",
      "replacement": "replacement value"
    },
    {
      "pattern": "README.codetender.md",
      "replacement": "README.md",
      "overwrite": true
    }
  ]
```

### Ignored Files

CodeTender supports ignoring files via the JSON configuration. This is particularly useful when using a local
folder as a template since you may want to ignore compiled output, external modules, etc. The `ignore` config expects
an array of globs (similar to the `.gitignore` syntax). Any files matching the globs will be removed from the 
destination folder prior to processing. If `codetender new` is used with both a `.codetender` config and the `--file`
option, the values in the `--file` file are appended after the values in the `.codetender` file.

```
  "ignore": [
      "ignore_this_folder/",
      "ignore_this_file.txt"
  ]
```

### Files Skipped by Token Replacement

CodeTender supports skipping token replacement via the JSON configuration. This is useful for template content
such as scripts or README files which you may want to remain intact after token replacement. If `codetender new` is 
used with both a `.codetender` config and the `--file` option, the values in the `--file` file are appended after the
values in the `.codetender` file. If `codetender new` is used with both a `.codetender` config and the `--file` option,
the values in the `--file` file are appended after the
values in the `.codetender` file.

```
  "noReplace": [
      "do_not_replace_tokens_in_this_folder/",
      "do_not_replace_tokens_in_this_file.txt"
  ]
```

### Scripts

CodeTender supports execution of scripts before or after token replacement. The `before` script is executed after the 
files are cloned but before token replacement is performed. The `after` script is executed after token replacement is
performed. Note that scripts are executed relative to the target path so any content should not be excluded using
`ignore`. If there is content used in the `after` script which should not have tokens replaced, make sure to use the
`noReplace` setting to skip replacing tokens in the content used by the after script. Otherwise, the content will be
modified during token processing.

```
  "scripts": {
    "before": "node ./codetender-before.js",
    "after": "node ./codetender-after.js"
  }
```

### Delete

CodeTender supports deleting files after processing via the JSON configuration. This is particularly useful for scripts
which are intended to be executed before or after processing, but are not intended to remain as content. The `delete` 
config expects an array of globs (similar to the `.gitignore` syntax). Any files matching the globs will be removed 
from the destination folder after processing. If `codetender new` is used with both a `.codetender` config and the 
`--file` option, the values in the `--file` file are appended after the values in the `.codetender` file.


```
  "delete": [
      "delete_this_folder/",
      "delete_this_file.txt"
  ]
```

### Banners

CodeTender supports banner messages which can be displayed after a template is processed. The `banner` value can either
be a single string or an array of strings and will be logged after all processing of the template is complete.
Feel free to use same text font used by CodeTender which can be generated at http://patorjk.com/software/taag/ using 
the "Small Slant" font.

```
  "banner": [
    "This is a banner.",
    "You can use it to display instructions, etc. after your template is processed.",
    "Make sure to escape backslashes with double backslashes like this:",
    "  _____        __    __              __       "
    " / ___/__  ___/ /__ / /____ ___  ___/ /__ ____"
    "/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/"
    "\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   "
  ]
```

## Examples

### Replacing the template README.md with the content of README.codetender.md

You may want the `README.md` file in your template to display instructions on using the template while still having a 
`README.md` generated by the template that matches the rest of the content, has placeholders replaced, etc. In the 
example below, the `README.md` will not be copied to the destination folder and `README.codetender.md` will be renamed
`README.md`. Then the content `ProjectName` will be replaced in all files (including the new README.md) with content
specified by the user in response to the prompt `Enter project name (ex: MyProject):`.

```
{
  "tokens": [
    {
      "pattern": "README.codetender.md",
      "replacement": "README.md"
    },
    {
      "pattern": "ProjectName",
      "prompt": "Enter project name (ex: MyProject):"
    }
  ],
  "ignore": [
    "README.md"
  ]
}
```

While this solution works for templates and `codetender new`, it does not work with `codetender replace` which does not
support the `ignore` configuration. Therefore you can use `overwrite` to allow the renaming process to overwrite the
existing `README.md` file.

### Executing an after script which is not processed and then is removed after processing

In the example below, the `after` script and related content contain tokens which could conflict with replacements in 
content and therefore should not be processed so the files are specified as `noReplace`. Note that this is not 
necessary for the `before` script since it is executed prior to processing. Both the `before` and `after` scripts and
related content are deleted after processing.

```
{
  "tokens": [
    {
      "pattern": "ProjectName",
      "prompt": "Enter project name (ex: MyProject):"
    }
  ],
  "noReplace": [
    "codetender-after.js",
    "content-used-by-after-script.txt"
  ],
  "scripts" {
    "before": "node ./codetender-before.js",
    "after": "node ./codetender-after.js"
  }
  "delete": [
    "codetender-*.js",
    "content-used-by-after-script.txt"
  ]
}
```