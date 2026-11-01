"""从数据库真实数据抽取信用模型的 8 维行为特征。

每个维度都对应系统里真实产生的记录，不需要手工填写：
    借药履约率        <- borrow_requests（borrower_id）
    被驳回次数        <- borrow_requests.status == "rejected"
    共享未通过核验    <- medicines.compliance_status == "rejected"
    共享处方药次数    <- medicines(is_otc == False 且已共享)
    有效不良反应上报  <- adverse_reaction_reports.status == "resolved"
    近30天借药次数    <- borrow_requests.created_at
    经核验共享次数    <- medicines.compliance_status == "ok"
    管理员扣分次数    <- credit_logs.delta < 0
"""

from datetime import datetime, timedelta
from typing import List

from sqlalchemy.orm import Session

from .models import AdverseReactionReport, BorrowRequest, CreditLog, Medicine


def extract_features(db: Session, user_id: int) -> List[float]:
    """按 FEATURE_NAMES 的顺序返回 8 维特征。"""
    borrows = db.query(BorrowRequest).filter(BorrowRequest.borrower_id == user_id)
    completed = borrows.filter(BorrowRequest.status == "completed").count()
    rejected = borrows.filter(BorrowRequest.status == "rejected").count()

    # 没有历史记录时视为履约正常，避免新用户一上来就被判高风险
    finished = completed + rejected
    fulfillment = completed / finished if finished else 1.0

    since = datetime.utcnow() - timedelta(days=30)
    recent_borrows = borrows.filter(BorrowRequest.created_at >= since).count()

    shared = db.query(Medicine).filter(
        Medicine.owner_id == user_id, Medicine.visibility != "private"
    )
    unverified_shares = shared.filter(Medicine.compliance_status == "rejected").count()
    verified_shares = shared.filter(Medicine.compliance_status == "ok").count()
    rx_shares = shared.filter(Medicine.is_otc == False).count()  # noqa: E712

    valid_reports = (
        db.query(AdverseReactionReport)
        .filter(
            AdverseReactionReport.user_id == user_id,
            AdverseReactionReport.status == "resolved",
        )
        .count()
    )

    penalties = (
        db.query(CreditLog)
        .filter(CreditLog.user_id == user_id, CreditLog.delta < 0)
        .count()
    )

    return [
        round(fulfillment, 3),
        float(rejected),
        float(unverified_shares),
        float(rx_shares),
        float(valid_reports),
        float(recent_borrows),
        float(verified_shares),
        float(penalties),
    ]
