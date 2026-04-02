#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const { compile } = require('./index');

// ─── ANSI ─────────────────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
};

const green  = s => `${c.green}${s}${c.reset}`;
const red    = s => `${c.red}${s}${c.reset}`;
const cyan   = s => `${c.cyan}${s}${c.reset}`;
const dim    = s => `${c.dim}${s}${c.reset}`;
const bold   = s => `${c.bold}${s}${c.reset}`;

// ─── helpers ──────────────────────────────────────────────────────────────────
function resolveOutputPath(inputFile) {
  const parsed = path.parse(inputFile);
  return path.join(parsed.dir, parsed.name + '.js');
}

function timestamp() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `[${hh}:${mm}:${ss}]`;
}

function runCompile(inputFile) {
  const source = fs.readFileSync(inputFile, 'utf-8');
  return compile(source);
}

// ─── compile command ──────────────────────────────────────────────────────────
function cmdCompile(args) {
  const inputFile  = args[0];
  if (!inputFile) {
    console.error(red('✗ Error: no input file specified'));
    process.exit(1);
  }

  const flags      = new Set(args.filter(a => a.startsWith('--')));
  const printFlag  = flags.has('--print');
  const astFlag    = flags.has('--ast');
  const outputFile = args.find(a => !a.startsWith('--') && a !== inputFile)
                  || resolveOutputPath(inputFile);

  let result;
  try {
    result = runCompile(inputFile);
  } catch (err) {
    console.error(red(`✗ Error: ${err.message}`));
    process.exit(1);
  }

  if (astFlag) {
    console.log(JSON.stringify(result.ast, null, 2));
    return;
  }

  if (printFlag) {
    console.log(result.code);
    return;
  }

  try {
    fs.writeFileSync(outputFile, result.code, 'utf-8');
  } catch (err) {
    console.error(red(`✗ Error: ${err.message}`));
    process.exit(1);
  }

  const lines = result.code.split('\n').length;
  console.log(
    `${green('✓')} Compiled → ${cyan(outputFile)} ${dim(`(${lines} lines)`)}`
  );
}

// ─── watch command ────────────────────────────────────────────────────────────
function cmdWatch(args) {
  const inputFile  = args[0];
  if (!inputFile) {
    console.error(red('✗ Error: no input file specified'));
    process.exit(1);
  }

  const outputFile = args.find(a => !a.startsWith('--') && a !== inputFile)
                  || resolveOutputPath(inputFile);

  console.log(`${bold('Glide')} ${dim('—')} watching ${cyan(path.basename(inputFile))}`);

  function recompile(label) {
    if (label) process.stdout.write(`${dim(timestamp())} ◆ ${dim('changed...')} `);
    try {
      const result = runCompile(inputFile);
      fs.writeFileSync(outputFile, result.code, 'utf-8');
      const lines = result.code.split('\n').length;
      console.log(
        `${green('✓')} ${cyan(path.basename(outputFile))} ${dim(`(${lines} lines)`)}`
      );
    } catch (err) {
      console.log(red(`✗ Error: ${err.message}`));
    }
  }

  // Compile immediately on start
  recompile(false);

  let debounce = null;
  fs.watch(inputFile, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => recompile(true), 50);
  });
}

// ─── dispatch ─────────────────────────────────────────────────────────────────
const [,, command, ...rest] = process.argv;

if (command === 'compile') {
  cmdCompile(rest);
} else if (command === 'watch') {
  cmdWatch(rest);
} else {
  console.error([
    `${bold('Glide')} compiler`,
    '',
    'Usage:',
    `  node src/cli.js compile <file.glide> [output.js] [--print] [--ast]`,
    `  node src/cli.js watch   <file.glide> [output.js]`,
  ].join('\n'));
  process.exit(1);
}
