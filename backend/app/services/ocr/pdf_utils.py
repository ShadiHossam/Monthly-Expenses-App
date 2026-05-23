from __future__ import annotations
import os


def pdf_to_images(pdf_path: str, dpi: int = 200) -> list[str]:
    """Convert each page of a PDF to a PNG image. Returns list of image paths."""
    import fitz

    doc = fitz.open(pdf_path)
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    base = pdf_path.rsplit(".", 1)[0]
    paths = []

    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        out_path = f"{base}_page{i + 1}.png"
        pix.save(out_path)
        paths.append(out_path)

    doc.close()
    return paths
