# Local Development Environment Setup Guide

## Overview

This guide will help you set up your local development environment for Azure Functions development and testing for the prenatal ultrasound documentation system.

## Prerequisites Check

✅ **Node.js**: v24.13.1 (Installed)
❌ **Azure Functions Core Tools**: Not installed (Required)
❌ **Azurite**: Not installed (Required for local Azure Storage emulation)

## Step 1: Enable PowerShell Script Execution

Your system has PowerShell script execution disabled. You need to enable it to install npm packages globally.

**Option A: Enable for Current User (Recommended)**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Option B: Run as Administrator (Alternative)**
Open PowerShell as Administrator and run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
```

After running one of these commands, close and reopen your terminal.

## Step 2: Install Azure Functions Core Tools

Azure Functions Core Tools v4 is required to run Azure Functions locally.

```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

**Verify installation:**
```bash
func --version
```

Expected output: `4.x.x`

## Step 3: Install Azurite (Azure Storage Emulator)

Azurite is the local emulator for Azure Storage (Tables, Blobs, Queues).

```bash
npm install -g azurite
```

**Verify installation:**
```bash
azurite --version
```

## Step 4: Create Azure Functions Project Structure

Create the API directory structure:

```bash
# Create api directory
mkdir api
cd api

# Initialize Azure Functions project
func init --worker-runtime node --language typescript --model v4

# Install dependencies
npm install

# Install Azure Storage SDK
npm install @azure/data-tables @azure/storage-blob

# Install additional dependencies
npm install @azure/identity dotenv
npm install --save-dev @types/node typescript
```

## Step 5: Create Local Settings File

Create `api/local.settings.json` for local development configuration:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsFeatureFlags": "EnableWorkerIndexing",
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "NODE_ENV": "development"
  },
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*",
    "CORSCredentials": false
  }
}
```

**Security Note**: `local.settings.json` should be in `.gitignore` (already configured).

## Step 6: Start Azurite Storage Emulator

Open a **separate terminal** and start Azurite:

```bash
azurite --silent --location c:\azurite --debug c:\azurite\debug.log
```

**Alternative: Start with specific services only**
```bash
azurite-table --silent --location c:\azurite --debug c:\azurite\debug.log
```

**Keep this terminal running** while developing.

**Default Azurite Connection String:**
```
UseDevelopmentStorage=true
```

**Azurite Endpoints:**
- Tables: `http://127.0.0.1:10002`
- Blobs: `http://127.0.0.1:10000`
- Queues: `http://127.0.0.1:10001`

## Step 7: Create a Test Function

Create your first HTTP-triggered function:

```bash
cd api
func new --name HealthCheck --template "HTTP trigger" --authlevel anonymous
```

This creates a basic HTTP endpoint at `http://localhost:7071/api/HealthCheck`

## Step 8: Start Azure Functions Runtime

From the `api` directory:

```bash
func start
```

**Expected output:**
```
Azure Functions Core Tools
Core Tools Version:       4.x.x
Function Runtime Version: 4.x.x

Functions:
  HealthCheck: [GET,POST] http://localhost:7071/api/HealthCheck

For detailed output, run func with --verbose flag.
```

## Step 9: Test Your Setup

Open a browser or use curl to test:

```bash
curl http://localhost:7071/api/HealthCheck
```

Or visit: http://localhost:7071/api/HealthCheck

## Development Workflow

### Daily Development Routine

1. **Start Azurite** (Terminal 1):
   ```bash
   azurite --silent --location c:\azurite
   ```

2. **Start Azure Functions** (Terminal 2):
   ```bash
   cd api
   func start
   ```

3. **Start Frontend** (Terminal 3 - when implemented):
   ```bash
   cd frontend
   npm run dev
   ```

### Stopping Services

- Press `Ctrl+C` in each terminal to stop services
- Azurite data persists in `c:\azurite` directory

## Project Structure (After Setup)

```
ag-forms/
├── api/                          # Azure Functions backend
│   ├── src/
│   │   └── functions/           # Function definitions
│   ├── host.json                # Functions host configuration
│   ├── local.settings.json      # Local development settings (not in git)
│   ├── package.json
│   └── tsconfig.json
├── frontend/                     # React frontend (to be created)
├── docs/                         # Documentation
└── .gitignore
```

## Troubleshooting

### Issue: "func: command not found"
**Solution**: Ensure Azure Functions Core Tools is installed globally and terminal is restarted.

### Issue: "Cannot connect to storage"
**Solution**: Ensure Azurite is running before starting Azure Functions.

### Issue: "Port 7071 already in use"
**Solution**: 
```bash
# Find process using port 7071
netstat -ano | findstr :7071

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Issue: PowerShell execution policy error
**Solution**: Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Issue: Azurite won't start
**Solution**: 
- Check if port 10002 is available
- Try deleting `c:\azurite` directory and restart
- Run with `--debug` flag to see detailed logs

## Security Considerations

### Local Development
- ✅ Bind to `127.0.0.1` or `localhost` (never `0.0.0.0`)
- ✅ Use `UseDevelopmentStorage=true` for Azurite
- ✅ Keep `local.settings.json` out of version control
- ✅ Use environment variables for any secrets

### Connection Strings
**Local (Azurite):**
```
UseDevelopmentStorage=true
```

**Production (Azure):**
```
DefaultEndpointsProtocol=https;AccountName=<account>;AccountKey=<key>;EndpointSuffix=core.windows.net
```

## Next Steps

1. ✅ Complete this setup guide
2. Create authentication functions (login, register)
3. Create patient management functions (CRUD)
4. Create examination management functions (CRUD)
5. Implement Azure Table Storage data access layer
6. Add input validation and error handling
7. Write unit tests

## Useful Commands Reference

```bash
# Azure Functions
func init                        # Initialize new project
func new                         # Create new function
func start                       # Start local runtime
func start --verbose             # Start with detailed logging
func start --port 7072          # Start on different port

# Azurite
azurite                          # Start all services
azurite-table                    # Start table service only
azurite --help                   # Show all options

# NPM
npm install                      # Install dependencies
npm run build                    # Build TypeScript
npm test                         # Run tests
npm run lint                     # Run linter

# Node.js
node --version                   # Check Node.js version
npm --version                    # Check npm version
```

## Additional Resources

- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Azure Functions Core Tools](https://docs.microsoft.com/azure/azure-functions/functions-run-local)
- [Azurite Documentation](https://docs.microsoft.com/azure/storage/common/storage-use-azurite)
- [Azure Table Storage SDK](https://docs.microsoft.com/javascript/api/@azure/data-tables/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## Support

For project-specific questions, refer to:
- `AGENTS.md` - Project context and architecture decisions
- `docs/01-architecture-overview.md` - System architecture
- `docs/04-api-specification.md` - API endpoints and contracts