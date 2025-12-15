const express = require('express');
const app = express();
const instructorRoutes = require('./routes/instructorRoutes');
const studentRoutes = require('./routes/studentRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const progressRoutes = require('./routes/progressRoutes');
const swaggerRoutes = require('./routes/swaggerRoutes');

app.use(express.json());

app.use('/instructors', instructorRoutes);
app.use('/students', studentRoutes);
app.use('/lessons', lessonRoutes);
app.use('/progress', progressRoutes);
app.use('/swagger', swaggerRoutes);

app.get('/', (req, res) => {
  res.send('API Progressão de Alunos de Música');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
