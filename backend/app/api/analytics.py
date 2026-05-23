from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _default_range():
    today = date.today()
    return date(today.year, today.month, 1), today


@router.get("/summary")
def summary(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not from_date or not to_date:
        from_date, to_date = _default_range()
    data = analytics_service.get_summary(current_user.id, from_date, to_date, db)
    return {"data": data}


@router.get("/monthly")
def monthly(
    year: int = Query(default=None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if year is None:
        year = date.today().year
    data = analytics_service.get_monthly_data(current_user.id, year, db)
    return {"data": data}


@router.get("/quarterly")
def quarterly(
    year: int = Query(default=None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if year is None:
        year = date.today().year
    data = analytics_service.get_quarterly_data(current_user.id, year, db)
    return {"data": data}


@router.get("/category-breakdown")
def category_breakdown(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not from_date or not to_date:
        from_date, to_date = _default_range()
    data = analytics_service.get_category_breakdown(current_user.id, from_date, to_date, db)
    return {"data": data}


@router.get("/frequent-places")
def frequent_places(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not from_date or not to_date:
        from_date = date(date.today().year, 1, 1)
        to_date = date.today()
    data = analytics_service.get_frequent_places(current_user.id, from_date, to_date, db)
    return {"data": data}


@router.get("/export/csv")
def export_csv(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    category_id: Optional[int] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not from_date or not to_date:
        from_date = date(date.today().year, 1, 1)
        to_date = date.today()
    csv_content = analytics_service.export_csv(current_user.id, from_date, to_date, category_id, db)
    filename = f"expenses_{from_date}_{to_date}.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/balance-trend")
def balance_trend(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = analytics_service.get_balance_trend(current_user.id, db)
    return {"data": data}


@router.get("/recurring")
def recurring_transactions(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = analytics_service.get_recurring_transactions(current_user.id, db)
    return {"data": data}


@router.get("/month-comparison")
def month_comparison(
    months: int = Query(default=6, ge=2, le=12),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = analytics_service.get_month_comparison(current_user.id, months, db)
    return {"data": data}
