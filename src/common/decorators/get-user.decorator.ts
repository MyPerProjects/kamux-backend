import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Intercepta la petición HTTP y extrae el usuario inyectado por el JWT
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Si le pasamos un campo específico (ej: @GetUser('id')), devuelve solo ese campo
    // Si no le pasamos nada (ej: @GetUser()), devuelve todo el objeto del usuario
    return data ? user?.[data] : user;
  },
);
