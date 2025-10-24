const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const helmet = require('helmet');
const { ExpressAdapter } = require('@nestjs/platform-express');
const express = require('express');

let cachedApp;

async function createApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  
  // Set secure HTTP headers to mitigate common web risks (XSS, clickjacking, MIME sniffing)
  app.use(helmet({
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    contentSecurityPolicy: false,
  }));

  // Only allow requests from known frontend origins (adjust via env FRONTEND_ORIGIN)
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_ORIGIN,
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.init();
  cachedApp = expressApp;
  return expressApp;
}

// For Vercel serverless functions
module.exports = async function handler(req, res) {
  const app = await createApp();
  return app(req, res);
};
