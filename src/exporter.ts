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

import { hrTimeToMilliseconds } from '@opentelemetry/core';
import type {
  ReadableSpan,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { Langfuse } from 'langfuse';
import type { LangfuseConfig } from './types.js';
import { SpanMetadataExtractor } from './metadata-extractor.js';

/**
 * Langfuse OpenTelemetry span exporter that sends Genkit traces to Langfuse.
 */
export class LangfuseExporter implements SpanExporter {
  private langfuse: Langfuse;
  private config: LangfuseConfig;

  constructor(config: LangfuseConfig) {
    this.config = config;
    this.langfuse = new Langfuse({
      secretKey: config.secretKey,
      publicKey: config.publicKey,
      baseUrl: config.baseUrl,
      flushAt: config.flushAt || 20,
      flushInterval: config.flushInterval || 10000,
    });
  }

  /**
   * Export spans to Langfuse.
   */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    try {
      for (const span of spans) {
        this.processSpan(span);
      }
      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      console.error('Langfuse export error:', error);
      resultCallback({ 
        code: ExportResultCode.FAILED, 
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }

  /**
   * Shutdown the exporter.
   */
  async shutdown(): Promise<void> {
    await this.langfuse.shutdownAsync();
  }

  /**
   * Force flush all pending spans.
   */
  async forceFlush(): Promise<void> {
    await this.langfuse.flushAsync();
  }

  /**
   * Process a single span and send to Langfuse.
   */
  private processSpan(span: ReadableSpan): void {
    const metadata = SpanMetadataExtractor.extractMetadata(span);
    const spanType = this.determineSpanType(span, metadata);

    switch (spanType) {
      case 'generation':
        this.createGeneration(span, metadata);
        break;
      case 'trace':
        this.createTrace(span, metadata);
        break;
      case 'span':
        this.createSpan(span, metadata);
        break;
      default:
        if (this.config.debug) {
          console.log('Skipping span with unknown type:', span.name);
        }
    }
  }

  /**
   * Determine the Langfuse span type based on Genkit span data.
   */
  private determineSpanType(span: ReadableSpan, metadata: any): string {
    const spanType = metadata.spanType;
    const path = metadata.path;

    // Model/LLM calls are generations
    if (spanType === 'model' || path?.includes('/model/')) {
      return 'generation';
    }

    // Root spans or flow spans are traces
    if (metadata.isRoot || spanType === 'flow') {
      return 'trace';
    }

    // Everything else is a span
    return 'span';
  }

  /**
   * Create a Langfuse generation (for LLM calls).
   */
  private createGeneration(span: ReadableSpan, metadata: any): void {
    const input = this.parseJSON(metadata.input);
    const output = this.parseJSON(metadata.output);
    const modelName = metadata.name || this.extractModelFromPath(metadata.path);
    
    const generation = {
      id: span.spanContext().spanId,
      traceId: span.spanContext().traceId,
      name: span.name,
      model: modelName,
      input: input,
      output: output,
      startTime: new Date(hrTimeToMilliseconds(span.startTime)),
      endTime: new Date(hrTimeToMilliseconds(span.endTime)),
      metadata: {
        spanType: metadata.spanType,
        path: metadata.path,
        state: metadata.state,
        provider: this.extractProviderFromPath(metadata.path),
      },
    };

    // Add usage if available
    if (output && output.usage) {
      (generation as any).usage = {
        input: output.usage.inputTokens,
        output: output.usage.outputTokens,
        total: output.usage.totalTokens,
      };
    }

    // Add session info if available
    const sessionId = metadata.sessionId;
    if (sessionId) {
      (generation as any).sessionId = sessionId;
    }

    // Add user info if available
    const userId = metadata.userId;
    if (userId) {
      (generation as any).userId = userId;
    }

    this.langfuse.generation(generation);
  }

  /**
   * Create a Langfuse trace (for root spans/flows).
   */
  private createTrace(span: ReadableSpan, metadata: any): void {
    const input = this.parseJSON(metadata.input);
    const output = this.parseJSON(metadata.output);

    const trace = {
      id: span.spanContext().traceId,
      name: span.name,
      input: input,
      output: output,
      timestamp: new Date(hrTimeToMilliseconds(span.startTime)),
      metadata: {
        spanType: metadata.spanType,
        path: metadata.path,
        state: metadata.state,
        duration: hrTimeToMilliseconds(span.endTime) - hrTimeToMilliseconds(span.startTime),
      },
    };

    // Add session info if available
    const sessionId = metadata.sessionId;
    if (sessionId) {
      (trace as any).sessionId = sessionId;
    }

    // Add user info if available
    const userId = metadata.userId;
    if (userId) {
      (trace as any).userId = userId;
    }

    this.langfuse.trace(trace);
  }

  /**
   * Create a Langfuse span (for intermediate operations).
   */
  private createSpan(span: ReadableSpan, metadata: any): void {
    const input = this.parseJSON(metadata.input);
    const output = this.parseJSON(metadata.output);

    const langfuseSpan = {
      id: span.spanContext().spanId,
      traceId: span.spanContext().traceId,
      name: span.name,
      input: input,
      output: output,
      startTime: new Date(hrTimeToMilliseconds(span.startTime)),
      endTime: new Date(hrTimeToMilliseconds(span.endTime)),
      metadata: {
        spanType: metadata.spanType,
        path: metadata.path,
        state: metadata.state,
      },
    };

    this.langfuse.span(langfuseSpan);
  }

  /**
   * Extract model name from Genkit path.
   */
  private extractModelFromPath(path?: string): string {
    if (!path) return 'unknown';
    const match = path.match(/\/model\/([^\/]+)\/([^\/]+)/);
    return match ? match[2] : 'unknown';
  }

  /**
   * Extract provider name from Genkit path.
   */
  private extractProviderFromPath(path?: string): string {
    if (!path) return 'unknown';
    const match = path.match(/\/model\/([^\/]+)\//);
    return match ? match[1] : 'unknown';
  }

  /**
   * Safely parse JSON string.
   */
  private parseJSON(jsonString?: string): any {
    if (!jsonString || typeof jsonString !== 'string') {
      return jsonString;
    }
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      return jsonString;
    }
  }
}