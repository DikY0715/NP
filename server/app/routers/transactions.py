"""交易记录（由借药请求派生：借入 / 借出）。"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import BorrowRequest, User
from ..schemas import TransactionOut

router = APIRouter(prefix="/api/transactions", tags=["交易记录"])


@router.get("", response_model=List[TransactionOut])
def list_transactions(
    current: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    requests = (
        db.query(BorrowRequest)
        .filter(
            (BorrowRequest.borrower_id == current.id)
            | (BorrowRequest.owner_id == current.id)
        )
        .order_by(BorrowRequest.created_at.desc())
        .all()
    )

    result: List[TransactionOut] = []
    for r in requests:
        borrowed_in = r.borrower_id == current.id
        counterparty = (
            r.owner.name if borrowed_in and r.owner else (r.borrower.name if r.borrower else "")
        )
        price = None
        if r.medicine is not None and r.medicine.unit_price:
            price = round(r.medicine.unit_price * r.quantity, 2)
        result.append(
            TransactionOut(
                id=r.id,
                type="borrow_in" if borrowed_in else "borrow_out",
                medicine_name=r.medicine_name
                or (r.medicine.name if r.medicine else ""),
                quantity=r.quantity,
                unit=r.unit,
                counterparty_name=counterparty or "",
                status=r.status,
                price=price,
                payment_status=r.payment_status,
                timestamp=r.created_at,
            )
        )
    return result
