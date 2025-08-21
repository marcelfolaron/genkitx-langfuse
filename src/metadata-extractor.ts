import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

/**
 * Extracts structured metadata from Genkit OpenTelemetry spans.
 */
export class SpanMetadataExtractor {
  /**
   * Extract all relevant metadata from a span.
   */
  static extractMetadata(span: ReadableSpan): ExtractedMetadata {
    const attributes = span.attributes;
    
    return {
      // Core Genkit attributes
      name: attributes['genkit:name'] as string,
      path: attributes['genkit:path'] as string,
      spanType: attributes['genkit:type'] as string,
      input: attributes['genkit:input'] as string,
      output: attributes['genkit:output'] as string,
      state: attributes['genkit:state'] as string,
      isRoot: attributes['genkit:isRoot'] === 'true' || attributes['genkit:isRoot'] === true,
      
      // Session tracking (available in chat flows)
      sessionId: attributes['genkit:sessionId'] as string,
      threadName: attributes['genkit:threadName'] as string,
      
      // User context (if available)
      userId: attributes['genkit:userId'] as string,
      
      // Additional metadata
      metadata: this.extractCustomMetadata(attributes),
    };
  }

  /**
   * Extract custom metadata from genkit:metadata:* attributes.
   */
  private static extractCustomMetadata(attributes: Record<string, any>): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(attributes)) {
      if (key.startsWith('genkit:metadata:')) {
        const metadataKey = key.replace('genkit:metadata:', '');
        metadata[metadataKey] = value;
      }
    }
    
    return metadata;
  }

  /**
   * Check if a span represents an LLM/model call.
   */
  static isModelSpan(span: ReadableSpan): boolean {
    const attributes = span.attributes;
    const spanType = attributes['genkit:type'] as string;
    const path = attributes['genkit:path'] as string;
    
    return spanType === 'model' || Boolean(path && path.includes('/model/'));
  }

  /**
   * Check if a span is a root trace span.
   */
  static isRootSpan(span: ReadableSpan): boolean {
    const attributes = span.attributes;
    return attributes['genkit:isRoot'] === 'true';
  }

  /**
   * Extract usage information from output.
   */
  static extractUsage(span: ReadableSpan): TokenUsage | null {
    const attributes = span.attributes;
    const output = attributes['genkit:output'] as string;
    
    if (!output) return null;
    
    try {
      const parsed = JSON.parse(output);
      if (parsed.usage) {
        return {
          inputTokens: parsed.usage.inputTokens || 0,
          outputTokens: parsed.usage.outputTokens || 0,
          totalTokens: parsed.usage.totalTokens || 
            (parsed.usage.inputTokens || 0) + (parsed.usage.outputTokens || 0),
        };
      }
    } catch (error) {
      // Ignore parsing errors
    }
    
    return null;
  }

  /**
   * Extract model configuration from input.
   */
  static extractModelConfig(span: ReadableSpan): Record<string, any> | null {
    const attributes = span.attributes;
    const input = attributes['genkit:input'] as string;
    
    if (!input) return null;
    
    try {
      const parsed = JSON.parse(input);
      return parsed.config || null;
    } catch (error) {
      return null;
    }
  }
}

export interface ExtractedMetadata {
  name?: string;
  path?: string;
  spanType?: string;
  input?: string;
  output?: string;
  state?: string;
  isRoot?: boolean;
  sessionId?: string;
  threadName?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}