import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/lib/theme';

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        (disabled || loading || pressed) && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.group}>
      <Text style={styles.text}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        style={[styles.input, props.style]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="alert" style={styles.error}>
        {message}
      </Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} /> : null}
    </View>
  );
}
export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={styles.group}
    >
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}
export function Banner({ children }: PropsWithChildren) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.space.large, gap: theme.space.large },
  group: { gap: theme.space.small },
  text: { color: theme.colors.text, fontSize: 16 },
  heading: { color: theme.colors.text, fontSize: 24, fontWeight: '600' },
  error: { color: theme.colors.error, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  button: {
    minHeight: 48,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  dimmed: { opacity: 0.6 },
  banner: {
    padding: theme.space.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },
});
