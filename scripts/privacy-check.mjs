#!/usr/bin/env node
/**
 * Privacy and self-containment check.
 *
 * The desk is meant to run with no network at all: no font CDN, no analytics,
 * no model API, no upload. This walks the source and, when it exists, the built
 * output, and fails on anything that would reach off the page or ship private
 * material. It is part of `npm run check` so a regression stops the build.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const SOURCE_DIRS = ['src', 'scripts'];
const SOURCE_FILES = ['index.html', 'vite.config.ts', 'playwright.config.ts', 'vitest.config.ts'];
const BUILD_DIR = 'dist';
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.html', '.json', '.svg']);

/** Patterns that would take data off the page or pull an asset onto it. */
const NETWORK_RULES = [
  { name: 'fetch()', re: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/ },
  { name: 'navigator.sendBeacon', re: /\bsendBeacon\b/ },
  { name: 'WebSocket', re: /\bnew\s+WebSocket\b/ },
  { name: 'EventSource', re: /\bnew\s+EventSource\b/ },
  { name: 'dynamic remote import', re: /\bimport\s*\(\s*["'`]https?:/ },
  { name: 'remote URL', re: /["'`(]https?:\/\//i },
  { name: 'protocol-relative URL', re: /["'(]\/\/[a-z0-9-]+\.[a-z]{2,}/i },
  { name: 'CSS @import', re: /@import\s+(url\()?["']/ },
  { name: 'remote font source', re: /@font-face|fonts\.(googleapis|gstatic)\.com/i },
  { name: 'service worker registration', re: /serviceWorker\s*\.\s*register/ },
  { name: 'form action', re: /<form[^>]*\saction=/i },
  { name: 'geolocation', re: /navigator\.geolocation/ },
  { name: 'analytics global', re: /\b(gtag|dataLayer|_paq|analytics\.track|posthog|mixpanel|amplitude)\b/i },
  { name: 'model or AI API host', re: /\b(api\.openai|api\.anthropic|generativelanguage|huggingface\.co)\b/i },
];

/**
 * Material that must never appear in a public repository or a shipped bundle.
 * The build is a fictional worked example; nothing personal belongs in it.
 */
const PRIVATE_RULES = [
  { name: 'email address', re: /[a-z0-9._%+-]+@(?!users\.noreply\.github\.com)[a-z0-9.-]+\.[a-z]{2,}/i },
  { name: 'absolute home path', re: /\/(Users|home)\/[a-z][a-z0-9._-]*\//i },
  { name: 'private-looking token', re: /\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/ },
  { name: 'AI authorship marker', re: /\b(co-authored-by:\s*claude|generated with \[?claude)\b/i },
  { name: 'phone number', re: /\+\d{1,3}[\s-]\d{3,}[\s-]\d{3,}/ },
];

/**
 * URLs that appear as text in a bundled dependency but are never requested.
 * Each one was looked at; anything not on this list fails the check.
 */
const URL_ALLOW = [
  { prefix: 'http://www.w3.org/', why: 'XML, SVG and MathML namespace identifiers - never fetched by a browser' },
  { prefix: 'https://react.dev/errors/', why: 'a documentation link printed inside a React error message' },
  { prefix: 'http://127.0.0.1:', why: 'the loopback address the local test server is reached on; never shipped' },
  { prefix: 'http://localhost:', why: 'the loopback address the local dev server is reached on; never shipped' },
];

/** Files that may name a loopback test server but never ship to a browser. */
const NOT_SHIPPED = new Set(['playwright.config.ts', 'vite.config.ts', 'vitest.config.ts']);

/** Narrow, reviewed exemptions. Each one says why it is safe. */
const ALLOWED = [
  {
    file: 'scripts/privacy-check.mjs',
    why: 'this checker necessarily contains the patterns it searches for',
  },
  {
    file: 'src/domain/presets.ts',
    rule: 'remote font source',
    why: 'names system font families only; no @font-face rule and no remote host',
  },
];

/** True when every absolute URL on the line is one of the reviewed exemptions. */
function urlsAreAllowed(line) {
  const urls = line.match(/https?:\/\/[^\s"'`)\\]+/g) ?? [];
  if (urls.length === 0) return false;
  return urls.every((url) => URL_ALLOW.some((entry) => url.startsWith(entry.prefix)));
}

/** True when the only absolute URLs on the line point at this machine. */
function loopbackOnly(line) {
  const urls = line.match(/https?:\/\/[^\s"'`)\\$]+/g) ?? [];
  return urls.length > 0 && urls.every((url) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url));
}

function isAllowed(file, rule) {
  return ALLOWED.some((entry) => entry.file === file && (entry.rule === undefined || entry.rule === rule));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function collect() {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    const full = join(root, dir);
    if (existsSync(full)) files.push(...walk(full));
  }
  for (const file of SOURCE_FILES) {
    const full = join(root, file);
    if (existsSync(full)) files.push(full);
  }
  const dist = join(root, BUILD_DIR);
  const builtScanned = existsSync(dist);
  if (builtScanned) files.push(...walk(dist));
  return { files, builtScanned };
}

function main() {
  const { files, builtScanned } = collect();
  const findings = [];
  let scanned = 0;

  for (const full of files) {
    if (!SCANNED_EXTENSIONS.has(extname(full))) continue;
    const file = relative(root, full).replaceAll('\\', '/');
    const text = readFileSync(full, 'utf8');
    scanned += 1;

    const lines = text.split('\n');
    for (const rule of [...NETWORK_RULES, ...PRIVATE_RULES]) {
      if (isAllowed(file, rule.name)) continue;
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        if (!rule.re.test(line)) continue;
        if (rule.name === 'remote URL' && urlsAreAllowed(line)) continue;
        if (rule.name === 'remote URL' && NOT_SHIPPED.has(file) && loopbackOnly(line)) continue;
        findings.push({ file, line: i + 1, rule: rule.name, text: line.trim().slice(0, 120) });
      }
    }
  }

  if (!builtScanned) {
    console.log('privacy: dist/ is not present, so only the source was scanned. Run after `npm run build`.');
  }

  if (findings.length > 0) {
    console.error(`privacy: ${findings.length} finding(s) across ${scanned} files\n`);
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line}  [${f.rule}]  ${f.text}`);
    }
    console.error('\nThe desk must not reach the network or carry private material.');
    process.exit(1);
  }

  console.log(
    `privacy: ${scanned} files scanned, no network calls, remote assets, analytics or private material found` +
      (builtScanned ? ' (source and built output)' : ' (source only)'),
  );
  for (const entry of URL_ALLOW) {
    console.log(`privacy: allowed as text only - ${entry.prefix} (${entry.why})`);
  }
}

main();
