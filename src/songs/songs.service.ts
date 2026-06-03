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
import axios from 'axios';

@Injectable()
export class SongsService {
  private searchCache = new Map<string, { songs: any[]; expiresAt: number }>();
  private readonly CACHE_TTL = 2 * 60 * 60 * 1000;

  private readonly MEDIA_SERVICE_URL = 'http://127.0.0.1:5000';
  private readonly HYBRID_SERVICE_URL = 'http://127.0.0.1:5001';

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
        `[⚡ RAM CACHÉ HIT] Resultados recuperados al instante para: "${query}"`,
      );
      return cachedData.songs;
    }

    const startTime = performance.now();
    console.log(
      `[⏱️ Telemetría Kamux] Solicitando búsqueda al Microservicio Híbrido para: "${query}"`,
    );

    try {
      const response = await axios.get(
        `${this.HYBRID_SERVICE_URL}/search?q=${encodeURIComponent(query.trim())}`,
      );
      const finalSongs = response.data;
      const endTime = performance.now();

      console.log(
        `[⏱️ Telemetría Kamux] Catálogo devuelto por el Pool Oficial en ${((endTime - startTime) / 1000).toFixed(2)}s`,
      );

      this.searchCache.set(lowerQuery, {
        songs: finalSongs,
        expiresAt: Date.now() + this.CACHE_TTL,
      });

      return finalSongs;
    } catch (error) {
      console.error(
        '[🚨 Error en Pasarela Compartida de Búsqueda Híbrida]:',
        error.message,
      );
      throw new InternalServerErrorException(
        'Error al buscar en el servicio oficial de música.',
      );
    }
  }

  async getRelatedSongs(youtubeId: string): Promise<any[]> {
    try {
      console.log(
        `[🧠 Kamux Radio] Buscando metadatos locales para el ID: ${youtubeId}`,
      );
      const currentSong = await this.songRepository.findOne({
        where: { youtube_id: youtubeId },
      });

      if (!currentSong || !currentSong.artist || !currentSong.title) {
        console.log(
          `[🚫 Catálogo Vacío] ID no registrado en historial. Cancelando mix híbrido por defecto.`,
        );
        return [];
      }

      return this.getRelatedSongsExtended(
        currentSong.artist,
        currentSong.title,
      );
    } catch (error) {
      console.error(
        `[🚨 Error Pasarela Recomendaciones Híbridas]:`,
        error.message,
      );
      throw new InternalServerErrorException(
        'Error en el servicio de recomendaciones de Inteligencia Musical.',
      );
    }
  }

  async getRelatedSongsExtended(artist: string, track: string): Promise<any[]> {
    if (!artist || !track) return [];
    try {
      console.log(
        `[📻 Kamux Radio] Solicitando Mix Híbrido Extendido para: ${artist} - ${track}`,
      );
      const response = await axios.get(
        `${this.HYBRID_SERVICE_URL}/related?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`,
      );

      const relatedSongs = response.data;
      if (!Array.isArray(relatedSongs)) return [];

      return relatedSongs;
    } catch (error) {
      console.error(
        `[🚨 Error Pasarela Recomendaciones Extendas]:`,
        error.message,
      );
      throw new InternalServerErrorException(
        'Error en el servicio extendido de Inteligencia Musical.',
      );
    }
  }

  async resolveAndRegisterSongId(
    artist: string,
    track: string,
  ): Promise<{ youtube_id: string; thumbnail: string }> {
    try {
      const localSong = await this.songRepository.findOne({
        where: { artist, title: track },
      });

      if (localSong && localSong.youtube_id) {
        console.log(
          `[💾 PostgreSQL HIT] ID recuperado localmente para: ${artist} - ${track}`,
        );
        return {
          youtube_id: localSong.youtube_id,
          thumbnail: localSong.thumbnail || '',
        };
      }

      console.log(
        `[📡 Pasarela I2V] Solicitando resolución externa de ID para: ${artist} - ${track}`,
      );
      const response = await axios.get(
        `${this.HYBRID_SERVICE_URL}/resolve-id?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`,
      );

      const { youtube_id, thumbnail } = response.data;

      if (youtube_id) {
        await this.saveToCatalog({
          youtube_id,
          title: track,
          artist,
          duration_seconds: 180,
          thumbnail,
        }).catch((err) =>
          console.warn(
            `[💾 Catálogo Silencioso] No se pudo persistir el id resuelto:`,
            err.message,
          ),
        );
      }

      return { youtube_id: youtube_id || '', thumbnail: thumbnail || '' };
    } catch (error) {
      console.error('[🚨 Error en Resolver de IDs Backend]:', error.message);
      return { youtube_id: '', thumbnail: '' };
    }
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
            `[⚡ CACHÉ HIT PostgreSQL] URL válida reutilizada para el ID: ${youtubeId}`,
          );
          return song.cached_stream_url;
        }
      }

      console.log(
        `[🌐 Kamux Red] Solicitando URL de streaming directo al Microservicio Multimedia (Puerto 5000)...`,
      );
      const response = await axios.get(
        `${this.MEDIA_SERVICE_URL}/stream-url/${youtubeId}`,
      );
      const freshUrl = response.data.url;

      if (!freshUrl) {
        throw new Error(
          'El microservicio multimedia devolvió un objeto de audio vacío.',
        );
      }

      if (song) {
        song.cached_stream_url = freshUrl;
        song.cached_at = new Date();
        await this.songRepository.save(song);
        console.log(`[💾 PostgreSQL] Nueva URL persistida en base de datos.`);
      }

      return freshUrl;
    } catch (error) {
      console.error('[🚨 Error en Acoplamiento de Audio]:', error.message);
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
