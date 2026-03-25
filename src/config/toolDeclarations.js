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
    {
        name: 'get_user_profile',
        description: 'Read the user\'s database profile including their name, email, role, and current bio. Use this to get to know who you are talking to.',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'update_user_bio',
        description: 'Update the user\'s bio in the database. Use this autonomously when you learn something permanent about the user (e.g., their job, age, or preferred name) to store it in their profile.',
        parameters: {
            type: 'object',
            properties: {
                bio: { type: 'string', description: 'The completely rewritten bio for the user. Do not just send the diff, send the entire updated bio.' },
            },
            required: ['bio'],
        },
    },
    {
        name: 'list_user_documents',
        description: 'Get an exact SQL list of all the files the user has uploaded to their knowledge base, including file names and IDs.',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'list_recent_sessions',
        description: 'Get a list of the user\'s recent conversation sessions, including the session ID, title, and last active time.',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'read_session_transcript',
        description: 'Read the exact, verbatim message transcript of a specific past conversation session.',
        parameters: {
            type: 'object',
            properties: {
                sessionId: { type: 'string', description: 'The UUID of the session to read.' },
            },
            required: ['sessionId'],
        },
    },
    {
        name: 'remember_fact',
        description: 'Save a permanent, long-term memory about the user into your Memory database. Use this instead of update_user_bio for granular facts like "User owns a Dog named Rex" or "User prefers dark mode".',
        parameters: {
            type: 'object',
            properties: {
                fact: { type: 'string', description: 'The specific fact to remember.' },
                category: { type: 'string', description: 'General category of the fact (e.g., "preferences", "personal", "work").' },
            },
            required: ['fact', 'category'],
        },
    },
    {
        name: 'recall_facts',
        description: 'Search your permanent Memory database for long-term facts you previously saved about the user.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search term to find relevant facts.' },
            },
            required: ['query'],
        },
    },
    {
        name: 'manage_tasks',
        description: 'Create, complete, or list tasks in the user\'s personal to-do list database.',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', description: 'Must be "list", "create", or "complete".' },
                title: { type: 'string', description: 'The task description (required for "create").' },
                taskId: { type: 'string', description: 'The ID of the task to complete (required for "complete").' },
            },
            required: ['action'],
        },
    },
    {
        name: 'render_quiz',
        description: 'Render an interactive multiple-choice quiz in the user\'s Canvas workspace. Use this to test their knowledge.',
        parameters: {
            type: 'object',
            properties: {
                quizData: {
                    type: 'object',
                    description: 'The complete interactive quiz structure.',
                    properties: {
                        title: { type: 'string', description: 'The title of the quiz.' },
                        description: { type: 'string', description: 'Short description of the quiz.' },
                        questions: {
                            type: 'array',
                            description: 'A list of 3-5 multiple choice questions.',
                            items: {
                                type: 'object',
                                properties: {
                                    question: { type: 'string', description: 'The question text.' },
                                    options: {
                                        type: 'array',
                                        items: { type: 'string' },
                                        description: 'Exactly 4 plausible options.'
                                    },
                                    answer: { type: 'string', description: 'The exact string of the correct option.' },
                                    explanation: { type: 'string', description: 'Why this answer is correct.' }
                                },
                                required: ['question', 'options', 'answer', 'explanation']
                            }
                        }
                    },
                    required: ['title', 'description', 'questions']
                }
            },
            required: ['quizData']
        }
    }
];
