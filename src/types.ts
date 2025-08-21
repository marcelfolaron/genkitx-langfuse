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

/**
 * Configuration options for the Langfuse plugin.
 */
export interface LangfuseConfig {
  /** Langfuse secret key for authentication */
  secretKey: string;
  
  /** Langfuse public key for authentication */
  publicKey: string;
  
  /** Langfuse API base URL (defaults to cloud) */
  baseUrl?: string;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Number of events to batch before sending (default: 20) */
  flushAt?: number;
  
  /** Interval in ms to flush events (default: 10000) */
  flushInterval?: number;
  
  /** Custom cost calculation function */
  calculateCost?: (modelName: string, usage: TokenUsage) => number;
  
  /** Filter function to include/exclude spans */
  spanFilter?: (span: SpanData) => boolean;
}

/**
 * Token usage information.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Span data for filtering.
 */
export interface SpanData {
  name: string;
  spanType?: string;
  path?: string;
  isRoot?: boolean;
}