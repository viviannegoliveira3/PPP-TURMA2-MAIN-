const progress = [];
const StudentLessonProgress = require('../model/studentLessonProgress');

module.exports = {
  addProgress: (studentId, lessonId) => {
    const completedAt = new Date();
    const entry = new StudentLessonProgress(studentId, lessonId, completedAt);
    progress.push(entry);
    return entry;
  },
  getStudentProgress: (studentId) => progress.filter(p => p.studentId === studentId),
  getAll: () => progress,
};