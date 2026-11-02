
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import authRouter from './auth.js';
import jwt from 'jsonwebtoken';
import { PrismaClient } from './generated/prisma/index.js';

const app = express();
const server = createServer(app);
const prisma = new PrismaClient();

const origin = process.env.WEB_ORIGIN || 'http://localhost:3000';

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sexchat-api' });
});

app.use('/v1/auth', authRouter);

// Criação de salas permanece desativada até a implementação
// completa de autenticação, permissões e verificação de idade.
const roomInput = z.object({
  title: z.string().trim().min(3).max(160),
  isPrivate: z.boolean().default(false)
});

app.post('/v1/rooms', (req, res) => {
  const result = roomInput.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      details: result.error.flatten()
    });
  }

  return res.status(501).json({
    error: 'NOT_CONFIGURED',
    message:
      'Implemente autenticação, verificação 18+, permissão de criador e banco de dados.',
    validated: result.data
  });
});

// Autenticação HTTP para conversas privadas.
async function authenticatedUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token || !process.env.JWT_SECRET) return res.status(401).json({ message: 'Faça login.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') return res.status(401).json({ message: 'Sessão inválida.' });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'SUSPENDED' || user.status === 'CLOSED') return res.status(403).json({ message: 'Conta indisponível.' });
    res.locals.userId = user.id;
    next();
  } catch { return res.status(401).json({ message: 'Sessão expirada. Entre novamente.' }); }
}

app.get('/v1/chat/users', authenticatedUser, async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  if (query.length < 2) return res.json([]);
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: res.locals.userId }, displayName: { contains: query, mode: 'insensitive' }, status: { notIn: ['SUSPENDED', 'CLOSED'] } },
      select: { id: true, displayName: true }, take: 20
    });
    return res.json(users);
  } catch { return res.status(500).json({ message: 'Não foi possível pesquisar usuários.' }); }
});

app.get('/v1/chat/conversations', authenticatedUser, async (_req, res) => {
  try {
    const id = res.locals.userId as string;
    const conversations = await prisma.directConversation.findMany({
      where: { OR: [{ userOneId: id }, { userTwoId: id }] },
      orderBy: { updatedAt: 'desc' },
      include: { userOne: { select: { id: true, displayName: true } }, userTwo: { select: { id: true, displayName: true } } },
      take: 100
    });
    return res.json(conversations.map(c => ({ id: c.id, updatedAt: c.updatedAt, other: c.userOneId === id ? c.userTwo : c.userOne })));
  } catch { return res.status(500).json({ message: 'Não foi possível listar conversas.' }); }
});

app.post('/v1/chat/conversations', authenticatedUser, async (req, res) => {
  const parsed = z.object({ otherUserId: z.string().min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Usuário inválido.' });
  const self = res.locals.userId as string;
  const other = parsed.data.otherUserId;
  if (self === other) return res.status(400).json({ message: 'Escolha outra pessoa.' });
  try {
    const user = await prisma.user.findUnique({ where: { id: other }, select: { id: true, displayName: true, status: true } });
    if (!user || user.status === 'SUSPENDED' || user.status === 'CLOSED') return res.status(404).json({ message: 'Usuário indisponível.' });
    const [userOneId, userTwoId] = [self, other].sort();
    const conversation = await prisma.directConversation.upsert({
      where: { userOneId_userTwoId: { userOneId, userTwoId } },
      create: { userOneId, userTwoId }, update: {}
    });
    return res.json({ id: conversation.id, updatedAt: conversation.updatedAt, other: { id: user.id, displayName: user.displayName } });
  } catch { return res.status(500).json({ message: 'Não foi possível abrir a conversa.' }); }
});

const io = new Server(server, {
  cors: { origin, credentials: true },
  maxHttpBufferSize: 16 * 1024
});

// Autenticação dos usuários do chat.
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

    if (
      !user ||
      user.status === 'SUSPENDED' ||
      user.status === 'CLOSED'
    ) {
      return next(
        new Error('Conta não autorizada para o chat.')
      );
    }

    socket.data.userId = user.id;
    socket.data.displayName = user.displayName;

    next();
  } catch {
    next(
      new Error('Token inválido ou expirado. Faça login novamente.')
    );
  }
});

io.on('connection', socket => {
  // Abre uma conversa somente para um de seus participantes.
  socket.on(
    'direct:join',
    async (conversationId: unknown) => {
      if (
        typeof conversationId !== 'string' ||
        conversationId.length === 0 ||
        conversationId.length > 100
      ) {
        socket.emit('chat:error', {
          code: 'INVALID_INPUT',
          message: 'Conversa inválida.'
        });
        return;
      }

      try {
        const conversation =
          await prisma.directConversation.findFirst({
            where: {
              id: conversationId,
              OR: [
                { userOneId: socket.data.userId },
                { userTwoId: socket.data.userId }
              ]
            }
          });

        if (!conversation) {
          socket.emit('chat:error', {
            code: 'FORBIDDEN',
            message: 'Você não tem acesso a esta conversa.'
          });
          return;
        }

        const room = `direct:${conversation.id}`;
        await socket.join(room);

        const messages = await prisma.directMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'asc' },
          take: 100,
          select: {
            id: true,
            senderId: true,
            body: true,
            createdAt: true
          }
        });

        socket.emit('direct:history', messages);
      } catch {
        socket.emit('chat:error', {
          code: 'SERVER_ERROR',
          message: 'Não foi possível abrir a conversa.'
        });
      }
    }
  );

  // Valida, salva e transmite uma mensagem privada.
  socket.on('direct:send', async (data: unknown) => {
    if (
      typeof data !== 'object' ||
      data === null ||
      !('conversationId' in data) ||
      !('message' in data)
    ) {
      socket.emit('chat:error', {
        code: 'INVALID_INPUT',
        message: 'Mensagem inválida.'
      });
      return;
    }

    const { conversationId, message } = data;

    if (
      typeof conversationId !== 'string' ||
      conversationId.length === 0 ||
      conversationId.length > 100 ||
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

    try {
      const conversation =
        await prisma.directConversation.findFirst({
          where: {
            id: conversationId,
            OR: [
              { userOneId: socket.data.userId },
              { userTwoId: socket.data.userId }
            ]
          }
        });

      if (!conversation) {
        socket.emit('chat:error', {
          code: 'FORBIDDEN',
          message: 'Você não tem acesso a esta conversa.'
        });
        return;
      }

      const room = `direct:${conversation.id}`;

      if (!socket.rooms.has(room)) {
        socket.emit('chat:error', {
          code: 'NOT_IN_CONVERSATION',
          message: 'Entre na conversa antes de enviar mensagens.'
        });
        return;
      }

      const savedMessage = await prisma.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: socket.data.userId,
          body: message.trim()
        },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          body: true,
          createdAt: true
        }
      });

      await prisma.directConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });

      io.to(room).emit('direct:message', savedMessage);
    } catch {
      socket.emit('chat:error', {
        code: 'SERVER_ERROR',
        message: 'Não foi possível enviar a mensagem.'
      });
    }
  });
});

const port = Number(
  process.env.PORT || process.env.API_PORT || 4000
);

server.listen(port, () => {
  console.log(`Sexchat API listening on port ${port}`);
});

