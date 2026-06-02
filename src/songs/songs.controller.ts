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
} from '@nestjs/common';
import { SongsService } from './songs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Response, Request } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

@ApiBearerAuth('bearer')
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(@Query('query') query: string) {
    return this.songsService.searchOnYouTube(query || '');
  }

  @Get('related/:id')
  @UseGuards(JwtAuthGuard)
  async getRelatedSongs(@Param('id') id: string) {
    console.log(
      `[🎶 Kamux Algoritmo] Solicitando tracks recomendados para la semilla: ${id}`,
    );
    return this.songsService.getRelatedSongs(id);
  }

  @Get('related-extended')
  @UseGuards(JwtAuthGuard)
  async getRelatedSongsExtended(
    @Query('artist') artist: string,
    @Query('track') track: string,
  ) {
    console.log(
      `[🎶 Kamux Algoritmo] Mix Contextual Solicitado para: ${artist} - ${track}`,
    );
    return this.songsService.getRelatedSongsExtended(artist || '', track || '');
  }

  @Get('resolve-id')
  @UseGuards(JwtAuthGuard)
  async resolveSongId(
    @Query('artist') artist: string,
    @Query('track') track: string,
  ) {
    return this.songsService.resolveAndRegisterSongId(
      artist || '',
      track || '',
    );
  }

  @Get('stream/:id')
  async streamAudio(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const directStreamUrl = await this.songsService.getAudioStreamUrl(id);
      const clientRange = req.headers.range;
      const axiosHeaders: Record<string, string> = {};

      if (clientRange) {
        console.log(
          `[🔊 Kamux Stream] Cliente solicita rango multimedia: ${clientRange}`,
        );
        axiosHeaders['Range'] = clientRange;
      }

      const proxyAgent = new SocksProxyAgent('socks5://127.0.0.1:40000');

      const response = await axios({
        method: 'get',
        url: directStreamUrl,
        responseType: 'stream',
        headers: axiosHeaders,
        timeout: 15000,
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
      });

      const contentType = response.headers['content-type'];
      const safeContentType =
        typeof contentType === 'string' ? contentType : 'audio/webm';

      res.setHeader('Content-Type', safeContentType);
      res.setHeader('Accept-Ranges', 'bytes');

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

      const statusCode = clientRange ? 206 : 200;
      res.status(statusCode);

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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async getHistory(@Req() req: any) {
    const userId = req.user.id;
    return this.songsService.getRecentHistory(userId);
  }
}
