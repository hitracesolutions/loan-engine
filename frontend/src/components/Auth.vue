<template>
  <div v-if="authState.isLoading" class="w-full h-screen flex items-center justify-center bg-slate-50">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
      <p class="text-slate-600">Loading...</p>
    </div>
  </div>

  <template v-else-if="!authState.isAuthenticated">
    <Login
      v-if="showLogin"
      :on-login="handleLogin"
      :on-switch-to-register="() => (showLogin = false)"
    />
    <Onboarding
      v-else
      :on-complete="handleRegistrationComplete"
      :on-switch-to-login="() => (showLogin = true)"
    />
  </template>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import Login from './Login.vue';
import Onboarding from './Onboarding.vue';
import type { UserData, AuthState } from '../types';

const props = defineProps<{
  onAuthenticated: (userData: UserData) => void;
}>();

const authState = reactive<AuthState>({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
});

const showLogin = ref(true);

onMounted(() => {
  const savedUser = localStorage.getItem('nbfc_user');
  if (savedUser) {
    try {
      const userData = JSON.parse(savedUser);
      authState.isAuthenticated = true;
      authState.user = userData;
      authState.isLoading = false;
      props.onAuthenticated(userData);
    } catch {
      localStorage.removeItem('nbfc_user');
      authState.isLoading = false;
    }
  } else {
    authState.isLoading = false;
  }
});

const handleLogin = (userData: UserData) => {
  localStorage.setItem('nbfc_user', JSON.stringify(userData));
  authState.isAuthenticated = true;
  authState.user = userData;
  authState.isLoading = false;
  props.onAuthenticated(userData);
};

const handleRegistrationComplete = (userData: UserData) => {
  localStorage.setItem('nbfc_user', JSON.stringify(userData));
  authState.isAuthenticated = true;
  authState.user = userData;
  authState.isLoading = false;
  props.onAuthenticated(userData);
};
</script>
