import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { STChange, STColumn, STColumnTag } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { ClientsService, CreateClientResult, RelayClient } from '../clients.service';

interface SecretView {
  title: string;
  clientId: string;
  clientSecret: string;
  clientType: string;
  accountGuid?: string;
}

@Component({
  selector: 'app-client-list',
  templateUrl: './client-list.component.html',
  styleUrls: ['./client-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class ClientListComponent implements OnInit {
  private readonly clientsService = inject(ClientsService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  q = {
    page: 1,
    size: 10,
    enabled: '' as '' | 0 | 1,
    content: '',
  };

  protected data: RelayClient[] = [];
  protected loading = false;
  protected secretVisible = false;
  protected totalCount = 0;
  protected secretView: SecretView | null = null;
  protected readonly statusTag: STColumnTag = {
    1: { text: '活跃', color: 'green' },
    2: { text: '启用', color: 'green' },
    3: { text: '启用', color: 'green' },
    4: { text: '已吊销', color: 'red' },
    5: { text: '已过期', color: 'gold' },
    6: { text: '额度用尽', color: 'gold' },
  };
  protected readonly typeTag: STColumnTag = {
    bridge: { text: 'Bridge', color: 'blue' },
    app: { text: 'App', color: 'green' },
  };
  protected readonly columns: Array<STColumn<RelayClient>> = [
    { title: '客户端', index: 'name', render: 'clientRender' },
    { title: '类型', index: 'clientType', type: 'tag', tag: this.typeTag, width: 96 },
    { title: '账号名称', index: 'accountName', render: 'accountRender' },
    { title: '平台 / 版本', index: 'platform', render: 'platformRender' },
    { title: '状态', index: 'status', type: 'tag', tag: this.statusTag, width: 92 },
    { title: '最近在线', index: 'lastSeenAt', render: 'lastSeenRender' },
    {
      title: '创建时间',
      index: 'createTime',
      type: 'date',
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
    },
    {
      title: '操作',
      width: 168,
      buttons: [
        {
          icon: 'eye',
          tooltip: '详情',
          click: (item) => this.router.navigate(['/clients/detail', item.guid]),
        },
        {
          icon: 'edit',
          tooltip: '编辑',
          click: (item) => this.router.navigate(['/clients/edit', item.guid]),
        },
        {
          icon: 'reload',
          tooltip: '轮换密钥',
          click: (item) => this.rotateSecret(item),
          pop: {
            title: '轮换后旧密钥会立即失效，确定继续？',
            okType: 'primary',
            icon: 'reload',
          },
        },
        {
          icon: 'delete',
          tooltip: '吊销',
          className: 'text-error',
          click: (item) => this.revoke(item),
          pop: {
            title: '吊销后该客户端无法继续接入，确定吊销？',
            okType: 'danger',
            icon: 'delete',
          },
        },
      ],
    },
  ];

  ngOnInit(): void {
    this.getData();
  }

  protected getData(): void {
    this.loading = true;
    this.clientsService
      .list(this.q.page, this.q.size, this.q.content.trim(), this.q.enabled)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.data = res.data ?? [];
        this.totalCount = res.total ?? 0;
        this.q.page = res.page || this.q.page;
        this.q.size = res.size || this.q.size;
      });
  }

  protected rotateSecret(client: RelayClient): void {
    this.clientsService.rotateSecret(client.guid).subscribe((res) => {
      this.showSecret(
        '客户端密钥已轮换',
        {
          accountGuid: client.accountGuid,
          clientGuid: client.guid,
          clientId: client.clientId,
          clientSecret: res.clientSecret,
        },
        client.clientType,
      );
      this.message.success('密钥已轮换，请及时更新客户端配置');
    });
  }

  protected revoke(client: RelayClient): void {
    this.clientsService.revoke(client.guid).subscribe(() => {
      this.message.success('客户端已吊销');
      this.getData();
    });
  }

  protected closeSecret(): void {
    this.secretVisible = false;
    this.secretView = null;
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

  protected sampleUrl(): string {
    const secret = this.secretView;
    if (!secret) return '';
    const protocol = globalThis.location?.protocol === 'https:' ? 'wss' : 'ws';
    const host = globalThis.location?.host || '<host>:8787';
    const type = secret.clientType || 'bridge';
    return `${protocol}://${host}/relay/<roomId>?clientId=${secret.clientId}&clientType=${type}&timestamp=<unixSeconds>&nonce=<random>&signature=<hmac_sha256>`;
  }

  protected async copy(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.message.success(`${label}已复制`);
    } catch {
      this.message.warning('当前浏览器不允许自动复制，请手动选择文本');
    }
  }

  private showSecret(title: string, result: CreateClientResult, clientType: string): void {
    this.secretView = {
      title,
      clientId: result.clientId,
      clientSecret: result.clientSecret,
      clientType,
      accountGuid: result.accountGuid,
    };
    this.secretVisible = true;
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
