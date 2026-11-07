# 架构约束

开发时不得违反。要违反，先改这里并说明理由。

## 部署形态

Docker Compose 三容器（`db` / `app` / `web`），与 GenisourceMES 同构。浏览器只见 `web` 一个源，`/api` 与 `/actuator` 由 Nginx 反代到 `app:8080`。

## 分层（模块化单体）

```
web (Controller)  →  service (@Transactional)  →  repository (JPA)  →  PostgreSQL
```

- **Controller**：HTTP 契约、Bean Validation、`@PreAuthorize`。不写业务规则，不碰库存。
- **Service**：事务边界、状态机、扫码校验、库存记账。不感知 HTTP。
- **Repository**：实体映射与查询。条件更新 / 行锁放这里，但不写业务分支。

## 硬约束

1. **库存写入只有一个入口**：Service 层的 `recordStockChange`（入库加、出库减）。库存变动、`inventory_txn`、`operation_log`、行状态、单据状态必须在**同一个事务**内完成。
2. **`inventory.qty` 永不为负**：DB 层 `CHECK (qty >= 0)`，出库再加 `SELECT ... FOR UPDATE` + 条件更新 `WHERE qty >= :qty` 双重兜底。
3. **流水与审计只追加**：`inventory_txn`、`operation_log` 禁止 UPDATE / DELETE。
4. **Flyway 是 schema 唯一事实来源**：`db/migration/V*.sql`；JPA 固定 `ddl-auto: validate`，实体与表不一致必须启动失败。
5. **单据状态由行进度派生**：禁止手工改 status；行用条件更新 `WHERE status='PENDING'` 抢锁防重复提交。
6. **不存拣货建议库位**：出库 `task` 接口按实时库存即时计算，确认时再权威校验。
7. **鉴权每请求查库重建权限**：禁用用户 / 撤权即时生效，不等 token 过期。
8. **错误统一 RFC 9457 `ProblemDetail`** + `code` 扩展属性；文案走 `MessageSource`。

## 依赖白名单

后端：`spring-boot-starter-{web,data-jpa,security,oauth2-resource-server,validation,actuator,flyway}`、`flyway-core`、`flyway-database-postgresql`、`postgresql`、`springdoc-openapi-starter-webmvc-ui`。

前端：`react`、`react-dom`、`react-router-dom`、`@tanstack/react-query`、`i18next`、`react-i18next`、`dayjs`、三个 `@fontsource` 字体包。

**新增依赖必须在 `docs/SYSTEM_DESIGN.md` 记录理由。** 明确不允许：任何 UI 组件库、状态管理库（Redux/Zustand）、CSS 框架（Tailwind）、ORM 之外的数据库层。

## 可观测性基线

- `GET /actuator/health`（liveness/readiness 探针）。
- 业务审计：`operation_log` 含 `detail_json`（变动前后快照、原始扫码输入、错误码）。
- 容器日志轮转：app `20m×3`，db/web `10m×3`。

## 备份

`pg_dump` 每日导出 + `genisource-wms-db` 卷快照。数据量 < 10 万行，不设缓存层。
