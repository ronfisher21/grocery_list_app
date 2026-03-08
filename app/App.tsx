import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, I18nManager, StyleSheet, Text, View } from 'react-native';

import {
  useFonts,
  Assistant_400Regular,
  Assistant_600SemiBold,
  Assistant_700Bold,
} from '@expo-google-fonts/assistant';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import GroceryListScreen from './screens/GroceryListScreen';

I18nManager.forceRTL(true);

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Assistant_400Regular,
    Assistant_600SemiBold,
    Assistant_700Bold,
  });

  useEffect(() => {
    // Set up listener FIRST so we never miss auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => setSession(s),
    );

    const init = async () => {
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (existing) {
        setSession(existing);
        setSessionLoading(false);
        return;
      }

      // No existing session — sign in anonymously
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.log('[Auth] signInAnonymously failed:', error.message);
        setAuthError('שגיאת התחברות: ' + error.message);
        setSessionLoading(false);
        return;
      }

      // Set session directly from the response to avoid race condition
      if (data.session) {
        setSession(data.session);
      }
      setSessionLoading(false);
    };

    init();

    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded || sessionLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90d9" />
      </View>
    );
  }

  if (authError) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="auto" />
        <Text style={styles.errorText}>{authError}</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color="#4a90d9" />
        <Text style={styles.loadingText}>מתחבר...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <GroceryListScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    backgroundColor: '#fdecea',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    fontFamily: 'Assistant_400Regular',
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  loadingText: {
    fontFamily: 'Assistant_400Regular',
    fontSize: 16,
    color: '#888',
    marginTop: 12,
    writingDirection: 'rtl',
  },
});
