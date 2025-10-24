import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';

let app: any;

async function createApp() {
  if (app) {
    return app;
  }

  app = await NestFactory.create(AppModule);
  
  // Set secure HTTP headers to mitigate common web risks (XSS, clickjacking, MIME sniffing)
  app.use(
    helmet({
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: false,
    }),
  );

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
  return app;
}

// For Vercel
export default async function handler(req: any, res: any) {
  const nestApp = await createApp();
  return nestApp.getHttpAdapter().getInstance()(req, res);
}

// For local development
if (process.env.NODE_ENV !== 'production') {
  createApp().then((nestApp) => {
    nestApp.listen(process.env.PORT ?? 3000);
  });
}
