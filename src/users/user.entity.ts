import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Playlist } from '../playlists/entities/playlist.entity';
import { PlaybackHistory } from '../songs/entities/playback-history.entity';

@Entity('users') // Hace referencia exacta al nombre de la tabla en PostgreSQL
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  password_hash: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // Relación: Un usuario puede tener muchas listas de reproducción (1:N)
  @OneToMany(() => Playlist, (playlist) => playlist.user)
  playlists: Playlist[];

  // Relación: Un usuario puede tener muchos registros en su historial (1:N)
  @OneToMany(() => PlaybackHistory, (history) => history.user)
  history: PlaybackHistory[];
}
