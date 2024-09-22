const express = require('express');
const { createClient } = require('redis');
const path = require('path');

// Inicializa la aplicación Express
const app = express();
const port = 3000;

// Configuración de Redis
const redisClient = createClient({
  url: 'redis://redis:6379',
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Middleware para parsear JSON
app.use(express.json());

// Sirviendo archivos estáticos (como el CSS)
app.use(express.static(path.join(__dirname)));

// Sirviendo el archivo index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para obtener todas las tareas
app.get('/todos', async (req, res) => {
  try {
    const todos = await redisClient.lRange('todos', 0, -1);
    res.json(todos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las tareas' });
  }
});

// Ruta para agregar una tarea
app.post('/todos', async (req, res) => {
  const { task } = req.body;
  if (!task) {
    return res.status(400).json({ error: 'Falta el campo "task"' });
  }

  try {
    await redisClient.rPush('todos', task);
    res.status(201).json({ message: 'Tarea agregada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar la tarea' });
  }
});

// Ruta para completar una tarea (marcarla como completada)
app.put('/todos/:index/complete', async (req, res) => {
  try {
    const index = req.params.index;
    const todos = await redisClient.lRange('todos', 0, -1);
    const completedTask = `✅ ${todos[index]}`;
    await redisClient.lSet('todos', index, completedTask);
    res.json({ message: 'Tarea completada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al completar la tarea' });
  }
});

// Ruta para deshacer una tarea completada (quitar el "✅")
app.put('/todos/:index/undo', async (req, res) => {
  try {
    const index = req.params.index;
    const todos = await redisClient.lRange('todos', 0, -1);
    const task = todos[index].replace('✅ ', ''); // Quitar el "✅"
    await redisClient.lSet('todos', index, task);
    res.json({ message: 'Tarea deshecha' });
  } catch (error) {
    res.status(500).json({ error: 'Error al deshacer la tarea' });
  }
});

// Ruta para eliminar una tarea
app.delete('/todos/:index', async (req, res) => {
  try {
    const index = req.params.index;
    const todos = await redisClient.lRange('todos', 0, -1);
    const taskToDelete = todos[index];
    
    // Remover la tarea por su valor
    await redisClient.lRem('todos', 1, taskToDelete);
    res.json({ message: 'Tarea eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la tarea' });
  }
});

// Conectar a Redis y arrancar el servidor
(async () => {
  await redisClient.connect();
  app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });
})();
