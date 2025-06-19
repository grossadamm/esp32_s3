# Dev Tools MCP Verification Tests

This directory contains verification tests for the dev tools MCP server project management functionality.

## How Active Project is Tracked

The active project is tracked **in-memory** within the MCP server process:
- Stored in `ProjectService.currentProject` (private property)
- Set when `enterProject()` is called
- Cleared when `leaveProject()` is called or when the active project is deleted
- **Not persisted** to database - lost when MCP server restarts
- No active project on server startup

## Test Scripts

### Option 1: Bash Script (Recommended)
```bash
./tests/dev-tools-verification.sh
```
- Uses `curl` to send HTTP requests
- Works with any system that has `curl`
- Pretty-prints JSON if `jq` is available
- Includes colored output and better error handling

### Option 2: Node.js Script
```bash
node tests/dev-tools-verification.js
```
- Uses Node.js built-in fetch (requires Node.js 18+)
- More detailed JSON output formatting

## Prerequisites

1. **Start the voice-agent server:**
   ```bash
   docker compose up -d
   ```

2. **Ensure MCP servers are configured:**
   - The dev-tools-mcp server should be listed in `mcp-config.json`
   - MCP clients should be able to connect to the dev-tools server

## Test Coverage

The verification tests cover all CRUD operations:

1. **Create Project** - Creates "my-test-project"
2. **List Projects** - Shows all projects (should show 1 project)
3. **Enter Project** - Activates "my-test-project"
4. **List Projects (Active)** - Shows active project status
5. **Leave Project** - Deactivates current project
6. **Create Second Project** - Creates "second-project"
7. **List All Projects** - Shows both projects (should show 2 projects)
8. **Delete by Name** - Deletes "my-test-project"
9. **Delete by ID** - Deletes "second-project" (ID 2)
10. **Final List** - Confirms cleanup (should show 0 projects)

## Expected Behavior

- Projects are created with unique names
- Active project is shown in list results
- Entering a project updates its `updated_at` timestamp
- Deleting the active project automatically deactivates it
- All operations return success/failure status with descriptive messages

## Troubleshooting

- **Server not running**: Make sure Docker containers are running with `docker compose up -d`
- **MCP connection issues**: Check that dev-tools-mcp is properly configured in `mcp-config.json`
- **Database issues**: The SQLite database will be created automatically in `data/projects.db` 