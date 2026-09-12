const vscode = require('vscode');
const cp = require('child_process');
const gitPath = vscode.workspace.getConfiguration('minimal-ext').get('path');
cp.exec(gitPath);
