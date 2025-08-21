// Plugin interface based on genkit configuration structure
import { genkitPlugin, type GenkitPlugin } from 'genkit/plugin';
import { enableTelemetry } from 'genkit/tracing';
import { LangfuseTelemetryProvider } from './telemetry-provider.js';
import type { LangfuseConfig } from './types.js';

/**
 * Langfuse plugin for Genkit that enables observability and tracing.
 * 
 * @param config Langfuse configuration options
 * @returns Genkit plugin configuration
 * 
 * @example
 * ```typescript
 * import { genkit } from 'genkit';
 * import { langfuse } from 'genkit-langfuse';
 * 
 * const ai = genkit({
 *   plugins: [
 *     langfuse({
 *       secretKey: process.env.LANGFUSE_SECRET_KEY!,
 *       publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
 *       baseUrl: process.env.LANGFUSE_BASE_URL, // optional
 *       debug: true, // optional
 *     })
 *   ],
 * });
 * ```
 */
export function langfuse(config: LangfuseConfig): GenkitPlugin {
  return genkitPlugin('langfuse', async () => {
    if (config.debug) {
      console.log('🔧 [DEBUG] Initializing Langfuse plugin');
    }
    
    const telemetryProvider = new LangfuseTelemetryProvider(config);
    
    // Enable telemetry through genkit's enableTelemetry function
    await enableTelemetry(telemetryProvider.getConfig());
    
    if (config.debug) {
      console.log('✅ [DEBUG] Langfuse plugin initialization complete');
    }
  });
}

/**
 * @deprecated Use `langfuse()` plugin instead
 * Legacy function for backward compatibility.
 */
export async function enableLangfuseTelemetry(config: LangfuseConfig) {
  console.warn('enableLangfuseTelemetry is deprecated. Use langfuse() plugin instead.');
  const telemetryProvider = new LangfuseTelemetryProvider(config);
  const { enableTelemetry } = await import('genkit/tracing');
  return enableTelemetry(telemetryProvider.getConfig());
}

/**
 * Creates a Langfuse telemetry provider without enabling it globally.
 * Useful for custom telemetry setups.
 * 
 * @param config Langfuse configuration options
 * @returns LangfuseTelemetryProvider instance
 */
export function createLangfuseTelemetryProvider(config: LangfuseConfig): LangfuseTelemetryProvider {
  return new LangfuseTelemetryProvider(config);
}

// Re-export types and utilities
export type { LangfuseConfig, SpanData } from './types.js';
export { LangfuseExporter } from './exporter.js';
export { SpanMetadataExtractor } from './metadata-extractor.js';
export { LangfuseTelemetryProvider } from './telemetry-provider.js';