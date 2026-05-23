from __future__ import annotations
from typing import Optional, TYPE_CHECKING
try:
    import numpy as np
    _NP_OK = True
except ImportError:
    _NP_OK = False

_ocr_instance = None


def get_ocr():
    global _ocr_instance
    if _ocr_instance is None:
        from paddleocr import PaddleOCR
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            use_gpu=False,
            det_db_thresh=0.3,
            det_db_box_thresh=0.5,
            rec_batch_num=6,
            enable_mkldnn=True,
        )
    return _ocr_instance


def run_ocr(image: np.ndarray) -> list[dict]:
    """
    Run PaddleOCR on a preprocessed image array.
    Returns list of {text, confidence, bbox, y_center, x_center} sorted top-to-bottom.
    """
    ocr = get_ocr()
    result = ocr.ocr(image, cls=True)
    lines = []
    if result and result[0]:
        for box, (text, conf) in result[0]:
            y_center = (box[0][1] + box[2][1]) / 2
            x_center = (box[0][0] + box[2][0]) / 2
            lines.append({
                "text": text.strip(),
                "confidence": float(conf),
                "bbox": box,
                "y_center": y_center,
                "x_center": x_center,
            })
    lines.sort(key=lambda x: x["y_center"])
    return lines


def average_confidence(lines: list[dict]) -> float:
    if not lines:
        return 0.0
    return sum(l["confidence"] for l in lines) / len(lines)
