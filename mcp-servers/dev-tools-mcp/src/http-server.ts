#!/usr/bin/env node

import { createServer, IncomingMessage, ServerResponse } from 'http';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { DatabaseWrapper } from './utils/DatabaseWrapper.js';

interface Project {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

class DevToolsHTTPServer {
  private db: DatabaseWrapper;
  private server: any;
  private currentProject: Project | null = null;

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

  async initializeDatabase(): Promise<void> {
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

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
          } else if (req.method === 'POST') {
            const body = await this.getRequestBody(req);
            const data = JSON.parse(body);
            result = await this.createProject(data.name);
          } else {
            throw new Error('Method not allowed');
          }
          break;

        case '/api/projects/current':
          if (req.method === 'GET') {
            result = { current_project: this.currentProject };
          } else if (req.method === 'POST') {
            const body = await this.getRequestBody(req);
            const data = JSON.parse(body);
            result = await this.enterProject(data.identifier);
          } else if (req.method === 'DELETE') {
            result = this.leaveProject();
          } else {
            throw new Error('Method not allowed');
          }
          break;

        default:
          // Handle delete project by ID: /api/projects/123
          const projectIdMatch = pathname.match(/^\/api\/projects\/(\d+)$/);
          if (projectIdMatch && req.method === 'DELETE') {
            const projectId = parseInt(projectIdMatch[1]);
            result = await this.deleteProject(projectId);
          } else {
            res.statusCode = 404;
            result = { error: 'Not found' };
          }
      }

      res.end(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Server error:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  }

  async getRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }

  async createProject(name: string): Promise<any> {
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
    await this.db.run(
      'INSERT INTO projects (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [trimmedName]
    );

    // Get the created project
    const project = await this.db.get('SELECT * FROM projects WHERE name = ?', [trimmedName]) as Project;
    
    return {
      success: true,
      project,
      message: `Project '${trimmedName}' created successfully`
    };
  }

  async listProjects(): Promise<any> {
    const projects = await this.db.all('SELECT * FROM projects ORDER BY created_at DESC') as Project[];
    
    return {
      success: true,
      projects,
      current_project: this.currentProject,
      message: `Found ${projects.length} project(s)`
    };
  }

  async enterProject(identifier: string | number): Promise<any> {
    let project: Project | undefined;

    if (typeof identifier === 'number' || /^\d+$/.test(identifier)) {
      // Search by ID
      const id = typeof identifier === 'number' ? identifier : parseInt(identifier);
      project = await this.db.get('SELECT * FROM projects WHERE id = ?', [id]) as Project;
    } else {
      // Search by name
      project = await this.db.get('SELECT * FROM projects WHERE name = ?', [identifier]) as Project;
    }

    if (!project) {
      throw new Error(`Project '${identifier}' not found`);
    }

    // Update the updated_at timestamp
    await this.db.run('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [project.id]);
    
    // Refresh the project data
    project = await this.db.get('SELECT * FROM projects WHERE id = ?', [project.id]) as Project;
    
    this.currentProject = project;

    return {
      success: true,
      project,
      message: `Entered project '${project.name}' (ID: ${project.id})`
    };
  }

  leaveProject(): any {
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

  async deleteProject(identifier: string | number): Promise<any> {
    let project: Project | undefined;

    if (typeof identifier === 'number' || /^\d+$/.test(identifier)) {
      // Search by ID
      const id = typeof identifier === 'number' ? identifier : parseInt(identifier);
      project = await this.db.get('SELECT * FROM projects WHERE id = ?', [id]) as Project;
    } else {
      // Search by name
      project = await this.db.get('SELECT * FROM projects WHERE name = ?', [identifier]) as Project;
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