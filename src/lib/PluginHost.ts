import { EventEmitter } from 'events';

export enum ExecuteMode {
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
        this.emitter.emit(name, ...args);
    }

    register(plugin: any) {
        this.plugins.push(plugin);
    }

    execute<T>(name: string, args: any[], mode: ExecuteMode.FirstNonNull): Promise<T | null>;
    execute<T>(name: string, args: any[], mode: ExecuteMode.Collect): Promise<T[]>;
    async execute<T>(name: string, args: any[], mode: ExecuteMode): Promise<(T | null) | T[]> {
        const plugins = this.plugins.filter(plugin => typeof plugin[name] === 'function');

        switch (mode) {
            case ExecuteMode.FirstNonNull:
                for (const plugin of plugins) {
                    const res = await plugin[name](...args);
                    if (res != null) {
                        return res;
                    }
                }
                break;
            case ExecuteMode.Collect:
                return Promise.all(plugins.map(plugin => plugin[name](...args)));
        }

        return null;
    }
}
