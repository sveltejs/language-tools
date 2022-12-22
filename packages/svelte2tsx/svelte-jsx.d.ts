/// <reference lib="dom" />

declare namespace svelteHTML {

  // Every namespace eligible for use needs to implement the following two functions
  /**
   * @internal do not use
   */
  function mapElementTag<K extends keyof ElementTagNameMap>(
    tag: K
  ): ElementTagNameMap[K];
  function mapElementTag<K extends keyof SVGElementTagNameMap>(
    tag: K
  ): SVGElementTagNameMap[K];
  function mapElementTag(
    tag: any
  ): any; // needs to be any because used in context of <svelte:element>

  /**
   * @internal do not use
   */
  function createElement<Elements extends IntrinsicElements, Key extends keyof Elements>(
    // "undefined | null" because of <svelte:element>
    element: Key | undefined | null, attrs: Elements[Key]
  ): Key extends keyof ElementTagNameMap ? ElementTagNameMap[Key] : Key extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[Key] : any;
  function createElement<Elements extends IntrinsicElements, Key extends keyof Elements, T>(
    // "undefined | null" because of <svelte:element>
    element: Key | undefined | null, attrsEnhancers: T, attrs: Elements[Key] & T
  ): Key extends keyof ElementTagNameMap ? ElementTagNameMap[Key] : Key extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[Key] : any;

  // For backwards-compatibility and ease-of-use, in case someone enhanced the typings from import('svelte/elements').HTMLAttributes/SVGAttributes
  interface HTMLAttributes<T extends EventTarget = any> {}
  interface SVGAttributes<T extends EventTarget = any> {}

  /**
   * @internal do not use
   */
  type EventsWithColon<T> = {[Property in keyof T as Property extends `on${infer Key}` ? `on:${Key}` : Property]?: T[Property] }
  /**
   * @internal do not use
   */
  type HTMLProps<Property extends string, Override> =
    // This omit chain ensures that properties manually defined in the new transformation take precedence
    // over those manually defined in the old, taking precendence over the defaults, to make sth like this possible
    // https://github.com/sveltejs/language-tools/issues/1352#issuecomment-1248627516
    Omit<
      Omit<import('svelte/elements').SvelteHTMLElements[Property], keyof EventsWithColon<svelte.JSX.IntrinsicElements[Property & string]>> & EventsWithColon<svelte.JSX.IntrinsicElements[Property & string]>,
      keyof Override
    > & Override;
  /**
   * @internal do not use
   */
  type RemoveIndex<T> = {
    [ K in keyof T as string extends K ? never : K ] : T[K]
  };

