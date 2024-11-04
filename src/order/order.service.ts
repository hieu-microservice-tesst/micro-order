import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PrismaClient, Order, OrderItem, Prisma } from 'prisma/generated/order';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class OrderService {
  private prisma: PrismaClient;

  constructor(
    @Inject('CART_SERVICE') private readonly cartServiceClient: ClientProxy,
    @Inject('PRODUCT_SERVICE') private readonly productServiceClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userServiceClient: ClientProxy,
  ) {
    this.prisma = new PrismaClient();
  }

  async orders(params: { where: Prisma.OrderWhereInput; include?: Prisma.OrderInclude }): Promise<Order[]> {
    return this.prisma.order.findMany(params);
  }

  async createOrder(data: {
    userId: number;
  }): Promise<any> {
    const user = await this.getUser(data.userId);
    if (!user) {
      throw new HttpException('Người dùng không tồn tại', HttpStatus.NOT_FOUND);
    }

    const cart = await this.getCartByUserId(data.userId);
    if (!cart) {
      throw new HttpException('Giỏ hàng không tồn tại', HttpStatus.NOT_FOUND);
    }

    if (cart.cartItems.length === 0 || cart.totalItems === 0 || cart.totalPrice === 0) {
      throw new HttpException('Giỏ hàng trống hoặc không hợp lệ', HttpStatus.BAD_REQUEST);
    }

    const stockItems = [];
    for (const cartItem of cart.cartItems) {
      const product = await this.getProduct(cartItem.productId);
      if (cartItem.quantity > product.stock) {
        stockItems.push({
          name: product.name,
          quantity: cartItem.quantity,
          stock: product.stock,
        });
      }
    }

    if (stockItems.length > 0) {
      throw new HttpException('Số lượng sản phẩm không đủ', HttpStatus.BAD_REQUEST);
    }

    const order = await this.prisma.order.create({
      data: {
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice,
        userId: data.userId,
        status: 'PENDING',
        orderItems: {
          create: cart.cartItems.map(cartItem => ({
            productId: cartItem.productId,
            quantity: cartItem.quantity,
          })),
        },
      },
      include: {
        orderItems: true,
      },
    });

    for (const cartItem of cart.cartItems) {
      await this.productServiceClient.send({ cmd: 'update_product' }, {
        id: cartItem.productId,
        data: { stock: { decrement: cartItem.quantity } },
      }).toPromise();
    }

    await this.cartServiceClient.send({ cmd: 'delete_cart' }, cart.id).toPromise();

    return order;
  }

  async deleteOrder(params: { id: number; userId: number }): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      throw new HttpException('Đơn hàng không tồn tại', HttpStatus.NOT_FOUND);
    }

    if (order.userId !== params.userId) {
      throw new HttpException('Bạn không có quyền xóa đơn hàng này', HttpStatus.UNAUTHORIZED);
    }

    return this.prisma.order.delete({
      where: { id: params.id },
    });
  }

  async getUser(userId: number): Promise<any> {
    const user = await this.userServiceClient.send({ cmd: 'get_user' }, userId).toPromise();
    if (!user) {
      throw new HttpException('Người dùng không tồn tại', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  async getCartByUserId(userId: number): Promise<any> {
    const cart = await this.cartServiceClient.send({ cmd: 'get_cart_by_user_id' }, userId).toPromise();
    if (!cart) {
      throw new HttpException('Giỏ hàng không tồn tại', HttpStatus.NOT_FOUND);
    }
    return cart;
  }

  async getProduct(productId: number): Promise<any> {
    const product = await this.productServiceClient.send({ cmd: 'get_product' }, productId).toPromise();
    if (!product) {
      throw new HttpException('Không tìm thấy sản phẩm', HttpStatus.NOT_FOUND);
    }
    return product;
  }
}
