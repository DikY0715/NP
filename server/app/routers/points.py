"""积分激励：积分账户、积分明细、小礼品兑换。"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin, require_resident
from ..models import Gift, GiftRedemption, Message, PointLog, User
from ..rewards import POINT_RULES, add_points, ensure_seed_gifts, get_point_account
from ..schemas import (
    GiftIn,
    GiftOut,
    PointAccountOut,
    PointLogOut,
    PointRuleOut,
    RedeemIn,
    RedemptionOut,
)

router = APIRouter(prefix="/api/points", tags=["积分激励"])


@router.get("", response_model=PointAccountOut)
def my_points(
    current: User = Depends(require_resident), db: Session = Depends(get_db)
):
    account = get_point_account(db, current.id)
    db.commit()
    return PointAccountOut(
        balance=account.balance or 0,
        total_earned=account.total_earned or 0,
        rules=[PointRuleOut(label=label, points=points) for label, points in POINT_RULES],
    )


@router.get("/logs", response_model=List[PointLogOut])
def my_point_logs(
    current: User = Depends(require_resident), db: Session = Depends(get_db)
):
    return (
        db.query(PointLog)
        .filter(PointLog.user_id == current.id)
        .order_by(PointLog.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/gifts", response_model=List[GiftOut])
def list_gifts(
    current: User = Depends(require_resident), db: Session = Depends(get_db)
):
    ensure_seed_gifts(db)
    return (
        db.query(Gift)
        .filter(Gift.active.is_(True))
        .order_by(Gift.points)
        .all()
    )


@router.post("/redeem", response_model=RedemptionOut, status_code=201)
def redeem_gift(
    payload: RedeemIn,
    current: User = Depends(require_resident),
    db: Session = Depends(get_db),
):
    gift = db.query(Gift).filter(Gift.id == payload.gift_id, Gift.active.is_(True)).first()
    if gift is None:
        raise HTTPException(status_code=404, detail="礼品不存在或已下架")
    if gift.stock <= 0:
        raise HTTPException(status_code=400, detail="该礼品已兑完")

    account = get_point_account(db, current.id)
    if (account.balance or 0) < gift.points:
        raise HTTPException(status_code=400, detail="积分不足，快去共享闲置药赚积分吧")

    add_points(db, current.id, -gift.points, f"兑换礼品：{gift.name}")
    gift.stock -= 1
    redemption = GiftRedemption(
        user_id=current.id,
        gift_id=gift.id,
        gift_name=gift.name,
        points=gift.points,
        status="pending",
    )
    db.add(redemption)
    db.flush()
    db.add(
        Message(
            user_id=current.id,
            type="system",
            title="兑换成功",
            content=f"你已用 {gift.points} 积分兑换「{gift.name}」，请到驿站领取",
        )
    )
    db.commit()
    db.refresh(redemption)
    return redemption


@router.get("/redemptions/mine", response_model=List[RedemptionOut])
def my_redemptions(
    current: User = Depends(require_resident), db: Session = Depends(get_db)
):
    return (
        db.query(GiftRedemption)
        .filter(GiftRedemption.user_id == current.id)
        .order_by(GiftRedemption.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------- 管理员
@router.get("/admin/redemptions", response_model=List[RedemptionOut])
def list_redemptions(
    status_filter: str = "pending",
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = (
        db.query(GiftRedemption)
        .join(User, GiftRedemption.user_id == User.id)
        .filter(User.community == current.community)
    )
    if status_filter != "all":
        query = query.filter(GiftRedemption.status == status_filter)
    return query.order_by(GiftRedemption.created_at.desc()).all()


@router.post("/admin/redemptions/{redemption_id}/fulfill", response_model=RedemptionOut)
def fulfill_redemption(
    redemption_id: int,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    redemption = (
        db.query(GiftRedemption)
        .filter(GiftRedemption.id == redemption_id)
        .first()
    )
    if redemption is None:
        raise HTTPException(status_code=404, detail="兑换记录不存在")
    if redemption.user and redemption.user.community != current.community:
        raise HTTPException(status_code=403, detail="只能处理本小区的兑换")
    if redemption.status != "pending":
        raise HTTPException(status_code=400, detail="该兑换已发放")

    redemption.status = "fulfilled"
    redemption.fulfilled_at = datetime.utcnow()
    db.add(
        Message(
            user_id=redemption.user_id,
            type="system",
            sender_id=current.id,
            title="礼品已发放",
            content=f"你兑换的「{redemption.gift_name}」已在驿站完成发放",
        )
    )
    db.commit()
    db.refresh(redemption)
    return redemption


@router.post("/admin/gifts", response_model=GiftOut, status_code=201)
def create_gift(
    payload: GiftIn,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if payload.points <= 0:
        raise HTTPException(status_code=400, detail="所需积分必须大于 0")
    gift = Gift(
        name=payload.name.strip(),
        description=payload.description.strip(),
        points=payload.points,
        stock=max(0, payload.stock),
        active=True,
    )
    db.add(gift)
    db.commit()
    db.refresh(gift)
    return gift
