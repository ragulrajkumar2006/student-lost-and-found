#!/bin/bash
# One-command launcher for the Lost & Found demo.
#   ./start.sh          start everything, open the browser, Ctrl+C stops it all
#   ./start.sh --dev    run the frontend in dev mode (slower, hot reload)
#   ./start.sh --stop   stop anything left running from an earlier start
cd "$(dirname "$0")" || exit 1
ROOT=$(pwd)
LOGS="$ROOT/.run-logs"
mkdir -p "$LOGS"

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
step()  { printf '\033[1m==> %s\033[0m\n' "$*"; }

stop_port() {
    local pids
    pids=$(lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null)
    [ -n "$pids" ] && kill $pids 2>/dev/null
}

stop_all() {
    for p in 3000 5001 8001; do stop_port "$p"; done
}

if [ "$1" = "--stop" ]; then
    stop_all
    green "Stopped frontend, backend and embedding service (Qdrant and MySQL left running)."
    exit 0
fi

MODE=prod
[ "$1" = "--dev" ] && MODE=dev

# wait_for <name> <url> <seconds>
wait_for() {
    local i
    for ((i = 0; i < $3; i++)); do
        curl -fs "$2" >/dev/null 2>&1 && return 0
        sleep 1
    done
    red "$1 did not come up in $3 s. See $LOGS"
    return 1
}

cleanup() {
    echo
    step "Stopping services..."
    stop_all
    green "Done. (Docker/Qdrant and MySQL keep running; that is fine.)"
    exit 0
}
trap cleanup INT TERM

step "Checking files"
[ -f backend/.env ] || { red "backend/.env is missing. Copy backend/.env.example and fill in your MySQL password."; exit 1; }
[ -x venv/bin/uvicorn ] || { red "venv not found. Run: python3 -m venv venv && ./venv/bin/pip install -r embedding-service/requirements.txt"; exit 1; }

step "1/5 MySQL"
if ! mysql --login-path=client -e "SELECT 1" >/dev/null 2>&1 && ! lsof -iTCP:3306 -sTCP:LISTEN >/dev/null 2>&1; then
    brew services start mysql >/dev/null 2>&1
    sleep 4
fi
lsof -iTCP:3306 -sTCP:LISTEN >/dev/null 2>&1 && green "MySQL is running" || { red "MySQL is not running. Try: brew services start mysql"; exit 1; }

step "2/5 Qdrant (Docker)"
if ! docker info >/dev/null 2>&1; then
    echo "Starting Docker Desktop (this can take about 30 s)..."
    open -a Docker
    for ((i = 0; i < 90; i++)); do docker info >/dev/null 2>&1 && break; sleep 2; done
fi
docker info >/dev/null 2>&1 || { red "Docker did not start. Open Docker Desktop manually and re-run."; exit 1; }
docker start qdrant >/dev/null 2>&1
wait_for "Qdrant" "http://localhost:6333/collections" 30 || exit 1
green "Qdrant is running"

step "3/5 Embedding service (port 8001)"
stop_port 8001
./venv/bin/uvicorn app:app --app-dir embedding-service --port 8001 >"$LOGS/embedding.log" 2>&1 &
wait_for "Embedding service" "http://localhost:8001/health" 90 || exit 1
green "Embedding service is running"

step "4/5 Backend (port 5001)"
stop_port 5001
(cd backend && exec node server.js) >"$LOGS/backend.log" 2>&1 &
wait_for "Backend" "http://localhost:5001/api/health" 30 || exit 1
green "Backend is running"

step "5/5 Frontend (port 3000, $MODE mode)"
stop_port 3000
if [ "$MODE" = "prod" ]; then
    if [ ! -d frontend/.next ]; then
        echo "First run: building the frontend (about a minute)..."
        (cd frontend && npx next build) >"$LOGS/frontend-build.log" 2>&1 || { red "Build failed. See $LOGS/frontend-build.log"; exit 1; }
    fi
    (cd frontend && exec npx next start -p 3000) >"$LOGS/frontend.log" 2>&1 &
else
    (cd frontend && exec npx next dev -p 3000) >"$LOGS/frontend.log" 2>&1 &
fi
wait_for "Frontend" "http://localhost:3000" 60 || exit 1
green "Frontend is running"

echo
curl -s http://localhost:5001/api/health; echo
echo
green "Everything is up:  http://localhost:3000"
cat <<'EOF'

  Student : arun@gmail.com      / Student@123
  Admin   : admin@college.edu   / Admin@123

  Press Ctrl+C here to stop the app.
EOF
open http://localhost:3000
wait
