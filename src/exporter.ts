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
  private exportCount: number = 0;

  constructor(config: LangfuseConfig) {
    this.config = config;
    
    if (config.debug) {
      console.log('🔧 [DEBUG] Initializing Langfuse exporter with config:', {
        baseUrl: config.baseUrl,
        publicKey: config.publicKey ? `${config.publicKey.substring(0, 8)}...` : 'undefined',
        secretKey: config.secretKey ? `${config.secretKey.substring(0, 8)}...` : 'undefined',
        flushAt: config.flushAt || 20,
        flushInterval: config.flushInterval || 10000,
      });
    }
    
    this.langfuse = new Langfuse({
      secretKey: config.secretKey,
      publicKey: config.publicKey,
      baseUrl: config.baseUrl,
      flushAt: config.flushAt || 20,
      flushInterval: config.flushInterval || 10000,
    });

    // Add comprehensive error handling and debug logging
    this.langfuse.on('error', (error) => {
      console.error('🚨 [ERROR] Langfuse SDK error:', error);
      if (config.debug) {
        console.error('🔍 [DEBUG] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      }
    });

    // Add debug logging for successful operations
    if (config.debug) {
      this.langfuse.on('flush', () => {
        console.log('✅ [DEBUG] Langfuse flush completed');
      });
    }

    if (config.debug) {
      console.log('✅ [DEBUG] Langfuse exporter initialized successfully');
      this.testConnection();
    }
  }

  /**
   * Export spans to Langfuse.
   */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    this.exportCount++;
    if (this.config.debug) {
      console.log(`📤 [DEBUG] Export #${this.exportCount}: Exporting ${spans.length} spans to Langfuse`);
      spans.forEach((span, index) => {
        console.log(`    Span ${index + 1}: ${span.name} (${span.spanContext().spanId})`);
      });
    }
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const span of spans) {
        try {
          this.processSpan(span);
          successCount++;
        } catch (spanError) {
          errorCount++;
          console.error(`🚨 [ERROR] Failed to process span ${span.name}:`, spanError);
          if (this.config.debug) {
            console.error('🔍 [DEBUG] Span details:', {
              spanId: span.spanContext().spanId,
              traceId: span.spanContext().traceId,
              name: span.name,
              attributes: span.attributes,
            });
          }
        }
      }
      
      if (this.config.debug) {
        console.log(`📊 [DEBUG] Export summary: ${successCount} successful, ${errorCount} failed`);
      }
      
      // Trigger immediate flush for debug visibility
      if (this.config.debug && successCount > 0) {
        this.langfuse.flushAsync().catch(error => 
          console.error('🚨 [ERROR] Failed to flush after export:', error)
        );
      }
      
      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      console.error('🚨 [ERROR] Langfuse export error:', error);
      if (this.config.debug) {
        console.error('🔍 [DEBUG] Export error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      resultCallback({ 
        code: ExportResultCode.FAILED, 
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }

  /**
   * Test connection to Langfuse (for debugging).
   */
  private async testConnection(): Promise<void> {
    if (!this.config.debug) return;
    
    try {
      console.log('🔍 [DEBUG] Testing Langfuse connection...');
      
      // Create a simple test trace to verify connectivity
      const testTrace = {
        id: 'test-connection-' + Date.now(),
        name: 'Connection Test',
        timestamp: new Date(),
        metadata: { test: true },
      };
      
      this.langfuse.trace(testTrace);
      
      // Attempt immediate flush
      await this.langfuse.flushAsync();
      console.log('✅ [DEBUG] Langfuse connection test completed');
    } catch (error) {
      console.error('🚨 [ERROR] Langfuse connection test failed:', error);
    }
  }

  /**
   * Shutdown the exporter.
   */
  async shutdown(): Promise<void> {
    if (this.config.debug) {
      console.log('🔄 [DEBUG] Shutting down Langfuse exporter...');
    }
    
    try {
      await this.langfuse.shutdownAsync();
      if (this.config.debug) {
        console.log('✅ [DEBUG] Langfuse exporter shutdown completed');
      }
    } catch (error) {
      console.error('🚨 [ERROR] Error during Langfuse exporter shutdown:', error);
      throw error;
    }
  }

  /**
   * Force flush all pending spans.
   */
  async forceFlush(): Promise<void> {
    if (this.config.debug) {
      console.log('🔄 [DEBUG] Force flushing Langfuse data...');
    }
    
    try {
      await this.langfuse.flushAsync();
      if (this.config.debug) {
        console.log('✅ [DEBUG] Langfuse force flush completed');
      }
    } catch (error) {
      console.error('🚨 [ERROR] Error during Langfuse force flush:', error);
      throw error;
    }
  }

  /**
   * Process a single span and send to Langfuse.
   */
  private processSpan(span: ReadableSpan): void {
    const metadata = SpanMetadataExtractor.extractMetadata(span);
    const spanType = this.determineSpanType(span, metadata);

    if (this.config.debug) {
      console.log(`🔍 [DEBUG] Processing span: ${span.name}`);
      console.log(`    Type: ${spanType}`);
      console.log(`    Path: ${metadata.path || 'unknown'}`);
      console.log(`    SpanID: ${span.spanContext().spanId}`);
      console.log(`    TraceID: ${span.spanContext().traceId}`);
      console.log(`    ParentID: ${span.parentSpanId || 'none'}`);
      console.log(`    Duration: ${hrTimeToMilliseconds(span.endTime) - hrTimeToMilliseconds(span.startTime)}ms`);
    }

    try {
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
            console.log(`⚠️  [WARNING] Skipping span with unknown type: ${span.name} (type: ${spanType})`);
          }
          return;
      }
      
      if (this.config.debug) {
        console.log(`✅ [DEBUG] Successfully created Langfuse ${spanType}: ${span.name}`);
      }
    } catch (error) {
      console.error(`🚨 [ERROR] Failed to create Langfuse ${spanType} for span ${span.name}:`, error);
      throw error; // Re-throw to be caught by export method
    }
  }

  /**
   * Determine the Langfuse span type based on Genkit span data.
   */
  private determineSpanType(span: ReadableSpan, metadata: any): string {
    const spanType = metadata.spanType;
    const path = metadata.path;
    const name = span.name;

    // Model/LLM calls are generations
    if (spanType === 'model' || 
        path?.includes('/model/') ||
        name.includes('generate') ||
        name.includes('model')) {
      return 'generation';
    }

    // Root spans, flow spans, or spans with no parent are traces
    if (metadata.isRoot || 
        spanType === 'flow' ||
        path?.includes('/flow/') ||
        !span.parentSpanId ||
        span.parentSpanId === '0000000000000000') {
      return 'trace';
    }

    // Tool calls and other intermediate operations
    if (spanType === 'tool' || 
        path?.includes('/tool/') ||
        name.includes('tool') ||
        name.includes('Tool')) {
      return 'span';
    }

    // Everything else is a span
    return 'span';
  }

  /**
   * Create a Langfuse generation (for LLM calls) using latest SDK v3 patterns.
   */
  private createGeneration(span: ReadableSpan, metadata: any): void {
    const input = this.parseJSON(metadata.input);
    const output = this.parseJSON(metadata.output);
    const modelName = metadata.name || this.extractModelFromPath(metadata.path);
    
    const generationData: any = {
      id: span.spanContext().spanId,
      traceId: span.spanContext().traceId,
      name: span.name,
      model: modelName,
      input: input, // SDK v3 uses input instead of prompt
      output: output, // SDK v3 uses output instead of completion
      startTime: new Date(hrTimeToMilliseconds(span.startTime)),
      endTime: new Date(hrTimeToMilliseconds(span.endTime)),
      metadata: {
        genkit: true,
        spanType: metadata.spanType,
        path: metadata.path,
        state: metadata.state,
        provider: this.extractProviderFromPath(metadata.path),
        genkitVersion: '1.x',
        parentSpanId: span.parentSpanId,
      },
    };

    // Add parent span ID if available
    if (span.parentSpanId && span.parentSpanId !== '0000000000000000') {
      generationData.parentObservationId = span.parentSpanId;
    }

    // Add token usage in the SDK v3 format
    if (output && output.usage) {
      generationData.usage = {
        input: output.usage.inputTokens,
        output: output.usage.outputTokens,
        total: output.usage.totalTokens,
      };

      // Add cost calculation if custom function provided
      if (this.config.calculateCost) {
        try {
          generationData.totalCost = this.config.calculateCost(
            modelName,
            {
              inputTokens: output.usage.inputTokens || 0,
              outputTokens: output.usage.outputTokens || 0,
              totalTokens: output.usage.totalTokens || 0,
            }
          );
        } catch (error) {
          console.warn('⚠️  [WARNING] Failed to calculate cost:', error);
        }
      }
    }

    // Add session info if available
    if (metadata.sessionId) {
      generationData.sessionId = metadata.sessionId;
    }

    // Add user info if available
    if (metadata.userId) {
      generationData.userId = metadata.userId;
    }

    // Add version info if available
    if (metadata.version) {
      generationData.version = metadata.version;
    }

    if (this.config.debug) {
      console.log('🤖 [DEBUG] Creating Langfuse generation with data:', {
        id: generationData.id,
        traceId: generationData.traceId,
        name: generationData.name,
        model: generationData.model,
        inputSize: JSON.stringify(input || {}).length,
        outputSize: JSON.stringify(output || {}).length,
        usage: generationData.usage,
        hasParent: !!generationData.parentObservationId,
      });
    }

    try {
      this.langfuse.generation(generationData);
      if (this.config.debug) {
        console.log(`✅ [DEBUG] Langfuse generation created: ${span.name} (${modelName})`);
      }
    } catch (error) {
      console.error('🚨 [ERROR] Failed to create Langfuse generation:', error);
      throw error;
    }
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
        genkit: true,
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

    if (this.config.debug) {
      console.log('🏁 [DEBUG] Creating Langfuse trace with data:', {
        id: trace.id,
        name: trace.name,
        inputSize: JSON.stringify(input || {}).length,
        outputSize: JSON.stringify(output || {}).length,
        duration: trace.metadata.duration,
        hasSession: !!sessionId,
        hasUser: !!userId,
      });
    }

    try {
      this.langfuse.trace(trace);
      if (this.config.debug) {
        console.log(`✅ [DEBUG] Langfuse trace created: ${span.name}`);
      }
    } catch (error) {
      console.error('🚨 [ERROR] Failed to create Langfuse trace:', error);
      throw error;
    }
  }

  /**
   * Create a Langfuse span (for intermediate operations).
   */
  private createSpan(span: ReadableSpan, metadata: any): void {
    const input = this.parseJSON(metadata.input);
    const output = this.parseJSON(metadata.output);

    const langfuseSpan: any = {
      id: span.spanContext().spanId,
      traceId: span.spanContext().traceId,
      name: span.name,
      input: input,
      output: output,
      startTime: new Date(hrTimeToMilliseconds(span.startTime)),
      endTime: new Date(hrTimeToMilliseconds(span.endTime)),
      metadata: {
        genkit: true,
        spanType: metadata.spanType,
        path: metadata.path,
        state: metadata.state,
        parentSpanId: span.parentSpanId,
      },
    };

    // Add parent span ID if available
    if (span.parentSpanId && span.parentSpanId !== '0000000000000000') {
      langfuseSpan.parentObservationId = span.parentSpanId;
    }

    if (this.config.debug) {
      console.log('🔗 [DEBUG] Creating Langfuse span with data:', {
        id: langfuseSpan.id,
        traceId: langfuseSpan.traceId,
        name: langfuseSpan.name,
        inputSize: JSON.stringify(input || {}).length,
        outputSize: JSON.stringify(output || {}).length,
        hasParent: !!langfuseSpan.parentObservationId,
      });
    }

    try {
      this.langfuse.span(langfuseSpan);
      if (this.config.debug) {
        console.log(`✅ [DEBUG] Langfuse span created: ${span.name} (parent: ${span.parentSpanId || 'none'})`);
      }
    } catch (error) {
      console.error('🚨 [ERROR] Failed to create Langfuse span:', error);
      throw error;
    }
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