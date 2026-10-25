"""管理员端：驿站运营管理。

- 工作台数据概览；
- 借药出货：医生审核通过后，管理员从实体柜出货 / 发放取药码 / 确认取药；
- 药品盘点与过期药品回收登记。
"""

import random
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin
from ..models import BorrowRequest, LockerDropoff, Medicine, Message, PaymentOrder, User
from ..schemas import (
    AdminMedicineOut,
    AdminStatsOut,
    AdminUserCreate,
    AdminVerifyIn,
    BorrowRequestOut,
    CabinetMedicineIn,
    LockerDropoffOut,
    RestockIn,
    UserOut,
)
from ..security import hash_password
from ..utils import calc_expiry_status
from ..rewards import add_points

router = APIRouter(prefix="/api/admin", tags=["管理员"])

# 柜内共享药品库存预警阈值
LOW_STOCK_THRESHOLD = 3


def _community_medicines(db: Session, community: str):
    return (
        db.query(Medicine)
        .join(User, Medicine.owner_id == User.id)
        .filter(User.community == community, Medicine.recycled.is_(False))
    )


def _sync_request_message(db: Session, request_id: int, new_status: str) -> None:
    db.query(Message).filter(
        Message.request_id == request_id, Message.type == "borrow_request"
    ).update({"status": new_status})


def _medicine_out(m: Medicine) -> AdminMedicineOut:
    return AdminMedicineOut(
        id=m.id,
        name=m.name,
        spec=m.spec,
        owner_id=m.owner_id,
        owner_name=m.owner.name if m.owner else "",
        building=m.owner.building if m.owner else "",
        quantity=m.quantity,
        unit=m.unit,
        expiry_date=m.expiry_date,
        status=calc_expiry_status(m.expiry_date),
        visibility=m.visibility,
        share_mode=m.share_mode,
        recycled=m.recycled,
        low_stock=m.quantity <= LOW_STOCK_THRESHOLD,
        source="cabinet" if m.is_cabinet else "shared",
        is_otc=m.is_otc,
        unit_price=m.unit_price,
        dropoff_status=m.dropoff_status,
    )


