import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import authRouter from './auth.js';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const app = express();
const server = createServer(app);
const prisma = new PrismaClient();
const origin = process.env.WEB_ORIGIN || 'http://localhost:3000';
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'sexchat-api' }));
app.use('/v1/auth', authRouter);
// Placeholders seguros: endpoints sensíveis ficam desativados até implementar
// autenticação, autorização, persistência, verificação e auditoria.
const roomInput = z.object({ title: z.string().trim().min(3).max(160), isPrivate: z.boolean().default(false) });
app.post('/v1/rooms', (req, res) => {
  const result = roomInput.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'INVALID_INPUT', details: result.error.flatten() });
  return res.status(501).json({ error: 'NOT_CONFIGURED', message: 'Implemente autenticação, verificação 18+, permissão de criador e banco de dados.', validated: result.data });
});
const io = new Server(server, { cors: { origin, credentials: true }, maxHttpBufferSize: 16 * 1024 });
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const secret = process.env.JWT_SECRET;

    if (typeof token !== 'string' || !secret) {
      return next(new Error('Faça login para acessar o chat.'));
    }

    const payload = jwt.verify(token, secret);

    if (typeof payload === 'string' || !payload.sub) {
      return next(new Error('Token inválido.'));
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        displayName: true,
        status: true
      }
    });

    if (!user || user.status === 'SUSPENDED' || user.status === 'CLOSED') {
      return next(new Error('Conta não autorizada para o chat.'));
    }

    socket.data.userId = user.id;
    socket.data.displayName = user.displayName;

    next();
  } catch {
    next(new Error('Token inválido ou expirado. Faça login novamente.'));
  }
});

io.on('connection', socket => {
  socket.on('room:join', (id: unknown) => {
    if (
      typeof id === 'string' &&
      id.length > 0 &&
      id.length <= 100
    ) {
      socket.join(id);
    }
  });

  socket.on('chat:send', (data: unknown) => {
    if (
      typeof data !== 'object' ||
      data === null ||
      !('roomId' in data) ||
      !('message' in data)
    ) {
      socket.emit('chat:error', {
        code: 'INVALID_INPUT',
        message: 'Mensagem inválida.'
      });
      return;
    }

    const { roomId, message } = data;

    if (
      typeof roomId !== 'string' ||
      roomId.length === 0 ||
      roomId.length > 100 ||
      typeof message !== 'string' ||
      message.trim().length === 0 ||
      message.length > 2000
    ) {
      socket.emit('chat:error', {
        code: 'INVALID_INPUT',
        message: 'A mensagem deve ter entre 1 e 2000 caracteres.'
      });
      return;
    }

    if (!socket.rooms.has(roomId)) {
      socket.emit('chat:error', {
        code: 'NOT_IN_ROOM',
        message: 'Entre na conversa antes de enviar mensagens.'
      });
      return;
    }

    io.to(roomId).emit('chat:message', {
      roomId,
      senderId: socket.data.userId,
      senderName: socket.data.displayName,
      message: message.trim(),
      sentAt: new Date().toISOString()
    });
  });
});

const port = Number(process.env.PORT || process.env.API_PORT || 4000);
server.listen(port, () => console.log(`Sexchat API listening on port ${port}`));
