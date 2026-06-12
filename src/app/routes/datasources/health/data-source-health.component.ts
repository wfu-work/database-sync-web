import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { STChange, STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { DataSource, DataSourceConnectionStatus, DataSourceType } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../datasources.service';

interface HealthMetric {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger' | 'idle';
  hint: string;
}

@Component({
  selector: 'app-data-source-health',
  templateUrl: './data-source-health.component.html',
  styleUrls: ['./data-source-health.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class DataSourceHealthComponent implements OnInit {
  private readonly service = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly q = {
    page: 1,
    size: 10,
    keyword: '',
    type: '',
    status: '',
  };

  protected data: DataSource[] = [];
  protected total = 0;
  protected loading = false;
  protected testingGuid = '';
  protected readonly columns: Array<STColumn<DataSource>> = [
    { title: '数据源', index: 'name', render: 'nameRender', width: 220 },
    { title: '连接地址', index: 'host', render: 'endpointRender', width: 260 },
    { title: '健康状态', index: 'connectionStatus', render: 'healthRender', width: 170 },
    { title: '最近检查', index: 'connectionCheckedAt', render: 'checkedRender', width: 180 },
    { title: '异常信息', index: 'connectionError', render: 'errorRender' },
    { title: '操作', render: 'actionsRender', width: 220 },
  ];

  ngOnInit(): void {
    this.getData();
  }

  protected getData(): void {
    this.loading = true;
    this.service
      .list(this.q)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.data = res.data ?? [];
          this.total = res.total ?? 0;
          this.q.page = res.page || this.q.page;
          this.q.size = res.size || this.q.size;
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取连接健康失败'),
      });
  }

  protected search(): void {
    this.q.page = 1;
    this.getData();
  }

  protected resetQuery(): void {
    this.q.page = 1;
    this.q.keyword = '';
    this.q.type = '';
    this.q.status = '';
    this.getData();
  }

  protected test(item: DataSource): void {
    this.testingGuid = item.guid;
    this.markConnectionChecking(item.guid);
    this.service
      .test(item.guid)
      .pipe(
        finalize(() => {
          this.testingGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('连接测试通过');
          this.getData();
        },
        error: (err) => {
          this.message.error(err?.msg || err?.message || '连接测试失败');
          this.getData();
        },
      });
  }

  protected edit(item: DataSource): void {
    this.router.navigate(['/datasources/edit', item.guid], { state: { dataSource: item } });
  }

  protected canOpenDetail(item: DataSource): boolean {
    return item.connectionStatus === 'connected';
  }

  protected openDetail(item: DataSource): void {
    this.router.navigate(['/datasources/detail', item.guid], { state: { dataSource: item } });
  }

  protected metrics(): HealthMetric[] {
    const connected = this.data.filter((item) => item.connectionStatus === 'connected').length;
    const failed = this.data.filter((item) => item.connectionStatus === 'failed').length;
    const checking = this.data.filter((item) => item.connectionStatus === 'checking').length;
    const unknown = this.data.filter(
      (item) => !item.connectionStatus || item.connectionStatus === 'unknown',
    ).length;
    return [
      { label: '连接正常', value: connected, tone: 'success', hint: '可直接用于同步和备份' },
      { label: '连接异常', value: failed, tone: 'danger', hint: '优先处理失败连接' },
      { label: '检查中', value: checking, tone: 'warning', hint: '等待后端健康检查返回' },
      { label: '未检查', value: unknown, tone: 'idle', hint: '建议手动测试一次' },
    ];
  }

  protected healthLabel(status?: string): string {
    switch (status) {
      case 'checking':
        return '检查中';
      case 'connected':
        return '正常';
      case 'failed':
        return '异常';
      default:
        return '未检查';
    }
  }

  protected healthClass(status?: string): string {
    const value = (status || 'unknown') as DataSourceConnectionStatus;
    if (value === 'connected') return 'status-success';
    if (value === 'failed') return 'status-danger';
    if (value === 'checking') return 'status-warning';
    return 'status-idle';
  }

  protected sourceTypeLabel(type: string): string {
    return this.normalizeType(type) === 'tdengine' ? 'TDengine' : 'MySQL';
  }

  protected formatTime(value?: number): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  protected tableChange(event: STChange): void {
    switch (event.type) {
      case 'pi':
      case 'ps':
      case 'filter':
      case 'sort':
        this.q.page = event.pi;
        this.q.size = event.ps;
        this.getData();
        break;
      default:
        break;
    }
  }

  private normalizeType(type: string): DataSourceType {
    return type === 'tdengine' || type === 'td' || type === 'taos' ? 'tdengine' : 'mysql';
  }

  private markConnectionChecking(guid: string): void {
    const now = Date.now();
    this.data = this.data.map((item) =>
      item.guid === guid
        ? {
            ...item,
            connectionStatus: 'checking',
            connectionCheckedAt: now,
            connectionError: '',
          }
        : item,
    );
    this.cdr.markForCheck();
  }
}
