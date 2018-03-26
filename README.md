# Codetender
Ever try to create your own template for a scaffolding engine (&lt;cough&gt; Yeoman &lt;/cough&gt;) and been frustrated with the seemingly endless cycle of edit template/deploy template/test template? Well frustrate no more! Now, thanks to Codetender, literally any collection of files can be a template. Get your project working **first**, then turn it into a template. Codetender serves up new projects as easy as a bartender serves up drinks. Any git repository or local folder can be a template. Just replace any text token in all file names and contents and voila! New project!

## Installation

    npm install -g codetender

## Usage

### Create New Project From Template

    codetender new user/repository new_folder_name

OR

    codetender new https://repository.url.git new_folder_name

OR

    codetender new ../relative/path/to/folder new_folder_name

You will be prompted for each token to replace and the replacement text. Codetender will then create a folder and copy the files into the folder. If the files come from a git repository, the `.git` folder will be deleted to disconnedt it from the original remote branch. Finally, codetender will replace all of the tokens as specified in file names, folder names, and file content.

## Rename Tokens in Existing Folder

    codetender replace path/to/folder

You will be prompted for each token to replace and the replacement text. Codetender will replace all of the tokens as specified in file names, folder names, and file content.
