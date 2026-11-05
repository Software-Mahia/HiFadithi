import { useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Screen,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { StaffUser } from '@/lib/api';
import { theme } from '@/lib/theme';

export default function InviteScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<StaffUser['role']>('researcher');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    invitation_code: string;
    expires_at: string;
  } | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await auth.invite(email, fullName, role));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Unable to create invitation.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (auth.loading)
    return (
      <Screen>
        <Loading label="Checking access…" />
      </Screen>
    );
  if (auth.error)
    return (
      <Screen>
        <ErrorState message={auth.error} onRetry={() => void auth.restore()} />
      </Screen>
    );
  if (auth.user?.role !== 'admin') return <Redirect href="/" />;
  return (
    <Screen>
      <EmptyState
        title="Invite a staff member"
        message="The account stays inactive until the recipient accepts your one-time invitation."
      />
      <Field
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        editable={!busy}
      />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />
      <View style={{ gap: theme.space.small }}>
        <Text style={{ color: theme.colors.text }}>Role: {role}</Text>
        {(['researcher', 'curator', 'admin'] as const).map((choice) => (
          <Button
            key={choice}
            title={choice === role ? `${choice} (selected)` : choice}
            onPress={() => setRole(choice)}
            disabled={busy || choice === role}
          />
        ))}
      </View>
      {error ? <ErrorState message={error} /> : null}
      <Button
        title="Create invitation"
        onPress={() => void submit()}
        loading={busy}
        disabled={!fullName.trim() || !email.trim()}
      />
      {result ? (
        <View style={{ gap: theme.space.small }}>
          <Text style={{ color: theme.colors.text }}>
            Share this code privately with the invited staff member. It can be
            used once, within 24 hours.
          </Text>
          <Text selectable style={{ color: theme.colors.text }}>
            {result.invitation_code}
          </Text>
          <Text style={{ color: theme.colors.muted }}>
            Expires: {new Date(result.expires_at).toLocaleString()}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
