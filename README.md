# Database Sync Web

`database-sync-web` 是 `database-sync-go` 的前端管理台。这个前端工程来自旧项目模板，当前代码里仍有 Recodex Relay、客户端凭证、房间连接、流量计量、会员订单等残留概念；后续开发时不要以这些旧页面作为业务依据，应以后端 `database-sync-go` 已实现和规划的数据库同步能力为准。

## 真实系统定位

本系统要实现的是一个数据库同步管理平台，用于配置、执行和观测不同数据库之间的数据同步任务。

后端第一版的核心目标：

- 管理 MySQL、TDengine 数据源。
- 配置源表到目标表的同步任务。
- 支持全量同步和基于游标字段的增量同步。
- 支持字段映射、默认值、简单类型转换、过滤条件、批次大小和写入模式。
- 手动触发同步任务。
- 查看同步执行记录、运行进度和失败明细。

第一版暂不以旧前端里的 Relay 接入、账号套餐、订单支付、房间连接、流量计费等功能为目标。

## 技术栈

- Angular 21
- NG-ALAIN 21
- ng-zorro-antd 21
- @delon 21
- Less
- Vitest
- ESLint / Stylelint / Prettier

## 本地启动

前端默认使用 npm。

```bash
npm install
npm start
```

`npm start` 会执行 `ng s -o`，本地开发服务通过 `proxy.conf.js` 将 `/api/` 代理到后端：

```text
http://127.0.0.1:3010/api/
```

后端启动参考：

