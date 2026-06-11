import {
  EnvironmentProviders,
  Injectable,
  Provider,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { ACLService } from '@delon/acl';
import { MenuService, SettingsService, TitleService } from '@delon/theme';
import { Observable, of } from 'rxjs';

/**
 * Used for application startup
 * Generally used to get the basic data of the application, like: Menu Data, User Data, etc.
 */
export function provideStartup(): Array<Provider | EnvironmentProviders> {
  return [
    StartupService,
    provideAppInitializer(() => {
      const initializerFn = (
        (startupService: StartupService) => () =>
          startupService.load()
      )(inject(StartupService));
      return initializerFn();
    }),
  ];
}

@Injectable()
export class StartupService {
  private menuService = inject(MenuService);
  private settingService = inject(SettingsService);
  private aclService = inject(ACLService);
  private titleService = inject(TitleService);

  load(): Observable<void> {
    this.menuService.clear();
    this.settingService.setApp({
      title: 'DataSync',
      copyright: '武汉小兮科技',
      version: 'V1.0.0',
    });
    this.titleService.suffix = 'DataSync';
    this.settingService.setUser({
      name: 'DataSync Admin',
      avatar: 'assets/avatar.gif',
      roleCodeList: ['ADMIN'],
      abilities: [],
    });
    this.aclService.setFull(true);
    return of(undefined);
  }
}
