const students = [];
const Student = require('../model/student');

module.exports = {
  create: (name, email, password) => {
    const id = students.length + 1;
    const student = new Student(id, name, email, password);
    students.push(student);
    return student;
  },
  findByEmail: (email) => students.find(s => s.email === email),
  getAll: () => students,
};