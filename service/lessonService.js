const lessons = [];
const Lesson = require('../model/lesson');

module.exports = {
  create: (title, description) => {
    const id = lessons.length + 1;
    const lesson = new Lesson(id, title, description);
    lessons.push(lesson);
    return lesson;
  },
  getAll: () => lessons,
  findById: (id) => lessons.find(l => l.id === id),
};