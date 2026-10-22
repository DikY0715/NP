// 药品过期状态
export type ExpiryStatus = 'normal' | 'expiring' | 'expired';

// 中转格口投放状态
export type DropoffStatus = 'pending_verify' | 'verified' | 'rejected';

// 药品可见性
export type Visibility = 'public' | 'private' | 'emergency';

// 共享方式
export type ShareMode = 'free' | 'priced' | 'none';

// 共享范围
export type ShareScope = 'building' | 'community';

// 药品信息
export interface Medicine {
  id: string;
  name: string;
  spec: string;
  symptoms: string[];
  expiryDate: string;
  price: number;
  status: ExpiryStatus;
  image?: string;
  visibility: Visibility;
  shareMode: ShareMode;
  shareScope: ShareScope;
  unitPrice?: number;
  quantity: number;
  unit: string;
  dosage?: string;
  images?: string[];
  ownerId?: string;
  isOtc: boolean;
  complianceStatus?: ComplianceStatus;
  dropoffStatus?: '' | DropoffStatus;
}

// 社区求助
export interface HelpPost {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  symptoms: string[];
  neededMedicines: string[];
  scope: ShareScope;
  responses: number;
  timestamp: string;
  urgency: 'normal' | 'urgent';
}

// 消息类型
export type MessageType = 'borrow_request' | 'system' | 'chat';

// 消息处理状态
export type MessageStatus =
  | 'pending_owner'
  | 'pending'
  | 'pending_admin'
  | 'pending_payment'
  | 'approved'
  | 'rejected'
  | 'completed';

// 借药单状态：待药主放入中转格口 / 待医生审核 / 待管理员实物核验 / 待支付 /
// 审核通过待出货 / 审核驳回 / 已取药完成
export type BorrowStatus =
  | 'pending_owner'
  | 'pending'
  | 'pending_admin'
  | 'pending_payment'
  | 'approved'
  | 'rejected'
  | 'completed';

// 消息
export interface Message {
  id: string;
  type: MessageType;
  title: string;
  content: string;
  timestamp: string;
  read: boolean;
  status?: MessageStatus;
  senderName?: string;
  senderAvatar?: string;
  /** 关联的借药请求 id（后端 message.request_id），用于同意/拒绝 */
  requestId?: string;
}

// 当前登录用户
export interface User {
  id: string;
  username: string;
  name: string;
  role?: 'user' | 'admin' | 'doctor';
  avatar?: string;
  phone?: string;
  building?: string;
  community?: string;
}

// 交易记录类型
export type TransactionType = 'borrow_in' | 'borrow_out';

// 交易记录
export interface Transaction {
  id: string;
  type: TransactionType;
  medicineName: string;
  quantity: number;
  unit: string;
  counterpartyName: string;
  status: BorrowStatus;
  timestamp: string;
  price?: number;
  paymentStatus?: 'pending' | 'paid';
}

// 借药申请单（医生审核 / 管理员出货使用）
export interface BorrowRequest {
  id: string;
  medicineId: string;
  medicineName: string;
  borrowerId: string;
  ownerId: string;
  borrowerName: string;
  ownerName: string;
  borrowerBuilding: string;
  ownerBuilding: string;
  symptoms: string[];
  quantity: number;
  unit: string;
  status: BorrowStatus;
  note: string;
  doctorId?: string;
  doctorName: string;
  doctorNote: string;
  pickupCode?: string;
  reviewedAt?: string;
  dispenseMode: 'vending' | 'locker';
  /** 是否驿站自营药品（公共区），不涉及邻居药主 */
  isCabinet: boolean;
  amount: number;
  paymentStatus?: 'pending' | 'paid';
  createdAt: string;
}

// 医生端：共享药合规审核项
export type ComplianceStatus = 'pending' | 'ok' | 'rejected';

export interface ReviewMedicine {
  id: string;
  name: string;
  spec: string;
  ownerId: string;
  ownerName: string;
  building: string;
  symptoms: string[];
  quantity: number;
  unit: string;
  expiryDate: string;
  shareScope: ShareScope;
  complianceStatus: ComplianceStatus;
  complianceNote: string;
}

// 管理员端：盘点药品项
export interface AdminMedicine {
  id: string;
  name: string;
  spec: string;
  ownerId: string;
  ownerName: string;
  building: string;
  quantity: number;
  unit: string;
  expiryDate: string;
  status: ExpiryStatus;
  visibility: Visibility;
  shareMode: ShareMode;
  lowStock: boolean;
  source: 'cabinet' | 'shared';
  isOtc: boolean;
  unitPrice?: number;
  dropoffStatus?: '' | DropoffStatus;
}

// 管理员端：居民自助投放登记
export interface LockerDropoff {
  id: string;
  medicineId: string;
  medicineName: string;
  ownerId: string;
  ownerName: string;
  ownerBuilding: string;
  quantity: number;
  unit: string;
  note: string;
  status: DropoffStatus;
  adminNote: string;
  verifiedAt?: string;
  createdAt: string;
}

