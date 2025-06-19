#!/usr/bin/env node
import { createServer } from 'http';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
class DatabaseWrapper {
    db;
    all;
    get;
    run;
    constructor(filename) {
        console.log(`Connecting to database: ${filename}`);
        this.db = new sqlite3.Database(filename, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('Database connection error:', err);
            }
            else {
                console.log('Database connected successfully');
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
class DevToolsHTTPServer {
    db;
    server;
    currentProject = null;
    constructor() {
        const dataDir = path.join(process.cwd(), '..', '..', 'data');
        const dbPath = path.join(dataDir, 'projects.db');
        console.log(`Data directory: ${dataDir}`);
        console.log(`Database path: ${dbPath}`);
        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`Created data directory: ${dataDir}`);
        }
        this.db = new DatabaseWrapper(dbPath);
        this.initializeDatabase();
        this.server = createServer(this.handleRequest.bind(this));
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
        console.log('Database initialized');
    }
    async handleRequest(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        try {
            const url = new URL(req.url || '', 'http://localhost');
            const pathname = url.pathname;
            let result;
            switch (pathname) {
                case '/api/projects':
                    if (req.method === 'GET') {
                        result = await this.listProjects();
                    }
                    else if (req.method === 'POST') {
                        const body = await this.getRequestBody(req);
                        const data = JSON.parse(body);
                        result = await this.createProject(data.name);
                    }
                    else {
                        throw new Error('Method not allowed');
                    }
                    break;
                case '/api/projects/current':
                    if (req.method === 'GET') {
                        result = { current_project: this.currentProject };
                    }
                    else if (req.method === 'POST') {
                        const body = await this.getRequestBody(req);
                        const data = JSON.parse(body);
                        result = await this.enterProject(data.identifier);
                    }
                    else if (req.method === 'DELETE') {
                        result = this.leaveProject();
                    }
                    else {
                        throw new Error('Method not allowed');
                    }
                    break;
                default:
                    // Handle delete project by ID: /api/projects/123
                    const projectIdMatch = pathname.match(/^\/api\/projects\/(\d+)$/);
                    if (projectIdMatch && req.method === 'DELETE') {
                        const projectId = parseInt(projectIdMatch[1]);
                        result = await this.deleteProject(projectId);
                    }
                    else {
                        res.statusCode = 404;
                        result = { error: 'Not found' };
                    }
            }
            res.end(JSON.stringify(result, null, 2));
        }
        catch (error) {
            console.error('Server error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    }
    async getRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', reject);
        });
    }
    async createProject(name) {
        if (!name || name.trim().length === 0) {
            throw new Error('Project name cannot be empty');
        }
        const trimmedName = name.trim();
        // Check if project already exists
        const existing = await this.db.get('SELECT * FROM projects WHERE name = ?', [trimmedName]);
        if (existing) {
            throw new Error(`Project '${trimmedName}' already exists`);
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
    async listProjects() {
        const projects = await this.db.all('SELECT * FROM projects ORDER BY created_at DESC');
        return {
            success: true,
            projects,
            current_project: this.currentProject,
            message: `Found ${projects.length} project(s)`
        };
    }
    async enterProject(identifier) {
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
            throw new Error(`Project '${identifier}' not found`);
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
    leaveProject() {
        if (!this.currentProject) {
            throw new Error('No project is currently active');
        }
        const projectName = this.currentProject.name;
        this.currentProject = null;
        return {
            success: true,
            message: `Left project '${projectName}'`
        };
    }
    async deleteProject(identifier) {
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
            throw new Error(`Project '${identifier}' not found`);
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
    start(port = 3000) {
        this.server.listen(port, () => {
            console.log(`🚀 Dev Tools HTTP server running on http://localhost:${port}`);
            console.log('Available endpoints:');
            console.log('  GET /api/projects - List all projects');
            console.log('  POST /api/projects - Create project (JSON: {"name": "project-name"})');
            console.log('  GET /api/projects/current - Get current project');
            console.log('  POST /api/projects/current - Enter project (JSON: {"identifier": "name-or-id"})');
            console.log('  DELETE /api/projects/current - Leave current project');
            console.log('  DELETE /api/projects/{id} - Delete project by ID');
        });
    }
    close() {
        this.db.close();
        this.server.close();
    }
}
const server = new DevToolsHTTPServer();
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Dev Tools HTTP server...');
    server.close();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Dev Tools HTTP server...');
    server.close();
    process.exit(0);
});
server.start(parseInt(process.env.PORT || '3000'));
