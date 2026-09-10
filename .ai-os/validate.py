#!/usr/bin/env python3
"""Small dependency-free validator for AI Engineering OS artefacts.

This intentionally supports only the JSON-Schema keywords used by the v0.1 schemas.
It has two modes:

  python3 .ai-os/validate.py <artifact.json> <schema.json>
  python3 .ai-os/validate.py <artifact.json> <schema.json> --ready

The first checks structure. --ready additionally applies deterministic stage-exit rules.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ValueError(f"file not found: {path}") from None
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON in {path}: line {exc.lineno}, column {exc.colno}: {exc.msg}") from None


def is_type(value: Any, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "null":
        return value is None
    return True


def validate_value(value: Any, schema: dict[str, Any], path: str = "$") -> list[str]:
    errors: list[str] = []

    expected_type = schema.get("type")
    if isinstance(expected_type, str) and not is_type(value, expected_type):
        return [f"{path}: expected {expected_type}, got {type(value).__name__}"]

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: value {value!r} is not one of {schema['enum']!r}")

    if isinstance(value, str):
        min_length = schema.get("minLength")
        if isinstance(min_length, int) and len(value) < min_length:
            errors.append(f"{path}: string must be at least {min_length} characters")
        pattern = schema.get("pattern")
        if isinstance(pattern, str) and re.search(pattern, value) is None:
            errors.append(f"{path}: value {value!r} does not match /{pattern}/")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        minimum = schema.get("minimum")
        if isinstance(minimum, (int, float)) and value < minimum:
            errors.append(f"{path}: value {value} must be >= {minimum}")

    if isinstance(value, list):
        min_items = schema.get("minItems")
        if isinstance(min_items, int) and len(value) < min_items:
            errors.append(f"{path}: array must contain at least {min_items} item(s)")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                errors.extend(validate_value(item, item_schema, f"{path}[{index}]"))

    if isinstance(value, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in value:
                errors.append(f"{path}: missing required property {key!r}")

        properties = schema.get("properties", {})
        if isinstance(properties, dict):
            for key, child_schema in properties.items():
                if key in value and isinstance(child_schema, dict):
                    errors.extend(validate_value(value[key], child_schema, f"{path}.{key}"))

            if schema.get("additionalProperties") is False:
                allowed = set(properties)
                for key in value:
                    if key not in allowed:
                        errors.append(f"{path}: unexpected property {key!r}")

    return errors


def blocking_questions(data: dict[str, Any]) -> list[str]:
    questions = data.get("unresolved_questions", [])
    return [q.get("question", "<unnamed>") for q in questions if isinstance(q, dict) and q.get("blocking") is True]


def require_approved(data: dict[str, Any], errors: list[str]) -> None:
    approval = data.get("approval")
    if not isinstance(approval, dict) or approval.get("status") != "approved":
        errors.append("$.approval.status: must be 'approved' for stage exit")
        return
    if not approval.get("by"):
        errors.append("$.approval.by: named human approver is required for stage exit")
    if not approval.get("at"):
        errors.append("$.approval.at: approval timestamp is required for stage exit")


def check_plan_graph(data: dict[str, Any], errors: list[str]) -> None:
    stages = data.get("stages", [])
    ids = [stage.get("id") for stage in stages if isinstance(stage, dict)]
    if len(ids) != len(set(ids)):
        errors.append("$.stages: stage ids must be unique")

    known = set(ids)
    deps: dict[str, list[str]] = {}
    for index, stage in enumerate(stages):
        if not isinstance(stage, dict):
            continue
        stage_id = stage.get("id")
        stage_deps = stage.get("depends_on", [])
        if stage_id in stage_deps:
            errors.append(f"$.stages[{index}].depends_on: stage cannot depend on itself")
        unknown = [dep for dep in stage_deps if dep not in known]
        if unknown:
            errors.append(f"$.stages[{index}].depends_on: unknown stage ids {unknown!r}")
        if isinstance(stage_id, str):
            deps[stage_id] = [d for d in stage_deps if isinstance(d, str)]

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node: str) -> bool:
        if node in visiting:
            return True
        if node in visited:
            return False
        visiting.add(node)
        for dep in deps.get(node, []):
            if dep in deps and visit(dep):
                return True
        visiting.remove(node)
        visited.add(node)
        return False

    if any(visit(node) for node in deps if node not in visited):
        errors.append("$.stages: dependency graph contains a cycle")


def readiness_errors(data: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    schema_id = schema.get("$id", "")

    if schema_id == "brief.schema.json":
        require_approved(data, errors)
        for question in blocking_questions(data):
            errors.append(f"$.unresolved_questions: blocking question remains: {question}")

    elif schema_id == "design.schema.json":
        require_approved(data, errors)
        for question in blocking_questions(data):
            errors.append(f"$.unresolved_questions: blocking question remains: {question}")
        coverage_ids = [item.get("ac_id") for item in data.get("coverage", []) if isinstance(item, dict)]
        if len(coverage_ids) != len(set(coverage_ids)):
            errors.append("$.coverage: each acceptance criterion should appear once")

    elif schema_id == "plan.schema.json":
        require_approved(data, errors)
        check_plan_graph(data, errors)
        covered = [ac for stage in data.get("stages", []) if isinstance(stage, dict) for ac in stage.get("acceptance_criteria", [])]
        if len(covered) != len(set(covered)):
            errors.append("$.stages[*].acceptance_criteria: an acceptance criterion is assigned to multiple stages; make ownership explicit")

    elif schema_id == "implementation.schema.json":
        for question in blocking_questions(data):
            errors.append(f"$.unresolved_questions: blocking question remains: {question}")
        for index, stage in enumerate(data.get("stages", [])):
            if not isinstance(stage, dict):
                continue
            if stage.get("status") != "complete":
                errors.append(f"$.stages[{index}].status: must be 'complete' for Review")
            for ev_index, evidence in enumerate(stage.get("test_evidence", [])):
                if isinstance(evidence, dict) and evidence.get("result") != "pass":
                    errors.append(f"$.stages[{index}].test_evidence[{ev_index}].result: must be 'pass' for Review")

    elif schema_id == "review.schema.json":
        require_approved(data, errors)
        if data.get("verdict") != "pass":
            errors.append("$.verdict: must be 'pass' for Release")
        for index, finding in enumerate(data.get("findings", [])):
            if not isinstance(finding, dict):
                continue
            if finding.get("severity") in {"critical", "high"} and finding.get("status") == "open":
                errors.append(f"$.findings[{index}]: open {finding.get('severity')} finding blocks Release")
            if finding.get("status") == "waived" and (not finding.get("waiver_reason") or not finding.get("waived_by")):
                errors.append(f"$.findings[{index}]: waived finding requires waiver_reason and waived_by")
        for index, evidence in enumerate(data.get("acceptance_criteria_evidence", [])):
            if isinstance(evidence, dict) and evidence.get("status") != "pass":
                errors.append(f"$.acceptance_criteria_evidence[{index}].status: must be 'pass' for Release")

    elif schema_id == "release.schema.json":
        require_approved(data, errors)
        if data.get("blockers"):
            errors.append("$.blockers: must be empty for deployment readiness")
        rollback = data.get("rollback", {})
        if isinstance(rollback, dict) and rollback.get("required") is True and not rollback.get("plan"):
            errors.append("$.rollback.plan: required when rollback.required is true")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate an AI Engineering OS artefact")
    parser.add_argument("artifact", type=Path)
    parser.add_argument("schema", type=Path)
    parser.add_argument("--ready", action="store_true", help="also apply deterministic stage-exit rules")
    args = parser.parse_args()

    try:
        data = load_json(args.artifact)
        schema = load_json(args.schema)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    if not isinstance(schema, dict):
        print("ERROR: schema root must be an object", file=sys.stderr)
        return 2

    errors = validate_value(data, schema)
    if not errors and args.ready:
        if not isinstance(data, dict):
            errors.append("$: stage artefact root must be an object")
        else:
            errors.extend(readiness_errors(data, schema))

    if errors:
        print(f"FAIL: {args.artifact} ({len(errors)} finding(s))")
        for error in errors:
            print(f"- {error}")
        return 1

    mode = "structure + readiness" if args.ready else "structure"
    print(f"PASS: {args.artifact} ({mode})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
