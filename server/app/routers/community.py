"""社区互助：邻里共享药箱、求助发布与响应。"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_resident
from ..models import HelpPost, HelpResponse, LockerDropoff, Medicine, Message, User
from ..schemas import (
    CommunityMedicineOut,
    HelpPostCreate,
    HelpPostOut,
    HelpRespondIn,
    LockerDropoffCreate,
    LockerDropoffOut,
)
from ..utils import calc_expiry_status, fake_distance
from ..rewards import is_blacklisted

router = APIRouter(prefix="/api/community", tags=["社区互助"])


def _mask_phone(phone: str) -> str:
    if not phone or len(phone) < 7:
        return phone
    return phone[:3] + "****" + phone[-4:]


def _distance_sort_key(my_building: str, other_building: str):
    text = fake_distance(my_building, other_building)
    if text == "同楼栋":
        return (0, 0)
    try:
        return (1, int(text.rstrip("m")))
    except ValueError:
        return (2, 0)


@router.get("/medicines", response_model=List[CommunityMedicineOut])
def community_medicines(
    scope: str = "community",
    keyword: Optional[str] = None,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """邻居共享药箱。

    可见性规则（按药主设置的共享范围）：
    - 共享范围="本小区"：对整个小区的邻居可见（含同楼栋）；
    - 共享范围="本楼栋"：仅对同楼栋邻居可见。
    查看范围 scope=building 时，进一步只保留同楼栋的药。
    """
    query = (
        db.query(Medicine)
        .join(User, Medicine.owner_id == User.id)
        .filter(
            Medicine.visibility == "public",
            Medicine.share_mode != "none",
            Medicine.recycled.is_(False),
            Medicine.compliance_status == "ok",
            Medicine.is_otc.is_(True),
            Medicine.owner_id != current.id,
            User.community == current.community,
            or_(
                Medicine.share_scope == "community",
                and_(
                    Medicine.share_scope == "building",
                    User.building == current.building,
                ),
            ),
        )
    )
    if scope == "building":
        query = query.filter(User.building == current.building)

    items = [m for m in query.all() if calc_expiry_status(m.expiry_date) != "expired"]

    if keyword:
        needle = keyword.lower()
        items = [
            m
            for m in items
            if needle in (m.name or "").lower()
            or any(needle in s.lower() for s in (m.symptoms or []))
        ]

    items.sort(
        key=lambda m: _distance_sort_key(
            current.building, m.owner.building if m.owner else ""
        )
    )

    return [
        CommunityMedicineOut(
            id=m.id,
            medicine_id=m.id,
            name=m.name,
            spec=m.spec,
            owner_id=m.owner_id,
            owner_name=m.owner.name if m.owner else "",
            owner_avatar=m.owner.avatar if m.owner else "",
            building=m.owner.building if m.owner else "",
            distance=fake_distance(current.building, m.owner.building if m.owner else ""),
            phone=_mask_phone(m.owner.phone if m.owner else ""),
            share_mode=m.share_mode,
            unit_price=m.unit_price,
            quantity=m.quantity,
            unit=m.unit,
            expiry_date=m.expiry_date,
            symptoms=m.symptoms or [],
            is_cabinet=m.is_cabinet,
            source_label="驿站自营" if m.is_cabinet else "邻居闲置",
        )
        for m in items
    ]


@router.post(
    "/locker/dropoffs", response_model=LockerDropoffOut, status_code=status.HTTP_201_CREATED
)
def create_dropoff(
    payload: LockerDropoffCreate,
    current: User = Depends(require_resident),
    db: Session = Depends(get_db),
):
    """居民自助登记：把闲置药品放入柜子中转格口，等待管理员实物核验。"""
    medicine = db.query(Medicine).filter(Medicine.id == payload.medicine_id).first()
    if medicine is None:
        raise HTTPException(status_code=404, detail="药品不存在")
    if is_blacklisted(db, current.id):
        raise HTTPException(
            status_code=403, detail="你已被列入黑名单，暂不能共享药品，请联系社区管理员"
        )
    if medicine.owner_id != current.id:
        raise HTTPException(status_code=403, detail="只能投放自己名下的药品")
    if not medicine.is_otc:
        raise HTTPException(
            status_code=400, detail="处方药不可赠与或转让，请联系医生开具处方"
        )
    if calc_expiry_status(medicine.expiry_date) == "expired":
        raise HTTPException(status_code=400, detail="过期药品不可投放")
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="投放数量必须大于 0")
    if medicine.quantity < payload.quantity:
        raise HTTPException(status_code=400, detail="投放数量超过自有库存")
    pending = (
        db.query(LockerDropoff)
        .filter(
            LockerDropoff.medicine_id == medicine.id,
            LockerDropoff.status == "pending_verify",
        )
        .first()
    )
    if pending is not None:
        raise HTTPException(status_code=400, detail="该药品已有待核验的投放登记")

    dropoff = LockerDropoff(
        medicine_id=medicine.id,
        owner_id=current.id,
        quantity=payload.quantity,
        note=payload.note,
        status="pending_verify",
    )
    db.add(dropoff)
    db.flush()

    # 投放后先由医生做用药安全评估，再由管理员核验实物，因此重置评估结论
    medicine.compliance_status = "pending"
    medicine.compliance_note = ""

    doctors = (
        db.query(User)
        .filter(User.role == "doctor", User.community == current.community)
        .all()
    )
    for doctor in doctors:
        db.add(
            Message(
                user_id=doctor.id,
                type="system",
                sender_id=current.id,
                title="待用药安全评估",
                content=(
                    f"{current.name}（{current.building}）将 {medicine.name} × "
                    f"{payload.quantity}{medicine.unit} 放入中转格口，请评估用药安全"
                ),
            )
        )

    admins = (
        db.query(User)
        .filter(User.role == "admin", User.community == current.community)
        .all()
    )
    for admin in admins:
        db.add(
            Message(
                user_id=admin.id,
                type="system",
                sender_id=current.id,
                title="居民自助投放待核验",
                content=(
                    f"{current.name}（{current.building}）将 {medicine.name} × "
                    f"{payload.quantity}{medicine.unit} 放入中转格口，请核验实物"
                ),
            )
        )
    db.commit()
    db.refresh(dropoff)
    return dropoff


@router.get("/locker/dropoffs/mine", response_model=List[LockerDropoffOut])
def my_dropoffs(
    current: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return (
        db.query(LockerDropoff)
        .filter(LockerDropoff.owner_id == current.id)
        .order_by(LockerDropoff.created_at.desc())
        .all()
    )


@router.get("/helps/mine", response_model=List[HelpPostOut])
def my_help_posts(
    current: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return (
        db.query(HelpPost)
        .filter(HelpPost.author_id == current.id)
        .order_by(HelpPost.created_at.desc())
        .all()
    )


@router.get("/helps", response_model=List[HelpPostOut])
def list_help_posts(
    scope: Optional[str] = None,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(HelpPost).filter(HelpPost.author_id != current.id)
    if scope:
        query = query.filter(HelpPost.scope == scope)
    return query.order_by(HelpPost.created_at.desc()).all()


@router.post("/helps", response_model=HelpPostOut, status_code=status.HTTP_201_CREATED)
def create_help_post(
    payload: HelpPostCreate,
    current: User = Depends(require_resident),
    db: Session = Depends(get_db),
):
    post = HelpPost(author_id=current.id, **payload.model_dump())
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.post("/helps/{post_id}/respond", status_code=status.HTTP_201_CREATED)
def respond_help_post(
    post_id: int,
    payload: HelpRespondIn,
    current: User = Depends(require_resident),
    db: Session = Depends(get_db),
):
    post = db.query(HelpPost).filter(HelpPost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="求助不存在")
    if post.author_id == current.id:
        raise HTTPException(status_code=400, detail="不能响应自己发布的求助")

    db.add(
        HelpResponse(post_id=post_id, responder_id=current.id, message=payload.message)
    )
    db.add(
        Message(
            user_id=post.author_id,
            type="system",
            sender_id=current.id,
            title="有人回应了你的求助",
            content=f"{current.name}：{payload.message or '我可以提供帮助'}",
        )
    )
    db.commit()
    return {"ok": True, "responses": post.responses + 1}
