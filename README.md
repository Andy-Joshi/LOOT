# LOOT — Gamified Teen Money & Smart Buy App

LOOT is a gamified personal finance and smart shopping app designed for teens, featuring simulated money, parent involvement, central balance accounting, shortfall tracking, and real-time retailer price comparison.

---

## Running LOOT & Smart Buy Services

LOOT runs on port `5173`, with its central ledger API on port `3001`, and communicates with the Smart Buy Comparison Engine backend running on port `5000`.

### 1. Run Everything Together (One Command)

From the `LOOT` root directory:
```bash
npm run dev:all
```
This concurrently starts:
- LOOT Frontend (`http://localhost:5173`)
- LOOT Backend Server (`http://localhost:3001`)
- Smart Buy Backend Server (`http://localhost:5000`)

### 2. Or Run Services Individually

**Terminal 1 — Smart Buy Comparison Engine Backend (Port 5000):**
```bash
cd /home/andy/Documents/smart-buy-lab/backend
npm start
# Or from LOOT: npm run smartbuy:backend
```

**Terminal 2 — LOOT Backend Server (Port 3001):**
```bash
cd /home/andy/Documents/LOOT
npm run server
```

**Terminal 3 — LOOT Frontend Client (Port 5173):**
```bash
cd /home/andy/Documents/LOOT
npm run dev:client
```

---

## Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `VITE_SMARTBUY_API_URL` | `http://localhost:5000` | Smart Buy comparison engine backend URL |
| `VITE_API_URL` | `http://localhost:3001` | LOOT main ledger and accounting backend URL |

Vite automatically proxies `/api/smartbuy/*` to `http://localhost:5000/api/*` during local development to avoid CORS restrictions.

---

## Testing & Quality Assurance

Run the test suite across all engines and components:
```bash
npm test
```

Check code quality and production build:
```bash
npm run lint
npm run build
```
