/// <reference lib="dom" />
/* eslint @typescript-eslint/no-unused-vars: off */
/**
 * Adapted from jsx-dom
 * @see https://github.com/proteriax/jsx-dom/blob/be06937ba16908d87bf8aa4372a3583133e02b8a/index.d.ts
 *
 * which was adapted from
 *
 * Adapted from React’s TypeScript definition from DefinitelyTyped.
 * @see https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/react/index.d.ts
 */
declare namespace svelte.JSX {

    /* svelte specific */
    interface ElementClass {
        $$prop_def: any;
    }

    interface ElementAttributesProperty {
        $$prop_def: any; // specify the property name to use
    }

    /* html jsx */


    export type Child = Node | Node[] | string | number;
    export type Children = Child | Child[];

    type NativeElement = HTMLElement;

    interface IntrinsicAttributes {
      slot?: string;
    }

    // TypeScript SVGElement has no `dataset` (Chrome 55+, Firefox 51+).
    type Element = NativeElement & {
      dataset: DOMStringMap;
    };

    //
    // Event Handler Types
    // ----------------------------------------------------------------------
    type EventHandler<E extends Event = Event, T extends EventTarget = HTMLElement> =
      (event: E & { currentTarget: EventTarget & T}) => any;

    type ClipboardEventHandler<T extends EventTarget> = EventHandler<ClipboardEvent, T>;
    type CompositionEventHandler<T extends EventTarget> = EventHandler<CompositionEvent, T>;
    type DragEventHandler<T extends EventTarget> = EventHandler<DragEvent, T>;
    type FocusEventHandler<T extends EventTarget> = EventHandler<FocusEvent, T>;
    type FormEventHandler<T extends EventTarget> = EventHandler<Event, T>;
    type ChangeEventHandler<T extends EventTarget> = EventHandler<Event, T>;
    type KeyboardEventHandler<T extends EventTarget> = EventHandler<KeyboardEvent, T>;
    type MouseEventHandler<T extends EventTarget> = EventHandler<MouseEvent, T>;
    type TouchEventHandler<T extends EventTarget> = EventHandler<TouchEvent, T>;
    type PointerEventHandler<T extends EventTarget> = EventHandler<PointerEvent, T>;
    type UIEventHandler<T extends EventTarget> = EventHandler<UIEvent, T>;
    type WheelEventHandler<T extends EventTarget> = EventHandler<WheelEvent, T>;
    type AnimationEventHandler<T extends EventTarget> = EventHandler<AnimationEvent, T>;
    type TransitionEventHandler<T extends EventTarget> = EventHandler<TransitionEvent, T>;
    type MessageEventHandler<T extends EventTarget> = EventHandler<MessageEvent, T>;

    type ClassNameBase = boolean | string | number | void | null;
    type ClassName = string | Array<ClassNameBase | ClassNameBase[]> | {
      [key: string]: boolean;
    }

    // See CSS 3 CSS-wide keywords https://www.w3.org/TR/css3-values/#common-keywords
    // See CSS 3 Explicit Defaulting https://www.w3.org/TR/css-cascade-3/#defaulting-keywords
    // "all CSS properties can accept these values"
    type CSSWideKeyword = 'initial' | 'inherit' | 'unset';

    // See CSS 3 <percentage> type https://drafts.csswg.org/css-values-3/#percentages
    type CSSPercentage = string;

    // See CSS 3 <length> type https://drafts.csswg.org/css-values-3/#lengths
    type CSSLength = number | string;

    // This interface is not complete. Only properties accepting
    // unit-less numbers are listed here (see CSSProperty.js in React)

    interface DOMAttributes<T extends EventTarget> {
      // jsx-dom specific
     /* children?: Children;
      innerText?: string;
      namespaceURI?: string;
      ref?: ((e: T) => void) | Ref<T>; */

      // Clipboard Events
      oncopy?: ClipboardEventHandler<T> | undefined;
      oncut?: ClipboardEventHandler<T> | undefined;
      onpaste?: ClipboardEventHandler<T> | undefined;

      // Composition Events
      oncompositionend?: CompositionEventHandler<T> | undefined;
      oncompositionstart?: CompositionEventHandler<T> | undefined;
      oncompositionupdate?: CompositionEventHandler<T> | undefined;

      // Focus Events
      onfocus?: FocusEventHandler<T> | undefined;
      onfocusin?: FocusEventHandler<T> | undefined;
      onfocusout?: FocusEventHandler<T> | undefined;
      onblur?: FocusEventHandler<T> | undefined;

      // Form Events
      onchange?: FormEventHandler<T> | undefined;
      oninput?: FormEventHandler<T> | undefined;
      onreset?: FormEventHandler<T> | undefined;
      onsubmit?: FormEventHandler<T> | undefined;
      oninvalid?: EventHandler<Event, T> | undefined;
      onbeforeinput?: EventHandler<Event, T> | undefined;

      // Image Events
      onload?: EventHandler | undefined;
      onerror?: EventHandler | undefined; // also a Media Event

      // Detail Events
      ontoggle?: EventHandler<Event, T> | undefined;

      // Keyboard Events
      onkeydown?: KeyboardEventHandler<T> | undefined;
      onkeypress?: KeyboardEventHandler<T> | undefined;
      onkeyup?: KeyboardEventHandler<T> | undefined;

      // Media Events
      onabort?: EventHandler<Event, T> | undefined;
      oncanplay?: EventHandler<Event, T> | undefined;
      oncanplaythrough?: EventHandler<Event, T> | undefined;
      oncuechange?: EventHandler<Event, T> | undefined;
      ondurationchange?: EventHandler<Event, T> | undefined;
      onemptied?: EventHandler<Event, T> | undefined;
      onencrypted?: EventHandler<Event, T> | undefined;
      onended?: EventHandler<Event, T> | undefined;
      onloadeddata?: EventHandler<Event, T> | undefined;
      onloadedmetadata?: EventHandler<Event, T> | undefined;
      onloadstart?: EventHandler<Event, T> | undefined;
      onpause?: EventHandler<Event, T> | undefined;
      onplay?: EventHandler<Event, T> | undefined;
      onplaying?: EventHandler<Event, T> | undefined;
      onprogress?: EventHandler<Event, T> | undefined;
      onratechange?: EventHandler<Event, T> | undefined;
      onseeked?: EventHandler<Event, T> | undefined;
      onseeking?: EventHandler<Event, T> | undefined;
      onstalled?: EventHandler<Event, T> | undefined;
      onsuspend?: EventHandler<Event, T> | undefined;
      ontimeupdate?: EventHandler<Event, T> | undefined;
      onvolumechange?: EventHandler<Event, T> | undefined;
      onwaiting?: EventHandler<Event, T> | undefined;

