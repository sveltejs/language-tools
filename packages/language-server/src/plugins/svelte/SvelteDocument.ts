import { SourceMapConsumer } from 'source-map';
import { PreprocessorGroup , Processed } from 'svelte/types/compiler/preprocess';
import type { compile } from 'svelte/compiler';
import { CompileOptions } from 'svelte/types/compiler/interfaces';

import { Position } from 'vscode-languageserver';
import {
    Document,
    DocumentMapper,
    extractScriptTags,
    extractStyleTag,
    FragmentMapper,
    IdentityMapper,
    offsetAt,
    SourceMapDocumentMapper,
    TagInformation
} from '../../lib/documents';
import { importSvelte } from '../../importPackage';
import { isNotNullOrUndefined } from '../../utils';

export type SvelteCompileResult = ReturnType<typeof compile>;

export enum TranspileErrorSource {
    Script = 'Script',
    Style = 'Style',
}

/**
 * Represents a text document that contains a svelte component.
 */
export class SvelteDocument {
    private transpiledDoc: TranspiledSvelteDocument | undefined;
    private compileResult: SvelteCompileResult | undefined;

    public script: TagInformation | null;
    public moduleScript: TagInformation | null;
    public style: TagInformation | null;
    public languageId = 'svelte';
    public version = 0;
    public uri = this.parent.uri;
    public config = this.parent.config;

    constructor(private parent: Document) {
        this.script = this.parent.scriptInfo;
        this.moduleScript = this.parent.moduleScriptInfo;
        this.style = this.parent.styleInfo;
        this.version = this.parent.version;
    }

    getText() {
        return this.parent.getText();
    }

    getFilePath(): string {
        return this.parent.getFilePath() || '';
    }

    offsetAt(position: Position): number {
        return this.parent.offsetAt(position);
    }

    async getTranspiled(): Promise<TranspiledSvelteDocument> {
        if (!this.transpiledDoc) {
            this.transpiledDoc = await TranspiledSvelteDocument.create(
                this.parent,
                this.parent.config.preprocess
            );
        }
        return this.transpiledDoc;
    }

    async getCompiled(): Promise<SvelteCompileResult> {
        if (!this.compileResult) {
            this.compileResult = await this.getCompiledWith(this.parent.config.compilerOptions);
        }

        return this.compileResult;
    }

    async getCompiledWith(options: CompileOptions = {}): Promise<SvelteCompileResult> {
        const svelte = importSvelte(this.getFilePath());
        return svelte.compile((await this.getTranspiled()).getText(), options);
    }

    /**
     * Needs to be called before cleanup to prevent source map memory leaks.
     */
    destroyTranspiled() {
        if (this.transpiledDoc) {
            this.transpiledDoc.destroy();
            this.transpiledDoc = undefined;
        }
    }
}

export class TranspiledSvelteDocument implements Pick<DocumentMapper, 'getOriginalPosition'> {
    static async create(
        document: Document,
        preprocessors: PreprocessorGroup | PreprocessorGroup[] = []
    ) {
        const { transpiled, processedScripts, processedStyles } = await transpile(
            document,
            preprocessors
        );
        const scriptMapper = await SvelteFragmentMapper.createScript(
            document,
            transpiled,
            processedScripts
        );
        const styleMapper = await SvelteFragmentMapper.createStyle(
            document,
            transpiled,
            processedStyles
        );

        return new TranspiledSvelteDocument(document, transpiled, scriptMapper, styleMapper);
    }

    private fragmentInfos = [this.scriptMapper?.fragmentInfo, this.styleMapper?.fragmentInfo]
        .filter(isNotNullOrUndefined)
        .sort((i1, i2) => i1.end - i2.end);

    private constructor(
        private parent: Document,
        private transpiled: string,
        public scriptMapper: SvelteFragmentMapper | null,
        public styleMapper: SvelteFragmentMapper | null
    ) {}

    getOriginalPosition(generatedPosition: Position): Position {
        if (this.scriptMapper?.isInTranspiledFragment(generatedPosition)) {
            return this.scriptMapper.getOriginalPosition(generatedPosition);
        }
        if (this.styleMapper?.isInTranspiledFragment(generatedPosition)) {
            return this.styleMapper.getOriginalPosition(generatedPosition);
        }

        // Position is not in fragments, but we still need to account for
        // the length differences of the fragments before the position.
        let offset = offsetAt(generatedPosition, this.transpiled);
        for (const fragmentInfo of this.fragmentInfos) {
            if (offset > fragmentInfo.end) {
                offset += fragmentInfo.diff;
            }
        }
        return this.parent.positionAt(offset);
    }

    getURL(): string {
        return this.parent.getURL();
    }

    getText() {
        return this.transpiled;
    }

    /**
     * Needs to be called before cleanup to prevent source map memory leaks.
     */
    destroy() {
        this.scriptMapper?.destroy();
        this.styleMapper?.destroy();
    }
}

export class SvelteFragmentMapper {
    static async createStyle(originalDoc: Document, transpiled: string, processed: Processed[]) {
        return SvelteFragmentMapper.create(
            originalDoc,
            transpiled,
            originalDoc.styleInfo,
            extractStyleTag(transpiled),
            processed
        );
    }

