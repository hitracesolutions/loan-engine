<template>
  <div class="w-full h-screen flex overflow-hidden font-sans bg-slate-50 text-slate-900">
    <!-- Left Sidebar - Progress -->
    <div class="w-[280px] border-r border-slate-200 bg-white flex flex-col">
      <div class="p-6 border-b border-slate-200">
        <h1 class="text-xl font-bold text-slate-800">NBFC Onboarding</h1>
        <p class="text-sm text-slate-600 mt-1">Step {{ currentStepIndex + 1 }} of {{ steps.length }}</p>
      </div>

      <div class="flex-1 p-6 space-y-3">
        <div
          v-for="(step, index) in steps"
          :key="step.key"
          class="flex items-center space-x-3 p-3 rounded-xl transition-colors"
          :class="[
            index === currentStepIndex
              ? 'bg-emerald-50 border border-emerald-200'
              : index < currentStepIndex
              ? 'bg-emerald-50/50'
              : 'hover:bg-slate-50'
          ]"
        >
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center"
            :class="[
              index < currentStepIndex
                ? 'bg-emerald-600 text-white'
                : index === currentStepIndex
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-slate-100 text-slate-400'
            ]"
          >
            <CheckCircle2 v-if="index < currentStepIndex" :size="16" />
            <component v-else :is="step.icon" :size="16" />
          </div>
          <div class="flex-1">
            <p
              class="text-sm font-medium"
              :class="[
                index === currentStepIndex
                  ? 'text-emerald-800'
                  : index < currentStepIndex
                  ? 'text-emerald-700'
                  : 'text-slate-600'
              ]"
            >
              {{ step.label }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col">
      <div class="flex-1 p-12 overflow-y-auto">
        <!-- 1. Welcome -->
        <div
          v-if="currentStep === 'welcome'"
          class="flex flex-col items-center justify-center h-full text-center space-y-8 animate-fade-in"
        >
          <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center shadow-inner">
            <User :size="32" class="text-emerald-600" />
          </div>
          <div class="space-y-4">
            <h1 class="text-4xl font-bold text-slate-800">Welcome to NBFC</h1>
            <p class="text-lg text-slate-600 max-w-md">
              Let's get you set up with your account for seamless loan processing
            </p>
          </div>
          <button
            @click="currentStep = 'phone'"
            class="bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-xl flex items-center space-x-2"
          >
            <span>Get Started</span>
            <ArrowRight :size="20" />
          </button>

          <p v-if="onSwitchToLogin" class="text-slate-600 text-center">
            Already have an account?
            <button
              @click="onSwitchToLogin"
              class="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors ml-1"
            >
              Sign In
            </button>
          </p>
        </div>

        <!-- 2. Phone Input -->
        <div
          v-else-if="currentStep === 'phone'"
          class="flex flex-col justify-center h-full space-y-8 max-w-xl mx-auto animate-fade-in"
        >
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Phone :size="24" class="text-emerald-600" />
              </div>
              <div>
                <h2 class="text-2xl font-bold text-slate-800">Enter Your Phone Number</h2>
                <p class="text-slate-600">We'll send you an OTP to verify your number</p>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <input
              type="tel"
              placeholder="Enter your phone number"
              v-model="userData.phone"
              class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
            />

            <div class="flex space-x-4">
              <button
                @click="currentStep = 'welcome'"
                class="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors flex items-center space-x-2"
              >
                <ArrowLeft :size="18" />
                <span>Back</span>
              </button>
              <button
                @click="handleSendPhoneOTP"
                :disabled="!userData.phone || loading"
                class="flex-none w-44 bg-emerald-100 text-emerald-700 py-2 rounded-lg font-semibold hover:bg-emerald-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <template v-if="loading">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-700"></div>
                  <span class="text-sm">Sending...</span>
                </template>
                <template v-else>
                  <span class="text-sm">Send OTP</span>
                  <ArrowRight :size="16" />
                </template>
              </button>
            </div>

            <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4">
              <p class="text-red-600 text-sm">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- 3. OTP Phone -->
        <div
          v-else-if="currentStep === 'otp-phone'"
          class="flex flex-col justify-center h-full space-y-8 max-w-xl mx-auto animate-fade-in"
        >
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 :size="24" class="text-emerald-600" />
              </div>
              <div>
                <h2 class="text-2xl font-bold text-slate-800">Verify Phone Number</h2>
                <p class="text-slate-600">Enter the 6-digit code sent to your phone</p>
              </div>
            </div>

            <div v-if="devOtp" class="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p class="text-amber-800 font-medium text-sm">Development Mode</p>
              <p class="text-amber-700 text-sm">Use OTP: <span class="font-mono font-bold">{{ devOtp }}</span></p>
            </div>
          </div>

          <div class="space-y-6">
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              v-model="otp"
              maxlength="6"
              class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
            />

            <div class="flex space-x-4">
              <button
                @click="currentStep = 'phone'"
                class="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors flex items-center space-x-2"
              >
                <ArrowLeft :size="18" />
                <span>Back</span>
              </button>
              <div class="flex-1 space-y-3">
                <button
                  @click="handleVerifyPhoneOTP"
                  :disabled="otp.length !== 6 || loading"
                  class="w-44 bg-emerald-100 text-emerald-700 py-2 rounded-lg font-semibold hover:bg-emerald-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  <template v-if="loading">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-700"></div>
                    <span class="text-sm">Verifying...</span>
                  </template>
                  <template v-else>
                    <span class="text-sm">Verify OTP</span>
                    <ArrowRight :size="16" />
                  </template>
                </button>
                <button
                  @click="handleSendPhoneOTP"
                  :disabled="loading"
                  class="w-full bg-slate-100 text-slate-700 py-2 rounded-xl font-medium hover:bg-slate-200 transition-colors text-sm"
                >
                  Resend OTP
                </button>
              </div>
            </div>

            <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4">
              <p class="text-red-600 text-sm">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- 4. Email Input -->
        <div
          v-else-if="currentStep === 'email'"
          class="flex flex-col justify-center h-full space-y-8 max-w-xl mx-auto animate-fade-in"
        >
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Mail :size="24" class="text-emerald-600" />
              </div>
              <div>
                <h2 class="text-2xl font-bold text-slate-800">Enter Your Email</h2>
                <p class="text-slate-600">We'll send you an OTP to verify your email address</p>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <input
              type="email"
              placeholder="Enter your email address"
              v-model="userData.email"
              class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
            />

            <div class="flex space-x-4">
              <button
                @click="currentStep = 'otp-phone'"
                class="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors flex items-center space-x-2"
              >
                <ArrowLeft :size="18" />
                <span>Back</span>
              </button>
              <button
                @click="handleSendEmailOTP"
                :disabled="!userData.email || loading"
                class="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <template v-if="loading">
                  <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Sending...</span>
                </template>
                <template v-else>
                  <span>Send OTP</span>
                  <ArrowRight :size="18" />
                </template>
              </button>
            </div>

            <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4">
              <p class="text-red-600 text-sm">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- 5. OTP Email -->
        <div
          v-else-if="currentStep === 'otp-email'"
          class="flex flex-col justify-center h-full space-y-8 max-w-xl mx-auto animate-fade-in"
        >
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 :size="24" class="text-emerald-600" />
              </div>
              <div>
                <h2 class="text-2xl font-bold text-slate-800">Verify Email Address</h2>
                <p class="text-slate-600">Enter the 6-digit code sent to your email</p>
              </div>
            </div>

            <div v-if="devOtp" class="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p class="text-amber-800 font-medium text-sm">Development Mode</p>
              <p class="text-amber-700 text-sm">Use OTP: <span class="font-mono font-bold">{{ devOtp }}</span></p>
            </div>
          </div>

          <div class="space-y-6">
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              v-model="otp"
              maxlength="6"
              class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
            />

            <div class="flex space-x-4">
              <button
                @click="currentStep = 'email'"
                class="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors flex items-center space-x-2"
              >
                <ArrowLeft :size="18" />
                <span>Back</span>
              </button>
              <div class="flex-1 space-y-3">
                <button
                  @click="handleVerifyEmailOTP"
                  :disabled="otp.length !== 6 || loading"
                  class="w-44 bg-emerald-100 text-emerald-700 py-2 rounded-lg font-semibold hover:bg-emerald-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  <template v-if="loading">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-700"></div>
                    <span class="text-sm">Verifying...</span>
                  </template>
                  <template v-else>
                    <span class="text-sm">Verify OTP</span>
                    <ArrowRight :size="16" />
                  </template>
                </button>
                <button
                  @click="handleSendEmailOTP"
                  :disabled="loading"
                  class="w-full bg-slate-100 text-slate-700 py-2 rounded-xl font-medium hover:bg-slate-200 transition-colors text-sm"
                >
                  Resend OTP
                </button>
              </div>
            </div>

            <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4">
              <p class="text-red-600 text-sm">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- 6. Details Form -->
        <div
          v-else-if="currentStep === 'details'"
          class="flex flex-col justify-center h-full space-y-8 max-w-xl mx-auto animate-fade-in"
        >
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <FileText :size="24" class="text-emerald-600" />
              </div>
              <div>
                <h2 class="text-2xl font-bold text-slate-800">Personal Details</h2>
                <p class="text-slate-600">Please provide your information as per Aadhaar</p>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Full Name (as per Aadhaar)"
                v-model="userData.name"
                class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <input
                type="date"
                placeholder="Date of Birth"
                v-model="userData.dob"
                class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <input
              type="text"
              placeholder="Profession"
              v-model="userData.profession"
              class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />

            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
              <input
                type="number"
                placeholder="Monthly Salary"
                v-model.number="userData.salary"
                class="w-full pl-8 pr-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <textarea
              placeholder="Complete Address"
              v-model="userData.address"
              rows="4"
              class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            ></textarea>

            <div class="flex space-x-4">
              <button
                @click="currentStep = 'otp-email'"
                class="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors flex items-center space-x-2"
              >
                <ArrowLeft :size="18" />
                <span>Back</span>
              </button>
              <button
                @click="currentStep = 'password'"
                :disabled="!userData.name || !userData.dob || !userData.profession || !userData.address || !userData.salary"
                class="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <span>Continue</span>
                <ArrowRight :size="18" />
              </button>
            </div>

            <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4">
              <p class="text-red-600 text-sm">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- 7. Password Setup -->
        <div
          v-else-if="currentStep === 'password'"
          class="flex flex-col justify-center h-full space-y-8 max-w-xl mx-auto animate-fade-in"
        >
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Lock :size="24" class="text-emerald-600" />
              </div>
              <div>
                <h2 class="text-2xl font-bold text-slate-800">Set Your Password</h2>
                <p class="text-slate-600">Create a secure password for your account</p>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <input
              type="password"
              placeholder="Enter your password (min 6 characters)"
              v-model="userData.password"
              class="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
            />

            <div class="flex space-x-4">
              <button
                @click="currentStep = 'details'"
                class="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors flex items-center space-x-2"
              >
                <ArrowLeft :size="18" />
                <span>Back</span>
              </button>
              <button
                @click="handleCompleteRegistration"
                :disabled="!userData.password || userData.password.length < 6 || loading"
                class="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <template v-if="loading">
                  <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Creating Account...</span>
                </template>
                <template v-else>
                  <span>Create Account</span>
                  <ArrowRight :size="18" />
                </template>
              </button>
            </div>

            <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4">
              <p class="text-red-600 text-sm">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- 8. Complete -->
        <div
          v-else-if="currentStep === 'complete'"
          class="flex flex-col items-center justify-center h-full text-center space-y-8 animate-fade-in"
        >
          <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center shadow-inner">
            <CheckCircle2 :size="40" class="text-emerald-600" />
          </div>
          <div class="space-y-4">
            <h1 class="text-4xl font-bold text-slate-800">Account Created!</h1>
            <p class="text-lg text-slate-600">Welcome to NBFC, {{ userData.name }}</p>
            <p class="text-slate-500">Redirecting you to your dashboard...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { API_BASE } from '../lib/config';
import { User, Phone, Mail, FileText, Lock, CheckCircle2, ArrowRight, ArrowLeft } from '@lucide/vue';
import type { UserData } from '../types';

const props = defineProps<{
  onComplete: (userData: UserData) => void | Promise<void>;
  onSwitchToLogin?: () => void;
}>();

type Step = 'welcome' | 'phone' | 'otp-phone' | 'email' | 'otp-email' | 'details' | 'password' | 'complete';

const currentStep = ref<Step>('welcome');
const userData = reactive<Partial<UserData>>({});
const otp = ref('');
const loading = ref(false);
const error = ref('');
const devOtp = ref<string | null>(null);
const isDevMode = ref(false);

const steps = [
  { key: 'welcome', label: 'Welcome', icon: User },
  { key: 'phone', label: 'Phone', icon: Phone },
  { key: 'otp-phone', label: 'Verify', icon: CheckCircle2 },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'otp-email', label: 'Verify', icon: CheckCircle2 },
  { key: 'details', label: 'Details', icon: FileText },
  { key: 'password', label: 'Password', icon: Lock },
  { key: 'complete', label: 'Complete', icon: CheckCircle2 },
];

