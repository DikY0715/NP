"""AI 识药：由服务端持有密钥，调用 OpenRouter 多模态模型解析药盒信息。"""

from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..config import settings
from ..deps import get_current_user
from ..models import User
from ..schemas import RecognizedMedicineOut, RecognizeIn
from ..utils import days_left

router = APIRouter(prefix="/api/ai", tags=["AI"])

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

RECOGNIZE_PROMPT = """你是药品信息识别助手。请识别图片中药盒包装上的文字，只输出一个 JSON 对象，不要输出任何解释文字，也不要用 markdown 代码块包裹。

JSON 结构：
{"name":"","spec":"","symptoms":[],"expiryDate":"","quantity":0,"unit":""}

字段要求：
- name：药品名称（通用名或商品名），不要带规格
- spec：完整规格，例如 "0.3g x 24粒"
- symptoms：从包装的【适应症】或【功能主治】中提取 2-5 个简短中文关键词
- expiryDate：把包装上的有效期/失效期换算成 YYYY-MM-DD，无法确定时返回空字符串
- quantity：规格中标明的最小包装总数量（整数），无法确定时返回 0
- unit：最小计量单位，例如 粒/片/袋/瓶/支/ml"""


def _pick_str(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def _parse_content(content: str) -> RecognizedMedicineOut:
    cleaned = content.replace("```json", "").replace("```", "")
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise HTTPException(status_code=502, detail="AI 返回内容无法解析，请重试")

    import json

    try:
        parsed = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI 返回内容无法解析，请重试")

    expiry = _pick_str(parsed.get("expiryDate"))
    if not (len(expiry) == 10 and expiry[4] == "-" and expiry[7] == "-"):
        expiry = ""

    try:
        quantity = int(parsed.get("quantity") or 0)
    except (TypeError, ValueError):
        quantity = 0
    quantity = quantity if quantity > 0 else 0

    symptoms = [
        s.strip()
        for s in (parsed.get("symptoms") or [])
        if isinstance(s, str) and s.strip()
    ][:5]

    name = _pick_str(parsed.get("name"))
    if not name:
        raise HTTPException(
            status_code=422, detail="未识别出药品名称，请将药盒正面放入取景框后重试"
        )

    return RecognizedMedicineOut(
        name=name,
        spec=_pick_str(parsed.get("spec")),
        symptoms=symptoms,
        expiryDate=expiry,
        quantity=quantity,
        unit=_pick_str(parsed.get("unit")) or "粒",
        daysLeft=days_left(expiry) if expiry else None,
    )


@router.post("/recognize", response_model=RecognizedMedicineOut)
async def recognize(
    payload: RecognizeIn, current: User = Depends(get_current_user)
):
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=503,
            detail="服务端未配置 AI 密钥（请在 server/.env 设置 OPENROUTER_API_KEY）",
        )
    if not payload.image:
        raise HTTPException(status_code=422, detail="缺少图片数据")

    image_url = payload.image
    if not image_url.startswith("data:"):
        image_url = "data:image/jpeg;base64," + image_url

    body = {
        "model": settings.openrouter_model,
        "temperature": 0.1,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": RECOGNIZE_PROMPT},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                OPENROUTER_URL,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                },
                json=body,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"AI 服务请求失败：{exc}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"AI 识别失败（{response.status_code}）：{response.text[:80]}",
        )

    data = response.json()
    choices = data.get("choices") or []
    content: Optional[str] = None
    if choices:
        content = (choices[0].get("message") or {}).get("content")
    if not content:
        raise HTTPException(status_code=502, detail="AI 未返回识别结果，请重试")

    return _parse_content(content)
