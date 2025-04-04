import { IAttributeData, ITagData, newHTMLDataProvider } from 'vscode-html-languageservice';
import { htmlData } from 'vscode-html-languageservice/lib/umd/languageFacts/data/webCustomData';
import { unique } from '../../utils';

const svelteEvents = [
    ...(htmlData.globalAttributes?.filter(isEvent).map(mapToSvelteEvent) ?? []),
    {
        name: 'on:introstart',
        description: 'Available when element has transition'
    },
    {
        name: 'on:introend',
        description: 'Available when element has transition'
    },
    {
        name: 'on:outrostart',
        description: 'Available when element has transition'
    },
    {
        name: 'on:outroend',
        description: 'Available when element has transition'
    },
    // Pointer events
    { name: 'on:pointercancel' },
    { name: 'on:pointerdown' },
    { name: 'on:pointerenter' },
    { name: 'on:pointerleave' },
    { name: 'on:pointermove' },
    { name: 'on:pointerout' },
    { name: 'on:pointerover' },
    { name: 'on:pointerup' },
    // Mouse events
    { name: 'on:mouseenter' },
    { name: 'on:mouseleave' },
    // Other
    { name: 'on:hashchange' },
    { name: 'on:visibilitychange' }
];
const svelteAttributes: IAttributeData[] = [
    {
        name: 'bind:innerHTML',
        description: 'Available when contenteditable=true'
    },
    {
        name: 'bind:textContent',
        description: 'Available when contenteditable=true'
    },
    {
        name: 'bind:innerText',
        description: 'Available when contenteditable=true'
    },
    {
        name: 'bind:clientWidth',
        description: 'Available for block level elements. (read-only)'
    },
    {
        name: 'bind:clientHeight',
        description: 'Available for block level elements. (read-only)'
    },
    {
        name: 'bind:offsetWidth',
        description: 'Available for block level elements. (read-only)'
    },
    {
        name: 'bind:offsetHeight',
        description: 'Available for block level elements. (read-only)'
    },
    {
        name: 'bind:contentRect',
        description: 'Available for all elements. (read-only)'
    },
    {
        name: 'bind:contentBoxSize',
        description: 'Available for all elements. (read-only)'
    },
    {
        name: 'bind:borderBoxSize',
        description: 'Available for all elements. (read-only)'
    },
    {
        name: 'bind:devicePixelContentBoxSize',
        description: 'Available for all elements. (read-only)'
    },
    {
        name: 'bind:this',
        description:
            'To get a reference to a DOM node, use bind:this. If used on a component, gets a reference to that component instance.'
    }
];

// directives that takes a variable. Don't specify the variable here and let typescript handle it
const svelteDirectiveKeywords: IAttributeData[] = [
    {
        name: 'use:',
        description: 'Actions are functions that are called when an element is mounted.',
        references: [
            {
                name: 'Svelte.dev Reference',
                url: 'https://svelte.dev/docs/svelte/use'
            }
        ]
    },
    {
        name: 'transition:',
        description:
            'A transition is triggered by an element entering or leaving the DOM as a result of a state change.',
        references: [
            {
                name: 'Svelte.dev Reference',
                url: 'https://svelte.dev/docs/svelte/transition'
            }
        ]
    },
    {
        name: 'in:',
        description:
            'The in: and out: directives are identical to transition:, except that the resulting transitions are not bidirectional.',
        references: [
            {
                name: 'Svelte.dev Reference',
                url: 'https://svelte.dev/docs/svelte/in-and-out'
            }
        ]
    },
    {
        name: 'out:',
        description:
            'The in: and out: directives are identical to transition:, except that the resulting transitions are not bidirectional.',
        references: [
            {
                name: 'Svelte.dev Reference',
                url: 'https://svelte.dev/docs/svelte/in-and-out'
            }
        ]
    },
    {
        name: 'animate:',
        description:
            'An animation is triggered when the contents of a keyed each block are re-ordered.',
        references: [
            {
                name: 'Svelte.dev Reference',
                url: 'https://svelte.dev/docs/svelte/animate'
            }
        ]
    },
    {
        name: 'style:',
        description:
            'The style: directive provides a shorthand for setting multiple styles on an element.',
        references: [
            {
                name: 'Svelte.dev Reference',
                url: 'https://svelte.dev/docs/svelte/style'
            }
        ]
    }
];

