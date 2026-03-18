import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native'
import { useAuthStore } from '../../store/authStore'

const C = {
  primary:   '#1D9E75',
  bg:        '#FFFFFF',
  surface:   '#F5F5F0',
  border:    '#E0DED6',
  text:      '#1A1A18',
  muted:     '#6B6B66',
  danger:    '#E24B4A',
}

// ─── Tenant Slug Screen ───────────────────────────────────────
export function TenantSlugScreen({ navigation }: any) {
  const [slug, setSlug]      = useState('')
  const { setTenantSlug }    = useAuthStore()

  const handleContinue = () => {
    const trimmed = slug.trim().toLowerCase()
    if (!trimmed) return Alert.alert('Required', 'Please enter your campaign slug')
    setTenantSlug(trimmed)
    navigation.navigate('Phone')
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.center} keyboardShouldPersistTaps="handled">
        <View style={s.logo}><View style={s.logoInner} /></View>
        <Text style={s.appTitle}>GHMC Campaign</Text>
        <Text style={s.appSub}>Election management platform</Text>

        <View style={s.card}>
          <Text style={s.label}>Your campaign slug</Text>
          <TextInput
            style={s.input}
            value={slug}
            onChangeText={setSlug}
            placeholder="e.g. bjp-ward42"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          <Text style={s.hint}>Provided by your campaign coordinator</Text>
          <TouchableOpacity style={s.btn} onPress={handleContinue}>
            <Text style={s.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.footer}>Don't have a slug? Contact your party admin</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Phone Screen ────────────────────────────────────────────
export function PhoneScreen({ navigation }: any) {
  const [phone, setPhone]             = useState('')
  const { requestOtp, isLoading, error, tenantSlug } = useAuthStore()

  const handleSend = async () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 10) return Alert.alert('Invalid', 'Enter a valid 10-digit mobile number')
    try {
      await requestOtp(cleaned, tenantSlug)
      navigation.navigate('Otp', { phone: cleaned })
    } catch { /* error shown from store */ }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.center} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Enter your phone</Text>
        <Text style={s.sub}>{tenantSlug} campaign</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.card}>
          <Text style={s.label}>Mobile number</Text>
          <View style={s.phoneRow}>
            <View style={s.countryCode}><Text style={s.countryText}>+91</Text></View>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="98765 43210"
              placeholderTextColor={C.muted}
              keyboardType="phone-pad"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleSend}
            />
          </View>
          <Text style={s.hint}>An OTP will be sent to this number</Text>
          <TouchableOpacity style={[s.btn, isLoading && s.btnDisabled]} onPress={handleSend} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send OTP</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── OTP Screen ───────────────────────────────────────────────
export function OtpScreen({ route, navigation }: any) {
  const { phone }                       = route.params
  const [otp, setOtp]                   = useState('')
  const { verifyOtp, isLoading, error, tenantSlug, requestOtp } = useAuthStore()

  const handleVerify = async () => {
    if (otp.length !== 6) return Alert.alert('Invalid', 'Enter the 6-digit OTP')
    try {
      await verifyOtp(phone, otp, tenantSlug)
      // Navigation handled by AppNavigator when user is set
    } catch { /* error shown from store */ }
  }

  const handleResend = async () => {
    try {
      await requestOtp(phone, tenantSlug)
      Alert.alert('Sent', 'A new OTP has been sent')
    } catch {}
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.center} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Verify OTP</Text>
        <Text style={s.sub}>Sent to +91 {phone}</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.card}>
          <Text style={s.label}>6-digit code</Text>
          <TextInput
            style={[s.input, s.otpInput]}
            value={otp}
            onChangeText={setOtp}
            placeholder="— — — — — —"
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handleVerify}
          />
          <TouchableOpacity style={[s.btn, isLoading && s.btnDisabled]} onPress={handleVerify} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.resendBtn} onPress={handleResend}>
            <Text style={s.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  center:      { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 60 },
  logo:        { width: 56, height: 56, borderRadius: 16, backgroundColor: C.primary,
                 alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  logoInner:   { width: 26, height: 26, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.9)' },
  appTitle:    { fontSize: 22, fontWeight: '600', color: C.text, textAlign: 'center' },
  appSub:      { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 32 },
  card:        { backgroundColor: C.surface, borderRadius: 16, padding: 20,
                 borderWidth: 0.5, borderColor: C.border },
  title:       { fontSize: 20, fontWeight: '600', color: C.text, marginBottom: 4, marginTop: 20 },
  sub:         { fontSize: 13, color: C.muted, marginBottom: 24 },
  label:       { fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: '500' },
  input:       { backgroundColor: C.bg, borderRadius: 10, borderWidth: 0.5, borderColor: C.border,
                 padding: 12, fontSize: 15, color: C.text, marginBottom: 6 },
  otpInput:    { textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: '600' },
  phoneRow:    { flexDirection: 'row', gap: 8, marginBottom: 6 },
  countryCode: { backgroundColor: C.bg, borderRadius: 10, borderWidth: 0.5, borderColor: C.border,
                 padding: 12, justifyContent: 'center' },
  countryText: { fontSize: 15, color: C.text, fontWeight: '500' },
  hint:        { fontSize: 11, color: C.muted, marginBottom: 16 },
  btn:         { backgroundColor: C.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '600' },
  resendBtn:   { marginTop: 14, alignItems: 'center', padding: 8 },
  resendText:  { color: C.primary, fontSize: 13 },
  error:       { backgroundColor: '#FCEBEB', padding: 10, borderRadius: 8, marginBottom: 16,
                 color: C.danger, fontSize: 13 },
  back:        { position: 'absolute', top: 20, left: 0, padding: 8 },
  backText:    { color: C.primary, fontSize: 14 },
  footer:      { textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 20 },
})