  // the following type construct makes sure that we can use the new typings while maintaining backwards-compatibility in case someone enhanced the old typings
  interface IntrinsicElements extends Omit<RemoveIndex<svelte.JSX.IntrinsicElements>, keyof RemoveIndex<import('svelte/elements').SvelteHTMLElements>> {
    a: HTMLProps<'a', HTMLAttributes>;
    abbr: HTMLProps<'abbr', HTMLAttributes>;
    address: HTMLProps<'address', HTMLAttributes>;
    area: HTMLProps<'area', HTMLAttributes>;
    article: HTMLProps<'article', HTMLAttributes>;
    aside: HTMLProps<'aside', HTMLAttributes>;
    audio: HTMLProps<'audio', HTMLAttributes>;
    b: HTMLProps<'b', HTMLAttributes>;
    base: HTMLProps<'base', HTMLAttributes>;
    bdi: HTMLProps<'bdi', HTMLAttributes>;
    bdo: HTMLProps<'bdo', HTMLAttributes>;
    big: HTMLProps<'big', HTMLAttributes>;
    blockquote: HTMLProps<'blockquote', HTMLAttributes>;
    body: HTMLProps<'body', HTMLAttributes>;
    br: HTMLProps<'br', HTMLAttributes>;
    button: HTMLProps<'button', HTMLAttributes>;
    canvas: HTMLProps<'canvas', HTMLAttributes>;
    caption: HTMLProps<'caption', HTMLAttributes>;
    cite: HTMLProps<'cite', HTMLAttributes>;
    code: HTMLProps<'code', HTMLAttributes>;
    col: HTMLProps<'col', HTMLAttributes>;
    colgroup: HTMLProps<'colgroup', HTMLAttributes>;
    data: HTMLProps<'data', HTMLAttributes>;
    datalist: HTMLProps<'datalist', HTMLAttributes>;
    dd: HTMLProps<'dd', HTMLAttributes>;
    del: HTMLProps<'del', HTMLAttributes>;
    details: HTMLProps<'details', HTMLAttributes>;
    dfn: HTMLProps<'dfn', HTMLAttributes>;
    dialog: HTMLProps<'dialog', HTMLAttributes>;
    div: HTMLProps<'div', HTMLAttributes>;
    dl: HTMLProps<'dl', HTMLAttributes>;
    dt: HTMLProps<'dt', HTMLAttributes>;
    em: HTMLProps<'em', HTMLAttributes>;
    embed: HTMLProps<'embed', HTMLAttributes>;
    fieldset: HTMLProps<'fieldset', HTMLAttributes>;
    figcaption: HTMLProps<'figcaption', HTMLAttributes>;
    figure: HTMLProps<'figure', HTMLAttributes>;
    footer: HTMLProps<'footer', HTMLAttributes>;
    form: HTMLProps<'form', HTMLAttributes>;
    h1: HTMLProps<'h1', HTMLAttributes>;
    h2: HTMLProps<'h2', HTMLAttributes>;
    h3: HTMLProps<'h3', HTMLAttributes>;
    h4: HTMLProps<'h4', HTMLAttributes>;
    h5: HTMLProps<'h5', HTMLAttributes>;
    h6: HTMLProps<'h6', HTMLAttributes>;
    head: HTMLProps<'head', HTMLAttributes>;
    header: HTMLProps<'header', HTMLAttributes>;
    hgroup: HTMLProps<'hgroup', HTMLAttributes>;
    hr: HTMLProps<'hr', HTMLAttributes>;
    html: HTMLProps<'html', HTMLAttributes>;
    i: HTMLProps<'i', HTMLAttributes>;
    iframe: HTMLProps<'iframe', HTMLAttributes>;
    img: HTMLProps<'img', HTMLAttributes>;
    input: HTMLProps<'input', HTMLAttributes>;
    ins: HTMLProps<'ins', HTMLAttributes>;
    kbd: HTMLProps<'kbd', HTMLAttributes>;
    keygen: HTMLProps<'keygen', HTMLAttributes>;
    label: HTMLProps<'label', HTMLAttributes>;
    legend: HTMLProps<'legend', HTMLAttributes>;
    li: HTMLProps<'li', HTMLAttributes>;
    link: HTMLProps<'link', HTMLAttributes>;
    main: HTMLProps<'main', HTMLAttributes>;
    map: HTMLProps<'map', HTMLAttributes>;
    mark: HTMLProps<'mark', HTMLAttributes>;
    menu: HTMLProps<'menu', HTMLAttributes>;
    menuitem: HTMLProps<'menuitem', HTMLAttributes>;
    meta: HTMLProps<'meta', HTMLAttributes>;
    meter: HTMLProps<'meter', HTMLAttributes>;
    nav: HTMLProps<'nav', HTMLAttributes>;
    noscript: HTMLProps<'noscript', HTMLAttributes>;
    object: HTMLProps<'object', HTMLAttributes>;
    ol: HTMLProps<'ol', HTMLAttributes>;
    optgroup: HTMLProps<'optgroup', HTMLAttributes>;
    option: HTMLProps<'option', HTMLAttributes>;
    output: HTMLProps<'output', HTMLAttributes>;
    p: HTMLProps<'p', HTMLAttributes>;
    param: HTMLProps<'param', HTMLAttributes>;
    picture: HTMLProps<'picture', HTMLAttributes>;
    pre: HTMLProps<'pre', HTMLAttributes>;
    progress: HTMLProps<'progress', HTMLAttributes>;
    q: HTMLProps<'q', HTMLAttributes>;
    rp: HTMLProps<'rp', HTMLAttributes>;
    rt: HTMLProps<'rt', HTMLAttributes>;
    ruby: HTMLProps<'ruby', HTMLAttributes>;
    s: HTMLProps<'s', HTMLAttributes>;
    samp: HTMLProps<'samp', HTMLAttributes>;
    slot: HTMLProps<'slot', HTMLAttributes>;
    script: HTMLProps<'script', HTMLAttributes>;
    section: HTMLProps<'section', HTMLAttributes>;
    select: HTMLProps<'select', HTMLAttributes>;
    small: HTMLProps<'small', HTMLAttributes>;
    source: HTMLProps<'source', HTMLAttributes>;
    span: HTMLProps<'span', HTMLAttributes>;
    strong: HTMLProps<'strong', HTMLAttributes>;
    style: HTMLProps<'style', HTMLAttributes>;
    sub: HTMLProps<'sub', HTMLAttributes>;
    summary: HTMLProps<'summary', HTMLAttributes>;
    sup: HTMLProps<'sup', HTMLAttributes>;
    table: HTMLProps<'table', HTMLAttributes>;
    template: HTMLProps<'template', HTMLAttributes>;
    tbody: HTMLProps<'tbody', HTMLAttributes>;
    td: HTMLProps<'td', HTMLAttributes>;
    textarea: HTMLProps<'textarea', HTMLAttributes>;
    tfoot: HTMLProps<'tfoot', HTMLAttributes>;
    th: HTMLProps<'th', HTMLAttributes>;
    thead: HTMLProps<'thead', HTMLAttributes>;
    time: HTMLProps<'time', HTMLAttributes>;
    title: HTMLProps<'title', HTMLAttributes>;
    tr: HTMLProps<'tr', HTMLAttributes>;
    track: HTMLProps<'track', HTMLAttributes>;
    u: HTMLProps<'u', HTMLAttributes>;
    ul: HTMLProps<'ul', HTMLAttributes>;
    var: HTMLProps<'var', HTMLAttributes>;
    video: HTMLProps<'video', HTMLAttributes>;
    wbr: HTMLProps<'wbr', HTMLAttributes>;
    webview: HTMLProps<'webview', HTMLAttributes>;
    // SVG
    svg: HTMLProps<'svg', SVGAttributes>;

