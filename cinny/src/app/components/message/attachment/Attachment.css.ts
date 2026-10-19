import { style } from '@vanilla-extract/css';
import { RecipeVariants, recipe } from '@vanilla-extract/recipes';
import { DefaultReset, color, config, toRem } from 'folds';

export const Attachment = recipe({
  base: {
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    borderRadius: config.radii.R400,
    overflow: 'hidden',
    minWidth: 0,
    width: '100%',
    maxWidth: 'min(100%, 25rem)',
  },
  variants: {
    outlined: {
      true: {
        boxShadow: `inset 0 0 0 ${config.borderWidth.B300} ${color.SurfaceVariant.ContainerLine}`,
      },
    },
  },
});

export type AttachmentVariants = RecipeVariants<typeof Attachment>;

export const AttachmentHeader = style({
  padding: config.space.S300,
});

export const AttachmentBox = style([
  DefaultReset,
  {
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    '@media': {
      'screen and (min-width: 768px)': {
        maxHeight: toRem(600),
      },
    },
  },
]);

export const AttachmentContent = style({
  padding: config.space.S300,
  paddingTop: 0,
});
