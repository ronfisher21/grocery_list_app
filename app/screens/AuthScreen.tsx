import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnonymousSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) {
        setError('שגיאה בהתחברות. נסו שוב.');
        return;
      }
      onAuthSuccess();
    } catch {
      setError('שגיאה בהתחברות. נסו שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>רשימת קניות</Text>
      <Text style={styles.subtitle}>רשימה משותפת למשפחה</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleAnonymousSignIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>התחלה</Text>
        )}
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: 'Assistant_700Bold',
    fontSize: 32,
    color: '#1a1a2e',
    marginBottom: 8,
    writingDirection: 'rtl',
  },
  subtitle: {
    fontFamily: 'Assistant_400Regular',
    fontSize: 18,
    color: '#666',
    marginBottom: 48,
    writingDirection: 'rtl',
  },
  button: {
    backgroundColor: '#4a90d9',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Assistant_600SemiBold',
    fontSize: 20,
    color: '#fff',
    writingDirection: 'rtl',
  },
  error: {
    fontFamily: 'Assistant_400Regular',
    fontSize: 14,
    color: '#e74c3c',
    marginTop: 16,
    writingDirection: 'rtl',
  },
});
