require('dotenv').config();

const cors = require('cors');
const express = require('express');
const path = require('node:path');
const requestRoutes = require('./routes/requestRoutes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the Service Request Management API.',
    description: 'Create, view, update, and delete service requests.',
    endpoints: {
      health: 'GET /api/health',
      requests: 'GET, POST /api/requests',
      requestById: 'GET, PUT, PATCH, DELETE /api/requests/:id'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Service Request API is running.' });
});

app.use('/api/requests', requestRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Service Request API is running at http://localhost:${port}`);
});