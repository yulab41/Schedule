export interface MotionKeyframe {
  readonly offset: number;
  readonly transform?: string;
  readonly opacity?: number;
  readonly strokeDashoffset?: number;
}

export interface MotionPart {
  readonly partKey: string;
  readonly delayMs?: number;
  readonly keyframes: readonly MotionKeyframe[];
}

export interface MotionSpec {
  readonly key: string;
  readonly trigger: 'activate' | 'click' | 'open' | 'toggle' | 'navigate';
  readonly durationMs: number;
  readonly delayMs: number;
  readonly easing: string;
  readonly iterationCount: number | 'infinite';
  readonly direction: 'normal' | 'reverse' | 'alternate';
  readonly fillMode: 'none' | 'forwards' | 'both';
  readonly reducedMotion: 'none' | 'opacity-only' | 'allow-press-feedback';
  readonly parts: readonly MotionPart[];
}

const oneShot = (
  key: string,
  trigger: MotionSpec['trigger'],
  durationMs: number,
  easing: string,
  parts: readonly MotionPart[],
): MotionSpec => ({
  key,
  trigger,
  durationMs,
  delayMs: 0,
  easing,
  iterationCount: 1,
  direction: 'normal',
  fillMode: 'none',
  reducedMotion: 'allow-press-feedback',
  parts,
});

const loop = (key: string, parts: readonly MotionPart[], easing = 'ease-in-out'): MotionSpec => ({
  key,
  trigger: 'activate',
  durationMs: 1800,
  delayMs: 0,
  easing,
  iterationCount: 'infinite',
  direction: 'normal',
  fillMode: 'none',
  reducedMotion: 'none',
  parts,
});

