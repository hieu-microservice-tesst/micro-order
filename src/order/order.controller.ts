import { Controller, Get, Post, Body, Param, HttpStatus, HttpException } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order as OrderModel } from 'prisma/generated/order';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':userId')
  async getAllOrders(@Param('userId') userId: number): Promise<OrderModel[]> {
    return this.orderService.orders({
      where: { userId },
      include: {
        orderItems: true,
      },
    });
  }

  @Post()
  async createOrder(@Body() orderData: { userId: number }): Promise<OrderModel> {
    const order = await this.orderService.createOrder({
      userId: orderData.userId,
    });

    return order;
  }

  @Post('delete')
  async deleteOrder(@Body() deleteData: { id: number; userId: number }): Promise<OrderModel> {
    return this.orderService.deleteOrder({ id: deleteData.id, userId: deleteData.userId });
  }
}
