import { Node } from 'estree-walker';
import MagicString from 'magic-string';

export class Scripts {
    // All script tags, no matter at what level, are listed within the root children, because
    // of the logic in htmlxparser.ts
    // To get the top level scripts, filter out all those that are part of children's children.
    // Those have another type ('Element' with name 'script').
    private scriptTags = (this.htmlxAst.children as Node[]).filter(
        (child) => child.type === 'Script'
    );
    private topLevelScripts = this.scriptTags;

    constructor(private htmlxAst: Node) {}

    checkIfElementIsScriptTag(node: Node, parent: Node) {
        if (parent !== this.htmlxAst && node.name === 'script') {
            this.topLevelScripts = this.topLevelScripts.filter(
                (tag) => tag.start !== node.start || tag.end !== node.end
            );
        }
    }

    checkIfContainsScriptTag(node: Node) {
        this.topLevelScripts = this.topLevelScripts.filter(
            (tag) => !(node.start <= tag.start && node.end >= tag.end)
        );
    }

    getTopLevelScriptTags(): { scriptTag: Node; moduleScriptTag: Node } {
        let scriptTag: Node = null;
        let moduleScriptTag: Node = null;
        // should be 2 at most, one each, so using forEach is safe
        this.topLevelScripts.forEach((tag) => {
            if (
                tag.attributes &&
                tag.attributes.find(
                    (a) =>
                        (a.name == 'context' &&
                            a.value.length == 1 &&
                            a.value[0].raw == 'module') ||
                        a.name === 'module'
                )
            ) {
                moduleScriptTag = tag;
            } else {
                scriptTag = tag;
            }
        });
        return { scriptTag, moduleScriptTag };
    }

    blankOtherScriptTags(str: MagicString): void {
        this.scriptTags
            .filter((tag) => !this.topLevelScripts.includes(tag))
            .forEach((tag) => {
                str.remove(tag.start, tag.end);
            });
    }
}
