const lessonService = require('../service/lessonService');

exports.create = (req, res) => {
  const { title, description } = req.body;
  const lesson = lessonService.create(title, description);
  res.status(201).json(lesson);
};

exports.getAll = (req, res) => {
  res.json(lessonService.getAll());
};