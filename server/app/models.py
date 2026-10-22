"""SQLAlchemy 数据模型。"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    name = Column(String(50), nullable=False)
    role = Column(String(20), default="user")  # user / admin / doctor
    avatar = Column(String(500), default="")
    phone = Column(String(30), default="")
    building = Column(String(50), default="")
    community = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    medicines = relationship(
        "Medicine", back_populates="owner", cascade="all, delete-orphan"
    )


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    spec = Column(String(200), default="")
    symptoms = Column(JSON, default=list)
    expiry_date = Column(String(20), default="")
    price = Column(Float, default=0)
    image = Column(Text, default="")
    visibility = Column(String(20), default="private")  # public / private / emergency
    share_mode = Column(String(20), default="none")  # free / priced / none
    share_scope = Column(String(20), default="community")  # building / community
    unit_price = Column(Float, nullable=True)
    quantity = Column(Integer, default=0)
    unit = Column(String(20), default="粒")
    dosage = Column(Text, default="")
    images = Column(JSON, default=list)
    # 医生合规审核：pending 待审核 / ok 合规 / rejected 不合规
    compliance_status = Column(String(20), default="pending")
    compliance_note = Column(Text, default="")
    # 管理员是否已登记回收（过期药品回收区）
    recycled = Column(Boolean, default=False)
    # 是否为驿站自营（管理员新增入库）的公共药品
    is_cabinet = Column(Boolean, default=False)
    # 是否非处方药（OTC）。处方药不可赠与/转让，仅可自存
    is_otc = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="medicines")
    dropoffs = relationship(
        "LockerDropoff",
        back_populates="medicine",
        cascade="all, delete-orphan",
        order_by="LockerDropoff.id",
    )

    @property
    def dropoff_status(self) -> str:
        """最近一次投放登记状态：pending_verify / verified / rejected。"""
        return self.dropoffs[-1].status if self.dropoffs else ""


class HelpPost(Base):
    __tablename__ = "help_posts"

    id = Column(Integer, primary_key=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, default="")
    symptoms = Column(JSON, default=list)
    needed_medicines = Column(JSON, default=list)
    scope = Column(String(20), default="community")
    urgency = Column(String(20), default="normal")  # normal / urgent
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User")
    response_items = relationship(
        "HelpResponse", back_populates="post", cascade="all, delete-orphan"
    )

    @property
    def author_name(self) -> str:
        return self.author.name if self.author else ""

    @property
    def author_avatar(self) -> str:
        return self.author.avatar if self.author else ""

    @property
    def responses(self) -> int:
        return len(self.response_items)

    @property
    def timestamp(self):
        return self.created_at


class HelpResponse(Base):
    __tablename__ = "help_responses"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("help_posts.id"), nullable=False, index=True)
    responder_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("HelpPost", back_populates="response_items")
    responder = relationship("User")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(30), default="system")  # borrow_request / system / chat
    title = Column(String(200), default="")
    content = Column(Text, default="")
    read = Column(Boolean, default=False)
    status = Column(String(20), nullable=True)  # pending / accepted / rejected
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    request_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship("User", foreign_keys=[sender_id])

    @property
    def sender_name(self):
        return self.sender.name if self.sender else None

    @property
    def sender_avatar(self):
        return self.sender.avatar if self.sender else None

    @property
    def timestamp(self):
        return self.created_at


class BorrowRequest(Base):
    __tablename__ = "borrow_requests"

    id = Column(Integer, primary_key=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False, index=True)
    borrower_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    medicine_name = Column(String(100), default="")
    quantity = Column(Integer, default=1)
    unit = Column(String(20), default="粒")
    # pending_owner 待药主放入中转格口 / pending 待医生安全审核 /
    # pending_admin 待管理员实物核验 / pending_payment 待支付 /
    # approved 审核通过·待出货 / rejected 审核驳回 / completed 已取药完成
    status = Column(String(20), default="pending")
    note = Column(Text, default="")
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    doctor_note = Column(Text, default="")
    pickup_code = Column(String(10), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    medicine = relationship("Medicine")
    borrower = relationship("User", foreign_keys=[borrower_id])
    owner = relationship("User", foreign_keys=[owner_id])
    doctor = relationship("User", foreign_keys=[doctor_id])
    payment = relationship(
        "PaymentOrder",
        back_populates="request",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def amount(self) -> float:
        """应付金额：按单价 × 借用数量，免费药品为 0。"""
        if self.medicine and self.medicine.unit_price:
            return round(self.medicine.unit_price * self.quantity, 2)
        return 0.0

    @property
    def payment_status(self):
        return self.payment.status if self.payment else None

    @property
    def in_locker(self) -> bool:
        """药品是否已在驿站柜内（驿站自营或已有完成实物核验的投放）。"""
        if not self.medicine:
            return False
        if self.medicine.is_cabinet:
            return True
        return any(d.status == "verified" for d in self.medicine.dropoffs)

    @property
    def is_cabinet(self) -> bool:
        """药品是否属于驿站自营（公共区药品），此时不显示邻居药主。"""
        return bool(self.medicine and self.medicine.is_cabinet)

    @property
    def borrower_name(self) -> str:
        return self.borrower.name if self.borrower else ""

    @property
    def owner_name(self) -> str:
        return self.owner.name if self.owner else ""

    @property
    def borrower_building(self) -> str:
        return self.borrower.building if self.borrower else ""

    @property
    def owner_building(self) -> str:
        return self.owner.building if self.owner else ""

    @property
    def symptoms(self):
        return self.medicine.symptoms if self.medicine else []

    @property
    def dispense_mode(self) -> str:
        # 出货形态按药品来源区分：驿站自营=透明售货掉落(无需取药码)，居民共享=中转格口(需取药码)
        return "vending" if (self.medicine and self.medicine.is_cabinet) else "locker"


class AdverseReactionReport(Base):
    """居民用药后不良反应 / 异常用药上报。"""

    __tablename__ = "adverse_reaction_reports"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    request_id = Column(Integer, ForeignKey("borrow_requests.id"), nullable=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=True)
    medicine_name = Column(String(100), default="")
    symptoms = Column(Text, default="")  # 不良反应表现
    severity = Column(String(20), default="mild")  # mild / moderate / severe
    description = Column(Text, default="")
    status = Column(String(20), default="pending")  # pending / resolved / rejected
    handler_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    handle_note = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    handled_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    handler = relationship("User", foreign_keys=[handler_id])
    request = relationship("BorrowRequest")

    @property
    def user_name(self) -> str:
        return self.user.name if self.user else ""

    @property
    def user_building(self) -> str:
        return self.user.building if self.user else ""

    @property
    def handler_name(self) -> str:
        return self.handler.name if self.handler else ""


class PointAccount(Base):
    __tablename__ = "point_accounts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    balance = Column(Integer, default=0)
    total_earned = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class PointLog(Base):
    __tablename__ = "point_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Integer, default=0)
    reason = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Gift(Base):
    __tablename__ = "gifts"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    points = Column(Integer, default=0)
    stock = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class GiftRedemption(Base):
    __tablename__ = "gift_redemptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    gift_id = Column(Integer, ForeignKey("gifts.id"), nullable=False)
    gift_name = Column(String(100), default="")
    points = Column(Integer, default=0)
    status = Column(String(20), default="pending")  # pending / fulfilled
    created_at = Column(DateTime, default=datetime.utcnow)
    fulfilled_at = Column(DateTime, nullable=True)

    user = relationship("User")
    gift = relationship("Gift")

    @property
    def user_name(self) -> str:
        return self.user.name if self.user else ""

    @property
    def user_building(self) -> str:
        return self.user.building if self.user else ""


class CreditProfile(Base):
    """居民信用分：违约、违规共享会扣分，低于阈值或管理员拉黑后限制借药。"""

    __tablename__ = "credit_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    score = Column(Integer, default=100)
    status = Column(String(20), default="normal")  # normal / blacklisted
    reason = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class CreditLog(Base):
    __tablename__ = "credit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    delta = Column(Integer, default=0)
    reason = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class HealthProfile(Base):
    """居民个人健康档案：过敏史、基础疾病等。"""

    __tablename__ = "health_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    allergies = Column(JSON, default=list)  # 过敏史列表
    chronic_diseases = Column(JSON, default=list)  # 基础疾病列表
    blood_type = Column(String(10), default="")
    birth_year = Column(Integer, nullable=True)
    note = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class DoctorAccessGrant(Base):
    """居民授权某位社区医生查看自己的健康档案与用药记录。"""

    __tablename__ = "doctor_access_grants"

    id = Column(Integer, primary_key=True)
    resident_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(20), default="active")  # active / revoked
    scope_note = Column(String(200), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

    resident = relationship("User", foreign_keys=[resident_id])
    doctor = relationship("User", foreign_keys=[doctor_id])

    @property
    def resident_name(self) -> str:
        return self.resident.name if self.resident else ""

    @property
    def resident_building(self) -> str:
        return self.resident.building if self.resident else ""

    @property
    def doctor_name(self) -> str:
        return self.doctor.name if self.doctor else ""


class ConsultConversation(Base):
    """在线问诊会话：居民与社区医生的一对一聊天。"""

    __tablename__ = "consult_conversations"

    id = Column(Integer, primary_key=True)
    resident_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resident = relationship("User", foreign_keys=[resident_id])
    doctor = relationship("User", foreign_keys=[doctor_id])
    messages = relationship(
        "ConsultMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConsultMessage.id",
    )

    @property
    def resident_name(self) -> str:
        return self.resident.name if self.resident else ""

    @property
    def resident_building(self) -> str:
        return self.resident.building if self.resident else ""

    @property
    def doctor_name(self) -> str:
        return self.doctor.name if self.doctor else ""

    @property
    def last_message(self) -> str:
        return self.messages[-1].content if self.messages else ""

    @property
    def unread(self) -> int:
        return sum(
            1 for m in self.messages if m.sender_role == "resident" and not m.read
        )


class ConsultMessage(Base):
    """问诊聊天消息。"""

    __tablename__ = "consult_messages"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(
        Integer, ForeignKey("consult_conversations.id"), nullable=False, index=True
    )
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sender_role = Column(String(20), default="resident")  # resident / doctor
    content = Column(Text, default="")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("ConsultConversation", back_populates="messages")


class PaymentOrder(Base):
    """借药支付订单：双重审核通过后生成，居民完成支付才可出货。"""

    __tablename__ = "payment_orders"

    id = Column(Integer, primary_key=True)
    request_id = Column(
        Integer, ForeignKey("borrow_requests.id"), nullable=False, unique=True, index=True
    )
    borrower_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Float, default=0)
    status = Column(String(20), default="pending")  # pending / paid
    method = Column(String(30), default="mock")
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    request = relationship("BorrowRequest", back_populates="payment")
    borrower = relationship("User")


class LockerDropoff(Base):
    """居民自助把闲置药品投放到柜子中转格口的登记与核验记录。"""

    __tablename__ = "locker_dropoffs"

    id = Column(Integer, primary_key=True)
    medicine_id = Column(
        Integer, ForeignKey("medicines.id"), nullable=False, index=True
    )
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    quantity = Column(Integer, default=0)
    note = Column(Text, default="")
    # pending_verify 待管理员实物核验 / verified 已核验上架 / rejected 核验未通过
    status = Column(String(20), default="pending_verify")
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_note = Column(Text, default="")
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    medicine = relationship("Medicine", back_populates="dropoffs")
    owner = relationship("User", foreign_keys=[owner_id])
    admin = relationship("User", foreign_keys=[admin_id])

    @property
    def medicine_name(self) -> str:
        return self.medicine.name if self.medicine else ""

    @property
    def unit(self) -> str:
        return self.medicine.unit if self.medicine else ""

    @property
    def owner_name(self) -> str:
        return self.owner.name if self.owner else ""

    @property
    def owner_building(self) -> str:
        return self.owner.building if self.owner else ""