    static async createScript(originalDoc: Document, transpiled: string, processed: Processed[]) {
        const scriptInfo = originalDoc.scriptInfo || originalDoc.moduleScriptInfo;
        const maybeScriptTag = extractScriptTags(transpiled);
        const maybeScriptTagInfo =
            maybeScriptTag && (maybeScriptTag.script || maybeScriptTag.moduleScript);

        return SvelteFragmentMapper.create(
            originalDoc,
            transpiled,
            scriptInfo,
            maybeScriptTagInfo || null,
            processed
        );
    }

    private static async create(
        originalDoc: Document,
        transpiled: string,
        originalTagInfo: TagInformation | null,
        transpiledTagInfo: TagInformation | null,
        processed: Processed[]
    ) {
        const sourceMapper =
            processed.length > 0
                ? await SvelteFragmentMapper.createSourceMapper(processed, originalDoc)
                : new IdentityMapper(originalDoc.uri);

        if (originalTagInfo && transpiledTagInfo) {
            const sourceLength = originalTagInfo.container.end - originalTagInfo.container.start;
            const transpiledLength =
                transpiledTagInfo.container.end - transpiledTagInfo.container.start;
            const diff = sourceLength - transpiledLength;

            return new SvelteFragmentMapper(
                { end: transpiledTagInfo.container.end, diff },
                new FragmentMapper(originalDoc.getText(), originalTagInfo, originalDoc.uri),
                new FragmentMapper(transpiled, transpiledTagInfo, originalDoc.uri),
                sourceMapper
            );
        }

        return null;
    }

    private static async createSourceMapper(processed: Processed[], originalDoc: Document) {
        return processed.reduce(
            async (parent, processedSingle) =>
                processedSingle?.map
                    ? new SourceMapDocumentMapper(
                          await new SourceMapConsumer(processedSingle.map.toString()),
                          originalDoc.uri,
                          await parent
                      )
                    : new IdentityMapper(originalDoc.uri, await parent),
            Promise.resolve<DocumentMapper>(<any>undefined)
        );
    }

    private constructor(
        /**
         * End offset + length difference to original
         */
        public fragmentInfo: { end: number; diff: number },
        /**
         * Maps between full original source and fragment within that original.
         */
        private originalFragmentMapper: DocumentMapper,
        /**
         * Maps between full transpiled source and fragment within that transpiled.
         */
        private transpiledFragmentMapper: DocumentMapper,
        /**
         * Maps between original and transpiled, within fragment.
         */
        private sourceMapper: DocumentMapper
    ) {}

    isInTranspiledFragment(generatedPosition: Position): boolean {
        return this.transpiledFragmentMapper.isInGenerated(generatedPosition);
    }

    getOriginalPosition(generatedPosition: Position): Position {
        // Map the position to be relative to the transpiled fragment
        const positionInTranspiledFragment = this.transpiledFragmentMapper.getGeneratedPosition(
            generatedPosition
        );
        // Map the position, using the sourcemap, to the original position in the source fragment
        const positionInOriginalFragment = this.sourceMapper.getOriginalPosition(
            positionInTranspiledFragment
        );
        // Map the position to be in the original fragment's parent
        return this.originalFragmentMapper.getOriginalPosition(positionInOriginalFragment);
    }

    /**
     * Needs to be called before cleanup to prevent source map memory leaks.
     */
    destroy() {
        if (this.sourceMapper.destroy) {
            this.sourceMapper.destroy();
        }
    }
}

async function transpile(
    document: Document,
    preprocessors: PreprocessorGroup | PreprocessorGroup[] = []
) {
    preprocessors = Array.isArray(preprocessors) ? preprocessors : [preprocessors];
    const processedScripts: Processed[] = [];
    const processedStyles: Processed[] = [];

    const wrappedPreprocessors = preprocessors.map((preprocessor) => {
        const wrappedPreprocessor: PreprocessorGroup = { markup: preprocessor.markup };

        if (preprocessor.script) {
            wrappedPreprocessor.script = async (args: any) => {
                try {
                    const res = await preprocessor.script!(args);
                    if (res && res.map) {
                        processedScripts.push(res);
                    }
                    return res;
                } catch (e) {
                    e.__source = TranspileErrorSource.Script;
                    throw e;
                }
            };
        }

        if (preprocessor.style) {
            wrappedPreprocessor.style = async (args: any) => {
                try {
                    const res = await preprocessor.style!(args);
                    if (res && res.map) {
                        processedStyles.push(res);
                    }
                    return res;
                } catch (e) {
                    e.__source = TranspileErrorSource.Style;
                    throw e;
                }
            };
        }

        return wrappedPreprocessor;
    });

    const svelte = importSvelte(document.getFilePath() || '');
    const transpiled = (
        await svelte.preprocess(document.getText(), wrappedPreprocessors, {
            filename: document.getFilePath() || ''
        })
    ).toString();

    return { transpiled, processedScripts, processedStyles };
}
