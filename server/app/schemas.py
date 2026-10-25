"""Pydantic 请求 / 响应模型。"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field

from .utils import calc_expiry_status, days_left


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- 用户 / 认证
class SmsCodeIn(BaseModel):
    phone: str


class SmsCodeOut(BaseModel):
    expires_in: int
    # 仅 SMS_DEBUG=true 时返回，方便演示环境直接查看验证码
    debug_code: Optional[str] = None


class UserCreate(BaseModel):
    """居民自助注册：手机号 + 短信验证码，用户名即手机号。"""

    phone: str = Field(min_length=11, max_length=11)
    code: str = Field(min_length=6, max_length=6)
    password: str = Field(min_length=6, max_length=72)
    name: str = Field(min_length=1, max_length=50)
    building: str = ""
    community: str = ""


class UserLogin(BaseModel):
    # 支持用户名或手机号登录
    username: str
    password: str


class AdminUserCreate(BaseModel):
    """后台分配医生 / 管理员账号。"""

    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=72)
    name: str = Field(min_length=1, max_length=50)
    role: str  # doctor / admin
    phone: str = ""
    community: str = ""


class UserUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    phone: Optional[str] = None
    building: Optional[str] = None
    community: Optional[str] = None


class UserOut(ORMModel):
    id: int
    username: str
    name: str
    role: str = "user"
    avatar: str = ""
    phone: str = ""
    building: str = ""
    community: str = ""
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------------------------------------------------------------- 药品
class MedicineBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    spec: str = ""
    symptoms: List[str] = []
    expiry_date: str = ""
    price: float = 0
    image: str = ""
    visibility: str = "private"
    share_mode: str = "none"
    share_scope: str = "community"
    unit_price: Optional[float] = None
    quantity: int = 0
    unit: str = "粒"
    dosage: str = ""
    images: List[str] = []
    is_otc: bool = True


class MedicineCreate(MedicineBase):
    pass


class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    spec: Optional[str] = None
    symptoms: Optional[List[str]] = None
    expiry_date: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    visibility: Optional[str] = None
    share_mode: Optional[str] = None
    share_scope: Optional[str] = None
    unit_price: Optional[float] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    dosage: Optional[str] = None
    images: Optional[List[str]] = None
    is_otc: Optional[bool] = None


class MedicineOut(ORMModel):
    id: int
    owner_id: int
    name: str
    spec: str = ""
    symptoms: List[str] = []
    expiry_date: str = ""
    price: float = 0
    image: str = ""
    visibility: str = "private"
    share_mode: str = "none"
    share_scope: str = "community"
    unit_price: Optional[float] = None
    quantity: int = 0
    unit: str = "粒"
    dosage: str = ""
    images: List[str] = []
    is_otc: bool = True
    compliance_status: str = "pending"
    dropoff_status: str = ""
    created_at: datetime

    @computed_field
    @property
    def status(self) -> str:
        return calc_expiry_status(self.expiry_date)


class MedicineStats(BaseModel):
    total: int
    expiring: int
    expired: int


# ---------------------------------------------------------------- 社区共享药品
class CommunityMedicineOut(BaseModel):
    id: int  # 即 medicine_id，前端直接用
    medicine_id: int
    name: str
    spec: str = ""
    owner_id: int
    owner_name: str
    owner_avatar: str = ""
    building: str = ""
    distance: str = ""
    phone: str = ""
    share_mode: str = "free"
    unit_price: Optional[float] = None
    quantity: int = 0
    unit: str = "粒"
    expiry_date: str = ""
    symptoms: List[str] = []
    is_cabinet: bool = False
    source_label: str = ""  # 驿站自营 / 邻居闲置


# ---------------------------------------------------------------- 求助
class HelpPostCreate(BaseModel):
    content: str = Field(min_length=1)
    symptoms: List[str] = []
    needed_medicines: List[str] = []
    scope: str = "community"
    urgency: str = "normal"


class HelpRespondIn(BaseModel):
    message: str = ""


class HelpPostOut(ORMModel):
    id: int
    author_id: int
    author_name: str = ""
    author_avatar: str = ""
    content: str = ""
    symptoms: List[str] = []
    needed_medicines: List[str] = []
    scope: str = "community"
    urgency: str = "normal"
    responses: int = 0
    timestamp: Optional[datetime] = None


# ---------------------------------------------------------------- 消息
class MessageOut(ORMModel):
    id: int
    type: str
    title: str = ""
    content: str = ""
    read: bool = False
    status: Optional[str] = None
    sender_name: Optional[str] = None
    sender_avatar: Optional[str] = None
    request_id: Optional[int] = None
    timestamp: Optional[datetime] = None


class UnreadCountOut(BaseModel):
    count: int


# ---------------------------------------------------------------- 借药
class BorrowRequestCreate(BaseModel):
    medicine_id: int
    quantity: int = 1
    note: str = ""


class BorrowRequestOut(ORMModel):
    id: int
    medicine_id: int
    medicine_name: str = ""
    borrower_id: int
    owner_id: int
    borrower_name: str = ""
    owner_name: str = ""
    borrower_building: str = ""
    owner_building: str = ""
    symptoms: List[str] = []
    quantity: int = 1
    unit: str = "粒"
    status: str = "pending"
    note: str = ""
    doctor_id: Optional[int] = None
    doctor_name: str = ""
    doctor_note: Optional[str] = ""
    pickup_code: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    dispense_mode: str = "locker"
    is_cabinet: bool = False
    amount: float = 0
    payment_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------- 医生审核 / 管理员
class ReviewDecisionIn(BaseModel):
    approved: bool
    note: str = ""


class ComplianceDecisionIn(BaseModel):
    compliant: bool
    note: str = ""


class AdminVerifyIn(BaseModel):
    """管理员实物合规核验。"""

    compliant: bool
    note: str = ""


class LockerDropoffCreate(BaseModel):
    medicine_id: int
    quantity: int = 1
    note: str = ""


class LockerDropoffOut(ORMModel):
    id: int
    medicine_id: int
    medicine_name: str = ""
    owner_id: int
    owner_name: str = ""
    owner_building: str = ""
    quantity: int = 0
    unit: str = "粒"
    note: str = ""
    status: str = "pending_verify"
    admin_note: str = ""
    verified_at: Optional[datetime] = None
    created_at: datetime


class PaymentOut(ORMModel):
    id: int
    request_id: int
    amount: float = 0
    status: str = "pending"
    method: str = "mock"
    paid_at: Optional[datetime] = None
    created_at: datetime


class ReviewMedicineOut(BaseModel):
    id: int
    name: str
    spec: str = ""
    owner_id: int
    owner_name: str = ""
    building: str = ""
    symptoms: List[str] = []
    quantity: int = 0
    unit: str = "粒"
    expiry_date: str = ""
    share_scope: str = "community"
    compliance_status: str = "pending"
    compliance_note: str = ""


class AdminMedicineOut(BaseModel):
    id: int
    name: str
    spec: str = ""
    owner_id: int
    owner_name: str = ""
    building: str = ""
    quantity: int = 0
    unit: str = "粒"
    expiry_date: str = ""
    status: str = "normal"  # 效期状态 normal / expiring / expired
    visibility: str = "private"
    share_mode: str = "none"
    recycled: bool = False
    low_stock: bool = False  # 柜内库存低于预警阈值
    source: str = "shared"  # cabinet 驿站自营 / shared 居民共享
    is_otc: bool = True
    unit_price: Optional[float] = None
    dropoff_status: str = ""


class RestockIn(BaseModel):
    quantity: int


class CabinetMedicineIn(BaseModel):
    """驿站新增自营药品入库。"""

    name: str
    spec: str = ""
    quantity: int = 0
    unit: str = "粒"
    expiry_date: str = ""
    unit_price: Optional[float] = None  # 大于 0 表示按量计价，居民借药需支付


class AdminStatsOut(BaseModel):
    pending_review: int
    awaiting_dispatch: int
    shared_count: int
    cabinet_count: int
    expired_count: int
    resident_count: int


# ---------------------------------------------------------------- 交易记录
class TransactionOut(BaseModel):
    id: int
    type: str  # borrow_in / borrow_out
    medicine_name: str
    quantity: int
    unit: str
    counterparty_name: str
    status: str
    price: Optional[float] = None
    payment_status: Optional[str] = None
    timestamp: datetime


# ---------------------------------------------------------------- AI 识药
class RecognizeIn(BaseModel):
    image: str  # dataURL 或裸 base64
    hint: str = ""


class RecognizedMedicineOut(BaseModel):
    name: str
    spec: str = ""
    symptoms: List[str] = []
    expiryDate: str = ""
    quantity: int = 0
    unit: str = "粒"
    daysLeft: Optional[int] = None
    confidence: str = "medium"


class ExpiryScanItem(BaseModel):
    id: int
    name: str
    expiry_date: str
    status: str
    days_left: Optional[int] = None


# ---------------------------------------------------------------- 在线问诊（聊天）
class ConsultSendIn(BaseModel):
    content: str


class ConsultMessageOut(ORMModel):
    id: int
    sender_id: int
    sender_role: str = "resident"
    content: str = ""
    created_at: datetime


class ConsultConversationOut(ORMModel):
    id: int
    resident_id: int
    resident_name: str = ""
    resident_building: str = ""
    doctor_id: Optional[int] = None
    doctor_name: str = ""
    last_message: str = ""
    unread: int = 0
    updated_at: datetime


class ConsultThreadOut(BaseModel):
    conversation: ConsultConversationOut
    messages: List[ConsultMessageOut]


# ---------------------------------------------------------------- 健康档案
class HealthProfileIn(BaseModel):
    allergies: List[str] = []
    chronic_diseases: List[str] = []
    blood_type: str = ""
    birth_year: Optional[int] = None
    note: str = ""


class HealthProfileOut(ORMModel):
    id: int
    user_id: int
    allergies: List[str] = []
    chronic_diseases: List[str] = []
    blood_type: str = ""
    birth_year: Optional[int] = None
    note: str = ""
    updated_at: Optional[datetime] = None


class DoctorGrantIn(BaseModel):
    doctor_id: int
    scope_note: str = "查看健康档案与用药记录"


class DoctorGrantOut(ORMModel):
    id: int
    resident_id: int
    resident_name: str = ""
    resident_building: str = ""
    doctor_id: int
    doctor_name: str = ""
    status: str = "active"
    scope_note: str = ""
    created_at: datetime
    revoked_at: Optional[datetime] = None


class MedicationRecordOut(BaseModel):
    """用药记录条目：借药、问诊等。"""

    id: str
    kind: str  # borrow / consult
    title: str
    detail: str = ""
    doctor_name: str = ""
    status: str = ""
    created_at: datetime


class HealthArchiveOut(BaseModel):
    user_id: int
    name: str = ""
    building: str = ""
    profile: Optional[HealthProfileOut] = None
    medications: List[MedicationRecordOut] = []


class DoctorPatientOut(BaseModel):
    resident_id: int
    name: str = ""
    building: str = ""
    grant_id: int
    granted_at: datetime
    has_profile: bool = False
    allergies: List[str] = []


class DoctorOptionOut(BaseModel):
    id: int
    name: str = ""
    community: str = ""


# ---------------------------------------------------------------- 不良反应上报
class AdverseReportIn(BaseModel):
    request_id: Optional[int] = None
    medicine_name: str = ""
    symptoms: str
    severity: str = "mild"  # mild / moderate / severe
    description: str = ""


class AdverseHandleIn(BaseModel):
    accepted: bool = True
    note: str = ""


class AdverseReportOut(ORMModel):
    id: int
    user_id: int
    user_name: str = ""
    user_building: str = ""
    request_id: Optional[int] = None
    medicine_name: str = ""
    symptoms: str = ""
    severity: str = "mild"
    description: str = ""
    status: str = "pending"
    handler_name: str = ""
    handle_note: str = ""
    created_at: datetime
    handled_at: Optional[datetime] = None


# ---------------------------------------------------------------- 积分
class PointRuleOut(BaseModel):
    label: str
    points: int


class PointAccountOut(BaseModel):
    balance: int = 0
    total_earned: int = 0
    rules: List[PointRuleOut] = []


class PointLogOut(ORMModel):
    id: int
    amount: int = 0
    reason: str = ""
    created_at: datetime


class GiftOut(ORMModel):
    id: int
    name: str
    description: str = ""
    points: int = 0
    stock: int = 0
    active: bool = True


class GiftIn(BaseModel):
    name: str
    description: str = ""
    points: int
    stock: int = 10


class RedeemIn(BaseModel):
    gift_id: int


class RedemptionOut(ORMModel):
    id: int
    user_id: int
    user_name: str = ""
    user_building: str = ""
    gift_name: str = ""
    points: int = 0
    status: str = "pending"
    created_at: datetime
    fulfilled_at: Optional[datetime] = None


# ---------------------------------------------------------------- 信用与黑名单
class CreditOut(BaseModel):
    score: int = 100
    status: str = "normal"
    reason: str = ""
    level: str = "优秀"


class CreditLogOut(ORMModel):
    id: int
    delta: int = 0
    reason: str = ""
    created_at: datetime


class AdminCreditOut(BaseModel):
    user_id: int
    name: str = ""
    building: str = ""
    phone: str = ""
    score: int = 100
    status: str = "normal"
    reason: str = ""


class AdminCreditActionIn(BaseModel):
    action: str  # blacklist / unblacklist
    reason: str = ""
