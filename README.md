# Agora Near Backend Service

A comprehensive governance platform backend for NEAR HoS, providing API services for proposal management, voting analytics, delegate profiles, staking information, and multi-channel notifications.

## Features

### Core Functionality

- **Proposals**

  - Track proposal lifecycle (Draft → Approved → Voting → Finished/Rejected)
  - Dynamic quorum calculation (default: max of 7M veNEAR or 35% of total supply)
  - Quorum override system for custom requirements
  - Vote aggregation and analytics
  - Draft proposal system with multi-stage workflow
  - Voting charts and statistics

- **Delegates**

  - Comprehensive delegate profiles with statements and social links
  - Voting history tracking
  - Delegation analytics (received/sent)
  - House of Stake (HoS) activity monitoring
  - Endorsement system
  - Weighted random sorting with seed support
  - Privacy-preserving (email addresses excluded from public responses)

- **Staking**

  - Real-time APY calculation for MetaPool and liNEAR
  - Historical price tracking (365 days for MetaPool, 25 days for liNEAR)
  - NEAR inflation adjustment factor support
  - Block-height based price queries

- **Notifications**

  - Automated proposal notifications (new proposals, ending soon)
  - Multi-channel delivery (Email via Mailgun, Discord, Telegram)
  - Per-user notification preferences
  - Safe mode and developer mode for testing
  - HTML email templates

- **Security**
  - NEAR wallet signature verification
  - Nonce-based replay protection
  - Cryptographic message signing with Borsh serialization

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd agora-near-be
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file and update with your values:

```bash
cp .env.example .env
```

