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

  const animLines = [];
  for (const node of ast.body) {
    if (node.type === 'ConfigBlock') continue;
    if (node.type === 'AnimationBlock') {
      const { kind } = node;
      if      (kind === 'entrance' || kind === 'exit') animLines.push(...genEntranceExit(node, defaultEase, defaultDuration));
      else if (kind === 'scroll')  animLines.push(...genScroll(node, defaultEase, defaultDuration));
      else if (kind === 'hover')   animLines.push(...genHover(node, defaultEase, defaultDuration));
      else if (kind === 'click')   animLines.push(...genClick(node, defaultEase, defaultDuration));
      else if (kind === 'stagger') animLines.push(...genStagger(node, defaultEase, defaultDuration));
    } else if (node.type === 'TimelineBlock') {
      animLines.push(...genTimeline(node, defaultEase, defaultDuration));
    }
  }

  let body;
  if (reducedMotion) {
    const inner = animLines.join('\n').replace(/^(?!$)/gm, '  ');
    body = `if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {\n${inner}\n}`;
  } else {
    body = animLines.join('\n');
  }

  return [
    '// Generated by Glide \u2014 https://glidelang.dev',
    '// Do not edit manually.',
    '',
    body,
  ].join('\n');
}

module.exports = { generate };
