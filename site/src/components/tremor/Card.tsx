// Tremor Card [v0.0.2]

import React from 'react';
import { Slot } from 'radix-ui';

import { cx } from '@/lib/tremor/utils';

interface CardProps extends React.ComponentPropsWithoutRef<'div'> {
  asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, asChild, ...props }, forwardedRef) => {
    const Component = asChild ? Slot.Root : 'div';
    return (
      <Component
        ref={forwardedRef}
        className={cx(
          // base
          'relative w-full rounded-lg border p-6 text-left shadow-sm',
          // background color
          'bg-card dark:bg-[#090E1A]',
          // border color
          'border-border dark:border-gray-900',
          className,
        )}
        tremor-id="tremor-raw"
        {...props}
      />
    );
  },
);

Card.displayName = 'Card';

export { Card, type CardProps };
