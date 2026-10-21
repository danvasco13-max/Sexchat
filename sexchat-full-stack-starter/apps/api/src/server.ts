import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';

const app = express();
const server = createServer(app);
const origin = process.env.WEB_ORIGIN || 'http://localhost:3000';
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'sexchat-api' }));

// Placeholders seguros: endpoints sensíveis ficam desativados até implementar
// autenticação, autorização, persistência, verificação e auditoria.
for (const path of ['/v1/auth/register','/v1/auth/login','/v1/video/token','/v1/payments/checkout','/v1/reports']) {
  app.post(path, (_req, res) => res.status(501).json({
    error: 'NOT_CONFIGURED',
    message: 'Este recurso ainda não está habilitado. Configure e teste as integrações seguras antes de usar.'
  }));
}
const roomInput = z.object({ title: z.string().trim().min(3).max(160), isPrivate: z.boolean().default(false) });
app.post('/v1/rooms', (req, res) => {
  const result = roomInput.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'INVALID_INPUT', details: result.error.flatten() });
  return res.status(501).json({ error: 'NOT_CONFIGURED', message: 'Implemente autenticação, verificação 18+, permissão de criador e banco de dados.', validated: result.data });
});
const io = new Server(server, { cors: { origin, credentials: true }, maxHttpBufferSize: 16 * 1024 });
io.use((_socket, next) => {
  if (process.env.NODE_ENV === 'production') return next(new Error('Autenticação do chat não configurada.'));
  next();
});
io.on('connection', socket => {
  socket.on('room:join', (id: unknown) => {
    if (typeof id === 'string' && id.length > 0 && id.length <= 100) socket.join(id);
  });
  socket.on('chat:send', () => socket.emit('chat:error', {
    code: 'NOT_CONFIGURED', message: 'Chat real ainda não está ativado.'
  }));
});
const port = Number(process.env.API_PORT || 4000);
server.listen(port, () => console.log(`Sexchat API listening on port ${port}`));
