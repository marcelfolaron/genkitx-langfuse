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

import { describe, expect, it } from '@jest/globals';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { SpanMetadataExtractor } from '../src/metadata-extractor';

// Mock ReadableSpan for testing
function createMockSpan(attributes: Record<string, any>): ReadableSpan {
  return {
    attributes,
    spanContext: () => ({ spanId: 'test-span', traceId: 'test-trace' }),
    name: 'test-span',
    startTime: [0, 0],
    endTime: [1, 0],
  } as any as ReadableSpan;
}

describe('SpanMetadataExtractor', () => {
  describe('extractMetadata', () => {
    it('should extract basic Genkit attributes', () => {
      const span = createMockSpan({
        'genkit:name': 'gpt-4',
        'genkit:path': '/model/openai/gpt-4',
        'genkit:type': 'model',
        'genkit:input': '{"messages":[{"role":"user","content":[{"text":"hello"}]}]}',
        'genkit:output': '{"message":{"role":"assistant","content":[{"text":"hi there"}]},"usage":{"inputTokens":10,"outputTokens":5}}',
        'genkit:state': 'success',
        'genkit:isRoot': 'false',
      });

      const metadata = SpanMetadataExtractor.extractMetadata(span);

      expect(metadata.name).toBe('gpt-4');
      expect(metadata.path).toBe('/model/openai/gpt-4');
      expect(metadata.spanType).toBe('model');
      expect(metadata.state).toBe('success');
      expect(metadata.isRoot).toBe(false);
      expect(metadata.input).toContain('hello');
      expect(metadata.output).toContain('hi there');
    });

    it('should extract session information', () => {
      const span = createMockSpan({
        'genkit:sessionId': 'session-123',
        'genkit:threadName': 'main',
        'genkit:userId': 'user-456',
      });

      const metadata = SpanMetadataExtractor.extractMetadata(span);

      expect(metadata.sessionId).toBe('session-123');
      expect(metadata.threadName).toBe('main');
      expect(metadata.userId).toBe('user-456');
    });

    it('should extract custom metadata', () => {
      const span = createMockSpan({
        'genkit:metadata:custom1': 'value1',
        'genkit:metadata:custom2': 'value2',
        'other:attribute': 'ignored',
      });

      const metadata = SpanMetadataExtractor.extractMetadata(span);

      expect(metadata.metadata).toEqual({
        custom1: 'value1',
        custom2: 'value2',
      });
    });
  });

  describe('isModelSpan', () => {
    it('should identify model spans by type', () => {
      const span = createMockSpan({
        'genkit:type': 'model',
      });

      expect(SpanMetadataExtractor.isModelSpan(span)).toBe(true);
    });

    it('should identify model spans by path', () => {
      const span = createMockSpan({
        'genkit:path': '/model/openai/gpt-4',
        'genkit:type': 'action',
      });

      expect(SpanMetadataExtractor.isModelSpan(span)).toBe(true);
    });

    it('should not identify non-model spans', () => {
      const span = createMockSpan({
        'genkit:type': 'flow',
        'genkit:path': '/flow/myFlow',
      });

      expect(SpanMetadataExtractor.isModelSpan(span)).toBe(false);
    });
  });

  describe('isRootSpan', () => {
    it('should identify root spans', () => {
      const span = createMockSpan({
        'genkit:isRoot': 'true',
      });

      expect(SpanMetadataExtractor.isRootSpan(span)).toBe(true);
    });

    it('should not identify non-root spans', () => {
      const span = createMockSpan({
        'genkit:isRoot': 'false',
      });

      expect(SpanMetadataExtractor.isRootSpan(span)).toBe(false);
    });
  });

  describe('extractUsage', () => {
    it('should extract usage information from output', () => {
      const span = createMockSpan({
        'genkit:output': JSON.stringify({
          message: { role: 'assistant', content: [{ text: 'hello' }] },
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
          },
        }),
      });

      const usage = SpanMetadataExtractor.extractUsage(span);

      expect(usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
    });

    it('should calculate total tokens if missing', () => {
      const span = createMockSpan({
        'genkit:output': JSON.stringify({
          usage: {
            inputTokens: 10,
            outputTokens: 5,
          },
        }),
      });

      const usage = SpanMetadataExtractor.extractUsage(span);

      expect(usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
    });

    it('should return null for invalid output', () => {
      const span = createMockSpan({
        'genkit:output': 'invalid json',
      });

      const usage = SpanMetadataExtractor.extractUsage(span);

      expect(usage).toBeNull();
    });

    it('should return null for missing usage', () => {
      const span = createMockSpan({
        'genkit:output': JSON.stringify({ message: 'hello' }),
      });

      const usage = SpanMetadataExtractor.extractUsage(span);

      expect(usage).toBeNull();
    });
  });

  describe('extractModelConfig', () => {
    it('should extract config from input', () => {
      const span = createMockSpan({
        'genkit:input': JSON.stringify({
          messages: [{ role: 'user', content: [{ text: 'hello' }] }],
          config: {
            temperature: 0.7,
            maxTokens: 100,
          },
        }),
      });

      const config = SpanMetadataExtractor.extractModelConfig(span);

      expect(config).toEqual({
        temperature: 0.7,
        maxTokens: 100,
      });
    });

    it('should return null for missing config', () => {
      const span = createMockSpan({
        'genkit:input': JSON.stringify({
          messages: [{ role: 'user', content: [{ text: 'hello' }] }],
        }),
      });

      const config = SpanMetadataExtractor.extractModelConfig(span);

      expect(config).toBeNull();
    });

    it('should return null for invalid input', () => {
      const span = createMockSpan({
        'genkit:input': 'invalid json',
      });

      const config = SpanMetadataExtractor.extractModelConfig(span);

      expect(config).toBeNull();
    });
  });
});