"""Assistant domain service for the IOTA ML backend."""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from app.core.config import get_settings

from .tools import (
    APP_GUIDE_TOOLS,
    CATALOG_TOOLS,
    WORKFLOW_ADVISOR_TOOLS,
    execute_app_guide_tool,
    execute_catalog_tool,
    execute_workflow_advisor_tool,
)
from .workflow_tools import (
    get_workflow_context,
    validate_workflow_context,
)


logger = logging.getLogger(__name__)


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


class AssistantNotConfiguredError(RuntimeError):
    """Raised only when the optional assistant is used without credentials."""


class AssistantProviderError(RuntimeError):
    """Raised when the configured AI provider rejects or fails a request."""


class AssistantService:
    MAX_TOOL_ROUNDS = 6
    _INLINE_CODE_RE = re.compile(r"`([^`\n]+)`")

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        client: "AsyncOpenAI | Any | None" = None,
    ) -> None:
        settings = get_settings()
        self.model = (model or settings.openai_model).strip() or "gpt-4o-mini"
        self.base_url = (
            base_url or settings.openai_base_url
        ).strip() or "https://api.openai.com/v1"
        self._api_key = (
            settings.openai_api_key if api_key is None else api_key
        ).strip()
        self._client = client

    @property
    def is_configured(self) -> bool:
        return self._client is not None or bool(self._api_key)

    @classmethod
    def _invalid_node_pills(
        cls,
        text: str,
        allowed_node_names: set[str],
    ) -> list[str]:
        """Return inline-code labels that are not grounded catalog node names.

        Assistant formatting reserves inline code exclusively for exact node
        names. This gives us a deterministic final-response guard instead of
        relying on prompt compliance alone.
        """
        invalid: list[str] = []
        for raw_value in cls._INLINE_CODE_RE.findall(text or ""):
            value = raw_value.strip()
            if value and value not in allowed_node_names and value not in invalid:
                invalid.append(value)
        return invalid

    def _require_client(self) -> Any:
        if self._client is not None:
            return self._client
        if not self._api_key:
            raise AssistantNotConfiguredError(
                "The optional AI assistant is not configured."
            )
        from openai import AsyncOpenAI
        self._client = AsyncOpenAI(
            api_key=self._api_key,
            base_url=self.base_url,
            timeout=60.0,
            max_retries=2,
        )
        return self._client

    async def chat(
        self,
        *,
        message: str,
        history: list[dict[str, str]] | None,
        db: Session,
        workflow_id: int | None,
        owner_username: str,
    ) -> str:
        client = self._require_client()
        context_limit = get_settings().assistant_context_message_limit
        previous_limit = max(context_limit - 1, 0)
        recent_history = list(history or [])[-previous_limit:] if previous_limit else []

        conversation_input: list[Any] = [
            {
                "role": item["role"],
                "content": item["content"],
            }
            for item in recent_history
            if item.get("role") in {"user", "assistant"} and item.get("content")
        ]
        conversation_input.append(
            {
                "role": "user",
                "content": message,
            }
        )

        tools = [
            *APP_GUIDE_TOOLS,
            *WORKFLOW_ADVISOR_TOOLS,
            *CATALOG_TOOLS,
            CURRENT_WORKFLOW_TOOL,
            VALIDATE_CURRENT_WORKFLOW_TOOL,
        ]
        allowed_node_names: set[str] = set()

        for tool_round in range(self.MAX_TOOL_ROUNDS):
            try:
                response = await client.responses.create(
                    model=self.model,
                    instructions=(
                    "You are the read-only AI guide inside IOTA ML. "
                    "Your job is to teach users how the application works, explain its "
                    "implemented nodes, and guide users toward valid machine-learning "
                    "workflow designs. Always answer the user in Persian (Farsi), while "
                    "preserving exact IOTA node names, setting names, and technical terms "
                    "when translating them would make the guidance ambiguous. "

                    "For questions about the application itself, first use search_app_guide. "
                    "Do not invent pages, controls, features, or behavior that are not "
                    "supported by the guide or another available read-only tool. "

                    "NODE NAMING IS STRICT AND MUST BE GROUNDED. For every question about "
                    "data preparation, analysis, visualization, machine learning, or workflow "
                    "design, use list_nodes before naming or recommending any node. Only node "
                    "names returned by list_nodes or get_node_details in THIS TURN may appear "
                    "in the answer. The catalog `name` is the exact user-visible label in the "
                    "Node Palette: copy it verbatim. Never invent, translate, shorten, "
                    "paraphrase, or substitute a node name. If the catalog does not return a "
                    "suitable node, explicitly say that IOTA currently has no matching "
                    "implemented node instead of suggesting a generic ML operation as a node. "
                    "Do not show registry IDs unless the user explicitly asks for debugging "
                    "details. "

                    "FORMAT RULE FOR NODES: every node name in the final answer MUST be wrapped "
                    "once in Markdown inline code, for example `Upload CSV/Excel`. Inline code "
                    "is reserved ONLY for exact IOTA node names; do not wrap setting names, "
                    "file formats, algorithms, or other technical terms in backticks. Never "
                    "format a node name with bold markers. "

                    "Use get_node_details before explaining a node's exact settings, inputs, "
                    "outputs, defaults, validation rules, or before judging whether that node "
                    "is appropriate for a specific step. Recommend only nodes that exist in "
                    "the implemented node catalog. Do not add unrelated next-stage nodes just "
                    "to make the answer longer. Answer the user's current question first. "

                    "When a setting type represents repeatable blocks, such as imputation_blocks, "
                    "normalization_blocks, replacement_blocks, or scatter_blocks, do not describe "
                    "it as one simple setting. Explain that the user can add multiple blocks, then "
                    "explain the configurable fields and method-specific options inside each block "
                    "using the setting's help text from get_node_details. "

                    "RESPONSE STYLE: keep answers compact and easy to scan. Prefer one short "
                    "intro sentence followed by a small numbered or bulleted list. Use Markdown "
                    "headings only when the answer truly has multiple sections. Use bold only "
                    "for short labels, never for entire sentences. At most two relevant emojis "
                    "may be used in a response, and only when they improve scanning (for example "
                    "✅ for a recommended path or ⚠️ for an important condition). Avoid decorative "
                    "emoji, repeated headings, and filler such as asking whether the user wants "
                    "more information unless a follow-up question is actually needed. "

                    "WORKFLOW CONTEXT FIRST. When the user refers to the current "
                    "workflow, flow, graph, this workflow, current flow, این جریان, "
                    "همین جریان, فلو, or asks what is already present, call "
                    "get_current_workflow before answering. For current-workflow questions, "
                    "reason from the returned node instances and edges, not from generic "
                    "workflow templates alone. If the user asks which existing nodes are "
                    "plots, charts, graphs, or نمودار, identify node instances whose "
                    "category is Visualizations or whose outputTypes include plot. "

                    "GOAL ADVICE MUST BE CONTEXT-AWARE. When a user describes a goal such "
                    "as training a model, cleaning data, handling missing values, analyzing "
                    "correlations, detecting outliers, selecting features, or visualizing "
                    "data, use advise_workflow. If a workflow is selected, also use "
                    "get_current_workflow and adapt the recommendation to what already "
                    "exists. Do not restart from `Upload CSV/Excel` when the workflow "
                    "already has an upstream data source. Mark existing useful nodes as "
                    "already present, then name only the missing nodes to add. "

                    "When advise_workflow returns alreadyPresent or matchedExistingNodes, "
                    "use those fields to avoid recommending duplicate nodes. When it returns "
                    "connectionAdvice, explicitly mention the recommended source node and the "
                    "step it should connect to. "
                    "When advise_workflow returns actionPlan, use it as the action-ready "
                    "draft: explain which existing nodes can be reused, which nodes should "
                    "be added, which connections should be made, and which settings require "
                    "the user's domain choice. Do not expose raw JSON unless the user asks "
                    "for developer details. "

                    "FUTURE ACTION ACCESS CONTRACT. Even though the current tools are "
                    "read-only, phrase workflow changes in a stable order that can later "
                    "map to actions: inspect current workflow, reuse existing nodes, add "
                    "missing nodes, connect them from the recommended source, configure "
                    "required settings, validate, then run. Ask for confirmation before "
                    "describing destructive changes or replacing existing settings. "

                    "WHEN SUGGESTING CONNECTIONS, recommend a specific current node "
                    "instance to connect from. Prefer the latest relevant dataframe-producing "
                    "node after cleaning, filtering, replacement, imputation, detection-limit "
                    "handling, type conversion, feature engineering, or normalization. Explain "
                    "valid alternatives when more than one attachment point makes sense. For "
                    "example, a feature-selection node can connect after raw import, but it is "
                    "usually better after missing-value and detection-limit handling when those "
                    "steps affect the modeling columns. "

                    "IMPROVEMENT ADVICE IS NOT THE SAME AS ERROR REPORTING. If the user asks "
                    "what is wrong, first validate the workflow before claiming confirmed "
                    "errors. If validation returns no errors, say there are no confirmed "
                    "configuration errors, then suggest improvements based on the likely "
                    "workflow goal, missing stages, weak ordering, duplicate analysis, or "
                    "settings that would make the workflow more useful. "

                    "Treat the advisor as the source of truth for generic logical step order, "
                    "but treat get_current_workflow as the source of truth for what the user "
                    "already has. Use only exact live catalog node names returned by tools. "
                    "Do not pretend to build or execute the workflow. "

                    "Do not assume an empty setting is invalid. Some nodes interpret an "
                    "empty columns list as all compatible columns. Do not report a "
                    "configuration problem unless it conflicts with the node definition, "
                    "connection rules, or an explicit validation result. Large files and "
                    "long parameter values may be intentionally summarized; do not describe "
                    "summarized or truncated values as errors. "

                    "All available tools are read-only. Never claim that you created, "
                    "modified, saved, or executed a workflow. Always call "
                    "validate_current_workflow before reporting workflow configuration, "
                    "connection, or validation problems. Only describe issues returned by "
                    "the validator as confirmed problems. "
                ),
                input=conversation_input,
                tools=tools,
                tool_choice="required" if tool_round == 0 else "auto",
                    max_output_tokens=1_200,
                    store=False,
                )
            except Exception as exc:
                try:
                    from openai import OpenAIError
                except ImportError:
                    raise
                if isinstance(exc, OpenAIError):
                    logger.warning(
                        "AI provider request failed: model=%s status=%s request_id=%s error_type=%s",
                        self.model,
                        getattr(exc, "status_code", None),
                        getattr(exc, "request_id", None),
                        type(exc).__name__,
                    )
                    raise AssistantProviderError("The AI provider request failed.") from exc
                raise

            function_calls = [
                item
                for item in response.output
                if item.type == "function_call"
            ]

            if not function_calls:
                final_text = response.output_text or (
                    "I could not generate a complete response."
                )
                invalid_node_pills = self._invalid_node_pills(
                    final_text,
                    allowed_node_names,
                )
                if not invalid_node_pills:
                    return final_text

                conversation_input.extend(response.output)
                conversation_input.append(
                    {
                        "role": "user",
                        "content": (
                            "Internal grounding correction: the draft used these "
                            "backticked labels that were not returned as exact IOTA "
                            "node names in this turn: "
                            + ", ".join(invalid_node_pills)
                            + ". Revise the answer. Call list_nodes again if needed. "
                            "Use backticks only for exact catalog node names returned "
                            "by a tool in this turn. Do not mention this correction to "
                            "the user."
                        ),
                    }
                )
                continue

            conversation_input.extend(response.output)

            for call in function_calls:
                result = self._execute_tool_call(
                    tool_name=call.name,
                    raw_arguments=call.arguments,
                    db=db,
                    workflow_id=workflow_id,
                    owner_username=owner_username,
                )

                if call.name == "list_nodes":
                    for node in result.get("nodes", []):
                        name = str(node.get("name") or "").strip()
                        if name:
                            allowed_node_names.add(name)
                elif call.name == "get_node_details":
                    node = result.get("node") or {}
                    name = str(node.get("name") or "").strip()
                    if name:
                        allowed_node_names.add(name)
                elif call.name == "advise_workflow":
                    for pattern in result.get("patterns", []):
                        for step in pattern.get("steps", []):
                            for node in step.get("nodes", []):
                                name = str(node.get("name") or "").strip()
                                if name:
                                    allowed_node_names.add(name)

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

            if tool_name == "search_app_guide":
                return execute_app_guide_tool(tool_name, arguments)

            if tool_name == "advise_workflow":
                current_workflow = None
                if workflow_id is not None:
                    current_workflow = get_workflow_context(
                        db=db,
                        workflow_id=workflow_id,
                        owner_username=owner_username,
                    )

                return execute_workflow_advisor_tool(
                    tool_name,
                    arguments,
                    current_workflow=current_workflow,
                )

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
