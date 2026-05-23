import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from app.models.statement import Transaction, Statement
from app.models.category import Category


def get_summary(user_id: int, from_date: date, to_date: date, db: Session) -> dict:
    txns = _get_txns(user_id, from_date, to_date, db)
    debits = [t for t in txns if t.txn_type == "debit"]
    credits = [t for t in txns if t.txn_type == "credit"]

    total_debits = float(sum(t.amount for t in debits))
    total_credits = float(sum(t.amount for t in credits))

    # Category breakdown
    by_cat: dict[str, float] = defaultdict(float)
    for t in debits:
        name = t.category.name if t.category else "Uncategorized"
        by_cat[name] += float(t.amount)

    top_categories = sorted(
        [{"name": k, "amount": v} for k, v in by_cat.items()],
        key=lambda x: x["amount"], reverse=True
    )[:5]

    biggest = max(debits, key=lambda t: t.amount, default=None)

    # Opening/closing from statements in range
    stmts = (db.query(Statement)
               .filter(Statement.user_id == user_id)
               .filter(Statement.period_end >= from_date)
               .filter(Statement.period_start <= to_date)
               .order_by(Statement.period_start)
               .all())

    opening = float(stmts[0].opening_balance) if stmts and stmts[0].opening_balance else None
    closing = float(stmts[-1].closing_balance) if stmts and stmts[-1].closing_balance else None

    return {
        "total_debits": total_debits,
        "total_credits": total_credits,
        "net": total_credits - total_debits,
        "transaction_count": len(txns),
        "opening_balance": opening,
        "closing_balance": closing,
        "top_categories": top_categories,
        "biggest_expense": {
            "description": biggest.merchant_name or biggest.description,
            "amount": float(biggest.amount),
            "date": biggest.txn_date.isoformat(),
        } if biggest else None,
    }


def get_monthly_data(user_id: int, year: int, db: Session) -> list[dict]:
    all_txns = _get_txns(user_id, date(year, 1, 1), date(year, 12, 31), db)

    by_month: dict[int, dict] = {m: {"debits": [], "credits": []} for m in range(1, 13)}
    for t in all_txns:
        bucket = by_month[t.txn_date.month]
        if t.txn_type == "debit":
            bucket["debits"].append(t)
        else:
            bucket["credits"].append(t)

    results = []
    for month in range(1, 13):
        start = date(year, month, 1)
        debits = by_month[month]["debits"]
        credits = by_month[month]["credits"]
        total_debits = float(sum(t.amount for t in debits))
        total_credits = float(sum(t.amount for t in credits))

        by_cat: dict[str, float] = defaultdict(float)
        for t in debits:
            name = t.category.name if t.category else "Uncategorized"
            by_cat[name] += float(t.amount)

        results.append({
            "month": month,
            "month_label": start.strftime("%b"),
            "total_debits": total_debits,
            "total_credits": total_credits,
            "net": total_credits - total_debits,
            "transaction_count": len(debits) + len(credits),
            "by_category": dict(by_cat),
        })
    return results


def get_quarterly_data(user_id: int, year: int, db: Session) -> list[dict]:
    monthly = get_monthly_data(user_id, year, db)
    quarters = []
    quarter_months = [(1, [1, 2, 3]), (2, [4, 5, 6]), (3, [7, 8, 9]), (4, [10, 11, 12])]
    for q, months in quarter_months:
        q_months = [monthly[m - 1] for m in months]
        quarters.append({
            "quarter": q,
            "label": f"Q{q} {year}",
            "total_debits": sum(m["total_debits"] for m in q_months),
            "total_credits": sum(m["total_credits"] for m in q_months),
            "net": sum(m["net"] for m in q_months),
            "months": q_months,
        })
    return quarters


