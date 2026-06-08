import {
  Modal as RNModal, View, Pressable, KeyboardAvoidingView,
  Platform, type ModalProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '../../lib/utils';

interface Props extends Omit<ModalProps, 'animationType' | 'transparent'> {
  onClose?: () => void;
  variant?: 'center' | 'bottom';
  children: React.ReactNode;
  contentClassName?: string;
}

export function Modal({ onClose, variant = 'bottom', children, contentClassName, ...props }: Props) {
  return (
    <RNModal animationType="slide" transparent statusBarTranslucent {...props}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={onClose}
        />
        <View
          className={cn(
            'bg-ft-surface dark:bg-ve-surface border-t border-ft-outline-variant dark:border-ve-outline',
            variant === 'center'
              ? 'absolute left-4 right-4 top-1/4 rounded-2xl border'
              : 'rounded-t-3xl max-h-[90%]',
            contentClassName,
          )}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}
