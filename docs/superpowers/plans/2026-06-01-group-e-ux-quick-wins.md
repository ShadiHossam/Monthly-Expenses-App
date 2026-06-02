# Group E — UX Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five frontend-only fixes: dark/light mode toggle, category icon picker, mobile nav additions, remove dead recurring link, and QA undo (requires one small backend endpoint).

**Architecture:** All changes are in `frontend-react/src`. The QA undo adds one backend endpoint and one API method, then a button in `UploadPage`.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, Material Symbols icon font.

---

## Task E1: Dark/Light Mode Toggle

**Files:**
- Modify: `frontend-react/src/layouts/AppLayout.tsx`

- [ ] **Step 1: Add theme init and toggle logic to `AppLayout.tsx`**

Add this `useEffect` at the top of `AppLayout()` (alongside the existing auth check):
```tsx
// Init theme from localStorage on mount
useEffect(() => {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
}, []);
```

Add state and toggle handler:
```tsx
const [isDark, setIsDark] = useState(
  () => document.documentElement.classList.contains("dark")
);

function toggleTheme() {
  const next = !isDark;
  setIsDark(next);
  if (next) document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
  localStorage.setItem("theme", next ? "dark" : "light");
}
```

- [ ] **Step 2: Add toggle button to the sidebar**

In the sidebar JSX, add this button near the bottom (above the logout / settings links):
```tsx
<button
  onClick={toggleTheme}
  title={isDark ? "Switch to light mode" : "Switch to dark mode"}
  className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full
             text-ft-on-surface-variant dark:text-ve-on-surface-variant
             hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors"
>
  <MSIcon name={isDark ? "light_mode" : "dark_mode"} className="text-xl" />
  <span className="text-sm font-medium">{isDark ? "Light mode" : "Dark mode"}</span>
</button>
```

- [ ] **Step 3: Commit**
```bash
git add frontend-react/src/layouts/AppLayout.tsx
git commit -m "feat: dark/light mode toggle with localStorage persistence"
```

---

## Task E2: Category Icon Picker

**Files:**
- Modify: `frontend-react/src/pages/CategoriesPage.tsx`

- [ ] **Step 1: Add icon grid constant at the top of `CategoriesPage.tsx`**

```tsx
const PRESET_ICONS = [
  "shopping_cart", "restaurant", "directions_car", "bolt", "favorite",
  "movie", "shopping_bag", "south", "sync_alt", "autorenew", "label",
  "home", "flight", "local_hospital", "school", "fitness_center",
  "coffee", "local_gas_station", "phone", "wifi", "tv", "savings",
  "credit_card", "receipt_long", "attach_money", "currency_exchange",
  "bar_chart", "beach_access", "pets", "celebration", "build", "more_horiz",
];
```

- [ ] **Step 2: Replace the icon text input with a picker grid**

Find the `<input>` for `icon` in the category creation/edit form. Replace it with:

```tsx
<div>
  <label className="text-xs font-medium text-gray-500 mb-1 block">Icon</label>
  <div className="grid grid-cols-8 gap-1.5 p-3 border rounded-xl bg-ft-surface-low dark:bg-ve-surface-high max-h-32 overflow-y-auto">
    {PRESET_ICONS.map(iconName => (
      <button
        key={iconName}
        type="button"
        onClick={() => setIcon(iconName)}
        title={iconName}
        className={cn(
          "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
          icon === iconName
            ? "bg-ft-primary dark:bg-ve-primary text-white"
            : "hover:bg-ft-surface dark:hover:bg-ve-surface text-ft-on-surface-variant dark:text-ve-on-surface-variant"
        )}
      >
        <span className="material-symbols-outlined text-base">{iconName}</span>
      </button>
    ))}
  </div>
  {/* Fallback custom input */}
  <input
    type="text"
    value={icon}
    onChange={e => setIcon(e.target.value)}
    placeholder="Or type a custom icon name"
    className="mt-1.5 w-full border rounded-xl px-3 py-2 text-xs"
  />
</div>
```

Make sure the `icon` state variable is initialized to `"label"` (a safe default) instead of `""`.

- [ ] **Step 3: Commit**
```bash
git add frontend-react/src/pages/CategoriesPage.tsx
git commit -m "feat: category icon picker grid with 32 preset Material Symbols icons"
```

---

## Task E3: Mobile Nav — Add Categories & Merchants

**Files:**
- Modify: `frontend-react/src/layouts/AppLayout.tsx`

- [ ] **Step 1: Update `MOBILE_NAV` array**

Find `const MOBILE_NAV = [...]` in `AppLayout.tsx`. Replace with:
```tsx
const MOBILE_NAV = [
  { href: "/dashboard",    label: "Home",       icon: "home" },
  { href: "/upload",       label: "Upload",     icon: "upload" },
  { href: "/transactions", label: "Txns",       icon: "receipt_long" },
  { href: "/analytics",    label: "Analytics",  icon: "bar_chart" },
  { href: "/categories",   label: "Categories", icon: "category" },
  { href: "/merchants",    label: "Merchants",  icon: "storefront" },
  { href: "/budget",       label: "Budget",     icon: "account_balance_wallet" },
  { href: "/settings",     label: "Settings",   icon: "settings" },
];
```

- [ ] **Step 2: Adjust mobile nav label size if needed**

If the nav labels overflow, add `text-[10px]` to the label `<span>` in the mobile nav render (instead of `text-xs`). This ensures 8 items fit across the bottom bar on a 375px iPhone screen.

