# AG Forms Frontend

Prenatal ultrasound documentation system frontend built with React 19, TypeScript 6.0, and Vite.

## Prerequisites

- Node.js 18+ and npm
- Azure Functions backend running on `http://localhost:7071`

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at `http://127.0.0.1:3000`

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable React components
│   ├── pages/          # Page components (routes)
│   ├── services/       # API service layer
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   ├── App.tsx         # Main application component
│   └── main.tsx        # Application entry point
├── public/             # Static assets
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies and scripts
```

## Configuration

### Vite Configuration
- Server binds to `127.0.0.1:3000` (localhost only)
- API requests to `/api/*` are proxied to `http://localhost:7071`

### TypeScript Configuration
- Strict mode is disabled (per project requirements)
- Target: ES2023
- Module: ESNext

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## API Integration

The frontend communicates with the Azure Functions backend via the `/api` proxy:
- Authentication endpoints: `/api/Login`, `/api/Logout`, `/api/Register`
- Patient endpoints: `/api/GetPatients`, `/api/CreatePatient`, etc.
- Examination endpoints: `/api/GetExaminations`, `/api/CreateExamination`, etc.

All API calls use the configured axios instance in `src/services/api.ts` with:
- Automatic cookie handling for authentication
- Error interceptors for common HTTP errors
- Base URL configuration for API proxy

## Next Steps

1. Install Carbon Design System for UI components
2. Implement authentication pages (Login, Register)
3. Create patient management pages
4. Build examination documentation interface
5. Add PDF generation functionality