const sveltekitAttributes: IAttributeData[] = [
    {
        name: 'data-sveltekit-keepfocus',
        description:
            'SvelteKit-specific attribute. Currently focused element will retain focus after navigation. Otherwise, focus will be reset to the body.',
        valueSet: 'v'
    },
    {
        name: 'data-sveltekit-noscroll',
        description:
            'SvelteKit-specific attribute. Will prevent scrolling after the link is clicked.',
        valueSet: 'v'
    },
    {
        name: 'data-sveltekit-preload-code',
        description:
            "SvelteKit-specific attribute. Will cause SvelteKit to run the page's load function as soon as the user hovers over the link (on a desktop) or touches it (on mobile), rather than waiting for the click event to trigger navigation.",
        valueSet: 'v',
        values: [
            { name: 'eager' },
            { name: 'viewport' },
            { name: 'hover' },
            { name: 'tap' },
            { name: 'off' }
        ]
    },
    {
        name: 'data-sveltekit-preload-data',
        description:
            "SvelteKit-specific attribute. Will cause SvelteKit to run the page's load function as soon as the user hovers over the link (on a desktop) or touches it (on mobile), rather than waiting for the click event to trigger navigation.",
        valueSet: 'v',
        values: [{ name: 'hover' }, { name: 'tap' }, { name: 'off' }]
    },
    {
        name: 'data-sveltekit-reload',
        description:
            'SvelteKit-specific attribute. Will cause SvelteKit to do a normal browser navigation which results in a full page reload.',
        valueSet: 'v'
    },
    {
        name: 'data-sveltekit-replacestate',
        description:
            'SvelteKit-specific attribute. Will replace the current `history` entry rather than creating a new one with `pushState` when the link is clicked.',
        valueSet: 'v'
    }
];

const svelteTags: ITagData[] = [
    {
        name: 'svelte:self',
        description:
            'Allows a component to include itself, recursively.\n\nIt cannot appear at the top level of your markup; it must be inside an if or each block to prevent an infinite loop.',
        attributes: []
    },
    {
        name: 'svelte:component',
        description:
            'Renders a component dynamically, using the component constructor specified as the this property. When the property changes, the component is destroyed and recreated.\n\nIf this is falsy, no component is rendered.',
        attributes: [
            {
                name: 'this',
                description:
                    'Component to render.\n\nWhen this property changes, the component is destroyed and recreated.\nIf this is falsy, no component is rendered.'
            }
        ]
    },
    {
        name: 'svelte:element',
        description:
            'Renders a DOM element dynamically, using the string as the this property. When the property changes, the element is destroyed and recreated.\n\nIf this is falsy, no element is rendered.',
        attributes: [
            {
                name: 'this',
                description:
                    'DOM element to render.\n\nWhen this property changes, the element is destroyed and recreated.\nIf this is falsy, no element is rendered.'
            }
        ]
    },
    {
        name: 'svelte:window',
        description:
            'Allows you to add event listeners to the window object without worrying about removing them when the component is destroyed, or checking for the existence of window when server-side rendering.',
        attributes: [
            {
                name: 'bind:innerWidth',
                description: 'Bind to the inner width of the window. (read-only)'
            },
            {
                name: 'bind:innerHeight',
                description: 'Bind to the inner height of the window. (read-only)'
            },
            {
                name: 'bind:outerWidth',
                description: 'Bind to the outer width of the window. (read-only)'
            },
            {
                name: 'bind:outerHeight',
                description: 'Bind to the outer height of the window. (read-only)'
            },
            {
                name: 'bind:scrollX',
                description: 'Bind to the scroll x position of the window.'
            },
            {
                name: 'bind:scrollY',
                description: 'Bind to the scroll y position of the window.'
            },
            {
                name: 'bind:online',
                description: 'An alias for window.navigator.onLine'
            }
        ]
    },
    {
        name: 'svelte:html',
        description:
            'This element allows you to add properties and listeners to events on `document.documentElement`. This is useful for attributes such as `lang` which influence how the browser interprets the content.',
        attributes: []
    },
    {
        name: 'svelte:document',
        description:
            "As with <svelte:window>, this element allows you to add listeners to events on document, such as visibilitychange, which don't fire on window.",
        attributes: [
            {
                name: 'bind:fullscreenElement',
                description:
                    'Bind to the element that is being in full screen mode in this document. (read-only)'
            },
            {
                name: 'bind:visibilityState',
                description: 'Bind to visibility of the document. (read-only)'
            }
        ]
    },
    {
        name: 'svelte:body',
        description:
            "As with <svelte:window>, this element allows you to add listeners to events on document.body, such as mouseenter and mouseleave which don't fire on window.",
        attributes: []
    },
    {
        name: 'svelte:head',
        description:
            'This element makes it possible to insert elements into document.head. During server-side rendering, head content exposed separately to the main html content.',
        attributes: []
    },
    {
        name: 'svelte:options',
        description: 'Provides a place to specify per-component compiler options',
        attributes: [
            {
                name: 'immutable',
                description:
                    'If true, tells the compiler that you promise not to mutate any objects. This allows it to be less conservative about checking whether values have changed.',
                values: [
                    {
                        name: '{true}',
                        description:
                            'You never use mutable data, so the compiler can do simple referential equality checks to determine if values have changed'
                    },
                    {
                        name: '{false}',
                        description:
                            'The default. Svelte will be more conservative about whether or not mutable objects have changed'
                    }
                ]
            },
            {
                name: 'accessors',
                description:
                    "If true, getters and setters will be created for the component's props. If false, they will only be created for readonly exported values (i.e. those declared with const, class and function). If compiling with customElement: true this option defaults to true.",
                values: [
                    {
                        name: '{true}',
                        description: "Adds getters and setters for the component's props"
                    },
                    {
                        name: '{false}',
                        description: 'The default.'
                    }
                ]
            },
            {
                name: 'namespace',
                description: 'The namespace where this component will be used, most commonly "svg"'
            },
            {
                name: 'tag',
                description: 'The name to use when compiling this component as a custom element'
            }
        ]
    },
    {
        name: 'svelte:fragment',
        description:
            'This element is useful if you want to assign a component to a named slot without creating a wrapper DOM element.',
        attributes: [
            {
                name: 'slot',
                description: 'The name of the named slot that should be targeted.'
            }
        ]
    },
    {
        name: 'slot',
        description:
            'Components can have child content, in the same way that elements can.\n\nThe content is exposed in the child component using the <slot> element, which can contain fallback content that is rendered if no children are provided.',
        attributes: [
            {
                name: 'name',
                description:
                    'Named slots allow consumers to target specific areas. They can also have fallback content.'
            }
        ]
    },
    {
        name: 'svelte:boundary',
        description:
            'Represents a boundary in the application. Can catch errors and show fallback UI',
        attributes: [
            {
                name: 'onerror',
                description: 'Called when an error occured within the boundary'
            }
        ]
    }
];

