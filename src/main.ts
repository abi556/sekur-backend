import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Security headers: CSP, X-Frame-Options, HSTS, X-Content-Type-Options
  const frontendOrigin = (process.env.FRONTEND_ORIGIN as string) || '';
  app.use(helmet());
  app.use(
    helmet.contentSecurityPolicy({
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "block-all-mixed-content": [],
        "font-src": ["'self'", 'https:', 'data:'],
        "frame-ancestors": ["'none'"],
        "img-src": ["'self'", 'https:', 'data:'],
        "object-src": ["'none'"],
        "script-src": ["'self'"],
        "script-src-attr": ["'none'"],
        "style-src": ["'self'", 'https:', "'unsafe-inline'"],
        "connect-src": ["'self'", frontendOrigin || "'self'"],
      },
    })
  );
  app.use(helmet.frameguard({ action: 'deny' }));
  app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true, preload: true }));
  app.use(helmet.noSniff());
  app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));

  // Only allow requests from known frontend origins (adjust via env FRONTEND_ORIGIN)
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_ORIGIN as string,
    ].filter(Boolean) as string[],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
