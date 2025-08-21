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

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ExportResultCode } from '@opentelemetry/core';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { LangfuseExporter } from '../src/exporter';
import type { LangfuseConfig } from '../src/types';

// Mock Langfuse SDK
const mockGeneration = jest.fn();
const mockTrace = jest.fn();
const mockSpan = jest.fn();
const mockShutdownAsync = jest.fn();
const mockFlushAsync = jest.fn();

jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({
    generation: mockGeneration,
    trace: mockTrace,
    span: mockSpan,
    shutdownAsync: mockShutdownAsync,
    flushAsync: mockFlushAsync,
  })),
}));

// Mock SpanMetadataExtractor
jest.mock('../src/metadata-extractor', () => ({
  SpanMetadataExtractor: {
    extractMetadata: jest.fn(),
  },
}));

import { SpanMetadataExtractor } from '../src/metadata-extractor';

// Create mock span
function createMockSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  return {
    name: 'test-span',
    spanContext: () => ({
      spanId: 'span123',
      traceId: 'trace456',
    }),
    startTime: [1000, 0],
    endTime: [2000, 0],
    attributes: {},
    ...overrides,
  } as any as ReadableSpan;
}

describe('LangfuseExporter', () => {
  let config: LangfuseConfig;
  let exporter: LangfuseExporter;

  beforeEach(() => {
    config = {
      secretKey: 'sk-test',
      publicKey: 'pk-test',
      debug: false,
    };
    exporter = new LangfuseExporter(config);
    
    // Clear mocks
    mockGeneration.mockClear();
    mockTrace.mockClear();
    mockSpan.mockClear();
    mockShutdownAsync.mockClear();
    mockFlushAsync.mockClear();
    (SpanMetadataExtractor.extractMetadata as jest.Mock).mockClear();
  });

  describe('export', () => {
    it('should successfully export spans', (done) => {
      const span = createMockSpan();
      (SpanMetadataExtractor.extractMetadata as jest.Mock).mockReturnValue({
        spanType: 'model',
        path: '/model/openai/gpt-4',
        name: 'gpt-4',
        input: '{"messages":[]}',
        output: '{"message":{}}',
      });

      exporter.export([span], (result) => {
        expect(result.code).toBe(ExportResultCode.SUCCESS);
        expect(mockGeneration).toHaveBeenCalledTimes(1);
        done();
      });
    });

    it('should handle export errors gracefully', (done) => {
      const span = createMockSpan();
      (SpanMetadataExtractor.extractMetadata as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      exporter.export([span], (result) => {
        expect(result.code).toBe(ExportResultCode.FAILED);
        expect(result.error).toBeInstanceOf(Error);
        done();
      });
    });
  });

  describe('span type determination', () => {
    it('should create generation for model spans', (done) => {
      const span = createMockSpan();
      (SpanMetadataExtractor.extractMetadata as jest.Mock).mockReturnValue({
        spanType: 'model',
        path: '/model/openai/gpt-4',
        name: 'gpt-4',
        input: '{"messages":[]}',
        output: '{"message":{},"usage":{"inputTokens":10,"outputTokens":5}}',
      });

      exporter.export([span], (result) => {
        expect(result.code).toBe(ExportResultCode.SUCCESS);
        expect(mockGeneration).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'span123',
            traceId: 'trace456',
            model: 'gpt-4',
            usage: {
              input: 10,
              output: 5,
            },
          })
        );
        done();
      });
    });

    it('should create trace for root spans', (done) => {
      const span = createMockSpan();
      (SpanMetadataExtractor.extractMetadata as jest.Mock).mockReturnValue({
        spanType: 'flow',
        isRoot: true,
        name: 'myFlow',
        input: '{"param":"value"}',
        output: '{"result":"success"}',
      });

      exporter.export([span], (result) => {
        expect(result.code).toBe(ExportResultCode.SUCCESS);
        expect(mockTrace).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'trace456',
            name: 'test-span',
          })
        );
        done();
      });
    });

    it('should create span for other types', (done) => {
      const span = createMockSpan();
      (SpanMetadataExtractor.extractMetadata as jest.Mock).mockReturnValue({
        spanType: 'action',
        name: 'myAction',
        input: '{"input":"data"}',
        output: '{"output":"result"}',
      });

      exporter.export([span], (result) => {
        expect(result.code).toBe(ExportResultCode.SUCCESS);
        expect(mockSpan).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'span123',
            traceId: 'trace456',
            name: 'test-span',
          })
        );
        done();
      });
    });
  });

  describe('session and user context', () => {
    it('should include session and user info when available', (done) => {
      const span = createMockSpan();
      (SpanMetadataExtractor.extractMetadata as jest.Mock).mockReturnValue({
        spanType: 'model',
        name: 'gpt-4',
        sessionId: 'session-123',
        userId: 'user-456',
        input: '{"messages":[]}',
        output: '{"message":{}}',
      });

      exporter.export([span], (result) => {
        expect(result.code).toBe(ExportResultCode.SUCCESS);
        expect(mockGeneration).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: 'session-123',
            userId: 'user-456',
          })
        );
        done();
      });
    });
  });

  describe('model extraction', () => {
    it('should extract model name from path', (done) => {
      const span = createMockSpan();
      (SpanMetadataExtractor.extractMetadata as jest.Mock).mockReturnValue({
        spanType: 'model',
        path: '/model/openai/gpt-4-turbo',
        input: '{"messages":[]}',
        output: '{"message":{}}',
      });

      exporter.export([span], (result) => {
        expect(result.code).toBe(ExportResultCode.SUCCESS);
        expect(mockGeneration).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-4-turbo',
            metadata: expect.objectContaining({
              provider: 'openai',
            }),
          })
        );
        done();
      });
    });
  });

  describe('shutdown and flush', () => {
    it('should shutdown Langfuse client', async () => {
      await exporter.shutdown();
      expect(mockShutdownAsync).toHaveBeenCalledTimes(1);
    });

    it('should flush Langfuse client', async () => {
      await exporter.forceFlush();
      expect(mockFlushAsync).toHaveBeenCalledTimes(1);
    });
  });
});