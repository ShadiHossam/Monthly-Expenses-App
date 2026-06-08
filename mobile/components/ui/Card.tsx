import { View, type ViewProps } from 'react-native';
import { cn } from '../../lib/utils';

interface Props extends ViewProps {
  className?: string;
}

export function Card({ className, ...props }: Props) {
  return (
    <View
      {...props}
      className={cn(
        'bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4',
        className,
      )}
    />
  );
}
