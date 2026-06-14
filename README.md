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

**Terminal 3 - Start Frontend (React):**
```powershell
.\start-frontend.ps1
```

**Test your setup:**
- Backend: http://localhost:7071/api/HealthCheck
- Frontend: http://localhost:3000

### Initialize Database (First Time Only)

Before you can log in to the application, initialize the database with a default admin user:

```powershell
.\init-database.ps1
```

This creates a default admin user:
- **Username**: `admin`
- **Password**: `Admin123!`
- **Email**: `admin@example.com`
- **Role**: Administrator

**Important**: Change the default password after first login!

### Access the Application

1. Open your browser: http://localhost:3000
2. Log in with the admin credentials above
3. Start managing patients and examinations!

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

## 👥 User Management

### Create Additional Users

After logging in as admin, you can create more users via the API:

```bash
# Example: Create a doctor user
curl -X POST http://localhost:7071/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "doctor1",
    "password": "Doctor123!",
    "email": "doctor1@example.com",
    "role": "doctor"
  }'

# Example: Create a viewer user
curl -X POST http://localhost:7071/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "viewer1",
    "password": "Viewer123!",
    "email": "viewer1@example.com",
    "role": "viewer"
  }'
```

### User Roles

- **admin**: Full system access, user management
- **doctor**: Create/edit patients and examinations
- **viewer**: Read-only access

## 🧪 Development Workflow

### Daily Development
1. Start Azurite: `.\start-azurite.ps1`
2. Start Functions: `.\start-functions.ps1`
3. Start Frontend: `.\start-frontend.ps1`
4. Make changes to code
5. Functions and frontend auto-reload on save

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

### Cannot Log In / "Invalid credentials"

1. **Verify all services are running**:
   - Terminal 1: Azurite (`.\start-azurite.ps1`)
   - Terminal 2: Azure Functions backend (`.\start-functions.ps1`)
   - Terminal 3: Frontend dev server (`.\start-frontend.ps1`)

2. **Initialize the database**:
   ```powershell
   .\init-database.ps1
   ```

3. **Check backend health**:
   ```bash
   curl http://localhost:7071/api/HealthCheck
   ```

4. **Verify credentials**: Use `admin` / `Admin123!`

### Reset Everything

To start completely fresh:

1. Stop all services (Ctrl+C in all terminals)
2. Delete Azurite data directory:
   ```powershell
   Remove-Item -Recurse -Force C:\azurite
   ```
3. Restart services in order:
   - Terminal 1: `.\start-azurite.ps1`
   - Terminal 2: `.\start-functions.ps1`
   - Terminal 3: `.\start-frontend.ps1`
4. Re-initialize database:
   ```powershell
   .\init-database.ps1
   ```

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

### "Port 3000 already in use"
```powershell
# Find and kill the process
netstat -ano | findstr :3000
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