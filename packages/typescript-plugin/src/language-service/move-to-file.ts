import type ts from 'typescript/lib/tsserverlibrary';

export function decorateMoveToRefactoringFileSuggestions(ls: ts.LanguageService): void {
    const getMoveToRefactoringFileSuggestions = ls.getMoveToRefactoringFileSuggestions;

    ls.getMoveToRefactoringFileSuggestions = (
        fileName,
        positionOrRange,
        preferences,
        triggerReason,
        kind
    ) => {
        const program = ls.getProgram();

        if (!program) {
            return getMoveToRefactoringFileSuggestions(
                fileName,
                positionOrRange,
                preferences,
                triggerReason,
                kind
            );
        }

        const getSourceFiles = program.getSourceFiles;
        try {
            // typescript currently only allows js/ts files to be moved to.
            // Once there isn't a restriction anymore, we can remove this.
            program.getSourceFiles = () =>
                getSourceFiles().filter((file) => !file.fileName.endsWith('.svelte'));

            return getMoveToRefactoringFileSuggestions(
                fileName,
                positionOrRange,
                preferences,
                triggerReason,
                kind
            );
        } finally {
            program.getSourceFiles = getSourceFiles;
        }
    };
}
