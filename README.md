# Kenapse - AI-Powered Adaptive Learning Platform

Kenapse is a personalized AI tutor that generates courses, lessons, and quizzes based on user topics, adapting to their learning level and offering a personalized AI chatbot using RAG.

## Folder Structure

```
Entrans/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI entry point
│   │   ├── routes/                # API routes (course, lesson, quiz, feedback, chat, export)
│   │   ├── services/              # Business logic (LLM, RAG, PDF export)
│   │   └── models/                # Pydantic and SQLAlchemy models
│   ├── requirements.txt           # Python dependencies
│   └── venv/                      # Virtual environment
├── frontend/
│   ├── src/
│   │   ├── components/            # Reusable UI components (Chatbot, etc.)
│   │   ├── pages/                 # Full pages (Landing, Auth, Dashboard, CourseFlow, Lesson, Quiz)
│   │   ├── services/              # API interaction logic
│   │   ├── styles/                # Vanilla CSS with glassmorphism design system
│   │   ├── App.jsx                # React Router setup
│   │   └── main.jsx               # React entry point
│   ├── index.html
│   ├── package.json               # Node.js dependencies
│   └── vite.config.js
└── README.md
```

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- Google Gemini API Key

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Activate the virtual environment (created automatically by the agent):
   ```bash
   # Windows
   .\venv\Scripts\activate
   # Linux/Mac
   source venv/bin/activate
   ```
3. Set your Gemini API Key as an environment variable:
   ```bash
   # Windows
   set GEMINI_API_KEY=your_actual_api_key
   # Linux/Mac
   export GEMINI_API_KEY="your_actual_api_key"
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload
   ```
   The backend will be available at `http://localhost:8000`.

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser and go to the URL provided by Vite (usually `http://localhost:5173`).

## Usage
- Enter any topic in the Dashboard (e.g., "Quantum Physics", "French Revolution").
- The AI will generate a structured course path.
- Follow the path to read lessons and take interactive quizzes.
- If you need help, open the Chatbot in the bottom right corner of the lesson or quiz view.
- Export lessons as PDF documents using the "Export PDF" button.
