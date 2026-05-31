import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song } from './entities/song.entity';
import { PlaybackHistory } from './entities/playback-history.entity';
import { ConfigService } from '@nestjs/config';
import { Innertube } from 'youtubei.js';

@Injectable()
export class SongsService {
  private youtube: any;
  private isInitialized = false;
  private searchCache = new Map<string, { songs: any[]; expiresAt: number }>();
  private readonly CACHE_TTL = 2 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
    @InjectRepository(PlaybackHistory)
    private readonly historyRepository: Repository<PlaybackHistory>,
    private readonly configService: ConfigService,
  ) {
    this.initYouTube();
  }

  /**
   * 🔒 Inicializa el motor InnerTube emulando un cliente nativo
   */
  private async initYouTube() {
    try {
      this.youtube = await Innertube.create({
        client_type: 'ANDROID_MUSIC' as any,
      });
      this.isInitialized = true;
      console.log(
        '\n🚀 [🔒 Motor Multimedia de Kamux Activo Permanente y Estable]',
      );
    } catch (error) {
      console.error(
        '[🚨 Error] Al levantar el motor nativo de YouTube:',
        error,
      );
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized || !this.youtube) {
      await this.initYouTube();
    }
  }

  async searchOnYouTube(query: string): Promise<any[]> {
    if (!query || !query.trim()) return [];
    await this.ensureInitialized();

    const lowerQuery = query.trim().toLowerCase();

    // CACHÉ HIT - RAM INSTANTÁNEO
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

    const startTime = performance.now();
    console.log(
      `\n[⏱️ Telemetría Kamux] Iniciando búsqueda binaria nativa para: "${smartQuery}"`,
    );

    try {
      // Búsqueda directa simulando la app oficial de YouTube Music
      const searchResults = await this.youtube.music.search(smartQuery, {
        type: 'song',
      });

      if (!searchResults.songs || !searchResults.songs.contents) {
        return [];
      }

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

      const filteredItems = searchResults.songs.contents.filter((item: any) => {
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

      const cleanArtistName = (artistsArray: any[]): string => {
        if (!artistsArray || artistsArray.length === 0)
          return 'Artista Desconocido';
        return unescapeHtml(artistsArray[0].name)
          .replace(/\s*-\s*Topic$/i, '')
          .replace(/\s*-\s*Tema$/i, '')
          .trim();
      };

      const finalSongs = filteredItems.map((item: any) => {
        let selectedThumbnail = '';
        if (
          item.thumbnail &&
          item.thumbnail.contents &&
          item.thumbnail.contents.length > 0
        ) {
          selectedThumbnail =
            item.thumbnail.contents[item.thumbnail.contents.length - 1].url;
        }

        return {
          youtube_id: item.id,
          title: unescapeHtml(item.title),
          artist: cleanArtistName(item.artists),
          duration_seconds: item.duration
            ? Math.floor(item.duration.seconds)
            : 180,
          thumbnail: selectedThumbnail,
        };
      });

      const endTime = performance.now();
      const totalDurationSeconds = ((endTime - startTime) / 1000).toFixed(2);
      console.log(
        `[⏱️ Telemetría Kamux] Búsqueda finalizada con éxito en ${totalDurationSeconds}s`,
      );

      this.searchCache.set(lowerQuery, {
        songs: finalSongs,
        expiresAt: Date.now() + this.CACHE_TTL,
      });

      return finalSongs;
    } catch (error) {
      console.error('[🚨 Error en Motor de Búsqueda Permanente]:', error);
      throw new InternalServerErrorException(
        'Error al buscar en el servicio binario de música.',
      );
    }
  }

  async getAudioStreamUrl(youtubeId: string): Promise<string> {
    await this.ensureInitialized();
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

      console.log(
        `[⏱️ Telemetría Kamux] Extrayendo streaming binario seguro para: ${youtubeId}`,
      );

      // Obtenemos los metadatos y flujos de cifrado del video
      const videoInfo = await this.youtube.getInfo(youtubeId);

      // Escogemos de forma inteligente el flujo de audio óptimo (calidad adaptativa nativa)
      const format = videoInfo.chooseFormat({ type: 'audio', quality: 'best' });

      if (!format) {
        throw new Error('No se encontró un formato multimedia compatible.');
      }

      // Desciframos la firma electrónica usando el reproductor nativo de la sesión
      const freshUrl = format.decipher(this.youtube.session.player);

      if (!freshUrl) {
        throw new Error(
          'La URL descifrada desde los servidores de Google está vacía.',
        );
      }

      if (song) {
        song.cached_stream_url = freshUrl;
        song.cached_at = new Date();
        await this.songRepository.save(song);
      }

      return freshUrl;
    } catch (error) {
      console.error('[🚨 Error en Pasarela Permanente]:', error.message);
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
