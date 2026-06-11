import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { STChange, STColumn, STColumnTag } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { AccountsService, RelayAccount } from '../accounts.service';

@Component({
  selector: 'app-account-list',
  templateUrl: './account-list.component.html',
  styleUrls: ['./account-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class AccountListComponent implements OnInit {
  private readonly accountsService = inject(AccountsService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  q = {
    page: 1,
    size: 10,
    enabled: '' as '' | 0 | 1,
    content: '',
  };

  protected data: RelayAccount[] = [];
  protected loading = false;
  protected totalCount = 0;

  protected readonly statusTag: STColumnTag = {
    1: { text: '活跃', color: 'green' },
    2: { text: '启用', color: 'green' },
    3: { text: '禁用', color: 'gold' },
  };

  protected readonly columns: Array<STColumn<RelayAccount>> = [
    { title: '账号', index: 'name', render: 'accountRender' },
    { title: '邮箱', index: 'email', render: 'emailRender' },
    { title: '手机号', index: 'phone', render: 'phoneRender', width: 140 },
    { title: '状态', index: 'status', type: 'tag', tag: this.statusTag, width: 92 },
    { title: '认证失败', index: 'authFailCount', width: 96 },
    { title: '最后活跃', index: 'lastSeenAt', render: 'lastSeenRender' },
    {
      title: '操作',
      width: 112,
      buttons: [
        {
          icon: 'check-circle',
          tooltip: '启用账号',
          iif: (item) => item.status === 3,
          click: (item) => this.enable(item),
        },
        {
          icon: 'stop',
          tooltip: '禁用账号',
          className: 'text-error',
          iif: (item) => item.status !== 3,
          click: (item) => this.disable(item),
          pop: {
            title: '禁用后该账号下客户端将无法正常接入，确定继续？',
            okType: 'danger',
            icon: 'stop',
          },
        },
      ],
    },
  ];

  ngOnInit(): void {
    this.getData();
  }

  protected get filteredData(): RelayAccount[] {
    const text = this.q.content.trim().toLowerCase();
    return this.data.filter((item) => {
      const statusMatched =
        this.q.enabled === '' ||
        (this.q.enabled === 1 && item.status !== 3) ||
        (this.q.enabled === 0 && item.status === 3);
      if (!statusMatched) return false;
      if (!text) return true;
      return [item.guid, item.name, item.email, item.phone, item.remark]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(text));
    });
  }

  protected get activeCount(): number {
    return this.data.filter((item) => item.status !== 3).length;
  }

  protected get disabledCount(): number {
    return this.data.filter((item) => item.status === 3).length;
  }

  protected get frozenCount(): number {
    return this.data.filter((item) => !!item.frozenAt).length;
  }

  protected getData(): void {
    this.loading = true;
    this.accountsService
      .list()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.data = res ?? [];
        this.totalCount = this.data.length;
      });
  }

  protected enable(item: RelayAccount): void {
    this.accountsService.enable(item.guid).subscribe(() => {
      this.message.success('账号已启用');
      this.getData();
    });
  }

  protected disable(item: RelayAccount): void {
    this.accountsService.disable(item.guid).subscribe(() => {
      this.message.success('账号已禁用');
      this.getData();
    });
  }

  protected formatTime(value?: number): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  protected async copy(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.message.success(`${label}已复制`);
    } catch {
      this.message.warning('当前浏览器不允许自动复制，请手动选择文本');
    }
  }

  tableChange(event: STChange): void {
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
