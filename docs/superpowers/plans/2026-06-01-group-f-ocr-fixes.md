# Group F — OCR / AI Pipeline Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `TesseractParser` null return path and add per-user upload rate limiting to prevent OCR abuse.

**Architecture:** Backend-only changes in two files. No frontend changes needed.

**Tech Stack:** Java 21 / Spring Boot 3.2.5.

---

## Task F1: Fix TesseractParser Null Return Path

**Files:**
- Modify: `backend-java/src/main/java/com/expensetracker/service/TesseractParser.java`

Context: `TesseractParser.extractText()` (lines 43–81) already throws `RuntimeException` on error — the AI fallback in `StatementService` catches this and falls through to the AI provider. The `parse()` method (lines 83–128) returns an empty list if no transactions found — that's fine. There is no actual `return null` in the current code. However, `parseDate()` returns `null` and is guarded by `if (date == null) continue;`. The reported "null path" was the `parseDate` return — that path is already handled.

**Action:** Add a defensive check in `extractText` to throw explicitly if Tesseract returns empty text (which the caller would interpret as "no data, fall back to AI"):

- [ ] **Step 1: Add empty-output guard in `extractText`**

In `TesseractParser.extractText()`, after `String text = Files.readString(txtFile);`, add:
```java
if (text == null || text.isBlank()) {
    throw new RuntimeException("Tesseract produced empty output — falling back to AI");
}
```

This ensures the AI fallback in `StatementService` is triggered cleanly rather than passing an empty string to `parse()`.

- [ ] **Step 2: Verify fallback path in StatementService**

Search for where `tesseractParser.extractText()` is called:
```bash
grep -n "tesseractParser\|TesseractParser" backend-java/src/main/java/com/expensetracker/service/StatementService.java
```

Confirm the call is inside a try-catch that falls through to the AI provider. If it's not, wrap it:
```java
List<OcrService.TransactionDTO> transactions;
try {
    String rawText = tesseractParser.extractText(imageBytes, mimeType);
    transactions = tesseractParser.parse(rawText);
    if (transactions.isEmpty()) {
        throw new RuntimeException("Tesseract found 0 transactions — falling back to AI");
    }
} catch (RuntimeException e) {
    log.warn("Tesseract failed ({}), falling back to AI", e.getMessage());
    transactions = ocrService.extractTransactions(imageBytes, mimeType);
}
```

- [ ] **Step 3: Commit**
```bash
git add backend-java/src/main/java/com/expensetracker/service/TesseractParser.java \
        backend-java/src/main/java/com/expensetracker/service/StatementService.java
git commit -m "fix: TesseractParser throws on empty output — ensures clean AI fallback"
```

---

## Task F2: OCR Upload Rate Limiting

**Files:**
- Modify: `backend-java/src/main/java/com/expensetracker/controller/StatementController.java`

- [ ] **Step 1: Add rate limiter field to `StatementController`**

```java
private final ConcurrentHashMap<Long, Deque<Instant>> uploadTimestamps = new ConcurrentHashMap<>();
```

- [ ] **Step 2: Add rate-check method**

```java
private void checkUploadRateLimit(Long userId) {
    Instant now = Instant.now();
    Instant windowStart = now.minusSeconds(60);
    Deque<Instant> times = uploadTimestamps.computeIfAbsent(userId, k -> new ArrayDeque<>());
    synchronized (times) {
        // Remove entries outside the 60s window
        while (!times.isEmpty() && times.peekFirst().isBefore(windowStart)) {
            times.pollFirst();
        }
        if (times.size() >= 5) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "Too many uploads. Please wait before uploading more files.");
        }
        times.addLast(now);
    }
}
```

Add the import: `import java.util.ArrayDeque; import java.util.Deque;`

- [ ] **Step 3: Call the check in the upload endpoint**

At the top of the `upload()` controller method, before the quota check, add:
```java
checkUploadRateLimit(userId);
```

- [ ] **Step 4: Commit**
```bash
git add backend-java/src/main/java/com/expensetracker/controller/StatementController.java
git commit -m "feat: per-user upload rate limiting (max 5 uploads/60s) to prevent OCR abuse"
```

---

## Task F3: AI FAB Upgrade Prompt for Free Tier

**Files:**
- Modify: `frontend-react/src/components/AskAIModal.tsx`

- [ ] **Step 1: Catch 403 in the AI chat call and show upgrade card**

In `AskAIModal.tsx`, find where `api.askAI(...)` is called. Wrap the call to catch a 403:

```tsx
try {
  const res = await api.askAI(message, fromDate, toDate);
  // ... display response
} catch (err: any) {
  if (err.message?.includes("403") || err.message?.toLowerCase().includes("forbidden") ||
      err.message?.toLowerCase().includes("paid") || err.message?.toLowerCase().includes("plan")) {
    setUpgradeRequired(true);
  } else {
    setError(err.message || "Something went wrong");
  }
}
```

Add state: `const [upgradeRequired, setUpgradeRequired] = useState(false);`

- [ ] **Step 2: Render upgrade card instead of error**

In the modal body, when `upgradeRequired` is true, show:
```tsx
{upgradeRequired && (
  <div className="flex flex-col items-center gap-3 py-8 text-center px-4">
    <span className="material-symbols-outlined text-4xl text-amber-500">workspace_premium</span>
    <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface">
      AI chat requires Solo or higher
    </p>
    <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">
      Upgrade your plan to chat with AI about your spending.
    </p>
    <a href="/billing"
      className="mt-2 px-5 py-2 rounded-xl bg-ft-primary dark:bg-ve-primary text-white text-sm font-medium">
      View plans →
    </a>
  </div>
)}
```

- [ ] **Step 3: Commit**
```bash
git add frontend-react/src/components/AskAIModal.tsx
git commit -m "feat: show upgrade prompt instead of 403 error when Free user opens AI chat"
```
