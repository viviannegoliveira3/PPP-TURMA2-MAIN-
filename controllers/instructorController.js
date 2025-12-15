const instructorService = require('../service/instructorService');
const jwt = require('jsonwebtoken');

exports.register = (req, res) => {
  const { name, email, password } = req.body;
  if (instructorService.findByEmail(email)) {
    return res.status(400).json({ error: 'Email já cadastrado.' });
  }
  const instructor = instructorService.create(name, email, password);
  res.status(201).json(instructor);
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  const instructor = instructorService.findByEmail(email);
  if (!instructor || instructor.password !== password) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }
  const token = jwt.sign({ id: instructor.id, role: instructor.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
  res.json({ token });
};

exports.getAll = (req, res) => {
  res.json(instructorService.getAll());
};