# Code Slop Patterns

Programming antipatterns common in AI-generated code.

## High-Confidence Slop

### Generic naming

| Slop | Fix |
|------|-----|
| `data`, `data2` | `users`, `orderPayload`, `prayerTimes` |
| `result`, `res` | `validatedUser`, `apiResponse` |
| `temp`, `tmp` | `pendingOrder`, `cachedEntry` |
| `item`, `obj` | `member`, `subscription`, `event` |
| `val`, `value` | `maxRetries`, `expiryDate` |
| `handleClick` | `submitRegistration`, `toggleSidebar` |
| `processData` | `normalisePrayerTimes`, `parseWebhook` |
| `manageUsers` | `suspendMember`, `assignPlan` |
| `utils`, `helpers` (file) | Split by domain: `date-utils.ts`, `auth-helpers.ts` |
| `Manager`, `Handler`, `Service` (no domain) | `SubscriptionService`, `WebhookHandler` |

### Obvious comments

```typescript
// BAD — restates code
// Get the user by ID
const user = await getUserById(id);

// BAD — changelog in comments
// Added validation for email - 2024-01-15

// GOOD — explains why
// Stripe requires amount in pence, not pounds
const amountPence = Math.round(amountGbp * 100);
```

**Delete comments that:**
- Restate the next line of code
- Describe what a well-named function already says
- Mark obvious control flow ("loop through items")

**Keep comments that:**
- Explain non-obvious business rules
- Document external API quirks
- Warn about intentional deviations from convention

### Over-engineering

| Slop | Fix |
|------|-----|
| Factory for one implementation | Direct instantiation |
| Strategy pattern with one strategy | Inline logic |
| Abstract base class with one child | Concrete class |
| Wrapper function that only calls one function | Call directly |
| Generic `<T>` with only one type ever used | Concrete type |
| Config object for 2 parameters | Named parameters |
| Middleware chain for single transform | Single function |

### Defensive slop

```typescript
// BAD — try/catch around everything
try {
  return user.name;
} catch {
  return null;
}

// GOOD — handle expected failures at boundaries
if (!user) return null;
return user.name;
```

- Empty catch blocks
- `any` to silence TypeScript
- Optional chaining 5 levels deep instead of fixing data shape

### Boilerplate bloat

- Excessive interfaces mirroring API response exactly (use types + pick fields needed)
- `// TODO: implement` stubs left in delivered code
- Console.log debugging left in production paths
- Imports for unused symbols

## Medium-Confidence Slop

| Pattern | When acceptable |
|---------|-----------------|
| `index` as loop variable | Simple numeric iteration |
| `callback` parameter name | Actual callback API (Node streams) |
| `Service` suffix | Established project convention |
| Verbose error messages | User-facing API errors |
| Builder pattern | Complex object with many optional fields |

## Language-Specific Tells

### JavaScript / TypeScript

- `// @ts-ignore` without explanation
- `as any` casts (especially expo-router — project may allow with comment)
- `useEffect` with missing cleanup for intervals/listeners
- Inline styles when project uses design tokens
- `console.log` instead of project logger

### Python

- `except Exception: pass`
- Type hints as comments instead of annotations
- `dict` return instead of dataclass/TypedDict for structured data

### React

- `useState` for server data (use TanStack Query / Redux thunks per project)
- Massive components (>400 lines) without extraction
- `React.FC` with no benefit over plain function

## Refactoring Workflow

1. **Rename** — Generic variables and functions first (IDE rename is safe)
2. **Delete comments** — Remove obvious ones
3. **Flatten** — Remove unnecessary abstraction layers
4. **Type** — Replace `any` with proper types
5. **Test** — Run tests after each batch of renames

## Review Checklist

- [ ] No single-letter variables except loop indices in tight loops
- [ ] Function names describe action + object
- [ ] No commented-out code blocks
- [ ] Error handling at system boundaries, not every line
- [ ] Matches existing project patterns (imports, naming, structure)
- [ ] No features/abstractions beyond what the task required
