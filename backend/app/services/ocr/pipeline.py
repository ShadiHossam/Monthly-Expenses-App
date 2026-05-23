"""OCR pipeline: preprocess → PaddleOCR → parse → AI fallback if needed."""

from __future__ import annotations
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class OcrResult:
    engine: str  # "paddle" | "ai"
    data: dict   # {opening_balance, closing_balance, transactions: [...]}
    confidence: float
    raw_text: str = ""


async def process_image(image_path: str, ai_client=None, confidence_threshold: float = 0.75) -> OcrResult:
    """
    Full pipeline:
    1. Preprocess image (OpenCV)
    2. Run PaddleOCR
    3. Parse UAE bank format
    4. If confidence low or critical fields missing → AI fallback
    """
    paddle_result: Optional[OcrResult] = None

    try:
        from app.services.ocr.preprocessor import preprocess
        from app.services.ocr.paddle_ocr import run_ocr, average_confidence
        from app.services.ocr.parser import parse_statement

        preprocessed = preprocess(image_path)
        lines = run_ocr(preprocessed)
        avg_conf = average_confidence(lines)
        raw_text = "\n".join(l["text"] for l in lines)

        parsed = parse_statement(lines)

        missing_critical = (
            parsed.get("opening_balance") is None
            or parsed.get("closing_balance") is None
            or not parsed.get("transactions")
        )

        if avg_conf >= confidence_threshold and not missing_critical:
            return OcrResult(engine="paddle", data=parsed, confidence=avg_conf, raw_text=raw_text)

        paddle_result = OcrResult(engine="paddle", data=parsed, confidence=avg_conf, raw_text=raw_text)
        logger.info(f"PaddleOCR confidence {avg_conf:.2f} or missing fields — trying AI fallback")

    except Exception as e:
        logger.warning(f"PaddleOCR failed: {e}")
        raw_text = ""

    # AI fallback
    if ai_client is None:
        if paddle_result:
            return paddle_result
        raise RuntimeError("PaddleOCR failed and no AI client available")

    try:
        return await _ai_fallback(image_path, ai_client, raw_text)
    except Exception as e:
        logger.error(f"AI fallback also failed: {e}")
        if paddle_result:
            return paddle_result
        raise RuntimeError(f"All OCR methods failed: {e}")


async def _ai_fallback(image_path: str, ai_client, raw_text: str = "") -> OcrResult:
    from app.services.ai.prompts import EXTRACT_STATEMENT_PROMPT

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": EXTRACT_STATEMENT_PROMPT},
                ai_client.image_to_message(image_path),
            ],
        }
    ]
    data = await ai_client.complete_json(messages, vision=True)

    # Normalise
    if "transactions" not in data:
        data["transactions"] = []

    return OcrResult(engine="ai", data=data, confidence=0.85, raw_text=raw_text)
