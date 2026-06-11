import { HttpEvent, HttpHandlerFn, HttpRequest, HttpResponseBase } from '@angular/common/http';
import { EnvironmentProviders, Injector, inject, provideAppInitializer } from '@angular/core';
import { DA_SERVICE_TOKEN } from '@delon/auth';
import type { NzSafeAny } from 'ng-zorro-antd/core/types';
import { BehaviorSubject, Observable, filter, switchMap, take, throwError } from 'rxjs';

import { toLogin } from './helper';

let refreshToking = false;
let refreshToken$: BehaviorSubject<NzSafeAny | null> = new BehaviorSubject<NzSafeAny | null>(null);

/**
 * 重新附加新 Token 信息
 *
 * > 由于已经发起的请求，不会再走一遍 `@delon/auth` 因此需要结合业务情况重新附加新的 Token
 */
function reAttachToken(injector: Injector, req: HttpRequest<unknown>): HttpRequest<unknown> {
  const token = injector.get(DA_SERVICE_TOKEN).get()?.token;
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function refreshTokenRequest(injector: Injector): Observable<NzSafeAny> {
  toLogin(injector);
  return throwError(() => new Error('relay-go 当前未提供 refresh token 接口'));
}

/**
 * 刷新Token方式一：使用 401 重新刷新 Token
 */
export function tryRefreshToken(
  injector: Injector,
  ev: HttpResponseBase,
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  // 1、若请求为刷新Token请求，表示来自刷新Token可以直接跳转登录页
  // 1、如果 `refreshToking` 为 `true` 表示已经在请求刷新 Token 中，后续所有请求转入等待状态，直至结果返回后再重新发起请求
  if (refreshToking) {
    return refreshToken$.pipe(
      filter((v) => !!v),
      take(1),
      switchMap(() => next(reAttachToken(injector, req))),
    );
  }
  // 2、relay-go 暂未提供 refresh token 接口，配置打开时直接回登录页
  refreshToking = true;
  refreshToken$.next(null);

  refreshToking = false;
  return refreshTokenRequest(injector).pipe(switchMap(() => next(req)));
}

function buildAuthRefresh(injector: Injector): void {
  const tokenSrv = injector.get(DA_SERVICE_TOKEN);
  tokenSrv.refresh
    .pipe(
      filter(() => !refreshToking),
      switchMap(() => {
        refreshToking = true;
        return refreshTokenRequest(injector);
      }),
    )
    .subscribe({
      next: (res) => {
        refreshToking = false;
        tokenSrv.set(res);
      },
      error: () => {
        refreshToking = false;
        toLogin(injector);
      },
    });
}

/**
 * 刷新Token方式二：使用 `@delon/auth` 的 `refresh` 接口，需要在 `app.config.ts` 中注册 `provideBindAuthRefresh`
 */
export function provideBindAuthRefresh(): EnvironmentProviders[] {
  return [
    provideAppInitializer(() => {
      const initializerFn = (
        (injector: Injector) => () =>
          buildAuthRefresh(injector)
      )(inject(Injector));
      return initializerFn();
    }),
  ];
}
