"""医生端：药品安全审核。

- 借药安全审核：审核居民借药申请中症状与药品的匹配性（是否对症、有无禁忌）；
- 共享药品合规审核：审核居民共享药品的信息合规性。
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_doctor
from ..models import BorrowRequest, LockerDropoff, Medicine, Message, User
from ..schemas import (
    BorrowRequestOut,
    ComplianceDecisionIn,
    ReviewDecisionIn,
    ReviewMedicineOut,
)

router = APIRouter(prefix="/api/review", tags=["医生审核"])


def _sync_request_message(db: Session, request_id: int, new_status: str) -> None:
    db.query(Message).filter(
        Message.request_id == request_id, Message.type == "borrow_request"
    ).update({"status": new_status})


@router.get("/borrows", response_model=List[BorrowRequestOut])
def list_review_borrows(
    status_filter: str = "pending",
    current: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """本小区借药申请审核队列。status: pending / approved / rejected / all。"""
    query = (
        db.query(BorrowRequest)
        .join(User, BorrowRequest.owner_id == User.id)
        .filter(User.community == current.community)
    )
    if status_filter != "all":
        query = query.filter(BorrowRequest.status == status_filter)
    return query.order_by(BorrowRequest.created_at.desc()).all()


@router.post("/borrows/{request_id}", response_model=BorrowRequestOut)
def decide_borrow(
    request_id: int,
    payload: ReviewDecisionIn,
    current: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    request = db.query(BorrowRequest).filter(BorrowRequest.id == request_id).first()
    if request is None:
        raise HTTPException(status_code=404, detail="借药请求不存在")
    if request.owner and request.owner.community != current.community:
        raise HTTPException(status_code=403, detail="只能审核本小区的借药请求")
    if request.status != "pending":
        raise HTTPException(status_code=400, detail="该请求已审核")

    new_status = "pending_admin" if payload.approved else "rejected"
    request.status = new_status
    request.doctor_id = current.id
    request.doctor_note = payload.note
    request.reviewed_at = datetime.utcnow()
    _sync_request_message(db, request.id, new_status)

    if payload.approved:
        title = "医生审核通过，等待驿站实物核验"
        content = (
            f"你申请的 {request.medicine_name} 已通过医生安全审核，"
            f"等待管理员核验中转格口内的实物药品"
        )
        if payload.note:
            content += f"。医生嘱咐：{payload.note}"
    else:
        title = "借药审核未通过"
        content = f"你申请的 {request.medicine_name} 未通过医生安全审核"
        if payload.note:
            content += f"。原因：{payload.note}"
    db.add(
        Message(
            user_id=request.borrower_id,
            type="system",
            sender_id=current.id,
            request_id=request.id,
            status=new_status,
            title=title,
            content=content,
        )
    )
    db.commit()
    db.refresh(request)
    return request


@router.get("/medicines", response_model=List[ReviewMedicineOut])
def list_review_medicines(
    status_filter: str = "pending",
    current: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """本小区居民共享药品合规审核队列。

    包含已上架的共享药品，以及居民放入中转格口、等待管理员核验的投放药品
    （投放后先由医生做用药安全评估）。
    """
    query = (
        db.query(Medicine)
        .join(User, Medicine.owner_id == User.id)
        .filter(
            Medicine.recycled.is_(False),
            User.community == current.community,
            or_(
                (Medicine.visibility == "public") & (Medicine.share_mode != "none"),
                Medicine.dropoffs.any(
                    LockerDropoff.status.in_(("pending_verify", "verified"))
                ),
            ),
        )
    )
    if status_filter != "all":
        query = query.filter(Medicine.compliance_status == status_filter)
    items = query.order_by(Medicine.created_at.desc()).all()
    return [
        ReviewMedicineOut(
            id=m.id,
            name=m.name,
            spec=m.spec,
            owner_id=m.owner_id,
            owner_name=m.owner.name if m.owner else "",
            building=m.owner.building if m.owner else "",
            symptoms=m.symptoms or [],
            quantity=m.quantity,
            unit=m.unit,
            expiry_date=m.expiry_date,
            share_scope=m.share_scope,
            compliance_status=m.compliance_status,
            compliance_note=m.compliance_note or "",
        )
        for m in items
    ]


@router.post("/medicines/{medicine_id}/compliance", response_model=ReviewMedicineOut)
def decide_compliance(
    medicine_id: int,
    payload: ComplianceDecisionIn,
    current: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if medicine is None:
        raise HTTPException(status_code=404, detail="药品不存在")
    if medicine.owner and medicine.owner.community != current.community:
        raise HTTPException(status_code=403, detail="只能审核本小区的共享药品")

    medicine.compliance_status = "ok" if payload.compliant else "rejected"
    medicine.compliance_note = payload.note
    if medicine.owner_id != current.id:
        if payload.compliant:
            title = "用药安全评估通过"
            content = (
                f"你投放到驿站中转格口的 {medicine.name} 已通过用药安全评估，"
                f"等待管理员核验实物后即可被邻居借用"
            )
        else:
            title = "用药安全评估未通过"
            content = f"你投放的 {medicine.name} 未通过用药安全评估"
            if payload.note:
                content += f"。原因：{payload.note}"
        db.add(
            Message(
                user_id=medicine.owner_id,
                type="system",
                sender_id=current.id,
                title=title,
                content=content,
            )
        )
    db.commit()
    db.refresh(medicine)
    return ReviewMedicineOut(
        id=medicine.id,
        name=medicine.name,
        spec=medicine.spec,
        owner_id=medicine.owner_id,
        owner_name=medicine.owner.name if medicine.owner else "",
        building=medicine.owner.building if medicine.owner else "",
        symptoms=medicine.symptoms or [],
        quantity=medicine.quantity,
        unit=medicine.unit,
        expiry_date=medicine.expiry_date,
        share_scope=medicine.share_scope,
        compliance_status=medicine.compliance_status,
        compliance_note=medicine.compliance_note or "",
    )