const mediaAttributes: IAttributeData[] = [
    {
        name: 'bind:duration',
        description: 'The total duration of the video, in seconds. (readonly)'
    },
    {
        name: 'bind:buffered',
        description: 'An array of {start, end} objects. (readonly)'
    },
    {
        name: 'bind:seekable',
        description: 'An array of {start, end} objects. (readonly)'
    },
    {
        name: 'bind:played',
        description: 'An array of {start, end} objects. (readonly)'
    },
    {
        name: 'bind:seeking',
        description: 'boolean. (readonly)'
    },
    {
        name: 'bind:ended',
        description: 'boolean. (readonly)'
    },
    {
        name: 'bind:currentTime',
        description: 'The current point in the video, in seconds.'
    },
    {
        name: 'bind:playbackRate',
        description: "how fast or slow to play the video, where 1 is 'normal'"
    },
    {
        name: 'bind:paused'
    },
    {
        name: 'bind:volume',
        description: 'A value between 0 and 1'
    },
    {
        name: 'bind:muted'
    },
    {
        name: 'bind:readyState'
    }
];
const videoAttributes: IAttributeData[] = [
    {
        name: 'bind:videoWidth',
        description: 'readonly'
    },
    {
        name: 'bind:videoHeight',
        description: 'readonly'
    }
];

const indeterminateAttribute: IAttributeData = {
    name: 'indeterminate',
    description: 'Available for type="checkbox"'
};

const addAttributes: Record<string, IAttributeData[]> = {
    select: [{ name: 'bind:value' }],
    input: [
        { name: 'bind:value' },
        { name: 'bind:group', description: 'Available for type="radio" and type="checkbox"' },
        { name: 'bind:checked', description: 'Available for type="checkbox"' },
        { name: 'bind:files', description: 'Available for type="file" (readonly)' },
        indeterminateAttribute,
        { ...indeterminateAttribute, name: 'bind:indeterminate' }
    ],
    img: [{ name: 'bind:naturalWidth' }, { name: 'bind:naturalHeight' }],
    textarea: [{ name: 'bind:value' }],
    video: [...mediaAttributes, ...videoAttributes],
    audio: [...mediaAttributes],
    details: [
        {
            name: 'bind:open'
        }
    ],
    script: [
        {
            name: 'generics',
            description:
                'Generics used within the components. Only available when using TypeScript.'
        }
    ]
};

const html5Tags = htmlData.tags!.map((tag) => {
    let attributes = tag.attributes.map(mapToSvelteEvent);
    if (addAttributes[tag.name]) {
        attributes = [...attributes, ...addAttributes[tag.name]];
    }
    return {
        ...tag,
        attributes
    };
});

export const svelteHtmlDataProvider = newHTMLDataProvider('svelte-builtin', {
    version: 1,
    globalAttributes: [
        ...htmlData.globalAttributes!,
        ...svelteDirectiveKeywords,
        ...svelteEvents,
        ...svelteAttributes,
        ...sveltekitAttributes
    ],
    tags: [...html5Tags, ...svelteTags],

    // TODO remove this after it's fixed in the html language service
    valueSets:
        htmlData.valueSets?.map((set) => ({
            name: set.name,
            values: unique(set.values)
        })) ?? []
});

const originalProvideAttributes =
    svelteHtmlDataProvider.provideAttributes.bind(svelteHtmlDataProvider);

svelteHtmlDataProvider.provideAttributes = (tag: string) => {
    if (tag === 'svelte:boundary' || tag === 'svelte:options') {
        // We don't want the global attributes for these tags
        return svelteTags.find((t) => t.name === tag)?.attributes ?? [];
    }

    return originalProvideAttributes(tag);
};

function isEvent(attr: IAttributeData) {
    return attr.name.startsWith('on');
}

function mapToSvelteEvent(attr: IAttributeData) {
    return {
        ...attr,
        name: attr.name.replace(/^on/, 'on:')
    };
}
