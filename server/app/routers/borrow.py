"""借药申请全流程。

居民发起 → 医生安全审核 → 管理员核验 → 药主放入中转格口（柜内药品跳过）
→ 有价药品生成支付订单 → 居民支付 → 管理员出货。
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_resident
from ..models import BorrowRequest, Medicine, Message, PaymentOrder, User
from ..schemas import BorrowRequestCreate, BorrowRequestOut
from ..rewards import is_blacklisted

router = APIRouter(prefix="/api/borrow", tags=["借药"])


@router.post("/requests", response_model=BorrowRequestOut, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: BorrowRequestCreate,
    current: User = Depends(require_resident),
    db: Session = Depends(get_db),
):
    """居民发起借药请求。

    申请一律先进入医生安全审核；医生通过后，若药品不在柜内才通知药主
    放入中转格口。
    """
    medicine = db.query(Medicine).filter(Medicine.id == payload.medicine_id).first()
    if medicine is None:
        raise HTTPException(status_code=404, detail="药品不存在")
    if is_blacklisted(db, current.id):
        raise HTTPException(
            status_code=403, detail="你已被列入黑名单，暂不能借药，请联系社区管理员"
        )
    if medicine.owner_id == current.id:
        raise HTTPException(status_code=400, detail="不能借用自己共享的药品")
    if medicine.visibility != "public" or medicine.share_mode == "none":
        raise HTTPException(status_code=400, detail="该药品未开放共享")
    if not medicine.is_otc:
        raise HTTPException(
            status_code=400, detail="处方药不可赠与或转让，请联系医生开具处方"
        )
    if medicine.compliance_status != "ok":
        raise HTTPException(status_code=400, detail="该药品尚未通过用药安全评估")
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="借用数量必须大于 0")
    if medicine.quantity < payload.quantity:
        raise HTTPException(status_code=400, detail="对方库存不足")

    request = BorrowRequest(
        medicine_id=medicine.id,
        borrower_id=current.id,
        owner_id=medicine.owner_id,
        medicine_name=medicine.name,
        quantity=payload.quantity,
        unit=medicine.unit,
        note=payload.note,
        status="pending",
    )
    db.add(request)
    db.flush()

    db.add(
        Message(
            user_id=medicine.owner_id,
            type="borrow_request",
            sender_id=current.id,
            request_id=request.id,
            status=request.status,
            title=f"{current.name} 申请借用你的药品",
            content=(
                f"{medicine.name} × {payload.quantity}{medicine.unit}，"
                f"申请已提交医生安全审核，审核通过后会通知你放入驿站中转格口"
            ),
        )
    )
    db.commit()
    db.refresh(request)
    return request


@router.post("/requests/{request_id}/dropoff", response_model=BorrowRequestOut)
def owner_dropoff(
    request_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """药主确认已把闲置药品放入中转格口（医生、管理员均已核验通过）。"""
    request = db.query(BorrowRequest).filter(BorrowRequest.id == request_id).first()
    if request is None:
        raise HTTPException(status_code=404, detail="借药请求不存在")
    if request.owner_id != current.id:
        raise HTTPException(status_code=403, detail="只有药主可以确认投放")
    if request.status != "pending_owner":
        raise HTTPException(status_code=400, detail="该请求当前无需药主投放")

    amount = request.amount
    if amount > 0:
        order = (
            db.query(PaymentOrder).filter(PaymentOrder.request_id == request.id).first()
        )
        if order is None:
            db.add(
                PaymentOrder(
                    request_id=request.id,
                    borrower_id=request.borrower_id,
                    amount=amount,
                    status="pending",
                )
            )
        request.status = "pending_payment"
        title = "药主已放入中转格口，待支付"
        content = (
            f"{request.medicine_name} × {request.quantity}{request.unit} "
            f"已由药主 {current.name} 放入中转格口，应付 ¥{amount:.2f}，"
            f"请在交易记录中完成支付"
        )
    else:
        request.status = "approved"
        title = "药主已放入中转格口，等待驿站出货"
        content = (
            f"{request.medicine_name} × {request.quantity}{request.unit} "
            f"已由药主 {current.name} 放入中转格口，管理员将尽快发放取药码"
        )
    db.query(Message).filter(
        Message.request_id == request.id, Message.type == "borrow_request"
    ).update({"status": request.status})
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


@router.post("/requests/{request_id}/pay", response_model=BorrowRequestOut)
def pay_request(
    request_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """居民支付借药订单（演示环境为模拟支付）。"""
    request = db.query(BorrowRequest).filter(BorrowRequest.id == request_id).first()
    if request is None:
        raise HTTPException(status_code=404, detail="借药请求不存在")
    if request.borrower_id != current.id:
        raise HTTPException(status_code=403, detail="只能支付自己的借药订单")
    if request.status != "pending_payment":
        raise HTTPException(status_code=400, detail="该订单当前无需支付")

    order = db.query(PaymentOrder).filter(PaymentOrder.request_id == request.id).first()
    if order is None:
        raise HTTPException(status_code=400, detail="支付订单不存在")
    if order.status == "paid":
        raise HTTPException(status_code=400, detail="该订单已支付")

    order.status = "paid"
    order.paid_at = datetime.utcnow()
    request.status = "approved"
    db.add(
        Message(
            user_id=request.borrower_id,
            type="system",
            request_id=request.id,
            status="approved",
            title="支付成功，等待驿站出货",
            content=(
                f"已支付 ¥{order.amount:.2f}，{request.medicine_name} × "
                f"{request.quantity}{request.unit} 将尽快由驿站出货"
            ),
        )
    )
    db.commit()
    db.refresh(request)
    return request


@router.get("/requests", response_model=List[BorrowRequestOut])
def list_requests(
    role: str = "all",
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """role: in=我借入的, out=我借出的, all=全部。"""
    query = db.query(BorrowRequest)
    if role == "in":
        query = query.filter(BorrowRequest.borrower_id == current.id)
    elif role == "out":
        query = query.filter(BorrowRequest.owner_id == current.id)
    else:
        query = query.filter(
            (BorrowRequest.borrower_id == current.id)
            | (BorrowRequest.owner_id == current.id)
        )
    return query.order_by(BorrowRequest.created_at.desc()).all()
