'use strict';

/**
 * Vision smoke test + diagnostic. Isolates whether the problem is
 *   (a) the server is unreachable,
 *   (b) the model can't generate text at all,
 *   (c) the model can't SEE images (no --mmproj projector loaded).
 *
 * Usage:  node scripts/check-vision.js "C:\path\to\face.jpg"
 */
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const llm = require('../src/services/llm');
const analyzer = require('../src/services/agents/analyzer');

function content(data) {
  return data?.choices?.[0]?.message?.content?.trim() || '';
}
function finish(data) {
  return data?.choices?.[0]?.finish_reason || '(none)';
}

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/check-vision.js "C:\\path\\to\\image.jpg"');
    process.exit(1);
  }

  console.log(`Model: ${config.llama.model} @ ${config.llama.baseUrl}\n`);

  // 1) Reachability
  if (!(await llm.health())) {
    console.error('❌ STEP 1: llama.cpp /health not reachable. Is the server running on :8080?');
    process.exit(1);
  }
  console.log('✅ STEP 1: server reachable');

  // 2) Text-only generation
  let textData;
  try {
    textData = await llm.rawCompletion([{ role: 'user', content: 'Reply with exactly: hello' }], { maxTokens: 16, temperature: 0 });
  } catch (err) {
    console.error('❌ STEP 2: text completion failed:', err.message);
    process.exit(1);
  }
  const textOut = content(textData);
  if (!textOut) {
    console.error('❌ STEP 2: text reply was EMPTY (finish_reason: ' + finish(textData) + ').');
    console.error('   The model is loaded but not generating — likely a wrong/incompatible model or chat template.');
    console.error('   Full response:\n' + JSON.stringify(textData, null, 2).slice(0, 1200));
    process.exit(1);
  }
  console.log(`✅ STEP 2: text generation works → "${textOut}"`);

  // 3) Vision — probe how the image is consumed (image tokens vs base64 text).
  const buf = fs.readFileSync(path.resolve(file));
  const ext = (path.extname(file).slice(1).toLowerCase() || 'jpeg').replace('jpg', 'jpeg');
  const dataUrl = `data:image/${ext};base64,${buf.toString('base64')}`;
  const b64Chars = buf.toString('base64').length;
  console.log(`\nSending ${path.basename(file)} (${(buf.length / 1024).toFixed(0)} KB, ~${b64Chars} base64 chars)...`);
  console.log('This call can take a while; measuring how the server tokenizes the image…\n');

  const started = Date.now();
  let visionData;
  try {
    visionData = await llm.rawCompletion([llm.userMessage(analyzer.ANALYSIS_PROMPT, dataUrl)], {
      maxTokens: 96,
      temperature: 0.2,
    });
  } catch (err) {
    console.error('\n❌ STEP 3: vision request errored:', err.message);
    process.exit(1);
  }
  const totalSecs = ((Date.now() - started) / 1000).toFixed(1);

  const visionOut = content(visionData);
  const usage = visionData.usage || {};
  const promptTokens = usage.prompt_tokens ?? usage.n_prompt_tokens ?? '?';
  console.log('───────── VISION PROBE ─────────');
  console.log('prompt_tokens   :', promptTokens, '(image-as-image ≈ a few hundred; base64-as-text ≈ thousands)');
  console.log('completion_tokens:', usage.completion_tokens ?? '?');
  console.log('finish_reason   :', finish(visionData));
  console.log('time            :', totalSecs + 's');
  console.log('output          :', visionOut ? visionOut.slice(0, 200) : '(empty)');
  console.log('────────────────────────────────');

  // Interpret: if prompt_tokens dwarfs the image-token budget, the server is
  // tokenizing the base64 string as TEXT — i.e. the OpenAI image_url path is
  // not applying the vision projector in this build.
  if (typeof promptTokens === 'number' && promptTokens > 1200) {
    console.log('\n❌ DIAGNOSIS: the image was tokenized as TEXT (' + promptTokens + ' prompt tokens).');
    console.log('   Your llama.cpp /v1/chat/completions is NOT treating image_url as an image.');
    console.log('   The web UI works because it uses a different image mechanism.');
    console.log('\n   → Capture the exact request the UI sends (browser DevTools ▸ Network ▸ the');
    console.log('     POST when you submit an image) and share the endpoint + JSON shape, OR');
    console.log('     upgrade/launch llama.cpp so /v1/chat/completions supports image_url.');
    process.exit(3);
  }
  if (!visionOut) {
    console.log('\n⚠️  Image looks parsed (' + promptTokens + ' prompt tokens) but no text was produced.');
    console.log('   Try a larger max_tokens or a simpler prompt; share the server console output.');
    process.exit(2);
  }

  const parsed = analyzer.parse(visionOut);
  console.log('\nParsed metrics:', JSON.stringify(parsed.metrics));
  console.log('Matched scores:', parsed.matchedCount, '/ 10 | acne:', parsed.metrics.acne);
  if (parsed.isEmpty) {
    console.log('\n⚠️  The model replied but with no scores — check the raw output above.');
  } else if (Object.values(parsed.metrics).every((v) => v === 0)) {
    console.log('\n⚠️  All scores 0 — the model likely is not truly reading the image (confirm --mmproj).');
  } else {
    console.log('\n✅ Vision analysis is working end-to-end.');
  }
})();
