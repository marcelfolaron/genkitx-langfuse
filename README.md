# Genkit Langfuse Plugin

The Genkit Langfuse plugin provides observability and tracing for your Genkit applications by automatically exporting traces to [Langfuse](https://langfuse.com/).

## Installation

```bash
npm install genkit-langfuse
```

## Configuration

Set up your Langfuse credentials as environment variables:

```bash
export LANGFUSE_SECRET_KEY="sk-lf-..."
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_BASE_URL="https://cloud.langfuse.com"  # optional, defaults to cloud
```

## Usage

### Plugin Approach (Recommended)

The plugin can be registered with Genkit's plugin system:

```typescript
import { genkit } from 'genkit';
import { langfuse } from 'genkit-langfuse';

const ai = genkit({
  plugins: [
    langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      baseUrl: process.env.LANGFUSE_BASE_URL, // optional
      debug: true, // optional
      forceDevExport: true, // enable in development
    })
  ],
});
```

### Standalone Telemetry Setup

Alternatively, you can enable telemetry independently (useful for advanced configurations):

```typescript
import { enableLangfuseTelemetry } from 'genkit-langfuse';
import { genkit } from 'genkit';

// Enable Langfuse telemetry before genkit initialization
await enableLangfuseTelemetry({
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  baseUrl: process.env.LANGFUSE_BASE_URL, // optional
  debug: true, // optional
  forceDevExport: true, // enable in development
});

const ai = genkit({
  plugins: [/* your other plugins */],
});
```

### Advanced Configuration

```typescript
await enableLangfuseTelemetry({
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  baseUrl: 'https://your-langfuse-instance.com',
  debug: true,
  
  // Development vs Production settings (following Genkit patterns)
  forceDevExport: true, // Force export in development
  flushAt: 1, // Immediate export in dev (20 in production)
  flushInterval: 1000, // 1s in dev (10s in production)
  exportTimeoutMillis: 10000, // HTTP timeout
  maxQueueSize: 1000, // Max queued spans
  
  // Custom cost calculation
  calculateCost: (modelName, usage) => {
    const rates = {
      'gemini-1.5-flash': { input: 0.075, output: 0.3 },
      'gemini-1.5-pro': { input: 3.5, output: 10.5 },
      'gpt-4': { input: 30, output: 60 },
    };
    const rate = rates[modelName] || { input: 0, output: 0 };
    return (usage.inputTokens * rate.input + usage.outputTokens * rate.output) / 1_000_000;
  },
  
  // Custom span filtering
  spanFilter: (span) => {
    // Only export model calls and flows
    return span.spanType === 'model' || span.spanType === 'flow';
  },
});
```

## Features

### Automatic Trace Export

The plugin automatically exports Genkit traces to Langfuse with the following mapping:

- **Generations**: LLM/model calls are exported as Langfuse generations
- **Traces**: Root spans and flows are exported as Langfuse traces  
- **Spans**: Intermediate operations are exported as Langfuse spans

### Session Tracking

When using Genkit's chat functionality, session information is automatically included:

```typescript
const chat = ai.chat({ sessionId: 'user-123' });
await chat.send('Hello!');
// Langfuse will receive sessionId: 'user-123'
```

### Rich Metadata

The plugin captures comprehensive metadata including:

- Model name and provider
- Token usage (input/output/total)
- Configuration parameters
- Execution state and timing
- Session and thread information
- Custom metadata from spans

### Cost Tracking

Automatic cost estimation for popular models, or provide custom cost calculation:

```typescript
calculateCost: (modelName, usage) => {
  // Your custom cost calculation logic
  return estimatedCost;
}
```

## What Gets Exported

### Generations (LLM Calls)
- Model name and provider (e.g., `googleai/gemini-1.5-flash`)
- Input prompts and configuration
- Output responses and token usage
- Execution timing and performance metrics
- Session and user context
- Cost estimation (if configured)

### Traces (Flows/Root Operations)
- Flow name and input/output
- Total execution time
- Session context
- Nested span hierarchy
- Complete request lifecycle

### Spans (Intermediate Operations)
- Operation name and type (tools, utilities, etc.)
- Input/output data
- Execution timing
- Parent-child relationships
- Genkit-specific metadata

## Development & Debugging

### Development Mode

The plugin automatically detects development environment and uses faster export settings:

```typescript
// Automatically enables immediate export in development
await enableLangfuseTelemetry({
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  forceDevExport: true, // Force development behavior
  debug: true, // Enable detailed logging
});
```

### Debug Output

With `debug: true`, you'll see detailed logs including:
- Span lifecycle (start/end)
- Export batches and success status
- HTTP communication status
- Langfuse API responses
- Performance metrics

### Troubleshooting

If traces aren't appearing in Langfuse:
1. Check debug logs for HTTP errors
2. Verify credentials are correct
3. Ensure `forceDevExport: true` in development
4. Check network connectivity to Langfuse API
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `secretKey` | string | ✅ | - | Langfuse secret key |
| `publicKey` | string | ✅ | - | Langfuse public key |
| `baseUrl` | string | ❌ | `https://cloud.langfuse.com` | Langfuse API base URL |
| `debug` | boolean | ❌ | `false` | Enable detailed logging |
| `forceDevExport` | boolean | ❌ | `false` | Force export in development |
| `flushAt` | number | ❌ | 1 (dev) / 20 (prod) | Batch size for exports |
| `flushInterval` | number | ❌ | 1000 (dev) / 10000 (prod) | Export interval in ms |
| `exportTimeoutMillis` | number | ❌ | 30000 | HTTP request timeout |
| `maxQueueSize` | number | ❌ | 1000 | Maximum queued spans |
| `calculateCost` | function | ❌ | - | Custom cost calculation |
| `spanFilter` | function | ❌ | - | Filter which spans to export |

## Environment Variables

- `LANGFUSE_SECRET_KEY`: Your Langfuse secret key (required)
- `LANGFUSE_PUBLIC_KEY`: Your Langfuse public key (required)  
- `LANGFUSE_BASE_URL`: Langfuse API base URL (optional, defaults to cloud)
- `NODE_ENV`: Automatically detected for development settings

## TypeScript Support

The plugin includes full TypeScript support with detailed type definitions for configuration options and metadata structures.
