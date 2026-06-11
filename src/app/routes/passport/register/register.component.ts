import { HttpClient, HttpContext } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ALLOW_ANONYMOUS } from '@delon/auth';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconDirective } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { finalize } from 'rxjs';

interface ClientRegisterResult {
  accountGuid: string;
  clientGuid: string;
  clientId: string;
  clientSecret: string;
}

@Component({
  selector: 'passport-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzGridModule,
    NzButtonModule,
    NzIconDirective,
  ],
})
export class UserRegisterComponent {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    accountGuid: [''],
    accountName: ['default', [Validators.required, Validators.maxLength(60)]],
    clientType: ['bridge', [Validators.required]],
    name: ['Relay Bridge', [Validators.required, Validators.maxLength(80)]],
    platform: ['web', [Validators.maxLength(40)]],
    version: ['1.0.0', [Validators.maxLength(40)]],
  });

  protected error = '';
  protected loading = false;

  protected submit(): void {
    this.error = '';
    Object.values(this.form.controls).forEach((control) => {
      control.markAsDirty();
      control.updateValueAndValidity();
    });
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    this.loading = true;
    this.http
      .post<ClientRegisterResult>(
        '/auth/register',
        {
          accountGuid: this.clean(value.accountGuid),
          accountName: value.accountName.trim(),
          clientType: value.clientType,
          name: value.name.trim(),
          platform: this.clean(value.platform),
          version: this.clean(value.version),
        },
        {
          context: new HttpContext().set(ALLOW_ANONYMOUS, true),
        },
      )
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (res) => {
          this.router.navigate(['passport', 'register-result'], {
            state: { credential: res },
            queryParams: { clientId: res.clientId },
          });
        },
        error: (err) => {
          this.error = err?.msg || err?.message || '创建客户端凭证失败，请检查账号信息';
          this.cdr.detectChanges();
        },
      });
  }

  private clean(value: string): string | undefined {
    const text = value.trim();
    return text ? text : undefined;
  }
}