    animate: HTMLProps<'animate', SVGAttributes>;
    animateMotion: HTMLProps<'animateMotion', SVGAttributes>;
    animateTransform: HTMLProps<'animateTransform', SVGAttributes>;
    circle: HTMLProps<'circle', SVGAttributes>;
    clipPath: HTMLProps<'clipPath', SVGAttributes>;
    defs: HTMLProps<'defs', SVGAttributes>;
    desc: HTMLProps<'desc', SVGAttributes>;
    ellipse: HTMLProps<'ellipse', SVGAttributes>;
    feBlend: HTMLProps<'feBlend', SVGAttributes>;
    feColorMatrix: HTMLProps<'feColorMatrix', SVGAttributes>;
    feComponentTransfer: HTMLProps<'feComponentTransfer', SVGAttributes>;
    feComposite: HTMLProps<'feComposite', SVGAttributes>;
    feConvolveMatrix: HTMLProps<'feConvolveMatrix', SVGAttributes>;
    feDiffuseLighting: HTMLProps<'feDiffuseLighting', SVGAttributes>;
    feDisplacementMap: HTMLProps<'feDisplacementMap', SVGAttributes>;
    feDistantLight: HTMLProps<'feDistantLight', SVGAttributes>;
    feDropShadow: HTMLProps<'feDropShadow', SVGAttributes>;
    feFlood: HTMLProps<'feFlood', SVGAttributes>;
    feFuncA: HTMLProps<'feFuncA', SVGAttributes>;
    feFuncB: HTMLProps<'feFuncB', SVGAttributes>;
    feFuncG: HTMLProps<'feFuncG', SVGAttributes>;
    feFuncR: HTMLProps<'feFuncR', SVGAttributes>;
    feGaussianBlur: HTMLProps<'feGaussianBlur', SVGAttributes>;
    feImage: HTMLProps<'feImage', SVGAttributes>;
    feMerge: HTMLProps<'feMerge', SVGAttributes>;
    feMergeNode: HTMLProps<'feMergeNode', SVGAttributes>;
    feMorphology: HTMLProps<'feMorphology', SVGAttributes>;
    feOffset: HTMLProps<'feOffset', SVGAttributes>;
    fePointLight: HTMLProps<'fePointLight', SVGAttributes>;
    feSpecularLighting: HTMLProps<'feSpecularLighting', SVGAttributes>;
    feSpotLight: HTMLProps<'feSpotLight', SVGAttributes>;
    feTile: HTMLProps<'feTile', SVGAttributes>;
    feTurbulence: HTMLProps<'feTurbulence', SVGAttributes>;
    filter: HTMLProps<'filter', SVGAttributes>;
    foreignObject: HTMLProps<'foreignObject', SVGAttributes>;
    g: HTMLProps<'g', SVGAttributes>;
    image: HTMLProps<'image', SVGAttributes>;
    line: HTMLProps<'line', SVGAttributes>;
    linearGradient: HTMLProps<'linearGradient', SVGAttributes>;
    marker: HTMLProps<'marker', SVGAttributes>;
    mask: HTMLProps<'mask', SVGAttributes>;
    metadata: HTMLProps<'metadata', SVGAttributes>;
    mpath: HTMLProps<'mpath', SVGAttributes>;
    path: HTMLProps<'path', SVGAttributes>;
    pattern: HTMLProps<'pattern', SVGAttributes>;
    polygon: HTMLProps<'polygon', SVGAttributes>;
    polyline: HTMLProps<'polyline', SVGAttributes>;
    radialGradient: HTMLProps<'radialGradient', SVGAttributes>;
    rect: HTMLProps<'rect', SVGAttributes>;
    stop: HTMLProps<'stop', SVGAttributes>;
    switch: HTMLProps<'switch', SVGAttributes>;
    symbol: HTMLProps<'symbol', SVGAttributes>;
    text: HTMLProps<'text', SVGAttributes>;
    textPath: HTMLProps<'textPath', SVGAttributes>;
    tspan: HTMLProps<'tspan', SVGAttributes>;
    use: HTMLProps<'use', SVGAttributes>;
    view: HTMLProps<'view', SVGAttributes>;

