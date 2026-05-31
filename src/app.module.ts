import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';

// Importación automática de los módulos generados por el CLI
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { SongsModule } from './songs/songs.module';
import { LyricsModule } from './lyrics/lyrics.module';

@Module({
  imports: [
    // 1. Carga las variables de entorno usando nuestro archivo de configuración
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true, // Hace que las variables estén disponibles en todo el proyecto sin reimportar
    }),

    // 2. Conexión asíncrona a PostgreSQL leyendo los datos validados del .env
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        autoLoadEntities: true, // Carga automáticamente las tablas (*.entity.ts)
        synchronize: true,
      }),
    }),

    // 3. Módulos de la aplicación
    AuthModule,
    UsersModule,
    PlaylistsModule,
    SongsModule,
    LyricsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
