#!/usr/bin/env node
console.log('Simple test starting...');
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
console.log('Imports successful');
// Main execution
async function main() {
    console.log('Main function starting...');
    const server = new Server({
        name: 'simple-test-server',
        version: '0.1.0',
    }, {
        capabilities: {
            tools: {},
        },
    });
    console.log('Server created, connecting...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('Server connected successfully');
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('Server error:', error);
        process.exit(1);
    });
}
