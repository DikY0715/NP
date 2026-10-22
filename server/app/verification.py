"""手机验证码：内存存储，带有效期、重发冷却与错误次数限制。

演示环境未接入短信网关，``SMS_DEBUG=true`` 时接口会把验证码回传给前端便于联调；
接入真实网关后只需替换 :func:`send_code` 内的发送实现。
"""

import random
import threading
import time
from typing import Dict

CODE_TTL_SECONDS = 300
RESEND_INTERVAL_SECONDS = 60
MAX_ATTEMPTS = 5

_lock = threading.Lock()
_codes: Dict[str, dict] = {}


class SmsCooldown(Exception):
    """重发过于频繁，携带剩余等待秒数。"""

    def __init__(self, seconds: int) -> None:
        super().__init__(f"请 {seconds} 秒后重试")
        self.seconds = seconds


def send_code(phone: str) -> str:
    """生成并"发送"验证码，返回验证码明文（仅调试模式会回传给前端）。"""
    now = time.time()
    with _lock:
        record = _codes.get(phone)
        if record and now - record["sent_at"] < RESEND_INTERVAL_SECONDS:
            raise SmsCooldown(
                int(RESEND_INTERVAL_SECONDS - (now - record["sent_at"])) + 1
            )
        code = f"{random.randint(0, 999999):06d}"
        _codes[phone] = {
            "code": code,
            "sent_at": now,
            "expires_at": now + CODE_TTL_SECONDS,
            "attempts": 0,
        }
    return code


def verify_code(phone: str, code: str) -> bool:
    """校验验证码；校验通过后立即作废，失败次数超限也作废。"""
    now = time.time()
    with _lock:
        record = _codes.get(phone)
        if record is None:
            return False
        if now > record["expires_at"]:
            _codes.pop(phone, None)
            return False
        record["attempts"] += 1
        if record["attempts"] > MAX_ATTEMPTS:
            _codes.pop(phone, None)
            return False
        if record["code"] != code:
            return False
        _codes.pop(phone, None)
        return True
