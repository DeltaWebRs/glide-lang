'use strict';

const { compile } = require('../src/index');
const fs   = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'examples/basic.glide'), 'utf-8');
const { tokens, ast, code } = compile(source);

console.log('Tokens:', tokens.length);
console.log('AST nodes:', ast.body.length);
console.log('Output lines:', code.split('\n').length);
console.log('\n--- Generated GSAP ---\n');
console.log(code);
