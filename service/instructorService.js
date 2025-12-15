const instructors = [];
const Instructor = require('../model/instructor');

module.exports = {
  create: (name, email, password) => {
    const id = instructors.length + 1;
    const instructor = new Instructor(id, name, email, password);
    instructors.push(instructor);
    return instructor;
  },
  findByEmail: (email) => instructors.find(i => i.email === email),
  getAll: () => instructors,
};