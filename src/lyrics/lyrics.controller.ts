import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LyricsService } from './lyrics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiBearerAuth('bearer')
@Controller('lyrics')
@UseGuards(JwtAuthGuard)
export class LyricsController {
  constructor(private readonly lyricsService: LyricsService) {}

  @Get()
  @ApiQuery({
    name: 'youtubeId',
    description: 'ID único del video de YouTube Music',
    example: 'dQw4w9WgXcQ',
  })
  @ApiQuery({
    name: 'title',
    description: 'Título de la canción',
    example: 'Never Gonna Give You Up',
  })
  @ApiQuery({
    name: 'artist',
    description: 'Nombre del artista o banda',
    example: 'Rick Astley',
  })
  async getLyrics(
    @Query('youtubeId') youtubeId: string,
    @Query('title') title: string,
    @Query('artist') artist: string,
  ) {
    return this.lyricsService.getLyric(
      youtubeId || '',
      title || '',
      artist || '',
    );
  }
}
