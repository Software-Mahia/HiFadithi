"""Meshy Multi-Image to 3D. Owner: C.

POST   https://api.meshy.ai/openapi/v1/multi-image-to-3d
GET    https://api.meshy.ai/openapi/v1/multi-image-to-3d/{id}
DELETE https://api.meshy.ai/openapi/v1/multi-image-to-3d/{id}
Header: Authorization: Bearer <MESHY_API_KEY>
"""
from .base import Engine, TaskStatus


class MeshyEngine(Engine):
    def submit(self, image_urls: list[str]) -> str:
        raise NotImplementedError("TODO (C)")

    def get_status(self, task_id: str) -> TaskStatus:
        raise NotImplementedError("TODO (C)")

    def delete(self, task_id: str) -> None:
        raise NotImplementedError("TODO (C)")
