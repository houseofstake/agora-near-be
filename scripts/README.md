# Backend Scripts

## Bulk Endorse Delegates

Marks multiple NEAR addresses as endorsed delegates.

### Usage

1. Edit `bulk-endorse-delegates.ts` and add addresses to the `ADDRESSES_TO_ENDORSE` array:

```typescript
const ADDRESSES_TO_ENDORSE: string[] = [
  "alice.near",
  "bob.near",
  "charlie.near",
];
```

2. Run the script:

```bash
npm run script:endorse
```

Or directly with ts-node:

```bash
npx ts-node scripts/bulk-endorse-delegates.ts
```

### Notes

- Uses the service layer (no direct DB manipulation)
- Safe to re-run - uses upsert for idempotency
- Shows success/failure count with error details
- Creates delegate record if it doesn't exist

