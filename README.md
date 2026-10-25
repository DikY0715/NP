# 药邻 Yaolin · 社区智慧驿站家庭药品互助服务系统

> 让邻居家的闲置药，在你需要的时候能被安全、合规地借到。

![前端](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite%207-61dafb?logo=react)
![后端](https://img.shields.io/badge/backend-FastAPI-009688?logo=fastapi)
![数据库](https://img.shields.io/badge/db-SQLite-003b57?logo=sqlite)
![语言](https://img.shields.io/badge/lang-TypeScript%20%2F%20Python-3178c6)

---

## 项目简介

**药邻** 是一套面向社区场景的家庭药品互助解决方案，由「居民 App + 社区智慧驿站（智能柜）+ 医生审核」三部分业务闭环组成：

- 居民把自家药箱里的闲置药品共享出来，或发布用药求助；
- 邻里之间发起借药，请求会依次经过 **医生用药安全审核** 与 **驿站管理员实物核验**；
- 药品通过智能柜中转格口完成无接触交接，全程可追溯；
- 配套的 **积分激励**、**信用分体系**、**不良反应上报** 与 **健康档案 / 在线问诊**，构成完整的社区用药安全网络。

一句话概括：**把药品共享这件本来靠信任和口头约定的事，做成有审核、有核验、有记录的流程。**

---

## 三端角色

登录后按 `role` 字段分流到三套彼此独立的界面（导航、信息架构、功能均不同）。

| 角色 | 入口 | 主要模块 |
| --- | --- | --- |
| **居民** `user` | `ResidentApp` | 药箱 / 社区 / 消息 / 我的 |
| **医生** `doctor` | `DoctorApp` | 借药审核 / 共享审核 / 在线问诊 / 我的 + 不良反应收件箱 |
| **管理员** `admin` | `AdminApp` | 工作台 / 出货 / 库存 / 账号 / 我的 + 积分奖励管理 / 扫码核验 |

### 居民端

- **家庭药箱**：药品增删改查、AI 识药拍照入库、效期统计（30 天内自动标记临期）、按症状或名称查药
- **社区互助**：邻里共享药箱（按「楼栋 / 小区」范围与距离排序）、发布用药求助、响应他人求助
- **消息中心**：借药与求助通知、未读角标、已读标记
- **我的**：健康档案（可授权医生查看）、积分商城、信用分、交易记录、在线问诊、隐私设置

### 医生端

- **借药审核**：审核本小区借药申请，填写用药嘱咐，通过后流转至驿站核验
- **共享审核**：审核居民共享药品的合规性（`compliance_status`）
- **在线问诊**：与居民会话，查看已授权的健康档案
- **不良反应收件箱**：处理居民上报的用药不良反应

### 管理端

- **工作台**：小区运营数据概览
- **出货**：核验借药申请、确认投放、生成取药码、完成出货
- **库存**：驿站自营药品（智能柜）入库 / 补货 / 回收、居民投放核验
- **账号**：创建与管理居民、医生、管理员账号
- **积分奖励**：礼品上下架、兑换订单发货

---

## 技术栈

**前端** `app/`
React 19 · TypeScript 5.9 · Vite 7 · Tailwind CSS 3 · Radix UI（shadcn/ui 组件）· React Router 7 · Recharts · lucide-react · date-fns

**后端** `server/`
FastAPI · SQLAlchemy 1.4 · SQLite · Pydantic v2 · PyJWT（JWT 认证）· bcrypt（密码哈希）· httpx · Uvicorn

**AI 识药**
服务端经 OpenRouter 调用多模态模型识别药盒图片，密钥只保存在服务端，前端不持有任何密钥。

---

## 目录结构

```
NP/
├── app/                      # 前端（React + Vite）
│   ├── src/
│   │   ├── screens/          # 页面：居民端 / doctor/ 医生端 / admin/ 管理端
│   │   ├── components/       # 业务组件 + ui/ 基础组件（shadcn）
│   │   ├── context/          # AppContext：全局状态与 reducer
│   │   ├── lib/              # api.ts 接口封装、ai.ts、utils.ts
│   │   └── types/            # 类型定义
│   ├── public/images/
│   └── vite.config.ts        # 端口 3000，/api 代理到 127.0.0.1:8000
│
├── server/                   # 后端（FastAPI）
│   ├── app/
│   │   ├── main.py           # 应用入口，首次启动自动建表
│   │   ├── config.py         # 环境变量 / .env 配置
│   │   ├── models.py         # ORM 模型（13 张表）
│   │   ├── schemas.py        # Pydantic 请求/响应模型
│   │   ├── security.py       # JWT 签发校验、bcrypt 哈希
│   │   ├── rewards.py        # 积分与信用统一入口
│   │   ├── seed.py           # 演示数据初始化
│   │   └── routers/          # 13 个业务路由模块
│   ├── run.py                # 启动脚本
│   ├── requirements.txt
│   └── .env.example
│
└── Node/                     # Windows 便携版 Node（v24.18.0），仓库内置
```

详细的接口文档见 [`server/README.md`](server/README.md)。

---

## 快速开始

### 环境要求

- Python 3.9+
- Node.js 18+（仓库 `Node/` 目录内置了 Windows 便携版，无需全局安装）

### 1. 启动后端

```bash
cd server

# 安装依赖
python -m pip install -r requirements.txt

# 可选：初始化演示数据
python -m app.seed

# 启动（默认 8000 端口，首次启动自动建表）
python run.py
```

等价命令：

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- 接口根地址：http://localhost:8000
- 交互式文档（Swagger）：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health

### 2. 启动前端

```bash
cd app

npm install
npm run dev
```

打开 http://localhost:3000 。前端已配置 Vite 代理，`/api/*` 会自动转发到 `http://127.0.0.1:8000`，无需手动配置跨域。

> 如果本机没有 Node，可以用仓库内置的便携版：`Node\node.exe` + `Node\npm.cmd`。
> 若需要前端直连后端（不走代理），在 `app/.env.local` 中取消 `VITE_API_BASE_URL` 的注释即可。

### 3. 演示账号

均属于「阳光小区」，执行 `python -m app.seed` 后可用：

| 用户名 | 密码 | 姓名 | 角色 | 楼栋 |
| --- | --- | --- | --- | --- |
| `demo` | `demo123` | 张阿姨 | 居民 | 3 号楼 |
| `lisi` | `lisi123` | 李叔 | 居民 | 5 号楼 |
| `wangwu` | `wangwu123` | 小王 | 居民 | 3 号楼 |
| `doctor` | `doctor123` | 陈医生 | 医生 | — |
| `admin` | `admin123` | 管理员 | 管理员 | — |

重置数据：删除 `server/yaolin.db` 后重新执行 `python -m app.seed`。

---

## 核心流程：一次借药怎么走完

```
居民发起借药
    │
    ▼
pending           医生用药安全审核（/api/review）
    │                 处方药不可赠与、未过安全评估的药品直接拦截
    ├── 驳回 ──► rejected
    ▼
pending_admin     驿站管理员实物核验（/api/admin/borrows/{id}/verify）
    │                 药品不在柜内 → 通知药主投放
    ├── 不合规 ─► rejected
    ▼
pending_owner     药主将药品放入智能柜中转格口（/api/borrow/requests/{id}/dropoff）
    ▼
pending_payment   有偿共享需先支付（/api/borrow/requests/{id}/pay）
    ▼
approved          管理员出货，生成 6 位取药码（/api/admin/borrows/{id}/dispatch）
    ▼
completed         居民凭取药码取药，库存扣减、积分到账
```

居民主动投放闲置药走另一条链路：`pending_verify`（投放登记）→ 管理员核验 → `verified`（上架共享，+20 积分）或 `rejected`。

---

## 积分与信用

**积分规则**（`server/app/rewards.py`）

| 行为 | 积分 |
| --- | --- |
| 完成一次借药 | +5 |
| 共享闲置药通过核验 | +20 |
| 不良反应上报被采纳 | +5 |

积分可在积分商城兑换礼品，管理员负责发货。

**信用分**：初始 100 分，违规扣分、良好行为回分；**低于 60 分自动进入黑名单**，被限制发起借药，回升至阈值以上自动解除。

**安全底线**：处方药不允许赠与或转让；共享药品必须先在服务端通过用药安全评估；居民可上报不良反应，由医生处理并归档。

---

## 接口速览

所有需要登录的接口请在请求头携带 `Authorization: Bearer <access_token>`。完整表格见 [`server/README.md`](server/README.md)，或直接查看 Swagger 文档。

| 模块 | 前缀 |
| --- | --- |
| 认证（注册 / 登录 / 短信码 / 资料） | `/api/auth` |
| 药品（药箱 CRUD / 效期统计 / 查药） | `/api/medicines` |
| 社区互助（共享药箱 / 求助 / 智能柜投放） | `/api/community` |
| 借药（发起 / 投放 / 支付 / 查询） | `/api/borrow` |
| 消息（列表 / 未读数 / 已读） | `/api/messages` |
| 交易记录（借入借出流水） | `/api/transactions` |
| 医生审核（借药 / 共享药品合规） | `/api/review` |
| 管理员（统计 / 账号 / 核验 / 出货 / 库存） | `/api/admin` |
| 健康档案（档案 / 医生授权 / 用药记录 / 患者列表） | `/api/health` |
| 在线问诊 | `/api/consult` |
| 用药安全（不良反应上报 / 信用分） | `/api/reports`、`/api/credit` |
| 积分激励（余额 / 流水 / 礼品 / 兑换） | `/api/points` |
| AI 识药 | `/api/ai/recognize` |
| 健康检查 | `/api/health` |

---

## 环境变量

复制 `server/.env.example` 为 `server/.env` 后按需修改。不配置也能启动（使用默认 SQLite 与开发密钥）。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///server/yaolin.db` | 数据库连接串 |
| `JWT_SECRET` | `yaolin-dev-secret-change-me` | **上线务必更换为随机长字符串** |
| `JWT_ALGORITHM` | `HS256` | JWT 算法 |
| `JWT_EXPIRES_MINUTES` | `10080` | 令牌有效期（默认 7 天） |
| `CORS_ORIGINS` | `localhost:3000,localhost:5173` | 允许跨域的前端地址，逗号分隔 |
| `PORT` | `8000` | 后端监听端口 |
| `SMS_DEBUG` | `true` | 演示环境未接短信网关，`true` 时接口回传验证码；**上线设为 `false`** |
| `OPENROUTER_API_KEY` | 空 | AI 识药所需，留空则识药功能不可用 |
| `OPENROUTER_MODEL` | `openrouter/free` | 识药模型 |

---

## 开发备注

- **效期状态不落库**，序列化时依据 `expiry_date` 实时计算，30 天内为「临期」。
- **数据重置**：删除 `server/yaolin.db` 后重新 seed 即可。
- **换库**：修改 `DATABASE_URL` 即可切到 PostgreSQL 等，模型层无需改动。
- 仓库当前把 `server/yaolin.db` 与 `Node/` 便携运行时一并纳入了版本管理，正式协作时建议把数据库文件加入 `.gitignore`。
- 前端 `app/.env.local` 目前只有注释（不含密钥）；AI 密钥只在服务端 `server/.env` 中配置。

---

## 许可

暂未指定开源许可证。如需对外发布，请先补充 `LICENSE`。
