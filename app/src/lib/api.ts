// 后端接口封装
// - 统一拼接 API_BASE（默认走同源 /api，由 Vite 代理转发到后端）
// - 自动附带 JWT（存于 localStorage 的 yaolin_token）
// - 负责后端 snake_case ↔ 前端 camelCase 字段映射，并对齐 id 类型（后端 int → 前端 string）

import type {
  Medicine,
  HelpPost,
  Message,
  CommunityMedicine,
  Transaction,
  User,
  Visibility,
  ShareMode,
  ShareScope,
  ExpiryStatus,
  MessageType,
  TransactionType,
  MessageStatus,
  BorrowRequest,
  BorrowStatus,
  ReviewMedicine,
  ComplianceStatus,
  AdminMedicine,
  AdminStats,
  StaffAccount,
  ConsultMessage,
  ConsultConversation,
  ConsultThread,
  DropoffStatus,
  LockerDropoff,
  HealthProfile,
  DoctorGrant,
  MedicationRecord,
  HealthArchive,
  DoctorPatient,
  DoctorOption,
  AdverseReport,
  ReactionSeverity,
  PointAccount,
  PointLog,
  Gift,
  Redemption,
  CreditProfile,
  CreditLog,
  AdminCredit,
} from '@/types';

const API_BASE = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || ''
).replace(/\/$/, '');

// 同源代理不可用时（例如页面并非由 Vite 提供），退回直连本机后端的 8000 端口
const DIRECT_BASE =
  window.location.protocol === 'https:'
    ? ''
    : `http://${window.location.hostname || '127.0.0.1'}:8000`;

const TOKEN_KEY = 'yaolin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let res: Response;
  const primaryUrl = `${API_BASE}${path}`;
  try {
    res = await fetch(primaryUrl, {
      method: options.method || 'GET',
      headers,
      body,
    });
  } catch {
    const fallbackUrl = API_BASE || !DIRECT_BASE ? '' : `${DIRECT_BASE}${path}`;
    if (fallbackUrl) {
      try {
        res = await fetch(fallbackUrl, {
          method: options.method || 'GET',
          headers,
          body,
        });
      } catch {
        throw new ApiError(
          0,
          `无法连接后端服务（${primaryUrl} 与 ${fallbackUrl} 均失败）`,
        );
      }
    } else {
      throw new ApiError(0, `无法连接后端服务（${primaryUrl}）`);
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    let detail = '请求失败，请稍后重试';
    if (data && typeof data === 'object' && 'detail' in data) {
      const d = (data as { detail: unknown }).detail;
      if (typeof d === 'string') detail = d;
      else if (Array.isArray(d)) {
        detail = d
          .map((item) =>
            item && typeof item === 'object' && 'msg' in item
              ? String((item as { msg: unknown }).msg)
              : String(item),
          )
          .join('；');
      }
    } else if (typeof data === 'string' && data) {
      detail = data.slice(0, 120);
    }
    throw new ApiError(res.status, detail);
  }

  return data as T;
}

