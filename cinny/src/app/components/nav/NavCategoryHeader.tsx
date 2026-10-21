import React, { ReactNode } from 'react';
import classNames from 'classnames';
import { Header, as, toRem } from 'folds';
import * as css from './styles.css';

export type NavCategoryHeaderProps = {
  children: ReactNode;
};
export const NavCategoryHeader = as<'div', NavCategoryHeaderProps>(
  ({ className, ...props }, ref) => (
    <Header
      className={classNames(css.NavCategoryHeader, className)}
      variant="Background"
      size="300"
      {...props}
      // 分类标题栏高度按要求压到 15px（folds size=300 是 2rem，太高）；内联样式保证不被库样式覆盖
      style={{ height: toRem(15) }}
      ref={ref}
    />
  )
);
