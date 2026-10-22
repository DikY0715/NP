"""消息中心与未读数。"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Message, User
from ..schemas import MessageOut, UnreadCountOut

router = APIRouter(prefix="/api/messages", tags=["消息"])


@router.get("", response_model=List[MessageOut])
def list_messages(
    current: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return (
        db.query(Message)
        .filter(Message.user_id == current.id)
        .order_by(Message.created_at.desc())
        .all()
    )


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(
    current: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    count = (
        db.query(Message)
        .filter(Message.user_id == current.id, Message.read.is_(False))
        .count()
    )
    return UnreadCountOut(count=count)


@router.post("/read-all")
def mark_all_read(
    current: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    updated = (
        db.query(Message)
        .filter(Message.user_id == current.id, Message.read.is_(False))
        .update({"read": True})
    )
    db.commit()
    return {"updated": updated}


@router.post("/{message_id}/read", response_model=MessageOut)
def mark_read(
    message_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = (
        db.query(Message)
        .filter(Message.id == message_id, Message.user_id == current.id)
        .first()
    )
    if message is None:
        raise HTTPException(status_code=404, detail="消息不存在")
    message.read = True
    db.commit()
    db.refresh(message)
    return message
