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
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create a new user
- `PUT /api/users/:id` - Update a user
- `DELETE /api/users/:id` - Delete a user

## Building and Running with Docker

1. Build the Docker image:

```bash
docker build -t agora-near-be .
```

2. Run the container:

```bash
docker run -p 3000:3000 --env-file .env agora-near-be
```

## Deployment to GCP

To deploy this application to Google Cloud Platform:

1. Build the Docker image:

```bash
docker build -t gcr.io/[PROJECT_ID]/agora-near-be .
```

2. Push the image to Google Container Registry:

```bash
docker push gcr.io/[PROJECT_ID]/agora-near-be
```

3. Deploy to Cloud Run:

```bash
gcloud run deploy agora-near-be \
  --image gcr.io/[PROJECT_ID]/agora-near-be \
  --platform managed \
  --region [REGION] \
  --allow-unauthenticated
```

## License

[MIT](LICENSE)
