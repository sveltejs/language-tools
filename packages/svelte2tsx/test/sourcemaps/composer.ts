import { get_extra_indent, Segment } from './helpers';
import { Line } from './parser';

type cmap = string | Segment;
type CommentOptions = { indent?: number };
type comment = [cmap, string] | readonly [cmap, string];
type Section = HorizontalRule | Comment | Line | string;

class Comment {
    readonly content: [string, string][];

    constructor(
        gen: Iterable<comment>,
        readonly options: CommentOptions = {}
    ) {
        this.content = Array.from(gen, ([cmap, message]): [string, string] => [
            typeof cmap === 'string' ? cmap : ' '.repeat(cmap.start) + cmap.text,
            message
        ]);
    }

    render(indent: number, col0_width: number, width: number) {
        col0_width = Math.max(col0_width, ...this.content.map(([map]) => map.length));
        if ('indent' in this.options) indent = this.options.indent;
        return this.content
            .map(([map, comment]) =>
                (' '.repeat(indent * 4) + map.padEnd(col0_width) + '    ' + comment).padEnd(width)
            )
            .join('\n');
    }
}

class HorizontalRule {
    constructor(
        readonly content?: string,
        readonly _fill: string = '-'
    ) {}

    fill(width: number) {
        return this.content
            ? this.content
                  .padStart(Math.floor((width + this.content.length) / 2), this._fill)
                  .padEnd(width, this._fill)
            : this._fill.repeat(width);
    }
}

/**
 * Creates a rule that puts the passed in context in the middle and fills up remaining
 * width around it with the given fill.
 */
function rule(content?: string, fill?: string): HorizontalRule {
    return new HorizontalRule(content, fill);
}

/**
 * Prints given line(s) in a multi-line comment block. (succeeding comments are joined together)
 */
function comment(lines: comment | Iterable<comment>, opts?: CommentOptions) {
    return new Comment(
        lines instanceof Array && lines.length === 2 && !(lines[0] instanceof Array)
            ? [lines]
            : (lines as Iterable<comment>),
        opts
    );
}

function is_inside_comment(section: Section) {
    return section instanceof HorizontalRule || section instanceof Comment;
}

export type ComposeHelper = { rule: typeof rule; comment: typeof comment };

export function compose_file(
    fn: (composer: ComposeHelper) => Iterable<Section>,
    opts: { width?: number; indent?: number; match_first_column_width?: boolean } = {}
) {
    const sections = [...fn({ rule, comment })];
    const width = opts.width ?? 150;
    const min_col0_width = opts.match_first_column_width
        ? Math.max(
              ...sections.map((section) =>
                  section instanceof Comment
                      ? Math.max(...section.content.map((line) => line[0].length))
                      : 0
              )
          )
        : 0;

    const content: string[] = [];
    if (sections[0] instanceof HorizontalRule || sections[0] instanceof Comment) {
        sections.unshift('');
    }

    for (let i = 0; i < sections.length; i++) {
        const { [i]: current, [i + 1]: next } = sections;
        let str = '';
        if (current instanceof HorizontalRule) {
            if (next instanceof HorizontalRule) continue;
            str = current.fill(width);
            if (!is_inside_comment(next)) {
                if (content[content.length - 1].includes('//')) {
                    str = '//' + current.fill(width - 2);
                } else {
                    str += comment_end;
                }
            }
        } else if (current instanceof Comment) {
            str = current.render(opts.indent ?? 0, min_col0_width, width);
            if (!(next === undefined || is_inside_comment(next))) str += comment_end;
        } else {
            str = ('' + current).trimRight().replace(/\t/g, '    ');
            if (is_inside_comment(next) && !str.includes('//')) {
                str = str.padEnd(width - get_extra_indent(str)) + comment_start;
            }
        }
        content.push(str);
    }

    return content.join('\n');
}

const comment_start = '{/**';
const comment_end = ' */}';
