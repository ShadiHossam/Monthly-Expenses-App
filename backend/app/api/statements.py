import asyncio
import json
import os
import uuid
from typing import AsyncGenerator

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.services.ai.context import set_user_ai_context
from app.models.category import Category
from app.models.statement import Statement, Transaction
from app.models.subscription import Subscription
from app.models.usage_log import UsageLog
from app.schemas.statement import StatementOut, StatementDetail
from app.services.ai.categorizer import apply_merchant_rules, suggest_category
from app.services.ai.client import ai_client
from app.services.ai.verifier import verify_statement
from app.services.ocr.pipeline import process_image

router = APIRouter(prefix="/statements", tags=["statements"])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_PDF_PAGES = 100

# In-memory SSE queues: statement_id → asyncio.Queue
_sse_queues: dict[int, asyncio.Queue] = {}

# Limit concurrent AI/OCR processing to avoid Groq rate limits
_process_sem = asyncio.Semaphore(2)
_sem_value = 2  # tracks configured concurrency separately from the semaphore internals


def set_process_concurrency(n: int) -> None:
    """Resize the processing semaphore without touching private internals."""
    global _process_sem, _sem_value
    _sem_value = n
    _process_sem = asyncio.Semaphore(n)


async def _sse_emit(stmt_id: int, event: str, data: dict):
    q = _sse_queues.get(stmt_id)
    if q:
        await q.put({"event": event, "data": data})


async def _process_statement(stmt_id: int, image_path: str, user_id: int):
    """Background task: OCR → verify → categorize → update DB."""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        await _sse_emit(stmt_id, "progress", {"step": "preprocessing", "pct": 10, "message": "Enhancing image…"})

        async with _process_sem:
            ocr_result = await process_image(image_path, ai_client, settings.ocr_confidence_threshold)

            await _sse_emit(stmt_id, "progress", {"step": "ocr", "pct": 40, "message": "Extracting text…"})

            data = ocr_result.data

            await _sse_emit(stmt_id, "progress", {"step": "parsing", "pct": 60, "message": "Parsing transactions…"})

            # Verify math
            await _sse_emit(stmt_id, "progress", {"step": "verifying", "pct": 75, "message": "Verifying numbers…"})
            verify_result = await verify_statement(data, ai_client, settings.ai_max_retries)
            if verify_result.corrected_data:
                data = verify_result.corrected_data

        # Derive period from transaction dates
        from datetime import date, datetime
        def _to_date(v):
            if isinstance(v, date):
                return v
            if isinstance(v, str):
                return datetime.strptime(v, "%Y-%m-%d").date()
            return None

        txn_dates = [_to_date(t["txn_date"]) for t in data.get("transactions", []) if t.get("txn_date")]
        txn_dates = [d for d in txn_dates if d is not None]
        period_start = min(txn_dates) if txn_dates else None
        period_end = max(txn_dates) if txn_dates else None

        stmt = db.query(Statement).filter(Statement.id == stmt_id).first()
        if not stmt:
            return

        stmt.opening_balance = data.get("opening_balance")
        stmt.closing_balance = data.get("closing_balance")
        stmt.period_start = period_start
        stmt.period_end = period_end

        # Check for date range overlap with existing statements
        overlap_warning = None
        if period_start and period_end:
            overlapping = db.query(Statement).filter(
                Statement.user_id == user_id,
                Statement.id != stmt_id,
                Statement.period_start.isnot(None),
                Statement.period_end.isnot(None),
                Statement.period_start <= period_end,
                Statement.period_end >= period_start,
            ).first()
            if overlapping:
                overlap_warning = {
                    "statement_id": overlapping.id,
                    "period": f"{overlapping.period_start} to {overlapping.period_end}",
                }

        stmt.verify_status = "passed" if verify_result.passed else ("flagged" if verify_result.errors else "failed")
        stmt.verify_errors = verify_result.errors or None
        stmt.confidence = verify_result.confidence
        stmt.ocr_engine = ocr_result.engine
        stmt.raw_ocr_text = ocr_result.raw_text

        await _sse_emit(stmt_id, "progress", {"step": "categorizing", "pct": 88, "message": "Categorizing merchants…"})

        uncategorized_count = 0
        from datetime import date as _date, datetime as _datetime
        from decimal import Decimal

        for txn_data in data.get("transactions", []):
            merchant = _clean_merchant(txn_data.get("description", ""))
            cat_id, _ = apply_merchant_rules(txn_data.get("description", ""), user_id, db)
            is_cat = cat_id is not None

            txn_date = txn_data.get("txn_date")
            if isinstance(txn_date, str):
                txn_date = _datetime.strptime(txn_date, "%Y-%m-%d").date()

            amount = txn_data.get("amount", 0)
            description = txn_data.get("description", "")
            raw_type = str(txn_data.get("txn_type", "debit")).lower().strip()
            txn_type = raw_type if raw_type in ("debit", "credit") else "debit"

            # Dedup: skip if identical transaction already exists for this user
            exists = db.query(Transaction).filter(
                Transaction.user_id == user_id,
                Transaction.txn_date == txn_date,
                Transaction.amount == Decimal(str(amount)),
                Transaction.description == description,
                Transaction.txn_type == txn_type,
            ).first()
            if exists:
                continue

            if not is_cat:
                uncategorized_count += 1

            txn = Transaction(
                user_id=user_id,
                statement_id=stmt_id,
                txn_date=txn_date,
                ref_number=txn_data.get("ref_number"),
                description=description,
                merchant_name=merchant,
                amount=amount,
                txn_type=txn_type,
                balance_after=txn_data.get("balance_after"),
                category_id=cat_id,
                is_categorized=is_cat,
            )
            db.add(txn)

        # Update the UsageLog with statement_id now that we have it
        log = db.query(UsageLog).filter(
            UsageLog.user_id == user_id,
            UsageLog.statement_id == None,
        ).order_by(UsageLog.id.desc()).first()
        if log:
            log.statement_id = stmt_id
            db.commit()

        await _sse_emit(stmt_id, "complete", {
            "statement_id": stmt_id,
            "verify_status": stmt.verify_status,
            "uncategorized_count": uncategorized_count,
            "transaction_count": len(data.get("transactions", [])),
            "overlap_warning": overlap_warning,
        })

    except Exception as e:
        db.rollback()
        stmt = db.query(Statement).filter(Statement.id == stmt_id).first()
        if stmt:
            stmt.verify_status = "failed"
            stmt.verify_errors = [str(e)]
            db.commit()
        await _sse_emit(stmt_id, "error", {"message": str(e)})
    finally:
        db.close()
        _sse_queues.pop(stmt_id, None)


