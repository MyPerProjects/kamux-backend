import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playlist } from './entities/playlist.entity';
import { PlaylistSong } from './entities/playlist-song.entity';
import { SongsService } from '../songs/songs.service';

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist)
    private readonly playlistRepository: Repository<Playlist>,
    @InjectRepository(PlaylistSong)
    private readonly playlistSongRepository: Repository<PlaylistSong>,
    private readonly songsService: SongsService,
  ) {}

  // 1. Crear una nueva lista de reproducción
  async createPlaylist(userId: number, name: string): Promise<Playlist> {
    const newPlaylist = this.playlistRepository.create({
      name,
      user_id: userId,
    });
    return await this.playlistRepository.save(newPlaylist);
  }

  // 2. Listar todas las playlists de un usuario específico
  async findAllByUser(userId: number): Promise<Playlist[]> {
    return await this.playlistRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  // 3. Obtener el detalle de una playlist con todas sus canciones cargadas
  async findOneWithSongs(
    playlistId: number,
    userId: number,
  ): Promise<Playlist> {
    const playlist = await this.playlistRepository.findOne({
      where: { id: playlistId, user_id: userId },
      relations: {
        playlist_songs: {
          song: true,
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException(
        'La lista de reproducción no existe o no tienes acceso a ella.',
      );
    }

    return playlist;
  }

  // 4. Agregar una canción a la lista de reproducción
  async addSongToPlaylist(
    userId: number,
    playlistId: number,
    songData: {
      youtube_id: string;
      title: string;
      artist: string;
      duration_seconds: number;
    },
  ): Promise<PlaylistSong> {
    // Validamos primero que la playlist le pertenezca al usuario concurrente
    const playlist = await this.playlistRepository.findOne({
      where: { id: playlistId, user_id: userId },
    });
    if (!playlist) {
      throw new NotFoundException(
        'La lista de reproducción no existe o no tienes acceso a ella.',
      );
    }

    await this.songsService.saveToCatalog(songData);

    // Evitamos duplicados exactos dentro de la misma lista
    const alreadyExists = await this.playlistSongRepository.findOne({
      where: { playlist_id: playlistId, song_id: songData.youtube_id },
    });
    if (alreadyExists) {
      throw new ConflictException(
        'Esta canción ya se encuentra dentro de la lista de reproducción.',
      );
    }

    // Insertamos la relación intermedia
    const newPlaylistSong = this.playlistSongRepository.create({
      playlist_id: playlistId,
      song_id: songData.youtube_id,
    });

    return await this.playlistSongRepository.save(newPlaylistSong);
  }

  // 5. Eliminar una canción específica de una playlist
  async removeSongFromPlaylist(
    userId: number,
    playlistId: number,
    youtubeId: string,
  ): Promise<{ message: string }> {
    const playlist = await this.playlistRepository.findOne({
      where: { id: playlistId, user_id: userId },
    });
    if (!playlist) {
      throw new NotFoundException(
        'La lista de reproducción no existe o no tienes acceso a ella.',
      );
    }

    const match = await this.playlistSongRepository.findOne({
      where: { playlist_id: playlistId, song_id: youtubeId },
    });
    if (!match) {
      throw new NotFoundException(
        'La canción no se encuentra asignada a esta lista de reproducción.',
      );
    }

    await this.playlistSongRepository.remove(match);
    return { message: 'Canción removida de la lista con éxito.' };
  }
}
