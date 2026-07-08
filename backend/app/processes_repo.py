"""Plain functions for reading/writing processes and process_versions."""
from typing import Any

from app.db import execute, execute_returning, fetch_all, fetch_one


def list_processes(include_archived: bool = False) -> list[dict[str, Any]]:
    sql = """
        SELECT p.id, p.name, p.owner_id, p.version, p.is_archived,
               p.created_at, p.updated_at, u.email AS owner_email
        FROM processes p
        JOIN users u ON u.id = p.owner_id
        WHERE (%(include_archived)s OR NOT p.is_archived)
        ORDER BY p.updated_at DESC
    """
    return fetch_all(sql, {"include_archived": include_archived})


def get_process(process_id: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        SELECT p.*, u.email AS owner_email
        FROM processes p
        JOIN users u ON u.id = p.owner_id
        WHERE p.id = %(id)s
        """,
        {"id": process_id},
    )


def create_process(name: str, bpmn_xml: str, owner_id: str) -> dict[str, Any] | None:
    process = execute_returning(
        """
        INSERT INTO processes (name, bpmn_xml, owner_id, version)
        VALUES (%(name)s, %(bpmn_xml)s, %(owner_id)s, 1)
        RETURNING id
        """,
        {"name": name, "bpmn_xml": bpmn_xml, "owner_id": owner_id},
    )
    if process:
        _record_version(process["id"], 1, bpmn_xml, owner_id)
    return get_process(process["id"]) if process else None


def update_process(process_id: str, name: str, bpmn_xml: str, saved_by: str) -> dict[str, Any] | None:
    process = execute_returning(
        """
        UPDATE processes
        SET name = %(name)s,
            bpmn_xml = %(bpmn_xml)s,
            version = version + 1,
            updated_at = now()
        WHERE id = %(id)s
        RETURNING id, version
        """,
        {"id": process_id, "name": name, "bpmn_xml": bpmn_xml},
    )
    if process:
        _record_version(process["id"], process["version"], bpmn_xml, saved_by)
    return get_process(process["id"]) if process else None


def _record_version(process_id: str, version: int, bpmn_xml: str, saved_by: str) -> None:
    execute(
        """
        INSERT INTO process_versions (process_id, version, bpmn_xml, saved_by)
        VALUES (%(process_id)s, %(version)s, %(bpmn_xml)s, %(saved_by)s)
        ON CONFLICT (process_id, version) DO NOTHING
        """,
        {"process_id": process_id, "version": version, "bpmn_xml": bpmn_xml, "saved_by": saved_by},
    )


def archive_process(process_id: str) -> dict[str, Any] | None:
    execute(
        "UPDATE processes SET is_archived = TRUE, updated_at = now() WHERE id = %(id)s",
        {"id": process_id},
    )
    return get_process(process_id)


def delete_process(process_id: str) -> None:
    execute("DELETE FROM processes WHERE id = %(id)s", {"id": process_id})


def list_process_versions(process_id: str) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT pv.id, pv.version, pv.created_at, u.email AS saved_by_email
        FROM process_versions pv
        JOIN users u ON u.id = pv.saved_by
        WHERE pv.process_id = %(process_id)s
        ORDER BY pv.version DESC
        """,
        {"process_id": process_id},
    )


def get_process_version(process_id: str, version: int) -> dict[str, Any] | None:
    return fetch_one(
        """
        SELECT * FROM process_versions
        WHERE process_id = %(process_id)s AND version = %(version)s
        """,
        {"process_id": process_id, "version": version},
    )