def _clean_merchant(description: str) -> str:
    """Extract a clean merchant name from raw description."""
    import re
    cleaned = re.sub(r"\s+", " ", description).strip()
    # Remove trailing numbers/codes
    cleaned = re.sub(r"\s+\d{4,}$", "", cleaned)
    return cleaned[:100]


def _count_pdf_pages(file_bytes: bytes) -> int:
    """Return page count from raw PDF bytes without full image conversion."""
    import fitz  # PyMuPDF
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    return len(doc)


def _check_quota(sub: Subscription, pages_needed: int, confirm_overage: bool) -> None:
    """Raise 402 if the user cannot process pages_needed more pages."""
    if sub.pages_used + pages_needed <= sub.pages_limit:
        return  # within quota

    if not sub.overage_enabled:
        raise HTTPException(
            status_code=402,
            detail={
                "message": "Page quota exceeded. Upgrade your plan to continue.",
                "plan": sub.plan,
                "pages_used": sub.pages_used,
                "pages_limit": sub.pages_limit,
                "pages_needed": pages_needed,
                "upgrade_url": "/billing",
            },
        )

    # Business plan — overage allowed but requires explicit confirmation
    if not confirm_overage:
        overage = (sub.pages_used + pages_needed) - sub.pages_limit
        raise HTTPException(
            status_code=402,
            detail={
                "message": "You will exceed your page limit.",
                "overage_confirmation_required": True,
                "overage_pages": overage,
                "overage_cost_usd": round(overage * 0.10, 2),
                "plan": sub.plan,
            },
        )


