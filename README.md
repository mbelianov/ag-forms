# Prenatal Ultrasound Documentation System

Azure serverless application for prenatal ultrasound examination documentation.

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x LTS or higher
- PowerShell (Windows)

### Setup Development Environment

Run the automated setup script:

```powershell
.\setup-dev-environment.ps1
```

This script will:
- ✅ Check Node.js installation
- ✅ Configure PowerShell execution policy
- ✅ Install Azure Functions Core Tools v4
- ✅ Install Azurite (Azure Storage Emulator)
- ✅ Create Azure Functions project structure
- ✅ Install all dependencies
- ✅ Create local configuration files
- ✅ Create a sample HealthCheck function

### Start Development Servers

**Terminal 1 - Start Azurite (Storage Emulator):**
```powershell
.\start-azurite.ps1
```

**Terminal 2 - Start Azure Functions:**
```powershell
.\start-functions.ps1
```

**Test your setup:**
Visit http://localhost:7071/api/HealthCheck

## 📚 Documentation

- **[Local Development Setup Guide](docs/06-local-dev-setup.md)** - Detailed setup instructions
- **[Architecture Overview](docs/01-architecture-overview.md)** - System architecture and design
- **[Database Design](docs/02-database-design.md)** - Azure Table Storage schema
- **[Security Architecture](docs/03-security-architecture.md)** - Security requirements and implementation
- **[API Specification](docs/04-api-specification.md)** - REST API endpoints and contracts
- **[Deployment Guide](docs/05-deployment-guide.md)** - Azure deployment instructions
- **[Agent Guidelines](AGENTS.md)** - Context for AI coding assistants

## 🏗️ Project Structure

```
ag-forms/
├── api/                          # Azure Functions backend
│   ├── src/
│   │   └── functions/           # Function definitions
│   ├── host.json                # Functions host configuration
│   ├── local.settings.json      # Local settings (not in git)
│   └── package.json
├── frontend/                     # React frontend (to be implemented)
├── docs/                         # Documentation
├── setup-dev-environment.ps1    # Automated setup script
├── start-azurite.ps1           # Start storage emulator
├── start-functions.ps1         # Start Azure Functions
└── README.md
```

## 🛠️ Technology Stack

### Backend
- **Runtime**: Azure Functions v4
- **Language**: Node.js 20.x LTS with TypeScript
- **Storage**: Azure Table Storage
- **Authentication**: Custom (application-managed)

### Frontend (Planned)
- **Framework**: React 18+ with TypeScript
- **UI Library**: IBM Carbon Design System
- **Build Tool**: Vite
- **Deployment**: Azure Static Web Apps

## 🔒 Security

This project follows IBM security standards:
- ✅ TLS 1.2+ for all communications
- ✅ Secrets in environment variables only
- ✅ Services bind to localhost (127.0.0.1)
- ✅ Argon2id password hashing
- ✅ Input validation on all endpoints
- ✅ No sensitive data in logs

See [Security Architecture](docs/03-security-architecture.md) for details.

## 🧪 Development Workflow

### Daily Development
1. Start Azurite: `.\start-azurite.ps1`
2. Start Functions: `.\start-functions.ps1`
3. Make changes to code
4. Functions auto-reload on save

### Testing
```bash
cd api
npm test              # Run unit tests
npm run lint          # Run linter
```

### Building
```bash
cd api
npm run build         # Compile TypeScript
```

## 📋 Available Scripts

### Setup
- `.\setup-dev-environment.ps1` - Complete environment setup

### Development
- `.\start-azurite.ps1` - Start Azure Storage Emulator
- `.\start-functions.ps1` - Start Azure Functions runtime

### API Commands
```bash
cd api
npm install           # Install dependencies
npm run build         # Build TypeScript
npm test              # Run tests
npm run lint          # Run linter
func start            # Start Functions (alternative)
func start --verbose  # Start with detailed logging
```

## 🌐 Local Endpoints

- **Azure Functions**: http://localhost:7071
- **Azurite Tables**: http://127.0.0.1:10002
- **Azurite Blobs**: http://127.0.0.1:10000
- **Azurite Queues**: http://127.0.0.1:10001

## 🐛 Troubleshooting

### "func: command not found"
Run the setup script: `.\setup-dev-environment.ps1`

### "Cannot connect to storage"
Ensure Azurite is running: `.\start-azurite.ps1`

### "Port 7071 already in use"
```powershell
# Find and kill the process
netstat -ano | findstr :7071
taskkill /PID <PID> /F
```

### PowerShell execution policy error
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

See [Troubleshooting Guide](docs/06-local-dev-setup.md#troubleshooting) for more solutions.

## 📖 Additional Resources

- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Azure Table Storage SDK](https://docs.microsoft.com/javascript/api/@azure/data-tables/)
- [Azurite Documentation](https://docs.microsoft.com/azure/storage/common/storage-use-azurite)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## 📝 License

Internal IBM project - see license documentation.

## 🤝 Contributing

This is a documentation-only repository. Implementation will follow the specifications in the `docs/` directory.

For AI coding assistants, see [AGENTS.md](AGENTS.md) for project context and guidelines.