```bash
cd ../database-sync-go
go mod tidy
go run .
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动本地开发服务 |
| `npm run build` | 生产构建 |
| `npm run watch` | development 配置下监听构建 |
| `npm test` | 运行单元测试 |
| `npm run test-coverage` | 运行测试并输出覆盖率 |
| `npm run lint` | 运行 TS/HTML 和 Less 检查 |
| `npm run analyze` | 带 source map 构建 |
| `npm run analyze:view` | 查看 bundle 分析结果 |
| `npm run theme` | 生成 NG-ALAIN 主题样式 |
| `npm run icon` | 生成图标配置 |

## 以后台为准的页面规划

后续前端页面建议围绕下面模块重建。

| 模块 | 建议路由 | 后端能力 |
| --- | --- | --- |
| 工作台 | `/dashboard` | 展示数据源数量、任务数量、最近运行状态、失败记录摘要 |
| 数据源管理 | `/datasources/list` | 管理 MySQL / TDengine 连接信息，支持测试连接 |
| 同步任务 | `/sync/tasks/list` | 配置源数据源、目标数据源、表名、同步模式、字段映射和写入模式 |
| 任务执行 | `/sync/tasks/:guid/run` | 手动触发同步任务，返回本次执行记录 |
| 同步历史 | `/sync/runs/list` | 查看每次同步执行记录、耗时、成功数、失败数和最后错误 |
| 运行进度 | `/sync/runs/:guid` | 查看总数、已处理、成功、失败、游标和状态 |
| 失败明细 | `/sync/runs/:guid/errors` | 查看失败行源数据快照和错误原因 |
| 使用指南 | `/guide` | 说明数据源、任务配置、字段映射和同步执行流程 |

旧项目里的 `clients`、`rooms`、`traffic`、`memberships`、`orders`、`accounts`、`ops` 不属于当前后台第一版业务，应逐步删除或替换为上面的 DataSync 模块。

## 当前旧残留

这个工程目前仍有旧系统代码，改造时需要重点清理：

- 应用标题仍是 `Recodex Relay`。
- 侧边栏仍是 Relay、凭证管理、房间连接、流量计量、会员订单、账号管理、运维审计。
- `src/app/routes/routes.ts` 中存在 `rooms`、`traffic`、`memberships`、`orders`、`ops` 等旧路由引用，但对应目录并不完整。
- `clients` 和 `accounts` 下的服务、页面、文案仍对接旧接口，例如 `/clients/list`、`/accounts/list`。
- 登录、注册、指南和工作台仍保留旧的 Relay 文案。

改造优先级建议：

1. 先把应用标题、侧边栏、路由改成 DataSync 业务结构。
2. 新建 `datasources`、`sync/tasks`、`sync/runs` 相关页面和服务。
3. 将旧的 Relay 页面移除或隔离，避免误调用不存在的后台接口。
4. 最后再补充仪表盘和使用指南。

## 后端 API

统一前缀来自后端 `config.yaml` 的 `system.router-prefix`，默认是 `/api`。前端服务代码里请求相对路径即可，拦截器会自动加上 `environment.api.baseUrl`。

后端响应会被前端拦截器解包。业务接口应按下面形态处理：

```json
{
  "code": 200,
  "data": {},
  "msg": "success"
}
```

### 数据源

| 方法 | 前端请求路径 | 说明 |
| --- | --- | --- |
| `GET` | `/datasources/list` | 分页查询数据源 |
| `GET` | `/datasources` | 分页查询数据源，后端也支持 |
| `POST` | `/datasources` | 创建数据源 |
| `PUT` | `/datasources/:guid` | 更新数据源 |
| `DELETE` | `/datasources/:guid` | 删除数据源 |
| `POST` | `/datasources/:guid/test` | 测试连接 |

查询参数：

| 参数 | 说明 |
| --- | --- |
| `page` | 页码，默认 1 |
| `size` | 每页数量，默认 20 |
| `keyword` / `content` | 按名称、GUID、主机、数据库、备注搜索 |
| `type` | 数据源类型，`mysql` 或 `tdengine` |
| `status` | 状态，`1` 启用，`0` 禁用 |
| `all` / `noPage` | `true`、`1` 或 `yes` 时返回全部 |

保存字段：

| 字段 | 说明 |
| --- | --- |
| `guid` | 更新时可传，或者通过 URL 传 |
| `name` | 数据源名称，必填 |
| `type` | `mysql`、`tdengine`，也兼容 `taos`、`td` |
| `host` | 主机，必填 |
| `port` | 端口，不传时 MySQL 默认 3306，TDengine 默认 6041 |
| `username` | 用户名 |
| `password` | 密码；更新时为空不会覆盖旧密码 |
| `database` | 数据库名 |
| `params` | 额外连接参数 JSON 字符串 |
| `remark` | 备注 |
| `status` | `1` 启用，`0` 禁用 |

### 同步任务

| 方法 | 前端请求路径 | 说明 |
| --- | --- | --- |
| `GET` | `/sync/tasks/list` | 分页查询同步任务 |
| `POST` | `/sync/tasks` | 创建同步任务 |
| `PUT` | `/sync/tasks/:guid` | 更新同步任务 |
| `DELETE` | `/sync/tasks/:guid` | 删除同步任务 |
| `POST` | `/sync/tasks/:guid/run` | 手动执行任务 |

查询参数：

| 参数 | 说明 |
| --- | --- |
| `page` | 页码，默认 1 |
| `size` | 每页数量，默认 20 |
| `keyword` / `content` | 按任务名、GUID、源表、目标表、备注搜索 |
| `mode` | `full` 或 `incremental` |
| `status` | 状态，`1` 启用，`0` 禁用 |

保存字段：

| 字段 | 说明 |
| --- | --- |
| `guid` | 更新时可传，或者通过 URL 传 |
| `name` | 任务名称，必填 |
| `sourceGuid` | 源数据源 GUID，必填 |
| `targetGuid` | 目标数据源 GUID，必填 |
| `sourceTable` | 源表，必填 |
| `targetTable` | 目标表，必填 |
| `mode` | `full` 或 `incremental`，默认 `full` |
| `cursorField` | 增量游标字段，增量模式必填 |
| `cursorValue` | 当前游标值 |
| `batchSize` | 批次大小，默认 1000 |
| `fields` | 字段映射数组，推荐前端使用 |
| `fieldMapping` | 字段映射 JSON 字符串，后端兼容 |
| `writeMode` | `insert`、`upsert`、`replace`，默认 `insert` |
| `conflictKeys` | 冲突字段，逗号分隔，主要用于 upsert |
| `whereClause` | 源表过滤条件 |
| `remark` | 备注 |
| `status` | `1` 启用，`0` 禁用 |

字段映射结构：

```json
[
  {
    "source": "created_at",
    "target": "ts",
    "transform": "time_to_millis"
  },
  {
    "source": "temperature",
    "target": "temperature",
    "transform": "float"
  },
  {
    "target": "source_type",
    "default": "mysql"
  }
]
```

校验规则：

- `fields` 不能为空。
- 每一项必须有 `target`。
- 每一项必须有 `source` 或 `default` 之一。
- 增量模式必须填写 `cursorField`。
- 源数据源和目标数据源必须存在且启用。

支持的转换函数：

| 函数 | 说明 |
| --- | --- |
| `string` | 转字符串 |
| `int` | 转整数 |
| `float` | 转浮点数 |
| `bool` | 转布尔值 |
| `time_to_millis` | 时间转毫秒时间戳 |
| `millis_to_time` | 毫秒时间戳转时间 |

### 同步运行记录

| 方法 | 前端请求路径 | 说明 |
| --- | --- | --- |
| `GET` | `/sync/runs/list` | 分页查询同步历史 |
| `GET` | `/sync/runs/:guid` | 查询运行详情 |
| `GET` | `/sync/runs/:guid/progress` | 查询运行进度 |
| `GET` | `/sync/runs/:guid/errors` | 查询指定运行的失败明细 |

运行记录查询参数：

| 参数 | 说明 |
| --- | --- |
| `page` | 页码，默认 1 |
| `size` | 每页数量，默认 20 |
| `taskGuid` | 按任务过滤 |
| `status` | `pending`、`running`、`success`、`failed`、`canceled` |
| `keyword` / `content` | 按任务名、GUID、最后错误搜索 |

运行状态字段：

| 字段 | 说明 |
| --- | --- |
| `pending` | 已创建执行记录，等待运行 |
| `running` | 正在执行 |
| `success` | 执行成功 |
| `failed` | 执行失败或存在失败行 |
| `canceled` | 已取消，后端第一版暂未实现停止接口 |

进度接口返回：

| 字段 | 说明 |
| --- | --- |
| `guid` | 运行记录 GUID |
| `taskGuid` | 任务 GUID |
| `status` | 当前状态 |
| `totalCount` | 预计总数 |
| `processedCount` | 已处理数量 |
| `successCount` | 成功数量 |
| `failedCount` | 失败数量 |
| `progress` | 0 到 1 的进度比例 |
| `cursorStart` | 起始游标 |
| `cursorEnd` | 当前或结束游标 |
| `lastError` | 最后一条错误 |

失败明细字段：

| 字段 | 说明 |
| --- | --- |
| `runGuid` | 运行记录 GUID |
| `taskGuid` | 任务 GUID |
| `sourcePk` | 源数据主键或唯一标识 |
| `sourceData` | 源数据快照 JSON |
| `errorMessage` | 错误原因 |

## 前端服务建议

建议新增下面的服务文件，按后端真实接口封装：

```text
src/app/routes/datasources/datasources.service.ts
src/app/routes/sync/tasks/sync-tasks.service.ts
src/app/routes/sync/runs/sync-runs.service.ts
```

列表接口统一使用后端分页结构：

```ts
export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
}
```

因为 `defaultInterceptor` 会把 `{ code, data, msg }` 解包为 `data`，组件里拿到的就是 `PageResult<T>`、实体对象或布尔值。

## 建议目录结构

```text
src/app/routes/
  dashboard/             # DataSync 工作台
  datasources/           # 数据源管理
    list/
    create/
    edit/
  sync/
    tasks/               # 同步任务配置
      list/
      create/
      edit/
      detail/
    runs/                # 同步历史、进度、失败明细
      list/
      detail/
  guide/                 # 数据同步使用指南
```

共享类型可放在：

```text
src/app/shared/types/page.ts
src/app/shared/types/datasource.ts
src/app/shared/types/sync.ts
```

## 开发注意事项

- 前端业务模型以后端 `database-sync-go/domains` 和 `database-sync-go/services` 为准。
- 页面文案应使用 DataSync、数据源、同步任务、执行记录、失败明细等概念。
- 不要继续沿用 Relay、客户端凭证、房间、会员、订单、流量计费等旧概念。
- 数据源密码更新时允许留空，后端会保留旧密码。
- 删除数据源前需要确认没有同步任务引用，否则后端会返回 `datasource is used by sync task`。
- 任务运行是异步的，`run` 接口返回执行记录后，前端应轮询 `/sync/runs/:guid/progress`。
- `stop`、定时调度、失败行重试、密码加密保存属于后续扩展，不要在第一版页面里承诺已经可用。

## 构建发布

```bash
npm run build
```

生产构建默认使用 `src/environments/environment.prod.ts`，接口前缀仍是 `/api`。如果前端由后端 Gin 静态资源托管，需要将构建产物放入后端静态资源加载目录，并保持后端 `system.router-prefix` 与前端 `environment.api.baseUrl` 一致。
