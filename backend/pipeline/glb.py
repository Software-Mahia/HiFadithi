"""Read a model's size from a GLB file. Owner: C.

A GLB is a small header, a JSON chunk describing the scene, then a binary chunk with the
actual geometry. We only need the JSON: glTF requires every POSITION accessor to carry its
min and max corner, so the bounding box comes from those, moved by each node's transform.
No 3D library and no vertex reading needed.

glTF units are metres, Y is up. So:
    width  = X extent    height = Y extent    depth = Z extent   (reported in mm)
Meshy's models are not at real-world size. These are the model's own measurements;
the scale against the real object is worked out at verification (D's check_tolerance).
"""
import json
import math
import struct
from dataclasses import dataclass

GLB_MAGIC = b"glTF"
JSON_CHUNK = 0x4E4F534A  # "JSON"
TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN = 4, 5, 6


class GlbError(ValueError):
    """The file is not a GLB we can read. The message is safe to store."""


@dataclass(frozen=True)
class GlbInfo:
    width_mm: float
    height_mm: float
    depth_mm: float
    triangles: int
    size_bytes: int


def read_glb_info(data: bytes) -> GlbInfo:
    gltf = _read_json_chunk(data)
    accessors = gltf.get("accessors") or []
    meshes = gltf.get("meshes") or []
    nodes = gltf.get("nodes") or []

    lo = [math.inf] * 3
    hi = [-math.inf] * 3
    triangles = 0

    for node_index, matrix in _mesh_nodes(gltf, nodes):
        mesh_index = nodes[node_index]["mesh"]
        if not 0 <= mesh_index < len(meshes):
            raise GlbError(f"Node {node_index} points to a mesh that does not exist.")
        for primitive in meshes[mesh_index].get("primitives") or []:
            position = _accessor(accessors, (primitive.get("attributes") or {}).get("POSITION"))
            if position is None:
                continue
            pmin, pmax = position.get("min"), position.get("max")
            if not (isinstance(pmin, list) and isinstance(pmax, list) and len(pmin) >= 3):
                raise GlbError("A mesh has no bounding box (POSITION min/max missing).")
            for corner in _corners(pmin, pmax):
                x, y, z = _apply(matrix, corner)
                for axis, value in enumerate((x, y, z)):
                    lo[axis] = min(lo[axis], value)
                    hi[axis] = max(hi[axis], value)
            triangles += _triangle_count(primitive, position, accessors)

    if lo[0] == math.inf:
        raise GlbError("The model has no geometry.")

    width, height, depth = ((hi[i] - lo[i]) * 1000 for i in range(3))
    return GlbInfo(
        width_mm=round(width, 2),
        height_mm=round(height, 2),
        depth_mm=round(depth, 2),
        triangles=triangles,
        size_bytes=len(data),
    )


# --- file layout -----------------------------------------------------------------------------

def _read_json_chunk(data: bytes) -> dict:
    if len(data) < 20 or data[:4] != GLB_MAGIC:
        raise GlbError("Not a GLB file.")
    version, total_length = struct.unpack_from("<II", data, 4)
    if version != 2:
        raise GlbError(f"Unsupported GLB version {version}; expected 2.")
    if total_length > len(data):
        raise GlbError("The GLB file is cut short.")
    chunk_length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != JSON_CHUNK or 20 + chunk_length > len(data):
        raise GlbError("The GLB file has no readable JSON chunk.")
    try:
        return json.loads(data[20 : 20 + chunk_length].decode("utf-8").rstrip(" \x00"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GlbError("The GLB scene description is not valid JSON.") from exc


def _accessor(accessors: list, index):
    if index is None:
        return None
    if not isinstance(index, int) or not 0 <= index < len(accessors):
        raise GlbError("A mesh points to an accessor that does not exist.")
    return accessors[index]


def _triangle_count(primitive: dict, position: dict, accessors: list) -> int:
    indices = _accessor(accessors, primitive.get("indices"))
    count = (indices or position).get("count", 0)
    mode = primitive.get("mode", TRIANGLES)
    if mode == TRIANGLES:
        return count // 3
    if mode in (TRIANGLE_STRIP, TRIANGLE_FAN):
        return max(count - 2, 0)
    return 0  # points and lines have no triangles


# --- scene walk and transforms -----------------------------------------------------------------

IDENTITY = (1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)  # column-major, like glTF


def _mesh_nodes(gltf: dict, nodes: list):
    """Yield (node index, world matrix) for every node with a mesh in the default scene."""
    scenes = gltf.get("scenes") or []
    if scenes:
        scene = scenes[gltf.get("scene", 0)] if 0 <= gltf.get("scene", 0) < len(scenes) else {}
        roots = scene.get("nodes") or []
    else:  # no scene listed: every node that is not someone's child is a root
        children = {c for n in nodes for c in n.get("children") or []}
        roots = [i for i in range(len(nodes)) if i not in children]

    stack = [(i, IDENTITY) for i in roots]
    seen = set()
    while stack:
        index, parent = stack.pop()
        if not isinstance(index, int) or not 0 <= index < len(nodes) or index in seen:
            raise GlbError("The scene's node tree is broken.")
        seen.add(index)
        node = nodes[index]
        world = _multiply(parent, _local_matrix(node))
        if "mesh" in node:
            yield index, world
        stack.extend((child, world) for child in node.get("children") or [])


def _local_matrix(node: dict):
    if "matrix" in node:
        return tuple(node["matrix"])
    tx, ty, tz = node.get("translation", (0, 0, 0))
    qx, qy, qz, qw = node.get("rotation", (0, 0, 0, 1))
    sx, sy, sz = node.get("scale", (1, 1, 1))
    # Rotation matrix from the quaternion, then scale each column, then translation.
    r = (
        1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy + qz * qw), 2 * (qx * qz - qy * qw),
        2 * (qx * qy - qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz + qx * qw),
        2 * (qx * qz + qy * qw), 2 * (qy * qz - qx * qw), 1 - 2 * (qx * qx + qy * qy),
    )
    return (
        r[0] * sx, r[1] * sx, r[2] * sx, 0,
        r[3] * sy, r[4] * sy, r[5] * sy, 0,
        r[6] * sz, r[7] * sz, r[8] * sz, 0,
        tx, ty, tz, 1,
    )


def _multiply(a, b):
    """a x b for column-major 4x4 matrices."""
    return tuple(
        sum(a[k * 4 + row] * b[col * 4 + k] for k in range(4))
        for col in range(4)
        for row in range(4)
    )


def _apply(m, point):
    x, y, z = point
    return (
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    )


def _corners(pmin, pmax):
    return [
        (x, y, z)
        for x in (pmin[0], pmax[0])
        for y in (pmin[1], pmax[1])
        for z in (pmin[2], pmax[2])
    ]
