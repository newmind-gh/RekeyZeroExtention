from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class RecordState(StrEnum):
    NEEDS_INGESTION = "needs_ingestion"
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ActionState(StrEnum):
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_HUMAN = "needs_human"


class ToolType(StrEnum):
    API = "api"
    BROWSER_USE = "browser_use"
    EMAIL = "email"
    DOCUMENT = "document"
    FILE = "file"


@dataclass(frozen=True)
class EvidenceRef:
    field_path: str
    asset_id: str
    confidence: float
    locator: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CanonicalRecord:
    schema_id: str
    schema_version: str
    data: dict[str, Any]
    evidence: tuple[EvidenceRef, ...] = ()


@dataclass(frozen=True)
class ActionSpec:
    target_id: str
    action_type: str
    tool: ToolType
    payload: dict[str, Any]
