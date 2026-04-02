'use strict';

const { tokenize } = require('./lexer');
const { parse } = require('./parser');
const { generate } = require('./generator');

function compile(source) {
  const tokens = tokenize(source);
  const ast = parse(tokens);
  const code = generate(ast);
  return { tokens, ast, code };
}

module.exports = { compile };
