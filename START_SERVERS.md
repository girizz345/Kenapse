# 🚀 Quick Start Cheat Sheet

## Backend Server

**Terminal Command:**
```powershell
cd c:\Users\giris\Girish\Entrans\backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir .
```

**Expected Output:**
```
INFO:     Will watch for changes in these directories: ['C:\\Users\\giris\\Girish\\Entrans\\backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

**Access Backend:** http://127.0.0.1:8000

---

## Frontend Server

**Terminal Command:**
```powershell
cd c:\Users\giris\Girish\Entrans\frontend
npm run dev
```

**Expected Output:**
```
VITE v... ready in ... ms

➜  Local:   http://localhost:5173/
```

**Access Frontend:** http://localhost:5173

---

## ✅ Both Running

Once both servers are running, you can:
1. Open http://localhost:5173 in your browser
2. Upload files to test the feature

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend won't start | Make sure you're in `backend` folder and use the full path to `python.exe` |
| Frontend won't start | Make sure you're in `frontend` folder and npm is installed |
| "Cannot connect to backend" | Check backend is running on http://127.0.0.1:8000 and port 8000 is listening |
| Port 8000 already in use | Kill process: `Get-Process -Id 7516 \| Stop-Process` (replace 7516 with actual PID) |

---

## 📝 Ports Reference

- **Backend:** http://127.0.0.1:8000
- **Frontend:** http://localhost:5173
