import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface Props extends Omit<PressableProps, 'style'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
}

const BASE = 'items-center justify-center rounded-xl flex-row gap-2';

const VARIANTS: Record<Variant, string> = {
  primary:     'bg-ft-primary dark:bg-ve-primary-dim',
  secondary:   'border border-ft-outline-variant dark:border-ve-outline bg-ft-surface dark:bg-ve-surface',
  ghost:       '',
  destructive: 'bg-red-500',
};

const SIZES: Record<Size, string> = {
  sm:  'px-3 py-2',
  md:  'px-5 py-3',
  lg:  'px-6 py-3.5',
};

const TEXT_STYLES: Record<Variant, string> = {
  primary:     'text-white dark:text-ve-background font-semibold',
  secondary:   'text-ft-on-surface dark:text-ve-on-surface font-semibold',
  ghost:       'text-ft-primary dark:text-ve-primary font-semibold',
  destructive: 'text-white font-semibold',
};

const TEXT_SIZES: Record<Size, string> = {
  sm:  'text-xs',
  md:  'text-sm',
  lg:  'text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => ({ opacity: pressed || isDisabled ? 0.6 : 1 })}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {loading && <ActivityIndicator size="small" color={variant === 'secondary' ? '#005e26' : 'white'} />}
      {typeof children === 'string'
        ? <Text className={cn(TEXT_STYLES[variant], TEXT_SIZES[size])}>{children}</Text>
        : children
      }
    </Pressable>
  );
}
