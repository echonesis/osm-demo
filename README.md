# Deployment & API Configuration Guide

## Environment Variable for Backend API URL

The frontend uses an environment variable to determine the backend API URL. This allows you to easily switch between local development, Docker Compose, and production deployments (e.g., Zeabur).

### 1. Local Development
- The frontend reads the backend API URL from `frontend/.env`:
  ```
  VITE_API_URL=http://localhost:5000
  ```
- You can change this value to point to any backend URL as needed.

### 2. Docker Compose
- When running with Docker Compose, the default `.env` value (`http://localhost:5000`) works because both services are networked together.

### 3. Production/Zeabur Deployment
- Set the `VITE_API_URL` environment variable in your deployment platform (e.g., Zeabur) to the public URL of your backend service.
- Example: `VITE_API_URL=https://your-backend-service.zeabur.app`

## How to Change the Backend API URL
- Edit `frontend/.env` for local/dev.
- Set the environment variable in your cloud platform for production.

## Updating the Code
- The frontend code uses `import.meta.env.VITE_API_URL` to determine the backend URL.
- If the variable is not set, it defaults to `http://localhost:5000`.

---

## Quick Start
1. Clone the repo and install dependencies.
2. Edit `frontend/.env` if needed.
3. Run with Docker Compose for local development:
   ```
   docker-compose up --build
   ```
4. For production, set the `VITE_API_URL` environment variable to your backend's public URL in your deployment platform.

---

For more details, see the code and Dockerfiles in the respective `frontend` and `backend` folders. 