import { EventEmitter } from 'events';

const configurationEventName = 'configuration-changed';

export interface Configuration {
    enable: false;
}

export class ConfigManager {
    private emitter = new EventEmitter();
    private config: Configuration = {
        enable: false
    };

    onConfigurationChanged(listener: (config: Configuration) => void) {
        this.emitter.on(configurationEventName, listener);
    }

    updateConfigFromPluginConfig(config: Configuration) {
        this.config = {
            ...this.config,
            ...config
        };
        this.emitter.emit(configurationEventName);
    }

    getConfig() {
        return this.config;
    }
}
