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
import type { Response } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('bearer')
@Controller('songs')
@UseGuards(JwtAuthGuard) // Protege todas las rutas de este controlador con JWT
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Get('search')
  async search(@Query('query') query: string) {
    return this.songsService.searchOnYouTube(query || '');
  }

  @Get('stream/:id')
  async streamAudio(@Param('id') id: string, @Res() res: Response) {
    const audioStream = await this.songsService.getAudioStream(id);

    // Configuramos las cabeceras HTTP necesarias para el streaming de audio fluido
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Conectamos el flujo origen directamente a la respuesta HTTP del cliente
    audioStream.pipe(res);
  }

  @Post('history/track')
  async trackPlayback(
    @Req() req: any,
    @Body()
    body: {
      youtube_id: string;
      title: string;
      artist: string;
      duration_seconds: number;
    },
  ) {
    const userId = req.user.id;

    // 1. Guardamos o actualizamos en el catálogo global único
    await this.songsService.saveToCatalog({
      youtube_id: body.youtube_id,
      title: body.title,
      artist: body.artist,
      duration_seconds: body.duration_seconds,
    });

    // 2. Registramos la reproducción en el historial del usuario
    return this.songsService.trackPlayback(userId, body.youtube_id);
  }

  @Get('history')
  async getHistory(@Req() req: any) {
    const userId = req.user.id;
    return this.songsService.getRecentHistory(userId);
  }
}
