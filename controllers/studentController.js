const studentService = require('../service/studentService');
const jwt = require('jsonwebtoken');

exports.register = (req, res) => {
  const { name, email, password } = req.body;
  if (studentService.findByEmail(email)) {
    return res.status(400).json({ error: 'Email já cadastrado.' });
  }
  const student = studentService.create(name, email, password);
  res.status(201).json(student);
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  const student = studentService.findByEmail(email);
  if (!student || student.password !== password) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }
  const token = jwt.sign({ id: student.id, role: student.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
  res.json({ token });
};

exports.getAll = (req, res) => {
  res.json(studentService.getAll());
};