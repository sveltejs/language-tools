import { IAttributeData, ITagData, newHTMLDataProvider } from 'vscode-html-languageservice';
import { htmlData } from 'vscode-html-languageservice/lib/umd/languageFacts/data/webCustomData';
import { unique } from '../../utils';

const svelteEvents: IAttributeData[] = [
    {
        name: 'on:introstart',
        description: 'Available when element has transition.',
        references: [
            {
                name: "Svelte Reference",
                url: "https://svelte.dev/docs/element-directives#transition-events"
            }
        ]
    },
    {
        name: 'on:introend',
        description: 'Available when element has transition.',
        references: [
            {
                name: "Svelte Reference",
                url: "https://svelte.dev/docs/element-directives#transition-events"
            }
        ]
    },
    {
        name: 'on:outrostart',
        description: 'Available when element has transition.',
        references: [
            {
                name: "Svelte Reference",
                url: "https://svelte.dev/docs/element-directives#transition-events"
            }
        ]
    },
    {
        name: 'on:outroend',
        description: 'Available when element has transition.',
        references: [
            {
                name: "Svelte Reference",
                url: "https://svelte.dev/docs/element-directives#transition-events"
            }
        ]
    }
];
const svelteAttributes: IAttributeData[] = [
    {
        name: 'bind:innerHTML',
        description: 'Available when `contenteditable=true`'
    },
    {
        name: 'bind:textContent',
        description: 'Available when `contenteditable=true`'
    },
    {
        name: 'bind:innerText',
        description: 'Available when `contenteditable=true`'
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
            'To get a reference to a DOM node, use `bind:this`. If used on a component, gets a reference to that component instance.'
    }
];
const sveltekitAttributes: IAttributeData[] = [
    {
        name: 'data-sveltekit-keepfocus',
        description:
            'SvelteKit-specific attribute. Currently focused element will retain focus after navigation. Otherwise, focus will be reset to the body.',
        valueSet: 'v',
        references: [
            {
                name: "SvelteKit Reference",
                url: "https://kit.svelte.dev/docs/link-options#data-sveltekit-keepfocus"
            }
        ]
    },
    {
        name: 'data-sveltekit-noscroll',
        description:
            'SvelteKit-specific attribute. Will prevent scrolling after the link is clicked.',
        valueSet: 'v',
        references: [
            {
                name: "SvelteKit Reference",
                url: "https://kit.svelte.dev/docs/link-options#data-sveltekit-noscroll"
            }
        ]
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
        ],
        references: [
            {
                name: "SvelteKit Reference",
                url: "https://kit.svelte.dev/docs/link-options#data-sveltekit-preload-code"
            }
        ]
    },
    {
        name: 'data-sveltekit-preload-data',
        description:
            "SvelteKit-specific attribute. Will cause SvelteKit to run the page's load function as soon as the user hovers over the link (on a desktop) or touches it (on mobile), rather than waiting for the click event to trigger navigation.",
        valueSet: 'v',
        values: [{ name: 'hover' }, { name: 'tap' }, { name: 'off' }],
        references: [
            {
                name: "SvelteKit Reference",
                url: "https://kit.svelte.dev/docs/link-options#data-sveltekit-preload-data"
            }
        ]
    },
    {
        name: 'data-sveltekit-reload',
        description:
            'SvelteKit-specific attribute. Will cause SvelteKit to do a normal browser navigation which results in a full page reload.',
        valueSet: 'v',
        references: [
            {
                name: "SvelteKit Reference",
                url: "https://kit.svelte.dev/docs/link-options#data-sveltekit-reload"
            }
        ]
    },
    {
        name: 'data-sveltekit-replacestate',
        description:
            'SvelteKit-specific attribute. Will replace the current `history` entry rather than creating a new one with `pushState` when the link is clicked.',
        valueSet: 'v',
        references: [
            {
                name: "SvelteKit Reference",
                url: "https://kit.svelte.dev/docs/link-options#data-sveltekit-replacestate"
            }
        ]
    }
];

