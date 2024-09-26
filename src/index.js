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

// Variable de entorno para identificar la instancia
const instanceId = process.env.INSTANCE_ID || 'default-instance';

// Sirviendo archivos estáticos (como el CSS)
app.use(express.static(path.join(__dirname)));

// Sirviendo el archivo index.html con la instancia inyectada
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lista de ToDos</title>
        <link rel="stylesheet" href="styles.css">
        <style>
            .instance-label {
                position: fixed;
                top: 10px;
                right: 10px;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 5px;
                font-size: 12px;
                display: flex;
                align-items: center;
            }
            .refresh-btn {
                background-color: #f0f0f0;
                border: none;
                border-radius: 3px;
                margin-left: 10px;
                padding: 5px;
                cursor: pointer;
            }
            .refresh-btn:hover {
                background-color: #ddd;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Lista de ToDos</h1>
            <form id="todoForm">
                <input type="text" id="todoInput" placeholder="Nueva tarea" required />
                <button type="submit">Agregar</button>
            </form>
            <h2>Tareas</h2>
            <ul id="todoList"></ul>
        </div>

        <!-- Etiqueta que muestra la instancia -->
        <div class="instance-label" id="instanceLabel">
            <span id="instanceText">${instanceId}</span>
        </div>

        <script>
            const form = document.getElementById('todoForm');
            const todoList = document.getElementById('todoList');

            // Función para obtener los ToDos desde el backend
            const fetchTodos = async () => {
                const response = await fetch('/todos');
                const todos = await response.json();
                todoList.innerHTML = '';
                todos.forEach((todo, index) => {
                    const isCompleted = todo.startsWith('✅');
                    const li = document.createElement('li');
                    li.innerHTML = \`
                        <span>\${todo}</span>
                        <button class="complete-btn" onclick="completeTodo(\${index}, '\${todo}')">
                            \${isCompleted ? '↩️' : '✔'}
                        </button>
                        <button class="delete-btn" onclick="deleteTodo(\${index})">🗑</button>
                    \`;
                    todoList.appendChild(li);
                });
            };

            // Llamada inicial para cargar los ToDos al cargar la página
            fetchTodos();

            // Función para agregar un ToDo
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const todo = document.getElementById('todoInput').value;

                // Enviar el nuevo ToDo al backend
                await fetch('/todos', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ task: todo }),
                });

                // Limpiar el input y recargar la lista de ToDos
                document.getElementById('todoInput').value = '';
                fetchTodos();
            });

            // Función para completar o deshacer un ToDo
            const completeTodo = async (index, task) => {
                const isCompleted = task.startsWith('✅');
                const url = \`/todos/\${index}/\${isCompleted ? 'undo' : 'complete'}\`;
                await fetch(url, { method: 'PUT' });
                fetchTodos();
            };

            // Función para eliminar un ToDo
            const deleteTodo = async (index) => {
                await fetch(\`/todos/\${index}\`, { method: 'DELETE' });
                fetchTodos();
            };
        </script>
    </body>
    </html>
  `);
});

// Otras rutas para manejar ToDos (agregar, completar, eliminar)
// (Ya las tienes definidas en tu código)

// Conectar a Redis y arrancar el servidor
(async () => {
  await redisClient.connect();
  app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port} - Instancia: ${instanceId}`);
  });
})();
