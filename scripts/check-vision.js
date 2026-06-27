'use strict';

/**
 * Vision smoke test. Sends a real image to the configured llama.cpp model and
 * prints the raw output + parsed metrics, so you can tell whether:
 *   - the model is reachable,
 *   - it can actually SEE the image (needs --mmproj),
 *   - and the response parses into scores.
 *
 * Usage:  node scripts/check-vision.js /path/to/face.jpg
 */
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const llm = require('../src/services/llm');
const analyzer = require('../src/services/agents/analyzer');

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/check-vision.js /path/to/image.jpg');
    process.exit(1);
  }

  console.log(`Model: ${config.llama.model} @ ${config.llama.baseUrl}`);
  if (!(await llm.health())) {
    console.error('❌ llama.cpp /health not reachable. Is the server running on :8080?');
    process.exit(1);
  }

  const buf = fs.readFileSync(path.resolve(file));
  const ext = path.extname(file).slice(1).toLowerCase() || 'jpeg';
  const dataUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buf.toString('base64')}`;

  console.log(`\nSending ${file} (${(buf.length / 1024).toFixed(0)} KB)...\n`);
  const raw = await analyzer.analyze(dataUrl);

  console.log('───────── RAW MODEL OUTPUT ─────────');
  console.log(raw || '(empty)');
  console.log('────────────────────────────────────\n');

  const parsed = analyzer.parse(raw);
  console.log('Parsed metrics:', JSON.stringify(parsed.metrics));
  console.log('Matched scores:', parsed.matchedCount, '/ 10');
  console.log('Body part:', parsed.bodyPart, '| Skin type:', parsed.skinType);
  console.log('Top concerns:', parsed.topConcerns);

  if (parsed.isEmpty) {
    console.log('\n⚠️  No scores parsed. Most likely the model cannot see the image.');
    console.log('   Restart llama.cpp WITH the multimodal projector, e.g.:');
    console.log('   llama-server -m <gemma-4-E4B>.gguf --mmproj <mmproj>.gguf \\');
    console.log(`     --alias "${config.llama.model}" --host 0.0.0.0 --port 8080`);
  } else if (Object.values(parsed.metrics).every((v) => v === 0)) {
    console.log('\n⚠️  All scores are 0. The model parsed the format but rated everything 0 —');
    console.log('   it may not be reading the image. Confirm --mmproj is loaded.');
  } else {
    console.log('\n✅ Vision analysis working.');
  }
})();
