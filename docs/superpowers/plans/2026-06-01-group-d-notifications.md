# Group D — Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire budget breach email alerts and add an in-app toast when a background upload completes while the user is on a different page.

**Prerequisite:** Group A must be completed first — `EmailService` is defined there (Task A, Step 8). This plan only adds consumers of that service.

**Architecture:** Backend adds a `budget_breach_notifications` table and calls `EmailService` from `BudgetService`. Frontend adds a notification queue in `UploadContext` and drains it as a toast in `AppLayout`.

**Tech Stack:** Java 21 / Spring Boot 3.2.5, React 18 + TypeScript.

---

## Task D1: Budget Breach Email Alerts

**Files:**
- Create: `backend-java/src/main/resources/db/migration/V10__budget_notifications.sql`
- Create: `backend-java/src/main/java/com/expensetracker/model/BudgetBreachNotification.java`
- Create: `backend-java/src/main/java/com/expensetracker/repository/BudgetBreachNotificationRepository.java`
- Modify: `backend-java/src/main/java/com/expensetracker/service/BudgetService.java`

- [ ] **Step 1: Migration**

`V10__budget_notifications.sql`:
```sql
CREATE TABLE budget_breach_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    year INT NOT NULL,
    month INT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, category_id, year, month)
);
```

- [ ] **Step 2: Create `BudgetBreachNotification` entity**

```java
package com.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "budget_breach_notifications")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class BudgetBreachNotification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "category_id", nullable = false)
    private Long categoryId;
    @Column(nullable = false)
    private int year;
    @Column(nullable = false)
    private int month;
    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    @PrePersist
    void prePersist() { if (sentAt == null) sentAt = Instant.now(); }
}
```

- [ ] **Step 3: Create repository**

```java
package com.expensetracker.repository;

import com.expensetracker.model.BudgetBreachNotification;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BudgetBreachNotificationRepository extends JpaRepository<BudgetBreachNotification, Long> {
    boolean existsByUserIdAndCategoryIdAndYearAndMonth(
        Long userId, Long categoryId, int year, int month);
}
```

- [ ] **Step 4: Inject `EmailService` and `BudgetBreachNotificationRepository` into `BudgetService`**

Add to `BudgetService` constructor/fields:
```java
private final EmailService emailService;
private final BudgetBreachNotificationRepository breachNotificationRepository;
private final UserRepository userRepository;
```

- [ ] **Step 5: Fire email in `BudgetService.status()` when budget is exceeded**

Find the point in `BudgetService` where `status` is computed as `"exceeded"` (or `EXCEEDED`). After computing status, add:

```java
if ("exceeded".equals(status)) {
    int year = LocalDate.now().getYear();
    int month = LocalDate.now().getMonthValue();
    boolean alreadySent = breachNotificationRepository
        .existsByUserIdAndCategoryIdAndYearAndMonth(userId, categoryId, year, month);
    if (!alreadySent) {
        breachNotificationRepository.save(BudgetBreachNotification.builder()
            .userId(userId).categoryId(categoryId).year(year).month(month).build());
        // Only send if user has a real email (not a placeholder)
        userRepository.findById(userId).ifPresent(user -> {
            if (user.getEmail() != null && !user.getEmail().endsWith("@noemail.local")) {
                emailService.sendBudgetAlert(user.getEmail(),
                    categoryName, spentThisMonth, monthlyLimit);
            }
        });
    }
}
```

Note: `userId`, `categoryId`, `categoryName`, `spentThisMonth`, `monthlyLimit` are all variables already in scope where the status is computed. Adapt variable names to match the actual `BudgetService` code.

- [ ] **Step 6: Commit**
```bash
git add backend-java/src/main/resources/db/migration/V10__budget_notifications.sql \
        backend-java/src/main/java/com/expensetracker/model/BudgetBreachNotification.java \
        backend-java/src/main/java/com/expensetracker/repository/BudgetBreachNotificationRepository.java \
        backend-java/src/main/java/com/expensetracker/service/BudgetService.java
git commit -m "feat: send budget breach email alert once per category per month via Resend"
```

---

## Task D2: Upload Completion In-App Toast

**Files:**
- Modify: `frontend-react/src/context/UploadContext.tsx`
- Modify: `frontend-react/src/layouts/AppLayout.tsx`

- [ ] **Step 1: Add notification queue to `UploadContext`**

In `UploadContext.tsx`, add to the context state and type:

```tsx
// In context type
notifications: Array<{ filename: string; txnCount: number }>;
clearNotifications: () => void;
```

Add state:
```tsx
const [notifications, setNotifications] = useState<Array<{ filename: string; txnCount: number }>>([]);
```

In the `updateEntry` function (or wherever `status` transitions to `"done"`), detect the transition and enqueue a notification:

```tsx
// When a file transitions to "done" and we're NOT on /upload
setEntries(prev => prev.map(e => {
  if (e.id === id && updates.status === "done" && e.status !== "done") {
    // Enqueue notification
    const txnCount = updates.progress?.message?.match(/(\d+) transaction/)?.[1];
    setNotifications(prev => [...prev, {
      filename: e.file.name,
      txnCount: txnCount ? parseInt(txnCount) : 0
    }]);
  }
  return e.id === id ? { ...e, ...updates } : e;
}));
```

Expose `notifications` and `clearNotifications` in the context value:
```tsx
clearNotifications: () => setNotifications([]),
```

- [ ] **Step 2: Drain notifications as toasts in `AppLayout.tsx`**

Import `useUploadContext` and `useLocation` in `AppLayout.tsx` (both already imported — check first).

Add a toast display component inside `AppLayout`, below the `<Outlet />`:

```tsx
function UploadDoneToasts() {
  const { notifications, clearNotifications } = useUploadContext();
  const location = useLocation();
  const [visible, setVisible] = useState<typeof notifications>([]);

  useEffect(() => {
    // Drain pending notifications on route change (away from /upload)
    if (location.pathname !== "/upload" && notifications.length > 0) {
      setVisible(notifications);
      clearNotifications();
      const timer = setTimeout(() => setVisible([]), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-4 z-40 flex flex-col gap-2">
      {visible.map((n, i) => (
        <div key={i}
          className="flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg
                     bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline
                     text-sm text-ft-on-surface dark:text-ve-on-surface animate-fade-in">
          <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
          <span>
            <strong>{n.filename}</strong>
            {n.txnCount > 0 && <> — {n.txnCount} transactions imported</>}
          </span>
        </div>
      ))}
    </div>
  );
}
```

Add `<UploadDoneToasts />` inside the authenticated layout JSX, right before `</UploadProvider>`.

- [ ] **Step 3: Commit**
```bash
git add frontend-react/src/context/UploadContext.tsx \
        frontend-react/src/layouts/AppLayout.tsx
git commit -m "feat: in-app toast notification when upload completes while on another page"
```

---

## Verification

```bash
# Budget breach email test:
# 1. Set a budget of AED 1 for "Groceries"
# 2. Upload a statement with any grocery transaction
# 3. Check Resend dashboard → budget alert email should appear

# Upload toast test:
# 1. Start an upload → immediately navigate to /dashboard
# 2. Wait for upload to complete
# 3. A green toast should appear at the bottom-left: "filename.pdf — N transactions imported"
# 4. Toast auto-dismisses after 5 seconds
```
