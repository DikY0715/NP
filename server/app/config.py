"""应用配置：从环境变量 / .env 读取。"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    def __init__(self) -> None:
        default_db = (BASE_DIR / "yaolin.db").as_posix()
        self.database_url = os.getenv("DATABASE_URL") or f"sqlite:///{default_db}"
        self.jwt_secret = os.getenv("JWT_SECRET", "yaolin-dev-secret-change-me")
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        self.jwt_expires_minutes = int(os.getenv("JWT_EXPIRES_MINUTES", "10080"))
        self.cors_origins = [
            o.strip()
            for o in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000,"
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if o.strip()
        ]
        self.port = int(os.getenv("PORT", "8000"))
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
        # 优先使用响应快的免费多模态模型；失败时按 fallback 顺序自动换模型
        # （账号无额度时只能用 :free 模型，实测 nemotron VL 约 2s 返回）
        self.openrouter_model = os.getenv(
            "OPENROUTER_MODEL", "nvidia/nemotron-3.5-super-vl:free"
        )
        self.openrouter_fallback_models = [
            m.strip()
            for m in os.getenv(
                "OPENROUTER_FALLBACK_MODELS",
                "google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free",
            ).split(",")
            if m.strip()
        ]
        # 演示环境未接入短信网关：把验证码回传前端；上线前设为 false
        self.sms_debug = os.getenv("SMS_DEBUG", "true").lower() == "true"


settings = Settings()
