import React, { useState, useEffect } from "react";
import { loanService, pesewasToGhsString } from "../services/loanService";
import { AlertCircle, CheckCircle2, Landmark, RefreshCw, ArrowLeft } from "lucide-react";

export interface CashierLedgerPortalProps {
  onBack?: () => void;
}

export const CashierLedgerPortal: React.FC<CashierLedgerPortalProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<"disbursements" | "repayments" | "journal">("disbursements");

  const [disbursementRequests, setDisbursementRequests] = useState<any[]>([]);
  const [journalTransactions, setJournalTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [repayAppId, setRepayAppId] = useState<string>("");
  const [repayAmountGhs, setRepayAmountGhs] = useState<string>("");
  const [repayChannel, setRepayChannel] = useState<"MOMO" | "BANK_TRANSFER" | "CASH" | "CHEQUE">("MOMO");
  const [repayExtRef, setRepayExtRef] = useState<string>("");
  const [isSubmittingRepay, setIsSubmittingRepay] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      if (activeTab === "disbursements") {
        const requests = await loanService.getDisbursementRequests();
        setDisbursementRequests(requests || []);
      } else if (activeTab === "journal") {
        const txs = await loanService.getJournalTransactions();
        setJournalTransactions(txs || []);
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to load ledger records.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDisbursement = async (requestId: string) => {
    setActionInProgress(requestId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await loanService.approveDisbursement(null, { disbursementRequestId: requestId });
      setActionSuccess("Disbursement request approved successfully by checker.");
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Approval failed.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleExecuteDisbursement = async (requestId: string) => {
    setActionInProgress(requestId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const extRef = `TX-MOMO-${Date.now()}`;
      await loanService.executeDisbursement(null, { disbursementRequestId: requestId, externalReference: extRef });
      setActionSuccess(`Disbursement executed. Double-entry journal posted & loan activated with ref: ${extRef}`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Execution failed.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(repayAmountGhs);
    if (!repayAppId || isNaN(amount) || amount <= 0) {
      setActionError("Please provide a valid Application ID and positive amount in GHS.");
      return;
    }
    setIsSubmittingRepay(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await loanService.recordRepayment(null, {
        applicationId: repayAppId.trim(),
        amountGhs: amount,
        channel: repayChannel,
        externalReference: repayExtRef ? repayExtRef.trim() : undefined,
      });
      setActionSuccess(
        `Repayment recorded! Receipt: ${res.receiptNumber}. Fees: ${pesewasToGhsString(res.allocation.feesCovered)}, Interest: ${pesewasToGhsString(res.allocation.interestCovered)}, Principal: ${pesewasToGhsString(res.allocation.principalCovered)}.`
      );
      setRepayAmountGhs("");
      setRepayAppId("");
      setRepayExtRef("");
    } catch (err: any) {
      setActionError(err.message || "Failed to record repayment.");
    } finally {
      setIsSubmittingRepay(false);
    }
  };

  const fieldCls = "w-full px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 focus:outline-none";
  const tabs = [
    { id: "disbursements" as const, label: "Disbursement Requests (Maker-Checker)" },
    { id: "repayments" as const, label: "Record Repayment (Waterfall Allocation)" },
    { id: "journal" as const, label: "Double-Entry General Journal" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-700">
            <Landmark className="w-5 h-5" strokeWidth={1.5} />
          </span>
          <div>
            <h2 className="dashboard-heading text-2xl font-semibold">Cashier &amp; Double-Entry Financial Ledger</h2>
            <p className="dashboard-copy text-sm mt-0.5">
              Dual-authorization disbursement workflow, repayment allocation waterfall, and balanced general journal.
            </p>
          </div>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Back to Dashboard
          </button>
        )}
      </div>

      {/* Alerts */}
      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 bg-[#f0f9f7] border border-[#b8dbd8] text-[#0a2e2a] rounded-xl text-sm flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex border-b border-gray-200 gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" strokeWidth={1.5} />
          <p className="dashboard-copy text-sm">Loading financial ledger data…</p>
        </div>
      ) : activeTab === "disbursements" ? (
        <div className="dashboard-card rounded-2xl border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="dashboard-heading font-semibold">Pending &amp; Authorized Disbursement Requests</h3>
            <span className="text-xs bg-gray-100 text-gray-600 font-medium px-2.5 py-1 rounded-full border border-gray-200">
              {disbursementRequests.length} Requests
            </span>
          </div>
          {disbursementRequests.length === 0 ? (
            <div className="p-8 text-center dashboard-copy text-sm">
              No disbursement requests found. Approved applications in PENDING_DISBURSEMENT can be requested by Cashiers.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Request ID</th>
                    <th className="px-6 py-3">Application</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Channel</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {disbursementRequests.map((req) => (
                    <tr key={req._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs dashboard-copy">{req._id.substring(0, 16)}…</td>
                      <td className="px-6 py-4 font-mono text-xs dashboard-copy">{req.applicationId.substring(0, 16)}…</td>
                      <td className="px-6 py-4 font-bold dashboard-heading">{pesewasToGhsString(req.amountPesewas)}</td>
                      <td className="px-6 py-4 text-xs font-semibold dashboard-copy">{req.channel || "MOMO"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                            req.status === "PENDING_APPROVAL"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : req.status === "APPROVED"
                              ? "bg-[#f0f9f7] text-[#0d3d38] border border-[#b8dbd8]"
                              : req.status === "PROCESSED"
                              ? "bg-[#f0f9f7] text-[#0d3d38] border border-[#b8dbd8]"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        {req.status === "PENDING_APPROVAL" && (
                          <button
                            onClick={() => handleApproveDisbursement(req._id)}
                            disabled={actionInProgress === req._id}
                            className="px-3 py-1 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                          >
                            Approve (Checker)
                          </button>
                        )}
                        {req.status === "APPROVED" && (
                          <button
                            onClick={() => handleExecuteDisbursement(req._id)}
                            disabled={actionInProgress === req._id}
                            className="px-3 py-1 bg-[#0d3d38] hover:bg-[#0a2e2a] text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                          >
                            Execute &amp; Disburse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === "repayments" ? (
        <div className="dashboard-card rounded-2xl border p-6 max-w-2xl">
          <h3 className="dashboard-heading text-lg font-semibold mb-1">Record Loan Repayment Receipt</h3>
          <p className="dashboard-copy text-xs mb-6">
            Payments are automatically allocated using Matthias' verified priority waterfall:{" "}
            <strong>1. Fees first</strong> → <strong>2. Interest second</strong> → <strong>3. Remaining reduces principal</strong>.
          </p>

          <form onSubmit={handleRecordRepayment} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Loan Application ID</label>
              <input
                type="text"
                value={repayAppId}
                onChange={(e) => setRepayAppId(e.target.value)}
                placeholder="e.g. applications_123..."
                className={`${fieldCls} font-mono`}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Repayment Amount (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={repayAmountGhs}
                  onChange={(e) => setRepayAmountGhs(e.target.value)}
                  placeholder="e.g. 500.00"
                  className={fieldCls}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Channel</label>
                <select
                  value={repayChannel}
                  onChange={(e) => setRepayChannel(e.target.value as any)}
                  className={fieldCls}
                >
                  <option value="MOMO">Mobile Money (MTN / Telecel / AT)</option>
                  <option value="BANK_TRANSFER">Bank Wire / Clearing</option>
                  <option value="CASH">Cash Over-the-Counter</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">External Transfer / Receipt Ref (Optional)</label>
              <input
                type="text"
                value={repayExtRef}
                onChange={(e) => setRepayExtRef(e.target.value)}
                placeholder="e.g. MTN-TX-8492049"
                className={`${fieldCls} font-mono`}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingRepay}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isSubmittingRepay ? "Posting to Double-Entry Journal…" : "Record Repayment & Post Journal"}
            </button>
          </form>
        </div>
      ) : (
        <div className="dashboard-card rounded-2xl border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="dashboard-heading font-semibold">Double-Entry General Journal Transactions</h3>
            <span className="text-xs bg-[#f0f9f7] text-[#0d3d38] font-medium px-2.5 py-1 rounded-full border border-[#b8dbd8]">
              Balanced Debits == Credits
            </span>
          </div>
          {journalTransactions.length === 0 ? (
            <div className="p-8 text-center dashboard-copy text-sm">
              No journal transactions posted yet. Executed disbursements and repayments will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Tx ID</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Reference</th>
                    <th className="px-6 py-3">Balanced Total</th>
                    <th className="px-6 py-3">Posted Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {journalTransactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs dashboard-copy">{tx._id.substring(0, 16)}…</td>
                      <td className="px-6 py-4 font-semibold text-xs text-[#0d3d38]">{tx.transactionType}</td>
                      <td className="px-6 py-4 text-xs dashboard-copy">{tx.description}</td>
                      <td className="px-6 py-4 font-mono text-xs dashboard-copy">{tx.reference}</td>
                      <td className="px-6 py-4 font-bold dashboard-heading">{pesewasToGhsString(tx.totalAmountPesewas)}</td>
                      <td className="px-6 py-4 text-xs dashboard-subtle">{new Date(tx.postedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
