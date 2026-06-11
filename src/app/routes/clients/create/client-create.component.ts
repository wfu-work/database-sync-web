import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import {
  ClientsService,
  CreateClientPayload,
  CreateClientResult,
  RelayClientType,
} from '../clients.service';

@Component({
  selector: 'app-client-create',
  templateUrl: './client-create.component.html',
  styleUrls: ['./client-create.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class ClientCreateComponent {
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly clientsService = inject(ClientsService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected saving = false;
  protected result: CreateClientResult | null = null;

  protected readonly form = this.fb.group({
    clientType: this.fb.control<RelayClientType>('bridge', [Validators.required]),
    name: ['', [Validators.required, Validators.maxLength(100)]],
    accountGuid: ['', [Validators.maxLength(50)]],
    accountName: ['default', [Validators.maxLength(100)]],
    platform: ['', [Validators.maxLength(50)]],
    version: ['', [Validators.maxLength(50)]],
  });

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
    this.clientsService
      .create(payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.result = res;
          this.message.success('客户端凭证已创建');
        },
        error: () => this.message.error('客户端凭证创建失败'),
      });
  }

  protected back(): void {
    this.router.navigate(['/clients/list']);
  }

  protected sampleUrl(): string {
    if (!this.result) return '';
    const protocol = globalThis.location?.protocol === 'https:' ? 'wss' : 'ws';
    const host = globalThis.location?.host || '<host>:8787';
    const clientType = this.form.getRawValue().clientType || 'bridge';
    return `${protocol}://${host}/relay/<roomId>?clientId=${this.result.clientId}&clientType=${clientType}&timestamp=<unixSeconds>&nonce=<random>&signature=<hmac_sha256>`;
  }

  protected async copy(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.message.success(`${label}已复制`);
    } catch {
      this.message.warning('当前浏览器不允许自动复制，请手动选择文本');
    }
  }

  private toPayload(): CreateClientPayload {
    const value = this.form.getRawValue();
    return {
      clientType: value.clientType,
      name: value.name.trim(),
      accountGuid: this.clean(value.accountGuid),
      accountName: this.clean(value.accountName) || 'default',
      platform: this.clean(value.platform),
      version: this.clean(value.version),
    };
  }

  private clean(value: string): string | undefined {
    const text = value.trim();
    return text ? text : undefined;
  }
}
