"""Process route handlers: list/create/get/update/delete + version history.

Permission model:
  - viewer/editor/admin can all list and view processes
  - editor/admin can create processes
  - editor can update/delete only processes they own; admin can update/delete any
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user, require_role
from app.processes_repo import (
    archive_process,
    create_process,
    delete_process,
    get_process,
    get_process_version,
    list_process_versions,
    list_processes,
    update_process,
)
from app.schemas import (
    ProcessCreateRequest,
    ProcessDetailResponse,
    ProcessSummaryResponse,
    ProcessUpdateRequest,
    ProcessVersionDetailResponse,
    ProcessVersionResponse,
)

router = APIRouter(prefix="/processes", tags=["processes"])


def _get_process_or_404(process_id: str) -> dict:
    process = get_process(process_id)
    if process is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Process not found")
    return process


def _ensure_can_modify(process: dict, user: dict) -> None:
    is_owner = str(process["owner_id"]) == str(user["id"])
    if user["role"] == "admin" or (user["role"] == "editor" and is_owner):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to modify this process")


@router.get("", response_model=list[ProcessSummaryResponse])
def list_all_processes(user: dict = Depends(require_role("viewer", "editor", "admin"))) -> list[dict]:
    return list_processes()


@router.post("", response_model=ProcessDetailResponse, status_code=status.HTTP_201_CREATED)
def create_new_process(
    payload: ProcessCreateRequest,
    user: dict = Depends(require_role("editor", "admin")),
) -> dict:
    return create_process(name=payload.name, bpmn_xml=payload.bpmn_xml, owner_id=str(user["id"]))


@router.get("/{process_id}", response_model=ProcessDetailResponse)
def get_one_process(process_id: str, user: dict = Depends(require_role("viewer", "editor", "admin"))) -> dict:
    return _get_process_or_404(process_id)


@router.put("/{process_id}", response_model=ProcessDetailResponse)
def save_process(
    process_id: str,
    payload: ProcessUpdateRequest,
    user: dict = Depends(require_role("editor", "admin")),
) -> dict:
    existing = _get_process_or_404(process_id)
    _ensure_can_modify(existing, user)
    updated = update_process(
        process_id=process_id, name=payload.name, bpmn_xml=payload.bpmn_xml, saved_by=str(user["id"])
    )
    return updated


@router.delete("/{process_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_process(process_id: str, user: dict = Depends(require_role("editor", "admin"))) -> None:
    existing = _get_process_or_404(process_id)
    _ensure_can_modify(existing, user)
    delete_process(process_id)


@router.post("/{process_id}/archive", response_model=ProcessDetailResponse)
def archive_one_process(process_id: str, user: dict = Depends(require_role("editor", "admin"))) -> dict:
    existing = _get_process_or_404(process_id)
    _ensure_can_modify(existing, user)
    return archive_process(process_id)


@router.get("/{process_id}/versions", response_model=list[ProcessVersionResponse])
def get_process_history(process_id: str, user: dict = Depends(require_role("viewer", "editor", "admin"))) -> list[dict]:
    _get_process_or_404(process_id)
    return list_process_versions(process_id)


@router.get("/{process_id}/versions/{version}", response_model=ProcessVersionDetailResponse)
def get_process_version_detail(
    process_id: str, version: int, user: dict = Depends(require_role("viewer", "editor", "admin"))
) -> dict:
    _get_process_or_404(process_id)
    version_row = get_process_version(process_id, version)
    if version_row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Version not found")
    return version_row
