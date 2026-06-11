import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { ClientsService, RelayClient } from '../clients.service';

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class ClientDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientsService = inject(ClientsService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected loading = false;
  protected secretVisible = false;
  protected client: RelayClient | null = null;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const guid = this.route.snapshot.paramMap.get('guid');
    if (!guid) return;
    this.loading = true;
    this.clientsService
      .get(guid)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.client = res;
      });
  }

  protected back(): void {
    this.router.navigate(['/clients/list']);
  }

  protected edit(): void {
    if (this.client) this.router.navigate(['/clients/edit', this.client.guid]);
  }

  protected maskedSecret(): string {
    const secret = this.client?.clientSecret || '';
    if (!secret) return '-';
    if (this.secretVisible) return secret;
    return `${secret.slice(0, 8)}${'•'.repeat(24)}${secret.slice(-8)}`;
  }

  protected sampleUrl(): string {
    const client = this.client;
    if (!client) return '';
    const protocol = globalThis.location?.protocol === 'https:' ? 'wss' : 'ws';
    const host = globalThis.location?.host || '<host>:8787';
    return `${protocol}://${host}/relay/<roomId>?clientId=${client.clientId}&clientType=${client.clientType}&timestamp=<unixSeconds>&nonce=<random>&signature=<hmac_sha256>`;
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
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      this.message.success(`${label}已复制`);
    } catch {
      this.message.warning('当前浏览器不允许自动复制，请手动选择文本');
    }
  }
}