/** 把 ISO 时间格式化为「刚刚 / n分钟前 / n小时前 / n天前 / 日期」 */
export function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}天前`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- 后端原始结构
interface RawUser {
  id: number;
  username: string;
  name: string;
  role: string;
  avatar: string;
  phone: string;
  building: string;
  community: string;
  created_at: string;
}

interface RawMedicine {
  id: number;
  owner_id: number;
  name: string;
  spec: string;
  symptoms: string[];
  expiry_date: string;
  price: number;
  image: string;
  visibility: string;
  share_mode: string;
  share_scope: string;
  unit_price: number | null;
  quantity: number;
  unit: string;
  dosage: string;
  images: string[];
  status: string;
  created_at: string;
  is_otc: boolean;
  compliance_status: string;
  dropoff_status: string;
}

interface RawHelpPost {
  id: number;
  author_id: number;
  author_name: string;
  author_avatar: string;
  content: string;
  symptoms: string[];
  needed_medicines: string[];
  scope: string;
  urgency: string;
  responses: number;
  timestamp: string | null;
}

interface RawCommunityMedicine {
  id: number;
  medicine_id: number;
  name: string;
  spec: string;
  owner_id: number;
  owner_name: string;
  owner_avatar: string;
  building: string;
  distance: string;
  phone: string;
  share_mode: string;
  unit_price: number | null;
  quantity: number;
  unit: string;
  expiry_date: string;
  symptoms: string[];
  is_cabinet: boolean;
  source_label: string;
}

interface RawMessage {
  id: number;
  type: string;
  title: string;
  content: string;
  read: boolean;
  status: string | null;
  sender_name: string | null;
  sender_avatar: string | null;
  request_id: number | null;
  timestamp: string | null;
}

interface RawBorrowRequest {
  id: number;
  medicine_id: number;
  medicine_name: string;
  borrower_id: number;
  owner_id: number;
  borrower_name: string;
  owner_name: string;
  borrower_building: string;
  owner_building: string;
  symptoms: string[];
  quantity: number;
  unit: string;
  status: string;
  note: string;
  doctor_id: number | null;
  doctor_name: string;
  doctor_note: string;
  pickup_code: string | null;
  reviewed_at: string | null;
  dispense_mode: string;
  is_cabinet: boolean;
  amount: number;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
}

interface RawReviewMedicine {
  id: number;
  name: string;
  spec: string;
  owner_id: number;
  owner_name: string;
  building: string;
  symptoms: string[];
  quantity: number;
  unit: string;
  expiry_date: string;
  share_scope: string;
  compliance_status: string;
  compliance_note: string;
}

interface RawAdminMedicine {
  id: number;
  name: string;
  spec: string;
  owner_id: number;
  owner_name: string;
  building: string;
  quantity: number;
  unit: string;
  expiry_date: string;
  status: string;
  visibility: string;
  share_mode: string;
  recycled: boolean;
  low_stock: boolean;
  source: string;
  is_otc: boolean;
  unit_price: number | null;
  dropoff_status: string;
}

interface RawLockerDropoff {
  id: number;
  medicine_id: number;
  medicine_name: string;
  owner_id: number;
  owner_name: string;
  owner_building: string;
  quantity: number;
  unit: string;
  note: string;
  status: string;
  admin_note: string;
  verified_at: string | null;
  created_at: string;
}

interface RawAdminStats {
  pending_review: number;
  awaiting_dispatch: number;
  shared_count: number;
  cabinet_count: number;
  expired_count: number;
  resident_count: number;
}

interface RawConsultMessage {
  id: number;
  sender_id: number;
  sender_role: string;
  content: string;
  created_at: string;
}

interface RawConsultConversation {
  id: number;
  resident_id: number;
  resident_name: string;
  resident_building: string;
  doctor_id: number | null;
  doctor_name: string;
  last_message: string;
  unread: number;
  updated_at: string;
}

interface RawConsultThread {
  conversation: RawConsultConversation;
  messages: RawConsultMessage[];
}

interface RawTransaction {
  id: number;
  type: string;
  medicine_name: string;
  quantity: number;
  unit: string;
  counterparty_name: string;
  status: string;
  price: number | null;
  payment_status: string | null;
  timestamp: string;
}

interface RawRecognized {
  name: string;
  spec: string;
  symptoms: string[];
  expiryDate: string;
  quantity: number;
  unit: string;
  daysLeft: number | null;
}

interface RawAuthResult {
  access_token: string;
  user: RawUser;
}

// ---------------------------------------------------------------- 映射
function toUser(raw: RawUser): User {
  return {
    id: String(raw.id),
    username: raw.username,
    name: raw.name,
    role: raw.role === 'admin' || raw.role === 'doctor' ? raw.role : 'user',
    avatar: raw.avatar || undefined,
    phone: raw.phone,
    building: raw.building,
    community: raw.community,
  };
}

function toMedicine(raw: RawMedicine): Medicine {
  return {
    id: String(raw.id),
    ownerId: String(raw.owner_id),
    name: raw.name,
    spec: raw.spec,
    symptoms: raw.symptoms ?? [],
    expiryDate: raw.expiry_date,
    price: raw.price ?? 0,
    status: (raw.status ?? 'normal') as ExpiryStatus,
    image: raw.image || undefined,
    visibility: raw.visibility as Visibility,
    shareMode: raw.share_mode as ShareMode,
    shareScope: raw.share_scope as ShareScope,
    unitPrice: raw.unit_price ?? undefined,
    quantity: raw.quantity,
    unit: raw.unit,
    dosage: raw.dosage || undefined,
    images: raw.images && raw.images.length > 0 ? raw.images : undefined,
    isOtc: raw.is_otc ?? true,
    complianceStatus: (raw.compliance_status ?? 'pending') as Medicine['complianceStatus'],
    dropoffStatus: (raw.dropoff_status ?? '') as Medicine['dropoffStatus'],
  };
}

function toHelpPost(raw: RawHelpPost): HelpPost {
  return {
    id: String(raw.id),
    authorName: raw.author_name,
    authorAvatar: raw.author_avatar || undefined,
    content: raw.content,
    symptoms: raw.symptoms ?? [],
    neededMedicines: raw.needed_medicines ?? [],
    scope: raw.scope as ShareScope,
    responses: raw.responses,
    timestamp: formatTime(raw.timestamp),
    urgency: raw.urgency === 'urgent' ? 'urgent' : 'normal',
  };
}

function toCommunityMedicine(raw: RawCommunityMedicine): CommunityMedicine {
  return {
    id: String(raw.medicine_id),
    medicineId: String(raw.medicine_id),
    name: raw.name,
    spec: raw.spec,
    ownerName: raw.owner_name,
    ownerAvatar: raw.owner_avatar || undefined,
    building: raw.building,
    distance: raw.distance,
    phone: raw.phone,
    shareMode: raw.share_mode as ShareMode,
    unitPrice: raw.unit_price ?? undefined,
    quantity: raw.quantity,
    unit: raw.unit,
    expiryDate: raw.expiry_date,
    symptoms: raw.symptoms ?? [],
    isCabinet: raw.is_cabinet ?? false,
    sourceLabel: raw.source_label || (raw.is_cabinet ? '驿站自营' : '邻居闲置'),
  };
}

function toMessage(raw: RawMessage): Message {
  return {
    id: String(raw.id),
    type: raw.type as MessageType,
    title: raw.title,
    content: raw.content,
    timestamp: formatTime(raw.timestamp),
    read: raw.read,
    status: raw.status ? (raw.status as MessageStatus) : undefined,
    senderName: raw.sender_name || undefined,
    senderAvatar: raw.sender_avatar || undefined,
    requestId: raw.request_id != null ? String(raw.request_id) : undefined,
  };
}

function toTransaction(raw: RawTransaction): Transaction {
  return {
    id: String(raw.id),
    type: raw.type as TransactionType,
    medicineName: raw.medicine_name,
    quantity: raw.quantity,
    unit: raw.unit,
    counterpartyName: raw.counterparty_name,
    status: raw.status as Transaction['status'],
    timestamp: formatTime(raw.timestamp),
    price: raw.price ?? undefined,
    paymentStatus:
      raw.payment_status === 'paid' || raw.payment_status === 'pending'
        ? raw.payment_status
        : undefined,
  };
}

function toBorrowRequest(raw: RawBorrowRequest): BorrowRequest {
  return {
    id: String(raw.id),
    medicineId: String(raw.medicine_id),
    medicineName: raw.medicine_name,
    borrowerId: String(raw.borrower_id),
    ownerId: String(raw.owner_id),
    borrowerName: raw.borrower_name,
    ownerName: raw.owner_name,
    borrowerBuilding: raw.borrower_building || '',
    ownerBuilding: raw.owner_building || '',
    symptoms: raw.symptoms ?? [],
    quantity: raw.quantity,
    unit: raw.unit,
    status: raw.status as BorrowStatus,
    note: raw.note || '',
    doctorId: raw.doctor_id != null ? String(raw.doctor_id) : undefined,
    doctorName: raw.doctor_name || '',
    doctorNote: raw.doctor_note || '',
    pickupCode: raw.pickup_code || undefined,
    reviewedAt: raw.reviewed_at || undefined,
    dispenseMode: raw.dispense_mode === 'vending' ? 'vending' : 'locker',
    isCabinet: Boolean(raw.is_cabinet),
    amount: raw.amount ?? 0,
    paymentStatus:
      raw.payment_status === 'paid' || raw.payment_status === 'pending'
        ? raw.payment_status
        : undefined,
    createdAt: raw.created_at,
  };
}

function toReviewMedicine(raw: RawReviewMedicine): ReviewMedicine {
  return {
    id: String(raw.id),
    name: raw.name,
    spec: raw.spec,
    ownerId: String(raw.owner_id),
    ownerName: raw.owner_name,
    building: raw.building,
    symptoms: raw.symptoms ?? [],
    quantity: raw.quantity,
    unit: raw.unit,
    expiryDate: raw.expiry_date,
    shareScope: raw.share_scope as ShareScope,
    complianceStatus: raw.compliance_status as ComplianceStatus,
    complianceNote: raw.compliance_note || '',
  };
}

function toAdminMedicine(raw: RawAdminMedicine): AdminMedicine {
  return {
    id: String(raw.id),
    name: raw.name,
    spec: raw.spec,
    ownerId: String(raw.owner_id),
    ownerName: raw.owner_name,
    building: raw.building,
    quantity: raw.quantity,
    unit: raw.unit,
    expiryDate: raw.expiry_date,
    status: raw.status as ExpiryStatus,
    visibility: raw.visibility as Visibility,
    shareMode: raw.share_mode as ShareMode,
    lowStock: raw.low_stock ?? false,
    source: raw.source === 'cabinet' ? 'cabinet' : 'shared',
    isOtc: raw.is_otc ?? true,
    unitPrice: raw.unit_price ?? undefined,
    dropoffStatus: (raw.dropoff_status ?? '') as AdminMedicine['dropoffStatus'],
  };
}

function toLockerDropoff(raw: RawLockerDropoff): LockerDropoff {
  return {
    id: String(raw.id),
    medicineId: String(raw.medicine_id),
    medicineName: raw.medicine_name,
    ownerId: String(raw.owner_id),
    ownerName: raw.owner_name,
    ownerBuilding: raw.owner_building || '',
    quantity: raw.quantity,
    unit: raw.unit,
    note: raw.note || '',
    status: raw.status as DropoffStatus,
    adminNote: raw.admin_note || '',
    verifiedAt: raw.verified_at || undefined,
    createdAt: raw.created_at,
  };
}

function toAdminStats(raw: RawAdminStats): AdminStats {
  return {
    pendingReview: raw.pending_review,
    awaitingDispatch: raw.awaiting_dispatch,
    sharedCount: raw.shared_count,
    cabinetCount: raw.cabinet_count,
    expiredCount: raw.expired_count,
    residentCount: raw.resident_count,
  };
}

function toStaffAccount(raw: RawUser): StaffAccount {
  return {
    id: String(raw.id),
    username: raw.username,
    name: raw.name,
    role: raw.role === 'admin' ? 'admin' : 'doctor',
    phone: raw.phone || '',
    community: raw.community || '',
    createdAt: formatTime(raw.created_at),
  };
}

function toConsultMessage(raw: RawConsultMessage): ConsultMessage {
  return {
    id: String(raw.id),
    senderId: String(raw.sender_id),
    senderRole: raw.sender_role === 'doctor' ? 'doctor' : 'resident',
    content: raw.content,
    createdAt: raw.created_at,
  };
}

function toConsultConversation(raw: RawConsultConversation): ConsultConversation {
  return {
    id: String(raw.id),
    residentId: String(raw.resident_id),
    residentName: raw.resident_name,
    residentBuilding: raw.resident_building || '',
    doctorName: raw.doctor_name || '',
    lastMessage: raw.last_message || '',
    unread: raw.unread ?? 0,
    updatedAt: raw.updated_at,
  };
}

function toConsultThread(raw: RawConsultThread): ConsultThread {
  return {
    conversation: toConsultConversation(raw.conversation),
    messages: (raw.messages ?? []).map(toConsultMessage),
  };
}

// 前端 camelCase → 后端 snake_case（仅保留后端认识的字段）
const MEDICINE_FIELD_MAP: Record<string, string> = {
  name: 'name',
  spec: 'spec',
  symptoms: 'symptoms',
  expiryDate: 'expiry_date',
  price: 'price',
  image: 'image',
  visibility: 'visibility',
  shareMode: 'share_mode',
  shareScope: 'share_scope',
  unitPrice: 'unit_price',
  quantity: 'quantity',
  unit: 'unit',
  dosage: 'dosage',
  images: 'images',
  isOtc: 'is_otc',
};

function medicinePayload(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const mapped = MEDICINE_FIELD_MAP[key];
    if (mapped !== undefined) out[mapped] = value;
  }
  return out;
}

// ---------------------------------------------------------------- 健康档案
interface RawHealthProfile {
  id: number;
  user_id: number;
  allergies: string[];
  chronic_diseases: string[];
  blood_type: string;
  birth_year: number | null;
  note: string;
  updated_at: string | null;
}

interface RawDoctorGrant {
  id: number;
  resident_id: number;
  resident_name: string;
  resident_building: string;
  doctor_id: number;
  doctor_name: string;
  status: string;
  scope_note: string;
  created_at: string;
  revoked_at: string | null;
}

interface RawMedicationRecord {
  id: string;
  kind: string;
  title: string;
  detail: string;
  doctor_name: string;
  status: string;
  created_at: string;
}

interface RawHealthArchive {
  user_id: number;
  name: string;
  building: string;
  profile: RawHealthProfile | null;
  medications: RawMedicationRecord[];
}

interface RawDoctorPatient {
  resident_id: number;
  name: string;
  building: string;
  grant_id: number;
  granted_at: string;
  has_profile: boolean;
  allergies: string[];
}

interface RawDoctorOption {
  id: number;
  name: string;
  community: string;
}

function toHealthProfile(raw: RawHealthProfile): HealthProfile {
  return {
    id: String(raw.id),
    userId: String(raw.user_id),
    allergies: raw.allergies ?? [],
    chronicDiseases: raw.chronic_diseases ?? [],
    bloodType: raw.blood_type || '',
    birthYear: raw.birth_year ?? undefined,
    note: raw.note || '',
    updatedAt: raw.updated_at || undefined,
  };
}

function toDoctorGrant(raw: RawDoctorGrant): DoctorGrant {
  return {
    id: String(raw.id),
    residentId: String(raw.resident_id),
    residentName: raw.resident_name || '',
    residentBuilding: raw.resident_building || '',
    doctorId: String(raw.doctor_id),
    doctorName: raw.doctor_name || '',
    status: raw.status === 'revoked' ? 'revoked' : 'active',
    scopeNote: raw.scope_note || '',
    createdAt: raw.created_at,
    revokedAt: raw.revoked_at || undefined,
  };
}

function toMedicationRecord(raw: RawMedicationRecord): MedicationRecord {
  return {
    id: raw.id,
    kind: raw.kind === 'consult' ? 'consult' : 'borrow',
    title: raw.title,
    detail: raw.detail || '',
    doctorName: raw.doctor_name || '',
    status: raw.status || '',
    createdAt: raw.created_at,
  };
}

function toHealthArchive(raw: RawHealthArchive): HealthArchive {
  return {
    userId: String(raw.user_id),
    name: raw.name || '',
    building: raw.building || '',
    profile: raw.profile ? toHealthProfile(raw.profile) : null,
    medications: (raw.medications ?? []).map(toMedicationRecord),
  };
}

function toDoctorPatient(raw: RawDoctorPatient): DoctorPatient {
  return {
    residentId: String(raw.resident_id),
    name: raw.name || '',
    building: raw.building || '',
    grantId: String(raw.grant_id),
    grantedAt: raw.granted_at,
    hasProfile: Boolean(raw.has_profile),
    allergies: raw.allergies ?? [],
  };
}

// ---------------------------------------------------------------- 上报 / 积分 / 信用
interface RawAdverseReport {
  id: number;
  user_id: number;
  user_name: string;
  user_building: string;
  request_id: number | null;
  medicine_name: string;
  symptoms: string;
  severity: string;
  description: string;
  status: string;
  handler_name: string;
  handle_note: string;
  created_at: string;
  handled_at: string | null;
}

interface RawPointAccount {
  balance: number;
  total_earned: number;
  rules: { label: string; points: number }[];
}

interface RawPointLog {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
}

interface RawGift {
  id: number;
  name: string;
  description: string;
  points: number;
  stock: number;
  active: boolean;
}

interface RawRedemption {
  id: number;
  user_id: number;
  user_name: string;
  user_building: string;
  gift_name: string;
  points: number;
  status: string;
  created_at: string;
  fulfilled_at: string | null;
}

interface RawCredit {
  score: number;
  status: string;
  reason: string;
  level: string;
}

interface RawCreditLog {
  id: number;
  delta: number;
  reason: string;
  created_at: string;
}

interface RawAdminCredit {
  user_id: number;
  name: string;
  building: string;
  phone: string;
  score: number;
  status: string;
  reason: string;
}

function toAdverseReport(raw: RawAdverseReport): AdverseReport {
  return {
    id: String(raw.id),
    userId: String(raw.user_id),
    userName: raw.user_name || '',
    userBuilding: raw.user_building || '',
    requestId: raw.request_id ? String(raw.request_id) : undefined,
    medicineName: raw.medicine_name || '',
    symptoms: raw.symptoms || '',
    severity: (['mild', 'moderate', 'severe'].includes(raw.severity)
      ? raw.severity
      : 'mild') as ReactionSeverity,
    description: raw.description || '',
    status:
      raw.status === 'resolved'
        ? 'resolved'
        : raw.status === 'rejected'
          ? 'rejected'
          : 'pending',
    handlerName: raw.handler_name || '',
    handleNote: raw.handle_note || '',
    createdAt: raw.created_at,
    handledAt: raw.handled_at || undefined,
  };
}

function toPointAccount(raw: RawPointAccount): PointAccount {
  return {
    balance: raw.balance ?? 0,
    totalEarned: raw.total_earned ?? 0,
    rules: raw.rules ?? [],
  };
}

function toPointLog(raw: RawPointLog): PointLog {
  return {
    id: String(raw.id),
    amount: raw.amount ?? 0,
    reason: raw.reason || '',
    createdAt: raw.created_at,
  };
}

function toGift(raw: RawGift): Gift {
  return {
    id: String(raw.id),
    name: raw.name,
    description: raw.description || '',
    points: raw.points ?? 0,
    stock: raw.stock ?? 0,
    active: Boolean(raw.active),
  };
}

function toRedemption(raw: RawRedemption): Redemption {
  return {
    id: String(raw.id),
    userId: String(raw.user_id),
    userName: raw.user_name || '',
    userBuilding: raw.user_building || '',
    giftName: raw.gift_name || '',
    points: raw.points ?? 0,
    status: raw.status === 'fulfilled' ? 'fulfilled' : 'pending',
    createdAt: raw.created_at,
    fulfilledAt: raw.fulfilled_at || undefined,
  };
}

function toCredit(raw: RawCredit): CreditProfile {
  return {
    score: raw.score ?? 100,
    status: raw.status === 'blacklisted' ? 'blacklisted' : 'normal',
    reason: raw.reason || '',
    level: raw.level || '',
  };
}

function toCreditLog(raw: RawCreditLog): CreditLog {
  return {
    id: String(raw.id),
    delta: raw.delta ?? 0,
    reason: raw.reason || '',
    createdAt: raw.created_at,
  };
}

function toAdminCredit(raw: RawAdminCredit): AdminCredit {
  return {
    userId: String(raw.user_id),
    name: raw.name || '',
    building: raw.building || '',
    phone: raw.phone || '',
    score: raw.score ?? 100,
    status: raw.status === 'blacklisted' ? 'blacklisted' : 'normal',
    reason: raw.reason || '',
  };
}

// ---------------------------------------------------------------- 对外接口
export const api = {
  // 认证
  async sendSmsCode(phone: string): Promise<{ expiresIn: number; debugCode?: string }> {
    const r = await request<{ expires_in: number; debug_code?: string | null }>(
      '/api/auth/sms-code',
      { method: 'POST', body: { phone } },
    );
    return { expiresIn: r.expires_in, debugCode: r.debug_code || undefined };
  },

  async register(payload: {
    phone: string;
    code: string;
    password: string;
    name: string;
    building: string;
    community: string;
  }): Promise<{ token: string; user: User }> {
    const r = await request<RawAuthResult>('/api/auth/register', {
      method: 'POST',
      body: payload,
    });
    return { token: r.access_token, user: toUser(r.user) };
  },

  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const r = await request<RawAuthResult>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    return { token: r.access_token, user: toUser(r.user) };
  },

  async me(): Promise<User> {
    return toUser(await request<RawUser>('/api/auth/me'));
  },

  async updateMe(payload: {
    name?: string;
    avatar?: string;
    phone?: string;
    building?: string;
    community?: string;
  }): Promise<User> {
    return toUser(await request<RawUser>('/api/auth/me', { method: 'PATCH', body: payload }));
  },

  // 家庭药箱
  async listMedicines(): Promise<Medicine[]> {
    const list = await request<RawMedicine[]>('/api/medicines');
    return list.map(toMedicine);
  },

  async createMedicine(input: Partial<Medicine>): Promise<Medicine> {
    const raw = await request<RawMedicine>('/api/medicines', {
      method: 'POST',
      body: medicinePayload(input as Record<string, unknown>),
    });
    return toMedicine(raw);
  },

  async updateMedicine(id: string, updates: Partial<Medicine>): Promise<Medicine> {
    const raw = await request<RawMedicine>(`/api/medicines/${id}`, {
      method: 'PATCH',
      body: medicinePayload(updates as Record<string, unknown>),
    });
    return toMedicine(raw);
  },

  async deleteMedicine(id: string): Promise<void> {
    await request<void>(`/api/medicines/${id}`, { method: 'DELETE' });
  },

  // 社区互助
  async communityMedicines(scope: ShareScope, keyword?: string): Promise<CommunityMedicine[]> {
    const params = new URLSearchParams({ scope });
    if (keyword) params.set('keyword', keyword);
    const list = await request<RawCommunityMedicine[]>(`/api/community/medicines?${params}`);
    return list.map(toCommunityMedicine);
  },

  async helps(scope?: ShareScope): Promise<HelpPost[]> {
    const qs = scope ? `?scope=${scope}` : '';
    const list = await request<RawHelpPost[]>(`/api/community/helps${qs}`);
    return list.map(toHelpPost);
  },

  async myHelps(): Promise<HelpPost[]> {
    const list = await request<RawHelpPost[]>('/api/community/helps/mine');
    return list.map(toHelpPost);
  },

  async createHelp(input: {
    content: string;
    symptoms: string[];
    neededMedicines: string[];
    scope: ShareScope;
    urgency: 'normal' | 'urgent';
  }): Promise<HelpPost> {
    const raw = await request<RawHelpPost>('/api/community/helps', {
      method: 'POST',
      body: {
        content: input.content,
        symptoms: input.symptoms,
        needed_medicines: input.neededMedicines,
        scope: input.scope,
        urgency: input.urgency,
      },
    });
    return toHelpPost(raw);
  },

  async respondHelp(postId: string, message = ''): Promise<void> {
    await request<{ ok: boolean; responses: number }>(
      `/api/community/helps/${postId}/respond`,
      { method: 'POST', body: { message } },
    );
  },

  /** 居民自助登记：把闲置药品放入柜子中转格口 */
  async createDropoff(
    medicineId: string,
    quantity: number,
    note = '',
  ): Promise<LockerDropoff> {
    const raw = await request<RawLockerDropoff>('/api/community/locker/dropoffs', {
      method: 'POST',
      body: { medicine_id: Number(medicineId), quantity, note },
    });
    return toLockerDropoff(raw);
  },

  async myDropoffs(): Promise<LockerDropoff[]> {
    const list = await request<RawLockerDropoff[]>('/api/community/locker/dropoffs/mine');
    return list.map(toLockerDropoff);
  },

  // 借药
  async createBorrow(
    medicineId: string,
    quantity: number,
    note = '',
  ): Promise<BorrowRequest> {
    const raw = await request<RawBorrowRequest>('/api/borrow/requests', {
      method: 'POST',
      body: { medicine_id: Number(medicineId), quantity, note },
    });
    return toBorrowRequest(raw);
  },

  /** 药主确认已把闲置药品放入中转格口 */
  async ownerDropoff(requestId: string): Promise<BorrowRequest> {
    const raw = await request<RawBorrowRequest>(
      `/api/borrow/requests/${requestId}/dropoff`,
      { method: 'POST' },
    );
    return toBorrowRequest(raw);
  },

  /** 居民支付借药订单（模拟支付） */
  async payBorrow(requestId: string): Promise<BorrowRequest> {
    const raw = await request<RawBorrowRequest>(
      `/api/borrow/requests/${requestId}/pay`,
      { method: 'POST' },
    );
    return toBorrowRequest(raw);
  },

  // 消息
  async listMessages(): Promise<Message[]> {
    const list = await request<RawMessage[]>('/api/messages');
    return list.map(toMessage);
  },

  async markMessageRead(id: string): Promise<void> {
    await request<RawMessage>(`/api/messages/${id}/read`, { method: 'POST' });
  },

  async markAllRead(): Promise<void> {
    await request<{ updated: number }>('/api/messages/read-all', { method: 'POST' });
  },

  // 交易记录
  async listTransactions(): Promise<Transaction[]> {
    const list = await request<RawTransaction[]>('/api/transactions');
    return list.map(toTransaction);
  },

  // 医生端：药品安全审核
  async reviewBorrows(status = 'pending'): Promise<BorrowRequest[]> {
    const list = await request<RawBorrowRequest[]>(`/api/review/borrows?status_filter=${status}`);
    return list.map(toBorrowRequest);
  },

  async decideBorrow(requestId: string, approved: boolean, note = ''): Promise<BorrowRequest> {
    const raw = await request<RawBorrowRequest>(`/api/review/borrows/${requestId}`, {
      method: 'POST',
      body: { approved, note },
    });
    return toBorrowRequest(raw);
  },

  async reviewMedicines(status = 'pending'): Promise<ReviewMedicine[]> {
    const list = await request<RawReviewMedicine[]>(
      `/api/review/medicines?status_filter=${status}`,
    );
    return list.map(toReviewMedicine);
  },

  async decideCompliance(
    medicineId: string,
    compliant: boolean,
    note = '',
  ): Promise<ReviewMedicine> {
    const raw = await request<RawReviewMedicine>(
      `/api/review/medicines/${medicineId}/compliance`,
      { method: 'POST', body: { compliant, note } },
    );
    return toReviewMedicine(raw);
  },

  // 管理员端：驿站运营
  async adminStats(): Promise<AdminStats> {
    return toAdminStats(await request<RawAdminStats>('/api/admin/stats'));
  },

  async adminBorrows(status = 'approved'): Promise<BorrowRequest[]> {
    const list = await request<RawBorrowRequest[]>(`/api/admin/borrows?status_filter=${status}`);
    return list.map(toBorrowRequest);
  },

  async adminDispatch(requestId: string): Promise<BorrowRequest> {
    const raw = await request<RawBorrowRequest>(
      `/api/admin/borrows/${requestId}/dispatch`,
      { method: 'POST' },
    );
    return toBorrowRequest(raw);
  },

  async adminComplete(requestId: string): Promise<BorrowRequest> {
    const raw = await request<RawBorrowRequest>(
      `/api/admin/borrows/${requestId}/complete`,
      { method: 'POST' },
    );
    return toBorrowRequest(raw);
  },

  /** 管理员实物核验借药中转格口的实物药品 */
  async adminVerifyBorrow(
    requestId: string,
    compliant: boolean,
    note = '',
  ): Promise<BorrowRequest> {
    const raw = await request<RawBorrowRequest>(
      `/api/admin/borrows/${requestId}/verify`,
      { method: 'POST', body: { compliant, note } },
    );
    return toBorrowRequest(raw);
  },

  /** 管理员待核验的居民自助投放登记 */
  async adminDropoffs(status = 'pending_verify'): Promise<LockerDropoff[]> {
    const list = await request<RawLockerDropoff[]>(
      `/api/admin/dropoffs?status_filter=${status}`,
    );
    return list.map(toLockerDropoff);
  },

  async adminVerifyDropoff(
    dropoffId: string,
    compliant: boolean,
    note = '',
  ): Promise<LockerDropoff> {
    const raw = await request<RawLockerDropoff>(
      `/api/admin/dropoffs/${dropoffId}/verify`,
      { method: 'POST', body: { compliant, note } },
    );
    return toLockerDropoff(raw);
  },

  async adminMedicines(
    view: 'inventory' | 'cabinet' | 'expired' = 'inventory',
  ): Promise<AdminMedicine[]> {
    const list = await request<RawAdminMedicine[]>(`/api/admin/medicines?view=${view}`);
    return list.map(toAdminMedicine);
  },

  async adminRecycle(medicineId: string): Promise<void> {
    await request<RawAdminMedicine>(`/api/admin/medicines/${medicineId}/recycle`, {
      method: 'POST',
    });
  },

  async adminRestock(medicineId: string, quantity: number): Promise<AdminMedicine> {
    const raw = await request<RawAdminMedicine>(`/api/admin/medicines/${medicineId}/restock`, {
      method: 'POST',
      body: { quantity },
    });
    return toAdminMedicine(raw);
  },

  async adminAddCabinetMedicine(input: {
    name: string;
    spec: string;
    quantity: number;
    unit: string;
    expiryDate: string;
    unitPrice?: number;
  }): Promise<AdminMedicine> {
    const raw = await request<RawAdminMedicine>('/api/admin/cabinet', {
      method: 'POST',
      body: {
        name: input.name,
        spec: input.spec,
        quantity: input.quantity,
        unit: input.unit,
        expiry_date: input.expiryDate,
        unit_price: input.unitPrice ?? null,
      },
    });
    return toAdminMedicine(raw);
  },

  // 管理员端：账号分配（医生 / 管理员）
  async adminStaff(): Promise<StaffAccount[]> {
    const list = await request<RawUser[]>('/api/admin/users?role=staff');
    return list.map(toStaffAccount);
  },

  async adminCreateStaff(input: {
    username: string;
    password: string;
    name: string;
    role: 'doctor' | 'admin';
    phone?: string;
  }): Promise<StaffAccount> {
    const raw = await request<RawUser>('/api/admin/users', {
      method: 'POST',
      body: input,
    });
    return toStaffAccount(raw);
  },

  // 在线问诊（聊天）
  async myConsultThread(): Promise<ConsultThread> {
    return toConsultThread(await request<RawConsultThread>('/api/consult/my'));
  },

  async sendConsultMessage(content: string): Promise<ConsultMessage> {
    return toConsultMessage(
      await request<RawConsultMessage>('/api/consult/my/messages', {
        method: 'POST',
        body: { content },
      }),
    );
  },

  async consultConversations(): Promise<ConsultConversation[]> {
    const list = await request<RawConsultConversation[]>('/api/consult/conversations');
    return list.map(toConsultConversation);
  },

  async consultThread(id: string): Promise<ConsultThread> {
    return toConsultThread(await request<RawConsultThread>(`/api/consult/conversations/${id}`));
  },

  async replyConsult(id: string, content: string): Promise<ConsultMessage> {
    return toConsultMessage(
      await request<RawConsultMessage>(`/api/consult/conversations/${id}/messages`, {
        method: 'POST',
        body: { content },
      }),
    );
  },

  // 健康档案（居民）
  async healthProfile(): Promise<HealthProfile> {
    return toHealthProfile(await request<RawHealthProfile>('/api/health/profile'));
  },

  async updateHealthProfile(input: {
    allergies: string[];
    chronicDiseases: string[];
    bloodType: string;
    birthYear?: number;
    note: string;
  }): Promise<HealthProfile> {
    const raw = await request<RawHealthProfile>('/api/health/profile', {
      method: 'PUT',
      body: {
        allergies: input.allergies,
        chronic_diseases: input.chronicDiseases,
        blood_type: input.bloodType,
        birth_year: input.birthYear ?? null,
        note: input.note,
      },
    });
    return toHealthProfile(raw);
  },

  async healthMedications(): Promise<MedicationRecord[]> {
    const list = await request<RawMedicationRecord[]>('/api/health/medications');
    return list.map(toMedicationRecord);
  },

  async healthDoctors(): Promise<DoctorOption[]> {
    const list = await request<RawDoctorOption[]>('/api/health/doctors');
    return list.map((d) => ({
      id: String(d.id),
      name: d.name || '',
      community: d.community || '',
    }));
  },

  async healthGrants(): Promise<DoctorGrant[]> {
    const list = await request<RawDoctorGrant[]>('/api/health/authorizations');
    return list.map(toDoctorGrant);
  },

  async grantDoctor(doctorId: string): Promise<DoctorGrant> {
    const raw = await request<RawDoctorGrant>('/api/health/authorizations', {
      method: 'POST',
      body: { doctor_id: Number(doctorId) },
    });
    return toDoctorGrant(raw);
  },

  async revokeDoctor(grantId: string): Promise<DoctorGrant> {
    const raw = await request<RawDoctorGrant>(
      `/api/health/authorizations/${grantId}`,
      { method: 'DELETE' },
    );
    return toDoctorGrant(raw);
  },

  // 健康档案（医生，仅限已授权居民）
  async doctorPatients(): Promise<DoctorPatient[]> {
    const list = await request<RawDoctorPatient[]>('/api/health/patients');
    return list.map(toDoctorPatient);
  },

  async patientArchive(residentId: string): Promise<HealthArchive> {
    return toHealthArchive(
      await request<RawHealthArchive>(`/api/health/patients/${residentId}`),
    );
  },

  // 不良反应上报
  async createReport(input: {
    requestId?: string;
    medicineName: string;
    symptoms: string;
    severity: ReactionSeverity;
    description: string;
  }): Promise<AdverseReport> {
    const raw = await request<RawAdverseReport>('/api/reports', {
      method: 'POST',
      body: {
        request_id: input.requestId ? Number(input.requestId) : null,
        medicine_name: input.medicineName,
        symptoms: input.symptoms,
        severity: input.severity,
        description: input.description,
      },
    });
    return toAdverseReport(raw);
  },

  async myReports(): Promise<AdverseReport[]> {
    const list = await request<RawAdverseReport[]>('/api/reports/mine');
    return list.map(toAdverseReport);
  },

  async reportInbox(role: 'doctor' | 'admin', status = 'pending'): Promise<AdverseReport[]> {
    const path = role === 'admin' ? '/api/reports/admin' : '/api/reports';
    const list = await request<RawAdverseReport[]>(`${path}?status_filter=${status}`);
    return list.map(toAdverseReport);
  },

  async handleReport(
    id: string,
    accepted: boolean,
    note: string,
  ): Promise<AdverseReport> {
    const raw = await request<RawAdverseReport>(`/api/reports/${id}/handle`, {
      method: 'POST',
      body: { accepted, note },
    });
    return toAdverseReport(raw);
  },

  // 积分
  async myPoints(): Promise<PointAccount> {
    return toPointAccount(await request<RawPointAccount>('/api/points'));
  },

  async pointLogs(): Promise<PointLog[]> {
    const list = await request<RawPointLog[]>('/api/points/logs');
    return list.map(toPointLog);
  },

  async gifts(): Promise<Gift[]> {
    const list = await request<RawGift[]>('/api/points/gifts');
    return list.map(toGift);
  },

  async redeem(giftId: string): Promise<Redemption> {
    const raw = await request<RawRedemption>('/api/points/redeem', {
      method: 'POST',
      body: { gift_id: Number(giftId) },
    });
    return toRedemption(raw);
  },

  async myRedemptions(): Promise<Redemption[]> {
    const list = await request<RawRedemption[]>('/api/points/redemptions/mine');
    return list.map(toRedemption);
  },

  async adminRedemptions(status = 'pending'): Promise<Redemption[]> {
    const list = await request<RawRedemption[]>(
      `/api/points/admin/redemptions?status_filter=${status}`,
    );
    return list.map(toRedemption);
  },

  async fulfillRedemption(id: string): Promise<Redemption> {
    const raw = await request<RawRedemption>(
      `/api/points/admin/redemptions/${id}/fulfill`,
      { method: 'POST' },
    );
    return toRedemption(raw);
  },

  async createGift(input: {
    name: string;
    description: string;
    points: number;
    stock: number;
  }): Promise<Gift> {
    return toGift(
      await request<RawGift>('/api/points/admin/gifts', { method: 'POST', body: input }),
    );
  },

  // 信用
  async myCredit(): Promise<CreditProfile> {
    return toCredit(await request<RawCredit>('/api/credit'));
  },

  async creditLogs(): Promise<CreditLog[]> {
    const list = await request<RawCreditLog[]>('/api/credit/logs');
    return list.map(toCreditLog);
  },

  async adminCredits(): Promise<AdminCredit[]> {
    const list = await request<RawAdminCredit[]>('/api/admin/credit');
    return list.map(toAdminCredit);
  },

  async adminCreditAction(
    userId: string,
    action: 'blacklist' | 'unblacklist',
    reason: string,
  ): Promise<AdminCredit> {
    const raw = await request<RawAdminCredit>(`/api/admin/credit/${userId}`, {
      method: 'POST',
      body: { action, reason },
    });
    return toAdminCredit(raw);
  },

  // AI 识药（密钥由服务端持有）
  async recognize(imageDataUrl: string): Promise<RawRecognized> {
    return request<RawRecognized>('/api/ai/recognize', {
      method: 'POST',
      body: { image: imageDataUrl },
    });
  },
};

export type RecognizedMedicine = RawRecognized;
