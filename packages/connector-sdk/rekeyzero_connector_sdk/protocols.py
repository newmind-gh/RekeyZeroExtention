from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Protocol


class ConnectorCapability(StrEnum):
    SUBMIT = "submit"
    UPDATE = "update"
    SEND = "send"
    UPLOAD = "upload"
    FETCH = "fetch"
    BROWSER_USE = "browser_use"
    GENERATE_DOCUMENT = "generate_document"


class AuthType(StrEnum):
    NONE = "none"
    API_KEY = "api_key"
    BASIC = "basic"
    BEARER = "bearer"
    OAUTH2 = "oauth2"
    SESSION = "session"


@dataclass(frozen=True)
class ConnectionConfig:
    auth_type: AuthType = AuthType.NONE
    secret_ref: str | None = None
    token_ref: str | None = None
    settings: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ConnectorResult:
    status: str
    data: dict[str, Any] | None = None
    evidence: dict[str, Any] | None = None
    external_id: str | None = None
    retryable: bool = False
    human_action_required: bool = False


class Connector(Protocol):
    @property
    def capabilities(self) -> set[ConnectorCapability]: ...

    def execute(
        self,
        action: ConnectorCapability,
        payload: dict[str, Any],
        connection: ConnectionConfig,
    ) -> ConnectorResult: ...
