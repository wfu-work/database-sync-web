import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { STChange, STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { EventNotification } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import {
  EventNotificationQuery,
  EventNotificationsService,
} from '../../../shared/services/event-notifications.service';

@Component({
  selector: 'app-notification-center',
  templateUrl: './notification-center.component.html',
  styleUrls: ['./notification-center.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class NotificationCenterComponent implements OnInit {
  private readonly service = inject(EventNotificationsService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly q: EventNotificationQuery = {
    page: 1,
    size: 10,
    keyword: '',
    level: '',
    sourceType: '',
    read: '',
  };

  protected data: EventNotification[] = [];
  protected total = 0;
  protected loading = false;
  protected markingGuid = '';
  protected markingAll = false;
  protected readonly columns: Array<STColumn<EventNotification>> = [
    { title: '通知', index: 'title', render: 'titleRender' },
    { title: '级别', index: 'level', render: 'levelRender', width: 100 },
    { title: '来源', index: 'sourceType', render: 'sourceRender', width: 180 },
    { title: '状态', index: 'read', render: 'readRender', width: 100 },
    { title: '时间', index: 'eventTime', render: 'timeRender', width: 150 },
    { title: '操作', render: 'actionsRender', width: 120 },
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
        error: (err) => this.message.error(err?.msg || err?.message || '读取通知失败'),
      });
  }

  protected search(): void {
    this.q.page = 1;
    this.getData();
  }

  protected resetQuery(): void {
    this.q.page = 1;
    this.q.keyword = '';
    this.q.level = '';
    this.q.sourceType = '';
    this.q.read = '';
    this.getData();
  }

  protected markRead(item: EventNotification): void {
    if (item.read === 1) return;
    this.markingGuid = item.guid;
    this.service
      .markRead(item.guid)
      .pipe(
        finalize(() => {
          this.markingGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('已标记为已读');
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '标记已读失败'),
      });
  }

  protected markAllRead(): void {
    this.markingAll = true;
    this.service
      .markAllRead()
      .pipe(
        finalize(() => {
          this.markingAll = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('已全部标记为已读');
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '全部标记已读失败'),
      });
  }

  protected levelLabel(level: string): string {
    const map: Record<string, string> = {
      info: '信息',
      warning: '告警',
      error: '错误',
    };
    return map[level] || level || '-';
  }

  protected sourceLabel(type: string): string {
    const map: Record<string, string> = {
      backup: '数据备份',
      sync: '同步任务',
      datasource: '数据源',
    };
    return map[type] || type || '-';
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
}
