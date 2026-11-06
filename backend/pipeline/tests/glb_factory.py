"""Build tiny GLB files in memory for tests. Only the JSON chunk matters to our reader."""
import json
import struct


def make_glb(gltf: dict, bin_bytes: bytes = b"") -> bytes:
    body = json.dumps(gltf).encode("utf-8")
    body += b" " * (-len(body) % 4)  # chunks are padded to 4 bytes
    chunks = struct.pack("<II", len(body), 0x4E4F534A) + body
    if bin_bytes:
        bin_bytes += b"\x00" * (-len(bin_bytes) % 4)
        chunks += struct.pack("<II", len(bin_bytes), 0x004E4942) + bin_bytes
    return b"glTF" + struct.pack("<II", 2, 12 + len(chunks)) + chunks


def box_gltf(size=(0.2, 0.3, 0.1), node=None, triangles=12, indexed=True) -> dict:
    """One mesh: a box of `size` metres centred on the origin, placed by `node`."""
    half = [s / 2 for s in size]
    accessors = [{
        "componentType": 5126, "type": "VEC3", "count": 24,
        "min": [-h for h in half], "max": half,
    }]
    primitive = {"attributes": {"POSITION": 0}}
    if indexed:
        accessors.append({"componentType": 5123, "type": "SCALAR", "count": triangles * 3})
        primitive["indices"] = 1
    return {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, **(node or {})}],
        "meshes": [{"primitives": [primitive]}],
        "accessors": accessors,
    }