// 管理员端：工作台统计
export interface AdminStats {
  pendingReview: number;
  awaitingDispatch: number;
  sharedCount: number;
  cabinetCount: number;
  expiredCount: number;
  residentCount: number;
}

// 管理员端：后台分配的医生 / 管理员账号
export interface StaffAccount {
  id: string;
  username: string;
  name: string;
  role: 'doctor' | 'admin';
  phone: string;
  community: string;
  createdAt: string;
}

// 在线问诊（居民 ↔ 社区医生 聊天）
export interface ConsultMessage {
  id: string;
  senderId: string;
  senderRole: 'resident' | 'doctor';
  content: string;
  createdAt: string;
}

export interface ConsultConversation {
  id: string;
  residentId: string;
  residentName: string;
  residentBuilding: string;
  doctorName: string;
  lastMessage: string;
  unread: number;
  updatedAt: string;
}

export interface ConsultThread {
  conversation: ConsultConversation;
  messages: ConsultMessage[];
}

// 社区共享药品
export interface CommunityMedicine {
  id: string;
  medicineId: string;
  name: string;
  spec: string;
  ownerName: string;
  ownerAvatar?: string;
  building: string;
  distance: string;
  phone: string;
  shareMode: ShareMode;
  unitPrice?: number;
  quantity: number;
  unit: string;
  expiryDate: string;
  symptoms: string[];
  isCabinet: boolean;
  sourceLabel: string;
}

// 屏幕名称
export type ScreenName =
  | 'splash'
  | 'login'
  // 居民端
  | 'home'
  | 'scan'
  | 'symptom'
  | 'expiry'
  | 'publicMedicine'
  | 'community'
  | 'postHelp'
  | 'shareSettings'
  | 'message'
  | 'profile'
  | 'privacy'
  | 'medicineDetail'
  | 'addMedicine'
  | 'chat'
  | 'transaction'
  | 'consult'
  | 'healthProfile'
  | 'points'
  | 'credit'
  | 'report'
  | 'reportInbox'
  | 'adminRewards'
  // 医生端
  | 'doctorReview'
  | 'doctorMedicines'
  | 'doctorConsult'
  | 'doctorPatients'
  | 'doctorProfile'
  // 管理员端
  | 'adminHome'
  | 'adminDispatch'
  | 'adminInventory'
  | 'adminUsers'
  | 'adminScan'
  | 'adminProfile';

// Tab 名称
export type TabName = 'home' | 'community' | 'message' | 'profile';

// ---------------------------------------------------------------- 健康档案
export interface HealthProfile {
  id: string;
  userId: string;
  allergies: string[];
  chronicDiseases: string[];
  bloodType: string;
  birthYear?: number;
  note: string;
  updatedAt?: string;
}

export interface DoctorGrant {
  id: string;
  residentId: string;
  residentName: string;
  residentBuilding: string;
  doctorId: string;
  doctorName: string;
  status: 'active' | 'revoked';
  scopeNote: string;
  createdAt: string;
  revokedAt?: string;
}

export interface MedicationRecord {
  id: string;
  kind: 'borrow' | 'consult';
  title: string;
  detail: string;
  doctorName: string;
  status: string;
  createdAt: string;
}

export interface HealthArchive {
  userId: string;
  name: string;
  building: string;
  profile: HealthProfile | null;
  medications: MedicationRecord[];
}

export interface DoctorPatient {
  residentId: string;
  name: string;
  building: string;
  grantId: string;
  grantedAt: string;
  hasProfile: boolean;
  allergies: string[];
}

export interface DoctorOption {
  id: string;
  name: string;
  community: string;
}

// ---------------------------------------------------------------- 不良反应上报
export type ReactionSeverity = 'mild' | 'moderate' | 'severe';

export interface AdverseReport {
  id: string;
  userId: string;
  userName: string;
  userBuilding: string;
  requestId?: string;
  medicineName: string;
  symptoms: string;
  severity: ReactionSeverity;
  description: string;
  status: 'pending' | 'resolved' | 'rejected';
  handlerName: string;
  handleNote: string;
  createdAt: string;
  handledAt?: string;
}

// ---------------------------------------------------------------- 积分
export interface PointRule {
  label: string;
  points: number;
}

export interface PointAccount {
  balance: number;
  totalEarned: number;
  rules: PointRule[];
}

export interface PointLog {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface Gift {
  id: string;
  name: string;
  description: string;
  points: number;
  stock: number;
  active: boolean;
}

export interface Redemption {
  id: string;
  userId: string;
  userName: string;
  userBuilding: string;
  giftName: string;
  points: number;
  status: 'pending' | 'fulfilled';
  createdAt: string;
  fulfilledAt?: string;
}

// ---------------------------------------------------------------- 信用
export interface CreditProfile {
  score: number;
  status: 'normal' | 'blacklisted';
  reason: string;
  level: string;
}

export interface CreditLog {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
}

export interface AdminCredit {
  userId: string;
  name: string;
  building: string;
  phone: string;
  score: number;
  status: 'normal' | 'blacklisted';
  reason: string;
}
