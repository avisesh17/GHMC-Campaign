import React, { useEffect, useState, Component } from 'react'
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

// ─── Error Boundary ───────────────────────────────────────────
class ErrorBoundary extends Component<{children: React.ReactNode}, {error: string|null}> {
  state = { error: null }
  static getDerivedStateFromError(e: any) { return { error: e?.message || String(e) } }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={eb.scroll} contentContainerStyle={eb.container}>
          <Text style={eb.title}>App Error</Text>
          <Text style={eb.msg}>{this.state.error}</Text>
          <Text style={eb.hint}>Share this message to get it fixed.</Text>
        </ScrollView>
      )
    }
    return this.props.children
  }
}

const eb = StyleSheet.create({
  scroll:     { flex: 1, backgroundColor: '#fff' },
  container:  { padding: 24, paddingTop: 60 },
  title:      { fontSize: 18, fontWeight: '600', color: '#E24B4A', marginBottom: 16 },
  msg:        { fontSize: 13, color: '#333', fontFamily: 'monospace',
                backgroundColor: '#f5f5f0', padding: 12, borderRadius: 8,
                marginBottom: 16, lineHeight: 20 },
  hint:       { fontSize: 12, color: '#888' },
})

// ─── Lazy load heavy screens to isolate crash point ───────────
let AppNavigator: any = null
let useAuthStore: any = null

function AppInner() {
  const [ready, setReady]   = useState(false)
  const [loadErr, setErr]   = useState<string|null>(null)

  useEffect(() => {
    try {
      // Dynamic require so errors surface in ErrorBoundary
      const nav  = require('./src/navigation/AppNavigator')
      const auth = require('./src/store/authStore')
      AppNavigator  = nav.AppNavigator
      useAuthStore  = auth.useAuthStore
      setReady(true)
    } catch (e: any) {
      setErr(e?.message || String(e))
    }
  }, [])

  if (loadErr) {
    return (
      <View style={s.center}>
        <Text style={s.errTitle}>Load error</Text>
        <ScrollView style={s.errScroll}>
          <Text style={s.errMsg}>{loadErr}</Text>
        </ScrollView>
      </View>
    )
  }

  if (!ready || !AppNavigator) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#1D9E75" />
        <Text style={s.loadText}>Loading GHMC Campaign...</Text>
      </View>
    )
  }

  return <AppNavigatorWithAuth />
}

function AppNavigatorWithAuth() {
  const [sessionReady, setSessionReady] = useState(false)
  const restoreSession = useAuthStore((s: any) => s.restoreSession)

  useEffect(() => {
    restoreSession().finally(() => setSessionReady(true))
  }, [])

  if (!sessionReady) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    )
  }

  return <AppNavigator />
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <ErrorBoundary>
        <AppInner />
      </ErrorBoundary>
    </SafeAreaProvider>
  )
}

const s = StyleSheet.create({
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center',
               backgroundColor: '#fff', padding: 24 },
  loadText:  { marginTop: 12, fontSize: 14, color: '#6B6B66' },
  errTitle:  { fontSize: 16, fontWeight: '600', color: '#E24B4A', marginBottom: 8 },
  errScroll: { maxHeight: 400, width: '100%' },
  errMsg:    { fontSize: 12, color: '#333', fontFamily: 'monospace',
               backgroundColor: '#f5f5f0', padding: 12, borderRadius: 8 },
})
