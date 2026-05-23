try:
    import cv2
    import numpy as np
    from PIL import Image
    _DEPS_OK = True
except ImportError:
    _DEPS_OK = False


def preprocess(image_path: str):
    """Load and preprocess a bank statement image for OCR."""
    if not _DEPS_OK:
        raise RuntimeError("OpenCV/numpy not installed — OCR unavailable")
    img = cv2.imread(image_path)
    if img is None:
        # Fallback: use PIL for formats OpenCV struggles with
        pil_img = Image.open(image_path).convert("RGB")
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Upscale if image is too small (target min dimension ~1500px)
    h, w = gray.shape
    if max(h, w) < 1500:
        scale = 1500 / max(h, w)
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Deskew
    gray = _deskew(gray)

    # Adaptive threshold for uneven lighting
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        25, 10,
    )

    # Denoise
    denoised = cv2.fastNlMeansDenoising(thresh, h=10)

    return denoised


def _deskew(gray: np.ndarray) -> np.ndarray:
    coords = np.column_stack(np.where(gray < 128))
    if len(coords) < 100:
        return gray
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    if abs(angle) < 0.3:
        return gray
    h, w = gray.shape
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return rotated
