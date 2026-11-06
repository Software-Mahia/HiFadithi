"""The GLB size reader, on tiny GLB files built in memory."""
import math

import pytest

from pipeline.glb import GlbError, read_glb_info

from .glb_factory import box_gltf, make_glb


def test_reads_width_height_depth_in_mm_and_triangles():
    data = make_glb(box_gltf(size=(0.2, 0.3, 0.1), triangles=12))
    info = read_glb_info(data)
    assert (info.width_mm, info.height_mm, info.depth_mm) == (200, 300, 100)
    assert info.triangles == 12
    assert info.size_bytes == len(data)


def test_node_scale_and_translation_are_applied():
    node = {"scale": [2, 2, 2], "translation": [5, 5, 5]}
    info = read_glb_info(make_glb(box_gltf(size=(0.2, 0.3, 0.1), node=node)))
    assert (info.width_mm, info.height_mm, info.depth_mm) == (400, 600, 200)


def test_rotation_swaps_axes():
    s = math.sqrt(0.5)  # 90 degrees about Y: width and depth swap
    info = read_glb_info(make_glb(box_gltf(size=(0.2, 0.3, 0.1), node={"rotation": [0, s, 0, s]})))
    assert (info.width_mm, info.height_mm, info.depth_mm) == (100, 300, 200)


def test_a_node_matrix_is_used():
    matrix = [3, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]  # stretch X by 3
    info = read_glb_info(make_glb(box_gltf(size=(0.2, 0.3, 0.1), node={"matrix": matrix})))
    assert info.width_mm == 600


def test_parent_transforms_apply_to_children():
    gltf = box_gltf(size=(0.2, 0.3, 0.1))
    gltf["nodes"] = [{"children": [1], "scale": [10, 10, 10]}, {"mesh": 0}]
    info = read_glb_info(make_glb(gltf))
    assert info.width_mm == 2000


def test_two_mesh_nodes_make_one_box_and_add_triangles():
    gltf = box_gltf(size=(0.2, 0.2, 0.2), triangles=12)
    gltf["scenes"] = [{"nodes": [0, 1]}]
    gltf["nodes"] = [{"mesh": 0}, {"mesh": 0, "translation": [1, 0, 0]}]
    info = read_glb_info(make_glb(gltf))
    assert info.width_mm == 1200  # from -0.1 to 1.1 m
    assert info.triangles == 24


def test_unindexed_triangles_come_from_the_vertex_count():
    info = read_glb_info(make_glb(box_gltf(indexed=False)))
    assert info.triangles == 8  # 24 vertices / 3


def test_a_binary_chunk_after_the_json_is_fine():
    data = make_glb(box_gltf(), bin_bytes=b"\x01" * 100)
    assert read_glb_info(data).width_mm == 200


@pytest.mark.parametrize(
    "data, message",
    [
        (b"not a model at all", "Not a GLB"),
        (b"glTF" + (1).to_bytes(4, "little") + b"\x00" * 20, "version"),
        (make_glb(box_gltf())[:30], "cut short"),
        (make_glb({"asset": {"version": "2.0"}}), "no geometry"),
    ],
)
def test_unusable_files_give_a_clear_error(data, message):
    with pytest.raises(GlbError, match=message):
        read_glb_info(data)


def test_missing_min_max_is_an_error():
    gltf = box_gltf()
    del gltf["accessors"][0]["min"]
    with pytest.raises(GlbError, match="bounding box"):
        read_glb_info(make_glb(gltf))
