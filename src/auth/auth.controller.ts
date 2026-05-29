import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginAuthDto: LoginAuthDto) {
    const { username, passwordPlain } = loginAuthDto;

    // Validación estricta de seguridad en el controlador
    if (!username || !passwordPlain) {
      throw new BadRequestException(
        'El nombre de usuario y la contraseña son obligatorios.',
      );
    }

    // 1. Validamos que el usuario exista y la contraseña coincida en Bcrypt
    const validatedUser = await this.authService.validateUser(
      username,
      passwordPlain,
    );

    // 2. Generamos y retornamos el token JWT junto con los datos públicos del usuario
    return this.authService.login(validatedUser);
  }
}
