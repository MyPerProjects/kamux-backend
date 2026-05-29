import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Si el error es una excepción conocida de HTTP, toma su código, si no, es un error interno (500)
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extrae el mensaje del error
    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Error interno en el servidor de Kamux';

    // Log para ver el error en la terminal del backend
    console.error(
      `[🚨 Error] en ${request.method} ${request.url} :`,
      exception,
    );

    // Respuesta estandarizada que recibirá el APK de Angular
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: message,
    });
  }
}