export const iconMotionSpecs = {
  bell: oneShot('bell', 'open', 620, 'cubic-bezier(0.2, 0, 0, 1)', [
    {
      partKey: 'bell',
      keyframes: [
        { offset: 0, transform: 'rotate(0deg)' },
        { offset: 0.22, transform: 'rotate(-9deg)' },
        { offset: 0.44, transform: 'rotate(8deg)' },
        { offset: 0.64, transform: 'rotate(-5deg)' },
        { offset: 0.82, transform: 'rotate(3deg)' },
        { offset: 1, transform: 'rotate(0deg)' },
      ],
    },
  ]),
  profile: oneShot('profile', 'open', 480, 'cubic-bezier(0.2, 0, 0, 1)', [
    {
      partKey: 'portrait',
      keyframes: [
        { offset: 0, transform: 'translateY(0)' },
        { offset: 0.42, transform: 'translateY(-1.5px)' },
        { offset: 0.68, transform: 'translateY(0.5px)' },
        { offset: 1, transform: 'translateY(0)' },
      ],
    },
  ]),
  export: oneShot('export', 'open', 620, 'cubic-bezier(0.25, 0.8, 0.25, 1)', [
    {
      partKey: 'frame',
      keyframes: [
        { offset: 0, transform: 'translate(0)' },
        { offset: 0.36, transform: 'translate(-0.7px, 0.7px)' },
        { offset: 0.64, transform: 'translate(0.2px, -0.2px)' },
        { offset: 0.82, transform: 'translate(-0.08px, 0.08px)' },
        { offset: 1, transform: 'translate(0)' },
      ],
    },
    {
      partKey: 'arrow',
      keyframes: [
        { offset: 0, transform: 'translate(0)' },
        { offset: 0.4, transform: 'translate(2.2px, -2.2px)' },
        { offset: 0.64, transform: 'translate(-0.3px, 0.3px)' },
        { offset: 0.82, transform: 'translate(0.16px, -0.16px)' },
        { offset: 1, transform: 'translate(0)' },
      ],
    },
  ]),
  filter: oneShot('filter', 'open', 520, 'cubic-bezier(0.2, 0, 0, 1)', [
    {
      partKey: 'filter-top',
      keyframes: [
        { offset: 0, transform: 'translateX(0)' },
        { offset: 0.46, transform: 'translateX(2px)' },
        { offset: 1, transform: 'translateX(0)' },
      ],
    },
    {
      partKey: 'filter-middle',
      keyframes: [
        { offset: 0, transform: 'translateX(0)' },
        { offset: 0.46, transform: 'translateX(-2px)' },
        { offset: 1, transform: 'translateX(0)' },
      ],
    },
    {
      partKey: 'filter-bottom',
      keyframes: [
        { offset: 0, transform: 'translateX(0)' },
        { offset: 0.46, transform: 'translateX(1px)' },
        { offset: 1, transform: 'translateX(0)' },
      ],
    },
  ]),
  locate: oneShot('locate', 'click', 520, 'cubic-bezier(0.2, 0, 0, 1)', [
    {
      partKey: 'rotor',
      keyframes: [
        { offset: 0, transform: 'rotate(0deg)' },
        { offset: 1, transform: 'rotate(90deg)' },
      ],
    },
  ]),
  department: oneShot('department', 'toggle', 500, 'cubic-bezier(0.2, 0, 0, 1)', [
    {
      partKey: 'rotor',
      keyframes: [
        { offset: 0, transform: 'rotate(0deg)' },
        { offset: 1, transform: 'rotate(90deg)' },
      ],
    },
  ]),
  people: oneShot('people', 'toggle', 520, 'cubic-bezier(0.2, 0, 0, 1)', [
    {
      partKey: 'primary',
      keyframes: [
        { offset: 0, transform: 'translateX(0)' },
        { offset: 0.46, transform: 'translateX(-0.75px)' },
        { offset: 1, transform: 'translateX(0)' },
      ],
    },
    {
      partKey: 'secondary',
      keyframes: [
        { offset: 0, transform: 'translateX(0)' },
        { offset: 0.46, transform: 'translateX(1px)' },
        { offset: 1, transform: 'translateX(0)' },
      ],
    },
  ]),
  phone: oneShot('phone', 'click', 620, 'cubic-bezier(0.2, 0, 0, 1)', [
    {
      partKey: 'phone-body',
      keyframes: [
        { offset: 0, transform: 'rotate(0deg)' },
        { offset: 0.26, transform: 'rotate(-8deg)' },
        { offset: 0.52, transform: 'rotate(7deg)' },
        { offset: 0.74, transform: 'rotate(-3deg)' },
        { offset: 1, transform: 'rotate(0deg)' },
      ],
    },
  ]),
  navigation: loop('navigation', [
    {
      partKey: 'check',
      keyframes: [
        { offset: 0, opacity: 0.3, strokeDashoffset: 1 },
        { offset: 0.5, opacity: 1, strokeDashoffset: 0 },
        { offset: 1, opacity: 0.3, strokeDashoffset: 1 },
      ],
    },
  ]),
  'navigation-enter': loop(
    'navigation-enter',
    [
      {
        partKey: 'actor',
        keyframes: [
          { offset: 0, opacity: 0.45, transform: 'translateX(-2px)' },
          { offset: 0.5, opacity: 1, transform: 'translateX(0)' },
          { offset: 1, opacity: 0.45, transform: 'translateX(-2px)' },
        ],
      },
    ],
    'cubic-bezier(0.2, 0, 0, 1)',
  ),
  'navigation-column': loop(
    'navigation-column',
    [
      {
        partKey: 'column',
        keyframes: [
          { offset: 0, transform: 'translateX(0)' },
          { offset: 0.5, transform: 'translateX(-3px)' },
          { offset: 1, transform: 'translateX(0)' },
        ],
      },
    ],
    'cubic-bezier(0.2, 0, 0, 1)',
  ),
  'navigation-rewind': loop(
    'navigation-rewind',
    [
      {
        partKey: 'clock-hands',
        keyframes: [
          { offset: 0, transform: 'rotate(0deg)' },
          { offset: 1, transform: 'rotate(-360deg)' },
        ],
      },
    ],
    'linear',
  ),
  'navigation-swap': loop(
    'navigation-swap',
    [
      {
        partKey: 'arrow-left',
        keyframes: [
          { offset: 0, transform: 'translateX(0)' },
          { offset: 0.25, transform: 'translateX(-2px)' },
          { offset: 0.5, transform: 'translateX(0)' },
          { offset: 0.75, transform: 'translateX(1px)' },
          { offset: 1, transform: 'translateX(0)' },
        ],
      },
      {
        partKey: 'arrow-right',
        keyframes: [
          { offset: 0, transform: 'translateX(0)' },
          { offset: 0.25, transform: 'translateX(2px)' },
          { offset: 0.5, transform: 'translateX(0)' },
          { offset: 0.75, transform: 'translateX(-1px)' },
          { offset: 1, transform: 'translateX(0)' },
        ],
      },
    ],
    'cubic-bezier(0.2, 0, 0, 1)',
  ),
  'navigation-duty': loop('navigation-duty', [
    {
      partKey: 'plus-minus',
      keyframes: [
        { offset: 0, opacity: 0.55 },
        { offset: 0.5, opacity: 1 },
        { offset: 1, opacity: 0.55 },
      ],
    },
  ]),
  'navigation-events': loop('navigation-events', [
    {
      partKey: 'event-dots',
      keyframes: [
        { offset: 0, transform: 'translateY(-7px)' },
        { offset: 0.5, transform: 'translateY(7px)' },
        { offset: 1, transform: 'translateY(-7px)' },
      ],
    },
  ]),
  'navigation-bell': loop('navigation-bell', [
    {
      partKey: 'bell',
      keyframes: [
        { offset: 0, transform: 'rotate(0deg)' },
        { offset: 0.2, transform: 'rotate(-8deg)' },
        { offset: 0.4, transform: 'rotate(7deg)' },
        { offset: 0.6, transform: 'rotate(-4deg)' },
        { offset: 0.8, transform: 'rotate(2deg)' },
        { offset: 1, transform: 'rotate(0deg)' },
      ],
    },
  ]),
  'navigation-profile': loop(
    'navigation-profile',
    [
      {
        partKey: 'portrait',
        keyframes: [
          { offset: 0, transform: 'translateY(0)' },
          { offset: 0.5, transform: 'translateY(-1.5px)' },
          { offset: 1, transform: 'translateY(0)' },
        ],
      },
    ],
    'cubic-bezier(0.2, 0, 0, 1)',
  ),
  'navigation-gear': loop(
    'navigation-gear',
    [
      {
        partKey: 'gear',
        keyframes: [
          { offset: 0, transform: 'rotate(0deg)' },
          { offset: 1, transform: 'rotate(360deg)' },
        ],
      },
    ],
    'linear',
  ),
  'more-stagger': {
    ...loop('more-stagger', []),
    parts: [
      {
        partKey: 'dot-one',
        keyframes: [
          { offset: 0, transform: 'translateY(0)' },
          { offset: 0.5, transform: 'translateY(-2px)' },
          { offset: 1, transform: 'translateY(0)' },
        ],
      },
      {
        partKey: 'dot-two',
        delayMs: 100,
        keyframes: [
          { offset: 0, transform: 'translateY(0)' },
          { offset: 0.5, transform: 'translateY(-2px)' },
          { offset: 1, transform: 'translateY(0)' },
        ],
      },
      {
        partKey: 'dot-three',
        delayMs: 200,
        keyframes: [
          { offset: 0, transform: 'translateY(0)' },
          { offset: 0.5, transform: 'translateY(-2px)' },
          { offset: 1, transform: 'translateY(0)' },
        ],
      },
    ],
  },
  'navigation-logout': loop(
    'navigation-logout',
    [
      {
        partKey: 'logout-arrow',
        keyframes: [
          { offset: 0, opacity: 0.55, transform: 'translateX(0)' },
          { offset: 0.5, opacity: 1, transform: 'translateX(3px)' },
          { offset: 1, opacity: 0.55, transform: 'translateX(0)' },
        ],
      },
    ],
    'cubic-bezier(0.2, 0, 0, 1)',
  ),
  'period-chevron': oneShot('period-chevron', 'navigate', 260, 'cubic-bezier(0.2, 0, 0, 1)', [
    {
      partKey: 'right',
      keyframes: [
        { offset: 0, transform: 'translateX(0)' },
        { offset: 0.48, transform: 'translateX(2px)' },
        { offset: 1, transform: 'translateX(0)' },
      ],
    },
    {
      partKey: 'left',
      keyframes: [
        { offset: 0, transform: 'translateX(0)' },
        { offset: 0.48, transform: 'translateX(-2px)' },
        { offset: 1, transform: 'translateX(0)' },
      ],
    },
  ]),
  'calendar-chevron': oneShot('calendar-chevron', 'navigate', 240, 'cubic-bezier(0.2, 0, 0, 1)', [
    {
      partKey: 'right',
      keyframes: [
        { offset: 0, transform: 'translateX(0)' },
        { offset: 0.48, transform: 'translateX(2px)' },
        { offset: 1, transform: 'translateX(0)' },
      ],
    },
    {
      partKey: 'left',
      keyframes: [
        { offset: 0, transform: 'translateX(0)' },
        { offset: 0.48, transform: 'translateX(-2px)' },
        { offset: 1, transform: 'translateX(0)' },
      ],
    },
  ]),
  'navigation-press': oneShot('navigation-press', 'click', 120, 'ease', [
    {
      partKey: 'item',
      keyframes: [
        { offset: 0, transform: 'scale(1)' },
        { offset: 1, transform: 'scale(0.98)' },
      ],
    },
  ]),
} as const satisfies Readonly<Record<string, MotionSpec>>;
