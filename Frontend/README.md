# Discover UI

A modern web application built with React 19, TypeScript, and Tailwind CSS.

## Tech Stack

- React 19
- TypeScript
- Tailwind CSS
- Vite
- Redux Toolkit (RTK Query)
- React Router v7
- ESLint
- Prettier
- CSpell

## Prerequisites

- Node.js (v22.14.0 or later)
- npm/yarn/pnpm

## Getting Started

1. Clone the repository:

```bash
git clone <repository-url>
cd discover-ui
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run preview` - Preview production build
- `npm run lint` - Lint code using ESLint
- `npm run prepare` - Setup Husky
- `npm run cspell` - Check spelling in source files

## Project Structure

```
src/
  ├── assets/        # Static assets
  │   ├── fonts/     # Font files
  │   └── images/    # Image assets
  ├── components/    # Reusable components
  │   ├── common/    # Common UI components
  │   ├── Icons/     # SVG icons
  │   └── layout/    # Layout components
  ├── constants/     # Application constants
  ├── context/       # React context providers
  ├── hooks/         # Custom React hooks
  ├── pages/         # Route components
  │   ├── Dashboard/
  │   ├── Login/
  │   ├── Signup/
  │   └── ...
  ├── redux/         # Redux state management
  │   ├── hooks/     # Custom Redux hooks
  │   ├── middlewares/
  │   ├── slices/    # Redux slices and RTK Query
  │   └── store/     # Redux store configuration
  ├── routes/        # Routing configuration
  │   ├── AppRoutes.tsx
  │   ├── RequireAuth.tsx
  │   └── routes.tsx
  └── utils/         # Utility functions
```

## Features

- 🎯 RTK Query for API integration
- 🔒 Role-based authentication
- 🎨 Tailwind CSS for styling
- 🔍 TypeScript for type safety
- 📦 Modern build setup with Vite

## Environment Variables

Create `.env.development` and `.env.production` files:

```env
VITE_BASE_URL=<api-url>
VITE_GOOGLE_CLIENT_ID=<google-client-id>
VITE_CLIENT_SECRET=<client-secret>
VITE_NAVIGATION_URL=<navigation-url>
```

## Contributing

1. Create a feature branch
2. Commit changes
3. Push to the branch
4. Create a Pull Request

## Code Quality

- ESLint for code linting
- Prettier for code formatting
- CSpell for spell checking
- Husky for pre-commit hooks
- TypeScript for static type checking
