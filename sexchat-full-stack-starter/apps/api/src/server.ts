
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
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

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

// Creator onboarding: requests do not grant creator privileges or verified status.
const creatorApplicationSchema = z.object({
  bio: z.string().trim().min(20).max(1000),
  termsAccepted: z.literal(true),
  adultDeclaration: z.literal(true)
});

app.get('/v1/creator/application', authenticatedUser, async (_req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: res.locals.userId },
      select: { role: true, status: true, ageVerification: true, identityVerification: true,
        profile: { select: { bio: true, applicationStatus: true, applicationNote: true } } } });
    if (!user) return res.status(404).json({ message: 'Conta não encontrada.' });
    return res.json(user);
  } catch { return res.status(500).json({ message: 'Não foi possível consultar sua solicitação.' }); }
});

app.post('/v1/creator/application', authenticatedUser, async (req, res) => {
  const parsed = creatorApplicationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Preencha a descrição (20 a 1000 caracteres) e aceite os termos.' });
  try {
    const user = await prisma.user.findUnique({ where: { id: res.locals.userId }, include: { profile: true } });
    if (!user || user.status === 'SUSPENDED' || user.status === 'CLOSED') return res.status(403).json({ message: 'Conta indisponível.' });
    if (user.profile?.applicationStatus === 'PENDING' || user.profile?.applicationStatus === 'APPROVED')
      return res.status(409).json({ message: 'Já existe uma solicitação em análise ou aprovada.' });
    const profile = await prisma.creatorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, bio: parsed.data.bio, termsAcceptedAt: new Date(), applicationStatus: 'PENDING' },
      update: { bio: parsed.data.bio, termsAcceptedAt: new Date(), applicationStatus: 'PENDING', applicationNote: null, applicationReviewedAt: null, applicationReviewerId: null },
      select: { applicationStatus: true }
    });
    return res.status(201).json({ status: profile.applicationStatus, message: 'Solicitação recebida. A verificação de idade e identidade deve ser realizada por um processo seguro antes da aprovação.' });
  } catch { return res.status(500).json({ message: 'Não foi possível enviar sua solicitação.' }); }
});

// Admins are provisioned separately. Never expose an endpoint to self-promote to ADMIN.
app.get('/v1/admin/creator-applications', authenticatedUser, async (_req, res) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: res.locals.userId } });
    if (admin?.role !== 'ADMIN' || admin.status !== 'ACTIVE') return res.status(403).json({ message: 'Acesso restrito.' });
    const applications = await prisma.creatorProfile.findMany({ where: { applicationStatus: 'PENDING' },
      orderBy: { createdAt: 'asc' }, take: 100,
      select: { userId: true, bio: true, createdAt: true, applicationStatus: true,
        user: { select: { displayName: true, ageVerification: true, identityVerification: true } } } });
    return res.json(applications);
  } catch { return res.status(500).json({ message: 'Não foi possível consultar solicitações.' }); }
});

const reviewSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT']), note: z.string().trim().max(500).optional() });
app.post('/v1/admin/creator-applications/:userId/review', authenticatedUser, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success || !z.string().cuid().safeParse(req.params.userId).success)
    return res.status(400).json({ message: 'Dados de revisão inválidos.' });
  try {
    const admin = await prisma.user.findUnique({ where: { id: res.locals.userId } });
    if (admin?.role !== 'ADMIN' || admin.status !== 'ACTIVE') return res.status(403).json({ message: 'Acesso restrito.' });
    const user = await prisma.user.findUnique({ where: { id: req.params.userId }, include: { profile: true } });
    if (!user?.profile || user.profile.applicationStatus !== 'PENDING') return res.status(404).json({ message: 'Solicitação pendente não encontrada.' });
    if (parsed.data.decision === 'APPROVE' && (user.status !== 'ACTIVE' || user.ageVerification !== 'VERIFIED' || user.identityVerification !== 'VERIFIED'))
      return res.status(409).json({ message: 'A aprovação exige conta ativa e verificação real de idade e identidade já concluída por processo independente.' });
    await prisma.$transaction(async tx => {
      await tx.creatorProfile.update({ where: { userId: user.id }, data: {
        applicationStatus: parsed.data.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        applicationReviewedAt: new Date(), applicationReviewerId: admin.id, applicationNote: parsed.data.note || null,
        ...(parsed.data.decision === 'APPROVE' ? { consentReviewAt: new Date() } : {})
      } });
      if (parsed.data.decision === 'APPROVE') await tx.user.update({ where: { id: user.id }, data: { role: 'CREATOR' } });
    });
    return res.json({ ok: true });
  } catch { return res.status(500).json({ message: 'Não foi possível revisar a solicitação.' }); }
});

