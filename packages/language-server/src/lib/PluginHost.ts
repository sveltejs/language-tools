import { EventEmitter } from 'events';
import { get, merge } from 'lodash';
import { LSConfig, defaultLSConfig } from '../ls-config';

export enum ExecuteMode {
    None,
    FirstNonNull,
    Collect,
}

export class PluginHost {
    private emitter = new EventEmitter();
    private plugins: any[] = [];
    private config: LSConfig = defaultLSConfig;

    on(name: string, listener: (...args: any[]) => void) {
        this.emitter.on(name, listener);
    }

    notify(name: string, ...args: any[]) {
        this.emitter.emit(name + '|pre', ...args);
        this.emitter.emit(name, ...args);
        this.emitter.emit(name + '|post', ...args);
    }

    register(plugin: any) {
        this.plugins.push(plugin);
        if (typeof (plugin as any).onRegister === 'function') {
            (plugin as any).onRegister(this);
        }
    }

    execute<T>(name: string, args: any[], mode: ExecuteMode.FirstNonNull): Promise<T | null>;
    execute<T>(name: string, args: any[], mode: ExecuteMode.Collect): Promise<T[]>;
    execute<T>(name: string, args: any[], mode: ExecuteMode.None): Promise<void>;
    async execute<T>(
        name: string,
        args: any[],
        mode: ExecuteMode,
    ): Promise<(T | null) | T[] | void> {
        const plugins = this.plugins.filter(plugin => typeof plugin[name] === 'function');

        switch (mode) {
            case ExecuteMode.FirstNonNull:
                for (const plugin of plugins) {
                    const res = await this.tryExecutePlugin(plugin, name, args, null);
                    if (res != null) {
                        return res;
                    }
                }
                return null;
            case ExecuteMode.Collect:
                return Promise.all(
                    plugins.map(plugin => this.tryExecutePlugin(plugin, name, args, [])),
                );
            case ExecuteMode.None:
                await Promise.all(
                    plugins.map(plugin => this.tryExecutePlugin(plugin, name, args, null)),
                );
                return;
        }
    }

    updateConfig(config: LSConfig) {
        // Ideally we shouldn't need the merge here because all updates should be valid and complete configs.
        // But since those configs come from the client they might be out of synch with the valid config:
        // We might at some point in the future forget to synch config settings in all packages after updating the config.
        this.config = merge({}, defaultLSConfig, this.config, config);
    }

    getConfig<T>(key: string): T {
        return get(this.config, key) as any;
    }

    private async tryExecutePlugin(plugin: any, fnName: string, args: any[], failValue: any) {
        try {
            return await plugin[fnName](...args);
        } catch (e) {
            return failValue;
        }
    }
}
