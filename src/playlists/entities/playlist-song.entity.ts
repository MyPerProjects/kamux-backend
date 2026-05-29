import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Playlist } from './playlist.entity';
import { Song } from '../../songs/entities/song.entity';

@Entity('playlist_songs')
export class PlaylistSong {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', nullable: false })
  playlist_id: number;

  @Column({ type: 'varchar', length: 20, nullable: false })
  song_id: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  added_at: Date;

  @ManyToOne(() => Playlist, (playlist) => playlist.playlist_songs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'playlist_id' })
  playlist: Playlist;

  @ManyToOne(() => Song)
  @JoinColumn({ name: 'song_id' })
  song: Song;
}
