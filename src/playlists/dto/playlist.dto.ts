export class CreatePlaylistDto {
  name: string;
}

export class AddSongToPlaylistDto {
  youtube_id: string;
  title: string;
  artist: string;
  duration_seconds: number;
}
