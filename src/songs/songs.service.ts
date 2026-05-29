import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song } from './entities/song.entity';
import { PlaybackHistory } from './entities/playback-history.entity';
import { search, videoInfo } from 'youtube-ext';
import { Readable } from 'stream';
import http = require('https');

@Injectable()
export class SongsService {
  constructor(
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
    @InjectRepository(PlaybackHistory)
    private readonly historyRepository: Repository<PlaybackHistory>,
  ) {}

  // 1. Buscar canciones en YouTube Music / YouTube
  async searchOnYouTube(query: string) {
    try {
      const results = await search(query);

      return results.videos.map((video) => {
        const durationMs = Number(video.duration) || 0;

        return {
          youtube_id: video.id,
          title: video.title,
          artist: (video as any).channel?.name || 'Artista Desconocido',
          duration_seconds: Math.floor(durationMs / 1000),
          thumbnail: video.thumbnails[0]?.url || '',
        };
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al buscar en el servicio de música.',
      );
    }
  }

  // 2. Proxy Pipe de audio binario directo, limpio e inmune a las mutaciones de la librería
  async getAudioStream(youtubeId: string): Promise<Readable> {
    try {
      const streamInfo = await videoInfo(youtubeId);
      const audioStreams = (streamInfo as any).streams || [];

      // Filtramos el mejor canal de audio disponible
      const bestAudio = audioStreams
        .filter((s: any) => s.type === 'audio')
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];

      const streamUrl = bestAudio?.url || (streamInfo as any).url;

      if (!streamUrl) {
        throw new NotFoundException(
          'No se encontró un canal de streaming óptimo.',
        );
      }

      // Creamos el túnel binario consumiendo el stream web directo. Es el método más rápido y con menos uso de RAM.
      return new Promise((resolve, reject) => {
        http
          .get(streamUrl, (res) => {
            if (res.statusCode !== 200) {
              reject(
                new InternalServerErrorException(
                  'No se pudo establecer el puente de audio.',
                ),
              );
            }
            resolve(res); // El stream de respuesta HTTP es un Readable Stream perfecto para NestJS
          })
          .on('error', (err) => reject(err));
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error al inicializar el streaming de audio.',
      );
    }
  }

  // 3. Catálogo Global Único
  async saveToCatalog(songData: {
    youtube_id: string;
    title: string;
    artist: string;
    duration_seconds: number;
  }): Promise<Song> {
    const existingSong = await this.songRepository.findOne({
      where: { youtube_id: songData.youtube_id },
    });
    if (existingSong) return existingSong;

    const newSong = this.songRepository.create(songData);
    return await this.songRepository.save(newSong);
  }

  // 4. Historial diario
  async trackPlayback(
    userId: number,
    youtubeId: string,
  ): Promise<PlaybackHistory> {
    const newHistory = this.historyRepository.create({
      user_id: userId,
      song_id: youtubeId,
    });
    return await this.historyRepository.save(newHistory);
  }

  // 5. Historial Reciente
  async getRecentHistory(userId: number): Promise<PlaybackHistory[]> {
    return await this.historyRepository.find({
      where: { user_id: userId },
      relations: { song: true },
      order: { played_at: 'DESC' },
      take: 20,
    });
  }
}
