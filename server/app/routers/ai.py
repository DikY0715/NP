"""AI 识药：由服务端持有密钥，调用 OpenRouter 多模态模型解析药盒信息。

性能设计（针对「识别太慢」）：
1. 默认使用响应快的多模态模型（gemini-2.0-flash），而不是 openrouter/free 免费自动路由；
2. 多模型按顺序兜底，某个模型超时/报错/限流时自动换下一个；
3. 关闭推理输出（reasoning）、限制 max_tokens、按吞吐优先选供应商，避免模型长时间“思考”；
4. 同一张图片的结果做内存缓存，重复识别直接命中；
5. 支持一次上传多张图（如药盒正面 + 背面/有效期面）合并识别。
"""

import calendar
import hashlib
import json
import time
from collections import OrderedDict
from datetime import date
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..config import settings
from ..deps import get_current_user
from ..drug_classifier import classify
from ..name_corrector import correct_medicine
from ..models import User
from ..schemas import RecognizedMedicineOut, RecognizeIn
from ..utils import days_left

router = APIRouter(prefix="/api/ai", tags=["AI"])

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# 单次识别超时：连接 5s，读取 25s（快模型通常 1~3s 返回）
HTTP_TIMEOUT = httpx.Timeout(connect=5.0, read=25.0, write=10.0, pool=5.0)

# 最多同时识别 3 张图，避免上传体积与耗时失控
MAX_IMAGES = 3

RECOGNIZE_PROMPT = """你是药品信息识别助手。请识别图片中药盒包装上的文字，只输出一个 JSON 对象，不要输出任何解释文字，也不要用 markdown 代码块包裹。

JSON 结构：
{"name":"","spec":"","symptoms":[],"expiryDate":"","quantity":0,"unit":""}

字段要求：
- name：药品名称（通用名或商品名），不要带规格
- spec：完整规格，例如 "0.3g x 24粒"
- symptoms：从包装的【适应症】或【功能主治】中提取 2-5 个简短中文关键词
- expiryDate：把包装上的有效期/失效期换算成 YYYY-MM-DD，无法确定时返回空字符串
- quantity：规格中标明的最小包装总数量（整数），无法确定时返回 0
- unit：最小计量单位，例如 粒/片/袋/瓶/支/ml

若提供多张图片，请综合所有图片中的信息（例如正面看药品名称，背面看规格与有效期）。"""


# ------------------------------------------------------------------ 结果缓存
_CACHE: "OrderedDict[str, RecognizedMedicineOut]" = OrderedDict()
_CACHE_MAX = 64


def _cache_key(images: List[str]) -> str:
    digest = hashlib.sha256()
    for img in images:
        digest.update(img.encode("utf-8"))
    return digest.hexdigest()


def _cache_get(key: str) -> Optional[RecognizedMedicineOut]:
    hit = _CACHE.get(key)
    if hit is not None:
        _CACHE.move_to_end(key)
    return hit


def _cache_put(key: str, value: RecognizedMedicineOut) -> None:
    _CACHE[key] = value
    _CACHE.move_to_end(key)
    while len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)


