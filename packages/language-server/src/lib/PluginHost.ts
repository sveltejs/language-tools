import { EventEmitter } from 'events';
import { Plugin } from '../api';
import { get } from 'lodash';

export enum ExecuteMode {
    None,
    FirstNonNull,
    Collect,
}

export class PluginHost {
    private emitter = new EventEmitter();
    private plugins: Plugin[] = [];
    private config: Config = {
        plugin: {},
    };

    on(name: string, listener: (...args: any[]) => void) {
        this.emitter.on(name, listener);
    }

    notify(name: string, ...args: any[]) {
        this.emitter.emit(name + '|pre', ...args);
        this.emitter.emit(name, ...args);
        this.emitter.emit(name + '|post', ...args);
    }

    register(plugin: Plugin) {
        this.plugins.push(plugin);
        this.config.plugin[plugin.pluginId] = plugin.defaultConfig;
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
        const plugins = this.enabledPlugins.filter(plugin => typeof plugin[name] === 'function');

        switch (mode) {
            case ExecuteMode.FirstNonNull:
                for (const plugin of plugins) {
                    const res = await plugin[name](...args);
                    if (res != null) {
                        return res;
                    }
                }
                return null;
            case ExecuteMode.Collect:
                return Promise.all(plugins.map(plugin => plugin[name](...args)));
            case ExecuteMode.None:
                await Promise.all(plugins.map(plugin => plugin[name](...args)));
                return;
        }
    }

    supports(name: string): boolean {
        return this.enabledPlugins.find(plugin => typeof plugin[name] === 'function') != null;
    }

    updateConfig(config: Config) {
        this.config = config;
    }

    getConfig<T>(key: string): T {
        return get(this.config.plugin, key) as any;
    }

    private get enabledPlugins(): any[] {
        return this.plugins.filter(p => this.getConfig(`${p.pluginId}.enable`));
    }
}

export interface Config {
    plugin: Record<string, any>;
}
