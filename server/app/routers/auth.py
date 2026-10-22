"""用户注册 / 登录 / 个人资料。

居民通过「手机号 + 短信验证码」自助注册，用户名即手机号；
医生与管理员账号不由居民注册，由管理员在后台分配（见 admin 路由）。
"""

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import verification
from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import (
    SmsCodeIn,
    SmsCodeOut,
    TokenOut,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["认证"])

PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")


def _check_phone(phone: str) -> str:
    phone = phone.strip()
    if not PHONE_PATTERN.fullmatch(phone):
        raise HTTPException(status_code=400, detail="请输入正确的 11 位手机号")
    return phone


@router.post("/sms-code", response_model=SmsCodeOut)
def send_sms_code(payload: SmsCodeIn, db: Session = Depends(get_db)):
    """发送注册验证码（5 分钟有效，60 秒内不可重复发送）。"""
    phone = _check_phone(payload.phone)
    if db.query(User).filter(User.phone == phone).first():
        raise HTTPException(status_code=409, detail="该手机号已注册，请直接登录")
    try:
        code = verification.send_code(phone)
    except verification.SmsCooldown as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    return SmsCodeOut(
        expires_in=verification.CODE_TTL_SECONDS,
        debug_code=code if settings.sms_debug else None,
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    phone = _check_phone(payload.phone)
    if not verification.verify_code(phone, payload.code.strip()):
        raise HTTPException(status_code=400, detail="验证码错误或已过期")
    if db.query(User).filter(or_(User.username == phone, User.phone == phone)).first():
        raise HTTPException(status_code=409, detail="该手机号已注册，请直接登录")

    user = User(
        username=phone,
        password_hash=hash_password(payload.password),
        name=payload.name.strip(),
        phone=phone,
        building=payload.building.strip(),
        community=payload.community.strip(),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(
        access_token=create_access_token(user.id), user=UserOut.model_validate(user)
    )


@router.post("/login", response_model=TokenOut)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """支持用户名或手机号登录。"""
    identifier = payload.username.strip()
    user = (
        db.query(User)
        .filter(or_(User.username == identifier, User.phone == identifier))
        .first()
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return TokenOut(
        access_token=create_access_token(user.id), user=UserOut.model_validate(user)
    )


@router.get("/me", response_model=UserOut)
def read_me(current: User = Depends(get_current_user)):
    return current


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current, field, value)
    db.commit()
    db.refresh(current)
    return current
