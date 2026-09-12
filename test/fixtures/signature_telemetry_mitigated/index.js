const vscode = require('vscode');
function sendTelemetry(evt) {}
if (vscode.env && vscode.env.isTelemetryEnabled) sendTelemetry({ type: 'start' });
