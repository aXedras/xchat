
# xChat - Professional Chat Platform for the Precious Metals Industry

xChat is a specialized messaging platform designed for professionals in the precious metals industry, enabling secure and efficient communication.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or newer)
- npm (comes with Node.js) or [yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository to your local machine:
```sh
git clone <your-repository-url>
cd xchat
```

2. Install project dependencies:
```sh
npm install
# or
yarn install
```

3. Start the development server:
```sh
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to:
```
http://localhost:8080
```

## Demo Login Credentials

Use these credentials to log in to the demo version:
- **Email**: demo@axedras.com
- **Password**: password

## Project Structure

```
src/
├── components/     # UI components
├── data/           # Mock data and constants
├── hooks/          # Custom React hooks
├── lib/            # Utility libraries
├── pages/          # Page components
├── services/       # API services
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Features

- **User Authentication:** Secure login system
- **Real-time Messaging:** Send and receive messages instantly
- **Company Directory:** Browse and connect with companies in the precious metals sector
- **Message Archive:** Archive and restore conversations
- **Profile Management:** Update user profile and preferences
- **Responsive Design:** Works on desktop and mobile devices

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the app for production
- `npm run preview` - Preview the production build locally

## Technology Stack

- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - UI component library
- **React Router** - Client-side routing
- **React Query** - Data fetching and state management

## Extending the Application

### Adding Real Backend Integration

The application currently uses mock data. To connect to a real backend:

1. Configure API endpoints in `src/services/apiClient.ts`
2. Replace mock calls in hooks with actual API calls
3. Set up authentication to work with your backend services

### Adding New Features

1. Create new components in the `components/` directory
2. Add new pages in the `pages/` directory
3. Configure routes in `App.tsx`
4. Add necessary hooks and services

## License

[MIT License](LICENSE)

## Contact

For questions or support, please contact [your-email@example.com](mailto:your-email@example.com).
