import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreatePlaylistDto, AddSongToPlaylistDto } from './dto/playlist.dto';

@ApiBearerAuth('bearer')
@Controller('playlists')
@UseGuards(JwtAuthGuard)
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Post()
  async create(@Req() req: any, @Body() createPlaylistDto: CreatePlaylistDto) {
    const userId = req.user.id;
    return this.playlistsService.createPlaylist(userId, createPlaylistDto.name);
  }

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user.id;
    return this.playlistsService.findAllByUser(userId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.id;
    return this.playlistsService.findOneWithSongs(id, userId);
  }

  @Post(':id/songs')
  async addSong(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() addSongDto: AddSongToPlaylistDto,
  ) {
    const userId = req.user.id;
    return this.playlistsService.addSongToPlaylist(userId, id, addSongDto);
  }

  @Delete(':id/songs/:youtubeId')
  async removeSong(
    @Param('id', ParseIntPipe) id: number,
    @Param('youtubeId') youtubeId: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.playlistsService.removeSongFromPlaylist(userId, id, youtubeId);
  }
}
