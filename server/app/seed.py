"""初始化演示数据。

用法（在 server 目录下）：python -m app.seed
"""

from datetime import datetime, timedelta

from .database import Base, SessionLocal, engine
from .models import HelpPost, Medicine, User
from .security import hash_password


def _expiry(days: int) -> str:
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("数据库已有数据，跳过初始化（如需重置，请删除 server/yaolin.db 后重试）")
            return

        demo = User(
            username="demo",
            password_hash=hash_password("demo123"),
            name="张阿姨",
            phone="13800000001",
            building="3号楼",
            community="阳光小区",
        )
        lisi = User(
            username="lisi",
            password_hash=hash_password("lisi123"),
            name="李叔",
            phone="13800000002",
            building="5号楼",
            community="阳光小区",
        )
        wangwu = User(
            username="wangwu",
            password_hash=hash_password("wangwu123"),
            name="小王",
            phone="13800000003",
            building="3号楼",
            community="阳光小区",
        )
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            name="管理员",
            role="admin",
            phone="13800000000",
            building="",
            community="阳光小区",
        )
        doctor = User(
            username="doctor",
            password_hash=hash_password("doctor123"),
            name="陈医生",
            role="doctor",
            phone="13900000000",
            building="",
            community="阳光小区",
        )
        db.add_all([demo, lisi, wangwu, admin, doctor])
        db.commit()
        for u in (demo, lisi, wangwu, admin, doctor):
            db.refresh(u)

        db.add_all(
            [
                Medicine(
                    owner_id=demo.id,
                    name="布洛芬缓释胶囊",
                    spec="0.3g x 20粒",
                    symptoms=["退烧", "止痛"],
                    expiry_date=_expiry(200),
                    quantity=20,
                    unit="粒",
                    visibility="private",
                    share_mode="none",
                ),
                Medicine(
                    owner_id=demo.id,
                    name="蒙脱石散",
                    spec="3g x 6袋",
                    symptoms=["腹泻"],
                    expiry_date=_expiry(15),
                    quantity=6,
                    unit="袋",
                    visibility="public",
                    share_mode="free",
                    share_scope="community",
                ),
                Medicine(
                    owner_id=demo.id,
                    name="云南白药创可贴",
                    spec="70mm x 18mm x 30片",
                    symptoms=["外伤", "擦伤"],
                    expiry_date=_expiry(300),
                    quantity=30,
                    unit="片",
                    visibility="private",
                    share_mode="none",
                ),
                Medicine(
                    owner_id=demo.id,
                    name="复方感冒灵颗粒",
                    spec="10g x 9袋",
                    symptoms=["感冒", "发热"],
                    expiry_date=_expiry(-5),
                    quantity=4,
                    unit="袋",
                    visibility="private",
                    share_mode="none",
                ),
                Medicine(
                    owner_id=lisi.id,
                    name="对乙酰氨基酚片",
                    spec="0.5g x 12片",
                    symptoms=["退烧", "头痛"],
                    expiry_date=_expiry(180),
                    quantity=12,
                    unit="片",
                    visibility="public",
                    share_mode="free",
                    share_scope="community",
                ),
                Medicine(
                    owner_id=lisi.id,
                    name="藿香正气水",
                    spec="10ml x 10支",
                    symptoms=["中暑", "肠胃不适"],
                    expiry_date=_expiry(90),
                    quantity=8,
                    unit="支",
                    visibility="public",
                    share_mode="free",
                    share_scope="community",
                ),
                Medicine(
                    owner_id=wangwu.id,
                    name="蒙脱石散",
                    spec="3g x 10袋",
                    symptoms=["腹泻"],
                    expiry_date=_expiry(150),
                    quantity=10,
                    unit="袋",
                    visibility="public",
                    share_mode="free",
                    share_scope="building",
                ),
            ]
        )
        db.add_all(
            [
                HelpPost(
                    author_id=lisi.id,
                    content="孩子半夜发烧，家里的退烧药刚好用完了，急求邻居帮忙！",
                    symptoms=["发烧"],
                    needed_medicines=["布洛芬", "对乙酰氨基酚"],
                    scope="community",
                    urgency="urgent",
                ),
                HelpPost(
                    author_id=wangwu.id,
                    content="家里创可贴用完了，哪位邻居有多的可以借几片？",
                    symptoms=["外伤"],
                    needed_medicines=["创可贴"],
                    scope="building",
                    urgency="normal",
                ),
            ]
        )
        db.commit()
        print("演示数据初始化完成：")
        print("  demo   / demo123   张阿姨（3号楼）")
        print("  lisi   / lisi123   李叔（5号楼）")
        print("  wangwu / wangwu123 小王（3号楼）")
        print("  admin  / admin123  管理员")
        print("  doctor / doctor123 陈医生（在线医生）")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
