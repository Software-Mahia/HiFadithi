"""GLB texture optimisation: smaller files, identical geometry, never a broken model."""
import io
import json
import random
import struct

from PIL import Image

from pipeline.glb import read_glb_info
from pipeline.textures import optimize_glb


def _png(width, height, alpha=None):
    """Noisy texture: large as PNG, much smaller as JPEG (like real scanned textures)."""
    rng = random.Random(width * 1000 + height)
    rgb = bytes(rng.getrandbits(8) for _ in range(width * height * 3))
    img = Image.frombytes("RGB", (width, height), rgb)
    if alpha is not None:
        img = img.convert("RGBA")
        img.putalpha(alpha)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def _glb(images, extra=None):
    """One triangle plus the given embedded images, as a GLB."""
    positions = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
    binary = bytearray(positions)
    views = [{"buffer": 0, "byteOffset": 0, "byteLength": len(positions)}]
    gltf_images = []
    for raw in images:
        binary += b"\x00" * ((4 - len(binary) % 4) % 4)
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(raw)})
        gltf_images.append({"bufferView": len(views) - 1, "mimeType": "image/png"})
        binary += raw
    gltf = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": 3,
                "type": "VEC3",
                "min": [0, 0, 0],
                "max": [1, 1, 0],
            }
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(binary)}],
        "images": gltf_images,
        **(extra or {}),
    }
    json_bytes = json.dumps(gltf).encode()
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    binary += b"\x00" * ((4 - len(binary) % 4) % 4)
    body = struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
    body += struct.pack("<II", len(binary), 0x004E4942) + bytes(binary)
    return b"glTF" + struct.pack("<II", 2, 12 + len(body)) + body


def _images(data):
    length = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20 : 20 + length])
    bin_start = 20 + length + 8
    out = []
    for image in gltf["images"]:
        view = gltf["bufferViews"][image["bufferView"]]
        start = bin_start + view["byteOffset"]
        raw = data[start : start + view["byteLength"]]
        out.append((image["mimeType"], Image.open(io.BytesIO(raw))))
    return out


def test_opaque_png_becomes_smaller_jpeg_and_geometry_is_unchanged():
    original = _glb([_png(300, 300)])
    out, report = optimize_glb(original)
    assert report.images_changed == 1
    assert len(out) < len(original)
    before, after = read_glb_info(original), read_glb_info(out)
    geometry = ("width_mm", "height_mm", "depth_mm", "triangles")
    assert [getattr(after, f) for f in geometry] == [getattr(before, f) for f in geometry]
    (mime, img), = _images(out)
    assert mime == "image/jpeg"
    assert img.size == (300, 300)


def test_large_texture_is_capped_at_max_size():
    out, report = optimize_glb(_glb([_png(400, 200)]), max_size=128)
    assert report.images_changed == 1
    (_, img), = _images(out)
    assert img.size == (128, 64)


def test_translucent_texture_stays_png():
    out, _ = optimize_glb(_glb([_png(200, 200, alpha=120)]), max_size=64)
    (mime, img), = _images(out)
    assert mime == "image/png"
    assert img.mode == "RGBA"
    assert img.size == (64, 64)


def test_several_textures_keep_their_order():
    out, report = optimize_glb(_glb([_png(64, 64), _png(200, 100)]), max_size=100)
    assert report.images_changed == 2
    sizes = [img.size for _, img in _images(out)]
    assert sizes == [(64, 64), (100, 50)]


def test_not_a_glb_is_returned_unchanged():
    data = b"definitely not a model"
    out, report = optimize_glb(data)
    assert out is data
    assert report.images_changed == 0


def test_required_extensions_are_left_alone():
    original = _glb([_png(300, 300)], extra={"extensionsRequired": ["KHR_draco_mesh_compression"]})
    out, report = optimize_glb(original)
    assert out is original
    assert report.images_changed == 0


def test_corrupt_texture_keeps_the_original_model():
    original = _glb([b"\x89PNG\r\n\x1a\nbroken"])
    out, report = optimize_glb(original)
    assert out is original
    assert report.images_changed == 0
