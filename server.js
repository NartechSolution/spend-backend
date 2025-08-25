// src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const morgan = require('morgan');
require('express-async-errors');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const accountRoutes = require('./src/routes/accountRoutes');
const cardRoutes = require('./src/routes/cardRoutes');
const transactionRoutes = require('./src/routes/transactionRoutes');
const loanRoutes = require('./src/routes/loanRoutes');
const investmentRoutes = require('./src/routes/investmentRoutes');
const invoiceRoutes = require('./src/routes/invoiceRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const subscriptionRoute = require("./src/routes/subscriptionRoute")
const checkoutRoute = require('./src/routes/checkoutRoute');
const appAuthRoute = require('./src/routes/appAuthRoute')
const serviceRoute = require('./src/routes/servicesRoute')

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');
const { generalLimiter } = require('./src/middleware/rateLimiter');

// Import cron service
const CronService = require('./src/services/cronServices');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors()); 

// General middleware
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
const apiVersion = process.env.API_VERSION || 'v1';
app.use(`/api/${apiVersion}/auth`, authRoutes);
app.use(`/api/${apiVersion}/users`, userRoutes);
app.use(`/api/${apiVersion}/accounts`, accountRoutes);
app.use(`/api/${apiVersion}/cards`, cardRoutes);
app.use(`/api/${apiVersion}/transactions`, transactionRoutes);
app.use(`/api/${apiVersion}/loans`, loanRoutes);
app.use(`/api/${apiVersion}/investments`, investmentRoutes);
app.use(`/api/${apiVersion}/invoices`, invoiceRoutes);
app.use(`/api/${apiVersion}/dashboard`, dashboardRoutes);
app.use(`/api/${apiVersion}/subscriptions`, subscriptionRoute)
app.use(`/api/${apiVersion}/app-auth`, appAuthRoute);
app.use(`/api/${apiVersion}/services`, serviceRoute);
// checkout routes

app.use(`/api/${apiVersion}/checkout`, checkoutRoute);


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize cron service
const cronService = new CronService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  cronService.stop();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  cronService.stop();
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
    
    // Start cron service
    cronService.start();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();