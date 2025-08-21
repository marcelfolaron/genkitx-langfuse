import { enableTelemetry } from 'genkit/tracing';
import { LangfuseTelemetryProvider } from './telemetry-provider.js';
import type { LangfuseConfig } from './types.js';

/**
 * Enables Langfuse telemetry export for Genkit traces.
 * 
 * @param config Langfuse configuration options
 * @returns Promise that resolves when telemetry is enabled
 * 
 * @example
 * ```typescript
 * import { enableLangfuseTelemetry } from '@genkit-ai/langfuse';
 * 
 * await enableLangfuseTelemetry({
 *   secretKey: process.env.LANGFUSE_SECRET_KEY!,
 *   publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
 *   baseUrl: process.env.LANGFUSE_BASE_URL, // optional
 *   debug: true, // optional
 * });
 * ```
 */
export async function enableLangfuseTelemetry(config: LangfuseConfig) {
  const telemetryProvider = new LangfuseTelemetryProvider(config);
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