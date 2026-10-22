"""用药安全：不良反应上报与处理、信用分与黑名单。"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin, require_doctor, require_resident
from ..models import (
    AdverseReactionReport,
    BorrowRequest,
    CreditProfile,
    Message,
    User,
)
from ..rewards import add_points, adjust_credit, get_credit_profile
from ..schemas import (
    AdminCreditActionIn,
    AdminCreditOut,
    AdverseHandleIn,
    AdverseReportIn,
    AdverseReportOut,
    CreditLogOut,
    CreditOut,
)

router = APIRouter(prefix="/api", tags=["用药安全"])


def _credit_level(score: int) -> str:
    if score >= 90:
        return "优秀"
    if score >= 75:
        return "良好"
    if score >= 60:
        return "一般"
    return "受限"


# ---------------------------------------------------------------- 上报
@router.post("/reports", response_model=AdverseReportOut, status_code=201)
def create_report(
    payload: AdverseReportIn,
    current: User = Depends(require_resident),
    db: Session = Depends(get_db),
):
    if not payload.symptoms.strip():
        raise HTTPException(status_code=400, detail="请填写不良反应表现")
    if payload.severity not in ("mild", "moderate", "severe"):
        raise HTTPException(status_code=400, detail="严重程度不合法")

    request = None
    if payload.request_id is not None:
        request = (
            db.query(BorrowRequest)
            .filter(BorrowRequest.id == payload.request_id)
            .first()
        )
        if request is None or request.borrower_id != current.id:
            raise HTTPException(status_code=404, detail="借药记录不存在")
        duplicated = (
            db.query(AdverseReactionReport)
            .filter(
                AdverseReactionReport.request_id == request.id,
                AdverseReactionReport.user_id == current.id,
                AdverseReactionReport.status == "pending",
            )
            .first()
        )
        if duplicated is not None:
            raise HTTPException(status_code=400, detail="该笔用药已有待处理的上报")

    report = AdverseReactionReport(
        user_id=current.id,
        request_id=request.id if request else None,
        medicine_id=request.medicine_id if request else None,
        medicine_name=payload.medicine_name.strip()
        or (request.medicine_name if request else ""),
        symptoms=payload.symptoms.strip(),
        severity=payload.severity,
        description=payload.description.strip(),
        status="pending",
    )
    db.add(report)
    db.flush()
    db.add(
        Message(
            user_id=current.id,
            type="system",
            title="上报已提交",
            content=f"你上报的 {report.medicine_name} 不良反应已提交，医生会在 24 小时内处理",
        )
    )
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports/mine", response_model=List[AdverseReportOut])
def my_reports(
    current: User = Depends(require_resident), db: Session = Depends(get_db)
):
    return (
        db.query(AdverseReactionReport)
        .filter(AdverseReactionReport.user_id == current.id)
        .order_by(AdverseReactionReport.created_at.desc())
        .all()
    )


@router.get("/reports", response_model=List[AdverseReportOut])
def list_reports(
    status_filter: str = "pending",
    current: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """医生处理上报（管理员亦可，见下方 admin 路由）。"""
    query = db.query(AdverseReactionReport)
    if status_filter != "all":
        query = query.filter(AdverseReactionReport.status == status_filter)
    return query.order_by(AdverseReactionReport.created_at.desc()).all()


@router.get("/reports/admin", response_model=List[AdverseReportOut])
def list_reports_admin(
    status_filter: str = "pending",
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = (
        db.query(AdverseReactionReport)
        .join(User, AdverseReactionReport.user_id == User.id)
        .filter(User.community == current.community)
    )
    if status_filter != "all":
        query = query.filter(AdverseReactionReport.status == status_filter)
    return query.order_by(AdverseReactionReport.created_at.desc()).all()


@router.post("/reports/{report_id}/handle", response_model=AdverseReportOut)
def handle_report(
    report_id: int,
    payload: AdverseHandleIn,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current.role not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="仅医生或管理员可处理上报")
    report = (
        db.query(AdverseReactionReport)
        .filter(AdverseReactionReport.id == report_id)
        .first()
    )
    if report is None:
        raise HTTPException(status_code=404, detail="上报记录不存在")
    if current.role != "admin" and report.user and report.user.community != current.community:
        raise HTTPException(status_code=403, detail="只能处理本小区的上报")
    if report.status != "pending":
        raise HTTPException(status_code=400, detail="该上报已处理")

    report.handler_id = current.id
    report.handle_note = payload.note.strip()
    report.handled_at = datetime.utcnow()

    if payload.accepted:
        report.status = "resolved"
        add_points(db, report.user_id, 5, "不良反应上报被采纳")
        title = "上报已受理"
        content = (
            f"你上报的 {report.medicine_name} 不良反应已被采纳，感谢反馈，已奖励 5 积分"
        )
    else:
        report.status = "rejected"
        title = "上报未通过"
        content = f"你上报的 {report.medicine_name} 不良反应未通过审核"
    if payload.note:
        content += f"。医生说明：{payload.note}"

    db.add(
        Message(
            user_id=report.user_id,
            type="system",
            sender_id=current.id,
            title=title,
            content=content,
        )
    )
    db.commit()
    db.refresh(report)
    return report


# ---------------------------------------------------------------- 信用
@router.get("/credit", response_model=CreditOut)
def my_credit(
    current: User = Depends(require_resident), db: Session = Depends(get_db)
):
    profile = get_credit_profile(db, current.id)
    db.commit()
    return CreditOut(
        score=profile.score,
        status=profile.status,
        reason=profile.reason or "",
        level=_credit_level(profile.score),
    )


@router.get("/credit/logs", response_model=List[CreditLogOut])
def my_credit_logs(
    current: User = Depends(require_resident), db: Session = Depends(get_db)
):
    from ..models import CreditLog

    return (
        db.query(CreditLog)
        .filter(CreditLog.user_id == current.id)
        .order_by(CreditLog.created_at.desc())
        .all()
    )


@router.get("/admin/credit", response_model=List[AdminCreditOut])
def list_credit(
    current: User = Depends(require_admin), db: Session = Depends(get_db)
):
    users = (
        db.query(User)
        .filter(User.role == "user", User.community == current.community)
        .order_by(User.id)
        .all()
    )
    result: List[AdminCreditOut] = []
    for u in users:
        profile = (
            db.query(CreditProfile).filter(CreditProfile.user_id == u.id).first()
        )
        result.append(
            AdminCreditOut(
                user_id=u.id,
                name=u.name,
                building=u.building or "",
                phone=u.phone or "",
                score=profile.score if profile else 100,
                status=profile.status if profile else "normal",
                reason=profile.reason if profile else "",
            )
        )
    return result


@router.post("/admin/credit/{user_id}", response_model=AdminCreditOut)
def update_credit(
    user_id: int,
    payload: AdminCreditActionIn,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role == "user").first()
    if user is None or user.community != current.community:
        raise HTTPException(status_code=404, detail="居民不存在")
    profile = get_credit_profile(db, user.id)

    if payload.action == "blacklist":
        profile.status = "blacklisted"
        profile.reason = payload.reason.strip() or "管理员列入黑名单"
        profile.score = max(0, profile.score - 20)
        adjust_credit(db, user.id, 0, f"管理员列入黑名单：{profile.reason}")
        title = "已被限制借药"
        content = f"你已被列入黑名单，暂不能借药或共享药品。原因：{profile.reason}"
    elif payload.action == "unblacklist":
        profile.status = "normal"
        profile.reason = ""
        profile.score = max(profile.score, 60)
        adjust_credit(db, user.id, 0, "管理员解除黑名单")
        title = "借药权限已恢复"
        content = "你的黑名单限制已解除，可以正常借药与共享药品"
    else:
        raise HTTPException(status_code=400, detail="操作类型不合法")

    db.add(
        Message(
            user_id=user.id, type="system", sender_id=current.id, title=title, content=content
        )
    )
    db.commit()
    db.refresh(profile)
    return AdminCreditOut(
        user_id=user.id,
        name=user.name,
        building=user.building or "",
        phone=user.phone or "",
        score=profile.score,
        status=profile.status,
        reason=profile.reason or "",
    )
