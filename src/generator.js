'use strict';

const EASE_ALIASES = {
  smooth:  'power2.out',
  snap:    'power4.out',
  bounce:  'bounce.out',
  elastic: 'elastic.out(1, 0.3)',
  back:    'back.out(1.7)',
  linear:  'none',
};

const EFFECT_PRESETS = {
  fade:      { opacity: 0 },
  fadeUp:    { opacity: 0, y: 50 },
  fadeDown:  { opacity: 0, y: -50 },
  fadeLeft:  { opacity: 0, x: 50 },
  fadeRight: { opacity: 0, x: -50 },
  zoomIn:    { opacity: 0, scale: 0.8 },
  popIn:     { opacity: 0, scale: 0 },
  slideUp:   { y: 60 },
  slideDown: { y: -60 },
};

const PASSTHROUGH_KEYS = new Set([
  'x', 'y', 'opacity', 'scale', 'rotation', 'rotate',
  'skewX', 'skewY', 'width', 'height',
]);

const HOVER_NEUTRAL = { scale: 1, rotation: 0, x: 0, y: 0, opacity: 1 };

// ─── helpers ──────────────────────────────────────────────────────────────────

function resolveEase(node, fallback) {
  if (!node) return fallback;
  if (node.type === 'String') return node.value;
  return Object.prototype.hasOwnProperty.call(EASE_ALIASES, node.value)
    ? EASE_ALIASES[node.value]
    : node.value;
}

function nodeToNumber(node) {
  if (!node) return null;
  if (node.type === 'Duration') return parseFloat(node.value);
  if (node.type === 'Number')   return node.value;
  return null;
}

// Priority: propsBlock > effect preset > inline passthrough
function buildAnimProps(properties, propsBlock) {
  const result = {};

  // Lowest: inline passthrough keys
  for (const [key, val] of Object.entries(properties || {})) {
    if (!PASSTHROUGH_KEYS.has(key)) continue;
    const rk = key === 'rotate' ? 'rotation' : key;
    result[rk] = val.type === 'Duration' ? parseFloat(val.value) : val.value;
  }

  // Middle: named effect preset
  const eff = (properties || {})['effect'];
  if (eff && eff.type === 'Ident' && EFFECT_PRESETS[eff.value]) {
    Object.assign(result, EFFECT_PRESETS[eff.value]);
  }

  // Highest: explicit properties { } block
  if (propsBlock) {
    for (const [key, val] of Object.entries(propsBlock)) {
      const rk = key === 'rotate' ? 'rotation' : key;
      result[rk] = val.type === 'Duration' ? parseFloat(val.value) : val.value;
    }
  }

  return result;
}

// Serialize a scalar or inline-object for use inside a props block
function serializeValue(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean')        return String(v);
  if (typeof v === 'number')         return String(v);
  if (typeof v === 'string')         return JSON.stringify(v);
  if (typeof v === 'object') {
    const pairs = Object.entries(v)
      .map(([k, vv]) => `${k}: ${serializeValue(vv)}`)
      .join(', ');
    return `{ ${pairs} }`;
  }
  return String(v);
}

// Serialize a props object as a multi-line block.
// indent = the indent level of the enclosing statement.
function serializeBlock(obj, indent = '') {
  const entries = Object.entries(obj);
  if (!entries.length) return '{}';
  const inner = indent + '  ';
  const body  = entries.map(([k, v]) => `${inner}${k}: ${serializeValue(v)}`).join(',\n');
  return `{\n${body}\n${indent}}`;
}

// ─── per-kind generators ──────────────────────────────────────────────────────

function genEntranceExit(node, defaultEase, defaultDuration) {
  const { kind, selector, properties, propsBlock } = node;
  const sel      = JSON.stringify(selector);
  const anim     = buildAnimProps(properties, propsBlock);
  const duration = nodeToNumber(properties['duration']) ?? defaultDuration;
  const ease     = resolveEase(properties['ease'], defaultEase);
  const gsapProps = { ...anim, duration, ease };
  const delayNode = properties['delay'];
  if (delayNode) gsapProps.delay = nodeToNumber(delayNode);
  const method = kind === 'exit' ? 'to' : 'from';
  return [`gsap.${method}(${sel}, ${serializeBlock(gsapProps)});`, ''];
}

