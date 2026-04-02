'use strict';

const KEYWORDS = new Set([
  'config', 'entrance', 'exit', 'scroll', 'hover',
  'click', 'stagger', 'timeline', 'step', 'properties', 'text', 'loop', 'spring', 'svg', 'cursor', 'transition', 'threed',
  'morph', 'physics'
]);

const TOKEN = {
  KEYWORD:    'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  SELECTOR:   'SELECTOR',
  DURATION:   'DURATION',
  NUMBER:     'NUMBER',
  STRING:     'STRING',
  BOOLEAN:    'BOOLEAN',
  COLON:      'COLON',
  COMMA:      'COMMA',
  LBRACE:     'LBRACE',
  RBRACE:     'RBRACE',
  EOF:        'EOF',
};

class Token {
  constructor(type, value, line, col) {
    this.type  = type;
    this.value = value;
    this.line  = line;
    this.col   = col;
  }
}

function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;

  function col() { return i - lineStart + 1; }

  function peek(offset = 0) { return source[i + offset]; }

  function skipLineComment() {
    while (i < source.length && source[i] !== '\n') i++;
  }

  while (i < source.length) {
    const startCol = col();
    const ch = source[i];

    // Newline
    if (ch === '\n') { line++; lineStart = ++i; continue; }

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }

    // Line comments: // or # (but not CSS-style selectors)
    if (ch === '/' && peek(1) === '/') { skipLineComment(); continue; }
    if (ch === '#' && (i === 0 || /\s/.test(source[i - 1]))) {
      // Could be a comment (#) or a selector (#id) — treat as comment only
      // when preceded by whitespace or start of file AND followed by a space
      // or end-of-line, but treat as selector when followed by word chars.
      if (i + 1 >= source.length || /[\s\/]/.test(source[i + 1])) {
        skipLineComment();
        continue;
      }
    }

    // String
    if (ch === '"') {
      i++;
      let str = '';
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') { i++; str += source[i] || ''; }
        else str += source[i];
        i++;
      }
      i++; // closing "
      tokens.push(new Token(TOKEN.STRING, str, line, startCol));
      continue;
    }

    // Single-char tokens
    if (ch === ':') { tokens.push(new Token(TOKEN.COLON,  ':', line, startCol)); i++; continue; }
    if (ch === ',') { tokens.push(new Token(TOKEN.COMMA,  ',', line, startCol)); i++; continue; }
    if (ch === '{') { tokens.push(new Token(TOKEN.LBRACE, '{', line, startCol)); i++; continue; }
    if (ch === '}') { tokens.push(new Token(TOKEN.RBRACE, '}', line, startCol)); i++; continue; }

    // Selector: starts with . # [
    if (ch === '.' || ch === '[' || (ch === '#' && i + 1 < source.length && /\w/.test(source[i + 1]))) {
      let sel = ch; i++;
      if (ch === '[') {
        while (i < source.length && source[i] !== ']') { sel += source[i++]; }
        if (i < source.length) { sel += source[i++]; } // closing ]
      } else {
        while (i < source.length && /[\w-]/.test(source[i])) { sel += source[i++]; }
      }
      tokens.push(new Token(TOKEN.SELECTOR, sel, line, startCol));
      continue;
    }

    // Special keyword: "3d" in .glide syntax maps to KEYWORD "threed"
    if (ch === '3' && peek(1) === 'd' && (i + 2 >= source.length || !/\w/.test(source[i + 2]))) {
      tokens.push(new Token(TOKEN.KEYWORD, 'threed', line, startCol));
      i += 2;
      continue;
    }

    // Number (possibly negative) or Duration
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      // Make sure '-' is actually starting a number
      if (ch === '-' && (i + 1 >= source.length || !/[0-9.]/.test(source[i + 1]))) {
        // lone minus — treat as unknown, skip
        i++; continue;
      }
      let num = '';
      if (ch === '-') { num += '-'; i++; }
      while (i < source.length && (source[i] >= '0' && source[i] <= '9')) { num += source[i++]; }
      if (i < source.length && source[i] === '.') {
        num += '.'; i++;
        while (i < source.length && source[i] >= '0' && source[i] <= '9') { num += source[i++]; }
      }
      // Duration: number immediately followed by 's'
      if (i < source.length && source[i] === 's' && (i + 1 >= source.length || !/\w/.test(source[i + 1]))) {
        num += 's'; i++;
        tokens.push(new Token(TOKEN.DURATION, num, line, startCol));
      } else {
        tokens.push(new Token(TOKEN.NUMBER, num, line, startCol));
      }
      continue;
    }

    // Word: keyword, boolean, or identifier
    if (/[a-zA-Z_]/.test(ch)) {
      let word = '';
      while (i < source.length && /[\w-]/.test(source[i])) { word += source[i++]; }
      if (word === 'true' || word === 'false') {
        tokens.push(new Token(TOKEN.BOOLEAN, word, line, startCol));
      } else if (KEYWORDS.has(word)) {
        tokens.push(new Token(TOKEN.KEYWORD, word, line, startCol));
      } else {
        tokens.push(new Token(TOKEN.IDENTIFIER, word, line, startCol));
      }
      continue;
    }

    // Unknown character — skip
    i++;
  }

  tokens.push(new Token(TOKEN.EOF, '', line, col()));
  return tokens;
}

module.exports = { tokenize, TOKEN, Token };
