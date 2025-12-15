const progressService = require('../service/progressService');
const lessonService = require('../service/lessonService');

exports.addProgress = (req, res) => {
  const { studentId, lessonId } = req.body;
  const lesson = lessonService.findById(lessonId);
  if (!lesson) {
    return res.status(404).json({ error: 'Lição não encontrada.' });
  }
  const entry = progressService.addProgress(studentId, lessonId);
  res.status(201).json(entry);
};

exports.getStudentProgress = (req, res) => {
  const studentId = req.params.studentId;
  const progress = progressService.getStudentProgress(Number(studentId));
  res.json(progress);
};