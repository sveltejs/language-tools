import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { commands, ExtensionContext, extensions, window, workspace } from 'vscode';

export class TsPlugin {
    private enabled: boolean;

    static create(context: ExtensionContext) {
        new TsPlugin(context);
    }

    private constructor(context: ExtensionContext) {
        this.enabled = this.getEnabledState();
        this.askToEnable(this.enabled);
        this.toggleTsPlugin(this.enabled);

        context.subscriptions.push(
            workspace.onDidChangeConfiguration(() => {
                const enabled = this.getEnabledState();
                if (enabled !== this.enabled) {
                    this.enabled = enabled;
                    this.toggleTsPlugin(this.enabled);
                }
            })
        );
    }

    private getEnabledState(): boolean {
        return workspace.getConfiguration('svelte').get<boolean>('enable-ts-plugin') ?? false;
    }

    private toggleTsPlugin(enable: boolean) {
        const extension = extensions.getExtension('svelte.svelte-vscode');
        if (!extension) {
            // This shouldn't be possible
            return;
        }

        const packageJson = join(extension.extensionPath, 'package.json');
        const enabled = '"typescriptServerPlugins"';
        const disabled = '"typescriptServerPlugins-disabled"';
        try {
            const packageText = readFileSync(packageJson, 'utf8');
            if (packageText.includes(disabled) && enable) {
                const newText = packageText.replace(disabled, enabled);
                writeFileSync(packageJson, newText, 'utf8');
                this.showReload(true);
            } else if (packageText.includes(enabled) && !enable) {
                const newText = packageText.replace(enabled, disabled);
                writeFileSync(packageJson, newText, 'utf8');
                this.showReload(false);
            } else if (!packageText.includes(enabled) && !packageText.includes(disabled)) {
                window.showWarningMessage('Unknown Svelte for VS Code package.json status.');
            }
        } catch (err) {
            window.showWarningMessage(
                'Svelte for VS Code package.json update failed, TypeScript plugin could not be toggled.'
            );
        }
    }

    private async showReload(enabled: boolean) {
        // Restarting the TSServer via a command isn't enough, the whole VS Code window needs to reload
        let message = `TypeScript Svelte Plugin ${enabled ? 'enabled' : 'disabled'}.`;
        if (enabled) {
            message +=
                ' Note that changes of Svelte files are only noticed by TS/JS files after they are saved to disk.';
        }
        message += ' Please reload VS Code to restart the TS Server.';

        const reload = await window.showInformationMessage(message, 'Reload Window');
        if (reload) {
            commands.executeCommand('workbench.action.reloadWindow');
        }
    }

    private async askToEnable(enabled: boolean) {
        const shouldAsk = workspace
            .getConfiguration('svelte')
            .get<boolean>('ask-to-enable-ts-plugin');
        if (enabled || !shouldAsk) {
            return;
        }

        const answers = ['Ask again later', "Don't show this message again", 'Enable Plugin'];
        const response = await window.showInformationMessage(
            'The Svelte for VS Code extension now contains a TypeScript plugin. ' +
                'Enabling it will provide intellisense for Svelte files from TS/JS files. ' +
                'Would you like to enable it? ' +
                'You can always enable/disable it later on through the extension settings.',
            ...answers
        );

        if (response === answers[2]) {
            workspace.getConfiguration('svelte').update('enable-ts-plugin', true, true);
        } else if (response === answers[1]) {
            workspace.getConfiguration('svelte').update('ask-to-enable-ts-plugin', false, true);
        }
    }
}
