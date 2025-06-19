#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
console.log('Dev-tools-mcp server starting (no-db version)...');
class ProjectService {
    projects = [];
    currentProject = null;
    nextId = 1;
    constructor() {
        console.log('ProjectService initialized (no database)');
    }
    async createProject(name) {
        if (!name || name.trim().length === 0) {
            return { success: false, message: 'Project name cannot be empty' };
        }
        const trimmedName = name.trim();
        const existing = this.projects.find(p => p.name === trimmedName);
        if (existing) {
            return { success: false, message: `Project '${trimmedName}' already exists` };
        }
        const project = {
            id: this.nextId++,
            name: trimmedName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        this.projects.push(project);
        return {
            success: true,
            project,
            message: `Project '${trimmedName}' created successfully`
        };
    }
    async listProjects() {
        return {
            success: true,
            projects: this.projects,
            current_project: this.currentProject,
            message: `Found ${this.projects.length} project(s)`
        };
    }
}
class DevToolsMCPServer {
    server;
    service;
    constructor(service) {
        console.log('DevToolsMCPServer constructor starting...');
        this.service = service;
        this.server = new Server({
            name: 'dev-tools-server',
            version: '0.1.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        console.log('DevToolsMCPServer constructor completed');
    }
    setupToolHandlers() {
        console.log('Setting up tool handlers...');
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'create_project',
                        description: 'Create a new project with the given name',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                name: {
                                    type: 'string',
                                    description: 'Name of the project to create',
                                },
                            },
                            required: ['name'],
                        },
                    },
                    {
                        name: 'list_projects',
                        description: 'List all projects',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: [],
                        },
                    },
                ],
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            switch (request.params.name) {
                case 'create_project':
                    return this.handleCreateProject(request.params.arguments);
                case 'list_projects':
                    return this.handleListProjects(request.params.arguments);
                default:
                    throw new Error(`Unknown tool: ${request.params.name}`);
            }
        });
    }
    async handleCreateProject(args) {
        const { name } = args;
        const result = await this.service.createProject(name);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
            isError: !result.success,
        };
    }
    async handleListProjects(args) {
        const result = await this.service.listProjects();
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
            isError: !result.success,
        };
    }
    async run() {
        console.log('Starting server transport...');
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log('Server connected successfully');
    }
}
// Main execution
async function main() {
    console.log('Main function starting...');
    const service = new ProjectService();
    const server = new DevToolsMCPServer(service);
    process.on('SIGINT', async () => {
        console.log('Shutting down...');
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('Shutting down...');
        process.exit(0);
    });
    await server.run();
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('Server error:', error);
        process.exit(1);
    });
}
