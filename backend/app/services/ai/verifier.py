from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from dataclasses import dataclass, field
import json

TOLERANCE = Decimal("0.05")


@dataclass
class VerificationResult:
    passed: bool
    confidence: float
    errors: list[str] = field(default_factory=list)
    corrected_data: Optional[dict] = None


def _d(val) -> Decimal:
    if val is None:
        return Decimal("0")
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def verify_statement(data: dict, ai_client=None, max_retries: int = 2) -> VerificationResult:
    result = _run_checks(data)
    if result.passed:
        return result

    if ai_client is None or max_retries == 0:
        return result

    # Retry: ask AI to correct the data
    from app.services.ai.prompts import REEXTRACT_WITH_ERRORS_PROMPT
    for _ in range(max_retries):
        try:
            prompt = REEXTRACT_WITH_ERRORS_PROMPT.format(
                extracted_json=json.dumps(data, indent=2, default=str),
                errors="\n".join(f"- {e}" for e in result.errors),
            )
            corrected_raw = await ai_client.complete_json([
                {"role": "user", "content": prompt}
            ])
            recheck = _run_checks(corrected_raw)
            if recheck.passed:
                recheck.corrected_data = corrected_raw
                return recheck
        except Exception:
            pass

    return result


def _run_checks(data: dict) -> VerificationResult:
    errors: list[str] = []
    confidence = 1.0

    txns = data.get("transactions", [])
    opening = _d(data.get("opening_balance"))
    closing = _d(data.get("closing_balance"))

    sum_debits = sum(_d(t["amount"]) for t in txns if t.get("txn_type") == "debit")
    sum_credits = sum(_d(t["amount"]) for t in txns if t.get("txn_type") == "credit")

    # Check 1: Balance equation
    expected_closing = opening + sum_credits - sum_debits
    if abs(expected_closing - closing) > TOLERANCE:
        errors.append(
            f"Balance equation failed: {opening} + {sum_credits} - {sum_debits} = {expected_closing}, "
            f"stated closing = {closing} (diff={abs(expected_closing - closing)})"
        )
        confidence -= 0.35

    # Check 2: Running balance continuity
    if txns and all(t.get("balance_after") is not None for t in txns):
        prev = opening
        for i, txn in enumerate(txns):
            delta = _d(txn["amount"]) if txn.get("txn_type") == "credit" else -_d(txn["amount"])
            expected = prev + delta
            actual = _d(txn.get("balance_after"))
            if abs(expected - actual) > TOLERANCE:
                errors.append(
                    f"Row {i+1} ({txn.get('description', '')[:30]}): "
                    f"expected balance {expected}, got {actual}"
                )
                confidence -= 0.05
            prev = actual

    # Check 3: Chronological order
    dates = [t.get("txn_date") for t in txns if t.get("txn_date")]
    if dates != sorted(dates):
        errors.append("Transactions are not in chronological order")
        confidence -= 0.05

    # Check 4: No zero or negative amounts
    for i, txn in enumerate(txns):
        if _d(txn.get("amount", 0)) <= 0:
            errors.append(f"Row {i+1}: amount must be positive, got {txn.get('amount')}")
            confidence -= 0.05

    confidence = max(0.0, min(1.0, confidence))
    return VerificationResult(passed=len(errors) == 0, confidence=confidence, errors=errors)
