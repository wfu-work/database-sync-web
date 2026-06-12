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
import { DataSource, SyncTemplate } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../../datasources/datasources.service';
import { SyncTasksService } from '../sync-tasks.service';
import { SyncTemplateCreateComponent } from './create/sync-template-create.component';

@Component({
  selector: 'app-sync-template-list',
  templateUrl: './sync-template-list.component.html',
  styleUrls: ['./sync-template-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class SyncTemplateListComponent implements OnInit {
  private readonly service = inject(SyncTasksService);
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly q = {
    page: 1,
    size: 10,
    keyword: '',
    mode: '',
    status: '',
  };

  protected data: SyncTemplate[] = [];
  protected dataSources: DataSource[] = [];
  protected total = 0;
  protected loading = false;
  protected statusChangingGuid = '';

  protected readonly columns: Array<STColumn<SyncTemplate>> = [
    { title: '模板', index: 'name', render: 'nameRender', width: 260 },
    { title: '同步路径', index: 'sourceTable', render: 'routeRender' },
    { title: '策略', index: 'mode', render: 'strategyRender', width: 190 },
    { title: '更新时间', index: 'updateTime', render: 'timeRender', width: 150 },
    { title: '操作', render: 'actionsRender', width: 280 },
  ];

  ngOnInit(): void {
    this.loadDataSources();
    this.getData();
  }

  protected getData(): void {
    this.loading = true;
    this.service
      .templateList(this.q)
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
        error: (err) => this.message.error(err?.msg || err?.message || '读取同步模板失败'),
      });
  }

  protected openCreate(): void {
    this.openTemplateModal();
  }

  protected openEdit(item: SyncTemplate): void {
    this.openTemplateModal(item);
  }

  protected search(): void {
    this.q.page = 1;
    this.getData();
  }

  protected resetQuery(): void {
    this.q.page = 1;
    this.q.keyword = '';
    this.q.mode = '';
    this.q.status = '';
    this.getData();
  }

  protected useTemplate(item: SyncTemplate): void {
    if (item.status !== 1) {
      this.message.warning('请先启用模板后再用于新建同步任务');
      return;
    }
    this.router.navigate(['/sync/tasks/create'], { state: { template: item } });
  }

  protected toggleStatus(item: SyncTemplate): void {
    const nextStatus = item.status === 1 ? 0 : 1;
    this.statusChangingGuid = item.guid;
    this.service
      .updateTemplateStatus(item.guid, nextStatus)
      .pipe(
        finalize(() => {
          this.statusChangingGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success(nextStatus === 1 ? '同步模板已启用' : '同步模板已禁用');
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '更新同步模板状态失败'),
      });
  }

  protected remove(item: SyncTemplate): void {
    this.modal.confirm({
      nzTitle: '删除同步模板',
      nzContent: `确定删除「${item.name}」吗？已创建的同步任务不会受影响。`,
      nzOkDanger: true,
      nzOkText: '删除',
      nzCancelText: '取消',
      nzOnOk: () =>
        this.service.deleteTemplate(item.guid).subscribe({
          next: () => {
            this.message.success('同步模板已删除');
            this.getData();
          },
          error: (err) => this.message.error(err?.msg || err?.message || '删除同步模板失败'),
        }),
    });
  }

  protected sourceName(guid: string): string {
    return this.dataSources.find((item) => item.guid === guid)?.name || guid || '-';
  }

  protected modeLabel(mode: string): string {
    return mode === 'incremental' ? '增量' : '全量';
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

  private openTemplateModal(template?: SyncTemplate): void {
    const ref = this.modal.create({
      nzTitle: template ? '编辑同步模板' : '新建同步模板',
      nzContent: SyncTemplateCreateComponent,
      nzData: { template },
      nzFooter: null,
      nzWidth: 920,
      nzMaskClosable: false,
    });
    ref.afterClose.subscribe((saved) => {
      if (!saved) return;
      this.q.page = 1;
      this.getData();
    });
  }

  private loadDataSources(): void {
    this.dataSourcesService.list({ all: true }).subscribe({
      next: (res) => {
        this.dataSources = res.data ?? [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.dataSources = [];
        this.cdr.markForCheck();
      },
    });
  }
}
