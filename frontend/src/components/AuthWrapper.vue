<template>
  <div v-if="loading" class="w-full h-screen flex items-center justify-center bg-slate-50">
    <div class="text-center space-y-4">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
      <p class="text-slate-600">Processing...</p>
    </div>
  </div>

  <Login
    v-else-if="currentView === 'login'"
    :on-login="handleLogin"
    :on-switch-to-register="() => (currentView = 'register')"
  />

  <Onboarding
    v-else
    :on-complete="handleRegister"
    :on-switch-to-login="() => (currentView = 'login')"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Login from './Login.vue';
import Onboarding from './Onboarding.vue';
import { API_BASE } from '../lib/config';
import type { UserData } from '../types';

const props = defineProps<{
  onAuthComplete: (userData: UserData, sessionId: string) => void;
}>();

const currentView = ref<'login' | 'register'>('login');
const loading = ref(false);

const handleLogin = async (userData: UserData) => {
  loading.value = true;
  try {
    const formData = new URLSearchParams();
    formData.append('phone', userData.phone);
    formData.append('password', userData.password);

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.json();

    if (response.ok && result.success && result.session_id) {
      props.onAuthComplete(result.customer_data, result.session_id);
    } else {
      throw new Error(result.detail || result.message || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert(error instanceof Error ? error.message : 'Login failed. Please check your credentials.');
  } finally {
    loading.value = false;
  }
};

const handleRegister = async (userData: UserData) => {
  loading.value = true;
  try {
    const formData = new URLSearchParams();
    formData.append('phone', userData.phone);
    formData.append('email', userData.email);
    formData.append('name', userData.name);
    formData.append('password', userData.password);
    if (userData.city) formData.append('city', userData.city);
    if (userData.salary) formData.append('salary', userData.salary.toString());
    if (userData.dob) formData.append('dob', userData.dob);
    if (userData.profession) formData.append('profession', userData.profession);
    if (userData.address) formData.append('address', userData.address);

    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      await handleLogin(userData);
    } else {
      throw new Error(result.detail || result.message || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert(error instanceof Error ? error.message : 'Registration failed. Please try again.');
  } finally {
    loading.value = false;
  }
};
</script>
