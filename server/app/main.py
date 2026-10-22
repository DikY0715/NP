"""FastAPI 应用入口。"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import (
    admin,
    ai,
    auth,
    borrow,
    community,
    consultations,
    health,
    medicines,
    messages,
    points,
    review,
    safety,
    transactions,
)

# 首次启动自动建表（SQLite 零配置）
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="药邻 Yaolin API",
    description="社区智慧驿站家庭药品互助服务系统 —— 后端接口",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (
    auth,
    medicines,
    community,
    borrow,
    messages,
    transactions,
    review,
    admin,
    ai,
    consultations,
    health,
    safety,
    points,
):
    app.include_router(module.router)


@app.get("/api/health", tags=["系统"])
def health():
    return {"status": "ok", "service": "yaolin-server", "version": "0.1.0"}