      // MouseEvents
      onauxclick?: MouseEventHandler<T> | undefined;
      onclick?: MouseEventHandler<T> | undefined;
      oncontextmenu?: MouseEventHandler<T> | undefined;
      ondblclick?: MouseEventHandler<T> | undefined;
      ondrag?: DragEventHandler<T> | undefined;
      ondragend?: DragEventHandler<T> | undefined;
      ondragenter?: DragEventHandler<T> | undefined;
      ondragexit?: DragEventHandler<T> | undefined;
      ondragleave?: DragEventHandler<T> | undefined;
      ondragover?: DragEventHandler<T> | undefined;
      ondragstart?: DragEventHandler<T> | undefined;
      ondrop?: DragEventHandler<T> | undefined;
      onmousedown?: MouseEventHandler<T> | undefined;
      onmouseenter?: MouseEventHandler<T> | undefined;
      onmouseleave?: MouseEventHandler<T> | undefined;
      onmousemove?: MouseEventHandler<T> | undefined;
      onmouseout?: MouseEventHandler<T> | undefined;
      onmouseover?: MouseEventHandler<T> | undefined;
      onmouseup?: MouseEventHandler<T> | undefined;

      // Selection Events
      onselect?: EventHandler<Event, T> | undefined;
      onselectionchange?: EventHandler<Event, T> | undefined;
      onselectstart?: EventHandler<Event, T> | undefined;

      // Touch Events
      ontouchcancel?: TouchEventHandler<T> | undefined;
      ontouchend?: TouchEventHandler<T> | undefined;
      ontouchmove?: TouchEventHandler<T> | undefined;
      ontouchstart?: TouchEventHandler<T> | undefined;

      // Pointer Events
      ongotpointercapture?: PointerEventHandler<T> | undefined;
      onpointercancel?: PointerEventHandler<T> | undefined;
      onpointerdown?: PointerEventHandler<T> | undefined;
      onpointerenter?: PointerEventHandler<T> | undefined;
      onpointerleave?: PointerEventHandler<T> | undefined;
      onpointermove?: PointerEventHandler<T> | undefined;
      onpointerout?: PointerEventHandler<T> | undefined;
      onpointerover?: PointerEventHandler<T> | undefined;
      onpointerup?: PointerEventHandler<T> | undefined;
      onlostpointercapture?: PointerEventHandler<T> | undefined;

      // UI Events
      onscroll?: UIEventHandler<T> | undefined;
      onresize?: UIEventHandler<T> | undefined;

      // Wheel Events
      onwheel?: WheelEventHandler<T> | undefined;

      // Animation Events
      onanimationstart?: AnimationEventHandler<T> | undefined;
      onanimationend?: AnimationEventHandler<T> | undefined;
      onanimationiteration?: AnimationEventHandler<T> | undefined;

      // Transition Events
      ontransitionstart?: TransitionEventHandler<T> | undefined;
      ontransitionrun?: TransitionEventHandler<T> | undefined;
      ontransitionend?: TransitionEventHandler<T> | undefined;
      ontransitioncancel?: TransitionEventHandler<T> | undefined;

      // Svelte Transition Events
      onoutrostart?: EventHandler<CustomEvent<null>, T> | undefined;
      onoutroend?: EventHandler<CustomEvent<null>, T> | undefined;
      onintrostart?: EventHandler<CustomEvent<null>, T> | undefined;
      onintroend?: EventHandler<CustomEvent<null>, T> | undefined;

      // Message Events
      onmessage?: MessageEventHandler<T> | undefined;
      onmessageerror?: MessageEventHandler<T> | undefined;

      // Global Events
      oncancel?: EventHandler<Event, T> | undefined;
      onclose?: EventHandler<Event, T> | undefined;
      onfullscreenchange?: EventHandler<Event, T> | undefined;
      onfullscreenerror?: EventHandler<Event, T> | undefined;
    }

