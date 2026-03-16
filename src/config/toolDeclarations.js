/**
 * src/config/toolDeclarations.js
 *
 * Shared tool declarations for Gemini Function Calling.
 * Used by both the text-chat agent (agent.service.js) and
 * the live audio agent (proxy.js / liveAgent.service.js).
 */

export const TOOL_DECLARATIONS = [
    {
        name: 'search_knowledge_base',
        description:
            'Search the user\'s uploaded documents using semantic similarity. ' +
            'Use this whenever the user asks a question that might be answered by their files.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query — a concise phrase capturing what to look for.',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'search_sessions',
        description:
            'Search the user\'s past conversation history for relevant information. ' +
            'Use this when the user references something they asked about before, or wants to recall previous work.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Keywords or phrase to search in past conversations.',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'generate_image',
        description:
            'Generate an image from a text prompt using Imagen 3. ' +
            'Use this when the user explicitly asks for an image, illustration, or visual.',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'A detailed, descriptive text prompt for image generation.',
                },
            },
            required: ['prompt'],
        },
    },
    {
        name: 'render_canvas',
        description:
            'Send a rich markdown document to the user\'s Canvas workspace panel. ' +
            'Use this for all detailed explanations, code, step-by-step guides, and long content. ' +
            'Do NOT put long content directly in the chat.',
        parameters: {
            type: 'object',
            properties: {
                markdown: {
                    type: 'string',
                    description: 'Full markdown content to display in the Canvas panel.',
                },
                title: {
                    type: 'string',
                    description: 'A short title for this canvas block (shown in the panel header).',
                },
            },
            required: ['markdown'],
        },
    },
    {
        name: 'render_diagram',
        description:
            'Render a Mermaid diagram in the user\'s Canvas workspace. ' +
            'Use for flowcharts, sequence diagrams, architecture diagrams, and ERDs. ' +
            'MUST start with `graph TD` or `graph LR`. Use `A -->|Label| B` arrow syntax.',
        parameters: {
            type: 'object',
            properties: {
                mermaid_syntax: {
                    type: 'string',
                    description: 'Valid Mermaid syntax. Must start with graph TD or graph LR.',
                },
                title: {
                    type: 'string',
                    description: 'Short label for this diagram.',
                },
            },
            required: ['mermaid_syntax'],
        },
    },
    {
        name: 'render_math',
        description:
            'Render an interactive mathematical plot in the user\'s Canvas workspace. ' +
            'Use for graphs, functions, and data visualization.',
        parameters: {
            type: 'object',
            properties: {
                json: {
                    type: 'string',
                    description:
                        'JSON string with the format: ' +
                        '{"elements":[{"type":"plot-of-x","fn":"Math.sin(x)","color":"blue"}]}',
                },
                title: {
                    type: 'string',
                    description: 'Short label for this plot.',
                },
            },
            required: ['json'],
        },
    },
];
