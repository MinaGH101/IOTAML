"""Nodes domain repository for the IOTA ML backend."""

from sqlalchemy.orm import Session
from app.domains.nodes.models import CustomNode


class CustomNodeRepository:
    def get(self, db: Session, node_id: str) -> CustomNode | None:
        return db.get(CustomNode, node_id)


custom_node_repository = CustomNodeRepository()