See [Environment Variables](#environment-variables) for detailed configuration.

### 4. Database Setup

Generate Prisma client:

```bash
npm run prisma:generate
```

Run database migrations:

```bash
npm run prisma:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

The server will be running at `http://localhost:8080`

## Environment Variables

### Required

```env
# Database connection string (includes schema and SSL)
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public&sslmode=require"
```

### Application

```env
# Server port (default: 8080)
PORT=8080

# Environment mode
NODE_ENV=development

# Frontend URL for notification links
FRONTEND_URL=https://your-frontend.com
```

### NEAR Network

```env
# FastNEAR RPC API key
FASTNEAR_API_KEY=your_api_key
```

### External APIs

```env
# CoinGecko API key for NEAR price data
COIN_GECKO_API_KEY=your_api_key
```

### Staking Configuration

```env
# APY adjustment factor (default: 0.5 = 50%)
# Accounts for NEAR protocol inflation changes
NEAR_INFLATION_ADJUSTMENT_FACTOR=0.5
```

### Notifications

```env
# Email Service (Mailgun)
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_domain.com
MAILGUN_REGION=us  # or eu
SEND_EMAIL=true

# Discord Bot
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Notification Testing
DEVELOPER_MODE=false  # Enable for test mode
SAFE_MODE=false       # Only send to whitelisted addresses
```

### Monitoring

```env
# Datadog APM (optional)
DD_ENV=production
DD_SERVICE=agora-near-be
DD_VERSION=1.0.0
```

## Database Setup

### Schema Structure

The application uses a multi-schema PostgreSQL database:

#### `web2` Schema (Application Data)

- **delegate_statements**: Delegate profiles, statements, social links, notification preferences
- **cache**: General-purpose cache with TTL (nonces, prices, transaction hashes)
- **draft_proposals**: Draft proposals with staging workflow (DRAFT → AWAITING_SUBMISSION → SUBMITTED)
- **quorum_overrides**: Custom quorum rules for proposals (fixed amount or percentage-based)

#### `fastnear` Schema (Blockchain Data - Read-Only)

- **proposals**: Proposal metadata and voting results
- **approvedProposals**: Approved proposals with timestamps
- **proposalVotingHistory**: Individual votes with voting power breakdown
- **proposalNonVoters**: Registered voters who didn't vote on specific proposals
- **delegationEvents**: Delegation/undelegation transactions
- **registeredVoters**: Voter registration and voting power tracking
- **userActivities**: User actions (locks, unlocks, delegations)
- **fastnear_blocks**: NEAR block metadata
- **fastnear_receipt_actions**: Transaction receipt actions
- **fastnear_execution_outcomes**: Transaction execution results

### Prisma Commands

```bash
# Generate Prisma client (required after schema changes)
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Pull database schema
npm run prisma:pull

# Generate migration diff
npm run prisma:migrateDiff
```

## API Documentation

### Health & System

#### `GET /health`

Health check endpoint

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-12-15T10:00:00.000Z"
}
```

---

### Proposals

#### `GET /api/proposal/approved`

Get approved proposals with pagination

**Query Parameters:**

- `page` (number, default: 1) - Page number
- `page_size` (number, default: 10) - Results per page

**Response:**

```json
{
  "proposals": [...],
  "pagination": {
    "page": 1,
    "page_size": 10,
    "total": 100
  }
}
```

#### `GET /api/proposal/pending`

Get pending (unapproved) proposals

#### `GET /api/proposal/:proposal_id/votes`

Get voting history for a specific proposal

**Query Parameters:**

- `page` (number) - Page number
- `page_size` (number) - Results per page

#### `GET /api/proposal/:proposal_id/non-voters`

Get registered voters who didn't vote on this proposal

#### `GET /api/proposal/:proposal_id/charts`

Get aggregated voting data for charts

**Response:**

```json
{
  "forVotes": 1500000,
  "againstVotes": 500000,
  "abstainVotes": 100000,
  "totalVotes": 2100000
}
```

#### `GET /api/proposal/:proposal_id/quorum`

Get quorum amount for a proposal (includes override logic)

**Response:**

```json
{
  "proposalId": "123",
  "quorumAmount": "7000000",
  "isOverridden": true,
  "overrideType": "fixed"
}
```

---

### Draft Proposals

#### `POST /api/proposal/draft`

Create a new draft proposal (requires signature)

**Request Body:**

```json
{
  "signed_payload": {
    "signature": "...",
    "publicKey": "...",
    "message": "...",
    "payload": {
      "title": "Proposal Title",
      "description": "Proposal description",
      "proposalUrl": "https://...",
      "votingOptions": ["For", "Against", "Abstain"]
    }
  }
}
```

#### `GET /api/proposal/draft`

Get all draft proposals

**Query Parameters:**

- `author` (string, optional) - Filter by author address
- `stage` (string, optional) - Filter by stage (DRAFT, AWAITING_SUBMISSION, SUBMITTED)

#### `GET /api/proposal/draft/:id`

Get specific draft proposal by ID

#### `PUT /api/proposal/draft/:id`

Update a draft proposal (requires signature)

#### `PUT /api/proposal/draft/:id/stage`

Update draft proposal stage (requires signature)

**Request Body:**

```json
{
  "signed_payload": {
    "signature": "...",
    "publicKey": "...",
    "message": "...",
    "payload": {
      "stage": "AWAITING_SUBMISSION",
      "receiptId": "optional_receipt_id"
    }
  }
}
```

#### `DELETE /api/proposal/draft/:id`

Delete a draft proposal (requires signature)

---

### Delegates

#### `GET /api/delegates`

Get all delegates with filtering and sorting

**Query Parameters:**

- `page` (number, default: 1)
- `page_size` (number, default: 10)
- `sort` (string) - Sort by: `most_vp`, `least_vp`, `random_weighted`
- `seed` (string) - Random seed for weighted sorting
- `issue` (string) - Filter by top issue
- `endorsed` (boolean) - Filter by endorsement status

**Response:**

```json
{
  "delegates": [
    {
      "address": "alice.near",
      "statement": "I am committed to...",
      "twitter": "alice_near",
      "discord": "alice#1234",
      "warpcast": "alice",
      "topIssues": ["issue1", "issue2"],
      "agreeCodeConduct": true,
      "endorsed": true,
      "votingPower": "150000"
    }
  ],
  "pagination": {...}
}
```

**Note:** Email addresses are excluded from public responses for privacy.

#### `GET /api/delegates/:address`

Get delegate information by NEAR address

#### `POST /api/delegates/statement`

Create or update delegate statement (requires signature)

**Request Body:**

```json
{
  "signed_payload": {
    "signature": "...",
    "publicKey": "...",
    "message": "...",
    "payload": {
      "statement": "My delegate statement",
      "twitter": "my_twitter",
      "discord": "my_discord",
      "email": "my@email.com",
      "warpcast": "my_warpcast",
      "topIssues": ["issue1", "issue2"],
      "agreeCodeConduct": true,
      "notification_preferences": {
        "wants_proposal_created_email": "opt-in",
        "wants_proposal_ending_soon_email": "opt-in"
      }
    }
  }
}
```

#### `GET /api/delegates/:address/voting-history`

Get delegate's voting history

**Query Parameters:**

- `page` (number)
- `page_size` (number)

#### `GET /api/delegates/:address/delegated-from`

Get addresses that have delegated to this delegate

#### `GET /api/delegates/:address/delegated-to`

Get addresses this delegate has delegated to

#### `GET /api/delegates/:address/hos-activity`

Get delegate's House of Stakers activity (locks/unlocks)

---

### Staking

#### `GET /api/staking/apy`

Get staking APY for NEAR pools

**Query Parameters:**

- `networkId` (required) - Network ID (mainnet or testnet)
- `contractId` (required) - Pool contract address

**Supported Contracts:**

- MetaPool: `meta-pool.near` (mainnet), `meta-v2.pool.testnet` (testnet)
- liNEAR: `linear-protocol.near`

**Response:**

```json
{
  "apy": "0.0825",
  "contractId": "meta-pool.near",
  "networkId": "mainnet",
  "calculatedAt": "2025-12-15T10:00:00.000Z",
  "adjustmentFactor": 0.5
}
```

---

### NEAR Blockchain

#### `GET /api/near/price`

Get current NEAR token price in USD

**Response:**

```json
{
  "price": "3.45",
  "currency": "usd",
  "source": "coingecko",
  "cachedAt": "2025-12-15T10:00:00.000Z"
}
```

**Note:** Prices are cached for 30 minutes.

---

### Nonce Management

#### `POST /api/nonce`

Generate a nonce for message signing

**Request Body:**

```json
{
  "account_id": "alice.near"
}
```

**Response:**

```json
{
  "nonce": "a1b2c3d4e5f6...",
  "expiresIn": 60
}
```

**Note:** Nonces expire after 1 minute.

---

### Transactions

#### `GET /api/transactions/hash`

Get transaction hash from receipt ID

**Query Parameters:**

- `receipt_id` (required) - NEAR receipt ID

**Response:**

```json
{
  "transactionHash": "abc123...",
  "receiptId": "xyz789..."
}
```

---

### RPC Proxy

#### `POST /api/rpc/:networkId`

Proxy JSON-RPC calls to NEAR network

**Path Parameters:**

- `networkId` (mainnet or testnet)

**Request Body:** Standard NEAR JSON-RPC request

#### `POST /api/archival-rpc/:networkId`

Proxy archival RPC calls to NEAR network (for historical data)

**Path Parameters:**

- `networkId` (mainnet or testnet)

**Request Body:** Standard NEAR JSON-RPC request

---

## Authentication

### NEAR Wallet Signature Verification

The API uses NEAR wallet message signing for authentication on protected endpoints.

#### Authentication Flow

1. **Request Nonce**

   ```bash
   POST /api/nonce
   {
     "account_id": "alice.near"
   }
   ```

2. **Sign Message**

   Client signs a message with the following structure:

   ```javascript
   {
     tag: 2147484061,
     message: JSON.stringify(payload),
     nonce: Buffer.from(nonce, 'base64'),
     recipient: "agora-near-be",
     callbackUrl: "optional_callback"
   }
   ```

   The message is:

   - Serialized with Borsh
   - Hashed with SHA256
   - Signed with the wallet's private key

3. **Submit Signed Payload**

   ```bash
   POST /api/delegates/statement
   {
     "signed_payload": {
       "signature": "ed25519:...",
       "publicKey": "ed25519:...",
       "message": "{...}",
       "payload": { ... }
     }
   }
   ```

4. **Server Verification**
   - Retrieves the nonce from cache
   - Verifies the public key belongs to the account (via RPC)
   - Checks the key has "FullAccess" permission
   - Verifies the cryptographic signature
   - Validates the message structure and nonce

### Protected Endpoints

The following endpoints require signature verification:

- `POST /api/delegates/statement` - Create/update delegate statement
- `POST /api/proposal/draft` - Create draft proposal
- `PUT /api/proposal/draft/:id` - Update draft proposal
- `PUT /api/proposal/draft/:id/stage` - Update draft stage
- `DELETE /api/proposal/draft/:id` - Delete draft proposal

## Deployment

### Docker Deployment

#### Build Image

```bash
docker build -t agora-near-be .
```

#### Run Container

```bash
docker run -p 8080:8080 --env-file .env agora-near-be
```

#### Docker Compose

For local development with database:

```bash
docker-compose up
```

### Google Cloud Run

The service is designed for deployment on Google Cloud Run with the included CI/CD workflows.

#### CI/CD Pipelines

- **Unit Tests** (`.github/workflows/unit-tests.yml`) - Run tests on PRs
- **Dev** (`.github/workflows/dev.yml`) - Deploy to development environment
- **Staging** (`.github/workflows/staging.yml`) - Deploy to staging environment
- **Production** (`.github/workflows/prod.yml`) - Deploy to production

### Environment-Specific Configuration

Ensure the following are configured per environment:

- `DATABASE_URL` - Environment-specific database
- `NODE_ENV` - `development`, `staging`, or `production`
- `FRONTEND_URL` - Environment-specific frontend URL
- Notification credentials (if different per environment)
- `DEVELOPER_MODE` / `SAFE_MODE` - Disable in production

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- verifySignature.test.ts
```

### Example Test

```typescript
import { verifySignedPayload } from "./verifySignature";

describe("verifySignedPayload", () => {
  it("should verify valid signature", async () => {
    const payload = {
      signature: "ed25519:...",
      publicKey: "ed25519:...",
      message: '{"data":"test"}',
      payload: { data: "test" },
    };

    const result = await verifySignedPayload(payload, "alice.near", "mainnet");

    expect(result.isValid).toBe(true);
  });
});
```
