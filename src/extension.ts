import * as vscode from 'vscode';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import { parse } from 'pg-query-parser';

let watcher: chokidar.FSWatcher;

export function activate(context: vscode.ExtensionContext) {
	// Start watching schema file
	const schemaPath = vscode.workspace
		.getConfiguration('dbSchemaWatcher')
		.get<string>('schemaFilePath');
	if (!schemaPath) {
		vscode.window.showErrorMessage(
			'Database schema file path is not configured. Set it in settings.'
		);
		return;
	}

	watcher = chokidar.watch(schemaPath, { persistent: true });

	watcher.on('change', async (path) => {
		try {
			const schemaContent = fs.readFileSync(path, 'utf-8');
			const parsedSchema = parse(schemaContent);

			const changes = await analyzeSchemaChanges(parsedSchema);
			if (changes.length > 0) {
				vscode.window.showInformationMessage(
					`Detected changes in database schema: ${changes.join(', ')}`
				);
				suggestCodeChanges(changes);
			}
		} catch (error) {
			vscode.window.showErrorMessage(
				`Error processing schema changes: ${error.message}`
			);
		}
	});

	context.subscriptions.push(
		vscode.commands.registerCommand('dbSchemaWatcher.start', () => {
			vscode.window.showInformationMessage('DB Schema Watcher started!');
		})
	);
}

export function deactivate() {
	if (watcher) {
		watcher.close();
	}
}

async function analyzeSchemaChanges(parsedSchema: any): Promise<string[]> {
	// Analyze parsed schema for changes (simplified example)
	const changes: string[] = [];
	const statements = parsedSchema.query.map((query: any) => query.RawStmt.stmt);

	for (const stmt of statements) {
		if (stmt.AlterTableStmt) {
			changes.push(`Table altered: ${stmt.AlterTableStmt.relation.relname}`);
		}
		if (stmt.CreateStmt) {
			changes.push(`Table created: ${stmt.CreateStmt.relation.relname}`);
		}
		// Add more cases for different schema changes as needed
	}

	return changes;
}

function suggestCodeChanges(changes: string[]): void {
	// Analyze the workspace and suggest changes
	vscode.workspace.findFiles('**/*.ts').then((files) => {
		files.forEach((file) => {
			const filePath = file.fsPath;
			const fileContent = fs.readFileSync(filePath, 'utf-8');

			changes.forEach((change) => {
				if (fileContent.includes(change)) {
					vscode.window.showWarningMessage(
						`Consider updating: ${filePath} for ${change}`
					);
				}
			});
		});
	});
}
