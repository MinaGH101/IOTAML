from __future__ import annotations

import json
import os
from typing import Any

from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from .tools import CATALOG_TOOLS, execute_catalog_tool
from .workflow_tools import (
    get_workflow_context,
    validate_workflow_context,
)


CURRENT_WORKFLOW_TOOL: dict[str, Any] = {
    "type": "function",
    "name": "get_current_workflow",
    "description": (
        "Read the currently selected workflow. Returns a compact list of "
        "nodes, settings, connections, and workflow metadata. Use this when "
        "the user refers to the current workflow, existing nodes, settings, "
        "connections, or asks what should be changed."
    ),
    "parameters": {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    },
    "strict": True,
}


VALIDATE_CURRENT_WORKFLOW_TOOL: dict[str, Any] = {
    "type": "function",
    "name": "validate_current_workflow",
    "description": (
        "Run the application's real workflow validator on the selected "
        "workflow. Use this before reporting configuration or connection errors."
    ),
    "parameters": {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    },
    "strict": True,
}


class AssistantService:
    MAX_TOOL_ROUNDS = 5

    def __init__(self) -> None:
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.client = AsyncOpenAI(
            api_key=os.environ["OPENAI_API_KEY"],
            timeout=60.0,
            max_retries=2,
        )

    async def chat(
        self,
        *,
        message: str,
        db: Session,
        workflow_id: int | None,
        owner_username: str,
    ) -> str:
        conversation_input: list[Any] = [
            {
                "role": "user",
                "content": message,
            }
        ]

        tools = [
            *CATALOG_TOOLS,
            CURRENT_WORKFLOW_TOOL,
            VALIDATE_CURRENT_WORKFLOW_TOOL,
        ]
        for _ in range(self.MAX_TOOL_ROUNDS):
            response = await self.client.responses.create(
                model=self.model,
                instructions=(
                    "You are the AI assistant inside IOTA ML. "
                    "Help users inspect and design valid machine-learning workflows. "

                    "When describing the current workflow, list every node instance "
                    "separately using its instanceId, label, typeLabel, and registryId. "
                    "Never merge nodes merely because they use the same registryId. "

                    "Use get_current_workflow when discussing the selected workflow. "
                    "Use list_nodes before recommending nodes. "
                    "Use get_node_details before judging a node configuration. "

                    "Do not assume an empty setting is invalid. Some nodes interpret an "
                    "empty columns list as all compatible columns. "
                    "Do not report a configuration problem unless it conflicts with the "
                    "node definition, connection rules, or an explicit validation result. "

                    "Large files and long parameter values may be intentionally summarized. "
                    "Do not describe summarized or truncated values as configuration errors. "

                    "All available tools are read-only. Never claim that you created, "
                    "modified, saved, validated, or executed a workflow. "
                    "Always call validate_current_workflow before reporting workflow "
                    "configuration, connection, or validation problems. Only describe issues "
                    "returned by the validator as confirmed problems. "
                ),
                input=conversation_input,
                tools=tools,
                tool_choice="auto",
                max_output_tokens=1_200,
                store=False,
            )

            function_calls = [
                item
                for item in response.output
                if item.type == "function_call"
            ]

            if not function_calls:
                return response.output_text or (
                    "I could not generate a complete response."
                )

            conversation_input.extend(response.output)

            for call in function_calls:
                result = self._execute_tool_call(
                    tool_name=call.name,
                    raw_arguments=call.arguments,
                    db=db,
                    workflow_id=workflow_id,
                    owner_username=owner_username,
                )

                conversation_input.append(
                    {
                        "type": "function_call_output",
                        "call_id": call.call_id,
                        "output": json.dumps(
                            result,
                            ensure_ascii=False,
                            separators=(",", ":"),
                        ),
                    }
                )

        raise RuntimeError(
            "The assistant exceeded the maximum number of tool rounds."
        )

    @staticmethod
    def _execute_tool_call(
        *,
        tool_name: str,
        raw_arguments: str,
        db: Session,
        workflow_id: int | None,
        owner_username: str,
    ) -> dict[str, Any]:
        try:
            arguments = json.loads(raw_arguments or "{}")

            if not isinstance(arguments, dict):
                return {"error": "Tool arguments must be an object."}

            if tool_name == "get_current_workflow":
                if workflow_id is None:
                    return {
                        "selected": False,
                        "error": "No workflow is currently selected.",
                    }

                return {
                    "selected": True,
                    "workflow": get_workflow_context(
                        db=db,
                        workflow_id=workflow_id,
                        owner_username=owner_username,
                    ),
                }

            if tool_name == "validate_current_workflow":
                if workflow_id is None:
                    return {
                        "selected": False,
                        "error": "No workflow is currently selected.",
                    }

                return {
                    "selected": True,
                    "validation": validate_workflow_context(
                        db=db,
                        workflow_id=workflow_id,
                        owner_username=owner_username,
                    ),
                }

            return execute_catalog_tool(tool_name, arguments)

        except json.JSONDecodeError:
            return {
                "error": "The assistant produced invalid tool arguments."
            }
        except Exception as exc:
            return {
                "error": "The assistant tool could not complete the request.",
                "errorType": type(exc).__name__,
            }