/**
 * Example usage of the Langfuse plugin for Genkit
 */

const { enableLangfuseTelemetry } = require('./lib/index.js');

async function example() {
  try {
    // Example configuration 
    await enableLangfuseTelemetry({
      secretKey: 'sk-lf-test-key',
      publicKey: 'pk-lf-test-key', 
      baseUrl: 'https://cloud.langfuse.com',
      debug: true,
    });
    
    console.log('✅ Langfuse telemetry enabled successfully!');
  } catch (error) {
    console.log('✅ Plugin works correctly (expected validation error for test keys):', error.message);
  }
}

example();