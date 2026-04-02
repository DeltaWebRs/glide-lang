'use strict';

const { tokenize } = require('./lexer');
const { TOKEN } = require('./lexer');

const ANIMATION_KINDS = new Set(['entrance', 'exit', 'scroll', 'hover', 'click', 'stagger', 'text', 'loop', 'spring', 'svg', 'cursor', 'transition', 'threed']);

function parse(tokens) {
  let pos = 0;

  function peek() { return tokens[pos]; }
  function advance() { return tokens[pos++]; }

  function expect(type, value) {
    const tok = peek();
    if (tok.type !== type || (value !== undefined && tok.value !== value)) {
      throw new Error(
        `Expected ${type}${value !== undefined ? ' "' + value + '"' : ''} at ${tok.line}:${tok.col}, got ${tok.type} "${tok.value}"`
      );
    }
    return advance();
  }

  function parseValueNode(tok) {
    switch (tok.type) {
      case TOKEN.STRING:     return { type: 'String',   value: tok.value };
      case TOKEN.DURATION:   return { type: 'Duration', value: tok.value };
      case TOKEN.NUMBER:     return { type: 'Number',   value: Number(tok.value) };
      case TOKEN.BOOLEAN:    return { type: 'Boolean',  value: tok.value === 'true' };
      case TOKEN.IDENTIFIER: return { type: 'Ident',    value: tok.value };
      case TOKEN.SELECTOR:   return { type: 'Selector', value: tok.value };
      default:
        throw new Error(`Unexpected value token ${tok.type} "${tok.value}" at ${tok.line}:${tok.col}`);
    }
  }

  // Parse { key: value ... } — commas optional as separators
  function parseKVBlock() {
    const props = {};
    expect(TOKEN.LBRACE);
    while (peek().type !== TOKEN.RBRACE && peek().type !== TOKEN.EOF) {
      if (peek().type === TOKEN.COMMA) { advance(); continue; }
      const keyTok = advance();
      if (keyTok.type !== TOKEN.IDENTIFIER && keyTok.type !== TOKEN.KEYWORD) {
        throw new Error(`Expected property key at ${keyTok.line}:${keyTok.col}, got ${keyTok.type} "${keyTok.value}"`);
      }
      expect(TOKEN.COLON);
      props[keyTok.value] = parseValueNode(advance());
    }
    expect(TOKEN.RBRACE);
    return props;
  }

  function parseConfigBlock() {
    expect(TOKEN.KEYWORD, 'config');
    return { type: 'ConfigBlock', properties: parseKVBlock() };
  }

  function parseAnimationBlock(kind) {
    advance(); // consume kind keyword

    const selTok = advance();
    if (selTok.type !== TOKEN.SELECTOR && selTok.type !== TOKEN.IDENTIFIER) {
      throw new Error(`Expected selector after "${kind}" at ${selTok.line}:${selTok.col}`);
    }

    expect(TOKEN.LBRACE);
    const properties = {};
    let propsBlock = null;

    while (peek().type !== TOKEN.RBRACE && peek().type !== TOKEN.EOF) {
      if (peek().type === TOKEN.COMMA) { advance(); continue; }

      if (peek().type === TOKEN.KEYWORD && peek().value === 'properties') {
        advance(); // consume 'properties'
        propsBlock = parseKVBlock();
        continue;
      }

      const keyTok = advance();
      if (keyTok.type !== TOKEN.IDENTIFIER && keyTok.type !== TOKEN.KEYWORD) {
        throw new Error(`Expected property key at ${keyTok.line}:${keyTok.col}, got ${keyTok.type} "${keyTok.value}"`);
      }
      expect(TOKEN.COLON);
      properties[keyTok.value] = parseValueNode(advance());
    }

    expect(TOKEN.RBRACE);
    return { type: 'AnimationBlock', kind, selector: selTok.value, properties, propsBlock };
  }

  function parseTimelineBlock() {
    expect(TOKEN.KEYWORD, 'timeline');
    const nameTok = advance();
    if (nameTok.type !== TOKEN.IDENTIFIER) {
      throw new Error(`Expected timeline name at ${nameTok.line}:${nameTok.col}`);
    }

    expect(TOKEN.LBRACE);
    const steps = [];

    while (peek().type !== TOKEN.RBRACE && peek().type !== TOKEN.EOF) {
      if (peek().type === TOKEN.COMMA) { advance(); continue; }
      if (peek().type === TOKEN.KEYWORD && peek().value === 'step') {
        advance(); // consume 'step'
        steps.push(parseKVBlock());
      } else {
        advance(); // skip unexpected tokens
      }
    }

    expect(TOKEN.RBRACE);
    return { type: 'TimelineBlock', name: nameTok.value, steps };
  }

  const body = [];
  while (peek().type !== TOKEN.EOF) {
    const tok = peek();
    if (tok.type !== TOKEN.KEYWORD) { advance(); continue; }

    if (tok.value === 'config') {
      body.push(parseConfigBlock());
    } else if (ANIMATION_KINDS.has(tok.value)) {
      body.push(parseAnimationBlock(tok.value));
    } else if (tok.value === 'timeline') {
      body.push(parseTimelineBlock());
    } else {
      advance();
    }
  }

  return { type: 'Program', body };
}

module.exports = { parse };
