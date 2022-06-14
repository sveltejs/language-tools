import { Position, Range } from 'vscode-languageserver';
import { SvelteDocumentSnapshot } from './DocumentSnapshot';
import { Document } from '../../lib/documents';
import { SvelteNode } from './svelte-ast-utils';
export class CSSClassDefinitionLocator {
    initialNodeAt: SvelteNode;
    constructor(
        public tsDoc: SvelteDocumentSnapshot,
        public position: Position,
        public document: Document
    ) {
        this.initialNodeAt = this.tsDoc.svelteNodeAt(this.position) as SvelteNode;
    }

    getCSSClassDefinition() {
        if (this.isStandardClassFormat()) {
            return this.getStandardFormatClassName();
        }

        if (this.isDirectiveFormat() && this.initialNodeAt.name) {
            return this.getDefinitionRangeWithinStyleSection(`.${this.initialNodeAt.name}`);
        }

        if (this.isConditionalExpressionClassFormat() && this.initialNodeAt.value) {
            return this.getDefinitionRangeWithinStyleSection(`.${this.initialNodeAt.value}`);
        }

        return false;
    }

    /**
     * Standard format:
     * class="test test1"
     */
    private isStandardClassFormat() {
        if (this.initialNodeAt?.type == 'Text' && this.initialNodeAt?.parent?.name == 'class') {
            return true;
        }

        return false;
    }

    /**
     * Conditional Expression format:
     * class="{current === 'baz' ? 'selected' : ''
     */
    private isConditionalExpressionClassFormat() {
        if (
            this.initialNodeAt?.type == 'Literal' &&
            this.initialNodeAt?.parent?.type == 'ConditionalExpression' &&
            this.initialNodeAt?.parent.parent?.parent?.name == 'class'
        ) {
            return true;
        }

        return false;
    }

    /**
     * Class Directive format:
     * class:active="{current === 'foo'}"
     */
    private isDirectiveFormat() {
        if (this.initialNodeAt?.type == 'Class' && this.initialNodeAt?.parent?.type == 'Element') {
            return true;
        }

        return false;
    }

    private getStandardFormatClassName() {
        const testEndTagRange = Range.create(
            Position.create(this.position.line, 0),
            Position.create(this.position.line, this.position.character)
        );
        const text = this.document.getText(testEndTagRange);

        let loopLength = text.length;
        let testPosition = this.position.character;
        let spaceCount = 0;

        //Go backwards until hitting a " and keep track of how many spaces happened along the way
        while (loopLength) {
            const testEndTagRange = Range.create(
                Position.create(this.position.line, testPosition - 1),
                Position.create(this.position.line, testPosition)
            );
            const text = this.document.getText(testEndTagRange);
            if (text === ' ') {
                spaceCount++;
            }

            if (text === '"') {
                break;
            }

            testPosition--;
            loopLength--;
        }

        const cssClassName = this.initialNodeAt?.data.split(' ')[spaceCount];

        return this.getDefinitionRangeWithinStyleSection(`.${cssClassName}`);
    }

    private getDefinitionRangeWithinStyleSection(targetClass: string) {
        let indexOccurence = this.document.content.indexOf(targetClass, 0);

        while (indexOccurence >= 0) {
            if (this.isOffsetWithinStyleSection(indexOccurence)) {
                const startPosition = this.document.positionAt(indexOccurence);
                const targetRange = Range.create(
                    startPosition,
                    Position.create(
                        startPosition.line,
                        startPosition.character + targetClass.length
                    )
                );
                indexOccurence = this.document.content.indexOf(targetClass, indexOccurence + 1);

                if (!this.isExactClassMatch(targetRange)) {
                    continue;
                }

                return targetRange;
            }
        }
    }

    private isOffsetWithinStyleSection(offsetPosition: number) {
        if (this.document.styleInfo) {
            if (
                offsetPosition > this.document.styleInfo?.start &&
                offsetPosition < this.document.styleInfo?.end
            ) {
                return true;
            }
        }

        return false;
    }

    private isExactClassMatch(testRange: Range) {
        //Check nothing before the test position
        if (testRange.start.character > 0) {
            const beforerange = Range.create(
                Position.create(testRange.start.line, testRange.start.character - 1),
                Position.create(testRange.start.line, testRange.start.character)
            );
            if (this.document.getText(beforerange).trim()) {
                return false;
            }
        }

        //Check space or { is after the test position
        const afterRange = Range.create(
            Position.create(testRange.end.line, testRange.end.character),
            Position.create(testRange.end.line, testRange.end.character + 1)
        );
        const afterRangeText = this.document.getText(afterRange).trim();
        if (afterRangeText == '' || afterRangeText == '{') {
            return true;
        }

        return false;
    }
}