def get_category_breakdown(user_id: int, from_date: date, to_date: date, db: Session) -> list[dict]:
    txns = _get_txns(user_id, from_date, to_date, db)
    debits = [t for t in txns if t.txn_type == "debit"]
    total = float(sum(t.amount for t in debits)) or 1.0

    by_cat: dict[int | None, dict] = defaultdict(lambda: {"total": 0.0, "count": 0, "cat": None})
    for t in debits:
        key = t.category_id
        by_cat[key]["total"] += float(t.amount)
        by_cat[key]["count"] += 1
        by_cat[key]["cat"] = t.category

    result = []
    for key, data in by_cat.items():
        cat = data["cat"]
        result.append({
            "category_id": key,
            "category_name": cat.name if cat else "Uncategorized",
            "color": cat.color if cat else "#94a3b8",
            "total": data["total"],
            "percentage": round(data["total"] / total * 100, 1),
            "transaction_count": data["count"],
        })
    return sorted(result, key=lambda x: x["total"], reverse=True)


def get_frequent_places(user_id: int, from_date: date, to_date: date, db: Session) -> list[dict]:
    txns = (db.query(Transaction)
              .filter(Transaction.user_id == user_id)
              .filter(Transaction.txn_type == "debit")
              .filter(Transaction.txn_date >= from_date)
              .filter(Transaction.txn_date <= to_date)
              .order_by(Transaction.txn_date)
              .all())

    by_merchant: dict[str, list] = defaultdict(list)
    for t in txns:
        key = t.merchant_name or t.description
        by_merchant[key].append(t)

    frequent = []
    for merchant, merchant_txns in by_merchant.items():
        dates = sorted(t.txn_date for t in merchant_txns)
        total = float(sum(t.amount for t in merchant_txns))
        is_frequent = False
        reason = ""

        # Sliding window O(n) instead of O(n²)
        left = 0
        for right in range(len(dates)):
            while (dates[right] - dates[left]).days > 30:
                left += 1
            if right - left + 1 >= 3:
                is_frequent = True
                reason = f"{right - left + 1}x in 30 days"
                break

        if not is_frequent:
            left = 0
            for right in range(len(dates)):
                while (dates[right] - dates[left]).days > 90:
                    left += 1
                if right - left + 1 >= 6:
                    is_frequent = True
                    reason = f"{right - left + 1}x in 90 days"
                    break

        if is_frequent:
            frequent.append({
                "merchant_name": merchant,
                "visit_count": len(merchant_txns),
                "total_spent": total,
                "avg_spend": round(total / len(merchant_txns), 2),
                "last_visit": max(dates).isoformat(),
                "frequency_reason": reason,
            })

    return sorted(frequent, key=lambda x: x["visit_count"], reverse=True)


def get_monthly_range_data(user_id: int, from_date: date, to_date: date, db: Session) -> list[dict]:
    """Group transactions by (year, month) for any arbitrary date range."""
    txns = _get_txns(user_id, from_date, to_date, db)

    by_ym: dict[tuple[int, int], dict] = {}
    for t in txns:
        key = (t.txn_date.year, t.txn_date.month)
        if key not in by_ym:
            by_ym[key] = {"debits": [], "credits": []}
        if t.txn_type == "debit":
            by_ym[key]["debits"].append(t)
        else:
            by_ym[key]["credits"].append(t)

    results = []
    for (year, month) in sorted(by_ym.keys()):
        start = date(year, month, 1)
        debits = by_ym[(year, month)]["debits"]
        credits = by_ym[(year, month)]["credits"]
        total_debits = float(sum(t.amount for t in debits))
        total_credits = float(sum(t.amount for t in credits))

        by_cat: dict[str, float] = defaultdict(float)
        for t in debits:
            name = t.category.name if t.category else "Uncategorized"
            by_cat[name] += float(t.amount)

        results.append({
            "year": year,
            "month": month,
            "month_label": start.strftime("%b %Y"),
            "total_debits": total_debits,
            "total_credits": total_credits,
            "net": total_credits - total_debits,
            "transaction_count": len(debits) + len(credits),
            "by_category": dict(by_cat),
        })
    return results


