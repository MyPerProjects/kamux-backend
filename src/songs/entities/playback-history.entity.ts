import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Song } from './song.entity';

@Entity('playback_history')
export class PlaybackHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id?: number;

  @Column({ type: 'integer', nullable: false })
  user_id?: number;

  @Column({ type: 'varchar', length: 20, nullable: false })
  song_id?: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  played_at?: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Song)
  @JoinColumn({ name: 'song_id' })
  song?: Song;
}