    // Svelte specific
    'svelte:window': HTMLProps<'svelte:window', HTMLAttributes>;
    'svelte:body': HTMLProps<'svelte:body', HTMLAttributes>;
    'svelte:fragment': { slot?: string };
    'svelte:options': { [name: string]: any };
    'svelte:head': { [name: string]: any };

    [name: string]: { [name: string]: any };
  }

}

// Keep svelte.JSX for backwards compatibility, in case someone enhanced it with their own typings,
// which we can transform to the new svelteHTML namespace.
/**
 * @deprecated use the new svelteHTML namespace instead, or the types from `svelte/elements`
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

    interface IntrinsicAttributes {
      slot?: string;
    }

    interface DOMAttributes<T extends EventTarget> {}

    interface AriaAttributes {}

    interface HTMLAttributes<T extends EventTarget> extends AriaAttributes, DOMAttributes<T> {}

    interface SVGAttributes<T extends EventTarget> extends AriaAttributes, DOMAttributes<T> {}

    interface HTMLProps<T extends EventTarget> extends HTMLAttributes<T> {}
    interface SVGProps<T extends EventTarget> extends SVGAttributes<T> {}

    interface SvelteInputProps extends HTMLProps<HTMLInputElement> {}

    interface SvelteWindowProps  {}

    interface SapperAnchorProps {}

    interface SvelteMediaTimeRange {}

    interface SvelteMediaProps {}

    interface SvelteVideoProps extends SvelteMediaProps {}

    // Keep these for backwards compatibility type above
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
      option: HTMLProps<HTMLOptionElement>;
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
      select: HTMLProps<HTMLSelectElement>;
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
      svelteoptions: { [name: string]: any };
      sveltehead: { [name: string]: any };
      svelteelement: { 'this': string | undefined | null; } & HTMLProps<any> & SVGProps<any> & SapperAnchorProps;
      // Needed due to backwards compatibility type which hits these
      'svelte:window': HTMLProps<Window> & SvelteWindowProps;
      'svelte:body': HTMLProps<HTMLElement>;
      'svelte:fragment': { slot?: string; };
      'svelte:options': { [name: string]: any };
      'svelte:head': { [name: string]: any };
    }
  }
