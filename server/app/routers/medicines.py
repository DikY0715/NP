"""家庭药箱：药品增删改查、统计与症状查药。"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_resident
from ..models import Medicine, User
from ..schemas import MedicineCreate, MedicineOut, MedicineStats, MedicineUpdate
from ..utils import calc_expiry_status

router = APIRouter(prefix="/api/medicines", tags=["药品"])


def _get_owned(db: Session, owner_id: int, medicine_id: int) -> Medicine:
    medicine = (
        db.query(Medicine)
        .filter(Medicine.id == medicine_id, Medicine.owner_id == owner_id)
        .first()
    )
    if medicine is None:
        raise HTTPException(status_code=404, detail="药品不存在")
    return medicine


@router.get("", response_model=List[MedicineOut])
def list_medicines(
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = None,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Medicine).filter(Medicine.owner_id == current.id)
    if keyword:
        query = query.filter(Medicine.name.contains(keyword))
    items = query.order_by(Medicine.created_at.desc()).all()
    if status_filter:
        items = [m for m in items if calc_expiry_status(m.expiry_date) == status_filter]
    return items


@router.get("/stats", response_model=MedicineStats)
def medicine_stats(
    current: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    items = db.query(Medicine).filter(Medicine.owner_id == current.id).all()
    return MedicineStats(
        total=len(items),
        expiring=sum(
            1 for m in items if calc_expiry_status(m.expiry_date) == "expiring"
        ),
        expired=sum(1 for m in items if calc_expiry_status(m.expiry_date) == "expired"),
    )


@router.get("/search", response_model=List[MedicineOut])
def search_by_symptom(
    q: str = Query(..., min_length=1),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """按症状或名称查询我家药箱中匹配的药品。"""
    needle = q.strip().lower()
    items = db.query(Medicine).filter(Medicine.owner_id == current.id).all()
    matched = []
    for m in items:
        if needle in (m.name or "").lower():
            matched.append(m)
            continue
        symptoms = m.symptoms or []
        if any(needle in s.lower() or s.lower() in needle for s in symptoms):
            matched.append(m)
    # 有货、未过期的优先
    matched.sort(key=lambda m: (calc_expiry_status(m.expiry_date) == "expired", m.quantity <= 0))
    return matched


@router.post("", response_model=MedicineOut, status_code=status.HTTP_201_CREATED)
def create_medicine(
    payload: MedicineCreate,
    current: User = Depends(require_resident),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    # 合规：处方药不可赠与/转让，仅可存于家庭药箱
    if (
        data.get("visibility") == "public"
        and data.get("share_mode") != "none"
        and not data.get("is_otc", True)
    ):
        raise HTTPException(
            status_code=400,
            detail="处方药不可共享，仅可保存在家庭药箱中",
        )
    # 居民新发布的共享药需经医生合规审核
    if data.get("visibility") == "public" and data.get("share_mode") != "none":
        data["compliance_status"] = "pending"
    medicine = Medicine(owner_id=current.id, **data)
    db.add(medicine)
    db.commit()
    db.refresh(medicine)
    return medicine


@router.get("/{medicine_id}", response_model=MedicineOut)
def get_medicine(
    medicine_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_owned(db, current.id, medicine_id)


@router.patch("/{medicine_id}", response_model=MedicineOut)
def update_medicine(
    medicine_id: int,
    payload: MedicineUpdate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medicine = _get_owned(db, current.id, medicine_id)
    updates = payload.model_dump(exclude_unset=True)
    # 合规：处方药不可开放共享（按更新后的目标状态校验）
    target_visibility = updates.get("visibility", medicine.visibility)
    target_share_mode = updates.get("share_mode", medicine.share_mode)
    target_is_otc = updates.get("is_otc", medicine.is_otc)
    if (
        target_visibility == "public"
        and target_share_mode != "none"
        and not target_is_otc
    ):
        raise HTTPException(
            status_code=400,
            detail="处方药不可共享，仅可保存在家庭药箱中",
        )
    was_shared = medicine.visibility == "public" and medicine.share_mode != "none"
    for field, value in updates.items():
        setattr(medicine, field, value)
    # 由"不共享"变为开放共享时，重新进入医生合规审核
    is_shared = medicine.visibility == "public" and medicine.share_mode != "none"
    if is_shared and not was_shared:
        medicine.compliance_status = "pending"
        medicine.compliance_note = ""
    db.commit()
    db.refresh(medicine)
    return medicine


@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medicine(
    medicine_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medicine = _get_owned(db, current.id, medicine_id)
    db.delete(medicine)
    db.commit()
