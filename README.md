# Genkit Langfuse Plugin

The Langfuse plugin provides observability and tracing for your Genkit applications by exporting traces to [Langfuse](https://langfuse.com/).

## Installation

```bash
npm install @genkit-ai/langfuse
```

## Configuration

Set up your Langfuse credentials as environment variables:

```bash
export LANGFUSE_SECRET_KEY="sk-lf-..."
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_BASE_URL="https://cloud.langfuse.com"  # optional, defaults to cloud
```

## Usage

### Basic Setup

```typescript
import { enableLangfuseTelemetry } from '@genkit-ai/langfuse';

// Enable Langfuse telemetry
await enableLangfuseTelemetry({
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  baseUrl: process.env.LANGFUSE_BASE_URL, // optional
  debug: true, // optional
});
```

### Advanced Configuration

```typescript
await enableLangfuseTelemetry({
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  baseUrl: 'https://your-langfuse-instance.com',
  debug: true,
  flushAt: 10, // batch size
  flushInterval: 5000, // flush interval in ms
  
  // Custom cost calculation
  calculateCost: (modelName, usage) => {
    const rates = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
    };
    const rate = rates[modelName] || { input: 0, output: 0 };
    return (usage.inputTokens * rate.input + usage.outputTokens * rate.output) / 1000;
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
- Model name and provider
- Input prompts and configuration
- Output responses and token usage
- Execution timing
- Session and user context

### Traces (Flows/Root Operations)
- Flow name and input/output
- Total execution time
- Session context
- Nested span hierarchy

### Spans (Intermediate Operations)
- Operation name and type
- Input/output data
- Execution timing
- Parent-child relationships

## Debugging

Enable debug mode to see what's being sent to Langfuse:

```typescript
await enableLangfuseTelemetry({
  // ... other config
  debug: true,
});
```

## Environment Variables

- `LANGFUSE_SECRET_KEY`: Your Langfuse secret key (required)
- `LANGFUSE_PUBLIC_KEY`: Your Langfuse public key (required)  
- `LANGFUSE_BASE_URL`: Langfuse API base URL (optional, defaults to cloud)

## TypeScript Support

The plugin includes full TypeScript support with detailed type definitions for configuration options and metadata structures.