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
    const config = {
      resource: this.createResource(),
      spanProcessors: [this.createSpanProcessor()], // Back to plural like official plugin
      instrumentations: [],
    };
    
    if (this.config.debug) {
      console.log('🔧 [DEBUG] Telemetry config created:', {
        resourceAttributes: config.resource.attributes,
        spanProcessorCount: config.spanProcessors.length,
        instrumentationCount: config.instrumentations.length,
      });
    }
    
    return config;
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
    
    // Configure for development vs production following Genkit patterns
    const isDevelopment = this.config.forceDevExport || process.env.NODE_ENV === 'development';
    
    const processor = new BatchSpanProcessor(this.exporter, {
      maxExportBatchSize: isDevelopment ? (this.config.flushAt || 1) : (this.config.flushAt || 20),
      scheduledDelayMillis: isDevelopment ? (this.config.flushInterval || 1000) : (this.config.flushInterval || 10000),
      exportTimeoutMillis: this.config.exportTimeoutMillis || 30000,
      maxQueueSize: this.config.maxQueueSize || 1000,
    });
    
    if (this.config.debug) {
      console.log('🔧 [DEBUG] BatchSpanProcessor created with config:', {
        isDevelopment,
        maxExportBatchSize: processor['_maxExportBatchSize'] || (isDevelopment ? 1 : 20),
        scheduledDelayMillis: processor['_scheduledDelayMillis'] || (isDevelopment ? 1000 : 10000),
        exportTimeoutMillis: this.config.exportTimeoutMillis || 30000,
        maxQueueSize: this.config.maxQueueSize || 1000,
      });
      
      // Wrap processor methods to debug span activity
      const originalOnStart = processor.onStart;
      const originalOnEnd = processor.onEnd;
      
      processor.onStart = function(span, parentContext) {
        console.log(`🔥 [DEBUG] Span started: ${span.name} (${span.spanContext().spanId})`);
        return originalOnStart.call(this, span, parentContext);
      };
      
      processor.onEnd = function(span) {
        console.log(`🏁 [DEBUG] Span ended: ${span.name} (${span.spanContext().spanId})`);
        return originalOnEnd.call(this, span);
      };
    }
    
    return processor;
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

    // Set defaults following Genkit patterns
    const isDevelopment = this.config.forceDevExport || process.env.NODE_ENV === 'development';
    
    this.config.baseUrl = this.config.baseUrl || 'https://cloud.langfuse.com';
    this.config.debug = this.config.debug || false;
    
    // Use development-friendly defaults when appropriate
    if (isDevelopment) {
      this.config.flushAt = this.config.flushAt ?? 1; // Immediate export in dev
      this.config.flushInterval = this.config.flushInterval ?? 1000; // 1 second in dev
    } else {
      this.config.flushAt = this.config.flushAt ?? 20; // Batch in production
      this.config.flushInterval = this.config.flushInterval ?? 10000; // 10 seconds in production
    }
    
    this.config.exportTimeoutMillis = this.config.exportTimeoutMillis ?? 30000;
    this.config.maxQueueSize = this.config.maxQueueSize ?? 1000;
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