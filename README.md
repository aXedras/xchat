
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

## Docker Support

### Building the Docker Image

To build the Docker image locally:

```sh
docker build -t xchat:latest .
```

### Running the Docker Container

To run the container locally:

```sh
docker run -p 8080:80 xchat:latest
```

Then access the application at `http://localhost:8080` in your browser.

## CI/CD Pipeline

This repository includes a GitHub Actions workflow that automatically builds the Docker image when code is pushed to the main branch or when a pull request is created.

To enable automatic pushing to a Docker registry:

1. Add your Docker registry credentials to your GitHub repository secrets:
   - Go to your GitHub repository → Settings → Secrets and Variables → Actions
   - Add the following secrets:
     - `DOCKERHUB_USERNAME`: Your Docker Hub username
     - `DOCKERHUB_TOKEN`: Your Docker Hub access token

2. Uncomment the "push" job in the `.github/workflows/docker-build.yml` file and update the image name in the tags.

### Deploying to Kubernetes

1. Ensure you have kubectl configured to connect to your Kubernetes cluster.

2. Create a simple deployment and service:

```sh
# Create deployment
kubectl create deployment xchat --image=<your-registry>/xchat:latest

# Expose the deployment
kubectl expose deployment xchat --type=LoadBalancer --port=80
```

Or apply a Kubernetes configuration file:

```sh
kubectl apply -f kubernetes-manifest.yml
```

## Connecting to the Backend

xChat can connect to either a custom WebSocket backend or Supabase Realtime for message distribution.

### Custom WebSocket Backend

To connect to a custom WebSocket backend:

1. Set the WebSocket URL environment variable when building or running the application:

```sh
# For development
VITE_WS_URL=ws://your-backend-url/ws npm run dev

# For Docker
docker run -p 8080:80 -e VITE_WS_URL=ws://your-backend-url/ws xchat:latest
```

2. The frontend will automatically attempt to connect to the specified WebSocket endpoint.

3. Your backend should implement the following message types:
   - `message`: New chat messages
   - `typing`: Typing indicators
   - `read`: Message read receipts
   - `delivered`: Message delivery confirmations

### Backend API Integration

If you're implementing your own backend, it should expose these endpoints:

- WebSocket connection for real-time messaging
- REST API for chat history, user management, etc.

## Demo Login Credentials

Use these credentials to log in to the demo version:
- **Email**: demo@axedras.com
- **Password**: password

## Project Structure

```
src/
├── components/     # UI components
├── config/         # Configuration files
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

The application supports connecting to a real backend through:

1. WebSockets for real-time messaging
2. REST API for data operations
3. Environment configuration for different deployment scenarios

### Adding New Features

1. Create new components in the `components/` directory
2. Add new pages in the `pages/` directory
3. Configure routes in `App.tsx`
4. Add necessary hooks and services

## License

[MIT License](LICENSE)

## Contact

For questions or support, please contact [your-email@example.com](mailto:your-email@example.com).