    // All the WAI-ARIA 1.1 attributes from https://www.w3.org/TR/wai-aria-1.1/
    interface AriaAttributes {
        /** Identifies the currently active element when DOM focus is on a composite widget, textbox, group, or application. */
        'aria-activedescendant'?: string | undefined;
        /** Indicates whether assistive technologies will present all, or only parts of, the changed region based on the change notifications defined by the aria-relevant attribute. */
        'aria-atomic'?: boolean | 'false' | 'true' | undefined;
        /**
         * Indicates whether inputting text could trigger display of one or more predictions of the user's intended value for an input and specifies how predictions would be
         * presented if they are made.
         */
        'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both' | undefined;
        /** Indicates an element is being modified and that assistive technologies MAY want to wait until the modifications are complete before exposing them to the user. */
        'aria-busy'?: boolean | 'false' | 'true' | undefined;
        /**
         * Indicates the current "checked" state of checkboxes, radio buttons, and other widgets.
         * @see aria-pressed @see aria-selected.
         */
        'aria-checked'?: boolean | 'false' | 'mixed' | 'true' | undefined;
        /**
         * Defines the total number of columns in a table, grid, or treegrid.
         * @see aria-colindex.
         */
        'aria-colcount'?: number | undefined;
        /**
         * Defines an element's column index or position with respect to the total number of columns within a table, grid, or treegrid.
         * @see aria-colcount @see aria-colspan.
         */
        'aria-colindex'?: number | undefined;
        /**
         * Defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid.
         * @see aria-colindex @see aria-rowspan.
         */
        'aria-colspan'?: number | undefined;
        /**
         * Identifies the element (or elements) whose contents or presence are controlled by the current element.
         * @see aria-owns.
         */
        'aria-controls'?: string | undefined;
        /** Indicates the element that represents the current item within a container or set of related elements. */
        'aria-current'?: boolean | 'false' | 'true' | 'page' | 'step' | 'location' | 'date' | 'time' | undefined;
        /**
         * Identifies the element (or elements) that describes the object.
         * @see aria-labelledby
         */
        'aria-describedby'?: string | undefined;
        /**
         * Identifies the element that provides a detailed, extended description for the object.
         * @see aria-describedby.
         */
        'aria-details'?: string | undefined;
        /**
         * Indicates that the element is perceivable but disabled, so it is not editable or otherwise operable.
         * @see aria-hidden @see aria-readonly.
         */
        'aria-disabled'?: boolean | 'false' | 'true' | undefined;
        /**
         * Indicates what functions can be performed when a dragged object is released on the drop target.
         * @deprecated in ARIA 1.1
         */
        'aria-dropeffect'?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup' | undefined;
        /**
         * Identifies the element that provides an error message for the object.
         * @see aria-invalid @see aria-describedby.
         */
        'aria-errormessage'?: string | undefined;
        /** Indicates whether the element, or another grouping element it controls, is currently expanded or collapsed. */
        'aria-expanded'?: boolean | 'false' | 'true' | undefined;
        /**
         * Identifies the next element (or elements) in an alternate reading order of content which, at the user's discretion,
         * allows assistive technology to override the general default of reading in document source order.
         */
        'aria-flowto'?: string | undefined;
        /**
         * Indicates an element's "grabbed" state in a drag-and-drop operation.
         * @deprecated in ARIA 1.1
         */
        'aria-grabbed'?: boolean | 'false' | 'true' | undefined;
        /** Indicates the availability and type of interactive popup element, such as menu or dialog, that can be triggered by an element. */
        'aria-haspopup'?: boolean | 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog' | undefined;
        /**
         * Indicates whether the element is exposed to an accessibility API.
         * @see aria-disabled.
         */
        'aria-hidden'?: boolean | 'false' | 'true' | undefined;
        /**
         * Indicates the entered value does not conform to the format expected by the application.
         * @see aria-errormessage.
         */
        'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling' | undefined;
        /** Indicates keyboard shortcuts that an author has implemented to activate or give focus to an element. */
        'aria-keyshortcuts'?: string | undefined;
        /**
         * Defines a string value that labels the current element.
         * @see aria-labelledby.
         */
        'aria-label'?: string | undefined;
        /**
         * Identifies the element (or elements) that labels the current element.
         * @see aria-describedby.
         */
        'aria-labelledby'?: string | undefined;
        /** Defines the hierarchical level of an element within a structure. */
        'aria-level'?: number | undefined;
        /** Indicates that an element will be updated, and describes the types of updates the user agents, assistive technologies, and user can expect from the live region. */
        'aria-live'?: 'off' | 'assertive' | 'polite' | undefined;
        /** Indicates whether an element is modal when displayed. */
        'aria-modal'?: boolean | 'false' | 'true' | undefined;
        /** Indicates whether a text box accepts multiple lines of input or only a single line. */
        'aria-multiline'?: boolean | 'false' | 'true' | undefined;
        /** Indicates that the user may select more than one item from the current selectable descendants. */
        'aria-multiselectable'?: boolean | 'false' | 'true' | undefined;
        /** Indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous. */
        'aria-orientation'?: 'horizontal' | 'vertical' | undefined;
        /**
         * Identifies an element (or elements) in order to define a visual, functional, or contextual parent/child relationship
         * between DOM elements where the DOM hierarchy cannot be used to represent the relationship.
         * @see aria-controls.
         */
        'aria-owns'?: string | undefined;
        /**
         * Defines a short hint (a word or short phrase) intended to aid the user with data entry when the control has no value.
         * A hint could be a sample value or a brief description of the expected format.
         */
        'aria-placeholder'?: string | undefined;
        /**
         * Defines an element's number or position in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
         * @see aria-setsize.
         */
        'aria-posinset'?: number | undefined;
        /**
         * Indicates the current "pressed" state of toggle buttons.
         * @see aria-checked @see aria-selected.
         */
        'aria-pressed'?: boolean | 'false' | 'mixed' | 'true' | undefined;
        /**
         * Indicates that the element is not editable, but is otherwise operable.
         * @see aria-disabled.
         */
        'aria-readonly'?: boolean | 'false' | 'true' | undefined;
        /**
         * Indicates what notifications the user agent will trigger when the accessibility tree within a live region is modified.
         * @see aria-atomic.
         */
        'aria-relevant'?: 'additions' | 'additions removals' | 'additions text' | 'all' | 'removals' | 'removals additions' | 'removals text' | 'text' | 'text additions' | 'text removals' | undefined;
        /** Indicates that user input is required on the element before a form may be submitted. */
        'aria-required'?: boolean | 'false' | 'true' | undefined;
        /** Defines a human-readable, author-localized description for the role of an element. */
        'aria-roledescription'?: string | undefined;
        /**
         * Defines the total number of rows in a table, grid, or treegrid.
         * @see aria-rowindex.
         */
        'aria-rowcount'?: number | undefined;
        /**
         * Defines an element's row index or position with respect to the total number of rows within a table, grid, or treegrid.
         * @see aria-rowcount @see aria-rowspan.
         */
        'aria-rowindex'?: number | undefined;
        /**
         * Defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid.
         * @see aria-rowindex @see aria-colspan.
         */
        'aria-rowspan'?: number | undefined;
        /**
         * Indicates the current "selected" state of various widgets.
         * @see aria-checked @see aria-pressed.
         */
        'aria-selected'?: boolean | 'false' | 'true' | undefined;
        /**
         * Defines the number of items in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
         * @see aria-posinset.
         */
        'aria-setsize'?: number | undefined;
        /** Indicates if items in a table or grid are sorted in ascending or descending order. */
        'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other' | undefined;
        /** Defines the maximum allowed value for a range widget. */
        'aria-valuemax'?: number | undefined;
        /** Defines the minimum allowed value for a range widget. */
        'aria-valuemin'?: number | undefined;
        /**
         * Defines the current value for a range widget.
         * @see aria-valuetext.
         */
        'aria-valuenow'?: number | undefined;
        /** Defines the human readable text alternative of aria-valuenow for a range widget. */
        'aria-valuetext'?: string | undefined;
    }

    interface HTMLAttributes<T extends EventTarget> extends AriaAttributes, DOMAttributes<T> {
      // jsx-dom-specific Attributes
      class?: ClassName | undefined;
      dataset?: object | undefined; // eslint-disable-line