@router.post("/upload")
async def upload_statement(
    file: UploadFile = File(...),
    confirm_overage: bool = Query(False),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_pdf = file.content_type == "application/pdf" or (file.filename or "").lower().endswith(".pdf")
    is_image = file.content_type and file.content_type.startswith("image/")
    if not is_pdf and not is_image:
        raise HTTPException(status_code=400, detail="Only image or PDF files are accepted")

    # Read file content with a hard cap to prevent memory exhaustion
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_BYTES // 1024 // 1024} MB)")

    # Count pages before saving to enforce quota early
    pages_in_upload = _count_pdf_pages(content) if is_pdf else 1
    if is_pdf and pages_in_upload > MAX_PDF_PAGES:
        raise HTTPException(status_code=400, detail=f"PDF too long ({pages_in_upload} pages, max {MAX_PDF_PAGES})")

    sub = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    if sub is None:
        # Fallback: create Free subscription if somehow missing (e.g. pre-SaaS users)
        from datetime import datetime, timedelta, timezone
        from app.config import PLANS
        now = datetime.now(timezone.utc)
        sub = Subscription(
            user_id=current_user.id,
            plan="free",
            pages_used=0,
            pages_limit=PLANS["free"]["pages"],
            status="active",
            overage_enabled=False,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

    _check_quota(sub, pages_in_upload, confirm_overage)

    # Atomically increment usage now (before background task) to close the race window
    sub.pages_used = sub.pages_used + pages_in_upload
    db.add(UsageLog(user_id=current_user.id, pages_consumed=pages_in_upload, action="upload"))
    db.commit()

    user_dir = os.path.join(settings.upload_dir, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)

    ext = (file.filename or "upload.jpg").rsplit(".", 1)[-1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(user_dir, filename)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # PDF: convert pages to images, create one Statement per page
    if is_pdf:
        from app.services.ocr.pdf_utils import pdf_to_images
        try:
            image_paths = pdf_to_images(file_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read PDF: {e}")

        statement_ids = []
        set_user_ai_context(current_user)
        for i, img_path in enumerate(image_paths):
            stmt = Statement(
                user_id=current_user.id,
                filename=f"{file.filename} (page {i + 1})",
                image_path=img_path,
                verify_status="pending",
            )
            db.add(stmt)
            db.commit()
            db.refresh(stmt)
            q: asyncio.Queue = asyncio.Queue()
            _sse_queues[stmt.id] = q
            asyncio.create_task(_process_statement(stmt.id, img_path, current_user.id))
            statement_ids.append(stmt.id)

        return {"data": {"statement_ids": statement_ids, "page_count": len(image_paths)}}

    # Single image
    stmt = Statement(
        user_id=current_user.id,
        filename=file.filename,
        image_path=file_path,
        verify_status="pending",
    )
    db.add(stmt)
    db.commit()
    db.refresh(stmt)

    q = asyncio.Queue()
    _sse_queues[stmt.id] = q

    set_user_ai_context(current_user)
    asyncio.create_task(_process_statement(stmt.id, file_path, current_user.id))

    return {"data": {"statement_id": stmt.id, "stream_url": f"/api/v1/statements/{stmt.id}/progress"}}


_sse_bearer = HTTPBearer(auto_error=False)


def _get_user_for_sse(
    token: str | None = None,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(_sse_bearer),
):
    from app.models.user import User
    from jose import JWTError, jwt
    raw = token or (credentials.credentials if credentials else None)
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(raw, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/{stmt_id}/progress")
async def statement_progress(
    stmt_id: int,
    current_user=Depends(_get_user_for_sse),
    db: Session = Depends(get_db),
):
    stmt = db.query(Statement).filter(Statement.id == stmt_id, Statement.user_id == current_user.id).first()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    async def event_stream() -> AsyncGenerator[str, None]:
        q = _sse_queues.get(stmt_id)
        if q is None:
            # Already done — send current status
            yield f"event: complete\ndata: {json.dumps({'statement_id': stmt_id, 'verify_status': stmt.verify_status})}\n\n"
            return

        try:
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=30)
                    yield f"event: {msg['event']}\ndata: {json.dumps(msg['data'])}\n\n"
                    if msg["event"] in ("complete", "error"):
                        break
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            # Clean up the queue entry if the client disconnects before completion
            _sse_queues.pop(stmt_id, None)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("", response_model=list[StatementOut])
def list_statements(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmts = (db.query(Statement)
               .filter(Statement.user_id == current_user.id)
               .order_by(Statement.created_at.desc())
               .offset(offset)
               .limit(limit)
               .all())
    return stmts


@router.get("/{stmt_id}", response_model=StatementDetail)
def get_statement(stmt_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = db.query(Statement).filter(Statement.id == stmt_id, Statement.user_id == current_user.id).first()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    return stmt


@router.delete("/{stmt_id}", status_code=204)
def delete_statement(stmt_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = db.query(Statement).filter(Statement.id == stmt_id, Statement.user_id == current_user.id).first()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    if stmt.image_path and os.path.exists(stmt.image_path):
        os.remove(stmt.image_path)
    db.delete(stmt)
    db.commit()


@router.post("/{stmt_id}/reverify")
async def reverify_statement(stmt_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = db.query(Statement).filter(Statement.id == stmt_id, Statement.user_id == current_user.id).first()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    txns = db.query(Transaction).filter(Transaction.statement_id == stmt_id).all()
    data = {
        "opening_balance": float(stmt.opening_balance) if stmt.opening_balance else None,
        "closing_balance": float(stmt.closing_balance) if stmt.closing_balance else None,
        "transactions": [
            {
                "txn_date": t.txn_date.isoformat(),
                "amount": float(t.amount),
                "txn_type": t.txn_type,
                "balance_after": float(t.balance_after) if t.balance_after else None,
                "description": t.description,
            }
            for t in txns
        ],
    }
    set_user_ai_context(current_user)
    result = await verify_statement(data, ai_client, settings.ai_max_retries)
    stmt.verify_status = "passed" if result.passed else "flagged"
    stmt.verify_errors = result.errors or None
    stmt.confidence = result.confidence
    db.commit()
    return {"data": {"verify_status": stmt.verify_status, "errors": result.errors, "confidence": result.confidence}}
