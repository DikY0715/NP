"""积分与信用的统一入口，供借药、投放、上报等流程调用。"""

from typing import List, Tuple

from sqlalchemy.orm import Session

from .models import CreditLog, CreditProfile, Gift, PointAccount, PointLog

# 积分规则（展示用 + 各处发放依据）
POINT_RULES: List[Tuple[str, int]] = [
    ("完成一次借药", 5),
    ("共享闲置药通过核验", 20),
    ("不良反应上报被采纳", 5),
]

# 触发自动限制的信用分阈值
BLACKLIST_THRESHOLD = 60


def get_point_account(db: Session, user_id: int) -> PointAccount:
    account = db.query(PointAccount).filter(PointAccount.user_id == user_id).first()
    if account is None:
        account = PointAccount(user_id=user_id, balance=0, total_earned=0)
        db.add(account)
        db.flush()
    return account


def add_points(db: Session, user_id: int, amount: int, reason: str) -> PointAccount:
    account = get_point_account(db, user_id)
    account.balance = max(0, (account.balance or 0) + amount)
    if amount > 0:
        account.total_earned = (account.total_earned or 0) + amount
    db.add(PointLog(user_id=user_id, amount=amount, reason=reason))
    db.flush()
    return account


def get_credit_profile(db: Session, user_id: int) -> CreditProfile:
    profile = (
        db.query(CreditProfile).filter(CreditProfile.user_id == user_id).first()
    )
    if profile is None:
        profile = CreditProfile(user_id=user_id, score=100, status="normal")
        db.add(profile)
        db.flush()
    return profile


def adjust_credit(
    db: Session, user_id: int, delta: int, reason: str
) -> CreditProfile:
    profile = get_credit_profile(db, user_id)
    profile.score = max(0, min(100, (profile.score or 100) + delta))
    db.add(CreditLog(user_id=user_id, delta=delta, reason=reason))
    # 分数跌破阈值自动进入黑名单，重新回到阈值以上且非管理员拉黑时自动解除
    if profile.score < BLACKLIST_THRESHOLD and profile.status == "normal":
        profile.status = "blacklisted"
        profile.reason = f"信用分低于 {BLACKLIST_THRESHOLD}：{reason}"
    elif (
        profile.score >= BLACKLIST_THRESHOLD
        and profile.status == "blacklisted"
        and profile.reason.startswith(f"信用分低于")
    ):
        profile.status = "normal"
        profile.reason = ""
    db.flush()
    return profile


def is_blacklisted(db: Session, user_id: int) -> bool:
    profile = get_credit_profile(db, user_id)
    return profile.status == "blacklisted"


def ensure_seed_gifts(db: Session) -> None:
    """首次访问时初始化可兑换的小礼品。"""
    if db.query(Gift).count() > 0:
        return
    seed = [
        Gift(name="医用外科口罩（10只）", description="一次性医用口罩，出门常备", points=10, stock=50),
        Gift(name="便携分药盒", description="一周七天分装，随身携带", points=30, stock=30),
        Gift(name="电子体温计", description="快速测温，家庭必备", points=80, stock=10),
        Gift(name="急救小药箱", description="含创可贴、碘伏棉签等基础用品", points=150, stock=5),
    ]
    db.add_all(seed)
    db.commit()