      // Standard HTML Attributes
      accept?: string | undefined;
      acceptcharset?: string | undefined;
      accesskey?: string | undefined;
      action?: string | undefined;
      allow?: string | undefined;
      allowfullscreen?: boolean | undefined;
      allowtransparency?: boolean | undefined;
      allowpaymentrequest?: boolean | undefined;
      alt?: string | undefined;
      as?: string | undefined;
      async?: boolean | undefined;
      autocomplete?: string | undefined;
      autofocus?: boolean | undefined;
      autoplay?: boolean | undefined;
      capture?: 'environment' | 'user' | boolean | undefined;
      cellpadding?: number | string | undefined;
      cellspacing?: number | string | undefined;
      charset?: string | undefined;
      challenge?: string | undefined;
      checked?: boolean | undefined;
      cite?: string | undefined;
      classid?: string | undefined;
      classname?: ClassName | undefined;
      cols?: number | undefined;
      colspan?: number | undefined;
      content?: string | undefined;
      contenteditable?: 'true' | 'false' | boolean | undefined;

      // Doesn't work when used as HTML attribute
      /**
       * Elements with the contenteditable attribute support innerHTML and textContent bindings.
       */
      innerHTML?: string | undefined;
      // Doesn't work when used as HTML attribute
      /**
       * Elements with the contenteditable attribute support innerHTML and textContent bindings.
       */

      textContent?: string | undefined;

      contextmenu?: string | undefined;
      controls?: boolean | undefined;
      coords?: string | undefined;
      crossorigin?: string | undefined;
      currenttime?: number | undefined;
      decoding?: 'async' | 'sync' | 'auto' | undefined;
      data?: string | undefined;
      datetime?: string | undefined;
      default?: boolean | undefined;
      defaultmuted?: boolean | undefined;
      defaultplaybackrate?: number | undefined;
      defer?: boolean | undefined;
      dir?: string | undefined;
      dirname?: string | undefined;
      disabled?: boolean | undefined;
      download?: any | undefined;
      draggable?: boolean | 'true' | 'false' | undefined;
      enctype?: string | undefined;
      for?: string | undefined;
      form?: string | undefined;
      formaction?: string | undefined;
      formenctype?: string | undefined;
      formmethod?: string | undefined;
      formnovalidate?: boolean | undefined;
      formtarget?: string | undefined;
      frameborder?: number | string | undefined;
      headers?: string | undefined;
      height?: number | string | undefined;
      hidden?: boolean | undefined;
      high?: number | undefined;
      href?: string | undefined;
      hreflang?: string | undefined;
      htmlfor?: string | undefined;
      httpequiv?: string | undefined;
      id?: string | undefined;
      inputmode?: string | undefined;
      integrity?: string | undefined;
      is?: string | undefined;
      ismap?: boolean | undefined;
      keyparams?: string | undefined;
      keytype?: string | undefined;
      kind?: string | undefined;
      label?: string | undefined;
      lang?: string | undefined;
      list?: string | undefined;
      loading?: string | undefined;
      loop?: boolean | undefined;
      low?: number | undefined;
      manifest?: string | undefined;
      marginheight?: number | undefined;
      marginwidth?: number | undefined;
      max?: number | string | undefined;
      maxlength?: number | undefined;
      media?: string | undefined;
      mediagroup?: string | undefined;
      method?: string | undefined;
      min?: number | string | undefined;
      minlength?: number | undefined;
      multiple?: boolean | undefined;
      muted?: boolean | undefined;
      name?: string | undefined;
      nonce?: string | undefined;
      novalidate?: boolean | undefined;
      open?: boolean | undefined;
      optimum?: number | undefined;
      part?: string | undefined;
      pattern?: string | undefined;
      placeholder?: string | undefined;
      playsinline?: boolean | undefined;
      poster?: string | undefined;
      preload?: string | undefined;
      radiogroup?: string | undefined;
      readonly?: boolean | undefined;
      referrerpolicy?: string | undefined;
      rel?: string | undefined;
      required?: boolean | undefined;
      reversed?: boolean | undefined;
      role?: string | undefined;
      rows?: number | undefined;
      rowspan?: number | undefined;
      sandbox?: string | undefined;
      scope?: string | undefined;
      scoped?: boolean | undefined;
      scrolling?: string | undefined;
      seamless?: boolean | undefined;
      selected?: boolean | undefined;
      shape?: string | undefined;
      size?: number | undefined;
      sizes?: string | undefined;
      slot?: string | undefined;
      span?: number | undefined;
      spellcheck?: boolean | 'true' | 'false' | undefined;
      src?: string | undefined;
      srcdoc?: string | undefined;
      srclang?: string | undefined;
      srcset?: string | undefined;
      start?: number | undefined;
      step?: number | string | undefined;
      style?: string | undefined;
      summary?: string | undefined;
      tabindex?: number | undefined;
      target?: string | undefined;
      title?: string | undefined;
      type?: string | undefined;
      usemap?: string | undefined;
      value?: string | string[] | number | null | undefined;
      /**
       * a value between 0 and 1
      */
      volume?: number | undefined;
      width?: number | string | undefined;
      wmode?: string | undefined;
      wrap?: string | undefined;

      // RDFa Attributes
      about?: string | undefined;
      datatype?: string | undefined;
      inlist?: any | undefined;
      prefix?: string | undefined;
      property?: string | undefined;
      resource?: string | undefined;
      typeof?: string | undefined;
      vocab?: string | undefined;

      // Non-standard Attributes
      autocapitalize?: string | undefined;
      autocorrect?: string | undefined;
      autosave?: string | undefined;
      color?: string | undefined;
      itemprop?: string | undefined;
      itemscope?: boolean | undefined;
      itemtype?: string | undefined;
      itemid?: string | undefined;
      itemref?: string | undefined;
      results?: number | undefined;
      security?: string | undefined;
      unselectable?: boolean | undefined;
    }

    // this list is "complete" in that it contains every SVG attribute
    // that React supports, but the types can be improved.
    // Full list here: https://facebook.github.io/react/docs/dom-elements.html
    //
    // The three broad type categories are (in order of restrictiveness):
    //   - "number | string"
    //   - "string"
    //   - union of string literals
    interface SVGAttributes<T extends EventTarget> extends AriaAttributes, DOMAttributes<T> {
      // Attributes which also defined in HTMLAttributes
      className?: string | undefined;
      class?: string | undefined;
      color?: string | undefined;
      height?: number | string | undefined;
      id?: string | undefined;
      lang?: string | undefined;
      max?: number | string | undefined;
      media?: string | undefined;
      method?: string | undefined;
      min?: number | string | undefined;
      name?: string | undefined;
      style?: string | undefined;
      target?: string | undefined;
      type?: string | undefined;
      width?: number | string | undefined;

