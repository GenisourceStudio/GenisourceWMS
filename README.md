# GenisourceWMS

轻量仓储管理系统 —— 为自营电商 / 贸易仓提供 Web 化仓库台账：**PC 后台管资料与单据，手机扫码完成仓内作业**，替代 Excel / 纸单。

![Java](https://img.shields.io/badge/Java-21-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-brightgreen)
![React](https://img.shields.io/badge/React-19-149eca)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791)

> **当前状态：v0.1.0-alpha 骨架（Slice 0）。** 工程可启动、数据库迁移就绪、首页读取后端真实数据。业务功能按 [PRD](docs/PRD.md) 的 5 项逐步落地。

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/PRD.md](docs/PRD.md) | 需求事实源（已确认 2026-11-07） |
| [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) | 系统设计：架构、数据模型、状态机、API 契约、验收方案 |
| [docs/design-system.md](docs/design-system.md) | UI 视觉规范（`--gs-*` 设计系统） |
| [AGENTS.md](AGENTS.md) / [ARCHITECTURE.md](ARCHITECTURE.md) | 工程约束（每次会话自动加载） |

## 技术栈

全栈与 [GenisourceMES](../GenisourceMES) 同构，便于后续「工单领料 ↔ 出库单」联动与统一运维。

| 层 | 选型 |
| --- | --- |
| 后端 | Java 21 + Spring Boot 4.1 + Spring Data JPA + Spring Security（JWT）+ Flyway |
| 数据库 | PostgreSQL 17 |
| 前端 | React 19 + TypeScript + Vite + TanStack Query + i18next，自绘设计系统 |
| 部署 | Docker Compose（Nginx + app + PostgreSQL） |

## 端口

刻意与 GenisourceMES（8080）和 ERP 开发库（5432）错开，两个系统可在同一台机器上同时运行。

| 服务 | 端口 |
| --- | --- |
| web（compose） | 8100 |
| 后端 API | 8101 |
| PostgreSQL | 5434 |
| Vite 开发服务器 | 5180 |

## 本地开发

依赖：JDK 21、Node.js 22.12+、pnpm 10、Docker。

```bash
# 1. 只启动数据库
docker run -d --name genisource-wms-db-dev \
  -e POSTGRES_DB=genisource_wms -e POSTGRES_USER=wms -e POSTGRES_PASSWORD=wms_dev_password \
  -p 5434:5432 -v genisource-wms-db-dev-data:/var/lib/postgresql/data postgres:17-alpine

# 2. 后端（Flyway 自动建表）
cd backend
export JAVA_HOME=/usr/local/opt/openjdk@21 && export PATH=$JAVA_HOME/bin:$PATH
mvn -s ../deploy/maven/settings-central.xml -Dmaven.repo.local=../.m2-repo spring-boot:run

# 3. 前端（API 代理到 8101）
cd frontend && pnpm install && pnpm dev
```

- 前端：<http://localhost:5180>
- 后端：<http://localhost:8101>
- 健康检查：<http://localhost:8101/actuator/health>
- API 文档：<http://localhost:8101/swagger-ui.html>

> `~/.m2` 若不可写，`-Dmaven.repo.local=../.m2-repo` 会把依赖装到工程内；该目录已在 `.gitignore` 中。

## 全栈启动

```bash
cp .env.example .env   # 改动所有 change-me 值
docker compose up -d --build
# → http://localhost:8100
```

中国大陆构建加速：在 `.env` 设 `MAVEN_MIRROR=aliyun` 与 `NPM_REGISTRY=https://registry.npmmirror.com`。

## 目录结构

```
backend/          Spring Boot 应用（模块化单体）
  src/main/resources/db/migration/   Flyway 迁移（schema 唯一事实来源）
frontend/         React SPA（管理后台 + /m 手机作业端）
deploy/           Dockerfile / Nginx / Maven 镜像配置
docs/             PRD、系统设计、设计系统
```

## 路线图

| 切片 | 内容 | 状态 |
| --- | --- | --- |
| Slice 0 | 工程骨架、数据库迁移、设计系统 token | ✅ |
| Slice 1 | 登录（JWT）与内置管理员 | ⬜ |
| Slice 2 | 基础资料：SKU / 库位 / 往来单位 | ⬜ |
| Slice 3 | 入库单 + 手机扫码上架 | ⬜ |
| Slice 4 | 库存查询 + 流水台账 | ⬜ |
| Slice 5 | 出库单 + 扫码复核扣减 | ⬜ |
| Slice 6 | 操作日志与端到端验收 | ⬜ |
