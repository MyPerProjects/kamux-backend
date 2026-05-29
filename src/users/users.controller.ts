import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    const { username, passwordPlain } = createUserDto;

    if (!username || !passwordPlain) {
      throw new BadRequestException(
        'El nombre de usuario y la contraseña son obligatorios.',
      );
    }

    // Llamamos al servicio pasando los datos completamente validados como string
    const newUser = await this.usersService.create(username, passwordPlain);

    return {
      message: 'Usuario registrado con éxito en el ecosistema Kamux',
      userId: newUser.id,
      username: newUser.username,
    };
  }
}
