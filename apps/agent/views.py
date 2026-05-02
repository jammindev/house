"""DRF views for the agent."""
from __future__ import annotations

import logging
from dataclasses import asdict

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHouseholdMember, resolve_request_household

from . import service
from .llm import LLMError, LLMTimeoutError
from .serializers import AskRequestSerializer, AskResponseSerializer

logger = logging.getLogger(__name__)


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
