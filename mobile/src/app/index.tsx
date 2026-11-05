import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Screen,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';

export default function HomeScreen() {
  const auth = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearSecrets() {
    setPassword('');
    setConfirmation('');
    setCode('');
  }
  async function submit() {
    setError(null);
    if (accepting && password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (accepting) await auth.acceptInvitation(code, password);
      else await auth.signIn(email, password);
      clearSecrets();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await auth.signOut();
      clearSecrets();
      setAccepting(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Sign-out failed. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (auth.loading)
    return (
      <Screen>
        <Loading label="Checking your session…" />
      </Screen>
    );
  if (auth.error)
    return (
      <Screen>
        <ErrorState message={auth.error} onRetry={() => void auth.restore()} />
      </Screen>
    );
  if (auth.user)
    return (
      <Screen>
        <Banner>
          Welcome, {auth.user.full_name} · {auth.user.role}
        </Banner>
        <EmptyState
          title="Your staff account is ready"
          message="The heritage collection will appear here when records and search are connected."
        />
        {error ? <ErrorState message={error} /> : null}
        {auth.user.role === 'admin' ? (
          <Button
            title="Invite staff"
            onPress={() => router.push('/invite')}
            disabled={busy}
          />
        ) : null}
        <Button
          title="Sign out"
          onPress={() => void signOut()}
          loading={busy}
        />
        <Button
          title="Preview shared components"
          onPress={() => router.push('/patterns')}
          disabled={busy}
        />
      </Screen>
    );
  return (
    <Screen>
      <EmptyState
        title={accepting ? 'Accept your invitation' : 'Staff sign-in'}
        message={
          accepting
            ? 'Enter the one-time code from your administrator and choose a password.'
            : 'Sign in with your invited staff account.'
        }
      />
      {accepting ? (
        <Field
          label="Invitation code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />
      ) : (
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!busy}
        />
      )}
      <Field
        label={accepting ? 'New password' : 'Password'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={accepting ? 'new-password' : 'current-password'}
        editable={!busy}
      />
      {accepting ? (
        <>
          <Text style={{ color: theme.colors.muted }}>
            Use at least 8 characters. Avoid common passwords and your personal
            details.
          </Text>
          <Field
            label="Confirm password"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
        </>
      ) : null}
      {error ? <ErrorState message={error} /> : null}
      <Button
        title={accepting ? 'Activate account' : 'Sign in'}
        onPress={() => void submit()}
        loading={busy}
        disabled={
          !password ||
          (accepting ? !code.trim() || !confirmation : !email.trim())
        }
      />
      <Button
        title={accepting ? 'Back to sign-in' : 'I have an invitation code'}
        disabled={busy}
        onPress={() => {
          setAccepting(!accepting);
          setError(null);
          clearSecrets();
        }}
      />
    </Screen>
  );
}
