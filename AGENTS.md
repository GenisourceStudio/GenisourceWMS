# GenisourceWMS

轻量仓储管理系统。`docs/PRD.md` 是需求事实源（**已确认 2026-11-07**），`docs/SYSTEM_DESIGN.md` 与 `docs/design-system.md` 是设计与视觉事实源。

## 一句话需求

为自营电商 / 贸易仓提供 Web 化仓库台账：PC 后台管资料与单据，手机扫码完成仓内作业，替代 Excel / 纸单；验收信号是「全链路跑通 + 账实一致 + 每笔变动可追溯」。

## 栈（锁死，勿引入计划外依赖）

**全栈对齐 `~/Workspace/AI-APP/GenisourceMES`**，用户已明确要求，不要退回 FastAPI / SQLite / 单 VPS systemd。

| 层 | 选型 |
| --- | --- |
| 后端 | Java 21 + Spring Boot 4.1.2 + Spring Data JPA + Spring Security（JWT HS256）+ Flyway + springdoc |
| 数据库 | PostgreSQL 17 |
| 前端 | React 19.3 + TS 5.9 + Vite 8 + pnpm 10.32.1 + TanStack Query 5 + react-router-dom 7 + i18next + dayjs |
| 样式 | 自绘 `--gs-*` 设计系统（`frontend/src/styles/global.css`），**不引入任何 UI 框架** |
| 部署 | Docker Compose（web / app / db）+ Nginx |

## 命令

本机 JAVA_HOME 需指向 JDK 21；`~/.m2` 在沙箱外不可写，**必须**用工程内仓库目录。

```bash
# 数据库（独立容器，避开 MES 的 5432）
docker run -d --name genisource-wms-db-dev -e POSTGRES_DB=genisource_wms \
  -e POSTGRES_USER=wms -e POSTGRES_PASSWORD=wms_dev_password \
  -p 5434:5432 -v genisource-wms-db-dev-data:/var/lib/postgresql/data postgres:17-alpine

# 后端（:8101）
cd backend && export JAVA_HOME=/usr/local/opt/openjdk@21 && export PATH=$JAVA_HOME/bin:$PATH \
  && mvn -s ../deploy/maven/settings-central.xml -Dmaven.repo.local=../.m2-repo spring-boot:run

# 前端（:5180，/api 自动代理到 8101）
cd frontend && pnpm install && pnpm dev

# 构建校验
cd backend && mvn -Dmaven.repo.local=../.m2-repo -DskipTests package
cd frontend && pnpm typecheck && pnpm build

# 全栈
docker compose up -d --build   # web 暴露 8100
```

## 端口约定（勿改，避免与 MES 冲突）

| 服务 | 端口 |
| --- | --- |
| WMS web（compose） | 8100 |
| WMS 后端 | 8101 |
| WMS PostgreSQL | 5434 |
| Vite dev server | 5180 |

## 规则

- **PRD 优先**：计划外功能不做，记入候选清单；改需求先改 `docs/PRD.md`。
- **UI 只引用 `--gs-*` token**，不在组件里写死颜色或字号；不引入 Ant Design / MUI / Tailwind。
- **库存写入只走 Service 层单个 `@Transactional` 方法**，Controller 不得直接改 `inventory`。
- `inventory_txn` 与 `operation_log` **只追加**，永不 UPDATE / DELETE。
- 错误一律返回 RFC 9457 `ProblemDetail` + `code` 扩展属性，前端按 `code` 就近提示。
- 每片一个 commit；API 契约以 `docs/SYSTEM_DESIGN.md` §6 为准。
- 文档权威顺序：`PRD.md` > `SYSTEM_DESIGN.md` > `design-system.md`（视觉细节以 design-system.md 为准）。

## 当前状态

- **Slice 0（工程骨架）**：前后端可启动、Flyway 建表 16 张、RBAC 种子就绪、首页读取后端真实数据。
- **Slice 1（登录与鉴权）**：内置管理员由 `AdminBootstrap` 按环境变量创建；`/auth/login`、`/auth/refresh`、`/auth/me`、`/auth/logout` 就绪；JWT HS256（Access 15m / Refresh 7d）；每请求查库重建权限；前端 `AuthProvider` + `RequireAuth`，401 自动刷新，刷新页面保持登录。
- 内置账号：`admin` / `admin123`（**上线前必须改** `WMS_ADMIN_PASSWORD`）。

下一片：基础资料 SKU 增删改查（Slice 2）。
