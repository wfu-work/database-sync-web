import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { STChange, STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { DataSource, DataSourceType, SaveDataSourcePayload } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../datasources.service';

@Component({
  selector: 'app-data-source-list',
  templateUrl: './data-source-list.component.html',
  styleUrls: ['./data-source-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class DataSourceListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
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
  protected saving = false;
  protected testingGuid = '';
  protected editing: DataSource | null = null;
  protected readonly columns: Array<STColumn<DataSource>> = [
    { title: '数据源', index: 'name', render: 'nameRender' },
    { title: '连接', index: 'host', render: 'connectionRender' },
    { title: '状态', index: 'status', render: 'statusRender', width: 90 },
    { title: '更新时间', index: 'updateTime', render: 'timeRender', width: 180 },
    { title: '操作', render: 'actionsRender', width: 220 },
  ];

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(128)]],
    type: this.fb.control<DataSourceType>('mysql', [Validators.required]),
    host: ['127.0.0.1', [Validators.required, Validators.maxLength(255)]],
    port: [3306, [Validators.required, Validators.min(1)]],
    username: ['', [Validators.maxLength(128)]],
    password: ['', [Validators.maxLength(512)]],
    database: ['', [Validators.maxLength(128)]],
    params: [''],
    remark: ['', [Validators.maxLength(512)]],
    status: [1, [Validators.required]],
  });

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
      .subscribe((res) => {
        this.data = res.data ?? [];
        this.total = res.total ?? 0;
        this.q.page = res.page || this.q.page;
        this.q.size = res.size || this.q.size;
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

  protected create(): void {
    this.editing = null;
    this.form.reset({
      name: '',
      type: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      username: '',
      password: '',
      database: '',
      params: '',
      remark: '',
      status: 1,
    });
  }

  protected edit(item: DataSource): void {
    this.editing = item;
    this.form.reset({
      name: item.name,
      type: this.normalizeType(item.type),
      host: item.host,
      port: item.port,
      username: item.username ?? '',
      password: '',
      database: item.database ?? '',
      params: item.params ?? '',
      remark: item.remark ?? '',
      status: item.status ?? 1,
    });
  }

  protected applyTypeDefaults(type: DataSourceType): void {
    const current = this.form.controls.port.value;
    if (current === 3306 || current === 6041 || !current) {
      this.form.controls.port.setValue(type === 'tdengine' ? 6041 : 3306);
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((control) => {
        control.markAsDirty();
        control.updateValueAndValidity();
      });
      return;
    }

    const payload = this.toPayload();
    this.saving = true;
    this.service
      .save(payload, this.editing?.guid)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success(this.editing ? '数据源已更新' : '数据源已创建');
          this.create();
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '保存数据源失败'),
      });
  }

  protected test(item: DataSource): void {
    this.testingGuid = item.guid;
    this.service
      .test(item.guid)
      .pipe(
        finalize(() => {
          this.testingGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => this.message.success('连接测试通过'),
        error: (err) => this.message.error(err?.msg || err?.message || '连接测试失败'),
      });
  }

  protected remove(item: DataSource): void {
    this.modal.confirm({
      nzTitle: '删除数据源',
      nzContent: `确定删除「${item.name}」吗？已被同步任务引用的数据源后端会拒绝删除。`,
      nzOkDanger: true,
      nzOkText: '删除',
      nzCancelText: '取消',
      nzOnOk: () =>
        this.service.delete(item.guid).subscribe({
          next: () => {
            this.message.success('数据源已删除');
            this.getData();
          },
          error: (err) => this.message.error(err?.msg || err?.message || '删除数据源失败'),
        }),
    });
  }

  protected sourceTypeLabel(type: string): string {
    return this.normalizeType(type) === 'tdengine' ? 'TDengine' : 'MySQL';
  }

  protected statusLabel(status: number): string {
    return status === 1 ? '启用' : '禁用';
  }

  protected formatTime(value?: number): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  private toPayload(): SaveDataSourcePayload {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      type: value.type,
      host: value.host.trim(),
      port: value.port,
      username: value.username.trim(),
      password: value.password.trim() || undefined,
      database: value.database.trim(),
      params: value.params.trim(),
      remark: value.remark.trim(),
      status: Number(value.status),
    };
  }

  private normalizeType(type: string): DataSourceType {
    return type === 'tdengine' || type === 'td' || type === 'taos' ? 'tdengine' : 'mysql';
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
}