const svelteTags: ITagData[] = [
    {
        name: 'svelte:self',
        description:
            'Allows a component to include itself, recursively.\n\nIt cannot appear at the top level of your markup; it must be inside an if or each block to prevent an infinite loop.',
        attributes: [],
        references: [
            {
                name: 'Svelte Reference',
                url: 'https://svelte.dev/docs/special-elements#svelte-self'
            }
        ]
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
        ],
        references: [
            {
                name: 'Svelte Reference',
                url: 'https://svelte.dev/docs/special-elements#svelte-component'
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
        ],
        references: [
            {
                name: 'Svelte Reference',
                url: 'https://svelte.dev/docs/special-elements#svelte-element'
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
                description: 'An alias for `window.navigator.onLine`.',
                references: [
                    {
                        name: "MDN Reference",
                        url: "https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine"
                    }
                ]
            }
        ],
        references: [
            {
                name: 'Svelte Reference',
                url: 'https://svelte.dev/docs/special-elements#svelte-window'
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
            "As with `<svelte:window>`, this element allows you to add listeners to events on document, such as `visibilitychange`, which don't fire on window.",
        attributes: [
            {
                name: 'bind:fullscreenElement',
                description:
                    'Bind to the element that is being in full screen mode in this document. (read-only)'
            },
            {
                name: 'bind:visibilityState',
                description: 'Bind to visibility of the document. (read-only)'
            },
            {
                name: 'onfullscreenchange',
                description: 'Function to call when the document enters or exits full screen mode.',
                references: [
                    {
                        name: "MDN Reference",
                        url: "https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenchange_event"
                    }
                ]
            },
            {
                name: 'onfullscreenerror',
                description: 'Function to call when an error occurs while trying to enter full screen mode.',
                references: [
                    {
                        name: "MDN Reference",
                        url: "https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenerror_event"
                    }
                ]
            },
            {
                name: "onvisibilitychange",
                description: "Function to call when the visibility of the document changes.",
                references: [
                    {
                        name: "MDN Reference",
                        url: "https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event"
                    }
                ]
            },
            {
                name: 'onsecuritypolicyviolation',
                description: 'Function to call when a security policy is violated.',
                references: [
                    {
                        name: "MDN Reference",
                        url: "https://developer.mozilla.org/en-US/docs/Web/API/Document/securitypolicyviolation_event"
                    }
                ]
            },
            {
                name: 'onselectionchange',
                description: 'Function to call when the selection changes.',
                references: [
                    {
                        name: "MDN Reference",
                        url: "https://developer.mozilla.org/en-US/docs/Web/API/Document/selectionchange_event"
                    }
                ]
            }
        ],
        references: [
            {
                name: 'Svelte Reference',
                url: 'https://svelte.dev/docs/special-elements#svelte-document'
            }
        ]
    },
    {
        name: 'svelte:body',
        description:
            "As with `<svelte:window>`, this element allows you to add listeners to events on `document.body`, such as `mouseenter` and `mouseleave` which don't fire on window.",
        attributes: htmlData.tags!.find((tag) => tag.name === 'body')!.attributes
            .filter(isEvent),
        references: [
            {
                name: 'Svelte Reference',
                url: 'https://svelte.dev/docs/special-elements#svelte-body'
            }
        ]
    },
    {
        name: 'svelte:head',
        description:
            'This element makes it possible to insert elements into `document.head`. During server-side rendering, head content exposed separately to the main html content.',
        attributes: [],
        references: [
            {
                name: 'Svelte Reference',
                url: 'https://svelte.dev/docs/special-elements#svelte-head'
            }
        ]
    },
    {
        name: 'svelte:options',
        description: 'Provides a place to specify per-component compiler options.',
        attributes: [
            {
                name: 'immutable',
                description:
                    'If `true`, tells the compiler that you promise not to mutate any objects. This allows it to be less conservative about checking whether values have changed.',
                values: [
                    {
                        name: '{true}',
                        description:
                            'You never use mutable data, so the compiler can do simple referential equality checks to determine if values have changed.'
                    },
                    {
                        name: '{false}',
                        description:
                            'Svelte will be more conservative about whether or not mutable objects have changed. (default)'
                    }
                ]
            },
            {
                name: 'accessors',
                description:
                    "If `true`, getters and setters will be created for the component's props. If `false`, they will only be created for readonly exported values (i.e. those declared with `const`, `class` and `function`). If compiling with `customElement: true` this option defaults to `true`.",
                values: [
                    {
                        name: '{true}',
                        description: "Adds getters and setters for the component's props."
                    },
                    {
                        name: '{false}',
                        description: '(default)'
                    }
                ]
            },
            {
                name: 'namespace',
                description: 'The namespace where this component will be used, most commonly `"svg"`'
            },
            {
                name: 'tag',
                description: 'The name to use when compiling this component as a custom element'
            }
        ],
        references: [
            {
                name: "Svelte Reference",
                url: "https://svelte.dev/docs/special-elements#svelte-options"
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
        ],
        references: [
            {
                name: 'Svelte Reference',
                url: 'https://svelte.dev/docs/special-elements#svelte-fragment'
            }
        ]
    },
    {
        name: 'slot',
        description:
            'Components can have child content, in the same way that elements can.\n\nThe content is exposed in the child component using the `<slot>` element, which can contain fallback content that is rendered if no children are provided.',
        attributes: [
            {
                name: 'name',
                description:
                    'Named slots allow consumers to target specific areas. They can also have fallback content.'
            }
        ],
        references: [
            {
                name: 'Svelte Reference',
                url: 'https://svelte.dev/docs/special-elements#slot'
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

const svelteMediaReference = {
    name: "Svelte Reference",
    url: "https://svelte.dev/docs/element-directives#media-element-bindings"
};
const mediaAttributes: IAttributeData[] = [
    {
        name: 'bind:duration',
        description: 'The total duration of the video, in seconds. (readonly)',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/duration"
            }
        ]
    },
    {
        name: 'bind:buffered',
        description: 'An array of {start, end} objects. (readonly)',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/buffered"
            }
        ]
    },
    {
        name: 'bind:seekable',
        description: 'An array of `{start, end}` objects. (readonly)',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seekable"
            }
        ]
    },
    {
        name: 'bind:played',
        description: 'An array of `{start, end}` objects. (readonly)',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/played"
            }
        ]
    },
    {
        name: 'bind:seeking',
        description: 'boolean. (readonly)',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeking"
            }
        ]
    },
    {
        name: 'bind:ended',
        description: 'boolean. (readonly)',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ended"
            }
        ]
    },
    {
        name: 'bind:currentTime',
        description: 'The current point in the video, in seconds.',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime"
            }
        ]
    },
    {
        name: 'bind:playbackRate',
        description: "How fast or slow to play the video, where `1.0` is \"normal speed\"",
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate"
            }
        ]
    },
    {
        name: 'bind:paused',
        description: 'boolean.',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/paused"
            }
        ]
    },
    {
        name: 'bind:volume',
        description: 'A value between `0.0` and `1.0`.',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume"
            }
        ]
    },
    {
        name: 'bind:muted',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/muted"
            }
        ]
    },
    {
        name: 'bind:readyState',
        description: 'A number between `0` and `4` (included). (readonly)',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/readyState"
            }
        ]
    }
];
const videoAttributes: IAttributeData[] = [
    {
        name: 'bind:videoWidth',
        description: '(readonly)',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/videoWidth"
            }
        ]
    },
    {
        name: 'bind:videoHeight',
        description: '(readonly)',
        references: [
            svelteMediaReference,
            {
                name: "MDN Reference",
                url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/videoHeight"
            }
        ]
    }
];

