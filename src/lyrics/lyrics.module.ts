import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LyricsService } from './lyrics.service';
import { LyricsController } from './lyrics.controller';
import { Lyric } from './entities/lyric.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Lyric])],
  controllers: [LyricsController],
  providers: [LyricsService],
  exports: [LyricsService],
})
export class LyricsModule {}
