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

  // 3) Vision
  const buf = fs.readFileSync(path.resolve(file));
  const ext = (path.extname(file).slice(1).toLowerCase() || 'jpeg').replace('jpg', 'jpeg');
  const dataUrl = `data:image/${ext};base64,${buf.toString('base64')}`;
  console.log(`\nSending ${path.basename(file)} (${(buf.length / 1024).toFixed(0)} KB)...`);

  let visionData;
  try {
    visionData = await llm.rawCompletion([llm.userMessage(analyzer.ANALYSIS_PROMPT, dataUrl)], { maxTokens: 512, temperature: 0.2 });
  } catch (err) {
    console.error('\n❌ STEP 3: vision request errored:', err.message);
    console.error('   A 4xx/5xx here usually means this build/model does not accept images at all.');
    process.exit(1);
  }

  const visionOut = content(visionData);
  console.log('\n───────── RAW VISION OUTPUT ─────────');
  console.log(visionOut || '(empty)');
  console.log('finish_reason:', finish(visionData));
  console.log('─────────────────────────────────────');

  if (!visionOut) {
    console.log('\n❌ DIAGNOSIS: Text works but the image request returned NOTHING.');
    console.log('   → The server is running TEXT-ONLY. It has no multimodal projector loaded,');
    console.log('     so it cannot see the photo. You must start it WITH --mmproj.');
    console.log('\n   Full server response:\n' + JSON.stringify(visionData, null, 2).slice(0, 1000));
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