function genScroll(node, defaultEase, defaultDuration) {
  const { selector, properties, propsBlock } = node;
  const sel      = JSON.stringify(selector);
  const anim     = buildAnimProps(properties, propsBlock);
  const duration = nodeToNumber(properties['duration']) ?? defaultDuration;
  const ease     = resolveEase(properties['ease'], defaultEase);

  const triggerNode = properties['trigger'];
  const startNode   = properties['start'];
  const endNode     = properties['end'];
  const scrubNode   = properties['scrub'];

  const start = triggerNode ? triggerNode.value
              : startNode   ? startNode.value
              : 'top 80%';
  const scrub = scrubNode
    ? (scrubNode.value === true || scrubNode.value === 'true')
    : false;

  const scrollTrigger = { trigger: selector, start };
  if (scrub) {
    scrollTrigger.scrub = true;
    if (endNode) scrollTrigger.end = endNode.value;
  } else {
    scrollTrigger.toggleActions = 'play none none none';
  }

  const gsapProps = { ...anim, duration, ease, scrollTrigger };
  return [`gsap.from(${sel}, ${serializeBlock(gsapProps)});`, ''];
}

function genHover(node, defaultEase, defaultDuration) {
  const { selector, properties, propsBlock } = node;
  const sel      = JSON.stringify(selector);
  const anim     = buildAnimProps(properties, propsBlock);
  const duration = nodeToNumber(properties['duration']) ?? defaultDuration;
  const ease     = resolveEase(properties['ease'], defaultEase);

  const hoverProps = { ...anim, duration, ease };
  const resetProps = { duration };
  for (const k of Object.keys(anim)) {
    if (k in HOVER_NEUTRAL) resetProps[k] = HOVER_NEUTRAL[k];
  }

  return [
    `document.querySelectorAll(${sel}).forEach(el => {`,
    `  el.addEventListener("mouseenter", () => gsap.to(el, ${serializeBlock(hoverProps, '  ')}));`,
    `  el.addEventListener("mouseleave", () => gsap.to(el, ${serializeBlock(resetProps, '  ')}));`,
    `});`,
    '',
  ];
}

function genClick(node, defaultEase, defaultDuration) {
  const { selector, properties, propsBlock } = node;
  const sel        = JSON.stringify(selector);
  const anim       = buildAnimProps(properties, propsBlock);
  const duration   = nodeToNumber(properties['duration']) ?? defaultDuration;
  const ease       = resolveEase(properties['ease'], defaultEase);
  const clickProps = { ...anim, duration, ease };

  return [
    `document.querySelectorAll(${sel}).forEach(el => {`,
    `  el.addEventListener("click", () => gsap.to(el, ${serializeBlock(clickProps, '  ')}));`,
    `});`,
    '',
  ];
}

function genStagger(node, defaultEase, defaultDuration) {
  const { selector, properties, propsBlock } = node;
  const sel      = JSON.stringify(selector);
  const anim     = buildAnimProps(properties, propsBlock);
  const duration = nodeToNumber(properties['duration']) ?? defaultDuration;
  const ease     = resolveEase(properties['ease'], defaultEase);
  const eachNode = properties['each'];
  const fromNode = properties['from'];

  const stagger = {};
  if (eachNode) stagger.each = nodeToNumber(eachNode);
  if (fromNode) stagger.from = fromNode.value;

  const gsapProps = { ...anim, duration, ease, stagger };
  return [`gsap.from(${sel}, ${serializeBlock(gsapProps)});`, ''];
}

function genTimeline(node, defaultEase, defaultDuration) {
  const { name, steps } = node;
  const lines = [`const ${name} = gsap.timeline();`];

  for (const step of steps) {
    const targetNode   = step['target'];
    const effectNode   = step['effect'];
    const delayNode    = step['delay'];
    const durationNode = step['duration'];
    const easeNode     = step['ease'];

    const target = JSON.stringify(targetNode ? targetNode.value : '');

    const stepAnim = {};
    if (effectNode && effectNode.type === 'Ident' && EFFECT_PRESETS[effectNode.value]) {
      Object.assign(stepAnim, EFFECT_PRESETS[effectNode.value]);
    }

    const duration  = nodeToNumber(durationNode) ?? defaultDuration;
    const ease      = resolveEase(easeNode, defaultEase);
    const gsapProps = { ...stepAnim, duration, ease };

    const rawPos  = delayNode ? nodeToNumber(delayNode) : '>';
    const posStr  = typeof rawPos === 'string' ? JSON.stringify(rawPos) : String(rawPos);

    lines.push(`${name}.from(${target}, ${serializeBlock(gsapProps)}, ${posStr});`);
  }

  lines.push('');
  return lines;
}

