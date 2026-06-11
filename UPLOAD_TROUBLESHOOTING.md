# File Upload "Failed to Fetch" Troubleshooting Guide

## ✅ Changes Made

I've fixed the error handling in your application:

### Backend Changes:
1. **`backend/app/services/material_processor.py`** - Added comprehensive logging and error handling
2. **`backend/app/routes/materials.py`** - Improved error responses with detailed messages
3. **`backend/app/main.py`** - Added logging configuration

### Frontend Changes:
1. **`frontend/src/components/StudyMaterialUpload.jsx`** - Enhanced error messages and network error detection

## 🔧 How to Debug

### Step 1: Start the Backend Server

Open a terminal in the `backend` folder and run:

```bash
python -m uvicorn app.main:app --reload --log-level info
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 2: Check Your Environment Variables

Verify `.env` file has these variables:
```
GEMINI_API_KEY=<your_key>
SUPABASE_URL=<your_url>
SUPABASE_ANON_KEY=<your_key>
SUPABASE_SERVICE_ROLE_KEY=<your_key>
```

### Step 3: Try the Upload Again

1. Open the frontend (likely `http://localhost:5173` or similar)
2. Try uploading a file
3. **Check two places for errors:**

#### Check Backend Terminal:
Look for error messages like:
```
ERROR: Supabase client not initialized
ERROR: Failed to parse LLM response as JSON
ERROR: Processing error: ...
```

#### Check Frontend Console:
Press `F12` → Go to "Console" tab → Look for error messages

## 🎯 Common Error Messages & Solutions

### Error: "Cannot connect to backend server at http://localhost:8000"
**Cause:** Backend server is not running  
**Solution:** Run the backend server (see Step 1 above)

### Error: "Backend error (500): ..."
**Cause:** Server-side error during processing  
**Solution:** Check backend terminal output for detailed error

### Error: "Backend error (400): ..."
**Cause:** Invalid request data  
**Solution:** Check that file_url and file_name are being sent correctly

### Error: "Cannot resolve nonexistent file" (in Supabase)
**Cause:** Supabase tables don't exist or credentials are wrong  
**Solution:** 
1. Check Supabase credentials in `.env`
2. Verify these tables exist in Supabase:
   - `study_materials`
   - `chapters`
   - `quizzes`

### Error: "Supabase client not initialized"
**Cause:** Missing Supabase credentials  
**Solution:** Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to `.env`

## 📋 Verification Checklist

Before uploading, verify:

- [ ] Backend server is running (`python -m uvicorn app.main:app --reload`)
- [ ] Backend shows "Uvicorn running on http://127.0.0.1:8000"
- [ ] Frontend is running on a different port (e.g., 5173)
- [ ] `.env` file has all required keys
- [ ] Supabase credentials are correct
- [ ] You can access http://localhost:8000 in browser (should show welcome message)

## 🧪 Quick Test

Open a browser and visit: `http://localhost:8000/`

You should see:
```json
{"message": "Welcome to Kenapse API"}
```

If you see "Cannot reach this page", the backend is not running.

## 📊 Expected Upload Flow

1. File selected ✓
2. Upload to Supabase Storage ✓
3. Backend receives file_url and processes it ✓
4. LLM generates chapters ✓
5. Chapters saved to Supabase ✓
6. Frontend fetches chapters and redirects to course ✓

## 🆘 Still Having Issues?

1. Run backend with this command to see all details:
   ```bash
   python -m uvicorn app.main:app --reload --log-level debug
   ```

2. Check the **exact error message** in:
   - Backend terminal output
   - Browser console (F12 → Console tab)

3. Share these errors for better diagnosis

## 📝 Notes

- The upload process is synchronous (not in background) so it may take a few seconds
- Files are first uploaded to Supabase Storage, then processed by the backend
- The backend generates mock text content (not actually extracting from PDF yet)
- Gemini API might have rate limits; check logs if processing fails