@router.get("/stats", response_model=AdminStatsOut)
def stats(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    borrows = (
        db.query(BorrowRequest)
        .join(User, BorrowRequest.owner_id == User.id)
        .filter(User.community == current.community)
    )
    pending_review = borrows.filter(BorrowRequest.status == "pending").count()
    awaiting_dispatch = borrows.filter(
        BorrowRequest.status.in_(("pending_admin", "pending_payment", "approved"))
    ).count()

    meds = _community_medicines(db, current.community).all()
    shared_count = sum(1 for m in meds if m.visibility == "public" and m.share_mode != "none")
    cabinet_count = sum(
        1 for m in meds if m.is_cabinet and calc_expiry_status(m.expiry_date) != "expired"
    )
    expired_count = sum(1 for m in meds if calc_expiry_status(m.expiry_date) == "expired")
    resident_count = (
        db.query(User)
        .filter(User.community == current.community, User.role == "user")
        .count()
    )
    return AdminStatsOut(
        pending_review=pending_review,
        awaiting_dispatch=awaiting_dispatch,
        shared_count=shared_count,
        cabinet_count=cabinet_count,
        expired_count=expired_count,
        resident_count=resident_count,
    )


@router.get("/users", response_model=List[UserOut])
def list_users(
    role: str = "staff",
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """本小区账号列表。role: staff 医生+管理员 / doctor / admin / user。"""
    query = db.query(User).filter(User.community == current.community)
    if role == "staff":
        query = query.filter(User.role.in_(("doctor", "admin")))
    elif role in ("doctor", "admin", "user"):
        query = query.filter(User.role == role)
    return query.order_by(User.created_at.desc()).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_staff_user(
    payload: AdminUserCreate,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """后台分配医生 / 社区管理员账号（居民不可通过此接口创建）。"""
    if payload.role not in ("doctor", "admin"):
        raise HTTPException(status_code=400, detail="仅支持分配医生或管理员账号")
    username = payload.username.strip()
    phone = payload.phone.strip()
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="该用户名已被占用")
    if phone and db.query(User).filter(User.phone == phone).first():
        raise HTTPException(status_code=409, detail="该手机号已被使用")

    user = User(
        username=username,
        password_hash=hash_password(payload.password),
        name=payload.name.strip(),
        role=payload.role,
        phone=phone,
        community=payload.community.strip() or current.community,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/borrows", response_model=List[BorrowRequestOut])
def list_admin_borrows(
    status_filter: str = "approved",
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """待处理借药单。status: approved 待出货 / completed 已完成 / rejected 已驳回 / all。"""
    query = (
        db.query(BorrowRequest)
        .join(User, BorrowRequest.owner_id == User.id)
        .filter(User.community == current.community)
    )
    if status_filter != "all":
        query = query.filter(BorrowRequest.status == status_filter)
    return query.order_by(BorrowRequest.created_at.desc()).all()


@router.post("/borrows/{request_id}/verify", response_model=BorrowRequestOut)
def verify_borrow(
    request_id: int,
    payload: AdminVerifyIn,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员核验借药申请。

    不通过直接驳回；通过后若药品不在柜内，通知药主放入中转格口；
    已核验投放或驿站自营药品直接进入支付 / 待出货。
    """
    request = db.query(BorrowRequest).filter(BorrowRequest.id == request_id).first()
    if request is None:
        raise HTTPException(status_code=404, detail="借药请求不存在")
    if request.owner and request.owner.community != current.community:
        raise HTTPException(status_code=403, detail="只能处理本小区的借药请求")
    if request.status != "pending_admin":
        raise HTTPException(status_code=400, detail="该请求当前无需核验")

    if not payload.compliant:
        request.status = "rejected"
        _sync_request_message(db, request.id, "rejected")
        content = f"你申请的 {request.medicine_name} 未通过驿站核验"
        if payload.note:
            content += f"。原因：{payload.note}"
        db.add(
            Message(
                user_id=request.borrower_id,
                type="system",
                sender_id=current.id,
                request_id=request.id,
                status="rejected",
                title="核验未通过",
                content=content,
            )
        )
        db.commit()
        db.refresh(request)
        return request

    if not request.in_locker:
        request.status = "pending_owner"
        _sync_request_message(db, request.id, "pending_owner")
        db.add(
            Message(
                user_id=request.borrower_id,
                type="system",
                sender_id=current.id,
                request_id=request.id,
                status="pending_owner",
                title="管理员核验通过，等待药主放入中转格口",
                content=(
                    f"你申请的 {request.medicine_name} × {request.quantity}{request.unit} "
                    f"已通过驿站核验，等待药主将药品放入中转格口"
                ),
            )
        )
        db.add(
            Message(
                user_id=request.owner_id,
                type="borrow_request",
                sender_id=current.id,
                request_id=request.id,
                status="pending_owner",
                title="管理员已核验通过，请放入中转格口",
                content=(
                    f"{request.borrower.name if request.borrower else '邻居'} 申请借用你的 "
                    f"{request.medicine_name} × {request.quantity}{request.unit}，"
                    f"医生与管理员均已通过，请将药品放入驿站中转格口，"
                    f"并在交易记录中确认投放"
                ),
            )
        )
        db.commit()
        db.refresh(request)
        return request

    amount = request.amount
    if amount > 0:
        order = (
            db.query(PaymentOrder)
            .filter(PaymentOrder.request_id == request.id)
            .first()
        )
        if order is None:
            order = PaymentOrder(
                request_id=request.id,
                borrower_id=request.borrower_id,
                amount=amount,
                status="pending",
            )
            db.add(order)
        request.status = "pending_payment"
        title = "待支付借药订单"
        content = (
            f"{request.medicine_name} × {request.quantity}{request.unit} 已通过实物核验，"
            f"应付 ¥{amount:.2f}，请在交易记录中完成支付"
        )
    else:
        request.status = "approved"
        title = "实物核验通过，等待驿站出货"
        content = (
            f"你申请的 {request.medicine_name} × {request.quantity}{request.unit} "
            f"已通过驿站实物核验，管理员将尽快发放取药码"
        )
    _sync_request_message(db, request.id, request.status)
    db.add(
        Message(
            user_id=request.borrower_id,
            type="system",
            sender_id=current.id,
            request_id=request.id,
            status=request.status,
            title=title,
            content=content,
        )
    )
    db.commit()
    db.refresh(request)
    return request


@router.get("/dropoffs", response_model=List[LockerDropoffOut])
def list_dropoffs(
    status_filter: str = "pending_verify",
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """本小区居民自助投放登记。status: pending_verify / verified / rejected / all。"""
    query = (
        db.query(LockerDropoff)
        .join(User, LockerDropoff.owner_id == User.id)
        .filter(User.community == current.community)
    )
    if status_filter != "all":
        query = query.filter(LockerDropoff.status == status_filter)
    return query.order_by(LockerDropoff.created_at.desc()).all()


@router.post("/dropoffs/{dropoff_id}/verify", response_model=LockerDropoffOut)
def verify_dropoff(
    dropoff_id: int,
    payload: AdminVerifyIn,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员核验居民放入中转格口的实物药品。

    用药安全评估（医生）通过后才可核验；通过后药品可被邻居借用。
    """
    dropoff = db.query(LockerDropoff).filter(LockerDropoff.id == dropoff_id).first()
    if dropoff is None:
        raise HTTPException(status_code=404, detail="投放登记不存在")
    if dropoff.owner and dropoff.owner.community != current.community:
        raise HTTPException(status_code=403, detail="只能处理本小区的投放登记")
    if dropoff.status != "pending_verify":
        raise HTTPException(status_code=400, detail="该投放登记已处理")

    dropoff.admin_id = current.id
    dropoff.admin_note = payload.note
    dropoff.verified_at = datetime.utcnow()
    medicine = dropoff.medicine

    if not payload.compliant:
        dropoff.status = "rejected"
        content = f"你投放的 {dropoff.medicine_name} 未通过驿站实物核验"
        if payload.note:
            content += f"。原因：{payload.note}"
        title = "投放核验未通过"
    else:
        if medicine is not None and medicine.compliance_status != "ok":
            raise HTTPException(
                status_code=400, detail="请等待医生完成用药安全评估后再核验实物"
            )
        dropoff.status = "verified"
        if medicine is not None:
            medicine.visibility = "public"
            medicine.share_mode = "free"
            medicine.share_scope = "community"
            medicine.is_cabinet = False
            medicine.recycled = False
            medicine.quantity = dropoff.quantity
        title = "投放核验通过"
        content = (
            f"你投放的 {dropoff.medicine_name} × {dropoff.quantity}{dropoff.unit} "
            f"已通过驿站实物核验，现在可以被邻居借用了，已奖励 20 积分"
        )
        add_points(db, dropoff.owner_id, 20, "共享闲置药通过核验")
    db.add(
        Message(
            user_id=dropoff.owner_id,
            type="system",
            sender_id=current.id,
            title=title,
            content=content,
        )
    )
    db.commit()
    db.refresh(dropoff)
    return dropoff


@router.post("/borrows/{request_id}/dispatch", response_model=BorrowRequestOut)
def dispatch_borrow(
    request_id: int,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """审核通过的借药单出库，发放 6 位取药码。"""
    request = db.query(BorrowRequest).filter(BorrowRequest.id == request_id).first()
    if request is None:
        raise HTTPException(status_code=404, detail="借药请求不存在")
    if request.owner and request.owner.community != current.community:
        raise HTTPException(status_code=403, detail="只能处理本小区的借药请求")
    if request.status == "pending_admin":
        raise HTTPException(status_code=400, detail="请先完成实物核验再出货")
    if request.status == "pending_payment":
        raise HTTPException(status_code=400, detail="居民尚未完成支付，不能出货")
    if request.status != "approved":
        raise HTTPException(status_code=400, detail="仅医生审核通过的请求可出货")
    if request.dispense_mode == "vending":
        raise HTTPException(status_code=400, detail="透明售货药品无需取药码，请直接确认出货掉落")

    if not request.pickup_code:
        request.pickup_code = f"{random.randint(0, 999999):06d}"
        db.add(
            Message(
                user_id=request.borrower_id,
                type="system",
                sender_id=current.id,
                request_id=request.id,
                status="approved",
                title="取药码已发放",
                content=(
                    f"你申请的 {request.medicine_name} × {request.quantity}{request.unit} "
                    f"已在驿站备好，取药码：{request.pickup_code}，请凭码到驿站取药"
                ),
            )
        )
    db.commit()
    db.refresh(request)
    return request


@router.post("/borrows/{request_id}/complete", response_model=BorrowRequestOut)
def complete_borrow(
    request_id: int,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """居民凭码取药后确认完成，扣减库存。"""
    request = db.query(BorrowRequest).filter(BorrowRequest.id == request_id).first()
    if request is None:
        raise HTTPException(status_code=404, detail="借药请求不存在")
    if request.owner and request.owner.community != current.community:
        raise HTTPException(status_code=403, detail="只能处理本小区的借药请求")
    if request.status != "approved":
        raise HTTPException(status_code=400, detail="仅已出货的请求可确认完成")

    request.status = "completed"
    add_points(db, request.borrower_id, 5, "完成一次借药")
    medicine = request.medicine
    if medicine is not None and medicine.quantity >= request.quantity:
        medicine.quantity -= request.quantity

    if request.dispense_mode == "vending":
        # 透明售货：审核后商品直接掉落，无需取药码，仅通知居民领取
        db.add(
            Message(
                user_id=request.borrower_id,
                type="system",
                sender_id=current.id,
                request_id=request.id,
                status="completed",
                title="药品已出货",
                content=(
                    f"你申请的 {request.medicine_name} × {request.quantity}{request.unit} "
                    f"已通过医生与驿站审核，已从透明售货口掉落，请及时领取"
                ),
            )
        )
    else:
        db.add(
            Message(
                user_id=request.borrower_id,
                type="system",
                sender_id=current.id,
                request_id=request.id,
                status="completed",
                title="取药完成",
                content=f"{request.medicine_name} × {request.quantity}{request.unit} 已凭取药码完成领取",
            )
        )
        db.add(
            Message(
                user_id=request.owner_id,
                type="system",
                request_id=request.id,
                status="completed",
                title="共享药品已完成交接",
                content=f"你共享的 {request.medicine_name} × {request.quantity}{request.unit} 已由驿站完成交接",
            )
        )
    db.commit()
    db.refresh(request)
    return request


@router.get("/medicines", response_model=List[AdminMedicineOut])
def list_admin_medicines(
    view: str = "inventory",
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """驿站药品盘点。view: inventory 全部 / cabinet 柜内共享库存 / expired 待回收过期药。"""
    items = _community_medicines(db, current.community).order_by(
        Medicine.created_at.desc()
    ).all()
    result = [_medicine_out(m) for m in items]
    if view == "expired":
        result = [m for m in result if m.status == "expired"]
    elif view == "cabinet":
        # 柜内药品：驿站自营新药 + 居民已核验投放的药品（不含过期）
        result = [
            m
            for m in result
            if (m.source == "cabinet" or m.dropoff_status == "verified")
            and m.status != "expired"
        ]
        result.sort(key=lambda x: x.quantity)
    return result


@router.post("/cabinet", response_model=AdminMedicineOut, status_code=201)
def create_cabinet_medicine(
    payload: CabinetMedicineIn,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员新增驿站自营全新药品并入库到实体柜。"""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="药品名称不能为空")
    if payload.quantity < 0:
        raise HTTPException(status_code=400, detail="数量不能为负数")
    if payload.unit_price is not None and payload.unit_price < 0:
        raise HTTPException(status_code=400, detail="单价不能为负数")
    unit_price = payload.unit_price or None
    medicine = Medicine(
        owner_id=current.id,
        name=name,
        spec=payload.spec.strip(),
        quantity=payload.quantity,
        unit=payload.unit.strip() or "粒",
        expiry_date=payload.expiry_date.strip(),
        visibility="public",
        share_mode="priced" if unit_price else "free",
        share_scope="community",
        unit_price=unit_price,
        compliance_status="ok",
        is_cabinet=True,
    )
    db.add(medicine)
    db.commit()
    db.refresh(medicine)
    return _medicine_out(medicine)


@router.post("/medicines/{medicine_id}/restock", response_model=AdminMedicineOut)
def restock_medicine(
    medicine_id: int,
    payload: RestockIn,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员为实体柜内的共享药品补货。"""
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="补货数量需大于 0")
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if medicine is None:
        raise HTTPException(status_code=404, detail="药品不存在")
    if medicine.owner and medicine.owner.community != current.community:
        raise HTTPException(status_code=403, detail="只能处理本小区的药品")

    medicine.quantity += payload.quantity
    if medicine.owner_id != current.id:
        db.add(
            Message(
                user_id=medicine.owner_id,
                type="system",
                sender_id=current.id,
                title="共享药品已补货",
                content=(
                    f"驿站已为你的共享药品 {medicine.name} 补货 {payload.quantity}{medicine.unit}，"
                    f"当前柜内库存 {medicine.quantity}{medicine.unit}"
                ),
            )
        )
    db.commit()
    db.refresh(medicine)
    return _medicine_out(medicine)


@router.post("/medicines/{medicine_id}/recycle", response_model=AdminMedicineOut)
def recycle_medicine(
    medicine_id: int,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """将过期药品登记收入回收区。"""
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if medicine is None:
        raise HTTPException(status_code=404, detail="药品不存在")
    if medicine.owner and medicine.owner.community != current.community:
        raise HTTPException(status_code=403, detail="只能处理本小区的药品")

    medicine.recycled = True
    db.commit()
    db.refresh(medicine)
    return _medicine_out(medicine)
