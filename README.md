# Agora Near Backend Service

An Express.js microservice with TypeScript, Prisma ORM, and PostgreSQL integration.

## Prerequisites

- Node.js v18 or later
- npm or yarn
- PostgreSQL database (in GCP)
- Docker (for containerization)

## Environment Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd agora-near-be
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:
   Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

4. Update the database connection string in `.env`:

```
DATABASE_URL="postgresql://user:password@your-gcp-postgres-instance:5432/dbname?schema=public&sslmode=require"
```

## Database Setup

1. Generate Prisma client:

```bash
npm run prisma:generate
```

2. Run database migrations:

```bash
npm run prisma:migrate
```

## Development

Start the development server:

```bash
npm run dev
```

The server will be running at http://localhost:3000

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/delegate-statement/[:address]` - Get delegate statement of user by address

## Building and Running with Docker

1. Build the Docker image:

```bash
docker build -t agora-near-be .
```

2. Run the container:

```bash
docker run -p 8080:8080 --env-file .env agora-near-be
```

### Resetting Prisma migration history

Since our database is partially managed outside of Prisma (i.e. for the indexer), changes pushed for the indexer (e.g. new tables) might result in "schema drift" where the Prisma migration history is out of sync, making it difficult to make changes to the Prisma schema.

In this case, it's simpler to just reset the Prisma migration history. To do so, follow these steps:

1. Delete the existing migrations in the database by running `echo "DELETE FROM \_prisma_migrations;" > clear_migrations.sql && npx prisma db execute --file clear_migrations.sql --schema prisma/schema.prisma`
2. Run `npm run prisma:pull` to get the latest schema from remote
3. Run `npm run prisma:migrateDiff` to get the migration SQL required to have parity with the latest schema
4. Delete existing files/folders under the `/prisma/migrations` directory and create a new file under `/prisma/migrations/init` called `migration.sql` with the migration SQL generated from step 3.
5. Run `npx prisma migrate resolve --applied init` to resolve that migration
6. Run `npx prisma migrate status`. You should get 'Database schema is up to date!' if it was successful.
7. Apply your changes to the schema
8. Run `npm run prisma:migrate`. If done correctly the migration should be cleanly applied.
