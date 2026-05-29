import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lyric } from './entities/lyric.entity';
import axios from 'axios';

@Injectable()
export class LyricsService {
  constructor(
    @InjectRepository(Lyric)
    private readonly lyricRepository: Repository<Lyric>,
  ) {}

  // Método principal: Busca la letra optimizada por caché local o API externa
  async getLyric(
    youtubeId: string,
    title: string,
    artist: string,
  ): Promise<Lyric> {
    // 1. Intentamos buscar en nuestra caché local en PostgreSQL
    const cachedLyric = await this.lyricRepository.findOne({
      where: { song_id: youtubeId },
    });
    if (cachedLyric) {
      return cachedLyric;
    }

    // 2. Si no está en la base de datos, vamos a buscarla externamente
    try {
      // Limpiamos un poco los strings para evitar que caracteres especiales rompan la URL de la API
      const cleanArtist = encodeURIComponent(artist.trim());
      const cleanTitle = encodeURIComponent(title.trim());

      const response = await axios.get(
        `https://api.lyrics.ovh/v1/${cleanArtist}/${cleanTitle}`,
        {
          timeout: 5000, // Máximo 5 segundos de espera para no congelar la petición
        },
      );

      const lyricText = response.data.lyrics;

      if (!lyricText) {
        throw new NotFoundException(
          'La letra de esta canción no fue encontrada en los servidores públicos.',
        );
      }

      // 3. Guardamos el resultado en caliente en nuestra BD para futuras consultas
      const newLyric = this.lyricRepository.create({
        song_id: youtubeId,
        text: lyricText,
      });

      return await this.lyricRepository.save(newLyric);
    } catch (error) {
      // Si la API externa responde con 404 o falla la conexión, controlamos el error limpiamente
      throw new NotFoundException(
        `No se pudo obtener la letra de "${title}" de forma automática. Error interno o canción no soportada.`,
      );
    }
  }
}
