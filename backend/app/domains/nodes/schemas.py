"""Custom node API schemas."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
class CustomPortIn(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r'^[A-Za-z][A-Za-z0-9_-]*$')
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(default='any', min_length=1, max_length=64)
    required: bool = True
    multiple: bool = False
class CustomNodeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default='', max_length=2000)
    inputs: list[CustomPortIn] = Field(default_factory=list)
    outputs: list[CustomPortIn] = Field(default_factory=lambda: [CustomPortIn(id='output', name='Output', type='json', required=False)])
    code: str = Field(min_length=1, max_length=100000)
    template: dict | None = None
class CustomNodeOut(CustomNodeCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    owner_username: str
    category: str = 'User Nodes'
    executionMode: str = 'sandboxed'
    isCustom: bool = True
    created_at: datetime
    updated_at: datetime
