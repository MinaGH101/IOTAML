"""Node catalog and user-node business services."""
from __future__ import annotations

from typing import Any
from uuid import uuid4
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import PermissionDeniedError, ValidationAppError
from app.domains.auth.service import get_current_user
from app.domains.nodes.models import CustomNode
from app.domains.nodes.schemas import CustomNodeCreate
from app.nodes.registry import all_nodes_api, catalog_metadata, get_categories, get_node, node_map


def _port_dict(port: object) -> dict:
    if hasattr(port, 'model_dump'):
        return port.model_dump()
    return dict(port)  # type: ignore[arg-type]


def custom_node_to_api(node: CustomNode, *, include_code: bool = False) -> dict:
    payload = {
        'id': node.id, 'type': node.id, 'name': node.name, 'label': node.name,
        'category': 'User Nodes', 'description': node.description,
        'inputs': list(node.inputs or []), 'outputs': list(node.outputs or []),
        'settingsSchema': [], 'params': [], 'executionMode': 'sandboxed',
        'supportsDynamicParameters': False, 'implemented': bool(node.enabled),
        'comingSoon': False, 'priority': 'User',
        'validationRules': 'Trusted-installation custom Python; disabled by default in production.',
        'isCustom': True, 'owner_username': node.owner_username,
        'created_at': node.created_at.isoformat() if node.created_at else None,
        'updated_at': node.updated_at.isoformat() if node.updated_at else None,
    }
    if include_code:
        payload['code'] = node.code
        payload['template'] = node.template
    return payload


def list_custom_nodes(db: Session, owner_username: str, *, limit: int = 200) -> list[CustomNode]:
    return db.query(CustomNode).filter(CustomNode.owner_username == owner_username).order_by(CustomNode.updated_at.desc(), CustomNode.id.asc()).limit(limit).all()


def create_custom_node(db: Session, owner_username: str, payload: CustomNodeCreate) -> CustomNode:
    if not get_settings().allow_custom_code:
        raise ValidationAppError('CUSTOM_CODE_DISABLED', 'Custom code is disabled for this installation.')
    node = CustomNode(
        id=f'UC-{uuid4().hex[:12]}', owner_username=owner_username,
        name=payload.name.strip(), description=payload.description.strip(),
        inputs=[_port_dict(port) for port in payload.inputs], outputs=[_port_dict(port) for port in payload.outputs],
        code=payload.code, template=payload.template, enabled=True,
    )
    db.add(node); db.commit(); db.refresh(node); return node


def update_custom_node(db: Session, node: CustomNode, payload: CustomNodeCreate) -> CustomNode:
    if not get_settings().allow_custom_code:
        raise ValidationAppError('CUSTOM_CODE_DISABLED', 'Custom code is disabled for this installation.')
    node.name = payload.name.strip(); node.description = payload.description.strip()
    node.inputs = [_port_dict(port) for port in payload.inputs]; node.outputs = [_port_dict(port) for port in payload.outputs]
    node.code = payload.code; node.template = payload.template
    db.commit(); db.refresh(node); return node


def delete_custom_node(db: Session, node: CustomNode, owner_username: str) -> None:
    if node.owner_username != owner_username:
        raise PermissionDeniedError()
    db.delete(node); db.commit()


def get_node_registry() -> list[dict[str, Any]]: return all_nodes_api()
def get_node_map() -> dict[str, dict[str, Any]]: return {node_id: node.to_api() for node_id, node in node_map().items()}
def get_node_categories() -> list[str]: return get_categories()
def get_node_definition(node_id: str) -> dict[str, Any] | None:
    node = get_node(node_id); return node.to_api() if node else None
def get_catalog_metadata() -> dict[str, Any]: return catalog_metadata()
