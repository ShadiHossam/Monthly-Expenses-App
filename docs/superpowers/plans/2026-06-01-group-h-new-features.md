# Group H — New Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Manual Recurring Rules CRUD and Savings Goals — two independent new features. Multi-currency is deferred.

**Architecture:** Each feature follows the same pattern: Flyway migration → JPA entity → Spring Data repository → Service → Controller → API method in `api.ts` → New React page.

**Tech Stack:** Java 21 / Spring Boot 3.2.5, React 18 + TypeScript, Tailwind CSS.

---

## Task H1: Recurring Rules (Manual CRUD)

**Files:**
- Create: `backend-java/src/main/resources/db/migration/V11__recurring_rules.sql`
- Create: `backend-java/src/main/java/com/expensetracker/model/RecurringRule.java`
- Create: `backend-java/src/main/java/com/expensetracker/repository/RecurringRuleRepository.java`
- Create: `backend-java/src/main/java/com/expensetracker/service/RecurringRuleService.java`
- Create: `backend-java/src/main/java/com/expensetracker/controller/RecurringRuleController.java`
- Modify: `frontend-react/src/lib/api.ts`
- Modify: `frontend-react/src/pages/RecurringPage.tsx`

- [ ] **Step 1: Migration**

`V11__recurring_rules.sql`:
```sql
CREATE TABLE recurring_rules (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    merchant_pattern VARCHAR(200),
    expected_amount DECIMAL(12, 2),
    frequency_days INT NOT NULL DEFAULT 30,
    next_expected_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_recurring_rules_user ON recurring_rules(user_id);
```

- [ ] **Step 2: Entity**

```java
package com.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "recurring_rules")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RecurringRule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(nullable = false, length = 100)
    private String label;
    @Column(name = "merchant_pattern", length = 200)
    private String merchantPattern;
    @Column(name = "expected_amount", precision = 12, scale = 2)
    private BigDecimal expectedAmount;
    @Column(name = "frequency_days", nullable = false)
    private int frequencyDays;
    @Column(name = "next_expected_date")
    private LocalDate nextExpectedDate;
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
```

- [ ] **Step 3: Repository**

```java
package com.expensetracker.repository;

import com.expensetracker.model.RecurringRule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RecurringRuleRepository extends JpaRepository<RecurringRule, Long> {
    List<RecurringRule> findByUserIdOrderByCreatedAtDesc(Long userId);
}
```

- [ ] **Step 4: Service**

```java
package com.expensetracker.service;

import com.expensetracker.exception.BusinessException;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.RecurringRule;
import com.expensetracker.repository.RecurringRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RecurringRuleService {

    private final RecurringRuleRepository repo;

    public List<RecurringRule> list(Long userId) {
        return repo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public RecurringRule create(Long userId, Map<String, Object> body) {
        RecurringRule rule = RecurringRule.builder()
            .userId(userId)
            .label((String) body.get("label"))
            .merchantPattern((String) body.get("merchantPattern"))
            .expectedAmount(body.get("expectedAmount") != null
                ? new java.math.BigDecimal(body.get("expectedAmount").toString()) : null)
            .frequencyDays(body.get("frequencyDays") != null
                ? Integer.parseInt(body.get("frequencyDays").toString()) : 30)
            .nextExpectedDate(body.get("nextExpectedDate") != null
                ? java.time.LocalDate.parse((String) body.get("nextExpectedDate")) : null)
            .build();
        return repo.save(rule);
    }

    @Transactional
    public RecurringRule update(Long id, Long userId, Map<String, Object> body) {
        RecurringRule rule = repo.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Rule not found"));
        if (!rule.getUserId().equals(userId))
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        if (body.containsKey("label")) rule.setLabel((String) body.get("label"));
        if (body.containsKey("active")) rule.setActive((Boolean) body.get("active"));
        if (body.containsKey("expectedAmount") && body.get("expectedAmount") != null)
            rule.setExpectedAmount(new java.math.BigDecimal(body.get("expectedAmount").toString()));
        if (body.containsKey("nextExpectedDate") && body.get("nextExpectedDate") != null)
            rule.setNextExpectedDate(java.time.LocalDate.parse((String) body.get("nextExpectedDate")));
        return repo.save(rule);
    }

    @Transactional
    public void delete(Long id, Long userId) {
        RecurringRule rule = repo.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Rule not found"));
        if (!rule.getUserId().equals(userId))
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        repo.delete(rule);
    }
}
```

