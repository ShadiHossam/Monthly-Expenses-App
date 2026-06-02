# Group C — Transaction Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add individual transaction deletion (backend endpoint + UI delete button). Statement verification errors are covered in Group E (E6).

**Architecture:** One new `DELETE` endpoint in `TransactionController` with ownership validation, one new `deleteById` method in `TransactionService`, and a trash icon on each transaction row in `TransactionsPage`.

**Tech Stack:** Java 21 / Spring Boot 3.2.5, React 18 + TypeScript.

---

## Task C1: DELETE /api/v1/transactions/{id} Endpoint

**Files:**
- Modify: `backend-java/src/main/java/com/expensetracker/controller/TransactionController.java`
- Modify: `backend-java/src/main/java/com/expensetracker/service/TransactionService.java`

- [ ] **Step 1: Add `delete` method to `TransactionService`**

```java
@Transactional
public void deleteById(Long transactionId, Long userId) {
    Transaction txn = transactionRepository.findById(transactionId)
        .orElseThrow(() -> new EntityNotFoundException("Transaction not found"));
    if (!txn.getUserId().equals(userId)) {
        throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
    }
    transactionRepository.delete(txn);
}
```

- [ ] **Step 2: Add `DELETE /{id}` to `TransactionController`**

```java
@DeleteMapping("/{id}")
public ResponseEntity<Void> delete(
        @PathVariable Long id,
        @AuthenticationPrincipal Long userId) {
    transactionService.deleteById(id, userId);
    return ResponseEntity.noContent().build();
}
```

- [ ] **Step 3: Add API method to `frontend-react/src/lib/api.ts`**

```typescript
deleteTransaction: (id: number) =>
  request<void>(`/transactions/${id}`, { method: "DELETE" }),
```

- [ ] **Step 4: Commit backend + API client**
```bash
git add backend-java/src/main/java/com/expensetracker/controller/TransactionController.java \
        backend-java/src/main/java/com/expensetracker/service/TransactionService.java \
        frontend-react/src/lib/api.ts
git commit -m "feat: DELETE /api/v1/transactions/{id} — individual transaction deletion"
```

---

## Task C2: Delete Button in TransactionsPage

**Files:**
- Modify: `frontend-react/src/pages/TransactionsPage.tsx`

- [ ] **Step 1: Add delete state and handler**

```tsx
const [deletingId, setDeletingId] = useState<number | null>(null);
const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

async function handleDeleteTransaction(id: number) {
  setDeletingId(id);
  try {
    await api.deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
    setConfirmDeleteId(null);
  } catch (err: any) {
    alert(err.message || "Failed to delete transaction");
  } finally {
    setDeletingId(null);
  }
}
```

- [ ] **Step 2: Add hover trash icon to each transaction row**

In the transaction row JSX, wrap the row in a `group` div and add an absolutely-positioned trash button that appears on hover:

```tsx
<div key={txn.id} className="relative group flex items-center gap-3 px-4 py-3 hover:bg-ft-surface-low dark:hover:bg-ve-surface-high rounded-xl transition-colors">
  {/* existing row content */}
  {/* Delete button — shows on hover */}
  <button
    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(txn.id); }}
    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity
               w-7 h-7 flex items-center justify-center rounded-lg text-red-500
               hover:bg-red-50 dark:hover:bg-red-900/20"
    title="Delete transaction"
  >
    <span className="material-symbols-outlined text-base">delete</span>
  </button>
</div>
```

- [ ] **Step 3: Add inline confirmation**

When `confirmDeleteId` matches the current row, show a small inline confirmation instead of the delete icon:

```tsx
{confirmDeleteId === txn.id ? (
  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
    <span className="text-xs text-gray-500">Delete?</span>
    <button
      onClick={() => handleDeleteTransaction(txn.id)}
      disabled={deletingId === txn.id}
      className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
    >
      {deletingId === txn.id ? "…" : "Yes"}
    </button>
    <button
      onClick={() => setConfirmDeleteId(null)}
      className="text-xs text-gray-400 hover:underline"
    >
      No
    </button>
  </div>
) : (
  // existing hover trash icon
)}
```

- [ ] **Step 4: Commit**
```bash
git add frontend-react/src/pages/TransactionsPage.tsx
git commit -m "feat: transaction delete button with inline confirmation (hover to reveal)"
```

---

## Verification

```bash
# Start app
docker compose up --build

# Backend: test ownership guard
curl -X DELETE http://localhost:3000/api/v1/transactions/999 \
  -H "Cookie: auth_token=<token_of_different_user>"
# Expected: 403 or 404

# Frontend: hover a transaction row → trash icon appears
# Click → "Delete? Yes / No" appears
# Click Yes → row disappears from the list
# Refresh page → transaction is gone from the DB
```
