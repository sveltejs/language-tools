import { EventEmitter } from 'events';

export enum ExecuteMode {
    None,
    FirstNonNull,
    Collect,
}

export class PluginHost {
    private emitter = new EventEmitter();
    private plugins: any[] = [];

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
        if (typeof plugin.onRegister === 'function') {
            plugin.onRegister(this);
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
        return this.plugins.find(plugin => typeof plugin[name] === 'function') != null;
    }
}
