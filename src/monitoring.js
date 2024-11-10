const axios = require('axios');
const client = require('prom-client');

// Define métricas de Prometheus
const cpuUsageGauge = new client.Gauge({
    name: 'container_cpu_usage_percent',
    help: 'CPU usage percent for container',
    labelNames: ['container']
});
const memoryUsageGauge = new client.Gauge({
    name: 'container_memory_usage_mb',
    help: 'Memory usage in MB for container',
    labelNames: ['container']
});

// Configuración de métricas automáticas
client.collectDefaultMetrics();

// Función para obtener todos los IDs de contenedores
async function getAllContainerIDs() {
    try {
        const response = await axios.get('http://cadvisor:8080/api/v1.3/docker/');
        return Object.keys(response.data);
    } catch (error) {
        console.error('Error al obtener IDs de contenedores desde cAdvisor:', error.message);
        return [];
    }
}

// Función para obtener métricas de cAdvisor para un contenedor específico
async function getContainerStats(containerID) {
    try {
        // URL de cAdvisor para las métricas del contenedor específico
        const response = await axios.get(`http://cadvisor:8080/api/v1.3/docker/${containerID}`);
        
        // Verifica que stats esté definido y no vacío
        const stats = response.data.stats;
        if (!stats || stats.length === 0) {
            console.error(`No se encontraron estadísticas para ${containerID}. Verifique que el contenedor esté corriendo y que cAdvisor esté configurado correctamente.`);
            return;
        }

        // Utilizar la lectura más reciente
        const latestStats = stats[stats.length - 1];

        // Calcular el uso de CPU si existen los datos necesarios
        if (latestStats.cpu && latestStats.cpu.usage) {
            const cpuUsage = latestStats.cpu.usage.total;
            const prevCpuUsage = stats[stats.length - 2]?.cpu.usage.total || 0;
            const systemCpuUsage = latestStats.cpu.usage.system || 1;
            const cpuPercent = ((cpuUsage - prevCpuUsage) / systemCpuUsage) * 100;
            cpuUsageGauge.set({ container: containerID }, cpuPercent);
        } else {
            console.warn(`Datos de CPU no disponibles para ${containerID}`);
        }

        // Calcular el uso de memoria en MB si existen los datos
        if (latestStats.memory && latestStats.memory.usage) {
            const memoryUsageMb = latestStats.memory.usage / (1024 * 1024);
            memoryUsageGauge.set({ container: containerID }, memoryUsageMb);
        } else {
            console.warn(`Datos de memoria no disponibles para ${containerID}`);
        }

    } catch (error) {
        console.error(`Error al obtener estadísticas de ${containerID} desde cAdvisor: ${error.message}`);
    }
}

// Función para actualizar las métricas de todos los contenedores
async function updateAllContainerStats() {
    const containerIDs = await getAllContainerIDs();
    for (const id of containerIDs) {
        await getContainerStats(id);
    }
}

// Llama a `updateAllContainerStats` en intervalos regulares
setInterval(updateAllContainerStats, 10000); // Actualiza cada 10 segundos

// Exportar las métricas
module.exports = {
    metrics: client.register
};
