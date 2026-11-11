// Type-checked against the emitted declarations (`../dist`), without the content mapper
import { mount, type ComponentProps } from 'svelte';
import {
    Clash,
    GenericJs,
    GenericTs,
    LegacyJs,
    LegacyProps,
    LegacyTs,
    ModuleExports,
    RunesJs,
    RunesTs,
    createCounter,
    isSize,
    sizes,
    type ClashProps,
    type Size
} from '../dist/index.js';
import RunesTsDirect from '../dist/RunesTs.svelte';

const target = document.body;

// runes
const button = mount(RunesTs, {
    target,
    props: { variant: 'secondary', count: 1, disabled: true }
});
button.reset();
const buttonExports: RunesTs = button;
// @ts-expect-error unknown variant
mount(RunesTs, { target, props: { variant: 'tertiary' } });
const direct: typeof RunesTs = RunesTsDirect;

const runesJs = mount(RunesJs, { target, props: { name: 'n', size: 2 } });
runesJs.grow(1);
// @ts-expect-error name is required
mount(RunesJs, { target, props: {} });

// generics
const list = mount(GenericTs, {
    target,
    props: { items: [{ id: 'a' }], onselect: (item) => item.id.toUpperCase() }
});
const first: { id: string } | undefined = list.first();
// @ts-expect-error items must have an id
mount(GenericTs, { target, props: { items: [{ name: 'a' }] } });
mount(GenericJs, { target, props: { value: 1 } });

// legacy mode: class components and their instance type
const legacy = new LegacyTs({ target, props: { item: { name: 'a' } } });
legacy.$on('select', (event) => event.detail.name.toUpperCase());
const legacyInstance: LegacyTs = legacy;
const constant: 'c' = legacy.constant;
// @ts-expect-error item is required
new LegacyTs({ target, props: {} });

new LegacyProps({ target, props: { a: 'a', other: 1 } });
// @ts-expect-error a must be a string
new LegacyProps({ target, props: { a: 1 } });

const legacyJs = new LegacyJs({ target, props: { label: 'l' } });
legacyJs.$on('press', (event) => event.detail);
const legacyJsInstance: LegacyJs = legacyJs;
// @ts-expect-error label must be a string
new LegacyJs({ target, props: { label: 1 } });

// module script exports, a component named like one of them
const size: Size = sizes[0];
const isValid: boolean = isSize('small');
const moduleProps: ComponentProps<typeof ModuleExports> = { size };
mount(ModuleExports, { target, props: moduleProps });
const clashProps: ClashProps = { label: 'l' };
mount(Clash, { target, props: clashProps });

// .svelte.ts module
const counter = createCounter(1);
counter.increment();
const count: number = counter.count;

export { buttonExports, direct, first, legacyInstance, constant, legacyJsInstance, isValid, count };
