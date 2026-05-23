from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.report import SavedReport
from app.models.statement import Transaction
from app.services import analytics_service
from pydantic import BaseModel

router = APIRouter(prefix="/reports", tags=["reports"])


class SaveReportIn(BaseModel):
    name: str
    from_date: date
    to_date: date


@router.get("/generate")
def generate_report(
    from_date: date | None = None,
    to_date: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    if from_date is None:
        from_date = date(today.year, today.month, 1)
    if to_date is None:
        to_date = today

    summary = analytics_service.get_summary(current_user.id, from_date, to_date, db)
    category_breakdown = analytics_service.get_category_breakdown(current_user.id, from_date, to_date, db)
    frequent_places = analytics_service.get_frequent_places(current_user.id, from_date, to_date, db)
    monthly_overview = analytics_service.get_monthly_range_data(current_user.id, from_date, to_date, db)

    txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .filter(Transaction.txn_date >= from_date)
        .filter(Transaction.txn_date <= to_date)
        .order_by(Transaction.txn_date.desc())
        .all()
    )
    transactions = [
        {
            "id": t.id,
            "date": t.txn_date.isoformat(),
            "description": t.description,
            "merchant": t.merchant_name or "",
            "type": t.txn_type,
            "amount": float(t.amount),
            "category": t.category.name if t.category else "Uncategorized",
        }
        for t in txns
    ]

    return {
        "data": {
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "summary": summary,
            "category_breakdown": category_breakdown,
            "frequent_places": frequent_places,
            "monthly_overview": monthly_overview,
            "transactions": transactions,
        }
    }


@router.get("/saved")
def list_saved_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reports = (
        db.query(SavedReport)
        .filter(SavedReport.user_id == current_user.id)
        .order_by(SavedReport.created_at.desc())
        .all()
    )
    return {
        "data": [
            {
                "id": r.id,
                "name": r.name,
                "from_date": r.from_date.isoformat(),
                "to_date": r.to_date.isoformat(),
                "created_at": r.created_at.isoformat(),
            }
            for r in reports
        ]
    }


@router.post("/saved", status_code=201)
def save_report(
    body: SaveReportIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = SavedReport(
        user_id=current_user.id,
        name=body.name,
        from_date=body.from_date,
        to_date=body.to_date,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "data": {
            "id": report.id,
            "name": report.name,
            "from_date": report.from_date.isoformat(),
            "to_date": report.to_date.isoformat(),
            "created_at": report.created_at.isoformat(),
        }
    }


@router.delete("/saved/{report_id}", status_code=204)
def delete_saved_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(SavedReport).filter(
        SavedReport.id == report_id,
        SavedReport.user_id == current_user.id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
