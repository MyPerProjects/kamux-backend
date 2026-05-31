import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lyric } from './entities/lyric.entity';
import axios from 'axios';

@Injectable()
export class LyricsService {
  // 🟢 Expandimos el timeout a 15 segundos para darle oxígeno a los servidores de LRCLIB
  private readonly lrclibClient = axios.create({
    baseURL: 'https://lrclib.net/api',
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  });

  constructor(
    @InjectRepository(Lyric)
    private readonly lyricRepository: Repository<Lyric>,
  ) {}

  /**
   * ⏱️ Micro-pausa asíncrona para no saturar el servidor externo entre reintentos
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getLyric(
    youtubeId: string,
    title: string,
    artist: string,
  ): Promise<Lyric> {
    console.log(
      `\n============= 🔍 INICIANDO PIPELINE DE LETRAS: ${youtubeId} =============`,
    );
    console.log(`[Metadata Cruda] Title: "${title}" | Artist: "${artist}"`);

    const cachedLyric = await this.lyricRepository.findOne({
      where: { song_id: youtubeId },
    });

    if (cachedLyric) {
      console.log(
        `[⚡ LYRICS CACHÉ HIT] Letra recuperada de PostgreSQL para el ID: ${youtubeId}`,
      );
      return cachedLyric;
    }

    const cleanArtistName = this.sanitizeArtist(artist);
    const cleanTrackTitle = this.sanitizeTitle(title, cleanArtistName);

    console.log(
      `[🎤 Normalización Nivel 1] Artist: "${cleanArtistName}" | Title: "${cleanTrackTitle}"`,
    );

    // 1️⃣ INTENTO 1: Búsqueda structured exacta
    try {
      const strictArtist = encodeURIComponent(cleanArtistName);
      const strictTitle = encodeURIComponent(cleanTrackTitle);
      const url = `/get?artist_name=${strictArtist}&track_name=${strictTitle}`;

      console.log(`[🌐 LRCLIB] Intento 1 -> GET ${url}`);

      const response = await this.lrclibClient.get(url);

      if (response.data) {
        console.log(
          `[🎯 INTENTO 1 EXITOSO] Coincidencia estructurada encontrada.`,
        );
        return await this.processAndSaveLyrics(youtubeId, response.data);
      }
    } catch (e: any) {
      console.error(`[❌ INTENTO 1 FALLÓ] -> Message: ${e.message}`);
    }

    // Esperamos 600ms antes del segundo intento para dejar respirar a la API externa
    await this.delay(600);

    // 2️⃣ INTENTO 2: Búsqueda difusa unificada (Espejo Web)
    try {
      const rawTextQuery = `${cleanTrackTitle} ${cleanArtistName}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const searchQuery = encodeURIComponent(rawTextQuery);
      const url = `/search?q=${searchQuery}`;

      console.log(
        `[🌐 LRCLIB] Intento 2 -> GET ${url} (Query decodificada: "${rawTextQuery}")`,
      );

      const response = await this.lrclibClient.get(url);

      if (response.data && response.data.length > 0) {
        return await this.selectBestMatch(youtubeId, response.data);
      } else {
        console.log(
          `[⚠️ INTENTO 2 ADVERTENCIA] El servidor respondió pero el array está vacío []`,
        );
      }
    } catch (e: any) {
      console.error(`[❌ INTENTO 2 FALLÓ] -> Message: ${e.message}`);
    }

    // Esperamos otros 600ms de descompresión
    await this.delay(600);

    // 3️⃣ INTENTO 3: Contingencia extrema invirtiendo el orden
    try {
      const invertedTextQuery = `${cleanArtistName} ${cleanTrackTitle}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const plainQuery = encodeURIComponent(invertedTextQuery);
      const url = `/search?q=${plainQuery}`;

      console.log(
        `[🌐 LRCLIB] Intento 3 -> GET ${url} (Query decodificada: "${invertedTextQuery}")`,
      );

      const response = await this.lrclibClient.get(url);

      if (response.data && response.data.length > 0) {
        return await this.selectBestMatch(youtubeId, response.data);
      }
    } catch (e: any) {
      console.error(`[❌ INTENTO 3 FALLÓ] -> Message: ${e.message}`);
    }

    console.error(
      `[🚨 LRCLIB GAVE UP] No se pudo recuperar letras en ningún nivel para "${title}".`,
    );
    console.log(
      `============= ============================================ =============\n`,
    );

    const fallbackLyrics = {
      synced: false,
      lines: ['Letra no disponible en los servidores públicos comunitarios.'],
    };

    const fallbackRecord = new Lyric();
    fallbackRecord.id = 0;
    fallbackRecord.song_id = youtubeId;
    fallbackRecord.text = JSON.stringify(fallbackLyrics);
    fallbackRecord.created_at = new Date();
    fallbackRecord.updated_at = new Date();

    return fallbackRecord;
  }

  private async selectBestMatch(
    youtubeId: string,
    results: any[],
  ): Promise<Lyric> {
    let bestMatch = results.find(
      (track: any) => track.syncedLyrics && track.syncedLyrics.trim() !== '',
    );

    if (bestMatch) {
      console.log(
        `[🎯 LRCLIB MATCH PREMIUM] Sincronizada: "${bestMatch.artistName}" - "${bestMatch.trackName}" (ID: ${bestMatch.id})`,
      );
    } else {
      bestMatch = results[0];
      console.log(
        `[⚠️ LRCLIB MATCH PLANO] Texto plano por defecto: "${bestMatch.artistName}" - "${bestMatch.trackName}" (ID: ${bestMatch.id})`,
      );
    }

    return await this.processAndSaveLyrics(youtubeId, bestMatch);
  }

  private async processAndSaveLyrics(
    youtubeId: string,
    data: any,
  ): Promise<Lyric> {
    let processedLyrics: { synced: boolean; lines: any[] };

    if (data.syncedLyrics) {
      processedLyrics = {
        synced: true,
        lines: this.parseLrcFormat(data.syncedLyrics),
      };
    } else if (data.plainLyrics) {
      processedLyrics = {
        synced: false,
        lines: data.plainLyrics.split('\n').map((line: string) => line.trim()),
      };
    } else {
      throw new Error('El registro no contiene propiedades de texto válidas.');
    }

    const newLyric = this.lyricRepository.create({
      song_id: youtubeId,
      text: JSON.stringify(processedLyrics),
    });

    return await this.lyricRepository.save(newLyric);
  }

  private sanitizeArtist(artist: string): string {
    if (!artist) return '';
    return artist
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*-\s*Tema$/i, '')
      .replace(/\s+oficial$/i, '')
      .replace(/\s+official$/i, '')
      .replace(/\s+music$/i, '')
      .replace(/\s+vevo$/i, '')
      .replace(/\s+band$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private sanitizeTitle(title: string, cleanArtist: string): string {
    if (!title) return '';

    let clean = title;

    clean = clean.replace(
      /[\(\[][^]*?(?:official|video|remaster|remastered|remix|hd|4k|lyric|letra|clip|ft|feat|full|audio|hq|bonus track)[^]*?[\)\]]/gi,
      '',
    );

    clean = clean
      .replace(/\s*\(?remastered\)?/gi, '')
      .replace(/\s*\(?bonus track\)?/gi, '')
      .replace(/\s*\(?official music video\)?/gi, '')
      .replace(/\s*\(?official video\)?/gi, '')
      .replace(/\s*\(?video oficial\)?/gi, '')
      .replace(/\s*\(?audio\)?/gi, '')
      .replace(/\s*\(?lyric video\)?/gi, '')
      .replace(/\s*\(?letra\)?/gi, '')
      .replace(/\.\.\./g, ' ');

    if (clean.includes(' - ')) {
      const parts = clean.split(' - ');
      if (parts.length >= 2) {
        const firstPartClean = parts[0].trim().toLowerCase();
        const artistClean = cleanArtist.toLowerCase();

        if (
          firstPartClean.includes(artistClean) ||
          artistClean.includes(firstPartClean)
        ) {
          clean = parts.slice(1).join(' - ');
        }
      }
    }

    return clean.replace(/\s+/g, ' ').trim();
  }

  private parseLrcFormat(lrcText: string): { time: number; text: string }[] {
    if (!lrcText) return [];

    const lines = lrcText.split('\n');
    const result: { time: number; text: string }[] = [];
    const timeRegex = /\[(\d+):(\d+)(?:\.(\d+))?\]/;

    for (const line of lines) {
      const match = timeRegex.exec(line);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milis = match[3] ? parseInt(match[3], 10) : 0;

        const totalSeconds = minutes * 60 + seconds + milis / 100;
        const text = line.replace(timeRegex, '').trim();

        if (
          text ||
          result.length === 0 ||
          result[result.length - 1].text !== ''
        ) {
          result.push({ time: totalSeconds, text });
        }
      }
    }
    return result;
  }
}
