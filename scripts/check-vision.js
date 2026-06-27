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
  // Reasoning-aware: fall back to reasoning_content like the real client does.
  return llm.messageText(data);
}
function finish(data) {
  return data?.choices?.[0]?.finish_reason || '(none)';
}

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/check-vision.js "C:\\path\\to\\image.jpg"');
    process.exitCode = 1;
    return;
  }

  console.log(`Model: ${config.llama.model} @ ${config.llama.baseUrl}\n`);

  // 1) Reachability
  if (!(await llm.health())) {
    console.error('❌ STEP 1: llama.cpp /health not reachable. Is the server running on :8080?');
    process.exitCode = 1;
    return;
  }
  console.log('✅ STEP 1: server reachable');

  // 2) Text-only generation
  let textData;
  try {
    textData = await llm.rawCompletion([{ role: 'user', content: 'Reply with exactly: hello' }], { maxTokens: 16, temperature: 0 });
  } catch (err) {
    console.error('❌ STEP 2: text completion failed:', err.message);
    process.exitCode = 1;
    return;
  }
  const textOut = content(textData);
  if (!textOut) {
    console.error('❌ STEP 2: text reply was EMPTY (finish_reason: ' + finish(textData) + ').');
    console.error('   The model is loaded but not generating — likely a wrong/incompatible model or chat template.');
    console.error('   Full response:\n' + JSON.stringify(textData, null, 2).slice(0, 1200));
    process.exitCode = 1;
    return;
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
      maxTokens: 1024,
      temperature: 0.4,
    });
  } catch (err) {
    console.error('\n❌ STEP 3: vision request errored:', err.message);
    process.exitCode = 1;
    return;
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

  // prompt_tokens ≈ 318 → the image IS parsed as an image (not base64 text).
  if (typeof promptTokens === 'number' && promptTokens > 1200) {
    console.log('\n❌ The image was tokenized as TEXT (' + promptTokens + ' prompt tokens) — image_url not applied.');
    process.exitCode = 3;
    return;
  }

  if (!visionOut) {
    // Image parsed + tokens generated but empty text. Show the raw tokens and
    // compare against a simple UI-style prompt to localise the cause.
    console.log('\n⚠️  Image parsed (' + promptTokens + ' prompt tokens) and ' + (usage.completion_tokens ?? '?') +
      ' tokens were generated, but the text is empty.');
    console.log('\nRaw message object:\n' + JSON.stringify(visionData.choices?.[0]?.message));

    console.log('\n— Comparison A: simple UI-style prompt —');
    const simple = await llm.rawCompletion(
      [llm.userMessage('Describe the skin condition you see in this photo in 1-2 sentences.', dataUrl)],
      { maxTokens: 160, temperature: 0.7 }
    );
    const simpleOut = content(simple);
    console.log('output:', simpleOut ? simpleOut.slice(0, 300) : '(empty)');

    console.log('\n— Comparison B: structured prompt, image listed FIRST —');
    const imageFirst = {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: analyzer.ANALYSIS_PROMPT },
      ],
    };
    const bData = await llm.rawCompletion([imageFirst], { maxTokens: 256, temperature: 0.4 });
    const bOut = content(bData);
    console.log('output:', bOut ? bOut.slice(0, 300) : '(empty)');

    console.log('\n──────── VERDICT ────────');
    if (simpleOut || bOut) {
      console.log('A simpler prompt and/or image-first ordering DOES produce text →');
      console.log('the structured prompt was the problem. Tell Claude this and it will fix the analyzer.');
    } else {
      console.log('Even a simple prompt returns empty though tokens are generated →');
      console.log('likely an image-token/chat-template quirk in this build. Share the raw message object above.');
    }
    process.exitCode = 2;
    return;
  }

  const parsed = analyzer.parse(visionOut);
  console.log('\nParsed metrics:', JSON.stringify(parsed.metrics));
  console.log('Matched scores:', parsed.matchedCount, '/ 10 | acne:', parsed.metrics.acne);
  if (parsed.isEmpty) {
    console.log('\n⚠️  The model replied but with no scores — check the raw output above.');
  } else {
    console.log('\n✅ Vision analysis is working end-to-end.');
  }
})().catch((err) => {
  console.error('Unexpected error:', err);
  process.exitCode = 1;
});