const currentStepIndex = computed(() => steps.findIndex((s) => s.key === currentStep.value));

const handleSendPhoneOTP = async () => {
  if (!userData.phone) return;

  loading.value = true;
  error.value = '';
  try {
    const response = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `phone=${userData.phone}&email=${userData.email || ''}`,
    });

    const result = await response.json();
    const devMode = Boolean(result.dev_mode);
    isDevMode.value = devMode;

    if (devMode && result.dev_otp) {
      devOtp.value = result.dev_otp;
    } else {
      devOtp.value = null;
    }
    currentStep.value = 'otp-phone';
  } catch {
    error.value = 'Failed to send OTP. Please try again.';
  } finally {
    loading.value = false;
  }
};

const handleVerifyPhoneOTP = async () => {
  if (!otp.value || !userData.phone) return;

  loading.value = true;
  error.value = '';
  try {
    const formData = new URLSearchParams();
    formData.append('phone', userData.phone);
    formData.append('otp', otp.value);
    if (isDevMode.value) formData.append('use_dev_otp', 'true');

    const response = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.json();
    if (result.success) {
      otp.value = '';
      currentStep.value = 'email';
    } else {
      error.value = 'Invalid OTP. Please try again.';
    }
  } catch {
    error.value = 'Failed to verify OTP. Please try again.';
  } finally {
    loading.value = false;
  }
};

