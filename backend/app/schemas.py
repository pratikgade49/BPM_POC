"""Pydantic models describing API request/response shapes (not DB models)."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

Role = Literal["admin", "editor", "viewer"]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None
    role: Role = "viewer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None
    role: Role
    is_active: bool
    created_at: datetime


class UpdateRoleRequest(BaseModel):
    role: Role


class ProcessCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    bpmn_xml: str


class ProcessUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    bpmn_xml: str


class ProcessSummaryResponse(BaseModel):
    id: UUID
    name: str
    owner_id: UUID
    owner_email: EmailStr
    version: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class ProcessDetailResponse(ProcessSummaryResponse):
    bpmn_xml: str


class ProcessVersionResponse(BaseModel):
    id: UUID
    version: int
    saved_by_email: EmailStr
    created_at: datetime


class ProcessVersionDetailResponse(BaseModel):
    version: int
    bpmn_xml: str
    created_at: datetime
