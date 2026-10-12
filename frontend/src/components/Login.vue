<template>
  <div class="w-full h-screen flex overflow-hidden font-sans bg-slate-50 text-slate-900">
    <!-- Left Sidebar -->
    <div class="w-[280px] border-r border-slate-200 bg-white flex flex-col">
      <div class="p-6 border-b border-slate-200">
        <h1 class="text-xl font-bold text-slate-800">NBFC Login</h1>
        <p class="text-sm text-slate-600 mt-1">Welcome back</p>
      </div>

      <div class="flex-1 p-6 flex flex-col justify-center">
        <div class="space-y-6">
          <div class="text-center">
            <div class="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LogIn :size="32" class="text-emerald-600" />
            </div>
            <h2 class="text-lg font-semibold text-slate-800 mb-2">Sign In to Your Account</h2>
            <p class="text-sm text-slate-600">
              Access your loan dashboard and continue your application
            </p>
          </div>

          <div class="space-y-4">
            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div class="flex items-center space-x-3 mb-2">
                <Phone :size="16" class="text-emerald-600" />
                <span class="text-sm font-medium text-emerald-800">Phone & Password</span>
              </div>
              <p class="text-xs text-emerald-700">
                Use the credentials you created during registration
              </p>
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div class="flex items-center space-x-3 mb-2">
                <Lock :size="16" class="text-slate-600" />
                <span class="text-sm font-medium text-slate-800">Secure Access</span>
              </div>
              <p class="text-xs text-slate-600">
                Your information is protected with bank-level security
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col">
      <div class="flex-1 flex items-center justify-center p-12">
        <div class="w-full max-w-md space-y-8 animate-fade-in">
          <div class="text-center">
            <h1 class="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
            <p class="text-slate-600">Sign in to your NBFC account</p>
          </div>

          <form @submit.prevent="handleLogin" class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="Enter your phone number"
                v-model="phone"
                class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
                required
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                v-model="password"
                class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
                required
              />
            </div>

            <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4">
              <p class="text-red-600 text-sm">{{ error }}</p>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full bg-emerald-600 text-white py-4 rounded-xl font-semibold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
            >
              <template v-if="loading">
                <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Signing In...</span>
              </template>
              <template v-else>
                <span>Sign In</span>
                <ArrowRight :size="20" />
              </template>
            </button>
          </form>

          <div class="text-center pt-4">
            <p class="text-sm text-slate-600">
              Don't have an account?
              <button
                type="button"
                @click="onSwitchToRegister?.()"
                class="text-emerald-600 font-semibold hover:text-emerald-700 ml-1"
              >
                Create one now
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { LogIn, Phone, Lock, ArrowRight } from '@lucide/vue';
import type { UserData } from '../types';

const props = defineProps<{
  onLogin: (userData: UserData) => void | Promise<void>;
  onSwitchToRegister?: () => void;
}>();

const phone = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const handleLogin = async () => {
  if (!phone.value || !password.value) {
    error.value = 'Please enter both phone number and password.';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    await props.onLogin({ phone: phone.value, password: password.value } as UserData);
  } catch {
    error.value = 'Login failed. Please try again.';
  } finally {
    loading.value = false;
  }
};
</script>
