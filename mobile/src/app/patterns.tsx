import { useState } from 'react';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Screen,
} from '@/components/ui';

export default function PatternsScreen() {
  const [state, setState] = useState<'empty' | 'loading' | 'error'>('empty');
  return (
    <Screen>
      <Banner>UI preview only. No backend requests or staff data.</Banner>
      <Field label="Example text field" placeholder="Enter example text" />
      {state === 'empty' && (
        <EmptyState
          title="Nothing here yet"
          message="New records will appear here."
        />
      )}
      {state === 'loading' && <Loading />}
      {state === 'error' && (
        <ErrorState
          message="Example connection error."
          onRetry={() => setState('empty')}
        />
      )}
      <Button title="Show loading" onPress={() => setState('loading')} />
      <Button title="Show error" onPress={() => setState('error')} />
      <Button title="Show empty" onPress={() => setState('empty')} />
    </Screen>
  );
}