const handleSendEmailOTP = async () => {
  if (!userData.email) return;

  loading.value = true;
  error.value = '';
  try {
    const response = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `phone=${userData.phone!}&email=${userData.email}`,
    });

    const result = await response.json();
    const devMode = Boolean(result.dev_mode);
    isDevMode.value = devMode;

    if (devMode && result.dev_otp) {
      devOtp.value = result.dev_otp;
    } else {
      devOtp.value = null;
    }
    currentStep.value = 'otp-email';
  } catch {
    error.value = 'Failed to send OTP. Please try again.';
  } finally {
    loading.value = false;
  }
};

const handleVerifyEmailOTP = async () => {
  if (!otp.value || !userData.phone) return;

  loading.value = true;
  error.value = '';
  try {
    const formData = new URLSearchParams();
    formData.append('phone', userData.phone);
    formData.append('otp', otp.value);
    if (isDevMode.value) formData.append('use_dev_otp', 'true');

    const response = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.json();
    if (result.success) {
      otp.value = '';
      currentStep.value = 'details';
    } else {
      error.value = 'Invalid OTP. Please try again.';
    }
  } catch {
    error.value = 'Failed to verify OTP. Please try again.';
  } finally {
    loading.value = false;
  }
};

const handleCompleteRegistration = async () => {
  if (!userData.name || !userData.dob || !userData.profession || !userData.address || !userData.salary || !userData.password) {
    error.value = 'Please fill in all required fields.';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    await props.onComplete(userData as UserData);
    currentStep.value = 'complete';
  } catch {
    error.value = 'Registration failed. Please try again.';
  } finally {
    loading.value = false;
  }
};
</script>
