from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/live")
async def live() -> dict[str, str]:
    return {"status": "ok"}
