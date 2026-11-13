"""Make GLB models faster to download and display by shrinking their textures. Owner: C.

AI-generated models (Meshy, the FakeEngine sample) are mostly texture: the demo model
has ~2,000 vertices and ~7.9 MB of PNG images. Phones must download and decode every
byte before the model appears, so large lossless textures are the main cause of slow
loading. This module re-encodes embedded images once, when a model is saved:

- opaque images become JPEG (quality 85); images that really use transparency stay PNG
- images larger than MAX_TEXTURE px on their longest side are scaled down
- an image is only replaced when the new bytes are smaller

Geometry, materials, node transforms and everything else in the file are left exactly
as they were; only the image bytes, their bufferViews and mimeType change. Anything
unexpected (external buffers, required extensions, an image that will not decode)
makes the function return the original bytes unchanged, so it can never break a model.
"""
from __future__ import annotations

import io
import json
import logging
import struct
from dataclasses import dataclass

from PIL import Image

logger = logging.getLogger(__name__)

GLB_MAGIC = b"glTF"
JSON_CHUNK = 0x4E4F534A  # "JSON"
BIN_CHUNK = 0x004E4942  # "BIN\0"
MAX_TEXTURE = 2048
JPEG_QUALITY = 85


@dataclass(frozen=True)
class TextureReport:
    before_bytes: int
    after_bytes: int
    images_changed: int

    @property
    def saved_bytes(self) -> int:
        return self.before_bytes - self.after_bytes


def _pad(data: bytes, filler: bytes) -> bytes:
    return data + filler * ((4 - len(data) % 4) % 4)


def _split(data: bytes) -> tuple[dict, bytes]:
    if len(data) < 20 or data[:4] != GLB_MAGIC:
        raise ValueError("not a GLB")
    version, total = struct.unpack_from("<II", data, 4)
    if version != 2 or total > len(data):
        raise ValueError("unsupported GLB header")
    pos, gltf, binary = 12, None, b""
    while pos + 8 <= total:
        length, kind = struct.unpack_from("<II", data, pos)
        body = data[pos + 8 : pos + 8 + length]
        if kind == JSON_CHUNK and gltf is None:
            gltf = json.loads(body.decode("utf-8"))
        elif kind == BIN_CHUNK and not binary:
            binary = bytes(body)
        pos += 8 + length
    if gltf is None:
        raise ValueError("GLB has no JSON chunk")
    return gltf, binary


def _join(gltf: dict, binary: bytes) -> bytes:
    json_bytes = _pad(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ")
    out = struct.pack("<II", len(json_bytes), JSON_CHUNK) + json_bytes
    if binary:
        bin_bytes = _pad(binary, b"\x00")
        out += struct.pack("<II", len(bin_bytes), BIN_CHUNK) + bin_bytes
    return GLB_MAGIC + struct.pack("<II", 2, 12 + len(out)) + out


def _encode(raw: bytes, max_size: int) -> tuple[bytes, str] | None:
    """Re-encode one texture. Returns (bytes, mimeType) or None to keep the original."""
    with Image.open(io.BytesIO(raw)) as img:
        img.load()
        has_alpha = "A" in img.getbands() or "transparency" in img.info
        if has_alpha:
            rgba = img.convert("RGBA")
            # Only keep PNG when some pixel is actually translucent.
            has_alpha = rgba.getchannel("A").getextrema()[0] < 255
            img = rgba if has_alpha else rgba.convert("RGB")
        else:
            img = img.convert("RGB")
        if max(img.size) > max_size:
            scale = max_size / max(img.size)
            size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
            img = img.resize(size, Image.LANCZOS)
        buffer = io.BytesIO()
        if has_alpha:
            img.save(buffer, format="PNG", optimize=True)
            return buffer.getvalue(), "image/png"
        img.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        return buffer.getvalue(), "image/jpeg"


def optimize_glb(data: bytes, max_size: int = MAX_TEXTURE) -> tuple[bytes, TextureReport]:
    """Return a GLB with smaller embedded textures (or the original bytes, unchanged)."""
    unchanged = (data, TextureReport(len(data), len(data), 0))
    try:
        gltf, binary = _split(data)
        images = gltf.get("images") or []
        views = gltf.get("bufferViews") or []
        buffers = gltf.get("buffers") or []
        if not images or not binary or gltf.get("extensionsRequired"):
            return unchanged
        if len(buffers) != 1 or "uri" in buffers[0] or any(v.get("buffer", 0) != 0 for v in views):
            return unchanged

        replacements: dict[int, bytes] = {}
        changed = 0
        for image in images:
            index = image.get("bufferView")
            mime = image.get("mimeType")
            if index is None or index in replacements or mime not in ("image/png", "image/jpeg"):
                continue
            view = views[index]
            start = view.get("byteOffset", 0)
            raw = binary[start : start + view["byteLength"]]
            try:
                encoded = _encode(raw, max_size)
            except Exception:  # noqa: BLE001 - an odd texture just stays as it is
                logger.warning("Texture in bufferView %s not re-encoded; kept as is.", index)
                continue
            if encoded and len(encoded[0]) < len(raw):
                replacements[index] = encoded[0]
                image["mimeType"] = encoded[1]
                changed += 1
        if not changed:
            return unchanged

        # Rebuild the binary chunk view by view (4-byte aligned), swapping in new images.
        new_binary = bytearray()
        for index, view in enumerate(views):
            start = view.get("byteOffset", 0)
            chunk = replacements.get(index, binary[start : start + view["byteLength"]])
            new_binary += b"\x00" * ((4 - len(new_binary) % 4) % 4)
            view["byteOffset"] = len(new_binary)
            view["byteLength"] = len(chunk)
            new_binary += chunk
        buffers[0]["byteLength"] = len(new_binary)

        out = _join(gltf, bytes(new_binary))
        if len(out) >= len(data):
            return unchanged
        return out, TextureReport(len(data), len(out), changed)
    except Exception:  # noqa: BLE001 - never block saving a model over an optimisation
        logger.exception("GLB texture optimisation failed; keeping the original model.")
        return unchanged