      // Other HTML properties supported by SVG elements in browsers
      role?: string | undefined;
      tabindex?: number | undefined;
      crossorigin?: 'anonymous' | 'use-credentials' | '' | undefined;

      // SVG Specific attributes
      'accent-height'?: number | string | undefined;
      accumulate?: 'none' | 'sum' | undefined;
      additive?: 'replace' | 'sum' | undefined;
      'alignment-baseline'?: 'auto' | 'baseline' | 'before-edge' | 'text-before-edge' | 'middle' |
        'central' | 'after-edge' | 'text-after-edge' | 'ideographic' | 'alphabetic' | 'hanging' |
        'mathematical' | 'inherit' | undefined;
      allowReorder?: 'no' | 'yes' | undefined;
      alphabetic?: number | string | undefined;
      amplitude?: number | string | undefined;
      'arabic-form'?: 'initial' | 'medial' | 'terminal' | 'isolated' | undefined;
      ascent?: number | string | undefined;
      attributeName?: string | undefined;
      attributeType?: string | undefined;
      autoReverse?: number | string | undefined;
      azimuth?: number | string | undefined;
      baseFrequency?: number | string | undefined;
      'baseline-shift'?: number | string | undefined;
      baseProfile?: number | string | undefined;
      bbox?: number | string | undefined;
      begin?: number | string | undefined;
      bias?: number | string | undefined;
      by?: number | string | undefined;
      calcMode?: number | string | undefined;
      'cap-height'?: number | string | undefined;
      clip?: number | string | undefined;
      'clip-path'?: string | undefined;
      clipPathUnits?: number | string | undefined;
      'clip-rule'?: number | string | undefined;
      'color-interpolation'?: number | string | undefined;
      'color-interpolation-filters'?: 'auto' | 'sRGB' | 'linearRGB' | 'inherit' | undefined;
      'color-profile'?: number | string | undefined;
      'color-rendering'?: number | string | undefined;
      contentScriptType?: number | string | undefined;
      contentStyleType?: number | string | undefined;
      cursor?: number | string | undefined;
      cx?: number | string | undefined;
      cy?: number | string | undefined;
      d?: string | undefined;
      decelerate?: number | string | undefined;
      descent?: number | string | undefined;
      diffuseConstant?: number | string | undefined;
      direction?: number | string | undefined;
      display?: number | string | undefined;
      divisor?: number | string | undefined;
      'dominant-baseline'?: number | string | undefined;
      dur?: number | string | undefined;
      dx?: number | string | undefined;
      dy?: number | string | undefined;
      edgeMode?: number | string | undefined;
      elevation?: number | string | undefined;
      'enable-background'?: number | string | undefined;
      end?: number | string | undefined;
      exponent?: number | string | undefined;
      externalResourcesRequired?: number | string | undefined;
      fill?: string | undefined;
      'fill-opacity'?: number | string | undefined;
      'fill-rule'?: 'nonzero' | 'evenodd' | 'inherit' | undefined;
      filter?: string | undefined;
      filterRes?: number | string | undefined;
      filterUnits?: number | string | undefined;
      'flood-color'?: number | string | undefined;
      'flood-opacity'?: number | string | undefined;
      focusable?: number | string | undefined;
      'font-family'?: string | undefined;
      'font-size'?: number | string | undefined;
      'font-size-adjust'?: number | string | undefined;
      'font-stretch'?: number | string | undefined;
      'font-style'?: number | string | undefined;
      'font-variant'?: number | string | undefined;
      'font-weight'?: number | string | undefined;
      format?: number | string | undefined;
      from?: number | string | undefined;
      fx?: number | string | undefined;
      fy?: number | string | undefined;
      g1?: number | string | undefined;
      g2?: number | string | undefined;
      'glyph-name'?: number | string | undefined;
      'glyph-orientation-horizontal'?: number | string | undefined;
      'glyph-orientation-vertical'?: number | string | undefined;
      glyphRef?: number | string | undefined;
      gradientTransform?: string | undefined;
      gradientUnits?: string | undefined;
      hanging?: number | string | undefined;
      href?: string | undefined;
      'horiz-adv-x'?: number | string | undefined;
      'horiz-origin-x'?: number | string | undefined;
      ideographic?: number | string | undefined;
      'image-rendering'?: number | string | undefined;
      in2?: number | string | undefined;
      in?: string | undefined;
      intercept?: number | string | undefined;
      k1?: number | string | undefined;
      k2?: number | string | undefined;
      k3?: number | string | undefined;
      k4?: number | string | undefined;
      k?: number | string | undefined;
      kernelMatrix?: number | string | undefined;
      kernelUnitLength?: number | string | undefined;
      kerning?: number | string | undefined;
      keyPoints?: number | string | undefined;
      keySplines?: number | string | undefined;
      keyTimes?: number | string | undefined;
      lengthAdjust?: number | string | undefined;
      'letter-spacing'?: number | string | undefined;
      'lighting-color'?: number | string | undefined;
      limitingConeAngle?: number | string | undefined;
      local?: number | string | undefined;
      'marker-end'?: string | undefined;
      markerHeight?: number | string | undefined;
      'marker-mid'?: string | undefined;
      'marker-start'?: string | undefined;
      markerUnits?: number | string | undefined;
      markerWidth?: number | string | undefined;
      mask?: string | undefined;
      maskContentUnits?: number | string | undefined;
      maskUnits?: number | string | undefined;
      mathematical?: number | string | undefined;
      mode?: number | string | undefined;
      numOctaves?: number | string | undefined;
      offset?: number | string | undefined;
      opacity?: number | string | undefined;
      operator?: number | string | undefined;
      order?: number | string | undefined;
      orient?: number | string | undefined;
      orientation?: number | string | undefined;
      origin?: number | string | undefined;
      overflow?: number | string | undefined;
      'overline-position'?: number | string | undefined;
      'overline-thickness'?: number | string | undefined;
      'paint-order'?: number | string | undefined;
      'panose-1'?: number | string | undefined;
      path?: string | undefined;
      pathLength?: number | string | undefined;
      patternContentUnits?: string | undefined;
      patternTransform?: number | string | undefined;
      patternUnits?: string | undefined;
      'pointer-events'?: number | string | undefined;
      points?: string | undefined;
      pointsAtX?: number | string | undefined;
      pointsAtY?: number | string | undefined;
      pointsAtZ?: number | string | undefined;
      preserveAlpha?: number | string | undefined;
      preserveAspectRatio?: string | undefined;
      primitiveUnits?: number | string | undefined;
      r?: number | string | undefined;
      radius?: number | string | undefined;
      refX?: number | string | undefined;
      refY?: number | string | undefined;
      'rendering-intent'?: number | string | undefined;
      repeatCount?: number | string | undefined;
      repeatDur?: number | string | undefined;
      requiredExtensions?: number | string | undefined;
      requiredFeatures?: number | string | undefined;
      restart?: number | string | undefined;
      result?: string | undefined;
      rotate?: number | string | undefined;
      rx?: number | string | undefined;
      ry?: number | string | undefined;
      scale?: number | string | undefined;
      seed?: number | string | undefined;
      'shape-rendering'?: number | string | undefined;
      slope?: number | string | undefined;
      spacing?: number | string | undefined;
      specularConstant?: number | string | undefined;
      specularExponent?: number | string | undefined;
      speed?: number | string | undefined;
      spreadMethod?: string | undefined;
      startOffset?: number | string | undefined;
      stdDeviation?: number | string | undefined;
      stemh?: number | string | undefined;
      stemv?: number | string | undefined;
      stitchTiles?: number | string | undefined;
      'stop-color'?: string | undefined;
      'stop-opacity'?: number | string | undefined;
      'strikethrough-position'?: number | string | undefined;
      'strikethrough-thickness'?: number | string | undefined;
      string?: number | string | undefined;
      stroke?: string | undefined;
      'stroke-dasharray'?: string | number | undefined;
      'stroke-dashoffset'?: string | number | undefined;
      'stroke-linecap'?: 'butt' | 'round' | 'square' | 'inherit' | undefined;
      'stroke-linejoin'?: 'miter' | 'round' | 'bevel' | 'inherit' | undefined;
      'stroke-miterlimit'?: string | undefined;
      'stroke-opacity'?: number | string | undefined;
      'stroke-width'?: number | string | undefined;
      surfaceScale?: number | string | undefined;
      systemLanguage?: number | string | undefined;
      tableValues?: number | string | undefined;
      targetX?: number | string | undefined;
      targetY?: number | string | undefined;
      'text-anchor'?: string | undefined;
      'text-decoration'?: number | string | undefined;
      textLength?: number | string | undefined;
      'text-rendering'?: number | string | undefined;
      to?: number | string | undefined;
      transform?: string | undefined;
      u1?: number | string | undefined;
      u2?: number | string | undefined;
      'underline-position'?: number | string | undefined;
      'underline-thickness'?: number | string | undefined;
      unicode?: number | string | undefined;
      'unicode-bidi'?: number | string | undefined;
      'unicode-range'?: number | string | undefined;
      'units-per-em'?: number | string | undefined;
      'v-alphabetic'?: number | string | undefined;
      values?: string | undefined;
      'vector-effect'?: number | string | undefined;
      version?: string | undefined;
      'vert-adv-y'?: number | string | undefined;
      'vert-origin-x'?: number | string | undefined;
      'vert-origin-y'?: number | string | undefined;
      'v-hanging'?: number | string | undefined;
      'v-ideographic'?: number | string | undefined;
      viewBox?: string | undefined;
      viewTarget?: number | string | undefined;
      visibility?: number | string | undefined;
      'v-mathematical'?: number | string | undefined;
      widths?: number | string | undefined;
      'word-spacing'?: number | string | undefined;
      'writing-mode'?: number | string | undefined;
      x1?: number | string | undefined;
      x2?: number | string | undefined;
      x?: number | string | undefined;
      xChannelSelector?: string | undefined;
      'x-height'?: number | string | undefined;
      xlinkActuate?: string | undefined;
      xlinkArcrole?: string | undefined;
      xlinkHref?: string | undefined;
      xlinkRole?: string | undefined;
      xlinkShow?: string | undefined;
      xlinkTitle?: string | undefined;
      xlinkType?: string | undefined;
      xmlBase?: string | undefined;
      xmlLang?: string | undefined;
      xmlns?: string | undefined;
      xmlnsXlink?: string | undefined;
      xmlSpace?: string | undefined;
      y1?: number | string | undefined;
      y2?: number | string | undefined;
      y?: number | string | undefined;
      yChannelSelector?: string | undefined;
      z?: number | string | undefined;
      zoomAndPan?: string | undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface HTMLProps<T extends EventTarget> extends HTMLAttributes<T> {}
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface SVGProps<T extends EventTarget> extends SVGAttributes<T> {}

