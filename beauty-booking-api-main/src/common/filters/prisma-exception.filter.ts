import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

export interface SafeDatabaseError {
  statusCode: number;
  error: string;
  message: string;
  code: string;
}

export function mapKnownPrismaError(code: string): SafeDatabaseError {
  if (code === 'P2002') {
    return {
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      message: 'Dữ liệu đã tồn tại hoặc xung đột với một bản ghi hiện có.',
      code: 'RESOURCE_CONFLICT',
    };
  }
  if (code === 'P2003') {
    return {
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      message: 'Không thể thay đổi dữ liệu vì tài nguyên đang được tham chiếu.',
      code: 'RESOURCE_IN_USE',
    };
  }
  if (code === 'P2025') {
    return {
      statusCode: HttpStatus.NOT_FOUND,
      error: 'Not Found',
      message: 'Không tìm thấy tài nguyên cần xử lý.',
      code: 'RESOURCE_NOT_FOUND',
    };
  }
  if (code === 'P2034') {
    return {
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      message: 'Dữ liệu vừa được thay đổi bởi một yêu cầu khác. Vui lòng thử lại.',
      code: 'CONCURRENT_UPDATE',
    };
  }
  if (code === 'P2024') {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      message: 'Hệ thống dữ liệu đang bận. Vui lòng thử lại sau.',
      code: 'DATABASE_BUSY',
    };
  }
  if (code === 'P2021' || code === 'P2022') {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      message: 'Hệ thống dữ liệu chưa sẵn sàng. Vui lòng thử lại sau.',
      code: 'DATABASE_SCHEMA_UNAVAILABLE',
    };
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    message: 'Máy chủ không thể xử lý yêu cầu vào lúc này.',
    code: 'DATABASE_ERROR',
  };
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const mapped = mapKnownPrismaError(exception.code);
    const requestId = request.headers['x-request-id'];

    response.status(mapped.statusCode).json({
      statusCode: mapped.statusCode,
      error: mapped.error,
      message: mapped.message,
      code: mapped.code,
      path: request.originalUrl,
      requestId: typeof requestId === 'string' ? requestId : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}
