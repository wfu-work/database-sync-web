import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'logo',
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="DataSync logo"
    >
      <defs>
        <linearGradient
          id="dataSyncLogoShell"
          x1="154"
          y1="96"
          x2="870"
          y2="928"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#f8fbff" />
          <stop offset=".52" stop-color="#edf4ff" />
          <stop offset="1" stop-color="#dffdf4" />
        </linearGradient>
        <linearGradient
          id="dataSyncLogoPrimary"
          x1="318"
          y1="250"
          x2="716"
          y2="762"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="var(--nm-primary-hover)" />
          <stop offset=".48" stop-color="var(--nm-primary)" />
          <stop offset="1" stop-color="var(--nm-primary-active)" />
        </linearGradient>
        <linearGradient
          id="dataSyncLogoAccent"
          x1="274"
          y1="742"
          x2="750"
          y2="284"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#0aa36d" />
          <stop offset="1" stop-color="#5eead4" />
        </linearGradient>
        <radialGradient id="dataSyncLogoGlow" cx="35%" cy="24%" r="70%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".95" />
          <stop offset=".5" stop-color="#ffffff" stop-opacity=".28" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
        <filter
          id="dataSyncLogoShadow"
          x="-28%"
          y="-28%"
          width="156%"
          height="156%"
          color-interpolation-filters="sRGB"
        >
          <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#263dd8" flood-opacity=".3" />
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0aa36d" flood-opacity=".16" />
        </filter>
        <filter
          id="dataSyncLogoShellShadow"
          x="-18%"
          y="-18%"
          width="136%"
          height="136%"
          color-interpolation-filters="sRGB"
        >
          <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#2440d8" flood-opacity=".14" />
          <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#0aa36d" flood-opacity=".12" />
        </filter>
      </defs>

      <rect
        x="34"
        y="34"
        width="956"
        height="956"
        rx="244"
        fill="url(#dataSyncLogoShell)"
        filter="url(#dataSyncLogoShellShadow)"
      />
      <rect
        x="70"
        y="70"
        width="884"
        height="884"
        rx="204"
        fill="none"
        stroke="#ffffff"
        stroke-width="24"
        stroke-opacity=".9"
      />
      <rect
        x="86"
        y="86"
        width="852"
        height="852"
        rx="190"
        fill="none"
        stroke="url(#dataSyncLogoAccent)"
        stroke-width="10"
        stroke-opacity=".28"
      />

      <g filter="url(#dataSyncLogoShadow)">
        <path
          d="M314 374c49-68 123-113 206-126 93-15 187 18 250 88"
          fill="none"
          stroke="url(#dataSyncLogoPrimary)"
          stroke-width="62"
          stroke-linecap="round"
        />
        <path
          d="M744 264 810 370 690 378"
          fill="none"
          stroke="url(#dataSyncLogoPrimary)"
          stroke-width="62"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M710 650c-49 68-123 113-206 126-93 15-187-18-250-88"
          fill="none"
          stroke="url(#dataSyncLogoAccent)"
          stroke-width="62"
          stroke-linecap="round"
        />
        <path
          d="M280 760 214 654 334 646"
          fill="none"
          stroke="url(#dataSyncLogoAccent)"
          stroke-width="62"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <rect x="302" y="288" width="420" height="448" rx="120" fill="url(#dataSyncLogoPrimary)" />
        <path
          d="M356 350c0-48 70-86 156-86s156 38 156 86-70 86-156 86-156-38-156-86Z"
          fill="#f9fdff"
          fill-opacity=".42"
        />
        <path
          d="M360 454c31 42 87 62 152 62s121-20 152-62M360 568c31 42 87 62 152 62s121-20 152-62"
          fill="none"
          stroke="#f9fdff"
          stroke-width="42"
          stroke-linecap="round"
          stroke-opacity=".74"
        />
        <rect x="302" y="288" width="420" height="448" rx="120" fill="url(#dataSyncLogoGlow)" />
        <circle cx="512" cy="512" r="36" fill="#ffffff" fill-opacity=".96" />
        <circle cx="512" cy="512" r="12" fill="#0aa36d" />
      </g>
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: 0 0 auto;
        aspect-ratio: 1;
      }

      svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoComponent {}
