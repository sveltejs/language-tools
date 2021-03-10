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
      oncopy?: ClipboardEventHandler<T>;
      oncut?: ClipboardEventHandler<T>;
      onpaste?: ClipboardEventHandler<T>;

      // Composition Events
      oncompositionend?: CompositionEventHandler<T>;
      oncompositionstart?: CompositionEventHandler<T>;
      oncompositionupdate?: CompositionEventHandler<T>;

      // Focus Events
      onfocus?: FocusEventHandler<T>;
      onfocusin?: FocusEventHandler<T>;
      onfocusout?: FocusEventHandler<T>;
      onblur?: FocusEventHandler<T>;

      // Form Events
      onchange?: FormEventHandler<T>;
      oninput?: FormEventHandler<T>;
      onreset?: FormEventHandler<T>;
      onsubmit?: FormEventHandler<T>;
      oninvalid?: EventHandler<Event, T>;

      // Image Events
      onload?: EventHandler;
      onerror?: EventHandler; // also a Media Event

      // Detail Events
      ontoggle?: EventHandler<Event, T>;

      // Keyboard Events
      onkeydown?: KeyboardEventHandler<T>;
      onkeypress?: KeyboardEventHandler<T>;
      onkeyup?: KeyboardEventHandler<T>;

      // Media Events
      onabort?: EventHandler<Event, T>;
      oncanplay?: EventHandler<Event, T>;
      oncanplaythrough?: EventHandler<Event, T>;
      oncuechange?: EventHandler<Event, T>;
      ondurationchange?: EventHandler<Event, T>;
      onemptied?: EventHandler<Event, T>;
      onencrypted?: EventHandler<Event, T>;
      onended?: EventHandler<Event, T>;
      onloadeddata?: EventHandler<Event, T>;
      onloadedmetadata?: EventHandler<Event, T>;
      onloadstart?: EventHandler<Event, T>;
      onpause?: EventHandler<Event, T>;
      onplay?: EventHandler<Event, T>;
      onplaying?: EventHandler<Event, T>;
      onprogress?: EventHandler<Event, T>;
      onratechange?: EventHandler<Event, T>;
      onseeked?: EventHandler<Event, T>;
      onseeking?: EventHandler<Event, T>;
      onstalled?: EventHandler<Event, T>;
      onsuspend?: EventHandler<Event, T>;
      ontimeupdate?: EventHandler<Event, T>;
      onvolumechange?: EventHandler<Event, T>;
      onwaiting?: EventHandler<Event, T>;

      // MouseEvents
      onauxclick?: MouseEventHandler<T>;
      onclick?: MouseEventHandler<T>;
      oncontextmenu?: MouseEventHandler<T>;
      ondblclick?: MouseEventHandler<T>;
      ondrag?: DragEventHandler<T>;
      ondragend?: DragEventHandler<T>;
      ondragenter?: DragEventHandler<T>;
      ondragexit?: DragEventHandler<T>;
      ondragleave?: DragEventHandler<T>;
      ondragover?: DragEventHandler<T>;
      ondragstart?: DragEventHandler<T>;
      ondrop?: DragEventHandler<T>;
      onmousedown?: MouseEventHandler<T>;
      onmouseenter?: MouseEventHandler<T>;
      onmouseleave?: MouseEventHandler<T>;
      onmousemove?: MouseEventHandler<T>;
      onmouseout?: MouseEventHandler<T>;
      onmouseover?: MouseEventHandler<T>;
      onmouseup?: MouseEventHandler<T>;

      // Selection Events
      onselect?: EventHandler<Event, T>;
      onselectionchange?: EventHandler<Event, T>;
      onselectstart?: EventHandler<Event, T>;

      // Touch Events
      ontouchcancel?: TouchEventHandler<T>;
      ontouchend?: TouchEventHandler<T>;
      ontouchmove?: TouchEventHandler<T>;
      ontouchstart?: TouchEventHandler<T>;

      // Pointer Events
      ongotpointercapture?: PointerEventHandler<T>;
      onpointercancel?: PointerEventHandler<T>;
      onpointerdown?: PointerEventHandler<T>;
      onpointerenter?: PointerEventHandler<T>;
      onpointerleave?: PointerEventHandler<T>;
      onpointermove?: PointerEventHandler<T>;
      onpointerout?: PointerEventHandler<T>;
      onpointerover?: PointerEventHandler<T>;
      onpointerup?: PointerEventHandler<T>;
      onlostpointercapture?: PointerEventHandler<T>;

      // UI Events
      onscroll?: UIEventHandler<T>;
      onresize?: UIEventHandler<T>;

      // Wheel Events
      onwheel?: WheelEventHandler<T>;

      // Animation Events
      onanimationstart?: AnimationEventHandler<T>;
      onanimationend?: AnimationEventHandler<T>;
      onanimationiteration?: AnimationEventHandler<T>;

      // Transition Events
      ontransitionstart?: TransitionEventHandler<T>;
      ontransitionrun?: TransitionEventHandler<T>;
      ontransitionend?: TransitionEventHandler<T>;
      ontransitioncancel?: TransitionEventHandler<T>;

      // Svelte Transition Events
      onoutrostart?: EventHandler<CustomEvent<null>, T>;
      onoutroend?: EventHandler<CustomEvent<null>, T>;
      onintrostart?: EventHandler<CustomEvent<null>, T>;
      onintroend?: EventHandler<CustomEvent<null>, T>;

      // Message Events
      onmessage?: MessageEventHandler<T>;
      onmessageerror?: MessageEventHandler<T>;

      // Global Events
      oncancel?: EventHandler<Event, T>;
      onclose?: EventHandler<Event, T>;
      onfullscreenchange?: EventHandler<Event, T>;
      onfullscreenerror?: EventHandler<Event, T>;
    }

    interface HTMLAttributes<T extends EventTarget> extends DOMAttributes<T> {
      // jsx-dom-specific Attributes
      class?: ClassName;
      dataset?: object; // eslint-disable-line

      // Standard HTML Attributes
      accept?: string;
      acceptcharset?: string;
      accesskey?: string;
      action?: string;
      allow?: string;
      allowfullscreen?: boolean;
      allowtransparency?: boolean;
      allowpaymentrequest?: boolean;
      alt?: string;
      as?: string;
      async?: boolean;
      autocomplete?: string;
      autofocus?: boolean;
      autoplay?: boolean;
      capture?: 'environment' | 'user' | boolean;
      cellpadding?: number | string;
      cellspacing?: number | string;
      charset?: string;
      challenge?: string;
      checked?: boolean;
      cite?: string;
      classid?: string;
      classname?: ClassName;
      cols?: number;
      colspan?: number;
      content?: string;
      contenteditable?: 'true' | 'false' | boolean;

      // Doesn't work when used as HTML attribute
      /**
       * Elements with the contenteditable attribute support innerHTML and textContent bindings.
       */
      innerHTML?: string;
      // Doesn't work when used as HTML attribute
      /**
       * Elements with the contenteditable attribute support innerHTML and textContent bindings.
       */

      textContent?: string;

      contextmenu?: string;
      controls?: boolean;
      coords?: string;
      crossorigin?: string;
      currenttime?: number;
      data?: string;
      datetime?: string;
      default?: boolean;
      defaultmuted?: boolean;
      defaultplaybackrate?: number;
      defer?: boolean;
      dir?: string;
      disabled?: boolean;
      download?: any;
      draggable?: boolean | 'true' | 'false';
      enctype?: string;
      for?: string;
      form?: string;
      formaction?: string;
      formenctype?: string;
      formmethod?: string;
      formnovalidate?: boolean;
      formtarget?: string;
      frameborder?: number | string;
      headers?: string;
      height?: number | string;
      hidden?: boolean;
      high?: number;
      href?: string;
      hreflang?: string;
      htmlfor?: string;
      httpequiv?: string;
      id?: string;
      inputmode?: string;
      integrity?: string;
      is?: string;
      ismap?: boolean;
      keyparams?: string;
      keytype?: string;
      kind?: string;
      label?: string;
      lang?: string;
      list?: string;
      loading?: string;
      loop?: boolean;
      low?: number;
      manifest?: string;
      marginheight?: number;
      marginwidth?: number;
      max?: number | string;
      maxlength?: number;
      media?: string;
      mediagroup?: string;
      method?: string;
      min?: number | string;
      minlength?: number;
      multiple?: boolean;
      muted?: boolean;
      name?: string;
      nonce?: string;
      novalidate?: boolean;
      open?: boolean;
      optimum?: number;
      part?: string;
      pattern?: string;
      placeholder?: string;
      playsinline?: boolean;
      poster?: string;
      preload?: string;
      radiogroup?: string;
      readonly?: boolean;
      rel?: string;
      required?: boolean;
      reversed?: boolean;
      role?: string;
      rows?: number;
      rowspan?: number;
      sandbox?: string;
      scope?: string;
      scoped?: boolean;
      scrolling?: string;
      seamless?: boolean;
      selected?: boolean;
      shape?: string;
      size?: number;
      sizes?: string;
      slot?: string;
      span?: number;
      spellcheck?: boolean | 'true' | 'false';
      src?: string;
      srcdoc?: string;
      srclang?: string;
      srcset?: string;
      start?: number;
      step?: number | string;
      style?: string;
      summary?: string;
      tabindex?: number;
      target?: string;
      title?: string;
      type?: string;
      usemap?: string;
      value?: string | string[] | number | null;
      /**
       * a value between 0 and 1
      */
      volume?: number;
      width?: number | string;
      wmode?: string;
      wrap?: string;

      // RDFa Attributes
      about?: string;
      datatype?: string;
      inlist?: any;
      prefix?: string;
      property?: string;
      resource?: string;
      typeof?: string;
      vocab?: string;

      // Non-standard Attributes
      autocapitalize?: string;
      autocorrect?: string;
      autosave?: string;
      color?: string;
      itemprop?: string;
      itemscope?: boolean;
      itemtype?: string;
      itemid?: string;
      itemref?: string;
      results?: number;
      security?: string;
      unselectable?: boolean;
    }

    // this list is "complete" in that it contains every SVG attribute
    // that React supports, but the types can be improved.
    // Full list here: https://facebook.github.io/react/docs/dom-elements.html
    //
    // The three broad type categories are (in order of restrictiveness):
    //   - "number | string"
    //   - "string"
    //   - union of string literals
    interface SVGAttributes<T extends EventTarget> extends DOMAttributes<T> {
      // Attributes which also defined in HTMLAttributes
      className?: string;
      class?: string;
      color?: string;
      height?: number | string;
      id?: string;
      lang?: string;
      max?: number | string;
      media?: string;
      method?: string;
      min?: number | string;
      name?: string;
      style?: string;
      target?: string;
      type?: string;
      width?: number | string;

      // Other HTML properties supported by SVG elements in browsers
      role?: string;
      tabindex?: number;
      crossorigin?: 'anonymous' | 'use-credentials' | '';

      // SVG Specific attributes
      'accent-height'?: number | string;
      accumulate?: 'none' | 'sum';
      additive?: 'replace' | 'sum';
      'alignment-baseline'?: 'auto' | 'baseline' | 'before-edge' | 'text-before-edge' | 'middle' |
        'central' | 'after-edge' | 'text-after-edge' | 'ideographic' | 'alphabetic' | 'hanging' |
        'mathematical' | 'inherit';
      allowReorder?: 'no' | 'yes';
      alphabetic?: number | string;
      amplitude?: number | string;
      'arabic-form'?: 'initial' | 'medial' | 'terminal' | 'isolated';
      ascent?: number | string;
      attributeName?: string;
      attributeType?: string;
      autoReverse?: number | string;
      azimuth?: number | string;
      baseFrequency?: number | string;
      'baseline-shift'?: number | string;
      baseProfile?: number | string;
      bbox?: number | string;
      begin?: number | string;
      bias?: number | string;
      by?: number | string;
      calcMode?: number | string;
      'cap-height'?: number | string;
      clip?: number | string;
      'clip-path'?: string;
      clipPathUnits?: number | string;
      'clip-rule'?: number | string;
      'color-interpolation'?: number | string;
      'color-interpolation-filters'?: 'auto' | 'sRGB' | 'linearRGB' | 'inherit';
      'color-profile'?: number | string;
      'color-rendering'?: number | string;
      contentScriptType?: number | string;
      contentStyleType?: number | string;
      cursor?: number | string;
      cx?: number | string;
      cy?: number | string;
      d?: string;
      decelerate?: number | string;
      descent?: number | string;
      diffuseConstant?: number | string;
      direction?: number | string;
      display?: number | string;
      divisor?: number | string;
      'dominant-baseline'?: number | string;
      dur?: number | string;
      dx?: number | string;
      dy?: number | string;
      edgeMode?: number | string;
      elevation?: number | string;
      'enable-background'?: number | string;
      end?: number | string;
      exponent?: number | string;
      externalResourcesRequired?: number | string;
      fill?: string;
      'fill-opacity'?: number | string;
      fillRule?: 'nonzero' | 'evenodd' | 'inherit';
      filter?: string;
      filterRes?: number | string;
      filterUnits?: number | string;
      'flood-color'?: number | string;
      'flood-opacity'?: number | string;
      focusable?: number | string;
      'font-family'?: string;
      'font-size'?: number | string;
      'font-size-adjust'?: number | string;
      'font-stretch'?: number | string;
      'font-style'?: number | string;
      'font-variant'?: number | string;
      'font-weight'?: number | string;
      format?: number | string;
      from?: number | string;
      fx?: number | string;
      fy?: number | string;
      g1?: number | string;
      g2?: number | string;
      'glyph-name'?: number | string;
      'glyph-orientation-horizontal'?: number | string;
      'glyph-orientation-vertical'?: number | string;
      glyphRef?: number | string;
      gradientTransform?: string;
      gradientUnits?: string;
      hanging?: number | string;
      href?: string;
      'horiz-adv-x'?: number | string;
      'horiz-origin-x'?: number | string;
      ideographic?: number | string;
      'image-rendering'?: number | string;
      in2?: number | string;
      in?: string;
      intercept?: number | string;
      k1?: number | string;
      k2?: number | string;
      k3?: number | string;
      k4?: number | string;
      k?: number | string;
      kernelMatrix?: number | string;
      kernelUnitLength?: number | string;
      kerning?: number | string;
      keyPoints?: number | string;
      keySplines?: number | string;
      keyTimes?: number | string;
      lengthAdjust?: number | string;
      'letter-spacing'?: number | string;
      'lighting-color'?: number | string;
      limitingConeAngle?: number | string;
      local?: number | string;
      'marker-end'?: string;
      markerHeight?: number | string;
      'marker-mid'?: string;
      'marker-start'?: string;
      markerUnits?: number | string;
      markerWidth?: number | string;
      mask?: string;
      maskContentUnits?: number | string;
      maskUnits?: number | string;
      mathematical?: number | string;
      mode?: number | string;
      numOctaves?: number | string;
      offset?: number | string;
      opacity?: number | string;
      operator?: number | string;
      order?: number | string;
      orient?: number | string;
      orientation?: number | string;
      origin?: number | string;
      overflow?: number | string;
      'overline-position'?: number | string;
      'overline-thickness'?: number | string;
      'paint-order'?: number | string;
      'panose-1'?: number | string;
      path?: string;
      pathLength?: number | string;
      patternContentUnits?: string;
      patternTransform?: number | string;
      patternUnits?: string;
      'pointer-events'?: number | string;
      points?: string;
      pointsAtX?: number | string;
      pointsAtY?: number | string;
      pointsAtZ?: number | string;
      preserveAlpha?: number | string;
      preserveAspectRatio?: string;
      primitiveUnits?: number | string;
      r?: number | string;
      radius?: number | string;
      refX?: number | string;
      refY?: number | string;
      'rendering-intent'?: number | string;
      repeatCount?: number | string;
      repeatDur?: number | string;
      requiredExtensions?: number | string;
      requiredFeatures?: number | string;
      restart?: number | string;
      result?: string;
      rotate?: number | string;
      rx?: number | string;
      ry?: number | string;
      scale?: number | string;
      seed?: number | string;
      'shape-rendering'?: number | string;
      slope?: number | string;
      spacing?: number | string;
      specularConstant?: number | string;
      specularExponent?: number | string;
      speed?: number | string;
      spreadMethod?: string;
      startOffset?: number | string;
      stdDeviation?: number | string;
      stemh?: number | string;
      stemv?: number | string;
      stitchTiles?: number | string;
      'stop-color'?: string;
      'stop-opacity'?: number | string;
      'strikethrough-position'?: number | string;
      'strikethrough-thickness'?: number | string;
      string?: number | string;
      stroke?: string;
      'stroke-dasharray'?: string | number;
      'stroke-dashoffset'?: string | number;
      'stroke-linecap'?: 'butt' | 'round' | 'square' | 'inherit';
      'stroke-linejoin'?: 'miter' | 'round' | 'bevel' | 'inherit';
      'stroke-miterlimit'?: string;
      'stroke-opacity'?: number | string;
      'stroke-width'?: number | string;
      surfaceScale?: number | string;
      systemLanguage?: number | string;
      tableValues?: number | string;
      targetX?: number | string;
      targetY?: number | string;
      'text-anchor'?: string;
      'text-decoration'?: number | string;
      textLength?: number | string;
      'text-rendering'?: number | string;
      to?: number | string;
      transform?: string;
      u1?: number | string;
      u2?: number | string;
      'underline-position'?: number | string;
      'underline-thickness'?: number | string;
      unicode?: number | string;
      'unicode-bidi'?: number | string;
      'unicode-range'?: number | string;
      'units-per-em'?: number | string;
      'v-alphabetic'?: number | string;
      values?: string;
      'vector-effect'?: number | string;
      version?: string;
      'vert-adv-y'?: number | string;
      'vert-origin-x'?: number | string;
      'vert-origin-y'?: number | string;
      'v-hanging'?: number | string;
      'v-ideographic'?: number | string;
      viewBox?: string;
      viewTarget?: number | string;
      visibility?: number | string;
      'v-mathematical'?: number | string;
      widths?: number | string;
      'word-spacing'?: number | string;
      'writing-mode'?: number | string;
      x1?: number | string;
      x2?: number | string;
      x?: number | string;
      xChannelSelector?: string;
      'x-height'?: number | string;
      xlinkActuate?: string;
      xlinkArcrole?: string;
      xlinkHref?: string;
      xlinkRole?: string;
      xlinkShow?: string;
      xlinkTitle?: string;
      xlinkType?: string;
      xmlBase?: string;
      xmlLang?: string;
      xmlns?: string;
      xmlnsXlink?: string;
      xmlSpace?: string;
      y1?: number | string;
      y2?: number | string;
      y?: number | string;
      yChannelSelector?: string;
      z?: number | string;
      zoomAndPan?: string;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface HTMLProps<T extends EventTarget> extends HTMLAttributes<T> {}
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface SVGProps<T extends EventTarget> extends SVGAttributes<T> {}

    interface SvelteOptionProps extends HTMLProps<HTMLOptionElement> {
        value?: any;
    }

    interface SvelteSelectProps extends HTMLProps<HTMLSelectElement> {
      value?: any;
    }

    interface SvelteInputProps extends HTMLProps<HTMLInputElement> {
      group?: any;
      files?: FileList | null;
      indeterminate?: boolean;
    }

    interface SvelteWindowProps  {
      readonly innerWidth?: Window['innerWidth'];
      readonly innerHeight?: Window['innerHeight'];
      readonly outerWidth?: Window['outerWidth'];
      readonly outerHeight?: Window['outerHeight'];
      scrollX?: Window['scrollX'];
      scrollY?: Window['scrollY'];
      readonly online?: Window['navigator']['onLine'];

      ondevicelight?: EventHandler<Event, Window>;
      onbeforeinstallprompt?: EventHandler<Event, Window>;
      ondeviceproximity?: EventHandler<Event, Window>;
      onpaint?: EventHandler<Event, Window>;
      onuserproximity?: EventHandler<Event, Window>;
      onbeforeprint?: EventHandler<Event, Window>;
      onafterprint?: EventHandler<Event, Window>;
      onlanguagechange?: EventHandler<Event, Window>;
      onorientationchange?: EventHandler<Event, Window>;
      onmessage?: EventHandler<MessageEvent, Window>;
      onmessageerror?: EventHandler<MessageEvent, Window>;
      onoffline?: EventHandler<Event, Window>;
      ononline?: EventHandler<Event, Window>;
      onbeforeunload?: EventHandler<BeforeUnloadEvent, Window>;
      onunload?: EventHandler<Event, Window>;
      onstorage?: EventHandler<StorageEvent, Window>;
      onhashchange?: EventHandler<HashChangeEvent, Window>;
      onpagehide?: EventHandler<PageTransitionEvent, Window>;
      onpageshow?: EventHandler<PageTransitionEvent, Window>;
      onpopstate?: EventHandler<PopStateEvent, Window>;
      ondevicemotion?: EventHandler<DeviceMotionEvent>;
      ondeviceorientation?: EventHandler<DeviceOrientationEvent, Window>;
      ondeviceorientationabsolute?: EventHandler<DeviceOrientationEvent, Window>;
      onunhandledrejection?: EventHandler<PromiseRejectionEvent, Window>;
      onrejectionhandled?: EventHandler<PromiseRejectionEvent, Window>;
    }

    interface SapperAnchorProps {
        // transformed from sapper:noscroll so it should be camel case
        sapperNoscroll?: true;
        sapperPrefetch?: true;
    }

    interface SvelteMediaTimeRange {
        start: number;
        end: number;
    }

    interface SvelteMediaProps {
        readonly duration?: number;
        readonly buffered?: SvelteMediaTimeRange[];
        readonly played?: SvelteMediaTimeRange[];
        readonly seekable?: SvelteMediaTimeRange[];
        readonly seeking?: boolean;
        readonly ended?: boolean;

        /**
         * the current playback time in the video, in seconds
         */
        currentTime?: number;
        /**
         * the current playback time in the video, in seconds
         */
        currenttime?: number;
        // Doesn't work when used as HTML Attribute
        /**
         * how fast or slow to play the video, where 1 is 'normal'
         */
        playbackRate?: number;

        paused?: boolean;
    }

    interface SvelteVideoProps extends SvelteMediaProps {
        // Binding only, don't need lowercase variant
        readonly videoWidth?: number;
        readonly videoHeight?: number;
    }

    interface IntrinsicElements {
      // HTML
      a: HTMLProps<HTMLAnchorElement> & SapperAnchorProps;
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
