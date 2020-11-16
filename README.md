# Codetender
Ever try to create your own template for a scaffolding engine (&lt;cough&gt; Yeoman &lt;/cough&gt;) and been frustrated
 with the seemingly endless cycle of edit template/deploy template/test template? Well frustrate no more! Now, thanks 
 to Codetender, literally any collection of files can be a template. Get your project working **first**, then turn it 
 into a template. Codetender serves up new projects as easy as a bartender serves up drinks. Any git repository or 
 local folder can be a template. Just replace any text token in all file names and contents and voila! New project!

## Installation

    npm install -g codetender

## Usage

### Create New Project From Template

    codetender new user/repository new_folder_name

OR

    codetender new https://repository.url.git new_folder_name

OR

    codetender new ../relative/path/to/folder new_folder_name

If the template includes a `.codetender` configuration file, you will be prompted to enter specific text which will 
replace placeholders in the template. If no configuration file exists, you will be prompted for each token to replace 
and the replacement text. Codetender will then create a folder and copy the files into the folder. If the files come 
from a git repository, the `.git` folder will be deleted to disconnect it from the original remote branch. Finally, 
Codetender will replace all of the tokens as specified in file names, folder names, and file content.

## Rename Tokens in Existing Folder

    codetender replace path/to/folder

You will be prompted for each token to replace and the replacement text. Codetender will replace all of the tokens as 
specified in file names, folder names, and file content.

## Template Configuration

Codetender supports JSON configuration using a `.codetender` file placed in the root folder of the template. Note that 
this works the same whether that template is a local folder or git repository. This makes developing and testing 
templates super easy since you can just use `codetender new source-folder destination-folder` to test your template 
including the `.codetender` configuration. The format of the `.codetender` configuration is shown below:

````
{
  "tokens": [
    {
      "pattern": "string",
      "prompt": "string"
    }
  ],
  "ignore": [
    "string"
  ],
  "scripts": {
    "before": "string",
    "after": "string"
  }
}
````

### Tokens

The `tokens` config allows the template developer to specify (and therefore limit) the tokens to be replaced within the
template contents. Each token consists of a `pattern` and an optional `prompt`. The pattern is a string which 
Codetender will find any **case-sensitive** matches for that string and replace it with the value provided by the user
when prompted. The default prompt is `Replace all instances of '{pattern}' with:`. However, a more descriptive prompt 
is recommended such as `Enter the first part of the application namespace (ex: MyCompany):`.

In the example below, the user would first be prompted: `Enter the name of you project (ex: MyProject):`. Then they would be prompted: `Replace all instances of 'MyFunction' with:`.

```
  "tokens": [
    {
      "pattern": "MyApplication",
      "prompt": "Enter the name of you project (ex: MyProject):"
    },
    {
      "pattern": "MyFunction",
    }
  ]
````

### Ignored Files

Codetender supports ignoring files via the `.codetender` configuration. This is particularly useful when using a local
folder as a template since you may want to ignore compiled output, external modules, etc. The `ignore` config expects
an array of globs (similar to the `.gitignore` syntax). Any files matching the globs will be ignored and will not be 
copied to the destination folder.

````
  "ignore": [
      "ignore_this_folder/",
      "ignore_this_file.txt"
  ]
````

### Files Skipped by Token Replacement

Codetender supports skipping token replacement via the `.codetender` configuration. This is useful for template content
such as scripts or README files which you may want to remain intact after token replacement.

````
  "noReplace": [
      "do_not_replace_tokens_in_this_folder/",
      "do_not_replace_tokens_in_this_file.txt"
  ]
````

### Scripts

Codetender supports execution of scripts before or after token replacement. The `before` script is executed after the 
files are cloned but before token replacement is performed. The `after` script is executed after token replacement is
performed.

````
  "scripts": {
    "before": "node ./codetender-before.js",
    "after": "node ./codetender-after.js"
  }
````