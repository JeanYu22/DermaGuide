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
  console.log('Streaming response (image encoding + prefill can take a while on CPU)…\n');

  // Stream so we can see tokens flow and measure real latency, instead of a
  // single request that looks "hung" until it finishes or times out.
  let visionOut = '';
  let firstTokenMs = null;
  const started = Date.now();
  try {
    for await (const delta of llm.streamChatCompletion(
      [llm.userMessage(analyzer.ANALYSIS_PROMPT, dataUrl)],
      { maxTokens: 512, temperature: 0.2, inactivityMs: 300000 }
    )) {
      if (firstTokenMs === null) {
        firstTokenMs = Date.now() - started;
        console.log(`(first token after ${(firstTokenMs / 1000).toFixed(1)}s)`);
      }
      visionOut += delta;
      process.stdout.write(delta);
    }
  } catch (err) {
    console.error('\n\n❌ STEP 3: vision stream errored:', err.message);
    console.error('   If this says "aborted", the model went silent past the inactivity window.');
    process.exit(1);
  }
  const totalSecs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n\n(completed in ${totalSecs}s)`);
  visionOut = visionOut.trim();

  if (!visionOut) {
    console.log('\n❌ DIAGNOSIS: text works but the image request produced NO tokens.');
    console.log('   Check the server console for errors decoding the image.');
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
