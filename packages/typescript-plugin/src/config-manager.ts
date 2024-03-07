import { EventEmitter } from 'events';

const configurationEventName = 'configuration-changed';

export interface Configuration {
    global?: boolean;
    enable: boolean;
    /** Skip the Svelte detection and assume this is a Svelte project */
    assumeIsSvelteProject: boolean;
}

export class ConfigManager {
    private emitter = new EventEmitter();
    private config: Configuration = {
        enable: true,
        assumeIsSvelteProject: false
    };

    onConfigurationChanged(listener: (config: Configuration) => void) {
        this.emitter.on(configurationEventName, listener);
    }

    isConfigChanged(config: Configuration) {
        // right now we only care about enable
        return config.enable !== this.config.enable;
    }

    updateConfigFromPluginConfig(config: Configuration) {
        const shouldWaitForConfigRequest = config.global == true;
        const enable = config.enable ?? !shouldWaitForConfigRequest;
        this.config = {
            ...this.config,
            ...config,
            enable
        };
        this.emitter.emit(configurationEventName, config);
    }

    getConfig() {
        return this.config;
    }
}