function gen3D(node, defaultEase, defaultDuration) {
  const { selector, properties } = node;
  const sel        = JSON.stringify(selector);
  const effectNode = properties['effect'];
  const effect     = effectNode ? effectNode.value : 'flip';
  const duration   = nodeToNumber(properties['duration']) ?? defaultDuration;
  const ease       = resolveEase(properties['ease'], defaultEase);

  if (effect === 'flip') {
    return [
      `document.querySelector(${sel}).parentElement.style.perspective = "1000px";`,
      `gsap.to(${sel}, ${serializeBlock({ rotationY: 180, duration, ease })});`,
      '',
    ];
  }

  if (effect === 'rotate3d') {
    const rotX = nodeToNumber(properties['rotateX']) ?? 0;
    const rotY = nodeToNumber(properties['rotateY']) ?? 0;
    return [`gsap.to(${sel}, ${serializeBlock({ rotationX: rotX, rotationY: rotY, duration, ease })});`, ''];
  }

  if (effect === 'tilt') {
    const strength = nodeToNumber(properties['strength']) ?? 20;
    return [
      `document.querySelectorAll(${sel}).forEach(el => {`,
      `  el.addEventListener("mousemove", (e) => {`,
      `    const r = el.getBoundingClientRect();`,
      `    const normX =  (e.clientX - r.left)  / r.width  - 0.5;`,
      `    const normY =  (e.clientY - r.top)   / r.height - 0.5;`,
      `    gsap.to(el, { rotationY: normX * ${strength}, rotationX: -normY * ${strength}, ease: ${JSON.stringify(ease)} });`,
      `  });`,
      `  el.addEventListener("mouseleave", () => {`,
      `    gsap.to(el, { rotationX: 0, rotationY: 0, ease: ${JSON.stringify(ease)} });`,
      `  });`,
      `});`,
      '',
    ];
  }

  if (effect === 'depth') {
    const z = nodeToNumber(properties['z']) ?? -200;
    return [`gsap.to(${sel}, ${serializeBlock({ z, duration, ease })});`, ''];
  }

  return [`// 3d effect "${effect}" not recognized`, ''];
}

