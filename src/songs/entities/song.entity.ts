import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('songs')
export class Song {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  youtube_id?: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  title?: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  artist?: string;

  @Column({ type: 'integer', nullable: false })
  duration_seconds?: number;

  @Column({ nullable: true, type: 'text' })
  cached_stream_url: string;

  @Column({ nullable: true, type: 'timestamp' })
  cached_at: Date;

  @Column({ type: 'text', nullable: true })
  thumbnail?: string;
}
