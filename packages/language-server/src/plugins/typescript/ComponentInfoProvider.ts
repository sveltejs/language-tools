import ts from 'typescript';
import { isNotNullOrUndefined } from '../../utils';
import { findContainingNode } from './features/utils';

export type ComponentPartInfo = Array<{ name: string; type: string; doc?: string }>;

export interface ComponentInfoProvider {
    getEvents(): ComponentPartInfo;
    getSlotLets(slot?: string): ComponentPartInfo;
    getProps(): ComponentPartInfo;
}

export class JsOrTsComponentInfoProvider implements ComponentInfoProvider {
    private constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly classType: ts.Type
    ) {}

    getEvents(): ComponentPartInfo {
        const eventType = this.getType('$$events_def');
        if (!eventType) {
            return [];
        }

        return this.mapPropertiesOfType(eventType);
    }

    getSlotLets(slot = 'default'): ComponentPartInfo {
        const slotType = this.getType('$$slot_def');
        if (!slotType) {
            return [];
        }

        const slotLets = slotType.getProperties().find((prop) => prop.name === slot);
        if (!slotLets?.valueDeclaration) {
            return [];
        }

        const slotLetsType = this.typeChecker.getTypeOfSymbolAtLocation(
            slotLets,
            slotLets.valueDeclaration
        );

        return this.mapPropertiesOfType(slotLetsType);
    }

    getProps() {
        const props = this.getType('$$prop_def');
        if (!props) {
            return [];
        }

        return this.mapPropertiesOfType(props);
    }

    private getType(classProperty: string) {
        const symbol = this.classType.getProperty(classProperty);
        if (!symbol?.valueDeclaration) {
            return null;
        }

        return this.typeChecker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
    }

    private mapPropertiesOfType(type: ts.Type): ComponentPartInfo {
        return type
            .getProperties()
            .map((prop) => {
                // type would still be correct when there're multiple declarations
                const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
                if (!declaration) {
                    return;
                }

                return {
                    name: prop.name,
                    type: this.typeChecker.typeToString(
                        this.typeChecker.getTypeOfSymbolAtLocation(prop, declaration)
                    ),
                    doc: ts.displayPartsToString(prop.getDocumentationComment(this.typeChecker))
                };
            })
            .filter(isNotNullOrUndefined);
    }

    /**
     * The result of this shouldn't be cached as it could lead to memory leaks. The type checker
     * could become old and then multiple versions of it could exist.
     */
    static create(lang: ts.LanguageService, def: ts.DefinitionInfo): ComponentInfoProvider | null {
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