function genTransition(node, defaultEase, defaultDuration) {
  const { properties } = node;
  const effectNode    = properties['effect'];
  const effect        = effectNode ? effectNode.value : 'fade';
  const duration      = nodeToNumber(properties['duration']) ?? defaultDuration;
  const ease          = resolveEase(properties['ease'], defaultEase);
  const directionNode = properties['direction'];
  const direction     = directionNode ? directionNode.value : 'left';

  const lines = [
    `(function initPageTransitions() {`,
    `  let overlay = document.getElementById("glide-overlay");`,
    `  if (!overlay) {`,
    `    overlay = document.createElement("div");`,
    `    overlay.id = "glide-overlay";`,
    `    Object.assign(overlay.style, {`,
    `      position: "fixed", top: "0", left: "0", width: "100%", height: "100%",`,
    `      background: "#000", zIndex: "9999", pointerEvents: "none",`,
    `    });`,
    `    document.body.appendChild(overlay);`,
    `  }`,
    ``,
  ];

  if (effect === 'fade') {
    lines.push(
      `  gsap.set(overlay, { opacity: 0 });`,
      `  function enterAnim(onComplete) {`,
      `    gsap.to(overlay, { opacity: 1, duration: ${duration}, ease: ${JSON.stringify(ease)}, onComplete });`,
      `  }`,
      `  function exitAnim() {`,
      `    gsap.to(overlay, { opacity: 0, duration: ${duration}, ease: ${JSON.stringify(ease)} });`,
      `  }`,
    );
  } else if (effect === 'slide') {
    const axis      = (direction === 'up' || direction === 'down') ? 'y' : 'x';
    const enterFrom = (direction === 'right' || direction === 'down') ? '100%' : '-100%';
    const exitTo    = (direction === 'right' || direction === 'down') ? '-100%' : '100%';
    lines.push(
      `  gsap.set(overlay, { ${axis}: "${exitTo}" });`,
      `  function enterAnim(onComplete) {`,
      `    gsap.fromTo(overlay, { ${axis}: "${enterFrom}" }, { ${axis}: "0%", duration: ${duration}, ease: ${JSON.stringify(ease)}, onComplete });`,
      `  }`,
      `  function exitAnim() {`,
      `    gsap.to(overlay, { ${axis}: "${exitTo}", duration: ${duration}, ease: ${JSON.stringify(ease)} });`,
      `  }`,
    );
  } else if (effect === 'curtain') {
    lines.push(
      `  gsap.set(overlay, { scaleY: 0 });`,
      `  function enterAnim(onComplete) {`,
      `    gsap.fromTo(overlay, { scaleY: 0, transformOrigin: "top" }, { scaleY: 1, duration: ${duration}, ease: ${JSON.stringify(ease)}, onComplete });`,
      `  }`,
      `  function exitAnim() {`,
      `    gsap.fromTo(overlay, { scaleY: 1, transformOrigin: "bottom" }, { scaleY: 0, duration: ${duration}, ease: ${JSON.stringify(ease)} });`,
      `  }`,
    );
  }

  lines.push(
    ``,
    `  document.addEventListener("click", (e) => {`,
    `    const a = e.target.closest("a");`,
    `    if (!a) return;`,
    `    const href = a.getAttribute("href");`,
    `    if (!href || a.target === "_blank" || /^[a-z][a-z0-9+.-]*:/i.test(href)) return;`,
    `    e.preventDefault();`,
    `    enterAnim(() => { window.location.href = href; });`,
    `  });`,
    ``,
    `  window.addEventListener("pageshow", () => exitAnim());`,
    `})();`,
    '',
  );

  return lines;
}

function genCursor(node, defaultEase) {
  const { selector, properties } = node;
  const sel        = JSON.stringify(selector);
  const effectNode = properties['effect'];
  const effect     = effectNode ? effectNode.value : 'follow';
  const ease       = resolveEase(properties['ease'], defaultEase);

  if (effect === 'follow') {
    const speed = nodeToNumber(properties['speed']) ?? 0.1;
    return [
      `window.addEventListener("mousemove", (e) => {`,
      `  gsap.to(${sel}, { x: e.clientX, y: e.clientY, duration: ${speed}, ease: ${JSON.stringify(ease)} });`,
      `});`,
      '',
    ];
  }

  if (effect === 'magnetic') {
    const targetNode = properties['target'];
    const target     = targetNode ? JSON.stringify(targetNode.value) : sel;
    const strength   = nodeToNumber(properties['strength']) ?? 0.3;
    return [
      `document.querySelectorAll(${target}).forEach(el => {`,
      `  el.addEventListener("mouseenter", (e) => {`,
      `    const r = el.getBoundingClientRect();`,
      `    const offsetX = e.clientX - (r.left + r.width  / 2);`,
      `    const offsetY = e.clientY - (r.top  + r.height / 2);`,
      `    gsap.to(${sel}, { x: offsetX * ${strength}, y: offsetY * ${strength}, ease: ${JSON.stringify(ease)} });`,
      `  });`,
      `  el.addEventListener("mouseleave", () => {`,
      `    gsap.to(${sel}, { x: 0, y: 0, ease: ${JSON.stringify(ease)} });`,
      `  });`,
      `});`,
      '',
    ];
  }

  if (effect === 'trail') {
    return [
      `{`,
      `  const _dots = document.querySelectorAll(${sel});`,
      `  window.addEventListener("mousemove", (e) => {`,
      `    _dots.forEach((dot, i) => {`,
      `      gsap.to(dot, { x: e.clientX, y: e.clientY, duration: i * 0.05 + 0.1, ease: ${JSON.stringify(ease)} });`,
      `    });`,
      `  });`,
      `}`,
      '',
    ];
  }

  return [`// cursor effect "${effect}" not recognized`, ''];
}