def export_csv(user_id: int, from_date: date, to_date: date, category_id: int | None, db: Session) -> str:
    txns = _get_txns(user_id, from_date, to_date, db)
    if category_id is not None:
        txns = [t for t in txns if t.category_id == category_id]

    def _csv_cell(val: str) -> str:
        return '"' + str(val).replace('"', '""') + '"'

    header = ["Date", "Ref Number", "Description", "Merchant", "Type", "Amount (AED)", "Balance After", "Category"]
    rows = [header]
    for t in txns:
        rows.append([
            t.txn_date.isoformat(),
            t.ref_number or "",
            t.description,
            t.merchant_name or "",
            t.txn_type,
            str(t.amount),
            str(t.balance_after) if t.balance_after else "",
            t.category.name if t.category else "Uncategorized",
        ])
    return "\n".join(",".join(_csv_cell(c) for c in row) for row in rows)


def get_balance_trend(user_id: int, db: Session) -> list[dict]:
    """Return closing balance per statement, sorted by period_end."""
    stmts = (db.query(Statement)
               .filter(Statement.user_id == user_id)
               .filter(Statement.closing_balance.isnot(None))
               .order_by(Statement.period_end)
               .all())
    return [
        {
            "period_end": s.period_end.isoformat() if s.period_end else None,
            "period_label": s.period_end.strftime("%b %Y") if s.period_end else "Unknown",
            "closing_balance": float(s.closing_balance),
            "opening_balance": float(s.opening_balance) if s.opening_balance else None,
            "statement_id": s.id,
        }
        for s in stmts
        if s.period_end
    ]


def get_recurring_transactions(user_id: int, db: Session) -> list[dict]:
    """Detect recurring transactions: same merchant + amount appearing in 2+ different calendar months."""
    txns = (db.query(Transaction)
              .filter(Transaction.user_id == user_id)
              .filter(Transaction.txn_type == "debit")
              .options(joinedload(Transaction.category))
              .order_by(Transaction.txn_date)
              .all())

    # Group by (merchant_name, rounded_amount)
    groups: dict[tuple, list] = defaultdict(list)
    for t in txns:
        key = (t.merchant_name or t.description, round(float(t.amount), 0))
        groups[key].append(t)

    recurring = []
    for (merchant, amount), group in groups.items():
        months = {(t.txn_date.year, t.txn_date.month) for t in group}
        if len(months) >= 2:
            latest = max(group, key=lambda t: t.txn_date)
            recurring.append({
                "merchant_name": merchant,
                "amount": float(amount),
                "occurrences": len(group),
                "months_seen": len(months),
                "last_date": latest.txn_date.isoformat(),
                "category_name": latest.category.name if latest.category else "Uncategorized",
                "category_color": latest.category.color if latest.category else "#94a3b8",
                "transactions": [
                    {"id": t.id, "txn_date": t.txn_date.isoformat(), "amount": float(t.amount)}
                    for t in sorted(group, key=lambda x: x.txn_date, reverse=True)[:6]
                ],
            })

    return sorted(recurring, key=lambda x: x["months_seen"], reverse=True)


def get_month_comparison(user_id: int, months: int, db: Session) -> list[dict]:
    """Return per-category spending for each of the last N calendar months."""
    today = date.today()
    results = []
    for i in range(months - 1, -1, -1):
        month_num = today.month - i
        year_num = today.year
        while month_num <= 0:
            month_num += 12
            year_num -= 1
        from_date = date(year_num, month_num, 1)
        last_day = calendar.monthrange(year_num, month_num)[1]
        to_date = date(year_num, month_num, last_day)

        txns = _get_txns(user_id, from_date, to_date, db)
        debits = [t for t in txns if t.txn_type == "debit"]
        total = float(sum(t.amount for t in debits))

        by_cat: dict[str, float] = defaultdict(float)
        for t in debits:
            name = t.category.name if t.category else "Uncategorized"
            by_cat[name] += float(t.amount)

        results.append({
            "month_label": from_date.strftime("%b %Y"),
            "year": year_num,
            "month": month_num,
            "total_debits": total,
            "by_category": dict(by_cat),
        })
    return results


def _get_txns(user_id: int, from_date: date, to_date: date, db: Session) -> list[Transaction]:
    return (db.query(Transaction)
              .options(joinedload(Transaction.category))
              .filter(Transaction.user_id == user_id)
              .filter(Transaction.txn_date >= from_date)
              .filter(Transaction.txn_date <= to_date)
              .order_by(Transaction.txn_date)
              .all())
