const express = require('express');
const { createClient } = require('redis');
const path = require('path');
const client = require('prom-client');  // Agregamos Prometheus

const app = express();
const port = 3000;

// Configuración de Redis
const redisClient = createClient({
  url: 'redis://redis:6379',
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Configuración de métricas de Prometheus
client.collectDefaultMetrics();
const taskAddedCounter = new client.Counter({
  name: 'tasks_added_total',
  help: 'Total de tareas agregadas',
});
const taskStateChangeCounter = new client.Counter({
  name: 'tasks_state_changes_total',
  help: 'Total de cambios de estado de tareas',
});
const taskDeletedCounter = new client.Counter({
  name: 'tasks_deleted_total',
  help: 'Total de tareas eliminadas',
});


// Middleware para parsear JSON
app.use(express.json());

// Variable de entorno para identificar la instancia
const instanceId = process.env.INSTANCE_ID || 'default-instance';

// Configurar EJS como motor de plantillas y especificar la ubicación de las vistas en `src`
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname)); // Definimos `src` como carpeta de vistas

// Sirviendo archivos estáticos (como el CSS y JS)
app.use(express.static(path.join(__dirname)));

// Ruta para servir el `index.ejs` con la instancia inyectada
app.get('/', (req, res) => {
  res.render('index', { instanceId });
});

// Ruta para exponer las métricas a Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
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
  if (!task) return res.status(400).json({ error: 'Falta el campo "task"' });

  try {
    await redisClient.rPush('todos', task);
    taskAddedCounter.inc(); // Incrementa el contador de tareas agregadas
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
    taskStateChangeCounter.inc(); // Incrementa el contador de cambios de estado
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
    taskStateChangeCounter.inc(); // Incrementa el contador de cambios de estado
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
    taskDeletedCounter.inc(); // Incrementa el contador de tareas eliminadas
    res.json({ message: 'Tarea eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la tarea' });
  }
});

// Conectar a Redis y arrancar el servidor
(async () => {
  await redisClient.connect();
  app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port} - Instancia: ${instanceId}`);
  });
})();

// Ruta para realizar una tarea intensiva de CPU
app.get('/cpu-intensive-task', (req, res) => {
  const iterations = parseInt(req.query.iterations) || 1e7; // Valor por defecto: 10 millones
  const start = Date.now();

  // Operación intensiva (ejemplo: multiplicaciones repetitivas)
  let result = 1;
  for (let i = 1; i <= iterations; i++) {
      result *= i;
      result %= 1e9; // Limita el tamaño para evitar que se haga demasiado grande
  }

  const duration = (Date.now() - start) / 1000;
  console.log(`Tarea intensiva completada en ${duration} segundos para ${iterations} iteraciones.`);
  res.send(`Tarea intensiva completada en ${duration} segundos para ${iterations} iteraciones.`);
});