function genSVG(node, defaultEase, defaultDuration, plugins) {
  const { selector, properties } = node;
  const sel        = JSON.stringify(selector);
  const effectNode = properties['effect'];
  const effect     = effectNode ? effectNode.value : 'draw';
  const duration   = nodeToNumber(properties['duration']) ?? defaultDuration;
  const ease       = resolveEase(properties['ease'], defaultEase);
  const delayNode  = properties['delay'];

  if (effect === 'draw') {
    const extra = delayNode ? `, delay: ${nodeToNumber(delayNode)}` : '';
    return [
      `{`,
      `  const _el = document.querySelector(${sel});`,
      `  const _len = _el.getTotalLength();`,
      `  gsap.fromTo(_el,`,
      `    { strokeDashoffset: _len, strokeDasharray: _len },`,
      `    { strokeDashoffset: 0, duration: ${duration}, ease: ${JSON.stringify(ease)}${extra} }`,
      `  );`,
      `}`,
      '',
    ];
  }

  if (effect === 'morph') {
    plugins.add('MorphSVGPlugin');
    const toNode  = properties['to'];
    const toValue = toNode ? toNode.value : '';
    const gsapProps = { morphSVG: toValue, duration, ease };
    if (delayNode) gsapProps.delay = nodeToNumber(delayNode);
    return [`gsap.to(${sel}, ${serializeBlock(gsapProps)});`, ''];
  }

  if (effect === 'dash') {
    const gsapProps = { strokeDashoffset: -100, duration, ease, repeat: -1 };
    if (delayNode) gsapProps.delay = nodeToNumber(delayNode);
    return [`gsap.to(${sel}, ${serializeBlock(gsapProps)});`, ''];
  }

  return [`// svg effect "${effect}" not recognized`, ''];
}

function genSpring(node, defaultDuration) {
  const { selector, properties } = node;
  const sel       = JSON.stringify(selector);
  const anim      = buildAnimProps(properties, node.propsBlock);
  const stiffness = nodeToNumber(properties['stiffness']) ?? 100;
  const damping   = nodeToNumber(properties['damping'])   ?? 10;
  const mass      = nodeToNumber(properties['mass'])      ?? 1;

  const duration  = Math.sqrt(mass / stiffness) * 2;
  const amplitude = 1;
  const period    = damping / 100;
  const ease      = `elastic.out(${amplitude}, ${+period.toFixed(3)})`;

  const gsapProps = { ...anim, duration: +duration.toFixed(3), ease };
  return [`gsap.to(${sel}, ${serializeBlock(gsapProps)});`, ''];
}

const LOOP_PRESETS = {
  pulse:  { scale: 1.05, duration: 1,   ease: 'power1.inOut', yoyo: true },
  bounce: { y: -20,      duration: 0.6, ease: 'bounce.out',   yoyo: false },
};

function genLoop(node, defaultEase, defaultDuration) {
  const { selector, properties } = node;
  const sel        = JSON.stringify(selector);
  const effectNode = properties['effect'];
  const effect     = effectNode ? effectNode.value : null;
  const duration   = nodeToNumber(properties['duration']) ?? defaultDuration;
  const ease       = resolveEase(properties['ease'], defaultEase);
  const yoyoNode   = properties['yoyo'];

  if (effect && LOOP_PRESETS[effect]) {
    const preset     = LOOP_PRESETS[effect];
    const gsapProps  = { ...preset, duration: nodeToNumber(properties['duration']) ?? preset.duration, repeat: -1 };
    return [`gsap.to(${sel}, ${serializeBlock(gsapProps)});`, ''];
  }

  // Inline properties path
  const anim   = buildAnimProps(properties, node.propsBlock);
  const yoyo   = yoyoNode ? yoyoNode.value === true || yoyoNode.value === 'true' : false;
  const gsapProps = { ...anim, duration, ease, repeat: -1 };
  if (yoyo) gsapProps.yoyo = true;
  return [`gsap.to(${sel}, ${serializeBlock(gsapProps)});`, ''];
}

