import {
  Controller,
  Get,
  Query,
  Param,
  Res,
  UseGuards,
  Req,
  Post,
  Body,
  Headers as NestHeaders,
} from '@nestjs/common';
import { SongsService } from './songs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Response, Request } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent'; // 🚀 Importación del agente SOCKS5 para Cloudflare WARP

@ApiBearerAuth('bearer')
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Get('search')
  @UseGuards(JwtAuthGuard) // 🛡️ Protegido
  async search(@Query('query') query: string) {
    return this.songsService.searchOnYouTube(query || '');
  }

  /**
   * 🚀 ENDPOINT DE RECOMENDACIONES ESTILO YOUTUBE MUSIC
   * Obtiene una lista de hasta 30 canciones directamente relacionadas con el track actual.
   * Utiliza el ID multimedia como semilla para alimentar el algoritmo de reproducción continua.
   */
  @Get('related/:id')
  @UseGuards(JwtAuthGuard) // 🛡️ Protegido
  async getRelatedSongs(@Param('id') id: string) {
    console.log(
      `[🎶 Kamux Algoritmo] Solicitando tracks recomendados para la semilla: ${id}`,
    );
    return this.songsService.getRelatedSongs(id);
  }

  /**
   * 🚀 TUNEL PROXY PREMIUM MULTIMEDIA: Soporta peticiones de rango binario (HTTP 206)
   * Permite que la barra de progreso en Angular funcione fluida sin reinicios al inicio.
   * 🌐 ACCESO PÚBLICO: Exento de Guard para evitar bloqueos por falta de cabeceras en peticiones nativas del navegador.
   */
  @Get('stream/:id')
  async streamAudio(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const directStreamUrl = await this.songsService.getAudioStreamUrl(id);

      // Capturamos el rango que solicita la etiqueta Audio de HTML5
      const clientRange = req.headers.range;
      const axiosHeaders: Record<string, string> = {};

      if (clientRange) {
        console.log(
          `[🔊 Kamux Stream] Cliente solicita rango multimedia: ${clientRange}`,
        );
        axiosHeaders['Range'] = clientRange;
      }

      // 🌐 Creamos el agente SOCKS5 apuntando al puerto exacto amarrado a Cloudflare WARP
      const proxyAgent = new SocksProxyAgent('socks5://127.0.0.1:40000');

      // Despachamos la petición a los servidores de Google pasando el rango dinámico y el agente
      const response = await axios({
        method: 'get',
        url: directStreamUrl,
        responseType: 'stream',
        headers: axiosHeaders,
        timeout: 15000,
        // 🔒 Inyección quirúrgica: Fuerza a Axios a pedir los bytes con la misma IP que usó el microservicio
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
      });

      const contentType = response.headers['content-type'];
      const safeContentType =
        typeof contentType === 'string' ? contentType : 'audio/webm';

      // Sincronizamos las cabeceras multimedia de vuelta al cliente de Angular
      res.setHeader('Content-Type', safeContentType);
      res.setHeader('Accept-Ranges', 'bytes');

      // 🛡️ SOLUCIÓN ANTIBUG TS2345: Forzamos la conversión a String plano para que compile limpio en NestJS
      if (response.headers['content-range']) {
        res.setHeader(
          'Content-Range',
          String(response.headers['content-range']),
        );
      }
      if (response.headers['content-length']) {
        res.setHeader(
          'Content-Length',
          String(response.headers['content-length']),
        );
      }

      // Si hay rango parcial, le respondemos a Angular con el código de estado 206 oficial
      const statusCode = clientRange ? 206 : 200;
      res.status(statusCode);

      // 🛡️ CAPTURA DE ABORTO RÁPIDA: Si el usuario cambia de track, destruye la tubería de red de inmediato
      res.on('close', () => {
        if (response.data && typeof response.data.destroy === 'function') {
          response.data.destroy();
        }
      });

      return response.data.pipe(res);
    } catch (error) {
      console.error(
        `[🚨 Stream Proxy Error] Error en pasarela binaria:`,
        error.message,
      );
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error en la transmisión de audio.' });
      }
    }
  }

  @Post('history/track')
  @UseGuards(JwtAuthGuard) // 🛡️ Protegido
  async trackPlayback(
    @Req() req: any,
    @Body()
    body: {
      youtube_id: string;
      title: string;
      artist: string;
      duration_seconds: number;
      thumbnail: string;
    },
  ) {
    const userId = req.user.id;

    console.log('[📦 Backend - Controller] Petición recibida en history/track');
    await this.songsService.saveToCatalog({
      youtube_id: body.youtube_id,
      title: body.title,
      artist: body.artist,
      duration_seconds: body.duration_seconds,
      thumbnail: body.thumbnail,
    });

    return this.songsService.trackPlayback(userId, body.youtube_id);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard) // 🛡️ Protegido
  async getHistory(@Req() req: any) {
    const userId = req.user.id;
    return this.songsService.getRecentHistory(userId);
  }
}
