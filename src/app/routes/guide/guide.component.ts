import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';

interface GuideStep {
  title: string;
  desc: string;
  path?: string;
  action?: string;
  fields: string[];
}

@Component({
  selector: 'app-guide',
  templateUrl: './guide.component.html',
  styleUrls: ['./guide.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SHARED_IMPORTS, TitleLabelComponent],
})
export class GuideComponent {
  protected readonly steps: GuideStep[] = [
    {
      title: '查看工作台',
      desc: '先从工作台确认数据源、同步模板、备份恢复、失败风险和本服务运行状态，快速判断当前系统是否可操作。',
      path: '/dashboard',
      action: '打开工作台',
      fields: ['数据源健康', '同步模板', '备份恢复', '系统运行'],
    },
    {
      title: '创建数据源',
      desc: '录入 MySQL 或 TDengine 的连接信息，在连接健康中确认服务可达，并查看健康数据源的数据库详情。',
      path: '/datasources/health',
      action: '查看连接健康',
      fields: ['type: mysql / tdengine', 'host / port', 'username / password', 'databaseDetail'],
    },
    {
      title: '配置同步任务',
      desc: '选择源数据源和目标数据源，填写表名、同步模式、批次大小与写入策略。',
      path: '/sync/tasks/create',
      action: '新建任务',
      fields: ['sourceGuid / targetGuid', 'sourceTable / targetTable', 'mode', 'writeMode'],
    },
    {
      title: '维护字段映射',
      desc: '把源字段映射到目标字段，可补默认值，也可使用简单转换函数处理时间和数值。',
      fields: ['source', 'target', 'default', 'transform: time_to_millis / float / int'],
    },
    {
      title: '沉淀同步模板',
      desc: '把常用同步配置保存为模板；模板列表可启用或禁用，新建任务时优先套用启用模板减少重复填写。',
      path: '/sync/templates',
      action: '同步模板',
      fields: ['status: 启用 / 禁用', 'fieldMapping', 'writeMode', 'fromTask'],
    },
    {
      title: '执行与排查',
      desc: '手动启动任务后查看运行进度；失败时进入运行详情定位源数据快照、游标和错误原因。',
      path: '/sync/runs/list',
      action: '查看历史',
      fields: ['processedCount', 'successCount', 'failedCount', 'cursorEnd', 'errorMessage'],
    },
    {
      title: '观察运行监控',
      desc: '运行监控集中展示同步、备份、失败通知、本服务状态和部署服务器 CPU、内存、磁盘采样。',
      path: '/ops/monitor',
      action: '运行监控',
      fields: ['runningRuns', 'failedBackups', 'service.status', 'cpu / ram / disk'],
    },
    {
      title: '创建数据库备份',
      desc: '选择数据源和备份表范围，按批次异步导出备份包；成功后可在备份历史中下载。',
      path: '/backups/create',
      action: '新建备份',
      fields: ['dataSourceGuid', 'tables', 'batchSize', 'retryTimes'],
    },
    {
      title: '恢复备份数据',
      desc: '备份恢复默认展示恢复列表，点击新建后在弹窗中选择成功备份、目标数据源和恢复策略。',
      path: '/backups/restore',
      action: '备份恢复',
      fields: ['backupGuid', 'targetDataSourceGuid', 'writeMode', 'createTable'],
    },
    {
      title: '维护全局设置',
      desc: '统一管理同步、备份、恢复、监控刷新和历史保留默认参数，减少每次创建任务时的重复配置。',
      path: '/ops/settings',
      action: '同步设置',
      fields: ['syncBatchSize', 'backupBatchSize', 'restoreWriteMode', 'retentionDays'],
    },
  ];

  protected readonly moduleItems = [
    {
      label: '工作台',
      path: '/dashboard',
      desc: '总览关键指标、快捷入口、最近执行、备份恢复和系统运行状态。',
    },
    {
      label: '连接健康',
      path: '/datasources/health',
      desc: '查看数据源连接状态；健康连接可进入数据库详情页。',
    },
    {
      label: '同步模板',
      path: '/sync/templates',
      desc: '管理可复用同步配置，支持新建、编辑、启用、禁用和用于新建任务。',
    },
    {
      label: '运行监控',
      path: '/ops/monitor',
      desc: '集中查看同步、备份、通知、本服务运行和服务器性能采样。',
    },
  ];

  protected readonly backupItems = [
    {
      label: '备份历史',
      path: '/backups/history',
      desc: '查看备份状态、文件大小、失败原因和下载入口。',
    },
    {
      label: '备份恢复',
      path: '/backups/restore',
      desc: '先展示恢复列表，点击新建后弹窗创建恢复任务，支持自动建表和恢复前清空。',
    },
    {
      label: '备份策略',
      path: '/backups/policies',
      desc: '查看批次、连接参数和重试配置建议。',
    },
  ];

  protected readonly settingGroups = [
    {
      label: '同步执行',
      fields: ['同步默认批次', '同步重试次数', '同步超时'],
    },
    {
      label: '备份与恢复',
      fields: ['备份批次', '备份超时', '恢复批次', '恢复写入模式'],
    },
    {
      label: '监控与保留',
      fields: ['监控刷新', '健康检查', '运行/通知/备份/恢复保留天数'],
    },
  ];

  protected readonly checks = [
    '工作台已汇总数据源、同步任务、同步模板、备份恢复、失败风险和系统运行状态，适合日常巡检入口。',
    '数据库详情仅在连接健康状态为正常时展示入口，用于查看基础信息、连接信息、存储、表统计和性能指标。',
    '同步模板可在列表中启用或禁用；禁用模板不会作为新建任务的推荐套用项。',
    '增量同步必须填写 cursorField，建议使用自增主键、更新时间字段或 TDengine 时间字段。',
    '字段映射数组中的每一项都必须包含 target，并提供 source 或 default。',
    '数据源被同步任务引用时不能删除，需要先调整或删除相关任务。',
    '任务执行是异步的，启动后进入运行详情页查看进度和失败明细。',
    '备份恢复会向目标数据源写入数据，开启恢复前清空时请先确认目标数据源和表范围。',
    '运行监控中的服务状态和服务器 CPU、内存、磁盘信息来自后端服务所在机器的实时采样。',
    '同步设置保存后会作为新建备份、备份恢复和控制台监控的默认参数来源。',
  ];
}
