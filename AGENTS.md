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

**Slice 0–8 + B/C/A 扩展全部完成，端到端验收通过：基础验收 24/24、扩展验收 30/30、`check-ledger.mjs` 账实一致、后端 `mvn test` 23/23。**

**A 类（PRD 2026-11-10 扩展范围）**
- Flyway `V3__user_management.sql`（MANAGE_USER 权限）、`V4__extended_features.sql`（批次/盘点/调拨 6 张表 + 流水 type 扩展 ADJUST/TRANSFER_*）。
- 批次/FEFO：`sku_batch` + `inventory_batch` 明细真值，与 `inventory` 聚合同事务同步（`BatchService` 由 `InventoryService` 调用）；入库可选登记批次，出库拣货按效期升序（FEFO），一次确认可跨多批次逐条扣减。
- 盘点单 `/api/v1/stocktakes`（PD-单号，按库位快照，盘盈盘亏走 ADJUST 流水）、调拨 `/api/v1/transfers`（DB-单号，同事务一减一增，净库存不变）。
- 前端新增导航 09 盘点单 / 10 库位调拨，及手机端入库批次输入、出库 FEFO 批次提示。

**C 类（MVP 打磨）**
- 单据编辑/删除（仅 DRAFT）、用户管理界面（建作业员/改密/禁用，含防呆守卫）、分页（通用 `Pagination`）、组合筛选（流水日期/类型/库位、日志操作人/日期、库存低库存）、总览待办与库存预警面板、手机端 409 刷新引导。

**B 类（欠账补齐）**
- 摄像头扫码三级回退、语言切换、自动化测试（23 项）、Docker Compose 全栈实跑（8100 三服务 healthy）。

内置账号：`admin` / `admin123`（**上线前必须改** `WMS_ADMIN_PASSWORD`）。

**验收**：`node scripts/acceptance.mjs`（基础 24 项）、`node scripts/acceptance-extended.mjs`（扩展 30 项）、`node scripts/check-ledger.mjs`（账实一致）。三者均需在空库运行——先 `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` 再重启后端让 Flyway 重建（V1–V4）。

后续可选（不在范围）：CSV 导入导出、报表看板、ERP 对接、退货换标、多仓/3PL/计费、冻结库存、原生 App。