const indeterminateAttribute: IAttributeData = {
    name: 'indeterminate',
    description: 'Available for `type="checkbox"`',
    references: [
        {
            name: "MDN Reference",
            url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox#indeterminate_state_checkboxes"
        }
    ]
};

const attributesOverrides: Record<string, IAttributeData[]> = {
    select: [{ name: 'bind:value' }],
    input: [
        { name: 'bind:value' },
        { name: 'bind:group', description: 'Available for `type="radio"` and `type="checkbox"`' },
        { name: 'bind:checked', description: 'Available for `type="checkbox"`' },
        { name: 'bind:files', description: 'Available for `type="file"` (readonly)' },
        indeterminateAttribute,
        { ...indeterminateAttribute, name: 'bind:indeterminate' }
    ],
    img: [
        {
            name: 'bind:naturalWidth',
            description: 'The intrinsic width of the image, in CSS pixels. (readonly)',
            references: [
                {
                    name: "Svelte Reference",
                    url: "https://svelte.dev/docs/element-directives#image-element-bindings"
                },
                {
                    name: "MDN Reference",
                    url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth"
                }
            ]
        },
        {
            name: 'bind:naturalHeight',
            description: 'The intrinsic height of the image, in CSS pixels. (readonly)',
            references: [
                {
                    name: "Svelte Reference",
                    url: "https://svelte.dev/docs/element-directives#image-element-bindings"
                },
                {
                    name: "MDN Reference",
                    url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalHeight"
                }
            ]
        }
    ],
    textarea: [{ name: 'bind:value' }],
    video: [...mediaAttributes, ...videoAttributes],
    audio: mediaAttributes,
    details: [
        {
            name: 'bind:open',
            references: [
                {
                    name: "MDN Reference",
                    url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details#open"
                }
            ]
        }
    ],
    style: [
        {
            name: 'lang',
            description: 'Use a preprocessor.',
            values: [
                {
                    name: 'css',
                    description: 'CSS'
                },
                {
                    name: 'sass',
                    description: 'Sass'
                },
                {
                    name: 'scss',
                    description: 'SCSS'
                },
                {
                    name: 'less',
                    description: 'Less'
                },
                {
                    name: 'stylus',
                    description: 'Stylus'
                },
                {
                    name: 'postcss',
                    description: 'PostCSS'
                }
            ],
            references: [
                {
                    name: "Svelte Reference",
                    url: "https://svelte.dev/docs/svelte-compiler#preprocess"
                }
            ]
        }
    ],
    script: [
        {
            name: 'generics',
            description:
                'Generics used within the components. Only available when using TypeScript.',
            references: [
                {
                    name: "Svelte RFC",
                    url: "https://github.com/dummdidumm/rfcs/blob/ts-typedefs-within-svelte-components/text/ts-typing-props-slots-events.md#generics"
                }
            ]
        },
        {
            name: 'context',
            description: "A `<script>` tag with a `context=\"module\"` attribute runs once when the module first evaluates, rather than for each component instance. Values declared in this block are accessible from a regular `<script>` (and the component markup) but not vice versa.\n\nYou can `export` bindings from this block, and they will become exports of the compiled module.\n\nYou cannot `export default`, since the default export is the component itself.\n\n**NOTE**\n\nVariables defined in `module` scripts are not reactive — reassigning them will not trigger a rerender even though the variable itself will update. For values shared between multiple components, consider using a store.",
            values: [
                { name: 'module' }
            ],
            references: [
                {
                    name: "Svelte Reference",
                    url: "https://svelte.dev/docs/svelte-components#script-context-module"
                }
            ]
        },
        {
            name: 'lang',
            description: 'Use a preprocessor.',
            values: [
                {
                    name: 'ts',
                    description: 'TypeScript'
                }
            ],
            references: [
                {
                    name: "Svelte Reference",
                    url: "https://svelte.dev/docs/typescript#script-lang-ts"
                }
            ]
        }
    ]
};