- [ ] **Step 3: Commit**
```bash
git add frontend-react/src/layouts/AppLayout.tsx
git commit -m "feat: add Categories and Merchants to mobile bottom nav"
```

---

## Task E4: Remove Dead Recurring "Manual Setup" Link

**Files:**
- Modify: `frontend-react/src/pages/RecurringPage.tsx`

- [ ] **Step 1: Find and remove the dead button**

Search `RecurringPage.tsx` for "View Manual Setup" or similar text. Remove the button/link element entirely. If it's inside an empty-state card, replace it with a plain informational line:

```tsx
<p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">
  Upload bank statements to auto-detect recurring charges.
</p>
```

- [ ] **Step 2: Commit**
```bash
git add frontend-react/src/pages/RecurringPage.tsx
git commit -m "fix: remove dead 'View Manual Setup' link from RecurringPage"
```

---

## Task E5: QA Undo Last Answer

**Files:**
- Modify: `backend-java/src/main/java/com/expensetracker/controller/QaController.java` (or wherever QA endpoints live)
- Modify: `backend-java/src/main/java/com/expensetracker/service/QaService.java`
- Modify: `frontend-react/src/lib/api.ts`
- Modify: `frontend-react/src/pages/UploadPage.tsx`

- [ ] **Step 1: Find the QA model/entity**

Run:
```bash
find backend-java/src -name "*.java" | xargs grep -l "qa\|QA\|pending" | head -20
```

The QA items are likely stored with a status field. Identify the entity (e.g. `QaItem`) and its repository.

- [ ] **Step 2: Add `unanswer` endpoint to QA service**

In the QA service, add:
```java
@Transactional
public void unanswer(Long questionId, Long userId) {
    QaItem item = qaItemRepository.findById(questionId)
        .orElseThrow(() -> new EntityNotFoundException("QA item not found"));
    if (!item.getUserId().equals(userId)) {
        throw new BusinessException("Not your QA item", HttpStatus.FORBIDDEN);
    }
    item.setStatus("pending");
    item.setCategoryId(null);
    qaItemRepository.save(item);
}
```

- [ ] **Step 3: Add endpoint to QA controller**

```java
@PostMapping("/unanswer/{id}")
public ResponseEntity<Void> unanswer(
        @PathVariable Long id,
        @AuthenticationPrincipal Long userId) {
    qaService.unanswer(id, userId);
    return ResponseEntity.noContent().build();
}
```

- [ ] **Step 4: Add API method to `api.ts`**

```typescript
unanswerQA: (questionId: number) =>
  request<void>(`/qa/unanswer/${questionId}`, { method: "POST" }),
```

- [ ] **Step 5: Add "← Back" button in `UploadPage.tsx` QA step**

In the QA categorization step of `UploadPage.tsx`, find where the current question index (`currentQAIndex` or similar) is used to display the question. Add a Back button:

```tsx
{currentQAIndex > 0 && (
  <button
    type="button"
    onClick={async () => {
      const prevItem = qaItems[currentQAIndex - 1];
      await api.unanswerQA(prevItem.id);
      setCurrentQAIndex(prev => prev - 1);
    }}
    className="flex items-center gap-1 text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant"
  >
    <span className="material-symbols-outlined text-base">arrow_back</span>
    Back
  </button>
)}
```

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat: QA undo — back button to re-answer previous merchant categorization"
```

---

## Task E6: Statement Verification Error Display

**Files:**
- Modify: `frontend-react/src/pages/StatementsPage.tsx`

- [ ] **Step 1: Add error modal state**

```tsx
const [errorStatement, setErrorStatement] = useState<Statement | null>(null);
```

- [ ] **Step 2: Make "failed" badge clickable**

Find the status badge for `verify_status === "failed"` in `StatementsPage.tsx`. Wrap it or replace it:

```tsx
{stmt.verify_status === "failed" ? (
  <button
    onClick={() => setErrorStatement(stmt)}
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 cursor-pointer hover:opacity-80"
  >
    <span className="material-symbols-outlined text-xs">error</span>
    failed
  </button>
) : (
  // existing badge for other statuses
)}
```

- [ ] **Step 3: Add error modal**

```tsx
{errorStatement && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-base">Verification Errors</h3>
        <button onClick={() => setErrorStatement(null)}
          className="material-symbols-outlined text-gray-400 hover:text-gray-600">close</button>
      </div>
      <p className="text-xs text-gray-500 mb-3">{errorStatement.filename}</p>
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {parseErrors(errorStatement.verify_errors).map((e, i) => (
          <li key={i} className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {e}
          </li>
        ))}
      </ul>
      <button onClick={() => setErrorStatement(null)}
        className="mt-4 w-full border rounded-xl py-2 text-sm">Close</button>
    </div>
  </div>
)}
```

Add the `parseErrors` helper at the top of the component:
```tsx
function parseErrors(raw: any): string[] {
  if (!raw) return ["Unknown error"];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
      return [String(parsed)];
    } catch {
      return [raw];
    }
  }
  if (Array.isArray(raw)) return raw.map(String);
  return [JSON.stringify(raw)];
}
```

- [ ] **Step 4: Commit**
```bash
git add frontend-react/src/pages/StatementsPage.tsx
git commit -m "feat: show statement verification errors in a modal (click the 'failed' badge)"
```
