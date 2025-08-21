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
  
  // Development/production configuration following Genkit patterns
  /** Force export in development environment (default: false) */
  forceDevExport?: boolean;
  
  /** Export timeout in milliseconds (default: 30000) */
  exportTimeoutMillis?: number;
  
  /** Maximum queue size for batch processor (default: 1000) */
  maxQueueSize?: number;
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