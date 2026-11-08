"""Tesseract OCR with OpenCV preprocessing. Imports are lazy so the API boots without it."""

import logging
from statistics import mean

from django.conf import settings

logger = logging.getLogger(__name__)


class OCRUnavailable(Exception):
    pass


def _load():
    try:
        import cv2
        import numpy as np
        import pytesseract
    except ImportError as exc:  # pragma: no cover - image builds install these
        raise OCRUnavailable("OCR dependencies are not installed.") from exc
    return cv2, np, pytesseract


def _preprocess(image_bytes):
    cv2, np, _ = _load()
    buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("The uploaded file is not a readable image.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape[:2]
    if width < 1200:
        scale = 1200 / max(width, 1)
        gray = cv2.resize(gray, (1200, int(height * scale)), interpolation=cv2.INTER_CUBIC)

    # Normalise shadows and contrast: enough for printed cards, no heavy setup.
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    gray = cv2.bilateralFilter(gray, 7, 50, 50)
    threshold = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15,
    )
    return threshold


def extract_text(image_bytes):
    _, _, pytesseract = _load()
    try:
        import pytesseract as pt
        from pytesseract import Output
    except ImportError as exc:  # pragma: no cover
        raise OCRUnavailable("pytesseract is not installed.") from exc

    image = _preprocess(image_bytes)
    config = "--oem 3 --psm 6"
    text = pt.image_to_string(image, lang=settings.OCR_LANGUAGES, config=config)
    data = pt.image_to_data(
        image,
        lang=settings.OCR_LANGUAGES,
        config=config,
        output_type=Output.DICT,
    )
    confidences = []
    for value in data.get("conf", []):
        try:
            score = float(value)
        except (TypeError, ValueError):
            continue
        if score >= 0:
            confidences.append(score)
    confidence = round(mean(confidences), 1) if confidences else 0.0
    return {"raw_text": text.strip(), "confidence": confidence}
