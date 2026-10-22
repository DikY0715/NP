"""在线问诊：居民与社区医生的微信式聊天。"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_doctor, require_resident
from ..models import ConsultConversation, ConsultMessage, User
from ..schemas import (
    ConsultConversationOut,
    ConsultMessageOut,
    ConsultSendIn,
    ConsultThreadOut,
)

router = APIRouter(prefix="/api/consult", tags=["在线问诊"])


def _get_or_create(db: Session, resident: User) -> ConsultConversation:
    conv = (
        db.query(ConsultConversation)
        .filter(ConsultConversation.resident_id == resident.id)
        .first()
    )
    if conv is None:
        conv = ConsultConversation(resident_id=resident.id)
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv


def _append(db: Session, conv: ConsultConversation, sender: User, role: str, content: str):
    text = content.strip()
    if not text:
        raise HTTPException(status_code=400, detail="消息内容不能为空")
    msg = ConsultMessage(
        conversation_id=conv.id,
        sender_id=sender.id,
        sender_role=role,
        content=text,
        read=(role == "doctor"),
    )
    db.add(msg)
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/my", response_model=ConsultThreadOut)
def my_thread(
    current: User = Depends(require_resident),
    db: Session = Depends(get_db),
):
    """居民进入问诊聊天（不存在则自动创建会话），并标记医生消息已读。"""
    conv = _get_or_create(db, current)
    db.query(ConsultMessage).filter(
        ConsultMessage.conversation_id == conv.id,
        ConsultMessage.sender_role == "doctor",
        ConsultMessage.read.is_(False),
    ).update({"read": True})
    db.commit()
    db.refresh(conv)
    return {"conversation": conv, "messages": conv.messages}


@router.post("/my/messages", response_model=ConsultMessageOut, status_code=status.HTTP_201_CREATED)
def send_message(
    payload: ConsultSendIn,
    current: User = Depends(require_resident),
    db: Session = Depends(get_db),
):
    """居民发送消息。"""
    conv = _get_or_create(db, current)
    return _append(db, conv, current, "resident", payload.content)


@router.get("/conversations", response_model=List[ConsultConversationOut])
def list_conversations(
    current: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """医生端会话列表（按最近活跃排序）。"""
    return (
        db.query(ConsultConversation)
        .order_by(ConsultConversation.updated_at.desc())
        .all()
    )


@router.get("/conversations/{conversation_id}", response_model=ConsultThreadOut)
def doctor_thread(
    conversation_id: int,
    current: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """医生查看某个居民的聊天，并标记居民消息已读。"""
    conv = (
        db.query(ConsultConversation)
        .filter(ConsultConversation.id == conversation_id)
        .first()
    )
    if conv is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    if conv.doctor_id is None:
        conv.doctor_id = current.id
    db.query(ConsultMessage).filter(
        ConsultMessage.conversation_id == conv.id,
        ConsultMessage.sender_role == "resident",
        ConsultMessage.read.is_(False),
    ).update({"read": True})
    db.commit()
    db.refresh(conv)
    return {"conversation": conv, "messages": conv.messages}


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ConsultMessageOut,
    status_code=status.HTTP_201_CREATED,
)
def doctor_send_message(
    conversation_id: int,
    payload: ConsultSendIn,
    current: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """医生回复居民。"""
    conv = (
        db.query(ConsultConversation)
        .filter(ConsultConversation.id == conversation_id)
        .first()
    )
    if conv is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    if conv.doctor_id is None:
        conv.doctor_id = current.id
    return _append(db, conv, current, "doctor", payload.content)
