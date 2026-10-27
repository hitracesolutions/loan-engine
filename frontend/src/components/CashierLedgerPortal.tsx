import React, { useState, useEffect } from "react";
import { useOptionalConvex } from "../lib/convex";
import { loanService, pesewasToGhsString } from "../services/loanService";

export interface CashierLedgerPortalProps {
  onBack?: () => void;
}

export const CashierLedgerPortal: React.FC<CashierLedgerPortalProps> = ({ onBack }) => {
  const convexClient = useOptionalConvex();
  const [activeTab, setActiveTab] = useState<"disbursements" | "repayments" | "journal">("disbursements");
  
  // States
  const [disbursementRequests, setDisbursementRequests] = useState<any[]>([]);
  const [journalTransactions, setJournalTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Repayment form state
  const [repayAppId, setRepayAppId] = useState<string>("");
  const [repayAmountGhs, setRepayAmountGhs] = useState<string>("");
  const [repayChannel, setRepayChannel] = useState<"MOMO" | "BANK_TRANSFER" | "CASH" | "CHEQUE">("MOMO");
  const [repayExtRef, setRepayExtRef] = useState<string>("");
  const [isSubmittingRepay, setIsSubmittingRepay] = useState<boolean>(false);

  // Checker action state
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [convexClient, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      if (activeTab === "disbursements") {
        const requests = await loanService.getDisbursementRequests(convexClient);
        setDisbursementRequests(requests || []);
      } else if (activeTab === "journal") {
        const txs = await loanService.getJournalTransactions(convexClient);
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
      await loanService.approveDisbursement(convexClient, {
        disbursementRequestId: requestId as any,
      });
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
      await loanService.executeDisbursement(convexClient, {
        disbursementRequestId: requestId as any,
        externalReference: extRef,
      });
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
      const res = await loanService.recordRepayment(convexClient, {
        applicationId: repayAppId.trim() as any,
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">💵 Cashier & Double-Entry Financial Ledger</h2>
          <p className="text-sm text-slate-500">
            Dual-authorization disbursement workflow, repayment allocation waterfall, and balanced general journal.
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-sm font-medium transition"
          >
            ← Back to Dashboard
          </button>
        )}
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
          <span>⚠️</span>
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-start gap-2">
          <span>✅</span>
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("disbursements")}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === "disbursements"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Disbursement Requests (Maker-Checker)
        </button>
        <button
          onClick={() => setActiveTab("repayments")}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === "repayments"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Record Repayment (Waterfall Allocation)
        </button>
        <button
          onClick={() => setActiveTab("journal")}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === "journal"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Double-Entry General Journal
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <div className="animate-spin text-2xl mb-2">⏳</div>
          Loading financial ledger data...
        </div>
      ) : activeTab === "disbursements" ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Pending & Authorized Disbursement Requests</h3>
            <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2.5 py-1 rounded-full">
              {disbursementRequests.length} Requests
            </span>
          </div>
          {disbursementRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No disbursement requests found. Approved applications in PENDING_DISBURSEMENT can be requested by Cashiers.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">Request ID</th>
                    <th className="px-6 py-3">Application</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Channel</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {disbursementRequests.map((req) => (
                    <tr key={req._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-xs">{req._id.substring(0, 16)}...</td>
                      <td className="px-6 py-4 font-mono text-xs">{req.applicationId.substring(0, 16)}...</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{pesewasToGhsString(req.amountPesewas)}</td>
                      <td className="px-6 py-4 text-xs font-semibold">{req.channel || "MOMO"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                            req.status === "PENDING_APPROVAL"
                              ? "bg-amber-100 text-amber-800"
                              : req.status === "APPROVED"
                              ? "bg-blue-100 text-blue-800"
                              : req.status === "PROCESSED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-800"
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
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-50"
                          >
                            Approve (Checker)
                          </button>
                        )}
                        {req.status === "APPROVED" && (
                          <button
                            onClick={() => handleExecuteDisbursement(req._id)}
                            disabled={actionInProgress === req._id}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium disabled:opacity-50"
                          >
                            Execute & Disburse
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Record Loan Repayment Receipt</h3>
          <p className="text-xs text-slate-500 mb-6">
            Payments are automatically allocated using Matthias' verified priority waterfall: <b>1. Fees first</b> &rarr; <b>2. Interest second</b> &rarr; <b>3. Remaining reduces principal</b>.
          </p>

          <form onSubmit={handleRecordRepayment} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Loan Application ID</label>
              <input
                type="text"
                value={repayAppId}
                onChange={(e) => setRepayAppId(e.target.value)}
                placeholder="e.g. applications_123..."
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Repayment Amount (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={repayAmountGhs}
                  onChange={(e) => setRepayAmountGhs(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Channel</label>
                <select
                  value={repayChannel}
                  onChange={(e) => setRepayChannel(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="MOMO">Mobile Money (MTN / Telecel / AT)</option>
                  <option value="BANK_TRANSFER">Bank Wire / Clearing</option>
                  <option value="CASH">Cash Over-the-Counter</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">External Transfer / Receipt Ref (Optional)</label>
              <input
                type="text"
                value={repayExtRef}
                onChange={(e) => setRepayExtRef(e.target.value)}
                placeholder="e.g. MTN-TX-8492049"
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingRepay}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition disabled:opacity-50"
            >
              {isSubmittingRepay ? "Posting to Double-Entry Journal..." : "Record Repayment & Post Journal"}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Double-Entry General Journal Transactions</h3>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2.5 py-1 rounded-full">
              Balanced Debits == Credits
            </span>
          </div>
          {journalTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No journal transactions posted yet. Executed disbursements and repayments will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">Tx ID</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Reference</th>
                    <th className="px-6 py-3">Balanced Total</th>
                    <th className="px-6 py-3">Posted Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {journalTransactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-xs">{tx._id.substring(0, 16)}...</td>
                      <td className="px-6 py-4 font-semibold text-xs text-blue-700">{tx.transactionType}</td>
                      <td className="px-6 py-4 text-xs text-slate-700">{tx.description}</td>
                      <td className="px-6 py-4 font-mono text-xs">{tx.reference}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{pesewasToGhsString(tx.totalAmountPesewas)}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{new Date(tx.postedAt).toLocaleString()}</td>
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
