/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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