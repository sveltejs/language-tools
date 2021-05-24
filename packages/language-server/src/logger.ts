export class Logger {
    private static logErrorsOnly = true;
    static setLogErrorsOnly(logErrorsOnly: boolean) {
        Logger.logErrorsOnly = logErrorsOnly;
    }

    static log(...args: any) {
        if (!Logger.logErrorsOnly) {
            console.log(...args);
        }
    }

    static error(...args: any) {
        console.error(...args);
    }
}
