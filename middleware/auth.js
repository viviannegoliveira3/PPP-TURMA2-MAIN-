const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido.' });
    req.user = user;
    next();
  });
}

function authorizeInstructor(req, res, next) {
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Acesso restrito a instrutores.' });
  }
  next();
}

function authorizeStudent(req, res, next) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Acesso restrito a alunos.' });
  }
  next();
}

module.exports = { authenticate, authorizeInstructor, authorizeStudent };