const html5Tags = htmlData.tags!;

export const svelteHtmlDataProvider = newHTMLDataProvider('svelte-builtin', {
    version: 1,
    globalAttributes: [
        ...htmlData.globalAttributes!.map(mapToSvelteEvent).flat(),
        ...svelteEvents,
        ...svelteAttributes,
        ...sveltekitAttributes
    ],
    tags: [...html5Tags, ...svelteTags].map((tag) => {
        return {
            ...tag,
            attributes: [...tag.attributes, ...attributesOverrides[tag.name] ?? []]
                .map(mapToSvelteEvent).flat()
        };
    }),

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

function mapToSvelteEvent(attr: IAttributeData): IAttributeData[] {
    if (attr.name.startsWith('on')) {
        const svelte5References = [
            {
                name: "Svelte 5 Reference",
                url: "https://svelte-5-preview.vercel.app/docs/event-handlers"
            },
            ...attr.references ?? []
        ];

        return [
            // on:event
            {
                ...attr,
                references: [
                    {
                        name: "Svelte Reference",
                        url: "https://svelte.dev/docs/element-directives#on-eventname"
                    },
                    ...attr.references ?? []
                ],
                name: attr.name.replace(/^on/, 'on:')
            },
            // Svelte 5 (onevent + oneventcapture)
            {
                ...attr,
                references: svelte5References,
            },
            {
                ...attr,
                references: svelte5References,
                name: attr.name + 'capture'
            }
        ];
    }
    return [attr];
}
