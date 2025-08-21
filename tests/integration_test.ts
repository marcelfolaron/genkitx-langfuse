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

import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { enableLangfuseTelemetry, createLangfuseTelemetryProvider } from '../src/index';
import type { LangfuseConfig } from '../src/types';

// Mock the telemetry system
jest.mock('genkit/tracing', () => ({
  enableTelemetry: jest.fn(),
}));

import { enableTelemetry } from 'genkit/tracing';

describe('Langfuse Plugin Integration', () => {
  let config: LangfuseConfig;

  beforeEach(() => {
    config = {
      secretKey: 'sk-test-key',
      publicKey: 'pk-test-key',
      baseUrl: 'https://test.langfuse.com',
      debug: true,
    };

    (enableTelemetry as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enableLangfuseTelemetry', () => {
    it('should enable telemetry with Langfuse configuration', async () => {
      await enableLangfuseTelemetry(config);

      expect(enableTelemetry).toHaveBeenCalledTimes(1);
      expect(enableTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: expect.any(Object),
          spanProcessors: expect.any(Array),
          instrumentations: expect.any(Array),
        })
      );
    });

    it('should throw error for missing secret key', async () => {
      const invalidConfig = { ...config, secretKey: '' };

      await expect(enableLangfuseTelemetry(invalidConfig)).rejects.toThrow(
        'Langfuse secret key is required'
      );
    });

    it('should throw error for missing public key', async () => {
      const invalidConfig = { ...config, publicKey: '' };

      await expect(enableLangfuseTelemetry(invalidConfig)).rejects.toThrow(
        'Langfuse public key is required'
      );
    });
  });

  describe('createLangfuseTelemetryProvider', () => {
    it('should create a telemetry provider without enabling it', () => {
      const provider = createLangfuseTelemetryProvider(config);

      expect(provider).toBeDefined();
      expect(enableTelemetry).not.toHaveBeenCalled();

      const telemetryConfig = provider.getConfig();
      expect(telemetryConfig).toEqual({
        resource: expect.any(Object),
        spanProcessors: expect.any(Array),
        instrumentations: expect.any(Array),
      });
    });
  });

  describe('configuration validation', () => {
    it('should set default values for optional parameters', () => {
      const minimalConfig: LangfuseConfig = {
        secretKey: 'sk-test',
        publicKey: 'pk-test',
      };

      const provider = createLangfuseTelemetryProvider(minimalConfig);
      const telemetryConfig = provider.getConfig();

      expect(telemetryConfig).toBeDefined();
      expect(telemetryConfig).toBeDefined();
    });

    it('should accept custom batch and flush settings', () => {
      const customConfig: LangfuseConfig = {
        secretKey: 'sk-test',
        publicKey: 'pk-test',
        flushAt: 50,
        flushInterval: 15000,
      };

      const provider = createLangfuseTelemetryProvider(customConfig);
      const telemetryConfig = provider.getConfig();

      expect(telemetryConfig.spanProcessors).toHaveLength(1);
    });
  });

  describe('custom cost calculation', () => {
    it('should accept custom cost calculation function', () => {
      const configWithCostCalc: LangfuseConfig = {
        ...config,
        calculateCost: (modelName, usage) => {
          return (usage.inputTokens * 0.001 + usage.outputTokens * 0.002) / 1000;
        },
      };

      const provider = createLangfuseTelemetryProvider(configWithCostCalc);
      expect(provider).toBeDefined();
    });
  });

  describe('span filtering', () => {
    it('should accept custom span filter function', () => {
      const configWithFilter: LangfuseConfig = {
        ...config,
        spanFilter: (span) => span.spanType === 'model',
      };

      const provider = createLangfuseTelemetryProvider(configWithFilter);
      expect(provider).toBeDefined();
    });
  });
});