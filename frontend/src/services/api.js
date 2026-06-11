const API_BASE_URL = import.meta.env.VITE_API_URL || "https://kenapse-production.up.railway.app";

export const generateCourse = async (topic, level, duration, userId) => {
  const response = await fetch(`${API_BASE_URL}/course/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, level, duration, user_id: userId }),
  });
  if (!response.ok) throw new Error("Failed to generate course");
  return response.json();
};

export const getLesson = async (chapter_id, topic, level, content_text = "", userId = null) => {
  const response = await fetch(`${API_BASE_URL}/lesson/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapter_id, topic, level, content_text, user_id: userId }),
  });
  if (!response.ok) throw new Error("Failed to generate lesson");
  return response.json();
};

export const generateQuiz = async (topic, level, chapterId = null, userId = null) => {
  const response = await fetch(`${API_BASE_URL}/quiz/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, level, chapter_id: chapterId, user_id: userId }),
  });
  if (!response.ok) throw new Error("Failed to generate quiz");
  return response.json();
};

export const getQuiz = async (chapterId) => {
  const response = await fetch(`${API_BASE_URL}/quiz/${chapterId}`);
  if (!response.ok) throw new Error("Failed to fetch quiz");
  return response.json();
};

export const submitFeedback = async (chapter_id, score, attempts, topic = "", level = "intermediate", wrongAnswers = []) => {
  const response = await fetch(`${API_BASE_URL}/feedback/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapter_id, score, attempts, topic, level, wrong_answers: wrongAnswers }),
  });
  if (!response.ok) throw new Error("Failed to submit feedback");
  return response.json();
};

export const chatWithTutor = async (message, userContext, chapterId = null, userId = null, materialId = null) => {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      user_context: userContext,
      chapter_id: chapterId,
      user_id: userId,
      material_id: materialId,
    }),
  });
  if (!response.ok) throw new Error("Failed to chat");
  return response.json();
};

export const exportPdf = async (lessonData) => {
  const response = await fetch(`${API_BASE_URL}/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lessonData),
  });
  if (!response.ok) throw new Error("Failed to export PDF");
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lesson_export.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const getChapters = async (materialId) => {
  const response = await fetch(`${API_BASE_URL}/course/${materialId}`);
  if (!response.ok) throw new Error("Failed to fetch chapters");
  return response.json();
};

export const updateChapterStatus = async (chapterId, status) => {
  const response = await fetch(`${API_BASE_URL}/course/chapter/${chapterId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error("Failed to update chapter status");
  return response.json();
};

export const getUserCourses = async (userId) => {
  const response = await fetch(`${API_BASE_URL}/materials/user/${userId}`);
  if (!response.ok) throw new Error("Failed to fetch user courses");
  return response.json();
};

export const deleteCourse = async (materialId) => {
  const response = await fetch(`${API_BASE_URL}/materials/${materialId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete course");
  return response.json();
};

export const processMaterial = async (fileUrl, fileName, userId) => {
  const response = await fetch(`${API_BASE_URL}/materials/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_url: fileUrl, file_name: fileName, user_id: userId }),
  });
  if (!response.ok) throw new Error("Failed to process material");
  return response.json();
};
