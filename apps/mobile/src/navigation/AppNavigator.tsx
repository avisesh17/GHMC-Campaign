import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import { useAuthStore } from '../store/authStore'

// Auth screens
import { TenantSlugScreen }  from '../screens/auth/TenantSlugScreen'
import { PhoneScreen }        from '../screens/auth/PhoneScreen'
import { OtpScreen }          from '../screens/auth/OtpScreen'

// Main screens
import { DashboardScreen }    from '../screens/DashboardScreen'
import { VoterListScreen }    from '../screens/voters/VoterListScreen'
import { VoterDetailScreen }  from '../screens/voters/VoterDetailScreen'
import { HouseholdScreen }    from '../screens/voters/HouseholdScreen'
import { LogVisitScreen }     from '../screens/canvassing/LogVisitScreen'
import { TaskListScreen }     from '../screens/TaskListScreen'
import { ProgressScreen }     from '../screens/ProgressScreen'
import { ProfileScreen }      from '../screens/ProfileScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

function MainTabs() {
  const { user } = useAuthStore()
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:      false,
        tabBarActiveTintColor: '#1D9E75',
        tabBarStyle: { paddingBottom: 8, height: 60 },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen}
        options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tab.Screen name="Voters"    component={VoterListStack}
        options={{ title: 'Voters', tabBarLabel: 'Voters' }} />
      <Tab.Screen name="Tasks"     component={TaskListScreen}
        options={{ title: 'Tasks', tabBarLabel: 'Tasks' }} />
      <Tab.Screen name="Progress"  component={ProgressScreen}
        options={{ title: 'Progress', tabBarLabel: 'Progress' }} />
      <Tab.Screen name="Profile"   component={ProfileScreen}
        options={{ title: 'Profile', tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  )
}

function VoterListStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VoterList"    component={VoterListScreen} />
      <Stack.Screen name="VoterDetail"  component={VoterDetailScreen} />
      <Stack.Screen name="Household"    component={HouseholdScreen} />
      <Stack.Screen name="LogVisit"     component={LogVisitScreen} />
    </Stack.Navigator>
  )
}

export function AppNavigator() {
  const { user } = useAuthStore()

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="TenantSlug" component={TenantSlugScreen} />
            <Stack.Screen name="Phone"      component={PhoneScreen} />
            <Stack.Screen name="Otp"        component={OtpScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
