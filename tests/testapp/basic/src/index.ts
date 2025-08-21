import { gemini15Flash, googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';
import { genkit, z } from 'genkit';
import { enableLangfuseTelemetry } from 'genkit-langfuse';

// Initialize everything in an async IIFE to handle top-level await
let ai: any;
let jokeFlow: any;

(async () => {
    try {
        console.log('🔧 Initializing Genkit with Langfuse plugin...');

        // Enable Langfuse telemetry following Genkit patterns
        await enableLangfuseTelemetry({
            secretKey: 'sk-lf-499bdc6f-5fe1-442c-b356-361e2c20e24c',
            publicKey: 'pk-lf-3b682c68-092b-4957-be64-594ce0f18252',
            baseUrl: 'https://ai.telemetry.infra.leantime.io',
            debug: true,
            forceDevExport: true, // Enable development export like Firebase plugin
            exportTimeoutMillis: 10000, // 10 seconds like Firebase plugin example
        });
        
        ai = genkit({
            plugins: [
                googleAI(), 
                vertexAI()
            ],
        });

        console.log('🤖 Genkit initialized with Google AI and Vertex AI plugins!');

        const jokeSubjectGenerator = ai.defineTool(
            {
                name: 'jokeSubjectGenerator',
                description: 'Can be called to generate a subject for a joke',
            },
            async () => {
                console.log('🔧 Tool called: generating joke subject...');
                return 'banana';
            }
        );

        jokeFlow = ai.defineFlow(
            {
                name: 'jokeFlow',
                inputSchema: z.void(),
                outputSchema: z.any(),
            },
            async () => {
                console.log('📝 Starting joke creation flow...');
                
                const llmResponse = await ai.generate({
                    model: gemini15Flash,
                    config: {
                        temperature: 2,
                        version: 'gemini-1.5-flash-002',
                    },
                    output: {
                        schema: z.object({ jokeSubject: z.string() }),
                    },
                    tools: [jokeSubjectGenerator],
                    prompt: `come up with a subject to joke about (using the function provided)`,
                });
                
                console.log('✨ Generated joke subject:', llmResponse.output);
                return llmResponse.output;
            }
        );

        // Execute the flow demo
        console.log('\n🚀 Running joke flow demo with Langfuse telemetry...\n');
        
        const result = await jokeFlow();
        
        console.log('\n🎉 Flow completed successfully!');
        console.log('📊 Final result:', JSON.stringify(result, null, 2));
        
        // Wait for telemetry to flush
        console.log('\n⏱️  Waiting 3 seconds for telemetry to flush...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n✅ Demo complete! Check your Langfuse dashboard at:');
        console.log('   https://ai.telemetry.infra.leantime.io');
        console.log('\n📈 You should see traces for:');
        console.log('   - Flow execution');
        console.log('   - Tool calls (jokeSubjectGenerator)');
        console.log('   - Model generation (Gemini 1.5 Flash)');
        console.log('   - Structured output parsing');
        
    } catch (error) {
        console.error('❌ Demo failed:', error);
        process.exit(1);
    }
})();

// Export for potential external use
export { jokeFlow };
