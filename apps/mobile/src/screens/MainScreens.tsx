import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, TextInput, ActivityIndicator, RefreshControl, Alert
} from 'react-native'
import { useAuthStore }  from '../store/authStore'
import { api }           from '../services/api'

const C = {
  primary: '#1D9E75', bg: '#FFFFFF', surface: '#F5F5F0',
  border: '#E0DED6', text: '#1A1A18', muted: '#6B6B66',
  danger: '#E24B4A', warning: '#BA7517', info: '#185FA5',
}

// ─── Dashboard Screen ─────────────────────────────────────────
export function DashboardScreen({ navigation }: any) {
  const { user }                   = useAuthStore()
  const [stats,    setStats]       = useState<any>(null)
  const [tasks,    setTasks]       = useState<any[]>([])
  const [events,   setEvents]      = useState<any[]>([])
  const [loading,  setLoading]     = useState(true)
  const [pending,  setPending]     = useState(0)
  const [syncing,  setSyncing]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, tasksRes, eventsRes] = await Promise.all([
        api.getMyStats(),
        api.getTasks(),
        api.getTodayEvents(),
      ])
      setStats(statsRes.stats)
      setTasks(tasksRes.tasks.slice(0, 3))
      setEvents(eventsRes.events.slice(0, 2))
      setPending(api.getPendingCount())
    } catch (e) { /* silently use cached */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSync = async () => {
    setSyncing(true)
    const result = await api.syncOfflineLogs()
    setSyncing(false)
    setPending(api.getPendingCount())
    Alert.alert('Sync complete', `${result.synced} log(s) synced`)
  }

  if (loading) return (
    <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>
  )

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}>

      {/* Greeting */}
      <View style={s.greeting}>
        <View>
          <Text style={s.greetName}>Good morning, {user?.name?.split(' ')[0]}!</Text>
          <Text style={s.greetSub}>
            {user?.assignedBoothId ? 'Booth 12 · Ward 42' : 'Ward 42 — Secunderabad West'}
          </Text>
        </View>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{user?.name?.slice(0,2).toUpperCase()}</Text>
        </View>
      </View>

      {/* Offline sync alert */}
      {pending > 0 && (
        <TouchableOpacity style={s.syncBanner} onPress={handleSync} disabled={syncing}>
          <View style={s.syncDot} />
          <Text style={s.syncText}>
            {syncing ? 'Syncing...' : `${pending} log(s) pending sync — tap to sync now`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Stats */}
      <View style={s.statsGrid}>
        <View style={s.stat}>
          <Text style={s.statN}>{stats?.today_visits ?? 0}</Text>
          <Text style={s.statL}>Visits today</Text>
          <View style={s.prog}><View style={[s.progF, {
            width: `${Math.min(((stats?.today_visits ?? 0) / 40) * 100, 100)}%`,
            backgroundColor: C.primary
          }]} /></View>
        </View>
        <View style={s.stat}>
          <Text style={s.statN}>{stats?.supporters_found ?? 0}</Text>
          <Text style={s.statL}>Supporters found</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statN}>{tasks.length}</Text>
          <Text style={s.statL}>Tasks due</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statN}>40</Text>
          <Text style={s.statL}>Today's target</Text>
          <View style={s.prog}><View style={[s.progF, {
            width: `${Math.min(((stats?.today_visits ?? 0) / 40) * 100, 100)}%`,
            backgroundColor: C.warning
          }]} /></View>
        </View>
      </View>

      {/* Today's events */}
      {events.length > 0 && (
        <>
          <Text style={s.sectionHead}>TODAY'S EVENTS</Text>
          {events.map(ev => (
            <View key={ev.id} style={s.eventCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.eventTitle}>{ev.title}</Text>
                <Text style={s.eventSub}>
                  {new Date(ev.scheduled_at).toLocaleTimeString('en-IN',
                    { hour: '2-digit', minute: '2-digit' })} · {ev.venue}
                </Text>
              </View>
              <View style={s.badge_s}><Text style={s.badge_s_text}>Active</Text></View>
            </View>
          ))}
        </>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <>
          <Text style={s.sectionHead}>MY TASKS</Text>
          {tasks.map(t => (
            <TouchableOpacity key={t.id} style={s.taskCard}
              onPress={() => navigation.navigate('Tasks')}>
              <View style={{ flex: 1 }}>
                <Text style={s.taskTitle}>{t.title}</Text>
                <Text style={s.taskSub}>Due {t.due_date} · Assigned by {t.assigned_by_name}</Text>
              </View>
              <View style={s.badge_w}><Text style={s.badge_w_text}>Due</Text></View>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Quick action */}
      <TouchableOpacity style={s.fabBtn}
        onPress={() => navigation.navigate('Voters', { screen: 'LogVisit', params: {} })}>
        <Text style={s.fabText}>+ Log a visit</Text>
      </TouchableOpacity>

      <View style={{ height: 20 }} />
    </ScrollView>
  )
}

// ─── Voter List Screen ────────────────────────────────────────
export function VoterListScreen({ navigation }: any) {
  const { user }                   = useAuthStore()
  const [voters,    setVoters]     = useState<any[]>([])
  const [total,     setTotal]      = useState(0)
  const [query,     setQuery]      = useState('')
  const [support,   setSupport]    = useState('')
  const [loading,   setLoading]    = useState(true)
  const [refreshing,setRefreshing] = useState(false)

  const SUPPORT_FILTERS = ['', 'supporter', 'neutral', 'opposition', 'unknown']
  const LABELS          = ['All', 'Supporter', 'Neutral', 'Opposition', 'Unknown']

  const load = useCallback(async (q = query, sp = support) => {
    setLoading(true)
    try {
      const params: any = { limit: 50 }
      if (q)  params.q       = q
      if (sp) params.support = sp
      const data = await api.getVoters(params)
      setVoters(data.voters)
      setTotal(data.total)
    } catch { /* offline — voters from cache */ }
    finally { setLoading(false) }
  }, [query, support])

  useEffect(() => { load() }, [])

  const handleSearch = (text: string) => {
    setQuery(text)
    load(text, support)
  }

  const supportColor = (s: string) => ({
    supporter: { bg: '#E1F5EE', fg: '#085041' },
    neutral:   { bg: '#FAEEDA', fg: '#633806' },
    opposition:{ bg: '#FCEBEB', fg: '#791F1F' },
    unknown:   { bg: '#F1EFE8', fg: '#444441' },
  }[s] || { bg: '#F1EFE8', fg: '#444441' })

  return (
    <View style={s.container}>
      <View style={s.headerBar}>
        <Text style={s.headerBarTitle}>Voters</Text>
        <Text style={s.headerBarSub}>{total} found</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={handleSearch}
          placeholder="Search name, voter ID, phone..."
          placeholderTextColor={C.muted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.filterScroll} contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}>
        {SUPPORT_FILTERS.map((sp, i) => (
          <TouchableOpacity key={sp}
            style={[s.filterPill, support === sp && s.filterPillActive]}
            onPress={() => { setSupport(sp); load(query, sp) }}>
            <Text style={[s.filterPillText, support === sp && s.filterPillTextActive]}>
              {LABELS[i]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !voters.length ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={voters}
          keyExtractor={v => v.id}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
            tintColor={C.primary} />}
          renderItem={({ item: v }) => {
            const col = supportColor(v.support_level)
            return (
              <TouchableOpacity style={s.voterRow}
                onPress={() => navigation.navigate('VoterDetail', { voterId: v.id })}>
                <View style={[s.voterAv, { backgroundColor: col.bg }]}>
                  <Text style={[s.voterAvText, { color: col.fg }]}>
                    {v.full_name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.voterName}>{v.full_name}</Text>
                  <Text style={s.voterSub}>{v.voter_id} · {v.house_number || v.address?.split(',')[0]}</Text>
                </View>
                <View style={[s.supportBadge, { backgroundColor: col.bg }]}>
                  <Text style={[s.supportBadgeText, { color: col.fg }]}>
                    {v.support_level.charAt(0).toUpperCase() + v.support_level.slice(1)}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: C.muted }}>No voters found</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

// ─── Voter Detail Screen ──────────────────────────────────────
export function VoterDetailScreen({ route, navigation }: any) {
  const { voterId }        = route.params
  const [voter,  setVoter] = useState<any>(null)
  const [history,setHistory]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [activeTab, setTab]= useState<'profile'|'history'>('profile')

  useEffect(() => {
    ;(async () => {
      const data = await api.getVoter(voterId)
      setVoter(data.voter)
      setHistory(data.history)
      setLoading(false)
    })()
  }, [voterId])

  if (loading) return (
    <View style={[s.container,{justifyContent:'center',alignItems:'center'}]}>
      <ActivityIndicator color={C.primary} size="large"/>
    </View>
  )
  if (!voter) return null

  const supportColors = {
    supporter: { bg: '#E1F5EE', fg: '#085041', dot: '#1D9E75' },
    neutral:   { bg: '#FAEEDA', fg: '#633806', dot: '#BA7517' },
    opposition:{ bg: '#FCEBEB', fg: '#791F1F', dot: '#E24B4A' },
    unknown:   { bg: '#F1EFE8', fg: '#444441', dot: '#888780' },
  }[voter.support_level] || { bg: '#F1EFE8', fg: '#444441', dot: '#888780' }

  const initials = voter.full_name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Voter detail</Text>
      </View>

      {/* Hero */}
      <View style={s.heroStrip}>
        <View style={[s.heroAvatar, { backgroundColor: supportColors.bg }]}>
          <Text style={[s.heroAvatarText, { color: supportColors.fg }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroName}>{voter.full_name}</Text>
          <Text style={s.heroSub}>{voter.voter_id} · {voter.house_number || 'House —'}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <View style={s.pill}><Text style={s.pillText}>Age {voter.age} · {voter.gender === 'M' ? 'Male' : voter.gender === 'F' ? 'Female' : 'Other'}</Text></View>
            <View style={[s.pill, { backgroundColor: supportColors.bg }]}>
              <View style={[s.dotSmall, { backgroundColor: supportColors.dot }]} />
              <Text style={[s.pillText, { color: supportColors.fg }]}>
                {voter.support_level.charAt(0).toUpperCase() + voter.support_level.slice(1)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View style={s.quickActions}>
        {[
          { label: 'Call', color: '#1D9E75', bg: '#E1F5EE', onPress: () => {} },
          { label: 'Log visit', color: '#185FA5', bg: '#E6F1FB',
            onPress: () => navigation.navigate('LogVisit', {
              voterId: voter.id, voterName: voter.full_name,
              householdId: voter.household_id,
              campaignId: 'eeeeeeee-0000-0000-0000-000000000001'
            })},
          { label: 'Household', color: '#BA7517', bg: '#FAEEDA',
            onPress: () => navigation.navigate('Household', { voterId: voter.id })},
        ].map(a => (
          <TouchableOpacity key={a.label} style={[s.quickBtn, { backgroundColor: a.bg }]}
            onPress={a.onPress}>
            <Text style={[s.quickBtnText, { color: a.color }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, activeTab === 'profile' && s.tabActive]}
          onPress={() => setTab('profile')}>
          <Text style={[s.tabText, activeTab === 'profile' && s.tabTextActive]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'history' && s.tabActive]}
          onPress={() => setTab('history')}>
          <Text style={[s.tabText, activeTab === 'history' && s.tabTextActive]}>
            History ({history.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll}>
        {activeTab === 'profile' ? (
          <>
            {[
              { label: 'Personal', rows: [
                ['Full name',       voter.full_name],
                ['Father/Husband',  voter.father_name || '—'],
                ['Age',             voter.age],
                ['Gender',          voter.gender === 'M' ? 'Male' : voter.gender === 'F' ? 'Female' : '—'],
              ]},
              { label: 'Contact', rows: [
                ['Phone',           voter.phone || '—'],
                ['Alt phone',       voter.alt_phone || '—'],
                ['House no.',       voter.house_number || '—'],
                ['Address',         voter.full_address || voter.address || '—'],
              ]},
              { label: 'Polling', rows: [
                ['Voter ID',        voter.voter_id],
                ['Booth',           voter.booth_id?.slice(0,8) + '...'],
                ['Ward',            'Ward 42'],
                ['Last contacted',  voter.last_contacted_at
                  ? new Date(voter.last_contacted_at).toLocaleDateString('en-IN')
                  : 'Never'],
              ]},
            ].map(section => (
              <View key={section.label} style={s.profileSection}>
                <Text style={s.profileSectionLabel}>{section.label.toUpperCase()}</Text>
                {section.rows.map(([k, v]) => (
                  <View key={k} style={s.profileRow}>
                    <Text style={s.profileKey}>{k}</Text>
                    <Text style={s.profileVal}>{v}</Text>
                  </View>
                ))}
              </View>
            ))}
            {voter.notes ? (
              <View style={s.notesBox}>
                <Text style={s.notesText}>{voter.notes}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {history.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: C.muted }}>No visit history yet</Text>
              </View>
            ) : history.map((log: any, i: number) => {
              const dotColor = {
                contacted: '#1D9E75', not_home: '#888780',
                refused: '#E24B4A', not_found: '#888780'
              }[log.outcome] || '#888780'
              return (
                <View key={log.id} style={s.logEntry}>
                  <View style={[s.logDot, { backgroundColor: dotColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.logTitle}>
                      {log.outcome.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
                      {log.support_given ? ` · ${log.support_given}` : ''}
                    </Text>
                    <Text style={s.logSub}>
                      {new Date(log.visited_at).toLocaleDateString('en-IN')} · {log.canvasser_name}
                    </Text>
                    {log.notes ? <Text style={s.logNote}>{log.notes}</Text> : null}
                  </View>
                </View>
              )
            })}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Action sheet */}
      <View style={s.actionSheet}>
        <TouchableOpacity style={s.actionBtnP}
          onPress={() => navigation.navigate('LogVisit', {
            voterId: voter.id, voterName: voter.full_name,
            householdId: voter.household_id,
            campaignId: 'eeeeeeee-0000-0000-0000-000000000001'
          })}>
          <Text style={s.actionBtnPText}>Log a visit</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Shared styles ────────────────────────────────────────────
const s = StyleSheet.create({
  container:         { flex: 1, backgroundColor: C.bg },
  content:           { padding: 16 },
  greeting:          { flexDirection: 'row', justifyContent: 'space-between',
                       alignItems: 'center', paddingTop: 52, marginBottom: 16 },
  greetName:         { fontSize: 16, fontWeight: '600', color: C.text },
  greetSub:          { fontSize: 12, color: C.muted, marginTop: 2 },
  avatar:            { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEEDFE',
                       alignItems: 'center', justifyContent: 'center' },
  avatarText:        { fontSize: 12, fontWeight: '600', color: '#3C3489' },
  syncBanner:        { flexDirection: 'row', alignItems: 'center', gap: 8,
                       backgroundColor: '#FAEEDA', borderRadius: 8, padding: 10, marginBottom: 12 },
  syncDot:           { width: 7, height: 7, borderRadius: 4, backgroundColor: '#BA7517' },
  syncText:          { fontSize: 12, color: '#633806', flex: 1 },
  statsGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  stat:              { flex: 1, minWidth: '45%', backgroundColor: C.surface, borderRadius: 10, padding: 12 },
  statN:             { fontSize: 22, fontWeight: '600', color: C.text },
  statL:             { fontSize: 11, color: C.muted, marginTop: 3 },
  prog:              { height: 4, borderRadius: 2, backgroundColor: C.border, marginTop: 6, overflow: 'hidden' },
  progF:             { height: '100%', borderRadius: 2 },
  sectionHead:       { fontSize: 10, fontWeight: '600', color: C.muted, letterSpacing: 0.8,
                       marginBottom: 8, marginTop: 4 },
  eventCard:         { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 10,
                       padding: 12, marginBottom: 8, alignItems: 'center',
                       borderWidth: 0.5, borderColor: C.border },
  eventTitle:        { fontSize: 13, fontWeight: '500', color: C.text },
  eventSub:          { fontSize: 11, color: C.muted, marginTop: 2 },
  taskCard:          { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 10,
                       padding: 12, marginBottom: 8, alignItems: 'center',
                       borderWidth: 0.5, borderColor: C.border },
  taskTitle:         { fontSize: 13, fontWeight: '500', color: C.text },
  taskSub:           { fontSize: 11, color: C.muted, marginTop: 2 },
  fabBtn:            { backgroundColor: C.primary, borderRadius: 12, padding: 14,
                       alignItems: 'center', marginTop: 8 },
  fabText:           { color: '#fff', fontSize: 15, fontWeight: '600' },
  badge_s:           { backgroundColor: '#E1F5EE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badge_s_text:      { color: '#085041', fontSize: 11, fontWeight: '500' },
  badge_w:           { backgroundColor: '#FAEEDA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badge_w_text:      { color: '#633806', fontSize: 11, fontWeight: '500' },
  headerBar:         { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10,
                       borderBottomWidth: 0.5, borderColor: C.border },
  headerBarTitle:    { fontSize: 18, fontWeight: '600', color: C.text },
  headerBarSub:      { fontSize: 12, color: C.muted },
  searchWrap:        { padding: 12, paddingBottom: 4 },
  searchInput:       { backgroundColor: C.surface, borderRadius: 10, borderWidth: 0.5,
                       borderColor: C.border, padding: 10, fontSize: 13, color: C.text },
  filterScroll:      { flexGrow: 0, paddingVertical: 6 },
  filterPill:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
                       backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border },
  filterPillActive:  { backgroundColor: '#E6F1FB', borderColor: '#185FA5' },
  filterPillText:    { fontSize: 12, color: C.muted },
  filterPillTextActive:{ color: '#185FA5', fontWeight: '500' },
  voterRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
                       borderBottomWidth: 0.5, borderColor: C.border },
  voterAv:           { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  voterAvText:       { fontSize: 12, fontWeight: '600' },
  voterName:         { fontSize: 13, fontWeight: '500', color: C.text },
  voterSub:          { fontSize: 11, color: C.muted },
  supportBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  supportBadgeText:  { fontSize: 10, fontWeight: '500' },
  header:            { flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: 52,
                       borderBottomWidth: 0.5, borderColor: C.border, gap: 8 },
  back:              { color: '#185FA5', fontSize: 14 },
  headerTitle:       { fontSize: 14, fontWeight: '600', color: C.text, flex: 1 },
  heroStrip:         { flexDirection: 'row', gap: 12, padding: 14,
                       borderBottomWidth: 0.5, borderColor: C.border, alignItems: 'center' },
  heroAvatar:        { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  heroAvatarText:    { fontSize: 16, fontWeight: '600' },
  heroName:          { fontSize: 15, fontWeight: '600', color: C.text },
  heroSub:           { fontSize: 11, color: C.muted, marginTop: 2 },
  pill:              { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surface,
                       paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText:          { fontSize: 10, color: C.muted, fontWeight: '500' },
  dotSmall:          { width: 5, height: 5, borderRadius: 3 },
  quickActions:      { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: C.border },
  quickBtn:          { flex: 1, padding: 10, alignItems: 'center',
                       borderRightWidth: 0.5, borderColor: C.border },
  quickBtnText:      { fontSize: 12, fontWeight: '500' },
  tabBar:            { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: C.border },
  tab:               { flex: 1, padding: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive:         { borderColor: C.primary },
  tabText:           { fontSize: 12, color: C.muted },
  tabTextActive:     { color: C.primary, fontWeight: '500' },
  scroll:            { flex: 1 },
  profileSection:    { borderBottomWidth: 0.5, borderColor: C.border, marginBottom: 4 },
  profileSectionLabel:{ fontSize: 10, fontWeight: '600', color: C.muted, padding: 12, paddingBottom: 4, letterSpacing: 0.5 },
  profileRow:        { flexDirection: 'row', justifyContent: 'space-between', padding: 10,
                       paddingHorizontal: 14, borderBottomWidth: 0.5, borderColor: C.border },
  profileKey:        { fontSize: 12, color: C.muted, width: 120 },
  profileVal:        { fontSize: 13, color: C.text, flex: 1, textAlign: 'right' },
  notesBox:          { margin: 14, padding: 10, backgroundColor: C.surface, borderRadius: 8 },
  notesText:         { fontSize: 12, color: C.muted, fontStyle: 'italic', lineHeight: 18 },
  logEntry:          { flexDirection: 'row', gap: 10, padding: 12, paddingHorizontal: 16,
                       borderBottomWidth: 0.5, borderColor: C.border },
  logDot:            { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  logTitle:          { fontSize: 12, fontWeight: '500', color: C.text },
  logSub:            { fontSize: 11, color: C.muted, marginTop: 2 },
  logNote:           { fontSize: 11, color: C.muted, marginTop: 3, fontStyle: 'italic' },
  actionSheet:       { padding: 12, borderTopWidth: 0.5, borderColor: C.border },
  actionBtnP:        { backgroundColor: C.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  actionBtnPText:    { color: '#fff', fontSize: 14, fontWeight: '600' },
})
