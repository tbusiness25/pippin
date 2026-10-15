#!/usr/bin/env node
/*
 * Self-check for the children's-model network guard (src/kids/llmGuard.js).
 * Asserts the host classification for example URLs and exits non-zero on any failure.
 *   node scripts/check-kids-llm-guard.js
 */
const path = require('path');

// Test the default (block cloud) behaviour, whatever the shell has set.
delete process.env.KIDS_LLM_ALLOW_CLOUD;
const guard = require(path.join(__dirname, '..', 'src', 'kids', 'llmGuard.js'));

const cases = [
  // [url, expected allowed?]
  ['http://localhost:11434/v1', true],
  ['http://127.0.0.1:11434/v1', true],
  ['http://192.168.1.5:8080/v1', true],
  ['http://100.109.248.102:11434/v1', true],
  ['http://ollama:11434/v1', true],
  ['https://api.openai.com/v1', false],
  ['https://example.com/v1', false],
  ['https://generativelanguage.googleapis.com/v1beta/openai', false],
  ['http://10.0.0.1/v1', true],
  ['http://ascent.tail1234.ts.net:11434/v1', true],
  ['http://ascent.local:11434/v1', true],
  ['http://[::1]:11434/v1', true],
  // more edge cases
  ['http://172.20.0.5/v1', true],
  ['http://172.15.0.1/v1', false],
  ['http://172.32.0.1/v1', false],
  ['http://100.64.0.1/v1', true],
  ['http://100.128.0.1/v1', false],
  ['http://169.254.10.10/v1', true],
  ['http://8.8.8.8/v1', false],
  ['http://localhost.evil.com/v1', false],     // prefix tricks must not pass
  ['http://10.evil.com/v1', false],
  ['http://192.168.1.5.nip.io/v1', false],
  ['http://127.0.0.1.nip.io/v1', false],
  ['http://user@evil.com/v1', false],          // userinfo must not hide the real host
  ['http://localhost@evil.com/v1', false],
  ['http://box.lan/v1', true],
  ['http://svc.home.arpa/v1', true],
  ['http://svc.internal/v1', true],
  ['https://ollama.internal.example.com/v1', false],
  ['http://[::ffff:192.168.1.5]/v1', true],
  ['http://[2001:db8::1]/v1', false],
  ['http://localhost./v1', true],
  ['not a url', false],
  ['', false],
];

let failures = 0;
for (const [url, expected] of cases) {
  const got = guard.kidsLlmUrlAllowed(url);
  if (got !== expected) {
    failures++;
    console.error(`FAIL classification: ${url} -> ${got ? 'allowed' : 'blocked'} (expected ${expected ? 'allowed' : 'blocked'})`);
  }
}

// The override lets a cloud host through, and only when it is switched on.
if (!guard.kidsLlmUrlAllowed('https://api.openai.com/v1', true)) { failures++; console.error('FAIL: allowCloud=true should allow a cloud host'); }

// A blocked call throws the exact message and does not reach the network.
try {
  guard.assertKidsLlmUrl('https://api.openai.com/v1');
  failures++; console.error('FAIL: assertKidsLlmUrl did not throw for a cloud host');
} catch (e) {
  if (e.message !== guard.BLOCKED_MESSAGE) { failures++; console.error(`FAIL: wrong message: ${e.message}`); }
}
try { guard.assertKidsLlmUrl('http://ollama:11434/v1'); }
catch (e) { failures++; console.error(`FAIL: assertKidsLlmUrl threw for a local host: ${e.message}`); }

const total = cases.length + 4;
if (failures) {
  console.error(`kids-llm guard: ${failures} failure(s) out of ${total} checks`);
  process.exit(1);
}
console.log(`kids-llm guard: all ${total} checks passed`);
