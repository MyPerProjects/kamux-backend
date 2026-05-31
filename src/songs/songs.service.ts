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

  private async initYouTube() {
    try {
      this.youtube = await Innertube.create({
        client_type: 'TV_EMBEDDED' as any, // 🚀 Bypass definitivo: Simula un Smart TV para forzar la entrega de streams binarios
      });
      this.isInitialized = true;
      console.log(
        '\n🚀 [🔒 Motor Multimedia de Kamux Activo en Modo SmartTV Permanente]',
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
      // Usamos la búsqueda general de la plataforma que se adapta mejor al cliente WEB
      const searchResults = await this.youtube.search(smartQuery, {
        type: 'video',
      });

      if (!searchResults.videos || searchResults.videos.length === 0) {
        console.log(
          `[⚠️ Telemetría] No se encontraron resultados de video planos. Buscando en catálogo alternativo...`,
        );
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

      // Filtrado con logs interactivos
      const filteredItems = searchResults.videos.filter((item: any) => {
        const title = (item.title?.text || '').toLowerCase();
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

      const finalSongs = filteredItems.slice(0, 10).map((item: any) => {
        let selectedThumbnail = '';
        if (item.thumbnails && item.thumbnails.length > 0) {
          selectedThumbnail = item.thumbnails[item.thumbnails.length - 1].url;
        }

        return {
          youtube_id: item.id,
          title: unescapeHtml(item.title?.text || 'Título Desconocido'),
          artist: unescapeHtml(item.author?.name || 'Artista Desconocido')
            .replace(/\s*-\s*Topic$/i, '')
            .trim(),
          duration_seconds: item.duration?.seconds || 180,
          thumbnail: selectedThumbnail,
        };
      });

      const endTime = performance.now();
      const totalDurationSeconds = ((endTime - startTime) / 1000).toFixed(2);
      console.log(
        `[⏱️ Telemetría Kamux] Búsqueda finalizada con éxito en ${totalDurationSeconds}s. Encontrados: ${finalSongs.length} tracks.`,
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
    console.log(
      `\n=================== 🔊 INICIANDO PIPELINE DE EXTRACCIÓN: ${youtubeId} ===================`,
    );
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
            `[⚡ CACHÉ HIT PostgreSQL] URL válida reutilizada para el ID: ${youtubeId}`,
          );
          return song.cached_stream_url;
        }
      }

      console.log(
        `[🕵️ Telemetría Stream] Consultando metadatos base a Google para el ID: ${youtubeId}...`,
      );
      const videoInfo = await this.youtube.getInfo(youtubeId);
      console.log(
        `[✅ Telemetría Stream] Metadatos recuperados. Título del track: "${videoInfo.basic_info.title}"`,
      );

      console.log(
        `[🎯 Telemetría Stream] Seleccionando el mejor formato de audio disponible...`,
      );
      const format = videoInfo.chooseFormat({ type: 'audio', quality: 'best' });

      if (!format) {
        console.error(
          `[🚨 Telemetría Stream Error] Google no entregó ningún stream de audio válido para este track.`,
        );
        throw new Error('No se encontró un formato multimedia compatible.');
      }

      console.log(
        `[🔑 Telemetría Stream] Formato seleccionado: MIME="${format.mime_type}" | Bitrate=${format.bitrate}`,
      );
      console.log(
        `[🔓 Telemetría Stream] Procediendo a descifrar la firma electrónica del reproductor...`,
      );

      const freshUrl = format.decipher(this.youtube.session.player);

      if (!freshUrl) {
        console.error(
          `[🚨 Telemetría Stream Error] El descifrado de la firma electrónica devolvió un puntero vacío.`,
        );
        throw new Error(
          'La URL descifrada desde los servidores de Google está vacía.',
        );
      }

      console.log(
        `[🎉 PIPELINE COMPLETADO] URL directa generada con éxito. Longitud del string: ${freshUrl.length}`,
      );

      if (song) {
        song.cached_stream_url = freshUrl;
        song.cached_at = new Date();
        await this.songRepository.save(song);
        console.log(`[💾 PostgreSQL] URL persistida en base de datos.`);
      }

      return freshUrl;
    } catch (error) {
      console.error(
        '[🚨 Error Crítico en Pasarela de Audio]:',
        error.stack || error.message,
      );
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
