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
        private readonly classType: ts.Type,
        private readonly useSvelte5PlusPropsParameter: boolean = false
    ) {}

    getEvents(): ComponentPartInfo {
        const eventType = this.getType(
            this.useSvelte5PlusPropsParameter ? '$$events' : '$$events_def'
        );
        if (!eventType) {
            return [];
        }

        return this.mapPropertiesOfType(eventType);
    }

    getSlotLets(slot = 'default'): ComponentPartInfo {
        const slotType = this.getType(this.useSvelte5PlusPropsParameter ? '$$slots' : '$$slot_def');
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
        if (!this.useSvelte5PlusPropsParameter) {
            const props = this.getType('$$prop_def');
            if (!props) {
                return [];
            }

            return this.mapPropertiesOfType(props);
        }

        return this.mapPropertiesOfType(this.classType).filter(
            (prop) => !prop.name.startsWith('$$')
        );
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
                const declaration =
                    prop.valueDeclaration ??
                    prop.declarations?.[0] ??
                    // very complex types are hidden on this thing for some reason
                    (prop as any)?.links?.mappedType?.declaration;
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
    static create(
        lang: ts.LanguageService,
        def: ts.DefinitionInfo,
        isSvelte5Plus: boolean
    ): ComponentInfoProvider | null {
        const program = lang.getProgram();
        const sourceFile = program?.getSourceFile(def.fileName);

        if (!program || !sourceFile) {
            return null;
        }

        const defIdentifier = findContainingNode(sourceFile, def.textSpan, ts.isIdentifier);

        if (!defIdentifier) {
            return null;
        }

        const typeChecker = program.getTypeChecker();

        const componentSymbol = typeChecker.getSymbolAtLocation(defIdentifier);

        if (!componentSymbol) {
            return null;
        }

        const type = typeChecker.getTypeOfSymbolAtLocation(componentSymbol, defIdentifier);

        if (type.isClass()) {
            return new JsOrTsComponentInfoProvider(typeChecker, type);
        }

        const constructorSignatures = type.getConstructSignatures();
        if (constructorSignatures.length === 1) {
            return new JsOrTsComponentInfoProvider(
                typeChecker,
                constructorSignatures[0].getReturnType()
            );
        }

        if (!isSvelte5Plus) {
            return null;
        }

        const signatures = type.getCallSignatures();
        if (signatures.length !== 1) {
            return null;
        }

        const propsParameter = signatures[0].parameters[1];
        if (!propsParameter) {
            return null;
        }
        const propsParameterType = typeChecker.getTypeOfSymbol(propsParameter);

        return new JsOrTsComponentInfoProvider(
            typeChecker,
            propsParameterType,
            /** useSvelte5PlusPropsParameter */ true
        );
    }
}
