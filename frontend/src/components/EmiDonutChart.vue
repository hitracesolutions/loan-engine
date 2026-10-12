<template>
  <div class="w-full bg-white p-3 rounded-lg border border-slate-100 shadow-sm mt-3">
    <h3 class="text-xs font-bold text-slate-700 mb-2">Repayment Summary</h3>
    <div class="grid grid-cols-1 gap-2">
      <div class="flex justify-between items-center p-2 bg-slate-50 rounded-md border border-slate-100">
        <div class="text-xs text-slate-500">Principal Amount</div>
        <div class="text-sm font-bold text-slate-900">₹{{ format(principal) }}</div>
      </div>
      <div class="flex justify-between items-center p-2 bg-slate-50 rounded-md border border-slate-100">
        <div class="text-xs text-slate-500">Total Interest</div>
        <div class="text-sm font-bold text-slate-900">₹{{ format(Math.max(0, totalInterest)) }}</div>
      </div>
      <div class="flex justify-between items-center p-2 bg-slate-50 rounded-md border border-slate-100">
        <div class="text-xs text-slate-500">Total Payable</div>
        <div class="text-sm font-bold text-slate-900">₹{{ format(totalAmount) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  principal: number;
  emi: number;
  tenure: number;
}>();

const totalAmount = computed(() => props.emi * props.tenure);
const totalInterest = computed(() => totalAmount.value - props.principal);

const format = (val: number) => new Intl.NumberFormat('en-IN').format(val);
</script>
