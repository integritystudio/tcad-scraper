# Project Overview

This project is a comprehensive web scraping tool designed to extract property tax information from the Travis Central Appraisal District (TCAD) website. It features a full-stack architecture, including a React-based frontend, a Node.js backend API, and a PostgreSQL database for data storage. The system leverages BullMQ for robust job queuing and processing, Puppeteer for web scraping, and Playwright for end-to-end testing.

## Technologies Used

**Frontend:**
*   **React:** A JavaScript library for building user interfaces.
*   **Vite:** A fast build tool that provides a lightning-fast development experience.
*   **TypeScript:** A superset of JavaScript that adds static typing.

**Backend:**
*   **Node.js:** A JavaScript runtime for server-side development.
*   **Express.js:** A minimal and flexible Node.js web application framework.
*   **TypeScript:** For type-safe backend development.
*   **BullMQ:** A robust, Redis-backed queueing system for Node.js.
*   **Prisma:** An open-source next-generation ORM for Node.js and TypeScript.
*   **PostgreSQL:** A powerful, open-source relational database system.
*   **Puppeteer:** A Node.js library which provides a high-level API to control Chrome or Chromium over the DevTools Protocol.
*   **Sentry:** Error tracking and performance monitoring.
*   **Winston:** A versatile logging library.
*   **Swagger:** For API documentation.

**Testing:**
*   **Vitest:** A blazing fast unit-test framework powered by Vite.
*   **Playwright:** A framework for Web Testing and Automation.
*   **Biome:** A toolchain for web projects, providing linting and formatting.

## Building and Running

### Frontend

*   **Development Server:**
    ```bash
    npm run dev
    ```
*   **Build for Production:**
    ```bash
    npm run build
    ```
*   **Preview Production Build:**
    ```bash
    npm run preview
    ```

### Backend

*   **Development Server (with auto-reloading):**
    ```bash
    cd server
    npm run dev
    ```
*   **Build for Production:**
    ```bash
    cd server
    npm run build
    ```
*   **Start Production Server:**
    ```bash
    cd server
    npm run start
    ```

## Testing

### Frontend

*   **Run Unit/Integration Tests:**
    ```bash
    npm run test
    ```
*   **Run Unit/Integration Tests with UI:**
    ```bash
    npm run test:ui
    ```
*   **Run Unit/Integration Tests with Coverage:**
    ```bash
    npm run test:coverage
    ```
*   **Run End-to-End Tests:**
    ```bash
    npm run test:e2e
    ```
*   **Run End-to-End Tests with UI:**
    ```bash
    npm run test:e2e:ui
    ```

### Backend

*   **Run All Tests (Unit & Integration):**
    ```bash
    cd server
    npm run test:all
    ```
*   **Run Unit Tests:**
    ```bash
    cd server
    npm run test:unit
    ```
*   **Run Integration Tests:**
    ```bash
    cd server
    npm run test:integration
    ```
*   **Run Tests with Coverage:**
    ```bash
    cd server
    npm run test:all:coverage
    ```

## Development Conventions

*   **Linting:** The project uses Biome for frontend linting and ESLint for backend linting.
    *   Frontend: `npm run lint`
    *   Backend: `cd server && npm run lint`
*   **Code Formatting:** Biome is used for formatting.
*   **TypeScript:** All new code should be written in TypeScript.

## Database Management

The project uses Prisma as an ORM for PostgreSQL.

*   **Generate Prisma Client:**
    ```bash
    cd server
    doppler run -- prisma generate
    ```
*   **Run Database Migrations:**
    ```bash
    cd server
    doppler run -- prisma migrate dev
    ```
*   **Open Prisma Studio (GUI for database):**
    ```bash
    cd server
    doppler run -- prisma studio
    ```
*   **Database Statistics:**
    ```bash
    npm run db:stats # From root for basic stats
    cd server && npm run stats:all # For comprehensive backend stats
    ```

## Queue Management (BullMQ)

The backend uses BullMQ for managing scraping jobs.

*   **Check Queue Status:**
    ```bash
    cd server
    npm run queue:status
    ```
*   **Stop Queue Workers:**
    ```bash
    cd server
    npm run queue:stop
    ```
*   **Clean Up Queues:**
    ```bash
    cd server
    npm run queue:cleanup
    ```
*   **Pause Queues:**
    ```bash
    cd server
    npm run queue:pause
    ```
*   **Resume Queues:**
    ```bash
    cd server
    npm run queue:resume
    ```

## Data Analysis and Cleaning

The backend provides scripts for analyzing and cleaning scraped data.

*   **Analyze Queue Successes/Failures/Performance:**
    ```bash
    cd server
    npm run analyze:overview
    npm run analyze:success
    npm run analyze:failures
    npm run analyze:performance
    ```
*   **Clean Data (e.g., duplicates, inefficient terms):**
    ```bash
    cd server
    npm run clean:all
    ```
