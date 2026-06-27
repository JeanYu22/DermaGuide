'use strict';

// Quick smoke test for the llama.cpp connection + configured model.
const config = require('../src/config');
const llm = require('../src/services/llm');

(async () => {
  console.log(`Pinging ${config.llama.baseUrl} (model: ${config.llama.model})...`);
  const ok = await llm.health();
  console.log(`/health reachable: ${ok}`);
  if (!ok) {
    console.log('⚠️  llama.cpp server not reachable. Start it with e.g.:');
    console.log('   llama-server -m <gemma-4-E4B>.gguf --mmproj <mmproj>.gguf \\');
    console.log(`     --alias "${config.llama.model}" --host 0.0.0.0 --port 8080`);
    process.exit(1);
  }
  try {
    const reply = await llm.chatCompletion(
      [{ role: 'user', content: 'Reply with the single word: ready' }],
      { maxTokens: 16 }
    );
    console.log('Model reply:', reply);
  } catch (err) {
    console.error('Completion failed:', err.message);
    process.exit(1);
  }
})();