    interface SvelteOptionProps extends HTMLProps<HTMLOptionElement> {
        value?: any | undefined;
    }

    interface SvelteSelectProps extends HTMLProps<HTMLSelectElement> {
      value?: any | undefined;
    }

    interface SvelteInputProps extends HTMLProps<HTMLInputElement> {
      group?: any | undefined;
      files?: FileList | null | undefined;
      indeterminate?: boolean | undefined;
    }

    interface SvelteWindowProps  {
      readonly innerWidth?: Window['innerWidth'] | undefined;
      readonly innerHeight?: Window['innerHeight'] | undefined;
      readonly outerWidth?: Window['outerWidth'] | undefined;
      readonly outerHeight?: Window['outerHeight'] | undefined;
      scrollX?: Window['scrollX'] | undefined;
      scrollY?: Window['scrollY'] | undefined;
      readonly online?: Window['navigator']['onLine'] | undefined;

      // Transformed from on:sveltekit:xy
      'onsveltekit:start'?: EventHandler<CustomEvent, Window> | undefined;
      'onsveltekit:navigation-start'?: EventHandler<CustomEvent, Window> | undefined;
      'onsveltekit:navigation-end'?: EventHandler<CustomEvent, Window> | undefined;

      ondevicelight?: EventHandler<Event, Window> | undefined;
      onbeforeinstallprompt?: EventHandler<Event, Window> | undefined;
      ondeviceproximity?: EventHandler<Event, Window> | undefined;
      onpaint?: EventHandler<Event, Window> | undefined;
      onuserproximity?: EventHandler<Event, Window> | undefined;
      onbeforeprint?: EventHandler<Event, Window> | undefined;
      onafterprint?: EventHandler<Event, Window> | undefined;
      onlanguagechange?: EventHandler<Event, Window> | undefined;
      onorientationchange?: EventHandler<Event, Window> | undefined;
      onmessage?: EventHandler<MessageEvent, Window> | undefined;
      onmessageerror?: EventHandler<MessageEvent, Window> | undefined;
      onoffline?: EventHandler<Event, Window> | undefined;
      ononline?: EventHandler<Event, Window> | undefined;
      onbeforeunload?: EventHandler<BeforeUnloadEvent, Window> | undefined;
      onunload?: EventHandler<Event, Window> | undefined;
      onstorage?: EventHandler<StorageEvent, Window> | undefined;
      onhashchange?: EventHandler<HashChangeEvent, Window> | undefined;
      onpagehide?: EventHandler<PageTransitionEvent, Window> | undefined;
      onpageshow?: EventHandler<PageTransitionEvent, Window> | undefined;
      onpopstate?: EventHandler<PopStateEvent, Window> | undefined;
      ondevicemotion?: EventHandler<DeviceMotionEvent> | undefined;
      ondeviceorientation?: EventHandler<DeviceOrientationEvent, Window> | undefined;
      ondeviceorientationabsolute?: EventHandler<DeviceOrientationEvent, Window> | undefined;
      onunhandledrejection?: EventHandler<PromiseRejectionEvent, Window> | undefined;
      onrejectionhandled?: EventHandler<PromiseRejectionEvent, Window> | undefined;
    }

