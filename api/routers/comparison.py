"""
Comparison API Router — REST endpoints for multi-lender comparison and simulation.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import uuid

from api.schemas.comparison import (
    GetLoansRequest,
    GetLoansResponse,
    LoanOptionResponse,
    SelectLoanRequest,
    SelectLoanResponse,
    WhatIfRequest,
    WhatIfResponse,
    LendersListResponse,
    LenderInfoResponse,
)
from mock_apis.lender_apis import aggregate_lender_offers, _load_lenders_data, _calculate_interest_rate
from utils.loan_ranker import LoanRanker, WeightAssigner
from utils.financial_rules import calculate_emi

router = APIRouter(prefix="/api/comparison", tags=["comparison"])

# In-memory storage for active comparison sessions for simulation & selection tracking
_comparison_sessions: Dict[str, Dict[str, Any]] = {}


@router.post("/get-loans", response_model=GetLoansResponse, summary="Compare loans across multiple lenders")
async def get_loans(request: GetLoansRequest) -> GetLoansResponse:
    """
    Fetch and rank loan offers based on weighted criteria (EMI, approval probability, total cost).
    """
    try:
        # 1. Fetch offers from existing lender engine
        lenders_result = await aggregate_lender_offers(
            principal=request.loan_amount,
            tenure=request.tenure_months,
            credit_score=request.credit_score,
            monthly_income=request.monthly_salary,
            use_parallel=True,
        )

        raw_offers = lenders_result.get("offers", [])
        total_lenders = len(_load_lenders_data().get("lenders", []))
        ineligible_count = total_lenders - len(raw_offers)

        # 2. Assign dynamic weights based on borrower credit score
        w_emi, w_approval, w_cost = WeightAssigner.assign_by_credit_score(request.credit_score)
        ranker = LoanRanker(emi_weight=w_emi, approval_weight=w_approval, cost_weight=w_cost)

        applied_weights = {
            "emi_factor": w_emi,
            "approval_factor": w_approval,
            "cost_factor": w_cost,
        }

        if not raw_offers:
            smart_suggestions = []
            max_amount = lenders_result.get("max_eligible_amount", 0)
            if max_amount > 0:
                smart_suggestions.append(f"Try reducing requested amount to GHS {max_amount:,.0f}")
            smart_suggestions.append("Consider extending the loan tenure to reduce monthly EMI")

            return GetLoansResponse(
                status="no_eligible_offers",
                eligible_count=0,
                ineligible_count=total_lenders,
                eligible_offers=[],
                best_offer=None,
                alternatives=[],
                recommendation_reason="No lenders match the current criteria with your income and credit profile.",
                smart_suggestions=smart_suggestions,
                applied_weights=applied_weights,
            )

        # 3. Enrich offers with required metrics for ranker
        enriched_offers = []
        for o in raw_offers:
            emi = calculate_emi(request.loan_amount, o["interest_rate"], request.tenure_months)
            processing_fee = o.get("processing_fee", 0.0)
            total_cost = round((emi * request.tenure_months) + processing_fee, 2)
            prob = o.get("approval_probability", 0.8)
            enriched_offers.append({
                **o,
                "emi": emi,
                "total_cost": total_cost,
                "approval_probability": prob,
                "approval_percentage": round(prob * 100, 1),
            })

        # 4. Score and rank eligible offers
        ranked = ranker.rank_offers(enriched_offers)
        best = ranked[0]
        alternatives = ranked[1:3] if len(ranked) > 1 else []

        recommendation_reason = LoanRanker.get_recommendation_reason(best, alternatives)

        # 4. Map to response schema
        eligible_offers: List[LoanOptionResponse] = [
            LoanOptionResponse(
                lender_id=o["lender_id"],
                lender_name=o["lender_name"],
                lender_type=o.get("lender_type", "BANK"),
                interest_rate=o["interest_rate"],
                emi=o["emi"],
                total_cost=o["total_cost"],
                approval_probability=o["approval_probability"],
                approval_percentage=o.get("approval_percentage", round(o["approval_probability"] * 100, 1)),
                composite_score=o.get("composite_score", 0.0),
                rank_badge=o.get("rank_badge", ""),
                recommendation_rank=o.get("recommendation_rank", 1),
            )
            for o in ranked
        ]

        best_offer_response = eligible_offers[0] if eligible_offers else None
        alt_responses = eligible_offers[1:3] if len(eligible_offers) > 1 else []

        # 5. Store session data for what-if simulation
        session_id = str(uuid.uuid4())
        _comparison_sessions[session_id] = {
            "request": request.model_dump(),
            "best_offer": best,
            "eligible_count": len(ranked),
        }

        return GetLoansResponse(
            status="success",
            eligible_count=len(eligible_offers),
            ineligible_count=ineligible_count,
            eligible_offers=eligible_offers,
            best_offer=best_offer_response,
            alternatives=alt_responses,
            recommendation_reason=recommendation_reason,
            smart_suggestions=[],
            applied_weights=applied_weights,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


@router.post("/select-loan", response_model=SelectLoanResponse, summary="Select a loan offer")
async def select_loan(request: SelectLoanRequest) -> SelectLoanResponse:
    """
    Record customer loan selection and prepare for underwriting.
    """
    lenders_data = _load_lenders_data()
    lender = next((l for l in lenders_data["lenders"] if l["lender_id"] == request.selected_lender_id), None)

    if not lender:
        raise HTTPException(status_code=404, detail=f"Lender '{request.selected_lender_id}' not found")

    # In development/mock mode, default salary and score
    credit_score = 750
    rate = _calculate_interest_rate(lender["base_rate"], credit_score)
    sample_amount = 50000.0
    sample_tenure = 36
    emi = calculate_emi(sample_amount, rate, sample_tenure)

    if request.session_id and request.session_id in _comparison_sessions:
        _comparison_sessions[request.session_id]["selected_lender"] = request.selected_lender_id

    return SelectLoanResponse(
        success=True,
        message=f"Loan from {lender['lender_name']} selected successfully",
        selected_lender=lender["lender_name"],
        selected_interest_rate=rate,
        selected_emi=emi,
        next_step="underwriting",
    )


@router.post("/what-if", response_model=WhatIfResponse, summary="Run what-if simulation")
async def run_what_if(request: WhatIfRequest) -> WhatIfResponse:
    """
    Simulate impact of changing loan amount or tenure on EMI and total cost.
    """
    session = _comparison_sessions.get(request.session_id)
    if not session:
        # Fallback to standard baseline if session not in memory
        orig_amount = 50000.0
        orig_tenure = 36
        orig_rate = 18.0
    else:
        orig_req = session["request"]
        orig_amount = orig_req["loan_amount"]
        orig_tenure = orig_req["tenure_months"]
        best = session.get("best_offer", {})
        orig_rate = best.get("interest_rate", 18.0)

    orig_emi = calculate_emi(orig_amount, orig_rate, orig_tenure)
    orig_total_cost = round((orig_emi * orig_tenure), 2)

    sim_amount = request.new_loan_amount if request.new_loan_amount is not None else orig_amount
    sim_tenure = request.new_tenure_months if request.new_tenure_months is not None else orig_tenure

    sim_emi = calculate_emi(sim_amount, orig_rate, sim_tenure)
    sim_total_cost = round((sim_emi * sim_tenure), 2)

    return WhatIfResponse(
        original={
            "loan_amount": orig_amount,
            "tenure_months": orig_tenure,
            "emi": orig_emi,
            "best_rate": orig_rate,
            "total_cost": orig_total_cost,
        },
        simulated={
            "loan_amount": sim_amount,
            "tenure_months": sim_tenure,
            "emi": sim_emi,
            "best_rate": orig_rate,
            "total_cost": sim_total_cost,
        },
        differences={
            "emi_change": round(sim_emi - orig_emi, 2),
            "total_cost_change": round(sim_total_cost - orig_total_cost, 2),
            "interest_savings": round(max(0, orig_total_cost - sim_total_cost), 2),
        },
    )


@router.get("/lenders", response_model=LendersListResponse, summary="List available lenders")
async def get_lenders() -> LendersListResponse:
    """
    Get all active lenders and their lending criteria.
    """
    data = _load_lenders_data()
    lenders_dict: Dict[str, LenderInfoResponse] = {}

    for l in data.get("lenders", []):
        lenders_dict[l["lender_id"]] = LenderInfoResponse(
            name=l["lender_name"],
            type=l.get("lender_type", "BANK"),
            jurisdiction="Ghana",
            base_rate=l["base_rate"],
            min_loan_amount=l["min_loan_amount"],
            max_loan_amount=l["max_loan_amount"],
            approval_probability=l["approval_probability"],
        )

    return LendersListResponse(
        count=len(lenders_dict),
        lenders=lenders_dict,
    )