// Video requires a separate LiveKit deployment. Credentials never reach the browser.
const videoConfig = () => {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return null;
  return { url, key, secret };
};
const roomsInput = z.object({ title: z.string().trim().min(3).max(160) });
const roomIdInput = z.string().min(1).max(100);

app.get('/v1/rooms', authenticatedUser, async (_req, res) => {
  try {
    const rooms = await prisma.liveRoom.findMany({
      where: { isPrivate: false, status: 'LIVE' },
      orderBy: { startedAt: 'desc' }, take: 50,
      select: { id: true, title: true, creatorId: true, startedAt: true,
        creator: { select: { displayName: true } } }
    });
    return res.json(rooms);
  } catch { return res.status(500).json({ message: 'Não foi possível listar as salas.' }); }
});

app.post('/v1/rooms', authenticatedUser, async (req, res) => {
  const parsed = roomsInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Informe um título de 3 a 160 caracteres.' });
  if (!videoConfig()) return res.status(503).json({ message: 'Serviço de vídeo ainda não configurado.' });
  try {
    const creator = await prisma.user.findUnique({ where: { id: res.locals.userId } });
    if (!creator || !['CREATOR', 'ADMIN'].includes(creator.role) ||
      creator.status !== 'ACTIVE' || creator.ageVerification !== 'VERIFIED' ||
      creator.identityVerification !== 'VERIFIED') {
      return res.status(403).json({ message: 'É necessário ser criador aprovado e ter idade e identidade verificadas.' });
    }
    const existing = await prisma.liveRoom.findFirst({ where: { creatorId: creator.id, status: 'LIVE' } });
    if (existing) return res.status(409).json({ message: 'Encerre sua transmissão atual antes de criar outra.' });
    const room = await prisma.liveRoom.create({ data: { creatorId: creator.id, title: parsed.data.title,
      status: 'LIVE', startedAt: new Date(), isPrivate: false } });
    return res.status(201).json({ id: room.id, title: room.title });
  } catch { return res.status(500).json({ message: 'Não foi possível criar a transmissão.' }); }
});

app.post('/v1/rooms/:id/token', authenticatedUser, async (req, res) => {
  const parsed = roomIdInput.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ message: 'Sala inválida.' });
  const config = videoConfig();
  if (!config) return res.status(503).json({ message: 'Serviço de vídeo ainda não configurado.' });
  try {
    const [room, user] = await Promise.all([
      prisma.liveRoom.findUnique({ where: { id: parsed.data } }),
      prisma.user.findUnique({ where: { id: res.locals.userId } })
    ]);
    if (!room || room.status !== 'LIVE' || room.isPrivate) return res.status(404).json({ message: 'Transmissão indisponível.' });
    if (!user || user.status !== 'ACTIVE' || user.ageVerification !== 'VERIFIED') {
      return res.status(403).json({ message: 'Acesso permitido somente para usuários com idade verificada e conta ativa.' });
    }
    const isHost = room.creatorId === user.id;
    if (isHost && (!['CREATOR','ADMIN'].includes(user.role) || user.identityVerification !== 'VERIFIED')) {
      return res.status(403).json({ message: 'Criador não aprovado.' });
    }
    const token = new AccessToken(config.key, config.secret, {
      identity: user.id, name: user.displayName, ttl: '15m'
    });
    token.addGrant({ roomJoin: true, room: `live-${room.id}`, canPublish: isHost,
      canPublishData: true, canSubscribe: true });
    return res.json({ token: await token.toJwt(), url: config.url, isHost });
  } catch { return res.status(500).json({ message: 'Não foi possível acessar a transmissão.' }); }
});

app.post('/v1/rooms/:id/end', authenticatedUser, async (req, res) => {
  const parsed = roomIdInput.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ message: 'Sala inválida.' });
  try {
    const room = await prisma.liveRoom.findUnique({ where: { id: parsed.data } });
    const user = await prisma.user.findUnique({ where: { id: res.locals.userId } });
    if (!room || !user || (room.creatorId !== user.id && user.role !== 'ADMIN')) {
      return res.status(403).json({ message: 'Sem permissão para encerrar a transmissão.' });
    }
    await prisma.liveRoom.update({ where: { id: room.id }, data: { status: 'ENDED', endedAt: new Date() } });
    const config = videoConfig();
    if (config) {
      try { await new RoomServiceClient(config.url, config.key, config.secret).deleteRoom(`live-${room.id}`); }
      catch (error) { console.warn('LiveKit room cleanup:', error); }
    }
    return res.json({ ok: true });
  } catch { return res.status(500).json({ message: 'Não foi possível encerrar a transmissão.' }); }
});

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

