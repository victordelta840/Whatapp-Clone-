import { useEffect, useState } from 'react';

export type BreakpointTier = 'mobile' | 'tablet' | 'desktop';

function getTier(width: number): BreakpointTier {
  if (width >= 1200) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

export function useBreakpoint(): {
  tier: BreakpointTier;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
} {
  const [tier, setTier] = useState<BreakpointTier>(() =>
    typeof window !== 'undefined' ? getTier(window.innerWidth) : 'desktop',
  );
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(pointer: coarse)').matches
      : false,
  );

  useEffect(() => {
    const onResize = () => setTier(getTier(window.innerWidth));
    const mq = window.matchMedia('(pointer: coarse)');
    const onPointerChange = () => setIsTouchDevice(mq.matches);

    window.addEventListener('resize', onResize);
    mq.addEventListener('change', onPointerChange);
    return () => {
      window.removeEventListener('resize', onResize);
      mq.removeEventListener('change', onPointerChange);
    };
  }, []);

  return {
    tier,
    isMobile: tier === 'mobile',
    isTablet: tier === 'tablet',
    isDesktop: tier === 'desktop',
    isTouchDevice,
  };
}
