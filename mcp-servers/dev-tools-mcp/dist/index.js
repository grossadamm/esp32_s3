#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
const sqlite = sqlite3.verbose();
class DatabaseWrapper {
    db;
    all;
    get;
    run;
    constructor(filename) {
        console.log(`Attempting to open database: ${filename}`);
        this.db = new sqlite.Database(filename, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error(`Database connection error: ${err.message}`);
                console.error(`Full error:`, err);
            }
            else {
                console.log(`Successfully connected to database: ${filename}`);
            }
        });
        this.all = promisify(this.db.all.bind(this.db));
        this.get = promisify(this.db.get.bind(this.db));
        this.run = promisify(this.db.run.bind(this.db));
    }
    close() {
        this.db.close();
    }
}
class ProjectService {
    db;
    currentProject = null;
    constructor() {
        console.log(`Dev-tools-mcp starting from: ${process.cwd()}`);
        const dataDir = path.join(process.cwd(), '..', 'data');
        const dbPath = path.join(dataDir, 'projects.db');
        console.log(`Data directory path: ${dataDir}`);
        console.log(`Database path: ${dbPath}`);
        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`Created data directory: ${dataDir}`);
        }
        else {
            console.log(`Data directory already exists: ${dataDir}`);
        }
        // Check if we can write to the directory
        try {
            fs.accessSync(dataDir, fs.constants.W_OK);
            console.log(`Data directory is writable`);
        }
        catch (error) {
            console.error(`Data directory is not writable:`, error);
        }
        this.db = new DatabaseWrapper(dbPath);
    }
    async initialize() {
        await this.initializeDatabase();
    }
    async initializeDatabase() {
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
        await this.db.run(createTableQuery);
    }
    async createProject(name) {
        try {
            if (!name || name.trim().length === 0) {
                return { success: false, message: 'Project name cannot be empty' };
            }
            const trimmedName = name.trim();
            // Check if project already exists
            const existing = await this.db.get('SELECT * FROM projects WHERE name = ?', [trimmedName]);
            if (existing) {
                return { success: false, message: `Project '${trimmedName}' already exists` };
            }
            // Create the project
            await this.db.run('INSERT INTO projects (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [trimmedName]);
            // Get the created project
            const project = await this.db.get('SELECT * FROM projects WHERE name = ?', [trimmedName]);
            return {
                success: true,
                project,
                message: `Project '${trimmedName}' created successfully`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to create project: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    async listProjects() {
        try {
            const projects = await this.db.all('SELECT * FROM projects ORDER BY created_at DESC');
            return {
                success: true,
                projects,
                current_project: this.currentProject,
                message: `Found ${projects.length} project(s)`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to list projects: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    async enterProject(identifier) {
        try {
            let project;
            if (typeof identifier === 'number' || /^\d+$/.test(identifier)) {
                // Search by ID
                const id = typeof identifier === 'number' ? identifier : parseInt(identifier);
                project = await this.db.get('SELECT * FROM projects WHERE id = ?', [id]);
            }
            else {
                // Search by name
                project = await this.db.get('SELECT * FROM projects WHERE name = ?', [identifier]);
            }
            if (!project) {
                return { success: false, message: `Project '${identifier}' not found` };
            }
            // Update the updated_at timestamp
            await this.db.run('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [project.id]);
            // Refresh the project data
            project = await this.db.get('SELECT * FROM projects WHERE id = ?', [project.id]);
            this.currentProject = project;
            return {
                success: true,
                project,
                message: `Entered project '${project.name}' (ID: ${project.id})`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to enter project: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    async leaveProject() {
        if (!this.currentProject) {
            return { success: false, message: 'No project is currently active' };
        }
        const projectName = this.currentProject.name;
        this.currentProject = null;
        return {
            success: true,
            message: `Left project '${projectName}'`
        };
    }
    async deleteProject(identifier) {
        try {
            let project;
            if (typeof identifier === 'number' || /^\d+$/.test(identifier)) {
                // Search by ID
                const id = typeof identifier === 'number' ? identifier : parseInt(identifier);
                project = await this.db.get('SELECT * FROM projects WHERE id = ?', [id]);
            }
            else {
                // Search by name
                project = await this.db.get('SELECT * FROM projects WHERE name = ?', [identifier]);
            }
            if (!project) {
                return { success: false, message: `Project '${identifier}' not found` };
            }
            // If this is the current project, leave it first
            if (this.currentProject && this.currentProject.id === project.id) {
                this.currentProject = null;
            }
            // Delete the project
            await this.db.run('DELETE FROM projects WHERE id = ?', [project.id]);
            return {
                success: true,
                message: `Project '${project.name}' (ID: ${project.id}) deleted successfully`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to delete project: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    getCurrentProject() {
        return this.currentProject;
    }
    close() {
        this.db.close();
    }
}
class DevToolsMCPServer {
    server;
    service;
    constructor(service) {
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
    }
    setupToolHandlers() {
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
                        description: 'List all projects and show which one is currently active',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: 'enter_project',
                        description: 'Enter (activate) a project by name or ID',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                identifier: {
                                    type: 'string',
                                    description: 'Project name or ID to enter',
                                },
                            },
                            required: ['identifier'],
                        },
                    },
                    {
                        name: 'leave_project',
                        description: 'Leave the currently active project',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: 'delete_project',
                        description: 'Delete a project by name or ID',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                identifier: {
                                    type: 'string',
                                    description: 'Project name or ID to delete',
                                },
                            },
                            required: ['identifier'],
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
                case 'enter_project':
                    return this.handleEnterProject(request.params.arguments);
                case 'leave_project':
                    return this.handleLeaveProject(request.params.arguments);
                case 'delete_project':
                    return this.handleDeleteProject(request.params.arguments);
                default:
                    throw new Error(`Unknown tool: ${request.params.name}`);
            }
        });
    }
    async handleCreateProject(args) {
        try {
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
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error creating project: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    }
    async handleListProjects(args) {
        try {
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
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error listing projects: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    }
    async handleEnterProject(args) {
        try {
            const { identifier } = args;
            const result = await this.service.enterProject(identifier);
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
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error entering project: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    }
    async handleLeaveProject(args) {
        try {
            const result = await this.service.leaveProject();
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
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error leaving project: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    }
    async handleDeleteProject(args) {
        try {
            const { identifier } = args;
            const result = await this.service.deleteProject(identifier);
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
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error deleting project: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }
    async close() {
        this.service.close();
    }
}
// Main execution
async function main() {
    const service = new ProjectService();
    await service.initialize();
    const server = new DevToolsMCPServer(service);
    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
        await server.close();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await server.close();
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
