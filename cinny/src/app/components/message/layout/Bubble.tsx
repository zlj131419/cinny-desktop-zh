import React, { ReactNode } from 'react';
import classNames from 'classnames';
import { Box, ContainerColor, as, color } from 'folds';
import * as css from './layout.css';

type BubbleArrowProps = {
  variant: ContainerColor;
};
function BubbleLeftArrow({ variant }: BubbleArrowProps) {
  return (
    <svg
      className={css.BubbleLeftArrow}
      width="9"
      height="8"
      viewBox="0 0 9 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.00004 8V0H4.82847C3.04666 0 2.15433 2.15428 3.41426 3.41421L8.00004 8H9.00004Z"
        fill={color[variant].Container}
      />
    </svg>
  );
}

function BubbleRightArrow({ variant }: BubbleArrowProps) {
  return (
    <svg
      className={css.BubbleRightArrow}
      width="9"
      height="8"
      viewBox="0 0 9 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.00004 8V0H4.82847C3.04666 0 2.15433 2.15428 3.41426 3.41421L8.00004 8H9.00004Z"
        fill={color[variant].Container}
      />
    </svg>
  );
}

type BubbleLayoutProps = {
  hideBubble?: boolean;
  before?: ReactNode;
  header?: ReactNode;
  alignRight?: boolean;
};

export const BubbleLayout = as<'div', BubbleLayoutProps>(
  ({ hideBubble, before, header, alignRight, children, ...props }, ref) => (
    <Box gap="300" direction={alignRight ? 'RowReverse' : 'Row'} {...props} ref={ref}>
      <Box className={css.BubbleBefore} shrink="No">
        {before}
      </Box>
      <Box grow="Yes" direction="Column" alignItems={alignRight ? 'End' : 'Start'}>
        {header}
        {hideBubble ? (
          children
        ) : (
          <Box
            justifyContent={alignRight ? 'End' : 'Start'}
            style={{ width: '100%', minWidth: 0 }}
          >
            <Box
              className={
                hideBubble
                  ? undefined
                  : classNames(
                      css.BubbleContent,
                      before && !alignRight ? css.BubbleContentArrowLeft : undefined,
                      before && alignRight ? css.BubbleContentArrowRight : undefined
                    )
              }
              direction="Column"
            >
              {before && !alignRight ? <BubbleLeftArrow variant="SurfaceVariant" /> : null}
              {before && alignRight ? <BubbleRightArrow variant="SurfaceVariant" /> : null}
              {children}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
);