- [ ] **Step 5: Controller**

```java
package com.expensetracker.controller;

import com.expensetracker.model.RecurringRule;
import com.expensetracker.service.RecurringRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/recurring-rules")
@RequiredArgsConstructor
public class RecurringRuleController {

    private final RecurringRuleService service;

    @GetMapping
    public ResponseEntity<List<RecurringRule>> list(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.list(userId));
    }

    @PostMapping
    public ResponseEntity<RecurringRule> create(
            @AuthenticationPrincipal Long userId,
            @RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId, body));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<RecurringRule> update(
            @PathVariable Long id,
            @AuthenticationPrincipal Long userId,
            @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(service.update(id, userId, body));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal Long userId) {
        service.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 6: Add API methods to `api.ts`**

```typescript
// Recurring Rules
listRecurringRules: () => request<any[]>("/recurring-rules"),
createRecurringRule: (data: {
  label: string; merchantPattern?: string;
  expectedAmount?: number; frequencyDays?: number; nextExpectedDate?: string;
}) => request<any>("/recurring-rules", { method: "POST", body: JSON.stringify(data) }),
updateRecurringRule: (id: number, data: Partial<{ label: string; active: boolean; expectedAmount: number; nextExpectedDate: string }>) =>
  request<any>(`/recurring-rules/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
deleteRecurringRule: (id: number) =>
  request<void>(`/recurring-rules/${id}`, { method: "DELETE" }),
```

- [ ] **Step 7: Add "Manual Rules" section to `RecurringPage.tsx`**

Add state and handlers:
```tsx
const [manualRules, setManualRules] = useState<any[]>([]);
const [showAddForm, setShowAddForm] = useState(false);
const [newRule, setNewRule] = useState({ label: "", merchantPattern: "", expectedAmount: "", frequencyDays: "30", nextExpectedDate: "" });

useEffect(() => {
  api.listRecurringRules().then(setManualRules).catch(() => {});
}, []);

async function handleAddRule(e: React.FormEvent) {
  e.preventDefault();
  const rule = await api.createRecurringRule({
    label: newRule.label,
    merchantPattern: newRule.merchantPattern || undefined,
    expectedAmount: newRule.expectedAmount ? parseFloat(newRule.expectedAmount) : undefined,
    frequencyDays: parseInt(newRule.frequencyDays),
    nextExpectedDate: newRule.nextExpectedDate || undefined,
  });
  setManualRules(prev => [rule, ...prev]);
  setShowAddForm(false);
  setNewRule({ label: "", merchantPattern: "", expectedAmount: "", frequencyDays: "30", nextExpectedDate: "" });
}

async function handleDeleteRule(id: number) {
  await api.deleteRecurringRule(id);
  setManualRules(prev => prev.filter(r => r.id !== id));
}
```

Add a "Manual Rules" section above the auto-detected list:
```tsx
<div className="mb-8">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-base font-semibold text-ft-on-surface dark:text-ve-on-surface">Manual Rules</h2>
    <button onClick={() => setShowAddForm(v => !v)}
      className="flex items-center gap-1 text-sm text-ft-primary dark:text-ve-primary font-medium">
      <span className="material-symbols-outlined text-base">add</span>
      Define recurring
    </button>
  </div>

  {showAddForm && (
    <form onSubmit={handleAddRule}
      className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4 mb-4 flex flex-col gap-3">
      <input required placeholder="Label (e.g. Netflix)" value={newRule.label}
        onChange={e => setNewRule(p => ({...p, label: e.target.value}))}
        className="border rounded-xl px-3 py-2 text-sm" />
      <input placeholder="Merchant pattern (optional)" value={newRule.merchantPattern}
        onChange={e => setNewRule(p => ({...p, merchantPattern: e.target.value}))}
        className="border rounded-xl px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-3">
        <input type="number" placeholder="Amount (AED)" value={newRule.expectedAmount}
          onChange={e => setNewRule(p => ({...p, expectedAmount: e.target.value}))}
          className="border rounded-xl px-3 py-2 text-sm" />
        <input type="number" placeholder="Every N days" value={newRule.frequencyDays}
          onChange={e => setNewRule(p => ({...p, frequencyDays: e.target.value}))}
          className="border rounded-xl px-3 py-2 text-sm" />
      </div>
      <input type="date" placeholder="Next expected date" value={newRule.nextExpectedDate}
        onChange={e => setNewRule(p => ({...p, nextExpectedDate: e.target.value}))}
        className="border rounded-xl px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button type="submit" className="flex-1 bg-ft-primary dark:bg-ve-primary text-white rounded-xl py-2 text-sm font-medium">Add</button>
        <button type="button" onClick={() => setShowAddForm(false)}
          className="flex-1 border rounded-xl py-2 text-sm">Cancel</button>
      </div>
    </form>
  )}

  {manualRules.length === 0 ? (
    <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant py-4">
      No manual rules defined yet.
    </p>
  ) : (
    <div className="space-y-2">
      {manualRules.map(rule => (
        <div key={rule.id}
          className="flex items-center justify-between bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface">{rule.label}</p>
            <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
              Every {rule.frequency_days} days
              {rule.expected_amount && ` · AED ${rule.expected_amount}`}
              {rule.next_expected_date && ` · Next: ${rule.next_expected_date}`}
            </p>
          </div>
          <button onClick={() => handleDeleteRule(rule.id)}
            className="text-red-400 hover:text-red-600 material-symbols-outlined text-base">delete</button>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 8: Commit**
```bash
git add -A
git commit -m "feat: manual recurring rules CRUD — define subscriptions manually on RecurringPage"
```

---

## Task H2: Savings Goals

**Files:**
- Create: `backend-java/src/main/resources/db/migration/V12__savings_goals.sql`
- Create: `backend-java/src/main/java/com/expensetracker/model/SavingsGoal.java`
- Create: `backend-java/src/main/java/com/expensetracker/repository/SavingsGoalRepository.java`
- Create: `backend-java/src/main/java/com/expensetracker/service/SavingsGoalService.java`
- Create: `backend-java/src/main/java/com/expensetracker/controller/SavingsGoalController.java`
- Modify: `frontend-react/src/lib/api.ts`
- Create: `frontend-react/src/pages/SavingsPage.tsx`
- Modify: `frontend-react/src/router.tsx`
- Modify: `frontend-react/src/layouts/AppLayout.tsx`

- [ ] **Step 1: Migration**

`V12__savings_goals.sql`:
```sql
CREATE TABLE savings_goals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount DECIMAL(12, 2) NOT NULL,
    target_date DATE NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#10b981',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_savings_goals_user ON savings_goals(user_id);
```

- [ ] **Step 2: Entity**

```java
package com.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "savings_goals")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SavingsGoal {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(name = "target_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal targetAmount;
    @Column(name = "target_date", nullable = false)
    private LocalDate targetDate;
    @Column(nullable = false, length = 7)
    @Builder.Default
    private String color = "#10b981";
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
```

- [ ] **Step 3: Repository**

```java
package com.expensetracker.repository;

import com.expensetracker.model.SavingsGoal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SavingsGoalRepository extends JpaRepository<SavingsGoal, Long> {
    List<SavingsGoal> findByUserIdOrderByTargetDateAsc(Long userId);
}
```

- [ ] **Step 4: Service**

```java
package com.expensetracker.service;

import com.expensetracker.exception.BusinessException;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.SavingsGoal;
import com.expensetracker.repository.SavingsGoalRepository;
import com.expensetracker.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SavingsGoalService {

    private final SavingsGoalRepository repo;
    private final TransactionRepository transactionRepository;

    public List<Map<String, Object>> listWithProgress(Long userId) {
        return repo.findByUserIdOrderByTargetDateAsc(userId).stream().map(goal -> {
            // Net savings from goal creation date to today
            LocalDate from = goal.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toLocalDate();
            LocalDate to = LocalDate.now();
            BigDecimal totalCredits = transactionRepository
                .sumCreditsBetween(userId, from, to).orElse(BigDecimal.ZERO);
            BigDecimal totalDebits = transactionRepository
                .sumDebitsBetween(userId, from, to).orElse(BigDecimal.ZERO);
            BigDecimal netSaved = totalCredits.subtract(totalDebits);
            if (netSaved.compareTo(BigDecimal.ZERO) < 0) netSaved = BigDecimal.ZERO;

            double pct = goal.getTargetAmount().compareTo(BigDecimal.ZERO) > 0
                ? netSaved.doubleValue() / goal.getTargetAmount().doubleValue() * 100 : 0;

            // Use snake_case keys — Jackson SNAKE_CASE only converts bean properties, not Map keys
            return Map.of(
                "id", goal.getId(),
                "name", goal.getName(),
                "target_amount", goal.getTargetAmount(),
                "target_date", goal.getTargetDate().toString(),
                "color", goal.getColor(),
                "net_saved", netSaved,
                "progress_pct", Math.min(pct, 100)
            );
        }).toList();
    }

    @Transactional
    public SavingsGoal create(Long userId, Map<String, Object> body) {
        return repo.save(SavingsGoal.builder()
            .userId(userId)
            .name((String) body.get("name"))
            .targetAmount(new BigDecimal(body.get("targetAmount").toString()))
            .targetDate(LocalDate.parse((String) body.get("targetDate")))
            .color(body.getOrDefault("color", "#10b981").toString())
            .build());
    }

    @Transactional
    public void delete(Long id, Long userId) {
        SavingsGoal goal = repo.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Goal not found"));
        if (!goal.getUserId().equals(userId))
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        repo.delete(goal);
    }
}
```

Add these two query methods to `TransactionRepository`:
```java
@Query("SELECT SUM(t.amount) FROM Transaction t WHERE t.userId = :userId AND t.txnType = 'credit' AND t.txnDate >= :from AND t.txnDate <= :to")
Optional<BigDecimal> sumCreditsBetween(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

@Query("SELECT SUM(t.amount) FROM Transaction t WHERE t.userId = :userId AND t.txnType = 'debit' AND t.txnDate >= :from AND t.txnDate <= :to")
Optional<BigDecimal> sumDebitsBetween(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);
```

- [ ] **Step 5: Controller**

```java
package com.expensetracker.controller;

import com.expensetracker.model.SavingsGoal;
import com.expensetracker.service.SavingsGoalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/savings-goals")
@RequiredArgsConstructor
public class SavingsGoalController {

    private final SavingsGoalService service;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.listWithProgress(userId));
    }

    @PostMapping
    public ResponseEntity<SavingsGoal> create(
            @AuthenticationPrincipal Long userId,
            @RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId, body));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal Long userId) {
        service.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 6: Add API methods to `api.ts`**

```typescript
// Savings Goals
listSavingsGoals: () => request<any[]>("/savings-goals"),
createSavingsGoal: (data: { name: string; targetAmount: number; targetDate: string; color?: string }) =>
  request<any>("/savings-goals", { method: "POST", body: JSON.stringify(data) }),
deleteSavingsGoal: (id: number) =>
  request<void>(`/savings-goals/${id}`, { method: "DELETE" }),
```

- [ ] **Step 7: Create `SavingsPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatAED } from "../lib/utils";
import { cn } from "../lib/utils";

const COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"];

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", targetAmount: "", targetDate: "", color: "#10b981" });

  useEffect(() => {
    api.listSavingsGoals().then(setGoals).catch(() => setGoals([])).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const goal = await api.createSavingsGoal({
      name: form.name,
      targetAmount: parseFloat(form.targetAmount),
      targetDate: form.targetDate,
      color: form.color,
    });
    setGoals(prev => [...prev, { ...goal, netSaved: 0, progressPct: 0 }]);
    setShowForm(false);
    setForm({ name: "", targetAmount: "", targetDate: "", color: "#10b981" });
    // Refresh to get computed progress
    api.listSavingsGoals().then(setGoals).catch(() => {});
  }

  async function handleDelete(id: number) {
    await api.deleteSavingsGoal(id);
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  if (loading) return (
    <div className="flex justify-center py-24">
      <div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-6 pt-6 pb-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Savings Goals</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Track progress toward financial targets</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ft-primary dark:bg-ve-primary text-white text-sm font-medium">
          <MSIcon name="add" className="text-base" />
          New goal
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate}
          className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-6 flex flex-col gap-3">
          <input required placeholder="Goal name (e.g. Emergency fund)" value={form.name}
            onChange={e => setForm(p => ({...p, name: e.target.value}))}
            className="border rounded-xl px-3 py-2.5 text-sm w-full" />
          <div className="grid grid-cols-2 gap-3">
            <input required type="number" placeholder="Target (AED)" value={form.targetAmount}
              onChange={e => setForm(p => ({...p, targetAmount: e.target.value}))}
              className="border rounded-xl px-3 py-2.5 text-sm" />
            <input required type="date" value={form.targetDate}
              onChange={e => setForm(p => ({...p, targetDate: e.target.value}))}
              className="border rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(p => ({...p, color: c}))}
                className={cn("w-7 h-7 rounded-full border-2 transition-transform",
                  form.color === c ? "border-gray-800 dark:border-white scale-110" : "border-transparent")}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit"
              className="flex-1 bg-ft-primary dark:bg-ve-primary text-white rounded-xl py-2.5 text-sm font-medium">Create</button>
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border rounded-xl py-2.5 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-16 text-center">
          <MSIcon name="savings" className="text-5xl text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-3" />
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">No savings goals yet. Create one to track progress.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => (
            <div key={goal.id}
              className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: goal.color }} />
                    <h3 className="font-semibold text-ft-on-surface dark:text-ve-on-surface">{goal.name}</h3>
                  </div>
                  <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                    Target: {new Date(goal.target_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </p>
                </div>
                <button onClick={() => handleDelete(goal.id)}
                  className="text-gray-400 hover:text-red-500 material-symbols-outlined text-base">delete</button>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-ft-on-surface dark:text-ve-on-surface font-medium">
                  {formatAED(goal.net_saved ?? 0)}
                </span>
                <span className="text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                  of {formatAED(goal.target_amount)}
                </span>
              </div>
              <div className="w-full h-2 bg-ft-surface-low dark:bg-ve-surface-high rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${goal.progress_pct ?? 0}%`, backgroundColor: goal.color }} />
              </div>
              <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1.5 text-right">
                {(goal.progress_pct ?? 0).toFixed(1)}% saved
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Add route and nav**

In `router.tsx`, add:
```tsx
import SavingsPage from "./pages/SavingsPage";
// ...
{ path: "/savings", element: <SavingsPage /> },
```

In `AppLayout.tsx`, add to `FULL_NAV`:
```tsx
{ href: "/savings", label: "Savings", icon: "savings" },
```

- [ ] **Step 9: Commit**
```bash
git add -A
git commit -m "feat: savings goals — create goals with target amount/date, track net progress"
```

---

## Verification

```bash
docker compose up --build

# Recurring rules
# Navigate to /recurring → "Manual Rules" section visible
# Click "Define recurring" → form appears
# Fill in label "Netflix", amount 49.99, every 30 days → Add
# Rule appears in list → delete button removes it

# Savings goals
# Navigate to /savings
# Click "New goal" → form appears
# Fill in name "Emergency Fund", AED 10000, target date next year
# Goal card appears with a progress bar
# Upload a statement → net savings progress updates
```
