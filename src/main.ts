import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { HttpErrorFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 4000;

  app.enableCors();
  app.useGlobalFilters(new HttpErrorFilter());

  // --- CONFIGURACIÓN DE SWAGGER ---
  const config = new DocumentBuilder()
    .setTitle('Kamux API')
    .setDescription('Documentación oficial del ecosistema multimedia Kamux')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT', // Indica a Swagger que maneje tokens JWT estándar
        name: 'JWT',
        description: 'Introduce tu token JWT de acceso sin la palabra Bearer',
        in: 'header',
      },
      'bearer', // Este es el ID clave que conecta la seguridad con los endpoints
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(port);
  console.log(`🚀 Kamux Backend corriendo en: http://localhost:${port}`);
  console.log(
    `📄 Documentación API disponible en: http://localhost:${port}/api`,
  );
}
bootstrap();
