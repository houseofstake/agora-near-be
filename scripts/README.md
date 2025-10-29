# Backend Scripts

## Bulk Endorse Delegates

Marks multiple NEAR addresses as endorsed (or unendorsed) delegates.

### Usage

#### Option 1: Using a file (recommended for many addresses)

1. Create a text file with one address per line:

```txt
alice.near
bob.near
charlie.near
```

2. Run the script:

```bash
npm run script:endorse -- --file=path/to/addresses.txt
```

#### Option 2: Using the default array (for a few addresses)

1. Edit `bulk-endorse-delegates.ts` and add addresses to the `DEFAULT_ADDRESSES` array:

```typescript
const DEFAULT_ADDRESSES: string[] = [
  "alice.near",
  "bob.near",
];
```

2. Run the script:

```bash
npm run script:endorse
```

### Advanced Options

#### Remove endorsements

```bash
npm run script:endorse -- --file=addresses.txt --endorsed=false
```

#### Direct execution with ts-node

```bash
npx ts-node scripts/bulk-endorse-delegates.ts --file=addresses.txt --endorsed=true
```

### File Format

- One address per line
- Lines starting with `#` are treated as comments
- Empty lines are ignored
- See `addresses.example.txt` for reference

### Notes

- Uses the service layer (no direct DB manipulation)
- Only updates delegates with existing `delegate_statements` records
- Safe to re-run - idempotent operations
- Shows count of updated vs. not-found addresses