# ------------------------------------------------------------------ 工具函数
def _pick_str(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def _normalize_image(image: str) -> str:
    """统一成 dataURL 形式。"""
    return image if image.startswith("data:") else "data:image/jpeg;base64," + image


def _normalize_expiry(raw: str) -> str:
    """把模型返回的多种日期写法统一成 YYYY-MM-DD，无法解析时返回空串。

    模型常把「有效期至 2027-08」直接原样返回，原逻辑会因长度不足而丢弃；
    这里补全为「该月最后一天」（有效期“至”某月，按月末处理更安全）。
    """
    text = (raw or "").strip()
    if not text:
        return ""
    for ch in "/.年月":
        text = text.replace(ch, "-")
    text = text.replace("日", "")
    nums = [int(p) for p in text.split("-") if p.strip().isdigit()]
    if not nums:
        return ""
    year = nums[0]
    if year < 1000:
        return ""
    if len(nums) == 1:
        return f"{year}-12-31"
    month = nums[1]
    if not 1 <= month <= 12:
        return ""
    if len(nums) >= 3:
        day = nums[2]
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            return ""
    return date(year, month, calendar.monthrange(year, month)[1]).isoformat()


def _model_chain() -> List[str]:
    """识别模型优先顺序：主模型 → 兜底模型 → openrouter/free 最终兜底。"""
    chain = [settings.openrouter_model, *settings.openrouter_fallback_models]
    if "openrouter/free" not in chain:
        chain.append("openrouter/free")
    seen: set[str] = set()
    ordered: List[str] = []
    for model in chain:
        if model and model not in seen:
            seen.add(model)
            ordered.append(model)
    return ordered


def _build_body(model: str, images: List[str], hint: str) -> dict:
    prompt = RECOGNIZE_PROMPT
    if hint:
        prompt += f"\n\n补充提示：{hint}"
    content: List[dict] = [{"type": "text", "text": prompt}]
    for image in images:
        content.append({"type": "image_url", "image_url": {"url": image}})
    return {
        "model": model,
        "temperature": 0.1,
        "max_tokens": 512,
        # 关闭推理链，避免部分模型长时间“思考”导致响应变慢
        "reasoning": {"enabled": False},
        # 优先选择吞吐更高的供应商，并允许自动切换
        "provider": {"sort": "throughput", "allow_fallbacks": True},
        "messages": [{"role": "user", "content": content}],
    }


def _parse_content(content: str) -> RecognizedMedicineOut:
    cleaned = content.replace("```json", "").replace("```", "")
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise HTTPException(status_code=502, detail="AI 返回内容无法解析，请重试")

    try:
        parsed = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI 返回内容无法解析，请重试")

    expiry = _normalize_expiry(_pick_str(parsed.get("expiryDate")))

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

    # 先对识别出的药名做标准化纠错（噪声信道模型），再分类
    raw_name = name
    name = correct_medicine(name)

    # 用本地分类器自动判定处方药/非处方药与药品品类
    drug = classify(name)

    return RecognizedMedicineOut(
        name=name,
        spec=_pick_str(parsed.get("spec")),
        symptoms=symptoms,
        expiryDate=expiry,
        quantity=quantity,
        unit=_pick_str(parsed.get("unit")) or "粒",
        daysLeft=days_left(expiry) if expiry else None,
        isOtc=drug.is_otc,
        category=drug.category,
        rawName=raw_name if raw_name != name else "",
    )


# ------------------------------------------------------------------ 路由
@router.post("/recognize", response_model=RecognizedMedicineOut)
async def recognize(
    payload: RecognizeIn, current: User = Depends(get_current_user)
):
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=503,
            detail="服务端未配置 AI 密钥（请在 server/.env 设置 OPENROUTER_API_KEY）",
        )

    raw_images = [i for i in payload.images if i] or ([payload.image] if payload.image else [])
    if not raw_images:
        raise HTTPException(status_code=422, detail="缺少图片数据")
    images = [_normalize_image(i) for i in raw_images[:MAX_IMAGES]]

    key = _cache_key(images)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    errors: List[str] = []
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        for model in _model_chain():
            started = time.perf_counter()
            try:
                response = await client.post(
                    OPENROUTER_URL,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                    },
                    json=_build_body(model, images, payload.hint),
                )
            except httpx.TimeoutException:
                errors.append(f"{model}: 超时")
                continue
            except httpx.HTTPError as exc:
                errors.append(f"{model}: {exc}")
                continue

            if response.status_code != 200:
                errors.append(f"{model}: HTTP {response.status_code}")
                continue

            data = response.json()
            choices = data.get("choices") or []
            content = None
            if choices:
                content = (choices[0].get("message") or {}).get("content")
            if not content:
                errors.append(f"{model}: 空结果")
                continue

            try:
                result = _parse_content(content)
            except HTTPException as exc:
                # 该模型没读出来，换下一个模型再试
                errors.append(f"{model}: {exc.detail}")
                continue

            result.model = model
            result.elapsedMs = int((time.perf_counter() - started) * 1000)
            _cache_put(key, result)
            return result

    detail = "AI 识别失败，请重试"
    if errors:
        detail += f"（{'；'.join(errors[-2:])}）"
    raise HTTPException(status_code=502, detail=detail)