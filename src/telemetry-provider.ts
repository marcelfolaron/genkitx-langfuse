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

import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { TelemetryConfig } from 'genkit';
import { LangfuseExporter } from './exporter.js';
import type { LangfuseConfig } from './types.js';

/**
 * Telemetry provider that configures OpenTelemetry to export to Langfuse.
 */
export class LangfuseTelemetryProvider {
  private config: LangfuseConfig;
  private exporter?: LangfuseExporter;

  constructor(config: LangfuseConfig) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * Get the telemetry configuration for Genkit.
   */
  getConfig(): TelemetryConfig {
    return {
      resource: this.createResource(),
      spanProcessors: [this.createSpanProcessor()],
      instrumentations: [],
    };
  }

  /**
   * Shutdown the telemetry provider.
   */
  async shutdown(): Promise<void> {
    if (this.exporter) {
      await this.exporter.shutdown();
    }
  }

  /**
   * Force flush all pending telemetry data.
   */
  async flush(): Promise<void> {
    if (this.exporter) {
      await this.exporter.forceFlush();
    }
  }

  /**
   * Create OpenTelemetry resource with Langfuse-specific attributes.
   */
  private createResource(): Resource {
    return new Resource({
      'service.name': 'genkit-langfuse',
      'service.version': '1.0.0',
      'genkit.plugin': '@genkit-ai/langfuse',
      'langfuse.version': this.getLangfuseVersion(),
    });
  }

  /**
   * Create the span processor with Langfuse exporter.
   */
  private createSpanProcessor(): BatchSpanProcessor {
    this.exporter = new LangfuseExporter(this.config);
    
    return new BatchSpanProcessor(this.exporter, {
      maxExportBatchSize: this.config.flushAt || 20,
      scheduledDelayMillis: this.config.flushInterval || 10000,
      exportTimeoutMillis: 30000,
      maxQueueSize: 1000,
    });
  }

  /**
   * Validate the configuration.
   */
  private validateConfig(): void {
    if (!this.config.secretKey) {
      throw new Error('Langfuse secret key is required');
    }
    if (!this.config.publicKey) {
      throw new Error('Langfuse public key is required');
    }

    // Set defaults
    this.config.baseUrl = this.config.baseUrl || 'https://cloud.langfuse.com';
    this.config.debug = this.config.debug || false;
    this.config.flushAt = this.config.flushAt || 20;
    this.config.flushInterval = this.config.flushInterval || 10000;
  }

  /**
   * Get the Langfuse SDK version.
   */
  private getLangfuseVersion(): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const packageJson = require('langfuse/package.json');
      return packageJson.version;
    } catch (error) {
      return 'unknown';
    }
  }
}