function genText(node, defaultEase, defaultDuration, plugins) {
  const { selector, properties } = node;
  const sel        = JSON.stringify(selector);
  const effectNode = properties['effect'];
  const effect     = effectNode ? effectNode.value : 'reveal';
  const duration   = nodeToNumber(properties['duration']) ?? defaultDuration;
  const ease       = resolveEase(properties['ease'], defaultEase);
  const eachNode   = properties['each'];
  const each       = eachNode ? nodeToNumber(eachNode) : 0.05;

  if (effect === 'typewriter') {
    plugins.add('TextPlugin');
    return [
      `{`,
      `  const _el = document.querySelector(${sel});`,
      `  const _text = _el.textContent;`,
      `  _el.textContent = "";`,
      `  gsap.to(_el, { duration: ${duration}, text: _text, ease: "none" });`,
      `}`,
      '',
    ];
  }

  if (effect === 'reveal') {
    const gsapProps = { duration, clipPath: 'inset(0 100% 0 0)', ease };
    return [`gsap.from(${sel}, ${serializeBlock(gsapProps)});`, ''];
  }

  if (effect === 'splitLetters') {
    plugins.add('SplitText');
    const varName   = `_split_${selector.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const gsapProps = { duration, opacity: 0, y: 20, stagger: { each }, ease };
    return [
      `const ${varName} = new SplitText(${sel}, { type: "chars" });`,
      `gsap.from(${varName}.chars, ${serializeBlock(gsapProps)});`,
      '',
    ];
  }

  if (effect === 'splitWords') {
    plugins.add('SplitText');
    const varName   = `_split_${selector.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const gsapProps = { duration, opacity: 0, y: 20, stagger: { each }, ease };
    return [
      `const ${varName} = new SplitText(${sel}, { type: "words" });`,
      `gsap.from(${varName}.words, ${serializeBlock(gsapProps)});`,
      '',
    ];
  }

  return [`// text effect "${effect}" not recognized`, ''];
}

// ─── main export ──────────────────────────────────────────────────────────────

function generate(ast) {
  let defaultEase     = EASE_ALIASES.smooth;
  let defaultDuration = 0.6;
  let reducedMotion   = false;

  const config = ast.body.find(n => n.type === 'ConfigBlock');
  if (config) {
    const p = config.properties;
    if (p['default-ease'])     defaultEase     = resolveEase(p['default-ease'], defaultEase);
    if (p['default-duration']) defaultDuration = nodeToNumber(p['default-duration']) ?? defaultDuration;
    if (p['reduced-motion'])   reducedMotion   = p['reduced-motion'].value === 'respect' || p['reduced-motion'].value === true;
  }

  const plugins    = new Set();
  const animLines  = [];
  for (const node of ast.body) {
    if (node.type === 'ConfigBlock') continue;
    if (node.type === 'AnimationBlock') {
      const { kind } = node;
      if      (kind === 'entrance' || kind === 'exit') animLines.push(...genEntranceExit(node, defaultEase, defaultDuration));
      else if (kind === 'scroll')  animLines.push(...genScroll(node, defaultEase, defaultDuration));
      else if (kind === 'hover')   animLines.push(...genHover(node, defaultEase, defaultDuration));
      else if (kind === 'click')   animLines.push(...genClick(node, defaultEase, defaultDuration));
      else if (kind === 'stagger') animLines.push(...genStagger(node, defaultEase, defaultDuration));
      else if (kind === 'threed')     animLines.push(...gen3D(node, defaultEase, defaultDuration));
      else if (kind === 'transition') animLines.push(...genTransition(node, defaultEase, defaultDuration));
      else if (kind === 'cursor')     animLines.push(...genCursor(node, defaultEase));
      else if (kind === 'svg')     animLines.push(...genSVG(node, defaultEase, defaultDuration, plugins));
      else if (kind === 'spring')  animLines.push(...genSpring(node, defaultDuration));
      else if (kind === 'loop')    animLines.push(...genLoop(node, defaultEase, defaultDuration));
      else if (kind === 'text')    animLines.push(...genText(node, defaultEase, defaultDuration, plugins));
    } else if (node.type === 'TimelineBlock') {
      animLines.push(...genTimeline(node, defaultEase, defaultDuration));
    }
  }

  const pluginLines = plugins.size > 0
    ? [`gsap.registerPlugin(${[...plugins].join(', ')});`, '']
    : [];

  let body;
  if (reducedMotion) {
    const inner = [...pluginLines, ...animLines].join('\n').replace(/^(?!$)/gm, '  ');
    body = `if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {\n${inner}\n}`;
  } else {
    body = [...pluginLines, ...animLines].join('\n');
  }

  return [
    '// Generated by Glide \u2014 https://glidelang.dev',
    '// Do not edit manually.',
    '',
    body,
  ].join('\n');
}

module.exports = { generate };
