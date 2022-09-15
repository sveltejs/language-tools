import { ExtensionContext } from 'vscode';
import { addGenerateKitRouteFilesCommand } from './generateFiles';

export function setupSvelteKit(context: ExtensionContext) {
    addGenerateKitRouteFilesCommand(context);
}
