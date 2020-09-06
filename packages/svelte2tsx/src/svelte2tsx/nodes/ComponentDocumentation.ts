import { Node } from 'estree-walker';
import dedent from 'dedent-js';

/**
 * Add this tag to a HTML comment in a Svelte component and its contents will
 * be added as a docstring in the resulting JSX for the component class.
 */
const COMPONENT_DOCUMENTATION_HTML_COMMENT_TAG = '@component';

export class ComponentDocumentation {
    private componentDocumentation = '';

    handleComment = (node: Node) => {
        if (
            'data' in node &&
            typeof node.data === 'string' &&
            node.data.includes(COMPONENT_DOCUMENTATION_HTML_COMMENT_TAG)
        ) {
            this.componentDocumentation = node.data
                .replace(COMPONENT_DOCUMENTATION_HTML_COMMENT_TAG, '')
                .trim();
        }
    };

    getFormatted() {
        if (!this.componentDocumentation) {
            return '';
        }
        if (!this.componentDocumentation.includes('\n')) {
            return `/** ${this.componentDocumentation} */\n`;
        }

        const lines = dedent(this.componentDocumentation)
            .split('\n')
            .map((line) => ` *${line ? ` ${line}` : ''}`)
            .join('\n');

        return `/**\n${lines}\n */\n`;
    }
}