    interface SapperAnchorProps {
        // transformed from sapper:noscroll so it should be camel case
        sapperNoscroll?: true | undefined;
        sapperPrefetch?: true | undefined;
    }

    interface SvelteKitAnchorProps {
        // transformed from sveltekit:noscroll so it should be camel case
        sveltekitNoscroll?: true | undefined;
        sveltekitPrefetch?: true | undefined;
    }

    interface SvelteMediaTimeRange {
        start: number;
        end: number;
    }

    interface SvelteMediaProps {
        readonly duration?: number | undefined;
        readonly buffered?: SvelteMediaTimeRange[] | undefined;
        readonly played?: SvelteMediaTimeRange[] | undefined;
        readonly seekable?: SvelteMediaTimeRange[] | undefined;
        readonly seeking?: boolean | undefined;
        readonly ended?: boolean | undefined;

        /**
         * the current playback time in the video, in seconds
         */
        currentTime?: number | undefined;
        /**
         * the current playback time in the video, in seconds
         */
        currenttime?: number | undefined;
        // Doesn't work when used as HTML Attribute
        /**
         * how fast or slow to play the video, where 1 is 'normal'
         */
        playbackRate?: number | undefined;

        paused?: boolean | undefined;
    }

    interface SvelteVideoProps extends SvelteMediaProps {
        // Binding only, don't need lowercase variant
        readonly videoWidth?: number | undefined;
        readonly videoHeight?: number | undefined;
    }

    interface IntrinsicElements {
      // HTML
      a: HTMLProps<HTMLAnchorElement> & SapperAnchorProps & SvelteKitAnchorProps;
      abbr: HTMLProps<HTMLElement>;
      address: HTMLProps<HTMLElement>;
      area: HTMLProps<HTMLAreaElement>;
      article: HTMLProps<HTMLElement>;
      aside: HTMLProps<HTMLElement>;
      audio: HTMLProps<HTMLAudioElement> & SvelteMediaProps;
      b: HTMLProps<HTMLElement>;
      base: HTMLProps<HTMLBaseElement>;
      bdi: HTMLProps<HTMLElement>;
      bdo: HTMLProps<HTMLElement>;
      big: HTMLProps<HTMLElement>;
      blockquote: HTMLProps<HTMLElement>;
      body: HTMLProps<HTMLBodyElement>;
      br: HTMLProps<HTMLBRElement>;
      button: HTMLProps<HTMLButtonElement>;
      canvas: HTMLProps<HTMLCanvasElement>;
      caption: HTMLProps<HTMLElement>;
      cite: HTMLProps<HTMLElement>;
      code: HTMLProps<HTMLElement>;
      col: HTMLProps<HTMLTableColElement>;
      colgroup: HTMLProps<HTMLTableColElement>;
      data: HTMLProps<HTMLElement>;
      datalist: HTMLProps<HTMLDataListElement>;
      dd: HTMLProps<HTMLElement>;
      del: HTMLProps<HTMLElement>;
      details: HTMLProps<HTMLElement>;
      dfn: HTMLProps<HTMLElement>;
      dialog: HTMLProps<HTMLElement>;
      div: HTMLProps<HTMLDivElement>;
      dl: HTMLProps<HTMLDListElement>;
      dt: HTMLProps<HTMLElement>;
      em: HTMLProps<HTMLElement>;
      embed: HTMLProps<HTMLEmbedElement>;
      fieldset: HTMLProps<HTMLFieldSetElement>;
      figcaption: HTMLProps<HTMLElement>;
      figure: HTMLProps<HTMLElement>;
      footer: HTMLProps<HTMLElement>;
      form: HTMLProps<HTMLFormElement>;
      h1: HTMLProps<HTMLHeadingElement>;
      h2: HTMLProps<HTMLHeadingElement>;
      h3: HTMLProps<HTMLHeadingElement>;
      h4: HTMLProps<HTMLHeadingElement>;
      h5: HTMLProps<HTMLHeadingElement>;
      h6: HTMLProps<HTMLHeadingElement>;
      head: HTMLProps<HTMLHeadElement>;
      header: HTMLProps<HTMLElement>;
      hgroup: HTMLProps<HTMLElement>;
      hr: HTMLProps<HTMLHRElement>;
      html: HTMLProps<HTMLHtmlElement>;
      i: HTMLProps<HTMLElement>;
      iframe: HTMLProps<HTMLIFrameElement>;
      img: HTMLProps<HTMLImageElement>;
      input: SvelteInputProps;
      ins: HTMLProps<HTMLModElement>;
      kbd: HTMLProps<HTMLElement>;
      keygen: HTMLProps<HTMLElement>;
      label: HTMLProps<HTMLLabelElement>;
      legend: HTMLProps<HTMLLegendElement>;
      li: HTMLProps<HTMLLIElement>;
      link: HTMLProps<HTMLLinkElement>;
      main: HTMLProps<HTMLElement>;
      map: HTMLProps<HTMLMapElement>;
      mark: HTMLProps<HTMLElement>;
      menu: HTMLProps<HTMLElement>;
      menuitem: HTMLProps<HTMLElement>;
      meta: HTMLProps<HTMLMetaElement>;
      meter: HTMLProps<HTMLElement>;
      nav: HTMLProps<HTMLElement>;
      noindex: HTMLProps<HTMLElement>;
      noscript: HTMLProps<HTMLElement>;
      object: HTMLProps<HTMLObjectElement>;
      ol: HTMLProps<HTMLOListElement>;
      optgroup: HTMLProps<HTMLOptGroupElement>;
      option: SvelteOptionProps;
      output: HTMLProps<HTMLElement>;
      p: HTMLProps<HTMLParagraphElement>;
      param: HTMLProps<HTMLParamElement>;
      picture: HTMLProps<HTMLElement>;
      pre: HTMLProps<HTMLPreElement>;
      progress: HTMLProps<HTMLProgressElement>;
      q: HTMLProps<HTMLQuoteElement>;
      rp: HTMLProps<HTMLElement>;
      rt: HTMLProps<HTMLElement>;
      ruby: HTMLProps<HTMLElement>;
      s: HTMLProps<HTMLElement>;
      samp: HTMLProps<HTMLElement>;
      script: HTMLProps<HTMLElement>;
      section: HTMLProps<HTMLElement>;
      select: SvelteSelectProps;
      small: HTMLProps<HTMLElement>;
      source: HTMLProps<HTMLSourceElement>;
      span: HTMLProps<HTMLSpanElement>;
      strong: HTMLProps<HTMLElement>;
      style: HTMLProps<HTMLStyleElement>;
      sub: HTMLProps<HTMLElement>;
      summary: HTMLProps<HTMLElement>;
      sup: HTMLProps<HTMLElement>;
      table: HTMLProps<HTMLTableElement>;
      tbody: HTMLProps<HTMLTableSectionElement>;
      td: HTMLProps<HTMLTableDataCellElement>;
      textarea: HTMLProps<HTMLTextAreaElement>;
      tfoot: HTMLProps<HTMLTableSectionElement>;
      th: HTMLProps<HTMLTableHeaderCellElement>;
      thead: HTMLProps<HTMLTableSectionElement>;
      time: HTMLProps<HTMLElement>;
      title: HTMLProps<HTMLTitleElement>;
      tr: HTMLProps<HTMLTableRowElement>;
      track: HTMLProps<HTMLTrackElement>;
      u: HTMLProps<HTMLElement>;
      ul: HTMLProps<HTMLUListElement>;
      var: HTMLProps<HTMLElement>;
      video: HTMLProps<HTMLVideoElement> & SvelteVideoProps;
      wbr: HTMLProps<HTMLElement>;

