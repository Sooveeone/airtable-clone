# Airtable Clone

An Airtable clone built with the **T3 Stack**, featuring real-time editing, virtualized tables, infinite scrolling, and full CRUD functionality with advanced filtering, sorting, searching and fast performance.

## 🚀 Features

- 🔐 Google Auth via Clerk
- 🧠 Smart schema with editable columns (Text, Number)
- 𝄜 Bases and tables creation
- 📄 Infinite scroll with virtualized rendering (TanStack React Virtual)
- 🧮 Advanced filtering and sorting (PostgreSQL + raw SQL with Prisma)
- 🗂️ Multiple table views per base
- 🛠️ Inline cell editing
- 🔍 Search functionality at the database level
- 🧱 Create, update, and delete tables, columns, and rows
- 📦 Backend pagination using cursor-based keyset strategy
- ⚡ Lightning-fast performance on large datasets (100,000+ rows)
- 🖥️ Fully responsive Airtable-style UI

## 🧰 Tech Stack (T3 Stack)

- **Frontend**:

  - React 19 with Next.js App Router for server components and routing
  - TypeScript for type-safe code development
  - Tailwind CSS for utility-first styling
  - TanStack React Virtual for efficient list virtualization
  - TanStack React Table for data grid management
  - Lucide-react for icons

- **Backend**:

  - tRPC for end-to-end typesafe APIs
  - Prisma as the ORM for database access
  - PostgreSQL for relational database storage
  - Zod for schema validation
  - Clerk for authentication

- **State Management & Data Fetching**:

  - TanStack Query (React Query) for server state management
  - Infinite scroll implementation for efficient data loading

- **Infrastructure**:
  - Neon.tech (or local PostgreSQL) for serverless Postgres database
  - Vercel for frontend and backend deployment
