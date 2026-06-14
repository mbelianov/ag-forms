# Prenatal Ultrasound System - Frontend

React 18+ frontend application with IBM Carbon Design System for the prenatal ultrasound documentation system.

## Tech Stack

- **React 18.3.1** - UI library
- **TypeScript 5.6.3** - Type safety
- **Vite 6.0.3** - Build tool and dev server
- **React Router 6.28.0** - Client-side routing
- **IBM Carbon Design System 1.72.2** - UI components
- **Axios 1.7.9** - HTTP client
- **jsPDF 2.5.2** - PDF generation
- **date-fns 4.1.0** - Date utilities

## Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── api/            # API client and services
│   │   ├── client.ts   # Axios instance with auth
│   │   ├── auth.ts     # Auth API calls
│   │   ├── patients.ts # Patient API calls
│   │   └── examinations.ts # Examination API calls
│   ├── components/     # Reusable components
│   │   ├── Layout/     # Header, Sidebar, Layout
│   │   ├── Auth/       # LoginForm, ProtectedRoute
│   │   ├── Patients/   # Patient components
│   │   └── Examinations/ # Examination components
│   ├── pages/          # Page components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Patients.tsx
│   │   ├── PatientDetail.tsx
│   │   ├── Examinations.tsx
│   │   └── ExaminationDetail.tsx
│   ├── context/        # React Context
│   │   └── AuthContext.tsx
│   ├── hooks/          # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── usePatients.ts
│   │   └── useExaminations.ts
│   ├── types/          # TypeScript types
│   │   └── index.ts
│   ├── utils/          # Utility functions
│   │   ├── pdf.ts      # PDF generation
│   │   └── validation.ts # Form validation
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── .env.development    # Development environment variables
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies
```

## Setup

### Prerequisites

- Node.js v24.13.1 or higher
- npm or yarn
- Backend API running on http://localhost:7071
- Azurite (Azure Storage Emulator) running

### Installation

From project root:

```bash
# Run setup script (recommended)
powershell -ExecutionPolicy Bypass -File ./setup-frontend.ps1
```

Or manually:

```bash
cd frontend
npm install
```

## First Time Setup

### Initialize Database with Default Admin User

Before you can log in to the application, you need to initialize the database with a default admin user.

**Prerequisites**: Make sure Azurite and Azure Functions backend are running first:
- Terminal 1: Azurite (`./start-azurite.ps1`)
- Terminal 2: Azure Functions (`./start-functions.ps1`)

Then run the initialization script:

```bash
# From project root
powershell -ExecutionPolicy Bypass -File ./init-database.ps1
```

This will create:
- **Username**: `admin`
- **Password**: `Admin123!`
- **Email**: `admin@example.com`
- **Role**: Administrator

### Access the Application

1. Open your browser and navigate to: http://localhost:3000
2. Log in with the default admin credentials above
3. Start managing patients and examinations!

## Development

### Start Development Server

From project root:

```bash
# Run start script (recommended)
powershell -ExecutionPolicy Bypass -File ./start-frontend.ps1
```

Or manually:

```bash
cd frontend
npm run dev
```

The application will be available at http://localhost:3000

### Default Login Credentials

After running the database initialization script:
- **Username**: `admin`
- **Password**: `Admin123!`

**Important**: Change the default password after first login in production!

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Environment Variables

Create `.env.development` for local development:

```env
VITE_API_URL=http://localhost:7071/api/v1
```

For production, create `.env.production`:

```env
VITE_API_URL=https://your-api-domain.com/api/v1
```

## Authentication

The application uses JWT token-based authentication:

1. User logs in with username/password
2. Backend returns JWT token
3. Token is stored in localStorage
4. Token is automatically included in all API requests via Axios interceptor
5. On 401 response, user is redirected to login page

### Protected Routes

All routes except `/login` require authentication. The `ProtectedRoute` component handles:

- Checking authentication status
- Redirecting to login if not authenticated
- Showing loading state during auth check
- Optional role-based access control

## API Integration

### API Client

The `apiClient` (Axios instance) is configured with:

- Base URL from environment variable
- Automatic JWT token injection
- 401 error handling (redirect to login)
- 30-second timeout

### API Services

Each domain has its own service file:

- `auth.ts` - Login, logout, register, change password
- `patients.ts` - CRUD operations for patients
- `examinations.ts` - CRUD operations for examinations

### Custom Hooks

Domain-specific hooks provide state management:

- `useAuth()` - Authentication state and methods
- `usePatients()` - Patient data and operations
- `useExaminations()` - Examination data and operations

## Carbon Design System

The application uses IBM Carbon Design System for UI components:

- Consistent design language
- Accessible components
- Responsive layouts
- Dark mode support (future)

### Key Components Used

- `Header` - Application header with navigation
- `Button` - Primary actions
- `TextInput` - Form inputs
- `DataTable` - Data display
- `Modal` - Dialogs
- `Notification` - Toast messages
- `Loading` - Loading states

## Routing

React Router v6 is used for client-side routing:

```
/login              - Login page (public)
/                   - Redirects to /dashboard
/dashboard          - Dashboard (protected)
/patients           - Patient list (protected)
/patients/:id       - Patient detail (protected)
/examinations       - Examination list (protected)
/examinations/:id   - Examination detail (protected)
```

## State Management

- **Authentication**: React Context (`AuthContext`)
- **Component State**: React hooks (`useState`, `useEffect`)
- **Server State**: Custom hooks with local state

No global state management library (Redux, Zustand) is used to keep the application simple.

## Security

### Client-Side Security Measures

1. **Token Storage**: JWT tokens stored in localStorage
2. **Automatic Logout**: On 401 response from API
3. **Protected Routes**: Authentication required for all routes except login
4. **Role-Based Access**: Optional role checking in `ProtectedRoute`
5. **HTTPS Only**: Production builds enforce HTTPS
6. **No Sensitive Data in Logs**: Passwords and tokens excluded from console logs

### Security Best Practices

- Never store passwords in state or localStorage
- Always use HTTPS in production
- Validate all user inputs
- Sanitize data before rendering
- Use Content Security Policy headers
- Implement rate limiting on backend

## Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Production Checklist

- [ ] Update `VITE_API_URL` in `.env.production`
- [ ] Enable HTTPS
- [ ] Configure CORS on backend
- [ ] Set up CDN for static assets
- [ ] Enable gzip compression
- [ ] Configure caching headers
- [ ] Test on multiple browsers
- [ ] Run accessibility audit
- [ ] Test with screen readers

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Accessibility

The application follows WCAG 2.1 Level AA guidelines:

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Screen reader support
- Color contrast compliance

## Future Enhancements

- [ ] Implement patient search and filtering
- [ ] Add examination form with biometry fields
- [ ] Implement PDF generation for reports
- [ ] Add email functionality for reports
- [ ] Implement data visualization (charts)
- [ ] Add dark mode support
- [ ] Implement offline support (PWA)
- [ ] Add internationalization (i18n)
- [ ] Implement real-time updates (WebSockets)
- [ ] Add unit and integration tests

## User Management

### Create Additional Users

After logging in as admin, you can create additional users via the API:

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

- **admin**: Full access to all features, can manage users
- **doctor**: Can create and edit patients and examinations
- **viewer**: Read-only access to patients and examinations

## Troubleshooting

### Cannot Log In

1. **Verify all services are running**:
   - Terminal 1: Azurite (`./start-azurite.ps1`)
   - Terminal 2: Azure Functions backend (`./start-functions.ps1`)
   - Terminal 4: Frontend dev server (`./start-frontend.ps1`)

2. **Initialize the database**:
   ```bash
   powershell -ExecutionPolicy Bypass -File ./init-database.ps1
   ```

3. **Check backend health**:
   ```bash
   curl http://localhost:7071/api/HealthCheck
   ```

4. **Verify credentials**: Use `admin` / `Admin123!`

### Reset Database

If you need to start completely fresh:

1. Stop all services (Ctrl+C in all terminals)
2. Delete the Azurite data directory:
   ```powershell
   Remove-Item -Recurse -Force C:\azurite
   ```
3. Restart services in order:
   - Terminal 1: `powershell -ExecutionPolicy Bypass -File ./start-azurite.ps1`
   - Terminal 2: `powershell -ExecutionPolicy Bypass -File ./start-functions.ps1`
   - Terminal 4: `powershell -ExecutionPolicy Bypass -File ./start-frontend.ps1`
4. Re-initialize database:
   ```bash
   powershell -ExecutionPolicy Bypass -File ./init-database.ps1
   ```

### Common Issues

**Issue**: `Cannot find module '@carbon/react'`
**Solution**: Run `npm install` to install dependencies

**Issue**: API calls fail with CORS error
**Solution**: Ensure backend CORS is configured to allow http://localhost:3000

**Issue**: 401 errors on all API calls
**Solution**:
1. Check that backend is running
2. Verify you're logged in (check localStorage for token)
3. Try logging out and back in
4. Re-initialize database if needed

**Issue**: Vite dev server won't start
**Solution**: Check that port 3000 is not in use, or change port in `vite.config.ts`

**Issue**: "Invalid credentials" error
**Solution**:
1. Make sure you ran the database initialization script
2. Use correct credentials: `admin` / `Admin123!`
3. Check backend logs for errors

## Contributing

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## License

Proprietary - All rights reserved

---

Made with Bob
