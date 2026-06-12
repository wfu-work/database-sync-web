import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import {
  DataSource,
  DataSourceType,
  DatabaseDetail,
  MetricItem,
  TableStat,
} from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../datasources.service';

interface SummaryMetric {
  label: string;
  value: string;
  hint: string;
  icon: string;
  tone: 'blue' | 'green' | 'orange' | 'teal';
}

interface InfoItem {
  label: string;
  value: string;
  mono?: boolean;
}

@Component({
  selector: 'app-database-detail',
  templateUrl: './database-detail.component.html',
  styleUrls: ['./database-detail.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class DatabaseDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly numberFormatter = new Intl.NumberFormat('zh-CN');
  private readonly decimalFormatter = new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  });

  protected readonly source = this.navigationDataSource();
  protected guid = '';
  protected detail: DatabaseDetail | null = null;
  protected loading = false;
  protected loadError = '';
  protected readonly tableColumns: Array<STColumn<TableStat>> = [
    { title: '表名', index: 'name', render: 'tableNameRender', width: 240 },
    { title: '类型', index: 'type', render: 'tableTypeRender', width: 100 },
    { title: '行数', index: 'rows', render: 'tableRowsRender', width: 120 },
    { title: '数据大小', index: 'dataBytes', render: 'tableDataRender', width: 130 },
    { title: '索引大小', index: 'indexBytes', render: 'tableIndexRender', width: 130 },
    { title: '创建时间', index: 'createdAt', render: 'tableCreatedRender', width: 170 },
    { title: '更新时间', index: 'updatedAt', render: 'tableUpdatedRender', width: 170 },
  ];

  ngOnInit(): void {
    this.guid = this.route.snapshot.paramMap.get('guid') ?? '';
    this.loadDetail();
  }

  protected loadDetail(): void {
    if (!this.guid) {
      this.loadError = '数据源不存在';
      return;
    }
    this.loading = true;
    this.loadError = '';
    this.service
      .databaseDetail(this.guid)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (detail) => {
          this.detail = detail;
        },
        error: (err) => {
          this.detail = null;
          this.loadError = err?.msg || err?.message || '读取数据库详情失败';
          this.message.error(this.loadError);
        },
      });
  }

  protected goBack(): void {
    this.router.navigate(['/datasources/health']);
  }

  protected summaryMetrics(detail: DatabaseDetail): SummaryMetric[] {
    const isTDengine = this.isTDengine(detail);
    return [
      {
        label: '表对象',
        value: `${this.formatNumber(this.tableObjectCount(detail))} 个`,
        hint: `${this.tableKindLabel(detail)} ${this.formatNumber(detail.tableStats.totalTables)} / ${this.viewKindLabel(detail)} ${this.formatNumber(detail.tableStats.totalViews)}`,
        icon: 'table',
        tone: 'green',
      },
      {
        label: '存储占用',
        value: this.formatBytes(detail.storage.totalBytes),
        hint: `数据 ${this.formatBytes(detail.storage.dataBytes)} / 索引 ${this.formatBytes(detail.storage.indexBytes)}`,
        icon: 'hdd',
        tone: 'blue',
      },
      {
        label: isTDengine ? '当前查询' : '查询速率',
        value: isTDengine
          ? `${this.formatNumber(detail.performance.queries)} 个`
          : this.formatDecimal(detail.performance.qps),
        hint: isTDengine
          ? `客户端应用 ${this.formatNumber(detail.performance.connections)} 个`
          : `累计查询 ${this.formatNumber(detail.performance.queries)} 次`,
        icon: 'line-chart',
        tone: 'orange',
      },
      {
        label: isTDengine ? '集群节点' : '当前连接',
        value: `${this.formatNumber(
          isTDengine ? detail.connection.maxConnections : detail.connection.threadsConnected,
        )} 个`,
        hint: isTDengine
          ? `活跃连接 ${this.formatNumber(detail.connection.threadsConnected)} / 客户端 ${this.formatNumber(detail.performance.connections)}`
          : `运行线程 ${this.formatNumber(detail.connection.threadsRunning)} / 最大 ${this.formatNumber(detail.connection.maxConnections)}`,
        icon: 'link',
        tone: 'teal',
      },
    ];
  }

  protected basicItems(detail: DatabaseDetail): InfoItem[] {
    if (this.isTDengine(detail)) {
      return [
        {
          label: '数据库名称',
          value: this.firstText(detail.basic.name, detail.connection.database),
        },
        { label: '数据库类型', value: this.sourceTypeLabel(detail.basic.type) },
        { label: '数据库版本', value: this.valueText(detail.basic.version), mono: true },
        {
          label: '时间精度',
          value: this.firstMetricText(detail.basic.metrics, '时间精度', detail.basic.charset),
          mono: true,
        },
        {
          label: '缓存模式',
          value: this.firstMetricText(detail.basic.metrics, 'CacheModel', detail.basic.collation),
          mono: true,
        },
        { label: '保留策略', value: this.metricText(detail.basic.metrics, '保留策略'), mono: true },
        { label: '服务器时间', value: this.valueText(detail.basic.serverTime), mono: true },
        { label: '运行时长', value: this.formatDuration(detail.basic.uptimeSeconds) },
      ];
    }
    return [
      { label: '数据库名称', value: this.firstText(detail.basic.name, detail.connection.database) },
      { label: '数据库类型', value: this.sourceTypeLabel(detail.basic.type) },
      { label: '数据库版本', value: this.valueText(detail.basic.version), mono: true },
      { label: '字符集', value: this.valueText(detail.basic.charset), mono: true },
      { label: '排序规则', value: this.valueText(detail.basic.collation), mono: true },
      { label: '服务器时间', value: this.valueText(detail.basic.serverTime), mono: true },
      { label: '运行时长', value: this.formatDuration(detail.basic.uptimeSeconds) },
    ];
  }

  protected connectionItems(detail: DatabaseDetail): InfoItem[] {
    if (this.isTDengine(detail)) {
      return [
        {
          label: 'REST Endpoint',
          value: this.firstText(
            detail.connection.endpoint,
            `${detail.connection.host}:${detail.connection.port}`,
          ),
          mono: true,
        },
        { label: '主机', value: this.valueText(detail.connection.host), mono: true },
        { label: '端口', value: detail.connection.port ? String(detail.connection.port) : '-' },
        { label: '用户名', value: this.valueText(detail.connection.username), mono: true },
        { label: '连接数据库', value: this.valueText(detail.connection.database), mono: true },
        { label: '集群节点', value: `${this.formatNumber(detail.connection.maxConnections)} 个` },
        { label: '活跃连接', value: `${this.formatNumber(detail.connection.threadsConnected)} 个` },
      ];
    }
    return [
      {
        label: '连接端点',
        value: this.firstText(
          detail.connection.endpoint,
          `${detail.connection.host}:${detail.connection.port}`,
        ),
        mono: true,
      },
      { label: '主机', value: this.valueText(detail.connection.host), mono: true },
      { label: '端口', value: detail.connection.port ? String(detail.connection.port) : '-' },
      { label: '用户名', value: this.valueText(detail.connection.username), mono: true },
      { label: '当前用户', value: this.valueText(detail.connection.currentUser), mono: true },
      { label: '连接 ID', value: this.valueText(detail.connection.connectionId), mono: true },
      { label: '连接数据库', value: this.valueText(detail.connection.database), mono: true },
    ];
  }

  protected storageItems(detail: DatabaseDetail): InfoItem[] {
    if (this.isTDengine(detail)) {
      return [
        { label: '总占用', value: this.formatBytes(detail.storage.totalBytes) },
        { label: '数据大小', value: this.formatBytes(detail.storage.dataBytes) },
        { label: '索引大小', value: this.formatBytes(detail.storage.indexBytes) },
        { label: '可用空间', value: this.formatBytes(detail.storage.freeBytes) },
        { label: '普通表', value: `${this.formatNumber(detail.tableStats.totalTables)} 张` },
        { label: '超级表', value: `${this.formatNumber(detail.tableStats.totalViews)} 张` },
        { label: '总行数', value: `${this.formatNumber(detail.tableStats.totalRows)} 行` },
      ];
    }
    return [
      { label: '总占用', value: this.formatBytes(detail.storage.totalBytes) },
      { label: '数据大小', value: this.formatBytes(detail.storage.dataBytes) },
      { label: '索引大小', value: this.formatBytes(detail.storage.indexBytes) },
      { label: '空闲空间', value: this.formatBytes(detail.storage.freeBytes) },
      { label: '总行数', value: `${this.formatNumber(detail.tableStats.totalRows)} 行` },
    ];
  }

  protected performanceItems(detail: DatabaseDetail): InfoItem[] {
    if (this.isTDengine(detail)) {
      return [
        { label: '当前查询', value: `${this.formatNumber(detail.performance.queries)} 个` },
        { label: '客户端应用', value: `${this.formatNumber(detail.performance.connections)} 个` },
        { label: '活跃连接', value: `${this.formatNumber(detail.connection.threadsConnected)} 个` },
        { label: '表对象', value: `${this.formatNumber(detail.performance.openTables)} 个` },
        { label: '集群节点', value: `${this.formatNumber(detail.connection.maxConnections)} 个` },
        { label: '慢查询', value: `${this.formatNumber(detail.performance.slowQueries)} 次` },
      ];
    }
    return [
      { label: 'QPS', value: this.formatDecimal(detail.performance.qps) },
      { label: '累计查询', value: `${this.formatNumber(detail.performance.queries)} 次` },
      { label: '慢查询', value: `${this.formatNumber(detail.performance.slowQueries)} 次` },
      { label: '累计连接', value: `${this.formatNumber(detail.performance.connections)} 次` },
      { label: '打开表', value: `${this.formatNumber(detail.performance.openTables)} 个` },
      { label: '缓存命中率', value: this.formatPercent(detail.performance.cacheHitPercent) },
    ];
  }

  protected safeMetrics(metrics?: MetricItem[] | null): MetricItem[] {
    return metrics ?? [];
  }

  protected safeTables(detail: DatabaseDetail): TableStat[] {
    return detail.tableStats.tables ?? [];
  }

  protected safeWarnings(detail: DatabaseDetail): string[] {
    return detail.warnings ?? [];
  }

  protected sourceTypeLabel(type?: string): string {
    return this.normalizeType(type || '') === 'tdengine' ? 'TDengine' : 'MySQL';
  }

  protected tableTypeLabel(type?: string): string {
    const normalized = (type || '').toLowerCase();
    if (normalized === 'view') return '视图';
    if (['stable', 'super', 'super table', 'super_table', 'stable_table'].includes(normalized)) {
      return '超级表';
    }
    if (
      ['table', 'child', 'child table', 'child_table', 'normal', 'normal_table'].includes(
        normalized,
      )
    ) {
      return '表';
    }
    return type || '-';
  }

  protected tableStatsSummary(detail: DatabaseDetail): string {
    if (this.isTDengine(detail)) {
      return `${this.formatNumber(detail.tableStats.totalViews)} 张超级表 / ${this.formatNumber(detail.tableStats.totalRows)} 行`;
    }
    return `${this.formatNumber(detail.tableStats.totalTables)} 张表 / ${this.formatNumber(detail.tableStats.totalViews)} 个视图 / ${this.formatNumber(detail.tableStats.totalRows)} 行`;
  }

  protected formatTableBytes(
    detail: DatabaseDetail,
    table: TableStat,
    field: 'dataBytes' | 'indexBytes',
  ): string {
    if (
      this.isTDengine(detail) &&
      this.isSuperTable(table.type) &&
      Number(table[field] || 0) <= 0
    ) {
      return '-';
    }
    return this.formatBytes(table[field]);
  }

  protected formatMetric(metric: MetricItem): string {
    const unit = metric.unit ? ` ${metric.unit}` : '';
    return `${this.valueText(metric.value)}${unit}`;
  }

  protected formatBytes(value?: number): string {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${this.decimalFormatter.format(size)} ${units[index]}`;
  }

  protected formatNumber(value?: number): string {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';
    return this.numberFormatter.format(number);
  }

  protected formatDecimal(value?: number): string {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';
    return this.decimalFormatter.format(number);
  }

  protected formatPercent(value?: number): string {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return '-';
    return `${this.decimalFormatter.format(number)}%`;
  }

  protected formatDuration(seconds?: number): string {
    const total = Math.max(0, Math.floor(Number(seconds || 0)));
    if (!total) return '-';
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0) return `${days} 天 ${hours} 小时`;
    if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
    if (minutes > 0) return `${minutes} 分钟`;
    return `${total} 秒`;
  }

  protected formatTime(value?: number): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  protected valueText(value?: unknown): string {
    if (value === undefined || value === null || value === '') return '-';
    return String(value);
  }

  private tableObjectCount(detail: DatabaseDetail): number {
    return (detail.tableStats.totalTables || 0) + (detail.tableStats.totalViews || 0);
  }

  private tableKindLabel(detail: DatabaseDetail): string {
    return this.normalizeType(detail.basic.type) === 'tdengine' ? '普通表' : '表';
  }

  private viewKindLabel(detail: DatabaseDetail): string {
    return this.normalizeType(detail.basic.type) === 'tdengine' ? '超级表' : '视图';
  }

  private isTDengine(detail: DatabaseDetail): boolean {
    return this.normalizeType(detail.basic.type) === 'tdengine';
  }

  private isSuperTable(type?: string): boolean {
    const normalized = (type || '').toLowerCase();
    return ['stable', 'super', 'super table', 'super_table', 'stable_table'].includes(normalized);
  }

  private firstMetricText(
    metrics: MetricItem[] | null | undefined,
    label: string,
    fallback?: unknown,
  ): string {
    return this.firstText(this.metricText(metrics, label), this.valueText(fallback));
  }

  private metricText(metrics: MetricItem[] | null | undefined, label: string): string {
    const item = (metrics ?? []).find((metric) => metric.label === label);
    return item ? this.formatMetric(item) : '-';
  }

  private firstText(...values: Array<string | undefined | null>): string {
    const value = values.find((item) => !!String(item || '').trim() && item !== '-');
    return value ? String(value) : '-';
  }

  private normalizeType(type: string): DataSourceType {
    return type === 'tdengine' || type === 'td' || type === 'taos' ? 'tdengine' : 'mysql';
  }

  private navigationDataSource(): DataSource | null {
    const navigationState = this.router.currentNavigation()?.extras.state as
      | { dataSource?: DataSource }
      | undefined;
    const browserState = globalThis.history?.state as { dataSource?: DataSource } | undefined;
    return navigationState?.dataSource ?? browserState?.dataSource ?? null;
  }
}
