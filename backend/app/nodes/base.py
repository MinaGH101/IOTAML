from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

PortType = Literal[
    'dataframe', 'json', 'json_items', 'series', 'columns', 'model', 'metrics',
    'plot', 'file', 'report', 'artifact', 'artifact_ref', 'text', 'schema',
    'trigger', 'stream', 'any'
]
ExecutionMode = Literal['instant', 'queued', 'sandboxed']


@dataclass(frozen=True)
class PortDefinition:
    id: str
    name: str
    type: str
    required: bool = True
    multiple: bool = False


@dataclass(frozen=True)
class SettingDefinition:
    name: str
    label: str
    type: str
    default: Any = None
    required: bool = False
    options: list[Any] = field(default_factory=list)
    supportsDynamic: bool = True
    help: str = ''


@dataclass(frozen=True)
class NodeDefinition:
    id: str
    type: str
    name: str
    category: str
    description: str
    inputs: list[PortDefinition]
    outputs: list[PortDefinition]
    settingsSchema: list[SettingDefinition]
    executionMode: ExecutionMode = 'instant'
    supportsDynamicParameters: bool = True
    implemented: bool = True
    comingSoon: bool = False
    priority: str = 'MVP'
    validationRules: str = ''
    cacheable: bool = True
    cacheVersion: str = '1'

    def to_api(self) -> dict[str, Any]:
        settings = [s.__dict__ for s in self.settingsSchema]
        return {
            'id': self.id,
            'type': self.type,
            'name': self.name,
            'label': self.name,
            'category': self.category,
            'description': self.description,
            'inputs': [p.__dict__ for p in self.inputs],
            'outputs': [p.__dict__ for p in self.outputs],
            'settingsSchema': settings,
            'params': settings,
            'executionMode': self.executionMode,
            'supportsDynamicParameters': self.supportsDynamicParameters,
            'implemented': self.implemented,
            'comingSoon': self.comingSoon,
            'priority': self.priority,
            'validationRules': self.validationRules,
            'cacheable': self.cacheable,
            'cacheVersion': self.cacheVersion,
        }


class BaseNode:
    id: str = ''
    type: str = ''
    name: str = ''
    category: str = 'Utilities / Advanced'
    description: str = ''
    inputs: list[PortDefinition] = []
    outputs: list[PortDefinition] = []
    settings_schema: list[SettingDefinition] = []
    execution_mode: ExecutionMode = 'instant'
    supports_dynamic_parameters: bool = True
    implemented: bool = True
    coming_soon: bool = False
    priority: str = 'MVP'
    validation_rules: str = ''
    cacheable: bool = True
    cache_version: str = '1'

    def definition(self) -> NodeDefinition:
        return NodeDefinition(
            id=self.id,
            type=self.type or self.id,
            name=self.name,
            category=self.category,
            description=self.description,
            inputs=list(self.inputs),
            outputs=list(self.outputs),
            settingsSchema=list(self.settings_schema),
            executionMode=self.execution_mode,
            supportsDynamicParameters=self.supports_dynamic_parameters,
            implemented=self.implemented,
            comingSoon=self.coming_soon,
            priority=self.priority,
            validationRules=self.validation_rules,
            cacheable=self.cacheable,
            cacheVersion=self.cache_version,
        )

    def to_api(self) -> dict[str, Any]:
        return self.definition().to_api()

    def validate_settings(self, settings: dict[str, Any]) -> None:
        for setting in self.settings_schema:
            if setting.required and settings.get(setting.name) in [None, '', []]:
                raise ValueError(f'Missing required setting: {setting.label}')

    def run(self, node: dict[str, Any], inputs: dict[str, Any], settings: dict[str, Any], context: Any) -> dict[str, Any]:
        raise NotImplementedError(f'{self.id} has no run implementation.')


def port(id: str, name: str, type: str, required: bool = True, multiple: bool = False) -> PortDefinition:
    return PortDefinition(id=id, name=name, type=type, required=required, multiple=multiple)


def setting(name: str, label: str, type: str, default: Any = None, required: bool = False, options: list[Any] | None = None, supports_dynamic: bool = True, help: str = '') -> SettingDefinition:
    return SettingDefinition(name=name, label=label, type=type, default=default, required=required, options=options or [], supportsDynamic=supports_dynamic, help=help)
