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

    removeConfigurationChangeListener(listener: (config: Configuration) => void) {
        this.emitter.off(configurationEventName, listener);
    }

    isConfigChanged(config: Configuration) {
        // right now we only care about enable
        return config.enable !== this.config.enable;
    }

    updateConfigFromPluginConfig(config: Configuration) {
        // TODO this doesn't work because TS will resolve/load files already before we get the config request,
        // which leads to TS files that use Svelte files getting all kinds of type errors
        // const shouldWaitForConfigRequest = config.global == true;
        // const enable = config.enable ?? !shouldWaitForConfigRequest;
        this.config = {
            ...this.config,
            ...config
        };
        this.emitter.emit(configurationEventName, config);
    }

    getConfig() {
        return this.config;
    }
}
