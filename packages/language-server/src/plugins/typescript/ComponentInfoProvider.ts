import { ComponentEvents } from 'svelte2tsx';
import ts from 'typescript';
import { isNotNullOrUndefined } from '../../utils';
import { findContainingNode } from './features/utils';

type ComponentEventInfo = ReturnType<ComponentEvents['getAll']>;

export class JsOrTsComponentInfoProvider implements ComponentInfoProvider {
    private constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly classType: ts.Type
    ) {}

    getEvents(): ComponentEventInfo {
        const symbol = this.classType.getProperty('$$events_def');
        if (!symbol) {
            return [];
        }

        const declaration = symbol.valueDeclaration;
        if (!declaration) {
            return [];
        }

        const eventType = this.typeChecker.getTypeOfSymbolAtLocation(
            symbol,
            declaration
        );

        return eventType.getProperties()
            .map(prop => {
                if (!prop.valueDeclaration) {
                    return;
                }

                return {
                    name: prop.name,
                    type: this.typeChecker.typeToString(
                        this.typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration)
                    )
                };
            })
            .filter(isNotNullOrUndefined);
    }

    static create(
        lang: ts.LanguageService,
        def: ts.DefinitionInfo
    ): ComponentInfoProvider | null {
        const program = lang.getProgram();
        const sourceFile = program?.getSourceFile(def.fileName);

        if (!program || !sourceFile) {
            return null;
        }

        const defClass = findContainingNode(sourceFile, def.textSpan, ts.isClassDeclaration);

        if (!defClass) {
            return null;
        }

        const typeChecker = program.getTypeChecker();
        const classType = typeChecker.getTypeAtLocation(defClass);

        if (!classType) {
            return null;
        }

        return new JsOrTsComponentInfoProvider(typeChecker, classType);
    }
}

export interface ComponentInfoProvider {
    getEvents(): ComponentEventInfo
}
