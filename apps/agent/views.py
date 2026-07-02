"""DRF views for the agent."""
from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHouseholdMember, resolve_request_household

from . import searchables, service
from .llm import LLMError, LLMTimeoutError
from .models import AgentConversation, AgentMessage
from .serializers import (
    AskRequestSerializer,
    AskResponseSerializer,
    AgentMessageSerializer,
    ConversationDetailSerializer,
    ConversationListSerializer,
    ConversationUpdateSerializer,
    PostMessageSerializer,
)

logger = logging.getLogger(__name__)

CONVERSATION_HISTORY_LIMIT = 20
AUTO_TITLE_MAX_LEN = 60


def _citations_to_json(citations) -> list[dict]:
    return [
        {
            "entity_type": c.entity_type,
            "id": str(c.id),
            "label": c.label,
            "snippet": c.snippet,
            "url_path": c.url_path,
        }
        for c in citations
    ]


def _derive_title(question: str) -> str:
    return " ".join((question or "").split())[:AUTO_TITLE_MAX_LEN]


class AskView(APIView):
    """``POST /api/agent/ask/`` — answer a household question."""

    permission_classes = [IsAuthenticated, IsHouseholdMember]

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
        if self.action in {"retrieve", "messages", "for_context"}:
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

        # History = prior turns (oldest first), bounded. Built before we persist
        # the new question so the current turn isn't fed back to itself.
        prior = list(conversation.messages.all())[-CONVERSATION_HISTORY_LIMIT:]
        history = [{"role": m.role, "content": m.content} for m in prior]

        # Anchored conversations pre-inject their entity's context each turn.
        context_entity = (
            (conversation.context_entity_type, conversation.context_object_id)
            if conversation.has_context
            else None
        )

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

        # Persist both turns only once we have an answer — a failed call leaves
        # the conversation untouched.
        with transaction.atomic():
            AgentMessage.objects.create(
                conversation=conversation,
                role=AgentMessage.Role.USER,
                content=question,
                created_by=request.user,
            )
            agent_msg = AgentMessage.objects.create(
                conversation=conversation,
                role=AgentMessage.Role.AGENT,
                content=result.answer,
                citations=_citations_to_json(result.citations),
                metadata=result.metadata,
            )
            conversation.last_message_at = timezone.now()
            if not conversation.title:
                conversation.title = _derive_title(question)
            conversation.save(update_fields=["last_message_at", "title", "updated_at"])

        return Response(
            AgentMessageSerializer(agent_msg).data, status=status.HTTP_201_CREATED
        )

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
