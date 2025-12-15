class Instructor {
  constructor(id, name, email, password) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.password = password;
    this.role = 'instructor';
  }
}
module.exports = Instructor;