      svg: SVGProps<SVGSVGElement>;

      animate: SVGProps<SVGElement>; // @TODO: It is SVGAnimateElement but not in dom.d.ts for now.
      circle: SVGProps<SVGCircleElement>;
      clipPath: SVGProps<SVGClipPathElement>;
      defs: SVGProps<SVGDefsElement>;
      desc: SVGProps<SVGDescElement>;
      ellipse: SVGProps<SVGEllipseElement>;
      feBlend: SVGProps<SVGFEBlendElement>;
      feColorMatrix: SVGProps<SVGFEColorMatrixElement>;
      feComponentTransfer: SVGProps<SVGFEComponentTransferElement>;
      feComposite: SVGProps<SVGFECompositeElement>;
      feConvolveMatrix: SVGProps<SVGFEConvolveMatrixElement>;
      feDiffuseLighting: SVGProps<SVGFEDiffuseLightingElement>;
      feDisplacementMap: SVGProps<SVGFEDisplacementMapElement>;
      feDistantLight: SVGProps<SVGFEDistantLightElement>;
      feFlood: SVGProps<SVGFEFloodElement>;
      feFuncA: SVGProps<SVGFEFuncAElement>;
      feFuncB: SVGProps<SVGFEFuncBElement>;
      feFuncG: SVGProps<SVGFEFuncGElement>;
      feFuncR: SVGProps<SVGFEFuncRElement>;
      feGaussianBlur: SVGProps<SVGFEGaussianBlurElement>;
      feImage: SVGProps<SVGFEImageElement>;
      feMerge: SVGProps<SVGFEMergeElement>;
      feMergeNode: SVGProps<SVGFEMergeNodeElement>;
      feMorphology: SVGProps<SVGFEMorphologyElement>;
      feOffset: SVGProps<SVGFEOffsetElement>;
      fePointLight: SVGProps<SVGFEPointLightElement>;
      feSpecularLighting: SVGProps<SVGFESpecularLightingElement>;
      feSpotLight: SVGProps<SVGFESpotLightElement>;
      feTile: SVGProps<SVGFETileElement>;
      feTurbulence: SVGProps<SVGFETurbulenceElement>;
      filter: SVGProps<SVGFilterElement>;
      foreignObject: SVGProps<SVGForeignObjectElement>;
      g: SVGProps<SVGGElement>;
      image: SVGProps<SVGImageElement>;
      line: SVGProps<SVGLineElement>;
      linearGradient: SVGProps<SVGLinearGradientElement>;
      marker: SVGProps<SVGMarkerElement>;
      mask: SVGProps<SVGMaskElement>;
      metadata: SVGProps<SVGMetadataElement>;
      path: SVGProps<SVGPathElement>;
      pattern: SVGProps<SVGPatternElement>;
      polygon: SVGProps<SVGPolygonElement>;
      polyline: SVGProps<SVGPolylineElement>;
      radialGradient: SVGProps<SVGRadialGradientElement>;
      rect: SVGProps<SVGRectElement>;
      stop: SVGProps<SVGStopElement>;
      switch: SVGProps<SVGSwitchElement>;
      symbol: SVGProps<SVGSymbolElement>;
      text: SVGProps<SVGTextElement>;
      textPath: SVGProps<SVGTextPathElement>;
      tspan: SVGProps<SVGTSpanElement>;
      use: SVGProps<SVGUseElement>;
      view: SVGProps<SVGViewElement>;

      // Svelte specific
      sveltewindow: HTMLProps<Window> & SvelteWindowProps;
      sveltebody: HTMLProps<HTMLElement>;
      sveltefragment: { slot?: string; };

      [name: string]: { [name: string]: any };
    }
  }
