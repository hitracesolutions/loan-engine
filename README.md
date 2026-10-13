<div align="center">

# ⚡ Gidfine

### AI-Powered Loan Origination Platform

**Instant approval. Automated decisioning. Multi-lender marketplace.**

---

[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-red?style=flat-square)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-blue?style=flat-square)](https://react.dev/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-green?style=flat-square)](https://www.mongodb.com/atlas)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agent%20Framework-purple?style=flat-square)](https://langchain-ai.github.io/langgraph/)

</div>

---

## 🚀 What is Gidfine?

Gidfine transforms loan origination from a **7-day manual process** into a **4-minute conversational experience**. 

It combines:
- 🤖 **AI-powered agents** for intelligent routing and decision-making
- 🔍 **Document forensics** with Gemini Vision OCR
- 📊 **Rule-based underwriting** (transparent, auditable, no black boxes)
- 🏦 **Multi-lender marketplace** with parallel offer fetching
- ⚡ **Real-time UI** with WebSocket-driven agent thinking indicators
- 💾 **MongoDB persistence** with session resumption

---

## 🎯 The Problem We Solve

Applying for a loan in Ghana is still fragmented:

| Problem | Status | Solution |
|---------|--------|----------|
| **Manual underwriting** takes 3–7 days | ❌ | Automated decisioning in <5 min |
| Paper documents get lost/flagged | ❌ | Gemini Vision OCR + forensics |
| No visibility into application status | ❌ | Real-time chat + status dashboard |
| Must apply with multiple lenders | ❌ | Single session, 5+ lender offers |
| Fraud checks happen too late | ❌ | 6-signal scoring upfront |

**Result**: Customers get approved, rejected, or get restructured offers **in one session** with full transparency.

---

## ⚙️ How It Works

```
Customer: "I need GHS 50,000"
    ↓
Intent Agent: Classifies request → loan
    ↓
Sales Agent: Gathers amount (50k), tenure (36 months), purpose (business)
    ↓
Lender Marketplace: Fetches 5+ offers in parallel
    ↓
Customer: Picks Access Bank (18% rate)
    ↓
Document Agent: OCR + forensic analysis of ID, salary slip
    ↓
KYC + Fraud (parallel): Name matching, income validation, tampering detection
    ↓
Underwriting: DTI check, credit score, fraud scoring
    ↓
Decision: Approved ✅ → Generate sanction PDF
    ↓
E-signature: Customer signs digitally
    ↓
Disbursement: Funds to account in 24-48 hours 🎉
```

**Total time: ~4 minutes** (vs 3–7 days)

---

## 💡 Key Features

### 🧠 Conversational AI
- **Dual personas**: Sales specialist + Financial advisor
- LangChain + LLM with structured JSON extraction
- Zero hallucination for confirmations

### 📄 Document Processing
- Gemini Vision OCR for ID, salary slips, bank statements
- Visual tamper detection (blurring, pixel inconsistency, font mixing)
- National ID, SSNIT, Passport, Driver's License support

### ✅ KYC & Compliance
- Name matching (document vs. customer profile)
- Document type validation per loan tier
- Parallel KYC + fraud execution

### 🔒 Fraud Screening
- **6-signal deterministic scoring** (no LLM overhead):
  - Name mismatch
  - Income inflation
  - Document tampering
  - Suspicious patterns
  - Age inconsistencies
  - Document timing flags

### 📊 Underwriting (Rule-Based)
- DTI/FOIR limits
- Credit score thresholds
- Employer whitelist
- LTV checks for secured loans
- Soft-reject with restructured offers

### 🏦 Multi-Lender Marketplace
- Real-time offer fetching from 5+ lenders
- Eligibility scoring per lender
- Best rate pre-selected, all options visible

### 📜 Document Generation
- Legal sanction/rejection letters (PDF)
- ReportLab + custom templates
- Digital signature workflow

### 💰 EMI Engine
- Payment history tracking
- Dynamic credit score adjustments
- Loan simulation tools

### 📊 Admin Dashboard
- Portfolio analytics (approvals, rejections, AUM)
- Lender performance metrics
- Real-time KPIs with Recharts

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       React Frontend                        │
│    ChatPane | Dashboard | LoanComparison | AdminPanel      │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────┴──────────────────────────────────────┐
│                    FastAPI Backend                         │
│            Routers + WebSocket Manager                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│              LangGraph Agent Pipeline                      │
│  Intent → Sales → Documents → KYC/Fraud → Underwriting   │
│                    → Sanction → Repayment                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                   Data & External                         │
│   MongoDB | Redis | Lenders | LLM (Gemini/Groq/Router)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Tech Stack

| Layer | Technology | Why? |
|-------|-----------|------|
| **Framework** | LangGraph | Deterministic routing, state graphs, parallel execution |
| **Backend** | FastAPI + Uvicorn | Async, WebSocket-native, auto-docs |
| **Frontend** | React 19 + Vite + Tailwind | Modern, fast, responsive |
| **Database** | MongoDB Atlas (Motor) | Document model fits loans, async drivers |
| **Cache** | Redis | LLM response caching, session TTL |
| **Vision** | Gemini 2.5 Flash | Multimodal OCR + forensics |
| **LLM** | Groq → Gemini → OpenRouter | Fallback chain for cost/speed |
| **PDF** | ReportLab | Server-side sanction letters |
| **Real-time** | WebSocket | Agent thinking indicators |

---

## 🎬 Getting Started

### Prerequisites
- **Python** 3.10+
- **Node.js** 18+
- **MongoDB Atlas** account (or local MongoDB)
- **LLM API Key** (Groq is free + fastest)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/SarangRao20/Gidfine.git
cd Gidfine

# 2. Set up backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys (GROQ_API_KEY, GEMINI_API_KEY, MONGO_URI)

# 4. Set up frontend
cd frontend && npm install && cd ..
```

### Running

**Terminal 1 — Backend**
```bash
python main.py
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

**Terminal 2 — Frontend**
```bash
cd frontend && npm run dev
# App: http://localhost:5173
```

---

## ⚙️ Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `GROQ_API_KEY` | — | Fast LLM inference (free tier available) |
| `GEMINI_API_KEY` | — | Document Vision OCR |
| `MONGO_URI` | `mock` | Database connection |
| `DISABLE_OTP` | `false` | Dev mode (uses `123456`) |
| `APP_ENV` | `development` | Environment (development/production) |
| `MIN_CREDIT_SCORE` | `700` | Underwriting threshold |
| `MAX_DTI_RATIO` | `0.50` | Max debt-to-income |

See `.env.example` for the complete list.

---

## 📚 Project Structure

```
Gidfine/
├── agents/                    # LangGraph nodes
│   ├── intent_agent.py        # Intent classification (loan/advice/kyc/payment)
│   ├── sales_agent.py         # Conversational sales (Arjun + Priya personas)
│   ├── document_agent.py      # Gemini Vision OCR + forensics
│   ├── kyc_agent.py           # Document name matching
│   ├── fraud_agent.py         # 6-signal fraud scoring
│   ├── underwriting.py        # Rule-based decisioning
│   ├── sanction_agent.py      # PDF letter generation
│   └── master_router.py       # Deterministic routing (NO LLM)
│
├── api/                       # FastAPI backend
│   ├── routers/               # 12 domain endpoints
│   ├── schemas/               # Pydantic models
│   └── core/                  # WebSocket, email, validation
│
├── frontend/                  # React + Vite
│   ├── src/components/        # ChatPane, Dashboard, etc.
│   └── src/api/               # REST + WebSocket clients
│
├── db/                        # Database layer
│   ├── database.py            # Motor async driver
│   └── schemas.py             # Data models
│
├── mock_apis/                 # Simulated services
│   ├── lenders.json           # 5 Ghana lenders with rates
│   ├── lender_apis.py         # Offer aggregation
│   └── cibil_api.py           # Credit scoring mock
│
└── utils/                     # Shared helpers
    ├── financial_rules.py     # EMI, FOIR, fraud scoring
    └── loan_ranker.py         # Multi-lender ranking
```

---

## 🔄 Example Workflow

**User**: "Hi, I need a loan"

1. **Intent Detection** → Classified as "loan"
2. **Sales Chat** → Collects: amount, tenure, purpose
3. **Lender Offers** → Fetches 5 options in parallel
4. **Document Upload** → ID + Salary slip (OCR analyzed)
5. **KYC + Fraud** → Name matching + 6-signal scoring (parallel)
6. **Underwriting** → DTI check, credit score, decision
7. **Sanction** → PDF generated, e-sign ready
8. **Disbursement** → Funds transferred in 24-48 hours

**Entire flow: ~4 minutes**

---

## 🎓 Design Philosophy

### ✅ Deterministic Routing (NOT LLM-driven)
- Router logic in `master_router.py` is **pure Python**
- Every decision is traceable and explainable
- Saves ~$0.02 per interaction
- Enables parallel execution (KYC + Fraud simultaneously)

### ✅ Auditable Underwriting
- All rules live in `agents/underwriting.py` + `utils/financial_rules.py`
- No black-box AI decisions
- Credit committee can review logic anytime

### ✅ Mock-First Development
- Every external API has a JSON-based mock
- Develop offline, no API costs
- Easy to test edge cases

### ✅ Session Resumption
- Any stage can be paused/resumed
- Full state saved to MongoDB
- Customers can pick up where they left off

---

## 📊 Performance & Limitations

### ✅ What It Does Well
- **End-to-end in ~4 minutes** (vs 3–7 days)
- **Fully deterministic** — no LLM randomness in routing
- **Parallel execution** — KYC & fraud simultaneously
- **Works offline** — mock DB + no API fallback
- **Auditable** — all rules in code, no hidden ML

### ⚠️ Current Limitations
- **Mock APIs only** — CIBIL, bank verification, lender offers are simulated
- **Document OCR** is simplified — full Vision pipeline in commented code
- **No prod auth** — sessions-based only, not JWT
- **Single-process** — agents run in-process, not as separate workers
- **PDF templates** are basic — no custom branding yet

---

## 🛣️ Roadmap

- [ ] Real API integrations (CIBIL, DigiLocker, GRA)
- [ ] JWT + OAuth2 authentication
- [ ] Celery/Redis Queue for distributed agents
- [ ] SMS/WhatsApp channel via Twilio
- [ ] Loan syndication & co-lending
- [ ] A/B testing framework for underwriting rules
- [ ] Automated repayment (Direct Debit)
- [ ] Customer mobile app

---

## 🤝 Contributing

We welcome contributions! The codebase is modular—each agent is independently testable.

### For Contributors
```bash
# Run tests
pytest -q

# With coverage
pytest --cov=agents --cov=api --cov-report=html

# Lint
ruff check .
```

### Adding a New Agent
1. Create `agents/new_agent.py`
2. Add routing logic in `master_router.py`
3. Register node in `master_graph.py`
4. Create API endpoint in `api/routers/`

### Design Tenets
- **No LLM in routing** — pure Python only
- **Every agent logs to `action_log`** — full audit trail
- **Sessions are resumable** — pause/resume anytime
- **Mock before real** — offline-first development

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

<div align="center">

**[📖 Full Documentation](#) | [🐛 Report Issues](#) | [💬 Discussions](#)**

Built with ❤️ for Ghana's lending ecosystem

</div>
