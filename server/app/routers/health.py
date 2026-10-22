"""个人健康档案与用药记录。

- 居民维护过敏史、基础疾病等档案
- 居民把自己的档案授权给某位社区医生查看，可随时撤销
- 医生仅能查看「已授权」居民的档案与用药记录
- 用药记录聚合借药申请与在线问诊
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_doctor, require_resident
from ..models import (
    BorrowRequest,
    ConsultConversation,
    DoctorAccessGrant,
    HealthProfile,
    Message,
    User,
)
from ..schemas import (
    DoctorGrantIn,
    DoctorGrantOut,
    DoctorOptionOut,
    DoctorPatientOut,
    HealthArchiveOut,
    HealthProfileIn,
    HealthProfileOut,
    MedicationRecordOut,
)

router = APIRouter(prefix="/api/health", tags=["健康档案"])

BORROW_STATUS_LABEL = {
    "pending_owner": "待药主放入中转格口",
    "pending": "待医生审核",
    "pending_admin": "待管理员核验",
    "pending_payment": "待支付",
    "approved": "待取药",
    "completed": "已完成",
    "rejected": "未通过",
}


def _get_or_create_profile(db: Session, user_id: int) -> HealthProfile:
    profile = db.query(HealthProfile).filter(HealthProfile.user_id == user_id).first()
    if profile is None:
        profile = HealthProfile(
            user_id=user_id, allergies=[], chronic_diseases=[], blood_type="", note=""
        )
        db.add(profile)
        db.flush()
    return profile


def _collect_medications(db: Session, resident_id: int) -> List[MedicationRecordOut]:
    """聚合借药与问诊记录，按时间倒序返回。"""
    records: List[MedicationRecordOut] = []

    borrows = (
        db.query(BorrowRequest)
        .filter(BorrowRequest.borrower_id == resident_id)
        .order_by(BorrowRequest.created_at.desc())
        .all()
    )
    for b in borrows:
        records.append(
            MedicationRecordOut(
                id=f"borrow-{b.id}",
                kind="borrow",
                title=b.medicine_name,
                detail=f"借药 {b.quantity}{b.unit}"
                + (f" · 症状：{'、'.join(b.symptoms)}" if b.symptoms else ""),
                doctor_name=b.doctor.name if b.doctor else "",
                status=BORROW_STATUS_LABEL.get(b.status, b.status),
                created_at=b.created_at,
            )
        )

    conv = (
        db.query(ConsultConversation)
        .filter(ConsultConversation.resident_id == resident_id)
        .first()
    )
    if conv is not None and conv.messages:
        last = conv.messages[-1]
        records.append(
            MedicationRecordOut(
                id=f"consult-{conv.id}",
                kind="consult",
                title="在线问诊",
                detail=last.content[:60],
                doctor_name=conv.doctor_name,
                status="已问诊",
                created_at=conv.updated_at,
            )
        )

    records.sort(key=lambda r: r.created_at, reverse=True)
    return records


def _profile_out(profile: Optional[HealthProfile], user_id: int) -> HealthProfileOut:
    if profile is None:
        return HealthProfileOut(
            id=0,
            user_id=user_id,
            allergies=[],
            chronic_diseases=[],
            blood_type="",
            note="",
            updated_at=None,
        )
    return HealthProfileOut.model_validate(profile)


# ---------------------------------------------------------------- 居民端
@router.get("/profile", response_model=HealthProfileOut)
def get_my_profile(
    db: Session = Depends(get_db), current: User = Depends(require_resident)
):
    profile = db.query(HealthProfile).filter(HealthProfile.user_id == current.id).first()
    return _profile_out(profile, current.id)


@router.put("/profile", response_model=HealthProfileOut)
def update_my_profile(
    payload: HealthProfileIn,
    db: Session = Depends(get_db),
    current: User = Depends(require_resident),
):
    profile = _get_or_create_profile(db, current.id)
    profile.allergies = [a.strip() for a in payload.allergies if a and a.strip()]
    profile.chronic_diseases = [
        c.strip() for c in payload.chronic_diseases if c and c.strip()
    ]
    profile.blood_type = payload.blood_type.strip()
    profile.birth_year = payload.birth_year
    profile.note = payload.note.strip()
    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/doctors", response_model=List[DoctorOptionOut])
def list_community_doctors(
    db: Session = Depends(get_db), current: User = Depends(require_resident)
):
    """可授权的医生：优先同小区，其次全部社区医生。"""
    doctors = db.query(User).filter(User.role == "doctor").all()
    same = [d for d in doctors if d.community and d.community == current.community]
    return [
        DoctorOptionOut(id=d.id, name=d.name, community=d.community or "")
        for d in (same or doctors)
    ]


@router.get("/authorizations", response_model=List[DoctorGrantOut])
def list_my_grants(
    db: Session = Depends(get_db), current: User = Depends(require_resident)
):
    grants = (
        db.query(DoctorAccessGrant)
        .filter(DoctorAccessGrant.resident_id == current.id)
        .order_by(DoctorAccessGrant.created_at.desc())
        .all()
    )
    return grants


@router.post("/authorizations", response_model=DoctorGrantOut, status_code=201)
def grant_doctor_access(
    payload: DoctorGrantIn,
    db: Session = Depends(get_db),
    current: User = Depends(require_resident),
):
    doctor = (
        db.query(User)
        .filter(User.id == payload.doctor_id, User.role == "doctor")
        .first()
    )
    if doctor is None:
        raise HTTPException(status_code=404, detail="医生不存在")

    existing = (
        db.query(DoctorAccessGrant)
        .filter(
            DoctorAccessGrant.resident_id == current.id,
            DoctorAccessGrant.doctor_id == doctor.id,
            DoctorAccessGrant.status == "active",
        )
        .first()
    )
    if existing is not None:
        return existing

    grant = DoctorAccessGrant(
        resident_id=current.id,
        doctor_id=doctor.id,
        status="active",
        scope_note=payload.scope_note or "查看健康档案与用药记录",
    )
    db.add(grant)
    db.flush()
    db.add(
        Message(
            user_id=doctor.id,
            type="system",
            sender_id=current.id,
            title="新的健康档案授权",
            content=f"{current.name}（{current.building}）授权你查看其健康档案与用药记录",
        )
    )
    db.commit()
    db.refresh(grant)
    return grant


@router.delete("/authorizations/{grant_id}", response_model=DoctorGrantOut)
def revoke_doctor_access(
    grant_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_resident),
):
    grant = db.query(DoctorAccessGrant).filter(DoctorAccessGrant.id == grant_id).first()
    if grant is None or grant.resident_id != current.id:
        raise HTTPException(status_code=404, detail="授权记录不存在")
    grant.status = "revoked"
    grant.revoked_at = datetime.utcnow()
    db.commit()
    db.refresh(grant)
    return grant


@router.get("/medications", response_model=List[MedicationRecordOut])
def list_my_medications(
    db: Session = Depends(get_db), current: User = Depends(require_resident)
):
    return _collect_medications(db, current.id)


# ---------------------------------------------------------------- 医生端
def _require_active_grant(db: Session, doctor_id: int, resident_id: int) -> DoctorAccessGrant:
    grant = (
        db.query(DoctorAccessGrant)
        .filter(
            DoctorAccessGrant.resident_id == resident_id,
            DoctorAccessGrant.doctor_id == doctor_id,
            DoctorAccessGrant.status == "active",
        )
        .first()
    )
    if grant is None:
        raise HTTPException(status_code=403, detail="居民未授权你查看其健康档案")
    return grant


@router.get("/patients", response_model=List[DoctorPatientOut])
def list_authorized_patients(
    db: Session = Depends(get_db), current: User = Depends(require_doctor)
):
    grants = (
        db.query(DoctorAccessGrant)
        .filter(
            DoctorAccessGrant.doctor_id == current.id,
            DoctorAccessGrant.status == "active",
        )
        .order_by(DoctorAccessGrant.created_at.desc())
        .all()
    )
    result: List[DoctorPatientOut] = []
    for g in grants:
        profile = (
            db.query(HealthProfile)
            .filter(HealthProfile.user_id == g.resident_id)
            .first()
        )
        result.append(
            DoctorPatientOut(
                resident_id=g.resident_id,
                name=g.resident_name,
                building=g.resident_building,
                grant_id=g.id,
                granted_at=g.created_at,
                has_profile=profile is not None,
                allergies=list(profile.allergies or []) if profile else [],
            )
        )
    return result


@router.get("/patients/{resident_id}", response_model=HealthArchiveOut)
def get_patient_archive(
    resident_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_doctor),
):
    _require_active_grant(db, current.id, resident_id)
    resident = db.query(User).filter(User.id == resident_id).first()
    if resident is None:
        raise HTTPException(status_code=404, detail="居民不存在")
    profile = (
        db.query(HealthProfile).filter(HealthProfile.user_id == resident_id).first()
    )
    return HealthArchiveOut(
        user_id=resident.id,
        name=resident.name,
        building=resident.building or "",
        profile=profile,
        medications=_collect_medications(db, resident_id),
    )
