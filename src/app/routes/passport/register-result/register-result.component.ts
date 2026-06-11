import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzResultModule } from 'ng-zorro-antd/result';

interface ClientCredential {
  accountGuid: string;
  clientGuid: string;
  clientId: string;
  clientSecret: string;
}

@Component({
  selector: 'passport-register-result',
  templateUrl: './register-result.component.html',
  styleUrls: ['./register-result.component.less'],
  imports: [RouterLink, NzButtonModule, NzResultModule],
})
export class UserRegisterResultComponent {
  readonly msg = inject(NzMessageService);
  protected readonly credential = history.state?.credential as ClientCredential | undefined;
  @Input() clientId = '';

  protected get displayClientId(): string {
    return this.credential?.clientId || this.clientId || '-';
  }

  protected async copy(value: string | undefined, label: string): Promise<void> {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      this.msg.success(`${label}已复制`);
    } catch {
      this.msg.warning('当前浏览器不允许自动复制，请手动选择文本');
    }
  }
}
