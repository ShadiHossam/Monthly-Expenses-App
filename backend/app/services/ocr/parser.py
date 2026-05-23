"""
UAE bank statement parser — tuned to the known format:

  OPENING BALANCE    <number>         CLOSING BALANCE    <number>

  Date   Ref. Number   Description   Amount (Incl. VAT)   Balance (AED)
  DD/MM/YYYY  P123456789  Merchant name   -124     4,876

Rules:
- Single Amount column: negative = debit, positive = credit
- Balance (AED) column = running balance after transaction
- Opening/closing balance in header (top-right area)
- No totals footer row; derive from transactions
"""

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional


DATE_RE = re.compile(r"^\d{1,2}/\d{1,2}/\d{2,4}$")
REF_RE = re.compile(r"^P\d{6,12}$", re.IGNORECASE)
AMOUNT_RE = re.compile(r"^-?[\d,]+\.?\d*$")
OPENING_RE = re.compile(r"opening\s*balance", re.IGNORECASE)
CLOSING_RE = re.compile(r"closing\s*balance", re.IGNORECASE)
HEADER_COLS = re.compile(r"date.*ref.*description|description.*amount.*balance", re.IGNORECASE)


def _parse_amount(text: str) -> Optional[Decimal]:
    try:
        cleaned = text.replace(",", "").strip()
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _parse_date(text: str) -> Optional[str]:
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(text.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _find_balance_value(lines: list[dict], label_idx: int, page_width: float) -> Optional[Decimal]:
    """
    After finding an OPENING/CLOSING BALANCE label, look for the nearest
    numeric value in subsequent lines that is in the right half of the page.
    """
    label = lines[label_idx]
    label_x = label["x_center"]
    label_y = label["y_center"]

    # Search nearby lines (same y ± 50px, or next few lines)
    candidates = []
    for line in lines:
        if abs(line["y_center"] - label_y) < 60 and line["x_center"] > label_x - 20:
            val = _parse_amount(line["text"])
            if val is not None and line["text"] != label["text"]:
                candidates.append((abs(line["x_center"] - label_x), val))

    # Also look one line below
    for line in lines[label_idx + 1: label_idx + 4]:
        val = _parse_amount(line["text"])
        if val is not None:
            candidates.append((0, val))
            break

    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]


def parse_statement(lines: list[dict]) -> dict:
    if not lines:
        return {"opening_balance": None, "closing_balance": None, "transactions": []}

    page_width = max(l["x_center"] for l in lines) if lines else 1000
    opening_balance: Optional[Decimal] = None
    closing_balance: Optional[Decimal] = None

    # --- Pass 1: find opening/closing balance in header ---
    for i, line in enumerate(lines):
        text = line["text"]
        if OPENING_RE.search(text):
            # Check same line for a number
            nums = re.findall(r"-?[\d,]+\.?\d*", text)
            for n in nums:
                v = _parse_amount(n)
                if v is not None:
                    opening_balance = v
                    break
            if opening_balance is None:
                opening_balance = _find_balance_value(lines, i, page_width)

        if CLOSING_RE.search(text):
            nums = re.findall(r"-?[\d,]+\.?\d*", text)
            for n in nums:
                v = _parse_amount(n)
                if v is not None:
                    closing_balance = v
                    break
            if closing_balance is None:
                closing_balance = _find_balance_value(lines, i, page_width)

    # --- Pass 2: group lines into rows by y-proximity (±8px) ---
    rows: list[list[dict]] = []
    for line in lines:
        placed = False
        for row in rows:
            if abs(row[0]["y_center"] - line["y_center"]) < 12:
                row.append(line)
                placed = True
                break
        if not placed:
            rows.append([line])

    # Sort each row by x position
    for row in rows:
        row.sort(key=lambda l: l["x_center"])

    # --- Pass 3: parse transaction rows ---
    # Detect table header row to determine column x positions
    col_x: dict = {}  # date_x, ref_x, desc_x, amount_x, balance_x
    in_transactions = False
    transactions = []

    for row in rows:
        row_text = " ".join(l["text"] for l in row)

        # Detect column header
        if not in_transactions and HEADER_COLS.search(row_text):
            in_transactions = True
            # Record x positions of key columns from header
            for cell in row:
                t = cell["text"].lower()
                if "date" in t:
                    col_x["date"] = cell["x_center"]
                elif "ref" in t:
                    col_x["ref"] = cell["x_center"]
                elif "description" in t or "particular" in t:
                    col_x["desc"] = cell["x_center"]
                elif "amount" in t or "incl" in t:
                    col_x["amount"] = cell["x_center"]
                elif "balance" in t:
                    col_x["balance"] = cell["x_center"]
            continue

        if not in_transactions:
            continue

        # Check if first cell looks like a date
        if not row:
            continue
        first_text = row[0]["text"].strip()
        if not DATE_RE.match(first_text):
            continue

        date_str = _parse_date(first_text)
        if not date_str:
            continue

        # Extract cells by position
        ref_number = None
        description_parts = []
        amount_val: Optional[Decimal] = None
        balance_val: Optional[Decimal] = None

        # Use column x-positions if detected, else heuristic
        amount_x = col_x.get("amount", page_width * 0.75)
        balance_x = col_x.get("balance", page_width * 0.90)
        desc_x = col_x.get("desc", page_width * 0.30)

        for cell in row[1:]:  # skip date cell (row[0])
            text = cell["text"].strip()
            cx = cell["x_center"]

            # Ref number
            if REF_RE.match(text) and ref_number is None:
                ref_number = text
                continue

            # Amount or Balance column (right side)
            if cx >= amount_x * 0.9:
                val = _parse_amount(text)
                if val is not None:
                    # Rightmost numeric = balance, second-rightmost = amount
                    if cx >= balance_x * 0.9:
                        balance_val = val
                    else:
                        amount_val = val
                    continue

            # Description
            description_parts.append(text)

        if not description_parts and ref_number is None:
            continue

        description = " ".join(description_parts).strip()
        if not description and ref_number:
            description = row_text  # fallback

        # Determine type from sign
        if amount_val is None:
            continue

        if amount_val < 0:
            txn_type = "debit"
            amount = abs(amount_val)
        else:
            txn_type = "credit"
            amount = amount_val

        transactions.append({
            "txn_date": date_str,
            "ref_number": ref_number,
            "description": description or first_text,
            "amount": float(amount),
            "txn_type": txn_type,
            "balance_after": float(balance_val) if balance_val is not None else None,
        })

    return {
        "opening_balance": float(opening_balance) if opening_balance is not None else None,
        "closing_balance": float(closing_balance) if closing_balance is not None else None,
        "transactions": transactions,
    }
