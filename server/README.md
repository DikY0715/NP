# 药邻 Yaolin · Python 后端

社区智慧驿站家庭药品互助服务系统的后端服务，技术栈 **FastAPI + SQLAlchemy + SQLite + JWT**。

## 功能范围

- 用户注册 / 登录 / 个人资料（JWT 令牌认证、bcrypt 密码哈希）
- 家庭药箱：药品增删改查、效期统计、按症状 / 名称查药
- 社区互助：邻里共享药箱（按楼栋 / 小区范围与距离排序）、求助发布与响应
- 借药流转：借入 / 借出请求，pending → accepted / rejected → completed 状态机
- 消息中心：借药与求助通知、未读数、已读标记
- 交易记录：由借药请求派生的借入 / 借出流水
- AI 识药：服务端持有 OpenRouter 密钥，前端不再暴露密钥

## 目录结构

```
server/
├── app/
│   ├── config.py        # 配置（环境变量 / .env）
│   ├── database.py      # 引擎、会话、Base
│   ├── utils.py         # 效期状态、剩余天数、距离
│   ├── models.py        # 6 张表 ORM 模型
│   ├── schemas.py       # Pydantic 请求/响应模型
│   ├── security.py      # JWT 与密码哈希
│   ├── deps.py          # 当前用户依赖
│   ├── seed.py          # 演示数据初始化
│   ├── main.py          # 应用入口
│   └── routers/         # 各业务路由
├── run.py               # 便捷启动脚本
├── requirements.txt
└── .env.example
```

## 快速开始

### 1. 安装依赖

```bash
cd server
python -m pip install -r requirements.txt
```

> 需要 Python 3.9+。

### 2. 配置环境变量（可选）

复制 `.env.example` 为 `.env`。不配置也能启动（使用默认 SQLite 与开发密钥），
如需使用 **AI 识药**，请在 `.env` 中填入 `OPENROUTER_API_KEY`。

```bash
copy .env.example .env
```

### 3. 初始化演示数据（可选）

```bash
python -m app.seed
```

演示账号（均属「阳光小区」）：

| 用户名 | 密码 | 姓名 | 楼栋 |
| --- | --- | --- | --- |
| demo | demo123 | 张阿姨 | 3号楼 |
| lisi | lisi123 | 李叔 | 5号楼 |
| wangwu | wangwu123 | 小王 | 3号楼 |

### 4. 启动服务

```bash
python run.py
```

或：

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- 接口根地址：http://localhost:8000
- 交互式文档（Swagger）：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health

## 接口一览

所有需要登录的接口，请在请求头携带：`Authorization: Bearer <access_token>`。

### 认证 `/api/auth`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | 注册（返回 token + 用户信息，用户名重复返回 409） |
| POST | `/api/auth/login` | 登录（返回 token + 用户信息） |
| GET | `/api/auth/me` | 获取当前用户 |
| PATCH | `/api/auth/me` | 更新当前用户资料 |

### 药品 `/api/medicines`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/medicines?status=&keyword=` | 我的药箱列表（可按效期状态、名称过滤） |
| GET | `/api/medicines/stats` | 统计：总数 / 临期 / 过期 |
| GET | `/api/medicines/search?q=` | 按症状或名称查药 |
| POST | `/api/medicines` | 新增药品 |
| GET | `/api/medicines/{id}` | 药品详情 |
| PATCH | `/api/medicines/{id}` | 修改药品 |
| DELETE | `/api/medicines/{id}` | 删除药品 |

### 社区互助 `/api/community`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/community/medicines?scope=&keyword=` | 邻里共享药箱（scope: building / community） |
| GET | `/api/community/helps?scope=` | 邻里求助列表（不含自己发布的） |
| GET | `/api/community/helps/mine` | 我发布的求助 |
| POST | `/api/community/helps` | 发布求助 |
| POST | `/api/community/helps/{id}/respond` | 响应求助（会通知发布者） |

### 借药 `/api/borrow`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/borrow/requests` | 发起借药请求（通知出借人） |
| GET | `/api/borrow/requests?role=in\|out\|all` | 借药请求列表 |
| POST | `/api/borrow/requests/{id}/accept` | 出借人同意 |
| POST | `/api/borrow/requests/{id}/reject` | 出借人拒绝 |
| POST | `/api/borrow/requests/{id}/complete` | 完成交接（扣减库存） |

### 消息 `/api/messages`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/messages` | 消息列表 |
| GET | `/api/messages/unread-count` | 未读数 |
| POST | `/api/messages/read-all` | 全部标记已读 |
| POST | `/api/messages/{id}/read` | 单条标记已读 |

### 交易记录 `/api/transactions`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/transactions` | 借入 / 借出流水（由借药请求派生） |

### AI `/api/ai`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/ai/recognize` | 识别药盒图片（需服务端配置 OPENROUTER_API_KEY） |

### 系统

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |

## 说明

- **效期状态** 不落库，在序列化时依据 `expiry_date` 实时计算（30 天内为临期）。
- **前端接入**：前端默认地址为 `http://localhost:5173`，已加入 CORS 白名单。
  前端调用接口时需在请求头附带 JWT 令牌。
- **数据重置**：删除 `server/yaolin.db` 后重新运行 `python -m app.seed` 即可。
