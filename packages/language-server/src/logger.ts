export class Logger {
    private static logErrorsOnly = false;
    private static logDebug = false;

    static setLogErrorsOnly(logErrorsOnly: boolean) {
        Logger.logErrorsOnly = logErrorsOnly;
    }

    static setDebug(debug: boolean) {
        this.logDebug = debug;
    }

    static log(...args: any) {
        if (!Logger.logErrorsOnly) {
            console.log(...args);
        }
    }

    static error(...args: any) {
        console.error(...args);
    }
    
    /**
     * Debug logging is opt-in and the sometimes formatting the log message can be relatively expensive, 
     * so we check if debug logging is enabled before even calling the debug method.
     */
    static isDebugEnabled() {
        return !Logger.logErrorsOnly && Logger.logDebug;
    }

    static debug(...args: any) {
        if (Logger.isDebugEnabled()) {
            console.log(...args);
        }
    }
}
