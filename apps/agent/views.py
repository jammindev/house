"""DRF views for the agent."""
from __future__ import annotations

import json
import logging

from django.http import StreamingHttpResponse
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHouseholdMember, resolve_request_household

from . import memory as memory_service
from . import searchables, service, tools
from .conversations import ask_inputs as _ask_inputs, persist_turns as _persist_turns
from .llm import LLMError, LLMTimeoutError
from .models import AgentConversation, AgentMemory
from .throttles import AgentBurstRateThrottle, AgentSustainedRateThrottle
from .serializers import (
    AskRequestSerializer,
    AskResponseSerializer,
    AgentMemorySerializer,
    AgentMessageSerializer,
    ConversationDetailSerializer,
    ConversationListSerializer,
    ConversationUpdateSerializer,
    PostMessageSerializer,
)

logger = logging.getLogger(__name__)


def _sse(event: str, payload: dict) -> str:
    """Format one Server-Sent Event frame."""
    return f"event: {event}\ndata: {json.dumps(payload, default=str)}\n\n"


class AskView(APIView):
    """``POST /api/agent/ask/`` — answer a household question."""

    permission_classes = [IsAuthenticated, IsHouseholdMember]
    throttle_classes = [AgentBurstRateThrottle, AgentSustainedRateThrottle]

    def post(self, request):
        request_serializer = AskRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        question = request_serializer.validated_data["question"]

        household = getattr(request, "household", None) or resolve_request_household(request)
        if household is None:
            return Response(
                {"detail": "No active household for this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = service.ask(question, household, user=request.user)
        except LLMTimeoutError:
            return Response(
                {"detail": "Agent timed out, please retry."},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except LLMError as exc:
            logger.warning("agent.ask: LLM error: %s", exc)
            return Response(
                {"detail": "Agent is unavailable, please retry later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = {
            "answer": result.answer,
            "citations": [
                {
                    "entity_type": c.entity_type,
                    "id": str(c.id),
                    "label": c.label,
                    "snippet": c.snippet,
                    "url_path": c.url_path,
                }
                for c in result.citations
            ],
            "metadata": result.metadata,
        }
        response_serializer = AskResponseSerializer(data=payload)
        response_serializer.is_valid(raise_exception=True)
        return Response(response_serializer.validated_data, status=status.HTTP_200_OK)


class ConversationViewSet(viewsets.ModelViewSet):
    """CRUD on the user's agent conversations + a `messages` action to ask.

    Conversations are private per user within a household. `POST
    conversations/{id}/messages/` runs the agent with the conversation as
    history, persists both the user turn and the agent answer, and returns the
    agent message.
    """

    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get_throttles(self):
        # Only the LLM-backed action costs money — plain conversation CRUD
        # stays unthrottled.
        if self.action in {"messages", "messages_stream"}:
            return [AgentBurstRateThrottle(), AgentSustainedRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.action == "list":
            return ConversationListSerializer
        if self.action in {"update", "partial_update"}:
            return ConversationUpdateSerializer
        return ConversationDetailSerializer

    def get_queryset(self):
        qs = (
            AgentConversation.objects.for_user_households(self.request.user)
            .filter(created_by=self.request.user)
            .annotate(message_count=Count("messages"))
        )
        household = getattr(self.request, "household", None)
        if household is not None:
            qs = qs.filter(household=household)
        if self.action in {"retrieve", "messages", "messages_stream", "for_context"}:
            qs = qs.prefetch_related("messages")
        return qs

    def _resolve_household(self):
        household = getattr(self.request, "household", None) or resolve_request_household(
            self.request
        )
        if household is None:
            raise ValidationError("No active household for this user.")
        return household

    def perform_create(self, serializer):
        serializer.save(household=self._resolve_household(), created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="messages")
    def messages(self, request, pk=None):
        conversation = self.get_object()

        request_serializer = PostMessageSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        question = request_serializer.validated_data["question"]

        # History built before we persist the new question so the current turn
        # isn't fed back to itself. Anchored conversations pre-inject context.
        history, context_entity = _ask_inputs(conversation)

        try:
            result = service.ask(
                question,
                conversation.household,
                user=request.user,
                history=history,
                context_entity=context_entity,
            )
        except LLMTimeoutError:
            return Response(
                {"detail": "Agent timed out, please retry."},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except LLMError as exc:
            logger.warning("agent.messages: LLM error: %s", exc)
            return Response(
                {"detail": "Agent is unavailable, please retry later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        agent_msg = _persist_turns(conversation, question, request.user, result)
        return Response(
            AgentMessageSerializer(agent_msg).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"], url_path="messages/stream")
    def messages_stream(self, request, pk=None):
        """Streaming variant of ``messages`` — Server-Sent Events.

        Emits ``delta`` (text chunk), ``tool`` (a tool call is running), then
        exactly one terminal event: ``done`` (the persisted agent message, same
        payload the non-streaming endpoint returns) or ``error``. Persistence is
        identical: both turns are written only once the answer exists.
        """
        conversation = self.get_object()

        request_serializer = PostMessageSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        question = request_serializer.validated_data["question"]

        history, context_entity = _ask_inputs(conversation)
        user = request.user

        def event_stream():
            try:
                result = None
                for event in service.ask_stream(
                    question,
                    conversation.household,
                    user=user,
                    history=history,
                    context_entity=context_entity,
                ):
                    if event["type"] == "delta":
                        yield _sse("delta", {"text": event["text"]})
                    elif event["type"] == "tool":
                        yield _sse("tool", {"name": event["name"]})
                    else:
                        result = event["result"]
                agent_msg = _persist_turns(conversation, question, user, result)
                yield _sse("done", AgentMessageSerializer(agent_msg).data)
            except LLMTimeoutError:
                yield _sse("error", {"detail": "timeout"})
            except LLMError as exc:
                logger.warning("agent.messages_stream: LLM error: %s", exc)
                yield _sse("error", {"detail": "unavailable"})
            except Exception:  # noqa: BLE001 — an SSE stream can't return a 500
                logger.exception("agent.messages_stream: unexpected error")
                yield _sse("error", {"detail": "error"})

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        # Tell nginx not to buffer the stream (X-Accel is already used for media).
        response["X-Accel-Buffering"] = "no"
        return response

    @action(detail=False, methods=["get"], url_path="for_context")
    def for_context(self, request):
        """Get-or-create THE conversation anchored to one entity, for this user.

        Backs the entity-scoped assistant (e.g. a project's "Assistant" tab):
        one persistent conversation per (household, user, entity), created on
        first visit. Query params: ``entity_type`` + ``object_id``, which must
        name an entity registered in ``agent.searchables``.
        """
        entity_type = (request.query_params.get("entity_type") or "").strip()
        object_id = (request.query_params.get("object_id") or "").strip()
        if not entity_type or not object_id:
            raise ValidationError("entity_type and object_id are required.")
        if searchables.find_spec(entity_type) is None:
            raise ValidationError(f"Unknown entity_type: {entity_type}")

        household = self._resolve_household()
        # The anchor must be a real entity of this household — otherwise any id
        # would silently create an orphan-anchored conversation row.
        resolved, _error = tools.resolve_entity(entity_type, object_id, household)
        if resolved is None:
            raise NotFound(f"No {entity_type} with id {object_id} in this household.")
        conversation, _created = AgentConversation.objects.get_or_create(
            household=household,
            created_by=request.user,
            context_entity_type=entity_type,
            context_object_id=object_id,
        )
        serializer = ConversationDetailSerializer(
            self.get_queryset().get(pk=conversation.pk)
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class AgentMemoryViewSet(viewsets.ModelViewSet):
    """CRUD on the current user's agent memories + a `clear` action.

    Memories are private per (household, user): another member never sees them.
    `create` exists mainly for the frontend undo of a chat-side "forget" (the
    normal creation path is the agent's `manage_memory` tool). Writes delegate
    to `agent.memory` — the same service the tool uses.
    """

    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = AgentMemorySerializer

    def get_queryset(self):
        qs = AgentMemory.objects.for_user_households(self.request.user).filter(
            created_by=self.request.user
        )
        household = getattr(self.request, "household", None)
        if household is not None:
            qs = qs.filter(household=household)
        return qs

    def _resolve_household(self):
        household = getattr(self.request, "household", None) or resolve_request_household(
            self.request
        )
        if household is None:
            raise ValidationError("No active household for this user.")
        return household

    def perform_create(self, serializer):
        serializer.instance = memory_service.save_memory(
            self._resolve_household(),
            self.request.user,
            serializer.validated_data["content"],
        )

    def perform_update(self, serializer):
        serializer.instance = memory_service.update_memory(
            serializer.instance,
            serializer.validated_data["content"],
            user=self.request.user,
        )

    @action(detail=False, methods=["delete"], url_path="clear")
    def clear(self, request):
        """Delete ALL memories of the current user in the active household."""
        deleted = memory_service.clear_memories(self._resolve_household(), request.user)
        return Response({"deleted": deleted}, status=status.HTTP_200_OK)
