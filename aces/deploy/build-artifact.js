#!/usr/bin/env node
/* ==============================================
 * BUILD — standalone arcade  (<=50 col house)
 * ----------------------------------------------
 * Produces ONE self-contained HTML file: the
 * arcade with every module's source inlined
 * as window.__ACES_SRC__. Needed for hosts
 * whose CSP (Content Security Policy) blocks
 * fetch(), e.g. claude.ai artifacts. The
 * hosted GitHub Pages build keeps fetching
 * the real files instead — same index.html,
 * two doors.
 *
 *   node deploy/build-artifact.js [out.html]
 * ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODS = ['core', 'calculator', 'ui',
  'store', 'store-ui', 'platform',
  'version', 'view', 'parse', 'nav',
  'ledger'];

const src = {};
for (const n of MODS)
  src[n] = fs.readFileSync(
    path.join(ROOT, n + '.js'), 'utf8');
src['package.json'] = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'package.json'), 'utf8'));

// </script> inside a JS string would end the
// tag early; break the sequence. And escape
// EVERY non-ascii char: raw U+2028/2029 (and
// friends) are legal in a .js file but not
// inside an inline string literal.
const payload = JSON.stringify(src)
  .replace(/[\u007f-\uffff]/g, c =>
    '\\u' + c.charCodeAt(0)
      .toString(16).padStart(4, '0'))
  .replace(/<\/script/gi, '<\\/script');

const html = fs.readFileSync(
  path.join(ROOT, 'index.html'), 'utf8');
const inject =
  '<script>window.__ACES_SRC__=' +
  payload + '</script>\n<script>';
// function form: a plain-string replacement
// would $-expand tokens like $' inside the
// payload (a classic replace() footgun).
const out = html.replace(
  /<script>\s*\n'use strict'/,
  () => inject + "\n'use strict'");

if (!out.includes('__ACES_SRC__='))
  throw new Error('inject point not found');

const dest = process.argv[2] ||
  path.join(ROOT, 'deploy',
    'aces-arcade-standalone.html');
fs.writeFileSync(dest, out);
console.log('wrote ' + dest + ' (' +
  out.length + ' bytes)');
