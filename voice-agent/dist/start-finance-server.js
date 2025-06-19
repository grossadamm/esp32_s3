#!/usr/bin/env tsx
import { FinanceHTTPServer } from './server/SimpleServer.js';
const server = new FinanceHTTPServer();
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Finance HTTP server...');
    server.close();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Finance HTTP server...');
    server.close();
    process.exit(0);
});
server.start(3000);
//# sourceMappingURL=start-finance-server.js.map