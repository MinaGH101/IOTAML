from __future__ import annotations

from uuid import uuid4
from sqlalchemy.orm import Session

from app.models import CustomNode
from app.schemas import CustomNodeCreate


def _port_dict(port: object) -> dict:
    if hasattr(port, 'model_dump'):
        return port.model_dump()
    return dict(port)  # type: ignore[arg-type]


def custom_node_to_api(node: CustomNode, *, include_code: bool = False) -> dict:
    payload = {
        'id': node.id,
        'type': node.id,
        'name': node.name,
        'label': node.name,
        'category': 'User Nodes',
        'description': node.description,
        'inputs': list(node.inputs or []),
        'outputs': list(node.outputs or []),
        'settingsSchema': [],
        'params': [],
        'executionMode': 'sandboxed',
        'supportsDynamicParameters': False,
        'implemented': True,
        'comingSoon': False,
        'priority': 'User',
        'validationRules': 'Restricted Python sandbox; typed workflow ports.',
        'isCustom': True,
        'owner_username': node.owner_username,
        'created_at': node.created_at.isoformat() if node.created_at else None,
        'updated_at': node.updated_at.isoformat() if node.updated_at else None,
    }
    if include_code:
        payload['code'] = node.code
        payload['template'] = node.template
    return payload


def list_custom_nodes(db: Session, owner_username: str) -> list[CustomNode]:
    return (
        db.query(CustomNode)
        .filter(CustomNode.owner_username == owner_username)
        .order_by(CustomNode.updated_at.desc())
        .all()
    )


def create_custom_node(db: Session, owner_username: str, payload: CustomNodeCreate) -> CustomNode:
    node = CustomNode(
        id=f'UC-{uuid4().hex[:12]}',
        owner_username=owner_username,
        name=payload.name.strip(),
        description=payload.description.strip(),
        inputs=[_port_dict(port) for port in payload.inputs],
        outputs=[_port_dict(port) for port in payload.outputs],
        code=payload.code,
        template=payload.template,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


def update_custom_node(db: Session, node: CustomNode, payload: CustomNodeCreate) -> CustomNode:
    node.name = payload.name.strip()
    node.description = payload.description.strip()
    node.inputs = [_port_dict(port) for port in payload.inputs]
    node.outputs = [_port_dict(port) for port in payload.outputs]
    node.code = payload.code
    node.template = payload.template
    db.commit()
    db.refresh(node)
    return node
