import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song } from './entities/song.entity';
import { PlaybackHistory } from './entities/playback-history.entity';
import { spawn } from 'child_process';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SongsService {
  private searchCache = new Map<string, { songs: any[]; expiresAt: number }>();
  private readonly CACHE_TTL = 2 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
    @InjectRepository(PlaybackHistory)
    private readonly historyRepository: Repository<PlaybackHistory>,
    private readonly configService: ConfigService,
  ) {}

  async searchOnYouTube(query: string): Promise<any[]> {
    if (!query || !query.trim()) return [];

    const lowerQuery = query.trim().toLowerCase();

    const cachedData = this.searchCache.get(lowerQuery);
    if (cachedData && cachedData.expiresAt > Date.now()) {
      console.log(
        `\n[⚡ CACHÉ HIT - INSTANTÁNEO] Resultados recuperados de la RAM para: "${query}" (0.00s)`,
      );
      return cachedData.songs;
    }

    const smartQuery =
      lowerQuery.includes('official') ||
      lowerQuery.includes('live') ||
      lowerQuery.includes('video') ||
      lowerQuery.includes('topic') ||
      lowerQuery.includes('tema')
        ? query
        : `${query} - Topic`;

    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      console.log(
        `\n[⏱️ Telemetría Kamux] Iniciando búsqueda binaria en YouTube para: "${smartQuery}"`,
      );

      const ytDlpProcess = spawn('yt-dlp', [
        `ytsearch10:${smartQuery}`,
        '--dump-json',
        '--flat-playlist',
        '--skip-download',
        '--no-check-certificates',
        '--no-warnings',
        '--legacy-server-connect',
      ]);

      let output = '';
      let errorOutput = '';

      ytDlpProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      ytDlpProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ytDlpProcess.on('close', (code) => {
        const endTime = performance.now();
        const totalDurationSeconds = ((endTime - startTime) / 1000).toFixed(2);

        if (code !== 0) {
          console.error(
            `[🚨 yt-dlp Search Error] Proceso falló después de ${totalDurationSeconds}s. Detalle:`,
            errorOutput,
          );
          if (!output.trim()) {
            return reject(
              new InternalServerErrorException(
                'Error al buscar en el servicio binario de música.',
              ),
            );
          }
        }

        try {
          const lines = output
            .trim()
            .split('\n')
            .filter((line) => line.trim() !== '');
          if (lines.length === 0) {
            return resolve([]);
          }

          const items = lines.map((line) => JSON.parse(line));

          const blacklist = [
            'cover',
            'lyrics',
            'letra',
            'karaoke',
            'tutorial',
            'parodia',
            'reaccion',
            'raw',
          ];

          const filteredItems = items.filter((item: any) => {
            const title = (item.title || '').toLowerCase();
            return !blacklist.some(
              (word) => title.includes(word) && !lowerQuery.includes(word),
            );
          });

          const unescapeHtml = (str: string): string => {
            if (!str) return '';
            return str
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&ndash;/g, '-')
              .replace(/&mdash;/g, '-');
          };

          const cleanArtistName = (channelTitle: string): string => {
            if (!channelTitle) return 'Artista Desconocido';
            return unescapeHtml(channelTitle)
              .replace(/\s*-\s*Topic$/i, '')
              .replace(/\s*-\s*Tema$/i, '')
              .trim();
          };

          const finalSongs = filteredItems.map((item: any) => {
            let selectedThumbnail = '';
            if (item.thumbnails && item.thumbnails.length > 0) {
              selectedThumbnail =
                item.thumbnails[item.thumbnails.length - 1].url;
            } else {
              selectedThumbnail = item.thumbnail || '';
            }

            return {
              youtube_id: item.id || item.url,
              title: unescapeHtml(item.title),
              artist: cleanArtistName(item.uploader || item.channel),
              duration_seconds: item.duration ? Math.floor(item.duration) : 180,
              thumbnail: selectedThumbnail,
            };
          });

          this.searchCache.set(lowerQuery, {
            songs: finalSongs,
            expiresAt: Date.now() + this.CACHE_TTL,
          });

          resolve(finalSongs);
        } catch (parseError) {
          console.error('[🚨 JSON Parse Error en Buscador]', parseError);
          resolve([]);
        }
      });
    });
  }

  private async extractLiveUrl(youtubeId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = `https://www.youtube.com/watch?v=${youtubeId}`;
      const ytDlpProcess = spawn('yt-dlp', [
        '-f',
        '251',
        '-g',
        '--no-playlist',
        '--no-check-certificates',
        '--no-warnings',
        '--legacy-server-connect',
        url,
      ]);

      let output = '';
      ytDlpProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      ytDlpProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          resolve(output.trim());
        } else {
          reject(
            new Error(
              'No se pudo extraer la URL directa de los servidores de Google.',
            ),
          );
        }
      });
    });
  }

  async getAudioStreamUrl(youtubeId: string): Promise<string> {
    try {
      const song = await this.songRepository.findOne({
        where: { youtube_id: youtubeId },
      });

      if (song && song.cached_stream_url && song.cached_at) {
        const hoursAge =
          (new Date().getTime() - new Date(song.cached_at).getTime()) /
          (1000 * 60 * 60);
        if (hoursAge < 5) {
          console.log(
            `[⚡ CACHÉ HIT] URL recuperada de PostgreSQL para el ID: ${youtubeId}`,
          );
          return song.cached_stream_url;
        }
      }

      const freshUrl = await this.extractLiveUrl(youtubeId);

      if (song) {
        song.cached_stream_url = freshUrl;
        song.cached_at = new Date();
        await this.songRepository.save(song);
      }

      return freshUrl;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error en la pasarela de optimización de audio.',
      );
    }
  }

  async saveToCatalog(songData: {
    youtube_id: string;
    title: string;
    artist: string;
    duration_seconds: number;
    thumbnail?: string;
  }): Promise<Song> {
    const existingSong = await this.songRepository.findOne({
      where: { youtube_id: songData.youtube_id },
    });

    if (existingSong) {
      if (!existingSong.thumbnail && songData.thumbnail) {
        existingSong.thumbnail = songData.thumbnail;
        return await this.songRepository.save(existingSong);
      }
      return existingSong;
    }

    const newSong = this.songRepository.create(songData);
    return await this.songRepository.save(newSong);
  }

  async trackPlayback(
    userId: number,
    youtubeId: string,
  ): Promise<PlaybackHistory> {
    try {
      const historyEntry = this.historyRepository.create({
        user_id: userId,
        song_id: youtubeId,
        played_at: new Date(),
      });

      return await this.historyRepository.save(historyEntry);
    } catch (error) {
      console.error('Error al insertar registro en historial:', error);
      throw new InternalServerErrorException(
        'No se pudo registrar la reproducción.',
      );
    }
  }

  async getRecentHistory(userId: number): Promise<PlaybackHistory[]> {
    return await this.historyRepository.find({
      where: { user_id: userId },
      relations: { song: true },
      order: { played_at: 'DESC' },
      take: 20,
    });
  }
}
